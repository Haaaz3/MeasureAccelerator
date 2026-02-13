package com.algoaccel.service;

import com.algoaccel.model.component.*;
import com.algoaccel.model.enums.ApprovalStatus;
import com.algoaccel.model.enums.LogicalOperator;
import com.algoaccel.model.enums.TimingOperator;
import com.algoaccel.repository.ComponentRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Component Matcher Service
 *
 * Handles exact matching, similarity scoring, and diffing for the component library.
 *
 * Key design principle: Components match ONLY when 100% identical.
 * No fuzzy matching for reuse. Similar matching is only for suggestions.
 *
 * Ported from: src/services/componentMatcher.ts
 */
@Service
@Transactional(readOnly = true)
public class ComponentMatcherService {

    private final ComponentRepository componentRepository;
    private final ObjectMapper objectMapper;

    public ComponentMatcherService(ComponentRepository componentRepository, ObjectMapper objectMapper) {
        this.componentRepository = componentRepository;
        this.objectMapper = objectMapper;
    }

    // ========================================================================
    // Public API: Hash Generation
    // ========================================================================

    /**
     * Generate a deterministic hash for a library component's identity.
     *
     * For atomics: hash of (OID + timing operator + quantity + unit + position + reference + negation)
     * For composites: hash of (sorted child IDs + operator)
     */
    public String generateComponentHash(LibraryComponent component) {
        Map<String, Object> identityKey;

        if (component instanceof AtomicComponent atomic) {
            identityKey = buildAtomicIdentityKey(atomic);
        } else if (component instanceof CompositeComponent composite) {
            identityKey = buildCompositeIdentityKey(composite);
        } else {
            throw new IllegalArgumentException("Unknown component type");
        }

        return djb2Hash(toJson(identityKey));
    }

    /**
     * Generate a hash from a parsed component (import candidate).
     *
     * Follows the same normalization rules as generateComponentHash
     * so that identical components produce identical hashes regardless
     * of whether they come from the library or from import parsing.
     */
    public String generateParsedComponentHash(ParsedComponent parsed) {
        Map<String, Object> identityKey;

        if (parsed.getChildren() != null && !parsed.getChildren().isEmpty()) {
            // Composite
            identityKey = buildParsedCompositeIdentityKey(parsed);
        } else {
            // Atomic
            identityKey = buildAtomicIdentityKeyFromParsed(parsed);
        }

        return djb2Hash(toJson(identityKey));
    }

    // ========================================================================
    // Public API: Exact Matching
    // ========================================================================

    /**
     * Find an exact match in the library by comparing hashes.
     *
     * Returns the matching library component, or null if no exact match exists.
     * Exact match = 100% identical identity fields. No fuzzy tolerance.
     */
    public LibraryComponent findExactMatch(ParsedComponent incoming) {
        String incomingHash = generateParsedComponentHash(incoming);
        boolean isComposite = incoming.getChildren() != null && !incoming.getChildren().isEmpty();

        Map<String, LibraryComponent> library = getAllComponentsAsMap();

        for (LibraryComponent component : library.values()) {
            // Standard hash comparison
            String libraryHash = generateComponentHash(component);
            if (libraryHash.equals(incomingHash)) {
                return component;
            }

            // For composite incoming vs composite library: resolve children and compare
            if (isComposite && component instanceof CompositeComponent composite) {
                if (matchCompositeByChildren(incoming, composite, library)) {
                    return component;
                }
            }
        }

        // Fallback: try matching by normalized value set name + timing + negation
        return findNameMatch(incoming, library);
    }

