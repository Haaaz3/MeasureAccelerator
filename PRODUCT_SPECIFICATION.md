# MeasureAccelerator Product Specification

## Executive Summary

**MeasureAccelerator** transforms how healthcare organizations build clinical quality measures. Instead of spending weeks manually translating PDF specifications into code, teams can upload a document and get a working measure in minutes.

### The Problem We Solve

Healthcare quality measures (like "% of diabetic patients with controlled blood sugar") are defined in dense PDF documents. Today, implementing these measures requires:
- Reading 50+ page specifications
- Manually extracting hundreds of medical codes
- Writing complex logic in specialized languages (CQL, SQL)
- Testing against patient scenarios
- Months of development time per measure

### Our Solution

MeasureAccelerator uses AI to automate this process:
1. **Upload** a measure specification (PDF, HTML, Excel)
2. **AI extracts** all the clinical logic, codes, and requirements
3. **Review & approve** the extracted content with human oversight
4. **Test** against synthetic patients to validate correctness
5. **Export** production-ready code (CQL, SQL)

### Key Metrics

| Metric | Before | After |
|--------|--------|-------|
| Time to implement one measure | 2-4 weeks | 2-4 hours |
| Manual code entry errors | Common | Near zero |
| Code review coverage | Variable | 100% required |

---

## Target Users

### Primary Users

| Role | What They Do | How They Use MeasureAccelerator |
|------|--------------|--------------------------------|
| **Internal Clinical Informaticist** | Translates clinical requirements into technical specs | Reviews AI extraction for clinical accuracy, validates patient logic |
| **Quality Analyst** | Ensures measures meet reporting requirements | Uploads measure specs, tracks review progress, exports for reporting |
| **eCQM Developer** | Writes CQL/SQL code for measure calculation | Uses generated code as starting point, validates with test patients |

### Secondary Users

| Role | How They Use It |
|------|-----------------|
| **Health IT Director** | Customizes measures, algorythms to suite the needs of the practice. Validate the onboarding of a new measure to confirm the measure is calculating against their population as expected |
| **Clinical Leadership** | Reviews measure definitions for clinical appropriateness |

---

## Product Capabilities

### 1. Measure Library (Home Screen)

The central hub where users manage all their quality measures.

**What Users Can Do:**

| Action | Description | Business Value |
|--------|-------------|----------------|
| **Upload Documents** | Drag-and-drop PDF, HTML, Excel, or ZIP files | Start measure creation in seconds |
| **AI Extraction** | Automatically parse uploaded documents | Eliminates manual data entry |
| **Filter & Search** | Find measures by status, program, or text | Manage large measure libraries |
| **Duplicate** | Copy existing measure as template | Faster creation of similar measures |
| **Batch Upload** | Queue multiple measures for sequential processing | Process entire measure portfolios efficiently |
| **Lock & Publish** | Prevent edits and mark as production-ready | Version control and governance |

**Measure Card Information:**
- Title and measure ID (e.g., "CMS130v12 - Colorectal Cancer Screening")
- Program type (MIPS, eCQM, HEDIS, etc.)
- Status badge (In Progress / Published)
- Review progress (0-100% complete)
- Complexity indicator (Low/Medium/High) based on structural scoring

**Batch Upload Queue:**

When processing a measure upload, users can continue adding more files to a queue:
- While a measure is being processed, a queue panel appears below the progress indicator
- Users can drag-and-drop or browse for additional file groups
- Each queued item shows its files and a remove button
- Measures process sequentially with progress displayed as "[2/3] Processing..."
- Queue automatically advances to the next measure when one completes

**Supported File Types:**
- PDF (measure specification documents)
- HTML (web-based specifications)
- Excel/XLSX (code lists, value sets)
- XML (FHIR measure bundles)
- JSON (structured measure data)
- CQL (existing measure logic)
- ZIP (bundled documents)

---

### 2. Measure Creation Wizard

A guided 8-step process for creating new measures.

**Three Ways to Start:**

| Mode | Best For | How It Works |
|------|----------|--------------|
| **AI-Guided** | New measures from documents | Upload specs, AI extracts everything |
| **Copy Existing** | Similar measures | Clone and modify an existing measure |
| **Blank** | Custom measures | Start from scratch with guided forms |

**Wizard Steps:**

