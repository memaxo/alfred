---
title: Adding Laminar cursor rules to Cursor - Laminar documentation
url: 
language: en
---
[Skip to main content](https://docs.lmnr.ai/cursor#content-area)

[Laminar documentation home page![logo](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/logo/logo.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=568416e0ece6e167d975769bcccddac6)](https://docs.lmnr.ai/)

Search...

Ctrl K

Search...

Navigation

Overview

Adding Laminar cursor rules to Cursor

[Documentation](https://docs.lmnr.ai/overview) [Guides](https://docs.lmnr.ai/guides/fastapi) [API Reference](https://docs.lmnr.ai/api-reference/introduction)

On this page

- [What are Cursor Rules?](https://docs.lmnr.ai/cursor#what-are-cursor-rules%3F)
- [Why Use Laminar Cursor Rules?](https://docs.lmnr.ai/cursor#why-use-laminar-cursor-rules%3F)
- [Method 1: Using the CLI Command (Recommended)](https://docs.lmnr.ai/cursor#method-1%3A-using-the-cli-command-recommended)
- [Prerequisites](https://docs.lmnr.ai/cursor#prerequisites)
- [Add Cursor Rules](https://docs.lmnr.ai/cursor#add-cursor-rules)
- [Verify Installation](https://docs.lmnr.ai/cursor#verify-installation)
- [Method 2: Manual Download](https://docs.lmnr.ai/cursor#method-2%3A-manual-download)
- [Step 1: Download the Rules File](https://docs.lmnr.ai/cursor#step-1%3A-download-the-rules-file)
- [Step 2: Create Rules Directory](https://docs.lmnr.ai/cursor#step-2%3A-create-rules-directory)
- [Step 3: Add the Rules File](https://docs.lmnr.ai/cursor#step-3%3A-add-the-rules-file)
- [Step 4: Verify in Cursor](https://docs.lmnr.ai/cursor#step-4%3A-verify-in-cursor)
- [Using the Laminar Rules](https://docs.lmnr.ai/cursor#using-the-laminar-rules)
- [Example Prompts](https://docs.lmnr.ai/cursor#example-prompts)

This guide explains how to set up Cursor rules to enhance your development experience when working with [Laminar](https://www.lmnr.ai/), the open-source platform for tracing and evaluating AI applications.

## [​](https://docs.lmnr.ai/cursor\#what-are-cursor-rules%3F)  What are Cursor Rules?

Cursor rules are persistent instructions that provide context and guidance to the Cursor AI editor. They help maintain consistent coding patterns, enforce best practices, and automate common workflows specific to your project or technology stack.

## [​](https://docs.lmnr.ai/cursor\#why-use-laminar-cursor-rules%3F)  Why Use Laminar Cursor Rules?

Laminar cursor rules help you:

- Maintain consistent Laminar implementation patterns
- Automatically apply observability best practices
- Reduce setup time for new AI features
- Ensure proper instrumentation and tracing
- Follow Laminar’s recommended coding conventions

## [​](https://docs.lmnr.ai/cursor\#method-1%3A-using-the-cli-command-recommended)  Method 1: Using the CLI Command (Recommended)

The easiest way to add Laminar cursor rules is using the official CLI command.

### [​](https://docs.lmnr.ai/cursor\#prerequisites)  Prerequisites

Make sure you have the Laminar Python SDK of at least version `0.6.6` installed:

Copy

```
pip install 'lmnr[all]'

```

### [​](https://docs.lmnr.ai/cursor\#add-cursor-rules)  Add Cursor Rules

Run the following command in the folder where you want to add the rules:

Copy

```
lmnr add-cursor-rules

```

This command will:

1. Create the `.cursor/rules` directory if it doesn’t exist
2. Download the latest official Laminar cursor rules
3. Save them as `laminar.mdc` in your `.cursor/rules` folder
4. Automatically configure the rules for your project

### [​](https://docs.lmnr.ai/cursor\#verify-installation)  Verify Installation

After running the command, you should see:

- A new `.cursor/rules/laminar.mdc` file in your project
- The rules appearing in your Cursor editor (go to `Cursor Settings > Rules`)

After adding the rules, you must reload your Cursor editor window for the rules to take effect. Use `Cmd+Shift+P` (macOS) or `Ctrl+Shift+P` (Windows/Linux) to open the command palette, type `Reload Window`, and press Enter.

## [​](https://docs.lmnr.ai/cursor\#method-2%3A-manual-download)  Method 2: Manual Download

If you prefer to manually add the rules or the CLI command isn’t available, you can download the official rules file directly.

### [​](https://docs.lmnr.ai/cursor\#step-1%3A-download-the-rules-file)  Step 1: Download the Rules File

Click this link to download the official Laminar cursor rules:
**[Download laminar.mdc](https://raw.githubusercontent.com/lmnr-ai/lmnr/dev/rules/laminar.mdc)**Right-click the link and select “Save As” to download the file.

### [​](https://docs.lmnr.ai/cursor\#step-2%3A-create-rules-directory)  Step 2: Create Rules Directory

In your project root, create the cursor rules directory structure:

Copy

```
mkdir -p .cursor/rules

```

### [​](https://docs.lmnr.ai/cursor\#step-3%3A-add-the-rules-file)  Step 3: Add the Rules File

Place the downloaded `laminar.mdc` file in the `.cursor/rules` directory:

Copy

```
your-project/
├── .cursor/
│   └── rules/
│       └── laminar.mdc
├── src/
└── package.json

```

After adding the rules file, you must reload your Cursor editor window for the rules to take effect. Use `Cmd+Shift+P` (macOS) or `Ctrl+Shift+P` (Windows/Linux) to open the command palette, type `Reload Window`, and press Enter.

### [​](https://docs.lmnr.ai/cursor\#step-4%3A-verify-in-cursor)  Step 4: Verify in Cursor

1. After reloading, go to `Cursor Settings > Rules`
2. You should see the Laminar rule listed and active

## [​](https://docs.lmnr.ai/cursor\#using-the-laminar-rules)  Using the Laminar Rules

Now that you have the Laminar cursor rules installed, you can leverage them by prompting the Cursor agent. The rules will automatically guide the AI to follow Laminar best practices and patterns.

### [​](https://docs.lmnr.ai/cursor\#example-prompts)  Example Prompts

Try these prompts in Cursor chat to see the rules in action:

- **“Instrument this code with Laminar”** \- Add observability to existing functions
- **“Set up Laminar in this project”** \- Initialize Laminar with proper configuration
- **“Add Laminar tracing to my OpenAI calls”** \- Instrument LLM interactions
- **“Create a Laminar evaluation for this function”** \- Set up evaluation workflows
- **“Add session management with Laminar”** \- Implement user session tracking
- **“Help me debug this Laminar trace”** \- Troubleshoot observability issues

The Cursor agent will now automatically apply Laminar patterns, use correct import statements, follow naming conventions, and suggest appropriate instrumentation based on your code context.

[Access Control Setup](https://docs.lmnr.ai/self-hosting/access-control-setup) [Introduction](https://docs.lmnr.ai/tracing/introduction)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.