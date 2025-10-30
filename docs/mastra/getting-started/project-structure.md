---
title: Local Project Structure | Getting Started | Mastra Docs
url: 
description: Guide on organizing folders and files in Mastra, including best practices and recommended structures.
language: en
---
[Skip to Content](https://mastra.ai/en/docs/getting-started/project-structure#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") [Getting Started](https://mastra.ai/en/docs/getting-started/installation "Getting Started") Project Structure

Copy page

# Project Structure

This page provides a guide for organizing folders and files in Mastra. Mastra is a modular framework, and you can use any of the modules separately or together.

You could write everything in a single file, or separate each agent, tool, and workflow into their own files.

We don’t enforce a specific folder structure, but we do recommend some best practices, and the CLI will scaffold a project with a sensible structure.

## Example Project Structure [Permalink for this section](https://mastra.ai/en/docs/getting-started/project-structure\#example-project-structure)

A default project created with the CLI looks like this:

- src
  - mastra
    - agents
      - agent-name.ts
    - tools
      - tool-name.ts
    - workflows
      - workflow-name.ts
    - index.ts
- .env
- package.json
- tsconfig.json

### Top-level Folders [Permalink for this section](https://mastra.ai/en/docs/getting-started/project-structure\#top-level-folders)

| Folder | Description |
| --- | --- |
| `src/mastra` | Core application folder |
| `src/mastra/agents` | Agent configurations and definitions |
| `src/mastra/tools` | Custom tool definitions |
| `src/mastra/workflows` | Workflow definitions |

### Top-level Files [Permalink for this section](https://mastra.ai/en/docs/getting-started/project-structure\#top-level-files)

| File | Description |
| --- | --- |
| `src/mastra/index.ts` | Main configuration file for Mastra |
| `.env` | Environment variables |
| `package.json` | Node.js project metadata, scripts, and dependencies |
| `tsconfig.json` | TypeScript compiler configuration |

[Installation](https://mastra.ai/en/docs/getting-started/installation "Installation") [MCP Docs Server](https://mastra.ai/en/docs/getting-started/mcp-docs-server "MCP Docs Server")