# AlgoAccelerator Product Guide

## Introduction

AlgoAccelerator is a powerful platform for developing, validating, and deploying clinical quality measures (CQMs). It streamlines the traditionally complex and time-consuming process of measure development through AI-assisted workflows, reusable component libraries, and automated code generation.

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
| **Code Gen** | Generate CQL, SQL, and FHIR code |
| **Settings** | Configure application preferences |

## Core Workflows

### 1. Importing a Measure

#### From Document (PDF/Word)

1. Navigate to **Measures** tab
2. Click **Import Measure**
3. Upload your measure specification document (PDF or Word)
4. The AI will extract:
   - Measure title and description
   - Population definitions
   - Value set references
   - Timing requirements
5. Review the extracted data for accuracy
6. Click **Save** to add to your measure library

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

1. Click the value set link on a data element
2. The Value Set panel opens showing:
   - Value set name and OID
   - All codes with display names
   - Code system (ICD-10, SNOMED, CPT, etc.)
3. **Add codes**: Click "+" and enter code details
4. **Remove codes**: Click "×" on any code row
5. Changes are tracked for audit purposes

#### Adjusting Timing Requirements

1. Click the timing badge on a data element
2. The Timing Editor opens with:
   - Visual timeline showing the measurement period
   - Start/end date constraints
   - Relative timing options
3. Configure timing:
   - **During** - Must occur within measurement period
   - **Before** - Must occur before a reference point
   - **After** - Must occur after a reference point
   - **Within X days/months/years** - Time window constraints
4. Preview shows the actual date range based on your measurement period

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

### 4. Component Library

The Component Library stores reusable measure logic blocks.

#### Browsing Components

1. Navigate to **Components** tab
2. Use filters to narrow results:
   - **Category**: Demographics, Encounters, Conditions, etc.
   - **Status**: Draft, Pending Review, Approved, Archived
   - **Complexity**: Low, Medium, High
3. Search by name, description, tags, or OID

#### Component Types

**Atomic Components**
- Single value set + timing expression
- Example: "Office Visit during Measurement Period"

**Composite Components**
- Collection of components with AND/OR logic
- Example: "Qualifying Encounter" = Office Visit OR Home Visit OR Telehealth

#### Creating Components

1. Click **New Component**
2. Choose type: Atomic or Composite
3. For Atomic:
   - Enter name and description
   - Configure value set (OID, version, name)
   - Set timing expression
   - Toggle negation if needed
   - Select category and add tags
4. For Composite:
   - Enter name and description
   - Choose operator (AND/OR)
   - Select child components
   - Select category and add tags
5. Click **Save**

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

#### Generating Test Patients

1. Navigate to **Validation** tab
2. Click **Generate Test Patients**
3. Configure patient scenarios:
   - Numerator-positive (should qualify)
   - Denominator-only (should fail numerator)
   - Excluded (should be excluded)
   - Edge cases (boundary conditions)
4. Click **Generate**

#### Running Validation

1. Select a test patient
2. Click **Evaluate**
3. Review the trace output:
   - Step-by-step evaluation
   - Resource matching details
   - Population results (IPP, Denom, Numer)
   - Pass/Fail indicators

#### Interpreting Results

- **Green checkmarks** - Criteria satisfied
- **Red X marks** - Criteria not met
- **Yellow warnings** - Potential issues
- **Trace details** - Click to expand evaluation steps

### 7. Code Generation

#### Generating CQL

1. Navigate to **Code Gen** tab
2. Select **CQL** format
3. Configure options:
   - Library name and version
   - FHIR version (R4)
   - QI-Core version
4. Click **Generate**
5. Review generated CQL
6. Click **Copy** or **Download**

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

#### Generating HDI SQL

1. Select **HDI SQL** format
2. Configure:
   - Database dialect (BigQuery)
   - Table naming conventions
   - Date format
3. Click **Generate**
4. Review and download

#### Generating FHIR Measure

1. Select **FHIR** format
2. Configure FHIR resource properties
3. Click **Generate**
4. Download JSON resource

### 8. Settings & Configuration

#### Theme

- **Dark** - Dark background (default)
- **Light** - Light background
- **System** - Follow OS preference

#### AI Provider

Configure AI for document ingestion:
- **Anthropic (Claude)** - Recommended
- **OpenAI (GPT-4)**

Enter API key in the secure field.

#### Code Generation Target

Set default output format:
- CQL
- HDI SQL
- FHIR

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