1. **Choose Method** - Select AI-guided, copy, or blank
2. **Upload Documents** - Add specification files (AI mode)
3. **Metadata** - Enter measure ID, title, program, steward
4. **Denominator** - Define who's eligible for the measure (age, diagnoses, encounters)
5. **Numerator** - Define what qualifies as "success"
6. **Exclusions** - Define who should be excluded
7. **Review & Create** - Preview CQL, confirm, and create

**Smart Features:**
- Unsaved changes warning before closing
- Real-time CQL preview during editing
- Auto-detection of measure type from content

---

### 3. UMS Editor (Measure Detail View)

The main workspace for viewing and editing measure logic.

**What is UMS?**
Universal Measure Specification (UMS) is our internal format that represents any quality measure in a consistent, structured way. Think of it as the "canonical" version of a measure that can be translated to any output format.

**Editor Sections:**

| Section | Purpose | What You See |
|---------|---------|--------------|
| **Metadata** | Basic measure info | ID, title, version, steward, rationale |
| **Initial Population** | Who's eligible | Age requirements, enrollment criteria |
| **Denominator** | Target group | Usually equals Initial Population |
| **Denominator Exclusions** | Who to exclude | Hospice, terminal illness, etc. |
| **Numerator** | Success criteria | The action that counts as "meeting" the measure |
| **Value Sets** | Medical code lists | All codes referenced by the measure |

**Criteria Tree View:**

Each population section displays logic as a collapsible tree with visible AND/OR operators between every sibling element:

```
Initial Population (AND)
├── Women aged 51-74 years at end of measurement period
│       AND
├── Qualifying Encounters (OR)
│   ├── Office Visit
│   │       OR
│   ├── Annual Wellness Visit
│   │       OR
│   ├── Preventive Care Established Visit
│   │       OR
│   └── Home Healthcare Services
```

**Operator badges** appear between every pair of sibling elements, making the logical relationships explicit and always visible. All operator badges (both clause headers and inter-sibling separators) are clickable to toggle between AND, OR, and NOT.

**Description Cleaning:**

Descriptions are automatically cleaned to remove embedded AND/OR/NOT text that may appear from source document parsing. Logical operators are only shown as dedicated operator badges, never as inline text.

**Editing Capabilities:**

| Feature | Description |
|---------|-------------|
| **Add Component** | Insert new criteria with AND/OR logic selector |
| **Edit Component** | Modify descriptions, codes, timing |
| **Change Logic** | Click any AND/OR/NOT badge to toggle operators |
| **Reorder** | Move components up/down |
| **Delete** | Remove components |
| **View Value Set** | See all codes in a referenced code set |
| **Add/Remove Codes** | Modify value set contents |

**Adding Components:**

When adding a new component, users must specify:
- **Component type** (diagnosis, encounter, procedure, etc.)
- **Logic connection** (AND or OR) — determines how the new component relates to existing criteria
  - **AND**: Must also meet this criterion (appends to top-level AND clause)
  - **OR**: Alternative to existing criteria (creates or appends to an OR subclause)
- Description, value set, timing, and additional requirements

---

### 4. Review & Approval Workflow

Human oversight system to ensure AI extraction accuracy.

**Why Review Matters:**
AI extraction is powerful but not perfect. The review workflow ensures every component is verified by a human before the measure goes to production.

**Review States:**

| Status | Icon | Meaning |
|--------|------|---------|
| **Pending** | ⏳ | Not yet reviewed |
| **Approved** | ✓ | Verified as correct |
| **Needs Revision** | ⚠️ | Requires changes |
| **Flagged** | 🚩 | Needs discussion/escalation |

**Complexity Levels:**
Each component receives an objective complexity score based on its structure:
- **Low** (1-3 score) - Simple component (e.g., single value set during measurement period, has codes)
- **Medium** (4-7 score) - Moderate complexity (e.g., multiple timing clauses, negation, or zero codes)
- **High** (8+ score) - Complex component (e.g., composite with many children and nesting)

Complexity is calculated from structural factors: base score (1) + timing clauses (+1 each) + negation (+2). Composites sum children's scores plus operator and nesting depth bonuses. **Components with zero codes are automatically floored at medium complexity** to prevent auto-approval of incomplete components.