    /**
     * Find an exact match in the library, prioritizing approved components.
     *
     * Returns the approved component if one matches, otherwise returns any match.
     * This ensures we use vetted components when available.
     */
    public ExactMatchResult findExactMatchPrioritizeApproved(ParsedComponent incoming) {
        String incomingHash = generateParsedComponentHash(incoming);
        boolean isComposite = incoming.getChildren() != null && !incoming.getChildren().isEmpty();

        Map<String, LibraryComponent> library = getAllComponentsAsMap();

        LibraryComponent approvedMatch = null;
        LibraryComponent anyMatch = null;

        for (LibraryComponent component : library.values()) {
            String libraryHash = generateComponentHash(component);

            if (libraryHash.equals(incomingHash)) {
                if (component.getVersionInfo() != null &&
                    component.getVersionInfo().getStatus() == ApprovalStatus.APPROVED) {
                    approvedMatch = component;
                    break; // Approved match found, use it
                }
                if (anyMatch == null) {
                    anyMatch = component;
                }
            }

            // For composite incoming vs composite library
            if (isComposite && component instanceof CompositeComponent composite) {
                if (matchCompositeByChildren(incoming, composite, library)) {
                    if (component.getVersionInfo() != null &&
                        component.getVersionInfo().getStatus() == ApprovalStatus.APPROVED) {
                        approvedMatch = component;
                        break;
                    }
                    if (anyMatch == null) {
                        anyMatch = component;
                    }
                }
            }
        }

        // If we have an approved match, use it
        if (approvedMatch != null) {
            return new ExactMatchResult(approvedMatch, true, null);
        }

        // If we have a non-approved match, also check if there's a similar approved one
        if (anyMatch != null) {
            LibraryComponent alternateApproved = findApprovedAlternative(incoming, library);
            return new ExactMatchResult(anyMatch, false, alternateApproved);
        }

        // Fallback to name matching
        LibraryComponent nameMatch = findNameMatch(incoming, library);
        if (nameMatch != null) {
            boolean isApproved = nameMatch.getVersionInfo() != null &&
                nameMatch.getVersionInfo().getStatus() == ApprovalStatus.APPROVED;
            return new ExactMatchResult(nameMatch, isApproved, null);
        }

        return new ExactMatchResult(null, false, null);
    }

    /**
     * Fallback matching by normalized value set name + timing + negation.
     */
    public LibraryComponent findNameMatch(ParsedComponent incoming, Map<String, LibraryComponent> library) {
        // Only works for atomic incoming components with a name
        if (incoming.getChildren() != null && !incoming.getChildren().isEmpty()) {
            return null;
        }

        String incomingName = incoming.getValueSetName() != null ?
            incoming.getValueSetName() : incoming.getName();
        if (incomingName == null || incomingName.isEmpty()) {
            return null;
        }

        String normalizedIncoming = normalizeValueSetName(incomingName);
        if (normalizedIncoming.isEmpty()) {
            return null;
        }

        TimingOperator incomingTimingOp = incoming.getTiming() != null ?
            incoming.getTiming().getOperator() : TimingOperator.DURING;
        String incomingTimingRef = incoming.getTiming() != null && incoming.getTiming().getReference() != null ?
            incoming.getTiming().getReference() : "Measurement Period";
        boolean incomingNegation = incoming.isNegation();

        for (LibraryComponent component : library.values()) {
            if (!(component instanceof AtomicComponent atomic)) {
                continue;
            }

            if (atomic.getValueSet() == null || atomic.getValueSet().getName() == null) {
                continue;
            }

            String normalizedLib = normalizeValueSetName(atomic.getValueSet().getName());
            if (!normalizedLib.equals(normalizedIncoming)) {
                continue;
            }

            // Also check timing operator, reference, and negation match
            TimingOperator libTimingOp = atomic.getTiming() != null ?
                atomic.getTiming().getOperator() : TimingOperator.DURING;
            String libTimingRef = atomic.getTiming() != null && atomic.getTiming().getReference() != null ?
                atomic.getTiming().getReference() : "Measurement Period";
            boolean libNegation = atomic.isNegation();

            if (Objects.equals(libTimingOp, incomingTimingOp) &&
                libTimingRef.equals(incomingTimingRef) &&
                libNegation == incomingNegation) {
                return component;
            }
        }

        return null;
    }

    // ========================================================================
    // Public API: Similarity Scoring
    // ========================================================================

