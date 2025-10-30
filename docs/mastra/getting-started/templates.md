---
title: Templates | Getting Started | Mastra Docs
url: 
description: Pre-built project structures that demonstrate common Mastra use cases and patterns
language: en
---
[Skip to Content](https://mastra.ai/en/docs/getting-started/templates#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") [Getting Started](https://mastra.ai/en/docs/getting-started/installation "Getting Started") Templates

Copy page

# Templates

Templates are pre-built Mastra projects that demonstrate specific use cases and patterns. Browse available templates in the [templates directory](https://mastra.ai/templates).

## Using Templates [Permalink for this section](https://mastra.ai/en/docs/getting-started/templates\#using-templates)

Install a template using the `create-mastra` command:

npmyarnpnpmbun

```nextra-code

npx create-mastra@latest --template template-name
```

```nextra-code

yarn dlx create-mastra@latest --template template-name
```

```nextra-code

pnpm create mastra@latest --template template-name
```

```nextra-code

bun create mastra@latest --template template-name
```

For example, to create a text-to-SQL application:

```nextra-code

npx create-mastra@latest --template text-to-sql
```

## Setting Up a Template [Permalink for this section](https://mastra.ai/en/docs/getting-started/templates\#setting-up-a-template)

After installation:

1. **Navigate to your project**:



```nextra-code

cd your-project-name
```

2. **Configure environment variables**:



```nextra-code

cp .env.example .env
```



Edit `.env` with your API keys as specified in the template’s README.

3. **Start development**:



```nextra-code

npm run dev
```


Each template includes a comprehensive README with specific setup instructions and usage examples.

For detailed information on creating templates, see the [Templates Reference](https://mastra.ai/reference/templates).

[Model Providers](https://mastra.ai/en/docs/getting-started/model-providers "Model Providers") [Overview](https://mastra.ai/en/docs/agents/overview "Overview")