**Zero-Code Protection:**
- Components with no codes are never created in the library — instead, a red ingestion warning is shown on the data element
- If codes cannot be found during extraction, the element displays: "No codes found for this logic block. Add codes in the component library or re-upload with terminology."
- Zero-code elements are flagged at medium complexity minimum, preventing auto-approval

**Batch Operations:**
- **Approve All Low Complexity** - Auto-approve only verified, complete components (low complexity with codes)

**Progress Tracking:**
- Circular progress indicator (0-100%)
- Count of pending/approved/flagged items
- Must reach 100% approved before publishing

**Correction Tracking:**
Every change made during review is logged for AI training:
- What was changed
- Original vs corrected value
- Timestamp and context

This feedback loop helps improve future AI extractions.

---

### 5. Test Validation

Evaluate measures against synthetic patient data to verify logic correctness.

**Why Test Validation?**
Before deploying a measure to production, you need to know it works correctly. Test validation runs the measure logic against sample patients and shows exactly what happened.

**Pre-loaded Test Patients:**

| Patient | Age | Gender | Clinical Profile | Tests |
|---------|-----|--------|------------------|-------|
| Paul Atreides | 42 | Male | Hypertension, high cholesterol | Adult male screening |
| Lady Jessica | 47 | Female | Diabetes, hypertension | Diabetes measures |
| Ender Wiggin | 77 | Male | Multiple conditions, kidney disease | Elderly complex care |
| Chani Kynes | 27 | Female | Healthy | Young adult preventive |
| Stilgar Tabr | 55 | Male | Uncontrolled hypertension, obesity | Care gaps |
| Duncan Idaho | 68 | Male | Hospice, lung cancer | Exclusion testing |
| Gurney Halleck | 61 | Male | End-stage kidney disease on dialysis | Exclusion testing |
| Valentine Wiggin | 85 | Male | Dementia, frailty | Elderly exclusions |
| Petra Arkanian | 1.5 | Female | All vaccines complete | Childhood immunizations (pass) |
| Bean Delphiki | 1.8 | Female | Missing some vaccines | Childhood immunizations (gaps) |
| Bonzo Madrid | 30 | Male | Poorly controlled diabetes | Non-compliance |
| Colonel Graff | 75 | Male | No recent visits | Care gap detection |

**Validation Flow:**

The validation harness evaluates patients through three population sections:

1. **Initial Population** - All eligibility criteria (age, gender, diagnoses, encounters)
2. **Denominator Exclusions** - Conditions that exclude patients (hospice, terminal illness)
3. **Numerator** - Success criteria (screenings, test results, procedures)

**Nested Criteria Tree:**

The validation view mirrors the UMS editor's tree structure, including nested logical groups with operator badges between every sibling element:

