# ALFRED Documentation

**Navigation guide for ALFRED's documentation**

## Core Documents

- **[PRD](alfred-prd.md)** - Product Requirements Document with phased development plan
- **[Next Priorities](next-priorities.md)** - Current development priorities and 6-week runtime integration plan
- **[Major Initiatives](alfred-10-major-initiatives.md)** - High-level strategic initiatives

## Architecture

- **[Architecture Overview](architecture/overview.md)** - System architecture and design principles
- **[Package Organization](architecture/packages.md)** - Package structure and responsibilities
- **[Decision Log](architecture/decisions.md)** - Architectural decision records

## Guides

- **[Development Coordination](guides/development-coordination.md)** - Multi-agent development workflow
- **[Orchestrator Quickstart](guides/quickstart-orchestrator.md)** - Getting started with workflow orchestration
- **[Linear Agent Setup](guides/linear-agent-setup.md)** - Configure Alfred for Linear agent activities

## Investigations

Research documents exploring implementation options:

- [Bun + UV Integration](investigations/bun-uv-integration-summary.md)
- [Linear Agent Activities](investigations/linear-agent-activities.md)
- [Metal/MLX Support](investigations/metal-mlx-support-plan.md)
- [Voice Streaming](investigations/voice-streaming-status.md)

## Execution Plans

Detailed implementation plans for major features:

- [Linear Integration](execplans/linear-integration.md) - Complete Linear Agent Activities integration

## External Reference

Documentation for external libraries and tools ALFRED uses:

- [AI SDK v6](reference/ai-sdk-v6/) - Vercel AI SDK documentation
- [Better Auth](reference/better-auth/) - Authentication library
- [Bun Runtime](reference/bun/) - Bun JavaScript runtime
- [Drizzle ORM](reference/drizzle/) - Database ORM
- [Laminar](reference/laminar/) - LLM observability
- [TanStack Start](reference/tanstack-start/) - React framework
- [Codex CLI](reference/codex-cli/) - Code execution sandbox
- [Linear API](reference/linear/) - Project management
- [Exa API](reference/exa/) - Web search

## Archive

Outdated analysis and audit documents (kept for historical reference):

- [Codebase Audits](archive/) - Previous code quality audits

---

## Quick Links

### For New Developers
1. Read the [PRD](alfred-prd.md) to understand the vision
2. Check [Next Priorities](next-priorities.md) for current focus
3. Review [Architecture Overview](architecture/overview.md)
4. Follow [Development Coordination](guides/development-coordination.md) workflow

### For Contributing
1. Check [Next Priorities](next-priorities.md) for open tasks
2. Review relevant [Execution Plans](execplans/)
3. Follow architectural patterns in [Package Organization](architecture/packages.md)

### For Operations
1. See deployment guides (coming in Phase 9)
2. Monitor [investigations](investigations/) for production readiness
