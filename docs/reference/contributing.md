# Building from Source

## Prerequisites

- [Rust](https://rustup.rs/) (2024 edition)
- [Node.js](https://nodejs.org/) (v18+)

## Development

```bash
# Install root and frontend dependencies
npm install
cd frontend && npm install && cd ..

# Run in development mode (hot-reload frontend + Rust backend + Electron)
npm run dev
```

## Build

```bash
npm run build
```

## Docs site

```bash
cd docs
npm install
npm run dev
```