```
┌──────────────────────────────────────────────────────────────────┐
│ ✓ INITIAL POPULATION                           [IN POPULATION]   │
│   Patient must meet ALL criteria                                  │
├──────────────────────────────────────────────────────────────────┤
│  ✓ Women aged 51-74 years at end of measurement period           │
│         AND                                                       │
│  ┌─ OR ─ Qualifying Encounters (5 of 9 met) ─────────────────┐  │
│  │  ✓ Office Visit                                              │  │
│  │         OR                                                    │  │
│  │  ✓ Annual Wellness Visit                                     │  │
│  │         OR                                                    │  │
│  │  ✗ Preventive Care Established Visit                         │  │
│  │         OR                                                    │  │
│  │  ...                                                          │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

**Group nodes** display the operator (AND/OR), title, match count (e.g., "5 of 9 met"), and contain nested children with operator separators. This matches the UMS editor structure exactly, providing a consistent experience across editing and validation.

**Visual Status Indicators:**

Each population section has clear visual feedback:

| Status | Visual Indicator |
|--------|-----------------|
| **All Criteria Met** | Green background, ✓ checkmark icon, green title, solid green chip |
| **Criteria Not Met** | Neutral background, ✗ icon, muted title, red outlined chip |
| **Partial (Group)** | Warning icon, indicates some but not all criteria met within a group |

**Evidence Facts:**
Each criterion card shows:
- Pass/fail status with checkmark or X
- "Met" or "Not Met" badge
- Description of the requirement
- Associated medical codes (ICD-10, CPT, LOINC, etc.)
- Date when the code was recorded
- Source system

**CQL Logic Display:**
Click any criterion card to see:
- The generated CQL logic with correct lookback periods
- All EMR data records used for evaluation
- Code system and OID references

Example CQL for colonoscopy:
```
["Procedure": "Colonoscopy"] P where P.performed 10 years or less before end of "Measurement Period"
```

**Screening Measure Logic:**

For screening measures (colorectal, cervical, breast cancer), the Numerator section shows:
- **OR logic** - "ANY ONE screening test qualifies"
- Each screening option with its valid lookback period:
  - Colonoscopy: 10 years
  - Flexible Sigmoidoscopy: 5 years
  - CT Colonography: 5 years
  - FIT-DNA: 3 years
  - FOBT/FIT: 1 year

**"How Close" Analysis:**
When a patient doesn't meet criteria, the system explains what's missing:
- "Missing: Colonoscopy within 10 years OR FIT test within 1 year"
- "Patient is too young (age 40). Adults 45-75 years of age required"

**Automatic Measure Detection:**

The system recognizes specific measure types and applies appropriate rules:

| Measure Type | Auto-Applied Rules |
|--------------|-------------------|
| Cervical Cancer Screening | Female patients only, age 21-64, Pap test (3yr) or HPV (5yr) |
| Childhood Immunizations | Children turning 2 during measurement period |
| Colorectal Cancer Screening | Age 45-75, multiple screening options with different lookbacks |
| Breast Cancer Screening | Female patients, mammography within 2 years |

---

### 6. Code Generation

Export measure logic to executable code formats.

**Available Formats:**

| Format | Use Case | Who Uses It |
|--------|----------|-------------|
| **CQL** | eCQM submission, FHIR-based systems | eCQM developers, EHR vendors |
| **Standard SQL** | Traditional databases | Data analysts, warehouse teams |
| **Azure Synapse SQL** | Microsoft cloud analytics | Azure-based organizations |

**How It Works:**
1. Complete 100% of reviews (required)
2. Navigate to Code Generation tab
3. Select output format
4. View generated code
5. Copy to clipboard or download

**Code Quality:**
- Properly structured with comments
- Includes all value set references
- Follows format-specific best practices
- Ready for production use

---

### 7. Value Set Management

Central library of all medical code sets used across measures.

**What Are Value Sets?**
A value set is a collection of medical codes that represent a clinical concept. For example:
- "Diabetes" value set: 50+ ICD-10 diagnosis codes for various diabetes types
- "Colonoscopy" value set: CPT and HCPCS procedure codes for colonoscopy

**Value Set Library Features:**

| Feature | Description |
|---------|-------------|
| **Aggregated View** | All value sets from all measures in one place |
| **Usage Tracking** | See which measures use each value set |
| **Search** | Find by name, OID, or code content |
| **Filter by Code System** | Show only ICD-10, CPT, SNOMED, etc. |
| **Sort Options** | By name, code count, usage count |
| **Grid/List View** | Toggle display format |
| **Standard Browser** | Import from national terminology service (VSAC) |

**Supported Code Systems:**

| System | Full Name | Used For |
|--------|-----------|----------|
| **ICD-10-CM** | International Classification of Diseases | Diagnoses |
| **CPT** | Current Procedural Terminology | Procedures |
| **HCPCS** | Healthcare Common Procedure Coding System | Services, equipment |
| **SNOMED CT** | Systematized Nomenclature of Medicine | Clinical terms |
| **LOINC** | Logical Observation Identifiers | Lab tests |
| **RxNorm** | Normalized drug names | Medications |
| **CVX** | Vaccine codes | Immunizations |
| **NDC** | National Drug Codes | Pharmacy |

---

### 8. Settings & Configuration

Customize AI providers, API keys, and system behavior.

**LLM Provider Settings:**

| Provider | Models Available | Notes |
|----------|-----------------|-------|
| **Anthropic** | Claude 3.5 Sonnet, Claude 3 Opus | Recommended for best extraction quality |
| **OpenAI** | GPT-4, GPT-4 Turbo | Good alternative |
| **Google** | Gemini Pro, Gemini Ultra | Google Cloud integration |
| **Custom** | Any OpenAI-compatible endpoint | Self-hosted or enterprise LLMs |

**Other Settings:**

| Setting | Purpose |
|---------|---------|
| **VSAC API Key** | Connect to national terminology service |
| **Backend API Toggle** | Enable server-side processing |

---

### 9. Component Library

A reusable component library system for sharing, versioning, and validating measure logic blocks across measures.

**Core Concepts:**

| Concept | Description |
|---------|-------------|
| **Atomic Component** | Smallest reusable unit: Value Set OID + Version + Timing Expression + Codes |
| **Composite Component** | Collection of atomic components combined with AND/OR logic |
| **Exact Matching** | Components reuse requires identity hash match (OID + timing + negation) |
| **Name-Based Fallback** | When OID matching fails, normalized value set names are compared with timing + negation |
| **Versioning** | Same OID with different timing = new version; different OID = new component |
| **Auto-Archive** | Components not used in any measure are automatically archived |
| **Zero-Code Guard** | Components with no codes are never created — a warning is shown instead |

**Library Browser:**

| Feature | Description |
|---------|-------------|
| **Category Navigation** | Browse by: Demographics, Encounters, Conditions, Procedures, Medications, Observations, Exclusions |
| **Filters** | Filter by status (Draft/Pending/Approved/Archived), complexity level, search text |
| **Component Cards** | Display name, complexity dots (○ Low, ●● Medium, ●●● High), status badge, usage count |
| **Archived Display** | Archived components appear greyed out but remain visible for reference |
| **Show Archived Toggle** | On by default; toggle to hide archived components |

**Component Detail Panel:**

For each component, view:
- Full definition (value set, timing, negation for atomics; children and operator for composites)
- **Codes table** showing all codes (code, display, system) with expandable list for large code sets
- Zero-code warning if no codes are defined
- Complexity score with factor breakdown
- Version history with status of each version
- List of measures using this component
- Actions: Edit, Archive, Approve

**Component Editor — Codes Management:**

When editing a component in the library:
- View all codes in a table (code, display, system)
- Delete individual codes
- Add new codes with code value, display text, and system dropdown (CPT, ICD10, SNOMED, HCPCS, LOINC, RxNorm, CVX)
- When saving, codes are synced to ALL linked measures via `syncComponentToMeasures`

**Bidirectional Code Sync:**
- Codes are stored on both the library component (`AtomicComponent.valueSet.codes`) and the measure data element (`DataElement.valueSet.codes`)
- When codes are edited in the library, all linked measures are updated
- When a new measure is imported and matches an existing component with no codes, the incoming codes are synced to the library component

**Shared Edit Warning:**

When editing a component used in multiple measures, a modal appears with two options:

| Option | Behavior |
|--------|----------|
| **Update All Measures** | All measures using this component get the new version. Old version is archived. Changes propagate to all linked measure DataElements. |
| **Create New Version** | Only the current measure gets the new version. Other measures keep the original. Both versions coexist. |

Composites do NOT auto-update when their children are versioned — changes require explicit user action.

**Import Matching:**

When a measure is imported, the system automatically:
1. Parses the measure to atomic components (value set + timing)
2. Searches the entire library (including archived components) for exact matches by identity hash
3. Falls back to **name-based matching** — normalizes value set names and compares with timing + negation
4. When matching an existing component that has no codes but the incoming element does, **codes are synced** to the existing component
5. Elements with zero codes are NOT created as components — they receive an ingestion warning instead
6. Usage counts update automatically

**Auto-Archive Behavior:**
- Components with zero usage across all measures are automatically archived
- When a measure is imported or linked, archived components that gain usage are automatically restored to their previous status
- Import matching searches all components regardless of archive status

**Complexity Scoring:**

| Component Type | Scoring Formula |
|---------------|-----------------|
| **Atomic** | Base (1) + timing clauses (+1 each) + negation (+2) + zero-codes floor (4 minimum if no codes) |
| **Composite** | Sum of children scores + AND operators (+1 each) + nesting depth (+2 per level) |

| Level | Score Range | Indicator |
|-------|------------|-----------|
| Low | 1-3 | ○ |
| Medium | 4-7 | ●● |
| High | 8+ | ●●● |

**Zero-codes penalty:** Atomic components and data elements with no codes are automatically floored at a score of 4 (medium complexity). This prevents auto-approval of incomplete components. Demographic elements (age, gender) are exempt since they don't use codes.

---

## Data Architecture

### How Data Flows

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Upload         │     │  AI          │     │  Universal      │
│  Documents      │ ──▶ │  Extraction  │ ──▶ │  Measure Spec   │
│  (PDF, HTML)    │     │  (Claude)    │     │  (UMS)          │
└─────────────────┘     └──────────────┘     └─────────────────┘
                                                      │
                                              ┌───────┴───────┐
                                              ▼               ▼
                                    ┌─────────────┐  ┌──────────────┐
                                    │  Component  │  │  Human       │
                                    │  Library    │  │  Review      │
                                    │  (Matching) │  │              │
                                    └─────────────┘  └──────┬───────┘
                                                            │
                                                            ▼
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Executable     │     │  Code        │     │  Test           │
│  Code           │ ◀── │  Generation  │ ◀── │  Validation     │
│  (CQL, SQL)     │     │              │     │                 │
└─────────────────┘     └──────────────┘     └─────────────────┘
```

