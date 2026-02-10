# AlgoAccelerator - Product Overview

## What is AlgoAccelerator?

AlgoAccelerator is a comprehensive platform for developing, validating, and deploying clinical quality measures (CQMs). It transforms the traditionally labor-intensive process of measure implementation by leveraging AI-assisted workflows, reusable component libraries, and multi-format code generation.

## The Problem

Healthcare quality measures (e.g., "% of diabetic patients with controlled blood sugar") are defined in dense PDF documents that require:
- Reading 50+ page specifications
- Manually extracting hundreds of medical codes
- Writing complex logic in specialized languages (CQL, SQL)
- Testing against patient scenarios
- Weeks to months of development time per measure

## The Solution

AlgoAccelerator automates this process:

1. **Upload** a measure specification (PDF, HTML, Excel)
2. **AI extracts** clinical logic, codes, and requirements
3. **Review & approve** extracted content with human oversight
4. **Test** against synthetic patients to validate correctness
5. **Export** production-ready code (CQL, SQL)

## Key Features

### Measure Library
- Browse and manage all quality measures
- Upload specifications via drag-and-drop
- Batch processing queue for multiple measures
- Status tracking (In Progress / Published)
- Lock/unlock for version control

### UMS Editor (Universal Measure Specification)
- Visual tree-based editor for measure logic
- AND/OR/NOT operators with clickable toggles
- Population-based structure (IPP, Denominator, Numerator, Exclusions)
- Inline value set and timing editing
- Deep Edit mode for advanced operations

### Component Library
- Reusable building blocks across measures
- Atomic components (single value set + timing)
- Composite components (collections with logic)
- Version management with approval workflow
- Automatic usage tracking across measures
- Shared edit warnings for multi-measure components

### Code Generation
- CQL (Clinical Quality Language) for FHIR-based systems
- Standard SQL for traditional databases
- Synapse SQL for Azure cloud analytics
- Per-component code with override support
- Syntax highlighting and validation

### Test Validation
- Pre-loaded synthetic test patients
- Step-by-step evaluation traces
- Pass/fail indicators per population
- "How close" analysis for near-misses

### Value Set Management
- Aggregated view across all measures
- Code search and bulk import
- Multiple code system support (ICD-10, CPT, SNOMED, LOINC, etc.)
- VSAC integration for standard value sets

## Target Users

| Role | Primary Use |
|------|-------------|
| Clinical Informaticist | Reviews AI extraction for clinical accuracy |
| Quality Analyst | Uploads specs, tracks review progress |
| eCQM Developer | Uses generated code, validates with test patients |
| Health IT Director | Customizes measures, validates against populations |

## Key Metrics Impact

| Metric | Before | After |
|--------|--------|-------|
| Time to implement one measure | 2-4 weeks | 2-4 hours |
| Manual code entry errors | Common | Near zero |
| Code review coverage | Variable | 100% required |

## Healthcare Standards Compliance

- **FHIR R4** - Data model and Measure resource alignment
- **QI-Core** - Profiles for quality improvement
- **CQL** - Clinical Quality Language standard
- **VSAC** - Value Set Authority Center integration

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript |
| Build | Vite 7 |
| Styling | Tailwind CSS 4 |
| State | Zustand 5 |
| PDF Parsing | PDF.js |
| Backend (optional) | Express.js |

## Data Storage

All data persists in browser localStorage:
- Measures and corrections
- Component library
- User settings and API keys

Data stays local except for:
- AI extraction requests (to configured LLM provider)
- VSAC lookups (if configured)

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

The application runs at `http://localhost:5173`