    /**
     * Find similar components in the library.
     *
     * Returns matches sorted by similarity score (descending).
     * Only returns results above the threshold (default 0.5).
     */
    public List<ComponentMatch> findSimilarComponents(ParsedComponent incoming, double threshold) {
        String incomingHash = generateParsedComponentHash(incoming);
        Map<String, LibraryComponent> library = getAllComponentsAsMap();
        List<ComponentMatch> matches = new ArrayList<>();

        for (LibraryComponent component : library.values()) {
            // Skip exact matches - those are handled by findExactMatch
            String libraryHash = generateComponentHash(component);
            if (libraryHash.equals(incomingHash)) {
                continue;
            }

            double similarity = computeSimilarity(incoming, component);

            if (similarity >= threshold) {
                List<ComponentDiff> differences = computeComponentDiff(component, incoming);

                matches.add(new ComponentMatch(
                    incoming,
                    "similar",
                    component,
                    similarity,
                    differences
                ));
            }
        }

        // Sort by similarity descending
        matches.sort((a, b) -> Double.compare(b.getSimilarity(), a.getSimilarity()));

        return matches;
    }

    public List<ComponentMatch> findSimilarComponents(ParsedComponent incoming) {
        return findSimilarComponents(incoming, 0.5);
    }

    // ========================================================================
    // Public API: Diffing
    // ========================================================================

    /**
     * Compute field-level diff between an existing library component and an incoming parsed component.
     */
    public List<ComponentDiff> computeComponentDiff(LibraryComponent existing, ParsedComponent incoming) {
        List<ComponentDiff> diffs = new ArrayList<>();

        if (existing instanceof AtomicComponent atomic) {
            // Compare value set OID
            String incomingOid = incoming.getValueSetOid() != null ? incoming.getValueSetOid() : "";
            String existingOid = atomic.getValueSet() != null && atomic.getValueSet().getOid() != null ?
                atomic.getValueSet().getOid() : "";
            if (!existingOid.equals(incomingOid)) {
                diffs.add(new ComponentDiff(
                    "valueSet",
                    existingOid,
                    incomingOid,
                    String.format("Value set OID differs: library has \"%s\", incoming has \"%s\"",
                        existingOid, incomingOid)
                ));
            }

            // Compare timing operator
            String existingOp = atomic.getTiming() != null && atomic.getTiming().getOperator() != null ?
                atomic.getTiming().getOperator().getValue() : "";
            String incomingOp = incoming.getTiming() != null && incoming.getTiming().getOperator() != null ?
                incoming.getTiming().getOperator().getValue() : "";
            if (!existingOp.equals(incomingOp)) {
                diffs.add(new ComponentDiff(
                    "timing",
                    existingOp,
                    incomingOp,
                    String.format("Timing operator differs: library has \"%s\", incoming has \"%s\"",
                        existingOp, incomingOp)
                ));
            }

            // Compare timing quantity
            Integer existingQty = atomic.getTiming() != null ? atomic.getTiming().getQuantity() : null;
            Integer incomingQty = incoming.getTiming() != null ? incoming.getTiming().getQuantity() : null;
            if (!Objects.equals(existingQty, incomingQty)) {
                diffs.add(new ComponentDiff(
                    "timing",
                    existingQty != null ? existingQty.toString() : "none",
                    incomingQty != null ? incomingQty.toString() : "none",
                    String.format("Timing quantity differs: library has %s, incoming has %s",
                        existingQty != null ? existingQty : "none",
                        incomingQty != null ? incomingQty : "none")
                ));
            }

            // Compare timing unit
            String existingUnit = atomic.getTiming() != null && atomic.getTiming().getUnit() != null ?
                atomic.getTiming().getUnit() : "";
            String incomingUnit = incoming.getTiming() != null && incoming.getTiming().getUnit() != null ?
                incoming.getTiming().getUnit() : "";
            if (!existingUnit.equals(incomingUnit)) {
                diffs.add(new ComponentDiff(
                    "timing",
                    existingUnit.isEmpty() ? "none" : existingUnit,
                    incomingUnit.isEmpty() ? "none" : incomingUnit,
                    String.format("Timing unit differs: library has \"%s\", incoming has \"%s\"",
                        existingUnit.isEmpty() ? "none" : existingUnit,
                        incomingUnit.isEmpty() ? "none" : incomingUnit)
                ));
            }

            // Compare timing position
            String existingPos = atomic.getTiming() != null && atomic.getTiming().getPosition() != null ?
                atomic.getTiming().getPosition() : "";
            String incomingPos = incoming.getTiming() != null && incoming.getTiming().getPosition() != null ?
                incoming.getTiming().getPosition() : "";
            if (!existingPos.equals(incomingPos)) {
                diffs.add(new ComponentDiff(
                    "timing",
                    existingPos.isEmpty() ? "none" : existingPos,
                    incomingPos.isEmpty() ? "none" : incomingPos,
                    String.format("Timing position differs: library has \"%s\", incoming has \"%s\"",
                        existingPos.isEmpty() ? "none" : existingPos,
                        incomingPos.isEmpty() ? "none" : incomingPos)
                ));
            }

            // Compare timing reference
            String existingRef = atomic.getTiming() != null && atomic.getTiming().getReference() != null ?
                atomic.getTiming().getReference() : "";
            String incomingRef = incoming.getTiming() != null && incoming.getTiming().getReference() != null ?
                incoming.getTiming().getReference() : "";
            if (!existingRef.equals(incomingRef)) {
                diffs.add(new ComponentDiff(
                    "timing",
                    existingRef.isEmpty() ? "none" : existingRef,
                    incomingRef.isEmpty() ? "none" : incomingRef,
                    String.format("Timing reference differs: library has \"%s\", incoming has \"%s\"",
                        existingRef.isEmpty() ? "none" : existingRef,
                        incomingRef.isEmpty() ? "none" : incomingRef)
                ));
            }

            // Compare negation
            boolean existingNeg = atomic.isNegation();
            boolean incomingNeg = incoming.isNegation();
            if (existingNeg != incomingNeg) {
                diffs.add(new ComponentDiff(
                    "negation",
                    String.valueOf(existingNeg),
                    String.valueOf(incomingNeg),
                    String.format("Negation differs: library has %s, incoming has %s",
                        existingNeg, incomingNeg)
                ));
            }
        } else if (existing instanceof CompositeComponent composite) {
            // Composite comparison
            LogicalOperator existingOp = composite.getOperator();
            LogicalOperator incomingOp = incoming.getOperator() != null ?
                incoming.getOperator() : LogicalOperator.AND;
            if (!Objects.equals(existingOp, incomingOp)) {
                diffs.add(new ComponentDiff(
                    "operator",
                    existingOp != null ? existingOp.getValue() : "AND",
                    incomingOp.getValue(),
                    String.format("Logical operator differs: library has \"%s\", incoming has \"%s\"",
                        existingOp != null ? existingOp.getValue() : "AND", incomingOp.getValue())
                ));
            }

            // Compare children count
            int existingChildCount = parseChildReferences(composite.getChildren()).size();
            int incomingChildCount = incoming.getChildren() != null ? incoming.getChildren().size() : 0;
            if (existingChildCount != incomingChildCount) {
                diffs.add(new ComponentDiff(
                    "children",
                    String.valueOf(existingChildCount),
                    String.valueOf(incomingChildCount),
                    String.format("Child count differs: library has %d children, incoming has %d",
                        existingChildCount, incomingChildCount)
                ));
            }
        }

        return diffs;
    }