### Universal Measure Specification (UMS)

The UMS is our canonical data format. Here's what it contains:

**Metadata (Basic Information):**

| Field | Example | Purpose |
|-------|---------|---------|
| Measure ID | CMS130v12 | Official identifier |
| Title | Colorectal Cancer Screening | Display name |
| Version | 12.0.0 | Semantic version |
| Program | eCQM | Regulatory program |
| Steward | NCQA | Publishing organization |
| Description | Percentage of adults... | Clinical summary |
| Rationale | Colorectal cancer is the... | Why this matters |
| Measurement Period | Jan 1 - Dec 31, 2024 | Time window |

**Population Definitions:**

Each measure has population groups that define the calculation logic:

| Population | Purpose | Example |
|------------|---------|---------|
| **Initial Population** | Everyone potentially eligible | Adults 45-75 with an encounter |
| **Denominator** | The target group | Usually equals Initial Population |
| **Denominator Exclusions** | Who to exclude | Hospice patients, colorectal cancer history |
| **Numerator** | Who met the goal | Had colonoscopy in past 10 years |

**Criteria Structure:**

Each population contains criteria organized in a logic tree:

| Component | Description |
|-----------|-------------|
| **Logical Operators** | AND, OR, NOT - combine criteria, displayed as clickable badges between siblings |
| **Data Elements** | Specific clinical data (diagnosis, procedure, etc.) with codes |
| **Value Sets** | Collections of medical codes with code references |
| **Timing** | When the data must occur (during measurement period, within 10 years, etc.) |
| **Thresholds** | Numeric requirements (age 45-75, HbA1c < 8%, etc.) |
| **Ingestion Warning** | Red banner shown when codes couldn't be found during extraction |

