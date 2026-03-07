# Insight Forge Product Guide

## Introduction

Insight Forge is a powerful platform for developing, validating, and deploying clinical quality measures (CQMs). It streamlines the traditionally complex and time-consuming process of measure development through AI-assisted workflows, reusable component libraries, and automated code generation.

### Who is this for?

- **Quality Measure Developers** - Create and refine measure specifications
- **Clinical Informaticists** - Translate clinical requirements into computable logic
- **Health IT Teams** - Generate executable code for EHR and data warehouse systems
- **Quality Improvement Staff** - Review and approve measure components

## Getting Started

### Launching the Application

1. Open the application in your browser
2. The interface displays a sidebar navigation on the left and the main content area on the right
3. Select a tab to navigate between different functions

### Navigation Tabs

| Tab | Purpose |
|-----|---------|
| **Measures** | Browse and manage measure library |
| **Editor** | Edit measure logic and populations |
| **Components** | Manage reusable component library |
| **Value Sets** | Edit value sets and codes |
| **Validation** | Test measures with synthetic patients |
| **Code Gen** | Generate CQL and Synapse SQL code |
| **Settings** | Configure application preferences |

## Core Workflows

### 1. Importing a Measure

#### From Document (PDF/Word)

1. Navigate to **Measures** tab
2. Click **Import Measure**
3. Upload your measure specification document (PDF or Word)
4. **Catalogue Auto-Detection** analyzes the document:
   - Detects the catalogue type (eCQM, MIPS_CQM, HEDIS, QOF, Clinical_Standard)
   - For **high confidence** detections (≥3 strong signals with 2× the next best match), proceeds automatically
   - For **medium/low confidence** detections, displays a confirmation chip
5. If the confirmation chip appears:
   - Review the detected catalogue type and confidence level
   - **Confirm** to proceed with the detection, or
   - **Override** to select a different catalogue type from the dropdown
   - Your confirmation/override is recorded to improve future detection accuracy
6. The AI will extract:
   - Measure title and description
   - Population definitions
   - Value set references
   - Timing requirements
7. Review the extracted data for accuracy
8. Click **Save** to add to your measure library

#### Manual Creation

1. Navigate to **Measures** tab
2. Click **New Measure**
3. Fill in measure details:
   - Title, ID, version
   - Clinical focus and rationale
   - Scoring type (proportion, ratio, continuous variable)
   - Measurement period
4. Add populations manually in the Editor

### 2. Editing a Measure

#### Selecting a Measure

1. Click on a measure in the **Measures** tab
2. Navigate to the **Editor** tab
3. The measure's population hierarchy displays on the left
4. Click any element to view/edit details on the right

#### Understanding the Population Tree

The tree shows the logical structure of your measure:

```
Initial Population
├── AND
│   ├── Qualifying Encounters (Encounter)
│   └── Patient Age >= 18 (Demographics)

Denominator
├── AND
│   ├── Initial Population (Reference)
│   └── Diagnosis of Diabetes (Condition)

Numerator
├── AND
│   ├── Denominator (Reference)
│   └── HbA1c Test Performed (Observation)
```

- **AND/OR badges** - Click to toggle the logical operator
- **Drag handles** - Reorder elements within a clause
- **Complexity badges** - Show element complexity (low/medium/high)

#### Editing Data Elements

Click on any data element to view its details:

1. **Description** - Human-readable summary
2. **Type** - QI-Core resource type (Encounter, Condition, Procedure, etc.)
3. **Value Set** - Associated value set with codes
4. **Timing** - When the element must occur
5. **Library Link** - Connection to component library

#### Modifying Value Sets

Value sets can be edited directly inline in the Edit Component panel:

1. Click on any data element to open the Edit Component panel
2. The Value Set section shows:
   - Value set name and OID (both editable)
   - Codes table with code, display, and system columns
   - Code count and system summary