    // ========================================================================
    // Public API: Identity Comparison
    // ========================================================================

    /**
     * Check if two library components are identical.
     */
    public boolean areComponentsIdentical(LibraryComponent a, LibraryComponent b) {
        return generateComponentHash(a).equals(generateComponentHash(b));
    }

    // ========================================================================
    // Public API: Readable Identity
    // ========================================================================

    /**
     * Generate a human-readable identity string for a component.
     */
    public String getReadableIdentity(LibraryComponent component) {
        if (component instanceof AtomicComponent atomic) {
            String negPrefix = atomic.isNegation() ? "NOT " : "";
            String vsName = atomic.getValueSet() != null && atomic.getValueSet().getName() != null ?
                atomic.getValueSet().getName() : "Unknown";
            String oid = atomic.getValueSet() != null && atomic.getValueSet().getOid() != null ?
                atomic.getValueSet().getOid() : "N/A";
            String timingStr = atomic.getTiming() != null && atomic.getTiming().getDisplayExpression() != null ?
                atomic.getTiming().getDisplayExpression() : formatTiming(atomic.getTiming());

            return String.format("%s%s (%s) %s", negPrefix, vsName, oid, timingStr);
        } else if (component instanceof CompositeComponent composite) {
            List<ComponentReference> children = parseChildReferences(composite.getChildren());
            String childNames = children.stream()
                .map(ComponentReference::getDisplayName)
                .collect(Collectors.joining(", "));
            return String.format("%s(%s)",
                composite.getOperator() != null ? composite.getOperator().getValue() : "AND",
                childNames);
        }
        return "Unknown";
    }