**Review Metadata:**

Each component tracks:
- Review status (pending, approved, needs revision, flagged)
- Complexity level (low, medium, high) — zero-code elements are floored at medium
- Library link status (linked to shared component or local)
- Review notes
- Correction history

### Data Storage

| Aspect | Implementation |
|--------|----------------|
| **Where** | Browser localStorage |
| **Capacity** | ~5-10 MB (dozens of measures) |
| **Persistence** | Survives browser refresh, clears on cache clear |
| **Migration** | Automatic schema updates on app load |

**Note:** Data stays in the browser. Nothing is sent to external servers except:
- AI extraction requests (to your configured LLM provider)
- VSAC lookups (if configured)

---

## Healthcare Standards Compliance

### FHIR R4 Alignment

MeasureAccelerator follows the HL7 FHIR (Fast Healthcare Interoperability Resources) standard:

| FHIR Concept | How We Use It |
|--------------|---------------|
| Measure Resource | UMS structure mirrors FHIR Measure |
| Canonical URLs | Proper FHIR-style identifiers |
| Library References | CQL library linking |
| Value Set References | OID and URL references |

### QI-Core Profiles

Data elements map to QI-Core (Quality Improvement Core) resource types:

| Our Type | QI-Core Resource |
|----------|-----------------|
| Diagnosis | QICore Condition |
| Encounter | QICore Encounter |
| Procedure | QICore Procedure |
| Observation | QICore Observation |
| Medication | QICore MedicationRequest |
| Immunization | QICore Immunization |

### CQL (Clinical Quality Language)

Generated CQL follows eCQM standards:
- Proper library headers
- Value set declarations
- Population definitions
- Date/time handling

---

## Technical Overview

### Technology Stack

