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
| **Quick Parse** | Offline mode without AI (basic extraction) | Works without API keys |
| **Filter & Search** | Find measures by status, program, or text | Manage large measure libraries |
| **Duplicate** | Copy existing measure as template | Faster creation of similar measures |
| **Lock & Publish** | Prevent edits and mark as production-ready | Version control and governance |

**Measure Card Information:**
- Title and measure ID (e.g., "CMS130v12 - Colorectal Cancer Screening")
- Program type (MIPS, eCQM, HEDIS, etc.)
- Status badge (In Progress / Published)
- Review progress (0-100% complete)
- Confidence indicator (High/Medium/Low)

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
4. **Initial Population** - Define who's eligible for the measure
5. **Denominator** - Define the target group (often same as initial pop)
6. **Exclusions** - Define who should be excluded
7. **Numerator** - Define what qualifies as "success"
8. **Review & Create** - Preview CQL, confirm, and create

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

Each population section displays logic as a collapsible tree:

```
Denominator (AND)
├── Age 50-75 years
├── Has qualifying encounter (OR)
│   ├── Office Visit
│   ├── Preventive Care Visit
│   └── Annual Wellness Visit
└── No exclusions apply
```

**Editing Capabilities:**

| Feature | Description |
|---------|-------------|
| **Add Component** | Insert new criteria (diagnosis, procedure, etc.) |
| **Edit Component** | Modify descriptions, codes, timing |
| **Change Logic** | Switch between AND/OR/NOT operators |
| **Reorder** | Move components up/down |
| **Delete** | Remove components |
| **View Value Set** | See all codes in a referenced code set |
| **Add/Remove Codes** | Modify value set contents |

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

**Confidence Levels:**
AI assigns confidence to each extracted component:
- **High** (green) - AI is confident this is correct
- **Medium** (yellow) - Likely correct but should verify
- **Low** (red) - Uncertain, needs careful review

**Batch Operations:**
- **Approve High-Confidence** - One-click approval for all high-confidence items
- **Approve All** - Approve everything remaining (use carefully)

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

**Validation Trace:**

For each patient, the system shows step-by-step evaluation:

```
Patient: Lady Jessica (47F)

✓ Initial Population: PASSED
  → Age 47 is within 18-75 range
  → Has qualifying encounter on 2024-03-15

✓ Denominator: PASSED
  → Equals Initial Population

✗ Denominator Exclusions: NOT MET (good)
  → No hospice care found
  → No terminal illness diagnosis

✓ Numerator: PASSED
  → HbA1c test on 2024-03-15
  → Result: 6.8% (controlled)

FINAL OUTCOME: IN NUMERATOR ✓
```

**Evidence Facts:**
Each step shows the specific patient data that matched:
- Diagnosis codes found
- Procedure dates
- Lab values
- Medication records

**"How Close" Analysis:**
When a patient doesn't meet the numerator, the system explains what's missing:
- "Missing: Colonoscopy within 10 years OR FIT test within 1 year"
- "Missing: HbA1c test during measurement period"

**Automatic Measure Detection:**

The system recognizes specific measure types and applies appropriate rules:

| Measure Type | Auto-Applied Rules |
|--------------|-------------------|
| Cervical Cancer Screening | Female patients only, age 21-64 |
| Childhood Immunizations | Children turning 2 during measurement period |
| Colorectal Cancer Screening | Age 45-75, specific screening tests |

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
| **AI Extraction Toggle** | Enable/disable AI mode |
| **VSAC API Key** | Connect to national terminology service |
| **Backend API Toggle** | Enable server-side processing |

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
                                                      ▼
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Executable     │     │  Code        │     │  Human          │
│  Code           │ ◀── │  Generation  │ ◀── │  Review         │
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
| **Logical Operators** | AND, OR, NOT - combine criteria |
| **Data Elements** | Specific clinical data (diagnosis, procedure, etc.) |
| **Value Sets** | Collections of medical codes |
| **Timing** | When the data must occur (during measurement period, within 10 years, etc.) |
| **Thresholds** | Numeric requirements (age 45-75, HbA1c < 8%, etc.) |

**Review Metadata:**

Each component tracks:
- Review status (pending, approved, needs revision, flagged)
- Confidence level (high, medium, low)
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

---

*Last Updated: January 2026*
*MeasureAccelerator Product Specification v1.1*
