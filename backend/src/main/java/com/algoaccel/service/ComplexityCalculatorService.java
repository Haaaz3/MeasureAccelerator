package com.algoaccel.service;

import com.algoaccel.model.component.*;
import com.algoaccel.model.enums.ComplexityLevel;
import com.algoaccel.model.enums.LogicalOperator;
import com.algoaccel.model.measure.DataElement;
import com.algoaccel.model.measure.LogicalClause;
import com.algoaccel.model.measure.Population;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

/**
 * Complexity Calculator Service
 *
 * Calculates complexity scores for component library items based on:
 * - Atomic: base(1) + timing clauses + negation penalty
 * - Composite: sum of children + AND operator penalty + nesting depth penalty
 *
 * Thresholds: Low (1-3), Medium (4-7), High (8+)
 */
@Service
public class ComplexityCalculatorService {

    private final ObjectMapper objectMapper;

    public ComplexityCalculatorService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    /**
     * Determines complexity level from a numeric score.
     *   Low:    1-3
     *   Medium: 4-7
     *   High:   8+
     */
    public ComplexityLevel getComplexityLevel(int score) {
        if (score <= 3) return ComplexityLevel.LOW;
        if (score <= 7) return ComplexityLevel.MEDIUM;
        return ComplexityLevel.HIGH;
    }

    /**
     * Counts the number of timing clauses in a TimingExpression.
     *
     * - Simple operators ('during', 'before', 'after', 'overlaps'): 1 clause
     * - Operators with quantity ('within' + quantity): 2 clauses
     * - Operators with position ('starts before' + position): 2 clauses
     */
    public int countTimingClauses(TimingExpression timing) {
        if (timing == null) return 0;

        int count = 1; // Every timing expression has at least 1 clause

        boolean hasQuantity = timing.getQuantity() != null;
        boolean hasPosition = timing.getPosition() != null && !timing.getPosition().isEmpty();

        if (hasQuantity || hasPosition) {
            count = 2;
        }

        return count;
    }

    /**
     * Calculates complexity for an atomic component.
     *
     * Score = base(1) + timingClauses + negation(2 if true)
     */
    public ComponentComplexity calculateAtomicComplexity(AtomicComponent component) {
        int base = 1;
        int timingClauses = countTimingClauses(component.getTiming());
        int negations = component.isNegation() ? 1 : 0;
        int negationScore = component.isNegation() ? 2 : 0;

        // Components with zero codes require manual review — floor at medium
        int codeCount = getCodeCount(component.getValueSet());
        boolean zeroCodes = codeCount == 0;
        int zeroCodesPenalty = zeroCodes ? 4 : 0; // Pushes score to at least medium

        int score = Math.max(base + timingClauses + negationScore, zeroCodesPenalty);

        Map<String, Object> factors = new HashMap<>();
        factors.put("base", base);
        factors.put("timingClauses", timingClauses);
        factors.put("negations", negations);
        if (zeroCodes) {
            factors.put("zeroCodes", true);
        }

        return ComponentComplexity.builder()
            .level(getComplexityLevel(score))
            .score(score)
            .factors(serializeFactors(factors))
            .build();
    }

    /**
     * Calculates complexity for a composite component.
     *
     * Score = sum of children's scores
     *       + AND penalty (children.length - 1 for AND operator)
     *       + nesting depth penalty (+2 per level beyond 1)
     */
    public ComponentComplexity calculateCompositeComplexity(
            CompositeComponent composite,
            Function<String, LibraryComponent> resolveChild) {

        int childrenSum = 0;
        int maxChildNestingDepth = 0;
        int childCount = 0;

        // Parse children JSON
        List<Map<String, Object>> children = parseChildren(composite.getChildren());

        for (Map<String, Object> childRef : children) {
            String componentId = (String) childRef.get("componentId");
            if (componentId == null) continue;

            LibraryComponent child = resolveChild.apply(componentId);
            if (child != null && child.getComplexity() != null) {
                childrenSum += child.getComplexity().getScore();
                childCount++;

                // Track nesting depth: composites contribute depth
                if (child instanceof CompositeComponent) {
                    int childNesting = getNestingDepth(child.getComplexity());
                    maxChildNestingDepth = Math.max(maxChildNestingDepth, childNesting + 1);
                }
            }
        }

        // AND operator adds +1 per connection (children.length - 1)
        int andOperators = (composite.getOperator() == LogicalOperator.AND && childCount > 1)
            ? childCount - 1
            : 0;

        // Nesting depth beyond 1 adds +2 per additional level
        int nestingDepth = maxChildNestingDepth;
        int nestingPenalty = nestingDepth > 0 ? nestingDepth * 2 : 0;

        int score = childrenSum + andOperators + nestingPenalty;

        Map<String, Object> factors = new HashMap<>();
        factors.put("base", 0);
        factors.put("timingClauses", 0);
        factors.put("negations", 0);
        factors.put("childrenSum", childrenSum);
        factors.put("andOperators", andOperators);
        factors.put("nestingDepth", nestingDepth);

        return ComponentComplexity.builder()
            .level(getComplexityLevel(score))
            .score(score)
            .factors(serializeFactors(factors))
            .build();
    }

