# qa-use

A TypeScript CLI tool for QA automation and testing.

## Installation

```bash
npm install -g qa-use
```

## Usage

### With npx (recommended)

```bash
npx qa-use
```

### Global installation

```bash
npm install -g qa-use
qa-use
```

## Development

### Prerequisites

- Node.js 18+
- pnpm

### Setup

```bash
# Install dependencies
pnpm install

# Run in development mode
pnpm run dev

# Build the project
pnpm run build
```

### Local Development Usage

```bash
# Run directly with ts-node
pnpm run dev

# Or build and test the CLI locally
pnpm run build
node dist/index.js

# Test with npx locally (after building)
npx .
```

## License

ISC
