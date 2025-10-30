---
title: MCP Docs Server | Getting Started | Mastra Docs
url: 
description: Learn how to use the Mastra MCP documentation server in your IDE to turn it into an agentic Mastra expert.
language: en
---
[Skip to Content](https://mastra.ai/en/docs/getting-started/mcp-docs-server#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") [Getting Started](https://mastra.ai/en/docs/getting-started/installation "Getting Started") MCP Docs Server

Copy page

# Mastra Docs Server

The `@mastra/mcp-docs-server` package provides direct access to Mastra’s full knowledge base, including documentation, code examples, blog posts, and changelogs, via the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/docs/getting-started/intro). It works with Cursor, Windsurf, Cline, Claude Code, or any tool that supports MCP.

These tools are designed to help agents retrieve precise, task-specific information — whether you’re adding a feature to an agent, scaffolding a new project, or exploring how something works.

In this guide you’ll learn how to add Mastra’s MCP server to your AI tooling.

Mastra MCP documentation server - YouTube

[Photo image of Mastra AI](https://www.youtube.com/channel/UCTYjNDUYsrt7DrwU11fdyhQ?embeds_referring_euri=https%3A%2F%2Fmastra.ai%2F)

Mastra AI

3.63K subscribers

[Mastra MCP documentation server](https://www.youtube.com/watch?v=vciV57lF0og)

Mastra AI

Search

Info

Shopping

Tap to unmute

If playback doesn't begin shortly, try restarting your device.

You're signed out

Videos you watch may be added to the TV's watch history and influence TV recommendations. To avoid this, cancel and sign in to YouTube on your computer.

CancelConfirm

Share

Include playlist

An error occurred while retrieving sharing information. Please try again later.

Watch later

Share

Copy link

Watch on

0:00

/
•Live

•

## Installation [Permalink for this section](https://mastra.ai/en/docs/getting-started/mcp-docs-server\#installation)

### create-mastra [Permalink for this section](https://mastra.ai/en/docs/getting-started/mcp-docs-server\#create-mastra)

During the interactive [create-mastra](https://mastra.ai/reference/cli/create-mastra) wizard, choose one of your tools in the MCP step.

### Manual setup [Permalink for this section](https://mastra.ai/en/docs/getting-started/mcp-docs-server\#manual-setup)

If there are no specific instructions for your tool below, you may be able to add the MCP server with this common JSON configuration anyways.

```nextra-code

{
  "mcpServers": {
    "mastra": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@mastra/mcp-docs-server"]
    }
  }
}
```

### Claude Code CLI [Permalink for this section](https://mastra.ai/en/docs/getting-started/mcp-docs-server\#claude-code-cli)

Install using the terminal command:

```nextra-code

claude mcp add mastra -- npx -y @mastra/mcp-docs-server
```

[More info on using MCP servers with Claude Code](https://docs.claude.com/en/docs/claude-code/mcp)

### Cursor [Permalink for this section](https://mastra.ai/en/docs/getting-started/mcp-docs-server\#cursor)

Install by clicking the button below:

[![Install MCP Server](https://cursor.com/deeplink/mcp-install-light.svg)](cursor://anysphere.cursor-deeplink/mcp/install?name=mastra&config=eyJjb21tYW5kIjoibnB4IC15IEBtYXN0cmEvbWNwLWRvY3Mtc2VydmVyIn0%3D)

If you followed the automatic installation, you’ll see a popup when you open cursor in the bottom left corner to prompt you to enable the Mastra Docs MCP Server.

![Diagram showing cursor prompt to enable Mastra docs MCP server](https://mastra.ai/image/enable-mastra-docs-cursor.png)

[More info on using MCP servers with Cursor](https://cursor.com/de/docs/context/mcp)

### Visual Studio Code [Permalink for this section](https://mastra.ai/en/docs/getting-started/mcp-docs-server\#visual-studio-code)

1. Create a `.vscode/mcp.json` file in your workspace

2. Insert the following configuration:



```nextra-code

{
     "servers": {
       "mastra": {
         "type": "stdio",
         "command": "npx",
         "args": [\
           "-y",\
           "@mastra/mcp-docs-server"\
         ]
       }
     }
}
```


Once you installed the MCP server, you can use it like so:

1. Open VSCode settings.

2. Navigate to MCP settings.

3. Click “enable” on the Chat > MCP option.
![Settings page of VSCode to enable MCP](https://mastra.ai/image/vscode-mcp-setting.png)

MCP only works in Agent mode in VSCode. Once you are in agent mode, open the `mcp.json` file and click the “start” button. Note that the “start” button will only appear if the `.vscode` folder containing `mcp.json` is in your workspace root, or the highest level of the in-editor file explorer.

![Settings page of VSCode to enable MCP](https://mastra.ai/image/vscode-start-mcp.png)

After starting the MCP server, click the tools button in the Copilot pane to see available tools.

![Tools page of VSCode to see available tools](https://mastra.ai/image/vscode-mcp-running.png)

[More info on using MCP servers with Visual Studio Code](https://code.visualstudio.com/docs/copilot/customization/mcp-servers)

### Windsurf [Permalink for this section](https://mastra.ai/en/docs/getting-started/mcp-docs-server\#windsurf)

1. Open `~/.codeium/windsurf/mcp_config.json` in your editor

2. Insert the following configuration:



```nextra-code

{
     "mcpServers": {
       "mastra": {
         "command": "npx",
         "args": ["-y", "@mastra/mcp-docs-server"]
       }
     }
}
```

3. Save the configuration and restart Windsurf


[More info on using MCP servers with Windsurf](https://docs.windsurf.com/windsurf/cascade/mcp#mcp-config-json)

## Usage [Permalink for this section](https://mastra.ai/en/docs/getting-started/mcp-docs-server\#usage)

Once configured, you can ask your AI tool questions about Mastra or instruct it to take actions. For these steps, it’ll take the up-to-date information from Mastra’s MCP server.

**Add features:**

- “Add evals to my agent and write tests”
- “Write me a workflow that does the following `[task]`”
- “Make a new tool that allows my agent to access `[3rd party API]`”

**Ask about integrations:**

- “Does Mastra work with the AI SDK?
How can I use it in my `[React/Svelte/etc]` project?”
- “What’s the latest Mastra news around MCP?”
- “Does Mastra support `[provider]` speech and voice APIs? Show me an example in my code of how I can use it.”

**Debug or update existing code:**

- “I’m running into a bug with agent memory, have there been any related changes or bug fixes recently?”
- “How does working memory behave in Mastra and how can I use it to do `[task]`? It doesn’t seem to work the way I expect.”
- “I saw there are new workflow features, explain them to me and then update `[workflow]` to use them.”

### Troubleshooting [Permalink for this section](https://mastra.ai/en/docs/getting-started/mcp-docs-server\#troubleshooting)

1. **Server Not Starting**
   - Ensure [npx](https://docs.npmjs.com/cli/v11/commands/npx) is installed and working.
   - Check for conflicting MCP servers.
   - Verify your configuration file syntax.
2. **Tool Calls Failing**
   - Restart the MCP server and/or your IDE.
   - Update to the latest version of your IDE.

[Project Structure](https://mastra.ai/en/docs/getting-started/project-structure "Project Structure") [Model Providers](https://mastra.ai/en/docs/getting-started/model-providers "Model Providers")