    /**
     * Calculates complexity for a UMS DataElement.
     */
    public ComplexityLevel calculateDataElementComplexity(DataElement element) {
        int score = 1; // base

        // Count timing requirements (from timing override or window)
        if (element.getTimingOverride() != null && !element.getTimingOverride().isEmpty()) {
            score += 1;
        }
        if (element.getTimingWindow() != null && !element.getTimingWindow().isEmpty()) {
            score += 1;
        }

        // Negation adds +2
        String desc = element.getDescription() != null ? element.getDescription().toLowerCase() : "";
        if (element.isNegation() || desc.contains("absence of") || desc.contains("without")) {
            score += 2;
        }

        // Elements with zero value sets require manual review — floor at medium
        if (element.getValueSets().isEmpty() &&
            element.getElementType() != com.algoaccel.model.enums.DataElementType.DEMOGRAPHIC) {
            score = Math.max(score, 4);
        }

        return getComplexityLevel(score);
    }

    /**
     * Calculates complexity for a population by summing all criteria scores.
     */
    public ComplexityLevel calculatePopulationComplexity(Population population) {
        if (population.getRootClause() == null) {
            return ComplexityLevel.LOW;
        }

        int score = sumCriteriaScore(population.getRootClause());
        return getComplexityLevel(score);
    }

    /**
     * Recursively sums complexity scores through a criteria tree.
     */
    private int sumCriteriaScore(LogicalClause clause) {
        if (clause == null) return 0;

        int childSum = 0;

        // Sum child clauses
        for (LogicalClause child : clause.getChildClauses()) {
            childSum += sumCriteriaScore(child);
        }

        // Sum data elements
        for (DataElement element : clause.getDataElements()) {
            childSum += calculateDataElementScore(element);
        }

        // AND operator adds +1 per connection
        int totalChildren = clause.getChildClauses().size() + clause.getDataElements().size();
        if (clause.getOperator() == LogicalOperator.AND && totalChildren > 1) {
            childSum += totalChildren - 1;
        }

        return childSum;
    }

    /**
     * Returns numeric score for a single data element.
     */
    private int calculateDataElementScore(DataElement element) {
        int score = 1; // base

        if (element.getTimingOverride() != null && !element.getTimingOverride().isEmpty()) {
            score += 1;
        }
        if (element.getTimingWindow() != null && !element.getTimingWindow().isEmpty()) {
            score += 1;
        }

        String desc = element.getDescription() != null ? element.getDescription().toLowerCase() : "";
        if (element.isNegation() || desc.contains("absence of") || desc.contains("without")) {
            score += 2;
        }

        return score;
    }

    // Helper methods

    private int getCodeCount(ComponentValueSet valueSet) {
        if (valueSet == null || valueSet.getCodes() == null) {
            return 0;
        }
        try {
            List<?> codes = objectMapper.readValue(valueSet.getCodes(), List.class);
            return codes.size();
        } catch (JsonProcessingException e) {
            return 0;
        }
    }

    private int getNestingDepth(ComponentComplexity complexity) {
        if (complexity == null || complexity.getFactors() == null) {
            return 0;
        }
        try {
            Map<?, ?> factors = objectMapper.readValue(complexity.getFactors(), Map.class);
            Object depth = factors.get("nestingDepth");
            if (depth instanceof Number) {
                return ((Number) depth).intValue();
            }
            return 0;
        } catch (JsonProcessingException e) {
            return 0;
        }
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> parseChildren(String childrenJson) {
        if (childrenJson == null || childrenJson.isEmpty()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(childrenJson, List.class);
        } catch (JsonProcessingException e) {
            return List.of();
        }
    }

    private String serializeFactors(Map<String, Object> factors) {
        try {
            return objectMapper.writeValueAsString(factors);
        } catch (JsonProcessingException e) {
            return "{}";
        }
    }
}
