# granter Documentation

This directory contains the Fumadocs-based documentation site for granter.

## Development

```bash
# Install dependencies
cd docs
npm install

# Run development server
npm run dev
```

Visit `http://localhost:3000` to see the docs.

## Building

```bash
npm run build
```

## Deployment

The docs are automatically deployed to GitHub Pages when changes are pushed to the `main` branch.

## Structure

- `app/` - Next.js app router pages
- `content/docs/` - MDX documentation files
- `public/` - Static assets
- `source.config.ts` - Fumadocs configuration