    // ========================================================================
    // Public API: Measure Component Validation
    // ========================================================================

    /**
     * Validate component usage for a measure's data elements.
     */
    public ComponentValidationResult validateMeasureComponents(
            List<DataElementInfo> elements) {

        Map<String, LibraryComponent> library = getAllComponentsAsMap();
        List<ComponentValidationWarning> warnings = new ArrayList<>();
        int linkedToApproved = 0;
        int linkedToDraft = 0;
        int unlinked = 0;

        for (DataElementInfo element : elements) {
            if (element.getValueSetOid() == null || "N/A".equals(element.getValueSetOid())) {
                // Skip elements without value sets (demographics, etc.)
                continue;
            }

            if (element.getLibraryComponentId() != null &&
                !"__ZERO_CODES__".equals(element.getLibraryComponentId())) {

                LibraryComponent component = library.get(element.getLibraryComponentId());
                if (component != null) {
                    if (component.getVersionInfo() != null &&
                        component.getVersionInfo().getStatus() == ApprovalStatus.APPROVED) {
                        linkedToApproved++;
                    } else {
                        linkedToDraft++;
                        // Check if there's an approved alternative
                        LibraryComponent approvedAlt = findApprovedByOid(element.getValueSetOid(), library);

                        if (approvedAlt != null) {
                            warnings.add(new ComponentValidationWarning(
                                element.getId(),
                                element.getDescription(),
                                "approved_available",
                                String.format("Linked to draft component, but approved component \"%s\" is available",
                                    approvedAlt.getName()),
                                approvedAlt.getId(),
                                approvedAlt.getName()
                            ));
                        } else {
                            warnings.add(new ComponentValidationWarning(
                                element.getId(),
                                element.getDescription(),
                                "unapproved_component",
                                String.format("Linked to unapproved component (status: %s)",
                                    component.getVersionInfo() != null ?
                                        component.getVersionInfo().getStatus().getValue() : "unknown"),
                                null,
                                null
                            ));
                        }
                    }
                } else {
                    unlinked++;
                    warnings.add(new ComponentValidationWarning(
                        element.getId(),
                        element.getDescription(),
                        "no_library_match",
                        "Component reference not found in library",
                        null,
                        null
                    ));
                }
            } else {
                unlinked++;
                // Check if there's an approved component that should be used
                LibraryComponent approvedMatch = findApprovedByOid(element.getValueSetOid(), library);

                if (approvedMatch != null) {
                    warnings.add(new ComponentValidationWarning(
                        element.getId(),
                        element.getDescription(),
                        "approved_available",
                        String.format("No library link, but approved component \"%s\" is available",
                            approvedMatch.getName()),
                        approvedMatch.getId(),
                        approvedMatch.getName()
                    ));
                }
            }
        }

        int totalElements = (int) elements.stream()
            .filter(e -> e.getValueSetOid() != null && !"N/A".equals(e.getValueSetOid()))
            .count();
        boolean isValid = warnings.stream()
            .noneMatch(w -> "approved_available".equals(w.type()));

        return new ComponentValidationResult(
            isValid,
            totalElements,
            linkedToApproved,
            linkedToDraft,
            unlinked,
            warnings
        );
    }

    // ========================================================================
    // Private Helpers: Hash Utilities
    // ========================================================================

    /**
     * djb2 string hash - simple, fast, deterministic.
     * Returns a hex string for readability.
     */
    private String djb2Hash(String input) {
        int hash = 5381;
        for (int i = 0; i < input.length(); i++) {
            // hash * 33 + charCode
            hash = ((hash << 5) + hash + input.charAt(i));
        }
        // Convert to unsigned 32-bit then to hex
        return String.format("%08x", hash & 0xFFFFFFFFL);
    }