3. Click **Edit** to enter edit mode:
   - **Edit OID**: Enter or modify the value set OID
   - **Edit Name**: Update the value set name
   - **Fetch from VSAC**: If OID is valid, fetch codes from VSAC directly
   - **Add Code**: Click "+ Add Code" to add codes manually (code, display, system)
   - **Delete Code**: Click the × button on any code row to remove it
4. Click **Done** to exit edit mode
5. Changes automatically sync to the linked library component
6. For bulk editing, click **Open full editor** to access the Value Set modal

#### Adjusting Timing Requirements

The timing section uses smart presets with real-time date preview:

1. Click the timing section on any data element
2. Select from timing presets:
   - **During Measurement Period** - Must occur within MP dates
   - **Lookback from MP End** - X years/months/days before MP end (e.g., colonoscopy within 10 years)
   - **Lookback from MP Start** - X years/months/days before MP start
   - **Anytime (No Constraint)** - No timing restriction
   - **Advanced** - Custom operator, quantity, unit, and reference point
3. The resolved date range updates in real-time based on your measurement period
4. **Due Date (T-Days)** shows patient outreach timing:
   - Auto-calculated based on timing preset and component category
   - Shows days before MP end when care is "due"
   - Can be manually overridden for specific components
5. For demographic components (age criteria), configure **Age Evaluated At**:
   - Start of Measurement Period
   - End of Measurement Period
   - During Measurement Period (turns age during)

### 3. Deep Edit Mode

Deep Edit mode enables advanced editing capabilities.

#### Activating Deep Edit Mode

1. Click the **Deep Edit** toggle in the Editor toolbar
2. Additional controls appear on each element:
   - Checkboxes for selection
   - Move up/down buttons
   - Delete button

#### Merging Components

Combine multiple similar components into one with OR logic:

1. Enter **Deep Edit** mode
2. Check the boxes on 2+ components to merge
3. Click the floating **"Merge X Selected Components"** button
4. In the dialog:
   - Enter a name for the merged component
   - Review the components being merged
   - See the value sets that will be combined
5. Click **Merge Components**

**Result:**
- Components are combined with OR logic
- Each value set remains separate (not flattened)
- Duplicate codes across value sets are removed
- A new library component is created

#### Per-Sibling Operator Control

Fine-tune logic between specific elements:

1. Click the AND/OR badge between two sibling elements
2. Toggle between AND and OR for just that pair
3. Visual indentation shows grouped logic

#### Adding Components from Library

Add existing library components to your measure:

1. Click the **+** button on any population clause
2. The **Add Component** modal opens with two tabs:
   - **Library**: Browse and search existing components
   - **Create New**: Quick-create a new component
3. From the Library tab:
   - Filter by category using the dropdown
   - Search by name, description, or OID
   - Click a component to select it
   - Click **Add to Measure** to insert it
4. The component is added to the population and automatically linked to the library

### 4. Component Library

The Component Library stores reusable measure logic blocks.

#### Browsing Components

1. Navigate to **Components** tab via the sidebar
2. Category sub-navigation appears directly under Components:
   - Demographics, Encounters, Conditions, Procedures, Observations, Medications, Immunizations, Allergies
3. Use additional filters to narrow results:
   - **Status**: Draft, Pending Review, Approved, Archived
   - **Complexity**: Low, Medium, High
4. Search by name, description, tags, or OID

#### Component Types

**Atomic Components**
- Single value set + timing expression
- Example: "Office Visit during Measurement Period"

**Composite Components**
- Collection of components with AND/OR logic
- Example: "Qualifying Encounter" = Office Visit OR Home Visit OR Telehealth

#### Creating Components

Use the **Create Component Wizard** for guided component creation:

1. Click **New Component** to open the wizard
2. **Step 1 - Category**: Select the clinical category (Demographics, Encounters, Conditions, etc.) and subcategory
3. **Step 2 - Details**: Enter component information:
   - Name and description
   - Value set OID (for atomic components)
   - Timing configuration using smart presets
   - Patient sex restriction (if applicable)
