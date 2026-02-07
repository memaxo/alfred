---
title: Contributing to BetterAuth | Better Auth
url:
description: A concise guide to contributing to BetterAuth
language: en
---

[\_helo](https://www.better-auth.com/) [docs](https://www.better-auth.com/docs) [examples](https://www.better-auth.com/docs/examples/next-js) [changelogs](https://www.better-auth.com/changelogs) [blogs](https://www.better-auth.com/blog) [community](https://www.better-auth.com/community)

### Get Started

### Concepts

### Authentication

### Databases

### Integrations

### Plugins

### Guides

### Reference

# Contributing to BetterAuth

Copy MarkdownOpen in

Thank you for your interest in contributing to Better Auth! This guide is a concise guide to contributing to Better Auth.

## [Getting Started](https://www.better-auth.com/docs/reference/contributing#getting-started)

Before diving in, here are a few important resources:

- Take a look at our existing [issues](https://github.com/better-auth/better-auth/issues) and [pull requests](https://github.com/better-auth/better-auth/pulls)
- Join our community discussions in [Discord](https://discord.gg/better-auth)

## [Development Setup](https://www.better-auth.com/docs/reference/contributing#development-setup)

To get started with development:

Make sure you have [Node.JS](https://nodejs.org/en/download)
installed, preferably on LTS.

### [1\. Fork the repository](https://www.better-auth.com/docs/reference/contributing#1-fork-the-repository)

Visit [https://github.com/better-auth/better-auth](https://github.com/better-auth/better-auth)

Click the "Fork" button in the top right.

### [2\. Clone your fork](https://www.better-auth.com/docs/reference/contributing#2-clone-your-fork)

```
# Replace YOUR-USERNAME with your GitHub username
git clone https://github.com/YOUR-USERNAME/better-auth.git
cd better-auth
```

### [3\. Install dependencies](https://www.better-auth.com/docs/reference/contributing#3-install-dependencies)

Make sure you have [bun](https://bun.io/installation) installed!

```
bun install
```

### [4\. Prepare ENV files](https://www.better-auth.com/docs/reference/contributing#4-prepare-env-files)

Copy the example env file to create your new `.env` file.

```
cp -n ./docs/.env.example ./docs/.env
```

## [Making changes](https://www.better-auth.com/docs/reference/contributing#making-changes)

Once you have an idea of what you want to contribute, you can start making changes. Here are some steps to get started:

### [1\. Create a new branch](https://www.better-auth.com/docs/reference/contributing#1-create-a-new-branch)

```
# Make sure you're on main
git checkout main

# Pull latest changes
git pull upstream main

# Create and switch to a new branch
git checkout -b feature/your-feature-name
```

### [2\. Start development server](https://www.better-auth.com/docs/reference/contributing#2-start-development-server)

Start the development server:

```
bun dev
```

To start the docs server:

```
bun -F docs dev
```

### [3\. Make Your Changes](https://www.better-auth.com/docs/reference/contributing#3-make-your-changes)

- Make your changes to the codebase.

- Write tests if needed. (Read more about testing [here](https://www.better-auth.com/docs/reference/contributing#testing))

- Update documentation. (Read more about documenting [here](https://www.better-auth.com/docs/reference/contributing#documentation))

### [Issues and Bug Fixes](https://www.better-auth.com/docs/reference/contributing#issues-and-bug-fixes)

- Check our [GitHub issues](https://github.com/better-auth/better-auth/issues) for tasks labeled `good first issue`
- When reporting bugs, include steps to reproduce and expected behavior
- Comment on issues you'd like to work on to avoid duplicate efforts

### [Framework Integrations](https://www.better-auth.com/docs/reference/contributing#framework-integrations)

We welcome contributions to support more frameworks:

- Focus on framework-agnostic solutions where possible
- Keep integrations minimal and maintainable
- All integrations currently live in the main package

### [Plugin Development](https://www.better-auth.com/docs/reference/contributing#plugin-development)

- For core plugins: Open an issue first to discuss your idea
- For community plugins: Feel free to develop independently
- Follow our plugin architecture guidelines

### [Documentation](https://www.better-auth.com/docs/reference/contributing#documentation)

- Fix typos and errors
- Add examples and clarify existing content
- Ensure documentation is up to date with code changes

## [Testing](https://www.better-auth.com/docs/reference/contributing#testing)

We use Vitest for testing. Place test files next to the source files they test:

```
import { describe, it, expect } from "vitest";
import { getTestInstance } from "./test-utils/test-instance";

describe("Feature", () => {
    it("should work as expected", async () => {
        const { client } = getTestInstance();
        // Test code here
        expect(result).toBeDefined();
    });
});
```

### [Testing Best Practices](https://www.better-auth.com/docs/reference/contributing#testing-best-practices)

- Write clear commit messages
- Update documentation to reflect your changes
- Add tests for new features
- Follow our coding standards
- Keep pull requests focused on a single change

## [Need Help?](https://www.better-auth.com/docs/reference/contributing#need-help)

Don't hesitate to ask for help! You can:

- Open an [issue](https://github.com/better-auth/better-auth/issues) with questions
- Join our [community discussions](https://discord.gg/better-auth)
- Reach out to project maintainers

Thank you for contributing to Better Auth!

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/reference/contributing.mdx)

[Previous Page\\
\\
Options](https://www.better-auth.com/docs/reference/options) [Next Page\\
\\
Resources](https://www.better-auth.com/docs/reference/resources)

### On this page

[Getting Started](https://www.better-auth.com/docs/reference/contributing#getting-started) [Development Setup](https://www.better-auth.com/docs/reference/contributing#development-setup) [1\. Fork the repository](https://www.better-auth.com/docs/reference/contributing#1-fork-the-repository) [2\. Clone your fork](https://www.better-auth.com/docs/reference/contributing#2-clone-your-fork) [3\. Install dependencies](https://www.better-auth.com/docs/reference/contributing#3-install-dependencies) [4\. Prepare ENV files](https://www.better-auth.com/docs/reference/contributing#4-prepare-env-files) [Making changes](https://www.better-auth.com/docs/reference/contributing#making-changes) [1\. Create a new branch](https://www.better-auth.com/docs/reference/contributing#1-create-a-new-branch) [2\. Start development server](https://www.better-auth.com/docs/reference/contributing#2-start-development-server) [3\. Make Your Changes](https://www.better-auth.com/docs/reference/contributing#3-make-your-changes) [Issues and Bug Fixes](https://www.better-auth.com/docs/reference/contributing#issues-and-bug-fixes) [Framework Integrations](https://www.better-auth.com/docs/reference/contributing#framework-integrations) [Plugin Development](https://www.better-auth.com/docs/reference/contributing#plugin-development) [Documentation](https://www.better-auth.com/docs/reference/contributing#documentation) [Testing](https://www.better-auth.com/docs/reference/contributing#testing) [Testing Best Practices](https://www.better-auth.com/docs/reference/contributing#testing-best-practices) [Need Help?](https://www.better-auth.com/docs/reference/contributing#need-help)