    private Map<String, Object> buildAtomicIdentityKey(AtomicComponent component) {
        Map<String, Object> key = new LinkedHashMap<>(); // Use LinkedHashMap for consistent ordering
        key.put("oid", component.getValueSet() != null && component.getValueSet().getOid() != null ?
            component.getValueSet().getOid() : "");
        key.put("timingOperator", component.getTiming() != null && component.getTiming().getOperator() != null ?
            component.getTiming().getOperator().getValue() : null);
        key.put("timingQuantity", component.getTiming() != null ? component.getTiming().getQuantity() : null);
        key.put("timingUnit", component.getTiming() != null ? component.getTiming().getUnit() : null);
        key.put("timingPosition", component.getTiming() != null ? component.getTiming().getPosition() : null);
        key.put("timingReference", component.getTiming() != null ? component.getTiming().getReference() : null);
        key.put("negation", component.isNegation());
        return key;
    }

    private Map<String, Object> buildAtomicIdentityKeyFromParsed(ParsedComponent parsed) {
        Map<String, Object> key = new LinkedHashMap<>();
        key.put("oid", parsed.getValueSetOid() != null ? parsed.getValueSetOid() : "");
        key.put("timingOperator", parsed.getTiming() != null && parsed.getTiming().getOperator() != null ?
            parsed.getTiming().getOperator().getValue() : null);
        key.put("timingQuantity", parsed.getTiming() != null ? parsed.getTiming().getQuantity() : null);
        key.put("timingUnit", parsed.getTiming() != null ? parsed.getTiming().getUnit() : null);
        key.put("timingPosition", parsed.getTiming() != null ? parsed.getTiming().getPosition() : null);
        key.put("timingReference", parsed.getTiming() != null ? parsed.getTiming().getReference() : null);
        key.put("negation", parsed.isNegation());
        return key;
    }

    private Map<String, Object> buildCompositeIdentityKey(CompositeComponent component) {
        List<ComponentReference> children = parseChildReferences(component.getChildren());
        List<String> sortedChildIds = children.stream()
            .map(c -> c.getComponentId() + "@" + c.getVersionId())
            .sorted()
            .toList();

        Map<String, Object> key = new LinkedHashMap<>();
        key.put("operator", component.getOperator() != null ? component.getOperator().getValue() : "AND");
        key.put("children", sortedChildIds);
        return key;
    }

    private Map<String, Object> buildParsedCompositeIdentityKey(ParsedComponent parsed) {
        List<String> childHashes = parsed.getChildren().stream()
            .map(this::generateParsedComponentHash)
            .sorted()
            .toList();

        Map<String, Object> key = new LinkedHashMap<>();
        key.put("operator", parsed.getOperator() != null ? parsed.getOperator().getValue() : "AND");
        key.put("children", childHashes);
        return key;
    }

    // ========================================================================
    // Private Helpers: Matching
    // ========================================================================

    private boolean matchCompositeByChildren(
            ParsedComponent incoming,
            CompositeComponent libraryComposite,
            Map<String, LibraryComponent> library) {

        // Operators must match
        LogicalOperator incomingOp = incoming.getOperator() != null ?
            incoming.getOperator() : LogicalOperator.AND;
        if (!Objects.equals(incomingOp, libraryComposite.getOperator())) {
            return false;
        }

        List<ParsedComponent> incomingChildren = incoming.getChildren();
        List<ComponentReference> libraryChildren = parseChildReferences(libraryComposite.getChildren());

        if (incomingChildren == null || incomingChildren.size() != libraryChildren.size()) {
            return false;
        }

        // Build sorted hashes from incoming children (atomic identity hashes)
        List<String> incomingChildHashes = incomingChildren.stream()
            .map(this::generateParsedComponentHash)
            .sorted()
            .toList();

        // Resolve library composite children to their atomic components, then hash
        List<String> libraryChildHashes = new ArrayList<>();
        for (ComponentReference childRef : libraryChildren) {
            LibraryComponent childComponent = library.get(childRef.getComponentId());
            if (childComponent == null || !(childComponent instanceof AtomicComponent atomic)) {
                return false;
            }
            // Hash the atomic using the same identity key
            Map<String, Object> identityKey = buildAtomicIdentityKey(atomic);
            String hash = djb2Hash(toJson(identityKey));
            libraryChildHashes.add(hash);
        }
        Collections.sort(libraryChildHashes);

        // Compare sorted hash arrays
        return incomingChildHashes.equals(libraryChildHashes);
    }