4. **Step 3 - Codes**: Configure clinical codes:
   - Fetch codes from VSAC using the OID
   - Or manually add codes with code, display, and system
5. **Step 4 - Review**: Preview the component and generated code
6. Click **Create Component** to save

**Note**: Components are created as atomic by default. To create a composite (AND/OR collection), use the **Merge Components** feature in the UMS Editor.

#### Component Workflow

1. **Draft** - Initial creation, can be freely edited
2. **Pending Review** - Submitted for approval
3. **Approved** - Validated and ready for use
4. **Archived** - Superseded by newer version

#### Shared Component Editing

When editing a component used in multiple measures:

1. A warning displays showing affected measures
2. Choose action:
   - **Update All** - Apply changes to all uses
   - **Create Version** - Create new version, keep old for existing uses
   - **Cancel** - Abort changes

### 5. Value Set Management

#### Value Set Browser

1. Navigate to **Value Sets** tab
2. Browse all value sets in the current measure
3. Click any value set to view/edit codes

#### Editing Codes

**Adding Codes:**
1. Click **Add Code**
2. Enter:
   - Code value (e.g., "E11.9")
   - Display name (e.g., "Type 2 diabetes mellitus without complications")
   - Code system (ICD-10, SNOMED, etc.)
3. Click **Add**

**Removing Codes:**
1. Click the **×** button on the code row
2. Confirm removal
3. Removal is logged for audit

**Bulk Import:**
1. Click **Import Codes**
2. Upload CSV or Excel file with columns:
   - code, display, system
3. Review imported codes
4. Click **Confirm Import**

### 6. Validation & Testing

#### Test Patients

When you navigate to the **Validation** tab with a measure selected, test patients are automatically generated based on the measure's criteria. The system creates a diverse set of synthetic patients covering different population outcomes.

#### Reviewing Validation Results

1. Navigate to **Validation** tab with a measure selected
2. Test patients are displayed in a list showing their population results
3. Click on any patient to view the detailed evaluation trace:
   - Step-by-step criteria evaluation
   - Resource matching details
   - Population results (IPP, Denom, Numer, Exclusions)
   - Pass/Fail indicators for each criterion

#### Interpreting Results

- **Green checkmarks** - Criteria satisfied
- **Red X marks** - Criteria not met
- **Yellow warnings** - Potential issues
- **Trace details** - Click to expand evaluation steps

### 7. AND/OR.ai Co-Pilot

The AND/OR.ai Co-Pilot is an intelligent assistant that understands your measure context and can help answer questions and propose edits.

#### Opening the AND/OR.ai Co-Pilot

1. Click the floating **"AND/OR.ai Co-Pilot"** button in the bottom-right corner
2. The panel expands showing the chat interface
3. The active measure context is automatically loaded

#### What You Can Ask

- "What does the denominator exclusion logic mean?"
- "Why does this encounter component filter to 'finished' status?"
- "What value set should I use for colorectal cancer screening?"
- "Change the encounter status to finished"

#### Proposing Changes

When you ask the AND/OR.ai Co-Pilot to make a change:

1. It responds with an explanation and a **Proposed Change** card
2. The card shows a **visual diff** highlighting what will change
3. Click **Apply** to accept the change, or **Dismiss** to reject
4. Applied changes are logged to the Edit History with "AND/OR.ai Co-Pilot fix:" prefix

#### AND/OR.ai Co-Pilot Context

The AND/OR.ai Co-Pilot has access to:
- Current measure structure and populations
- All value sets and codes
- Generated CQL and SQL code
- Library component information

### 8. Code Generation

#### Generating CQL

1. Navigate to **Code Gen** tab
2. Select **CQL** format (default)
3. CQL is automatically generated from the measure structure
4. Review generated CQL in the code viewer
5. Click **Copy** or **Download**

