# MeasureAccelerator

A comprehensive platform for developing, validating, and deploying clinical quality measures (CQMs). MeasureAccelerator accelerates measure development through AI-assisted workflows, reusable component libraries, and multi-format code generation.

## Features

### Measure Development
- **AI-Powered Ingestion** - Import measure specifications from PDF/Word documents with automatic extraction of populations, value sets, and timing requirements
- **Visual Logic Editor** - Intuitive tree-based editor for measure population criteria with drag-and-drop reordering
- **Deep Edit Mode** - Advanced editing with component merging, per-sibling operator control, and bulk operations

### Component Library
- **Reusable Components** - Build a library of validated, reusable measure logic blocks
- **Atomic & Composite Types** - Single value set components or complex combinations with AND/OR logic
- **Version Management** - Track changes with full version history and approval workflows
- **Usage Analytics** - See which measures use each component

### Value Set Management
- **Code Editing** - Add, remove, and modify codes within value sets
- **Multiple Value Sets** - Support for components with multiple combined value sets
- **Bulk Import** - Import codes from CSV or Excel files
- **VSAC Integration** - Reference value sets by OID

### Validation & Testing
- **Test Patient Generation** - Create synthetic patients for various scenarios
- **Evaluation Traces** - Step-by-step execution traces showing how patients are evaluated
- **Population Results** - Clear pass/fail indicators for each population

### Code Generation
- **CQL** - Generate Clinical Quality Language for FHIR-based systems
- **HDI SQL** - Generate BigQuery SQL for Health Data Intelligence platforms
- **FHIR Measure** - Export as FHIR R4 Measure resources

## Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/Haaaz3/MeasureAccelerator.git
cd MeasureAccelerator

# Install dependencies
npm install

# Start development server
npm run dev
```

The application will be available at `http://localhost:5173`

### Build for Production

```bash
npm run build
```

Output will be in the `dist` directory.

## Documentation

- **[Product Guide](PRODUCT_GUIDE.md)** - User documentation with workflows and best practices
- **[Technical Specifications](TECH_SPECS.md)** - Architecture, data models, and API documentation

## Technology Stack

- **React 18** - UI framework
- **TypeScript** - Type-safe development
- **Vite** - Build tool and dev server
- **Zustand** - State management with persistence
- **Tailwind CSS** - Styling
- **PDF.js** - Document parsing

## Project Structure

```
src/
├── components/           # React UI components
│   ├── layout/          # App shell
│   ├── library/         # Component library UI
│   ├── measure/         # Measure editing
│   ├── validation/      # Testing UI
│   ├── valueset/        # Value set management
│   └── settings/        # Configuration
├── services/            # Business logic
│   ├── aiExtractor.ts   # AI-powered extraction
│   ├── cqlGenerator.ts  # CQL generation
│   ├── hdiSqlGenerator.ts # SQL generation
│   └── ...
├── stores/              # Zustand state stores
├── types/               # TypeScript definitions
└── constants/           # Static data
```

## Key Concepts

### Universal Measure Spec (UMS)
The internal canonical representation of a clinical quality measure, aligned with FHIR R4 and CQL standards. Contains:
- Measure metadata (title, ID, version, steward)
- Population definitions (IPP, denominator, numerator, exclusions)
- Value set references with codes
- Timing requirements

### Component Library
Reusable building blocks for measure logic:
- **Atomic Components** - Single value set + timing (e.g., "Office Visit during Measurement Period")
- **Composite Components** - Combinations with AND/OR logic (e.g., "Qualifying Encounter" = Office OR Home OR Telehealth)

### Population Types (FHIR-aligned)
- `initial-population` - Starting population for the measure
- `denominator` - Subset meeting denominator criteria
- `denominator-exclusion` - Excluded from denominator
- `denominator-exception` - Exception to denominator
- `numerator` - Meets numerator criteria
- `numerator-exclusion` - Excluded from numerator

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is proprietary software. All rights reserved.

## Support

For issues and feature requests, please use the [GitHub Issues](https://github.com/Haaaz3/MeasureAccelerator/issues) page.
