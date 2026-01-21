---
name: modern-web-guidance
description: Provides guidance on modern web development best practices. You MUST ALWAYS use this skill when working on web development tasks.
---

# Modern Web Guidance

This skill describes how to use the provided CLI scripts to access the Modern Web Practices knowledge base.

## Overview

You should use the pre-built CLI scripts located in the `build/cli/` directory. These scripts allow you to search for use cases and retrieve best practice guides using standard terminal commands without needing to compile TypeScript source files.

**Prerequisite**: Ensure the package is built by running `npm run build` (or `npm install` if consuming as a package).

## 1. Search for Use Cases

**Script:** `build/cli/search.js`

Use this script to find relevant Use Case IDs based on a natural language query.

**Usage:**
```bash
node build/cli/search.js "<your search query>"
```

**Example:**
```bash
node build/cli/search.js "how to lazy load images"
```

**Output:**
The script outputs a JSON array of matching use cases.
```json
[
  {
    "id": "lazy-load-images",
    "description": "Defer loading of off-screen images...",
    "category": "webperf",
    "distance": 0.45
  },
  ...
]
```

### Best Practices for Search Queries
To get the best results from the vector search:

- **DO** use action-oriented phrases.
  - *Good*: "lazy load images", "animate view transitions", "create a tooltip"
- **DO** include specific technical terms if known.
  - *Good*: "popover api", "dialog element", "intersection observer"
- **DON'T** use "how to" prefixes or questions.
  - *Bad*: "how do i create a tooltip?", "how to make images load faster?"
- **DON'T** search for single general keywords.
  - *Bad*: "images", "performance", "ui"

## 2. Retrieve a Guide

**Script:** `build/cli/retrieve.js`

Use this script to get the full markdown content for a specific Use Case ID found in the search step.

**Usage:**
```bash
node build/cli/retrieve.js <use_case_id>
```

**Example:**
```bash
node build/cli/retrieve.js lazy-load-images
```

**Output:**
The script outputs the raw Markdown content of the guide to standard output (stdout).

## Recommended Workflow

1.  **Identify User Intent**: Determine what the user is trying to build (e.g., "show a carousel of images").
2.  **Search**: Run `node build/cli/search.js "show a carousel of images"`.
3.  **Parse**: Read the JSON output and pick `id` that most closely matches the user intent and has the lowest `distance`.
4.  **Retrieve**: Run `node build/cli/retrieve.js <id>`.
5.  **Implement**: Use the retrieved Markdown output as the ground truth for your code generation.