**Example Output:**
```cql
library DiabetesHbA1c version '1.0.0'
using QICore version '4.1.1'

valueset "Diabetes": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840...'
valueset "HbA1c Tests": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840...'

define "Initial Population":
  AgeInYearsAt(start of "Measurement Period") >= 18
    and exists "Qualifying Encounters"

define "Denominator":
  "Initial Population"
    and exists "Diabetes Diagnosis"

define "Numerator":
  "Denominator"
    and exists "HbA1c Test Performed"
```

#### Generating Synapse SQL

1. Click the **Synapse SQL** toggle in the Code Gen tab
2. SQL is automatically generated from the measure structure
3. Review the generated SQL with CTEs and population logic
4. Click **Copy** or **Download**

#### Customizing Generated Code

Below the code preview, the **Code Editor** allows you to customize generated code:

1. **Customize Code** - Click to enter edit mode
2. **Make changes** - Edit the code directly in the text area
3. **Describe your changes** - Add a required note (minimum 10 characters)
4. **Save Changes** - Your edit is saved with timestamp

**Edit History Features:**
- View all past edits with timestamps
- Click any edit to see the **visual diff** of what changed
- **Revert to Original** - Discard all customizations

**Override Indicator:**
- When custom code is active, a "Custom Override" badge appears
- View **Changes** tab to see line-by-line diff from generated code

### 9. Extraction Feedback System

The Extraction Feedback system learns from your corrections to improve future AI extractions.

#### How It Works

When you edit, add, or delete components in the UMS Editor, the system automatically captures these corrections and uses them to improve subsequent measure extractions.

**Captured Actions:**
- Inline field edits (descriptions, value sets, timing)
- Component additions (records as "missing component" pattern)
- Component deletions (records as "hallucination" pattern)
- Logical operator changes (AND/OR toggles)
- Timing modifications
- Code additions/removals from value sets

#### Viewing Feedback Data

1. Navigate to **Settings** tab
2. Select the **Extraction Feedback** section
3. View the dashboard showing:
   - Total corrections captured
   - Measures reviewed count
   - Average corrections per measure
   - Top correction pattern
   - Pattern breakdown chart

#### Filtering Corrections

Use the filter controls to narrow the correction log:
- **Catalogue Type**: MIPS, HEDIS, eCQM, etc.
- **Pattern**: Hallucination, Missing Component, Value Set Error, etc.
- **Severity**: High, Medium, Low
- **Search**: Find specific corrections by text

#### Toggles

- **Feedback Capture**: Enable/disable correction tracking (default: enabled)
- **Prompt Injection**: Enable/disable injecting past corrections into extraction prompts (default: enabled)

When prompt injection is enabled, the system builds guidance from your correction history and includes it in the LLM prompt during measure extraction. This helps the AI avoid repeating past mistakes.

### 10. Settings & Configuration

#### LLM Provider

Configure the AI provider for document ingestion and AND/OR.ai Co-Pilot:
- **Anthropic (Claude)** - Recommended for best extraction quality
- **OpenAI (GPT-4)** - Alternative provider
- **Google (Gemini)** - Alternative provider
- **Custom LLM** - Self-hosted or custom endpoint (OpenAI-compatible API)

#### API Key Configuration

1. Navigate to **Settings** tab
2. Select your preferred LLM provider
3. Enter your API key in the secure field
4. Click **Save**

Your API key is stored locally in your browser and never sent to our servers. All AI calls are made directly from your browser to the LLM provider.

#### Custom LLM Configuration

For self-hosted models (Ollama, LM Studio, vLLM, etc.):
1. Select **Custom LLM** provider
2. Enter the API Base URL (e.g., `http://localhost:11434/v1`)
3. Enter the model name
4. Optionally enter an API key if required
5. Click **Save Custom Configuration**

## Best Practices

### Measure Development

