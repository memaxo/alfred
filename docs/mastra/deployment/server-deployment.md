---
title: Deploy a Mastra Server
url: 
description: Learn how to deploy a Mastra server with build settings and deployment options.
language: en
---
[Skip to Content](https://mastra.ai/en/docs/deployment/server-deployment#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") [Deployment](https://mastra.ai/en/docs/deployment/overview "Deployment") Server deployment

Copy page

# Deploy a Mastra Server

Mastra runs as a standard Node.js server and can be deployed across a wide range of environments.

## Default project structure [Permalink for this section](https://mastra.ai/en/docs/deployment/server-deployment\#default-project-structure)

The [getting started guide](https://mastra.ai/docs/getting-started/installation) scaffolds a project with sensible defaults to help you begin quickly. By default, the CLI organizes application files under the `src/mastra/` directory, resulting in a structure similar to the following:

- src
  - mastra
    - agents
    - tools
    - workflows
    - index.ts
- package.json
- tsconfig.json

## Building [Permalink for this section](https://mastra.ai/en/docs/deployment/server-deployment\#building)

The `mastra build` command starts the build process:

```nextra-code

mastra build
```

### Customizing the input directory [Permalink for this section](https://mastra.ai/en/docs/deployment/server-deployment\#customizing-the-input-directory)

If your Mastra files are located elsewhere, use the `--dir` flag to specify the custom location. The `--dir` flag tells Mastra where to find your entry point file ( `index.ts` or `index.js`) and related directories.

```nextra-code

mastra build --dir ./my-project/mastra
```

## Build process [Permalink for this section](https://mastra.ai/en/docs/deployment/server-deployment\#build-process)

The build process follows these steps:

1. **Locates entry file**: Finds `index.ts` or `index.js` in your specified directory (default: `src/mastra/`).
2. **Creates build directory**: Generates a `.mastra/` directory containing:
   - **`.build`**: Contains dependency analysis, bundled dependencies, and build configuration files.
   - **`output`**: Contains the production-ready application bundle with `index.mjs`, `instrumentation.mjs`, and project-specific files.
3. **Copies static assets**: Copies the `public/` folder contents to the `output` directory for serving static files.
4. **Bundles code**: Uses Rollup with tree shaking and source maps for optimization.
5. **Generates server**: Creates a [Hono](https://hono.dev/) HTTP server ready for deployment.

### Build output structure [Permalink for this section](https://mastra.ai/en/docs/deployment/server-deployment\#build-output-structure)

After building, Mastra creates a `.mastra/` directory with the following structure:

- .mastra
  - .build
  - output

### `public` folder [Permalink for this section](https://mastra.ai/en/docs/deployment/server-deployment\#public-folder)

If a `public` folder exists in `src/mastra`, its contents are copied into the `.build/output` directory during the build process.

## Running the Server [Permalink for this section](https://mastra.ai/en/docs/deployment/server-deployment\#running-the-server)

Start the HTTP server:

```nextra-code

node .mastra/output/index.mjs
```

## Enable Telemetry [Permalink for this section](https://mastra.ai/en/docs/deployment/server-deployment\#enable-telemetry)

To enable telemetry and observability, load the instrumentation file:

```nextra-code

node --import=./.mastra/output/instrumentation.mjs .mastra/output/index.mjs
```

[Overview](https://mastra.ai/en/docs/deployment/overview "Overview") [With a Monorepo](https://mastra.ai/en/docs/deployment/monorepo "With a Monorepo")