| Layer | Technology | Why We Chose It |
|-------|------------|-----------------|
| **Frontend** | React 19 + TypeScript | Modern, type-safe UI development |
| **Build** | Vite 7 | Fast development and builds |
| **Styling** | Tailwind CSS 4 | Rapid UI development |
| **State** | Zustand 5 | Simple, performant state management |
| **PDF Parsing** | PDF.js | Browser-based PDF reading |
| **Excel** | XLSX | Spreadsheet parsing |
| **Backend** | Express.js | Lightweight API server |
| **Hosting** | Vercel | Easy deployment, auto-scaling |

### Performance

| Operation | Typical Time |
|-----------|--------------|
| App load | ~2 seconds |
| AI extraction | 5-30 seconds (depends on document size) |
| Patient evaluation | 10-50 milliseconds |
| Code generation | ~500 milliseconds |

### Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| **CQL** | Clinical Quality Language - standard language for expressing measure logic |
| **eCQM** | Electronic Clinical Quality Measure - measures that can be calculated from EHR data |
| **FHIR** | Fast Healthcare Interoperability Resources - healthcare data exchange standard |
| **HEDIS** | Healthcare Effectiveness Data and Information Set - NCQA measure program |
| **Initial Population** | The broadest group of patients the measure applies to |
| **MIPS** | Merit-based Incentive Payment System - CMS quality reporting program |
| **Numerator** | Patients who achieved the measure goal |
| **OID** | Object Identifier - unique ID for value sets |
| **QI-Core** | Quality Improvement Core - FHIR profiles for quality measurement |
| **UMS** | Universal Measure Specification - our internal canonical format |
| **Value Set** | A collection of medical codes representing a clinical concept |
| **VSAC** | Value Set Authority Center - national terminology service |

---

## Appendix B: Measure Types Explained

### By Program

| Program | Description | Reporting Entity |
|---------|-------------|------------------|
| **MIPS CQM** | Merit-based Incentive Payment System | Individual clinicians, groups |
| **eCQM** | Electronic Clinical Quality Measures | Hospitals |
| **HEDIS** | Health plan quality measures | Health insurers |
| **QOF** | Quality and Outcomes Framework (UK) | GP practices |
| **Registry** | Specialty registry measures | Medical specialty groups |

### By Type

| Type | What It Measures | Example |
|------|------------------|---------|
| **Process** | Was an action taken? | Was a screening performed? |
| **Outcome** | What was the result? | Is blood pressure controlled? |
| **Structure** | Is capability in place? | Does clinic have certified EHR? |

---

## Appendix C: Correction Types

When reviewers make changes, we track the type of correction:

| Correction Type | Description |
|----------------|-------------|
| **Code Added** | Added a missing medical code to a value set |
| **Code Removed** | Removed an incorrect code |
| **Code System Changed** | Changed from ICD-10 to SNOMED, etc. |
| **Timing Changed** | Modified lookback period or date requirements |
| **Logic Changed** | Changed AND/OR/NOT structure |
| **Description Changed** | Updated text description |
| **Threshold Changed** | Modified age range, value limits |
| **Element Added** | Added new criteria component |
| **Element Removed** | Deleted criteria component |
| **Population Reassigned** | Moved element to different population |

This data feeds back to improve AI extraction accuracy over time.

---

## Version History

| Version | Changes |
|---------|---------|
| 1.0 | Initial release - core measure management, AI extraction, code generation |
| 1.1 | Added gender/age pre-checks for cervical cancer and childhood immunization measures |
| 1.2 | Validation harness overhaul - detailed Initial Population breakdown, visual status indicators |
| 1.3 | Streamlined measure creation wizard - consolidated Denominator step, removed Quick Parse |
| 1.4 | Component Library - reusable atomic/composite components, complexity scoring, versioning, shared edit workflow, import matching |
| 1.5 | Batch measure upload queue - sequential processing with drag-and-drop queuing |
| 1.6 | Component library linking fixes - accurate usage counts from actual measures, edit propagation to linked measures |
| 1.7 | Auto-archive unused components, greyed-out archived display, full-library import matching |
| 1.8 | Removed hardcoded fallback logic from evaluator to align validation with UMS spec |
| 1.9 | Name-based component matching fallback, zero-code validation guard, codes editing in component library with bidirectional sync |
| 2.0 | AND vs OR logic fix for qualifying encounters, nested criteria tree in validation view, always-clickable operators, logic selector in component builder, description cleaning |

---

*Last Updated: January 2026*
*MeasureAccelerator Product Specification v2.0*