    private String normalizeValueSetName(String name) {
        return name.toLowerCase()
            .trim()
            .replaceAll("\\s+value\\s*set$", "")
            .replaceAll("\\s+", " ");
    }

    private LibraryComponent findApprovedAlternative(ParsedComponent incoming,
            Map<String, LibraryComponent> library) {
        if (incoming.getValueSetOid() == null) {
            return null;
        }
        return findApprovedByOid(incoming.getValueSetOid(), library);
    }

    private LibraryComponent findApprovedByOid(String oid, Map<String, LibraryComponent> library) {
        for (LibraryComponent component : library.values()) {
            if (!(component instanceof AtomicComponent atomic)) {
                continue;
            }
            if (component.getVersionInfo() == null ||
                component.getVersionInfo().getStatus() != ApprovalStatus.APPROVED) {
                continue;
            }
            if (atomic.getValueSet() != null && oid.equals(atomic.getValueSet().getOid())) {
                return component;
            }
        }
        return null;
    }

    // ========================================================================
    // Private Helpers: Similarity
    // ========================================================================

    private double computeSimilarity(ParsedComponent incoming, LibraryComponent existing) {
        // Only score atomics against atomics
        if (!(existing instanceof AtomicComponent atomic)) {
            return 0;
        }

        // Composites (parsed as having children) are not similar to atomics
        if (incoming.getChildren() != null && !incoming.getChildren().isEmpty()) {
            return 0;
        }

        String incomingOid = incoming.getValueSetOid();
        String existingOid = atomic.getValueSet() != null ? atomic.getValueSet().getOid() : null;

        // Different OID = completely different concept = 0 similarity
        if (incomingOid == null || existingOid == null || !incomingOid.equals(existingOid)) {
            return 0;
        }

        // Same OID: base score of 0.7
        double score = 0.7;

        // Same timing operator: +0.15
        if (incoming.getTiming() != null && incoming.getTiming().getOperator() != null &&
            atomic.getTiming() != null && atomic.getTiming().getOperator() != null &&
            incoming.getTiming().getOperator().equals(atomic.getTiming().getOperator())) {
            score += 0.15;
        }

        // Same reference period: +0.15
        if (incoming.getTiming() != null && incoming.getTiming().getReference() != null &&
            atomic.getTiming() != null && atomic.getTiming().getReference() != null &&
            incoming.getTiming().getReference().equals(atomic.getTiming().getReference())) {
            score += 0.15;
        }

        return score;
    }

    // ========================================================================
    // Private Helpers: Formatting
    // ========================================================================

    private String formatTiming(TimingExpression timing) {
        if (timing == null) {
            return "";
        }

        StringBuilder parts = new StringBuilder();

        if (timing.getPosition() != null && !timing.getPosition().isEmpty()) {
            parts.append(timing.getPosition()).append(" ");
        }

        if (timing.getOperator() != null) {
            parts.append(timing.getOperator().getValue()).append(" ");
        }

        if (timing.getQuantity() != null && timing.getUnit() != null) {
            parts.append(timing.getQuantity()).append(" ").append(timing.getUnit()).append(" ");
        }

        if (timing.getReference() != null) {
            parts.append(timing.getReference());
        }

        return parts.toString().trim();
    }

    // ========================================================================
    // Private Helpers: Data Access
    // ========================================================================

    private Map<String, LibraryComponent> getAllComponentsAsMap() {
        return componentRepository.findAllNonArchived().stream()
            .collect(Collectors.toMap(LibraryComponent::getId, c -> c));
    }