1. **Start with clear requirements** - Have a well-defined measure specification
2. **Use the component library** - Leverage existing validated components
3. **Review AI extractions** - Always verify AI-generated content
4. **Test thoroughly** - Use validation with multiple patient scenarios
5. **Document changes** - Add notes when modifying components

### Component Library Management

1. **Consistent naming** - Use clear, descriptive names
2. **Appropriate granularity** - Components should be reusable but not too generic
3. **Version carefully** - Create new versions for significant changes
4. **Tag thoroughly** - Add relevant tags for discoverability
5. **Approve before widespread use** - Validate components before marking approved

### Value Set Management

1. **Verify OIDs** - Ensure OIDs match VSAC entries
2. **Review codes** - Check that included codes are appropriate
3. **Track changes** - Document why codes were added/removed
4. **Keep current** - Update value sets when new codes are added to standards

### Code Generation

1. **Review generated code** - Always inspect output before use
2. **Test in target environment** - Validate CQL/SQL executes correctly
3. **Version alignment** - Ensure FHIR/CQL versions match your environment
4. **Performance considerations** - HDI SQL may need optimization for large datasets

## Troubleshooting

### Common Issues

**Document import fails**
- Ensure document is PDF or Word format
- Check file isn't corrupted
- Try a cleaner copy without complex formatting

**Value set codes not showing**
- Verify the value set ID matches measure.valueSets
- Check that codes were properly imported
- Refresh the browser if changes don't appear

**Component merge loses codes**
- Delete the merged component and re-merge
- Ensure you're merging components with value sets that have codes

**Code generation errors**
- Check all value sets have valid OIDs
- Verify timing expressions are complete
- Ensure all required fields are populated

### Getting Help

- Check the TECH_SPECS.md for technical details
- Review error messages in browser console (F12)
- Report issues at the GitHub repository

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + S` | Save current measure |
| `Ctrl/Cmd + Z` | Undo last action |
| `Escape` | Close modal/cancel edit |
| `Delete` | Remove selected element (in Deep Edit) |

## Glossary

| Term | Definition |
|------|------------|
| **CQM** | Clinical Quality Measure - standardized metric for healthcare quality |
| **CQL** | Clinical Quality Language - HL7 standard for expressing measure logic |
| **FHIR** | Fast Healthcare Interoperability Resources - healthcare data standard |
| **QI-Core** | Quality Improvement Core - FHIR profiles for quality measures |
| **UMS** | Universal Measure Spec - internal canonical measure representation |
| **VSAC** | Value Set Authority Center - NLM repository of clinical value sets |
| **OID** | Object Identifier - unique identifier for value sets |
| **HDI** | Health Data Intelligence - data warehouse/analytics platform |
| **IPP** | Initial Patient Population |
| **Denom** | Denominator |
| **Numer** | Numerator |

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Feb 2026 | Initial release with core features |
| 1.1 | Feb 2026 | Added component merge functionality |
| 1.2 | Feb 2026 | Multiple value sets support, per-sibling operators |
| 1.3 | Feb 2026 | AND/OR.ai Co-Pilot with proposal system, intuitive code editor with visual diffs and edit history |
| 1.4 | Feb 2026 | Documentation accuracy review: removed unimplemented features (theme, FHIR export, patient config) |
| 1.5 | Feb 2026 | Timing redesign with smart presets, Due Date (T-Days), VSAC code cache for offline hydration |
| 1.6 | Feb 2026 | Create Component Wizard with 4-step guided flow, library-first Add Component modal |
| 1.7 | Feb 2026 | Component Library sidebar navigation, category submenu, removed legacy AI chat panel |
| 1.8 | Feb 2026 | UMS Editor parity: full value set editing (OID, name, add/delete codes, inline VSAC fetch) |
| 1.9 | Feb 2026 | Extraction Feedback System: correction capture, prompt injection, feedback dashboard |
| 1.10 | Mar 2026 | Catalogue Auto-Detection: automatic catalogue type classification during import with confirmation chip for medium/low confidence detections, user feedback recording for classifier improvement |
