# Contributing Quick Start: Improving Ferrite Documentation

This guide walks through contributing documentation to Ferrite in 5 steps. For full contribution guidelines, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Prerequisites

```bash
cd website
npm install    # One-time dependency install
npm start      # Dev server at http://localhost:3000
```

## Step 1: Find or Create the Doc File

Documentation lives in `website/docs/` organized by category:

| Directory | Topics |
|-----------|--------|
| `getting-started/` | Installation, quickstart, first commands |
| `core-concepts/` | Data types, persistence, replication |
| `operations/` | Monitoring, backup, troubleshooting |
| `sdks/` | Language-specific SDK guides |
| `advanced/` | Tiered storage, security, clustering |
| `comparisons/` | Ferrite vs other databases |
| `use-cases/` | Real-world usage patterns |

Create a new `.md` file in the appropriate directory.

## Step 2: Add Frontmatter

Every doc page needs frontmatter at the top:

```markdown
---
sidebar_position: 5
title: Your Page Title
description: Brief description for search engines
---

# Your Page Title

Content goes here...
```

## Step 3: Write the Content

Follow these conventions:
- Use practical, runnable code examples
- Include both FerriteQL and SDK examples where relevant
- Link to related pages with relative paths: `[Replication](../advanced/replication.md)`
- Use admonitions for tips, warnings, and notes: `:::tip`, `:::warning`, `:::info`

## Step 4: Add to Sidebar (if needed)

If you created a new category, update `website/sidebars.ts` to include it. Pages within existing categories are auto-discovered.

## Step 5: Verify

```bash
npm start          # Preview at http://localhost:3000
npm run build      # Full production build (catches broken links)
npm run typecheck  # Type checking
```

## Tips

- Run `npm start` for live-reload while writing
- Use `npm run build` before submitting — it catches broken links and missing images
- Check the [Docusaurus docs](https://docusaurus.io/docs) for advanced features (tabs, code blocks, MDX)
- Reference documentation in `docs/` (outside `website/`) contains source material you can incorporate