    private List<ComponentReference> parseChildReferences(String json) {
        if (json == null || json.isEmpty()) {
            return Collections.emptyList();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<List<ComponentReference>>() {});
        } catch (JsonProcessingException e) {
            return Collections.emptyList();
        }
    }

    private String toJson(Object obj) {
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            return "{}";
        }
    }

    // ========================================================================
    // Inner Classes / Records for DTOs
    // ========================================================================

    /**
     * Represents a parsed component from import (not yet in library).
     */
    public static class ParsedComponent {
        private String name;
        private String valueSetOid;
        private String valueSetName;
        private TimingExpression timing;
        private boolean negation;
        private LogicalOperator operator;
        private List<ParsedComponent> children;

        // Getters and Setters
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getValueSetOid() { return valueSetOid; }
        public void setValueSetOid(String valueSetOid) { this.valueSetOid = valueSetOid; }
        public String getValueSetName() { return valueSetName; }
        public void setValueSetName(String valueSetName) { this.valueSetName = valueSetName; }
        public TimingExpression getTiming() { return timing; }
        public void setTiming(TimingExpression timing) { this.timing = timing; }
        public boolean isNegation() { return negation; }
        public void setNegation(boolean negation) { this.negation = negation; }
        public LogicalOperator getOperator() { return operator; }
        public void setOperator(LogicalOperator operator) { this.operator = operator; }
        public List<ParsedComponent> getChildren() { return children; }
        public void setChildren(List<ParsedComponent> children) { this.children = children; }
    }

    /**
     * Reference to a child component in a composite.
     */
    public static class ComponentReference {
        private String componentId;
        private String versionId;
        private String displayName;

        public String getComponentId() { return componentId; }
        public void setComponentId(String componentId) { this.componentId = componentId; }
        public String getVersionId() { return versionId; }
        public void setVersionId(String versionId) { this.versionId = versionId; }
        public String getDisplayName() { return displayName; }
        public void setDisplayName(String displayName) { this.displayName = displayName; }
    }

    /**
     * Result of exact match with approval status info.
     */
    public record ExactMatchResult(
        LibraryComponent match,
        boolean isApproved,
        LibraryComponent alternateApproved
    ) {}

    /**
     * A match result with similarity score.
     */
    public static class ComponentMatch {
        private final ParsedComponent incomingComponent;
        private final String matchType;
        private final LibraryComponent matchedComponent;
        private final double similarity;
        private final List<ComponentDiff> differences;

        public ComponentMatch(ParsedComponent incomingComponent, String matchType,
                LibraryComponent matchedComponent, double similarity, List<ComponentDiff> differences) {
            this.incomingComponent = incomingComponent;
            this.matchType = matchType;
            this.matchedComponent = matchedComponent;
            this.similarity = similarity;
            this.differences = differences;
        }

        public ParsedComponent getIncomingComponent() { return incomingComponent; }
        public String getMatchType() { return matchType; }
        public LibraryComponent getMatchedComponent() { return matchedComponent; }
        public double getSimilarity() { return similarity; }
        public List<ComponentDiff> getDifferences() { return differences; }
    }

    /**
     * A field-level difference between components.
     */
    public record ComponentDiff(
        String field,
        String expected,
        String actual,
        String description
    ) {}

    /**
     * Info about a data element for validation.
     */
    public static class DataElementInfo {
        private String id;
        private String description;
        private String libraryComponentId;
        private String valueSetOid;

        public String getId() { return id; }
        public void setId(String id) { this.id = id; }
        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }
        public String getLibraryComponentId() { return libraryComponentId; }
        public void setLibraryComponentId(String libraryComponentId) { this.libraryComponentId = libraryComponentId; }
        public String getValueSetOid() { return valueSetOid; }
        public void setValueSetOid(String valueSetOid) { this.valueSetOid = valueSetOid; }
    }

    /**
     * Result of measure component validation.
     */
    public record ComponentValidationResult(
        boolean isValid,
        int totalElements,
        int linkedToApproved,
        int linkedToDraft,
        int unlinked,
        List<ComponentValidationWarning> warnings
    ) {}

    /**
     * A validation warning for a specific element.
     */
    public record ComponentValidationWarning(
        String elementId,
        String elementDescription,
        String type,
        String message,
        String suggestedComponentId,
        String suggestedComponentName
    ) {}
}
