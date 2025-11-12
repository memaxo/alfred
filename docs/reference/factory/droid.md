# Overview

> Non-interactive execution mode for CI/CD pipelines and automation scripts.

# Droid Exec (Headless CLI)

Droid Exec is Factory's headless execution mode designed for automation workflows. Unlike the interactive CLI, `droid exec` runs as a one-shot command that completes a task and exits, making it ideal for CI/CD pipelines, shell scripts, and batch processing.

## Summary and goals

Droid Exec is a one-shot task runner designed to:

- Produce readable logs, and structured artifacts when requested
- Enforce opt-in for mutations/command execution (secure-by-default)
- Fail fast on permission violations with clear errors
- Support simple composition for batch and parallel work

<CardGroup cols={2}>
  <Card title="Non-Interactive" icon="terminal">
    Single run execution that writes to stdout/stderr for CI/CD integration
  </Card>

  <Card title="Secure by Default" icon="lock">
    Read-only by default with explicit opt-in for mutations via autonomy levels
  </Card>

  <Card title="Composable" icon="puzzle">
    Designed for shell scripting, parallel execution, and pipeline integration
  </Card>

  <Card title="Clean Output" icon="file-export">
    Structured output formats and artifacts for automated processing
  </Card>
</CardGroup>

## Execution model

- Non-interactive single run that writes to stdout/stderr.
- Default is spec-mode: the agent is only allowed to execute read-only operations.
- Add `--auto` to enable edits and commands; risk tiers gate what can run.

CLI help (excerpt):

```
Usage: droid exec [options] [prompt]

Execute a single command (non-interactive mode)

Arguments:
  prompt                          The prompt to execute

Options:
  -o, --output-format <format>    Output format (default: "text")
  -f, --file <path>               Read prompt from file
  --auto <level>                  Autonomy level: low|medium|high
  --skip-permissions-unsafe       Skip ALL permission checks (unsafe)
  -s, --session-id <id>           Existing session to continue (requires a prompt)
  -m, --model <id>                Model ID to use
  -r, --reasoning-effort <level>  Reasoning effort: off|low|medium|high
  --cwd <path>                    Working directory path
  -h, --help                      display help for command
```

Supported models (examples):

- gpt-5-codex (default)
- gpt-5-2025-08-07
- claude-sonnet-4-20250514
- claude-opus-4-1-20250805

## Installation

<Steps>
  <Step title="Install Droid CLI">
    <CodeGroup>
      ```bash macOS/Linux theme={null}
      curl -fsSL https://app.factory.ai/cli | sh
      ```

      ```powershell Windows theme={null}
      irm https://app.factory.ai/cli/windows | iex
      ```
    </CodeGroup>

  </Step>

  <Step title="Get Factory API Key">
    Generate your API key from the [Factory Settings Page](https://app.factory.ai/settings/api-keys)
  </Step>

  <Step title="Set Environment Variable">
    Export your API key as an environment variable:

    ```bash  theme={null}
    export FACTORY_API_KEY=fk-...
    ```

  </Step>
</Steps>

## Quickstart

- Direct prompt:
  - `droid exec "analyze code quality"`
  - `droid exec "fix the bug in src/main.js" --auto low`
- From file:
  - `droid exec -f prompt.md`
- Pipe:
  - `echo "summarize repo structure" | droid exec`
- Session continuation:
  - `droid exec --session-id <session-id> "continue with next steps"`

## Autonomy Levels

Droid exec uses a tiered autonomy system to control what operations the agent can perform. By default, it runs in read-only mode, requiring explicit flags to enable modifications.

### DEFAULT (no flags) - Read-only Mode

The safest mode for reviewing planned changes without execution:

- ✅ Reading files or logs: cat, less, head, tail, systemctl status
- ✅ Display commands: echo, pwd
- ✅ Information gathering: whoami, date, uname, ps, top
- ✅ Git read operations: git status, git log, git diff
- ✅ Directory listing: ls, find (without -delete or -exec)
- ❌ No modifications to files or system
- **Use case:** Safe for reviewing what changes would be made

```bash theme={null}
# Analyze and plan refactoring without making changes
droid exec "Analyze the authentication system and create a detailed plan for migrating from session-based auth to OAuth2. List all files that would need changes and describe the modifications required."

# Review code quality and generate report
droid exec "Review the codebase for security vulnerabilities, performance issues, and code smells. Generate a prioritized list of improvements needed."

# Understand project structure
droid exec "Analyze the project architecture and create a dependency graph showing how modules interact with each other."
```

### `--auto low` - Low-risk Operations

Enables basic file operations while blocking system changes:

- ✅ File creation/editing in project directories
- ❌ No system modifications or package installations
- **Use case:** Documentation updates, code formatting, adding comments

```bash theme={null}
# Safe file operations
droid exec --auto low "add JSDoc comments to all functions"
droid exec --auto low "fix typos in README.md"
```

### `--auto medium` - Development Operations

Operations that may have significant side effects, but these side effects are typically harmless and straightforward to recover from.
Adds common development tasks to low-risk operations:

- Installing packages from trusted sources: npm install, pip install (without sudo)
- Network requests to trusted endpoints: curl, wget to known APIs
- Git operations that modify local repositories: git commit, git checkout, git pull (but not git push)
- Building code with tools like make, npm run build, mvn compile
- ❌ No git push, sudo commands, or production changes
- **Use case:** Local development, testing, dependency management

```bash theme={null}
# Development tasks
droid exec --auto medium "install deps, run tests, fix issues"
droid exec --auto medium "update packages and resolve conflicts"
```

### `--auto high` - Production Operations

Commands that may have security implications such as data transfers between untrusted sources or execution of unknown code, or major side effects such as irreversible data loss or modifications of production systems/deployments.

- Running arbitrary/untrusted code: curl | bash, eval, executing downloaded scripts
- Exposing ports or modifying firewall rules that could allow external access
- Git push operations that modify remote repositories: git push, git push --force
- Irreversible actions to production deployments, database migrations, or other sensitive operations
- Commands that access or modify sensitive information like passwords or keys
- ❌ Still blocks: sudo rm -rf /, system-wide changes
- **Use case:** CI/CD pipelines, automated deployments

```bash theme={null}
# Full workflow automation
droid exec --auto high "fix bug, test, commit, and push to main"
droid exec --auto high "deploy to staging after running tests"
```

### `--skip-permissions-unsafe` - Bypass All Checks

<Warning>
  DANGEROUS: This mode allows ALL operations without confirmation. Only use in completely isolated environments like Docker containers or throwaway VMs.
</Warning>

- ⚠️ Allows ALL operations without confirmation
- ⚠️ Can execute irreversible operations
- Cannot be combined with --auto flags
- **Use case:** Isolated environments

```bash theme={null}
# In a disposable Docker container for CI testing
docker run --rm -v $(pwd):/workspace alpine:latest sh -c "
  apk add curl bash &&
  curl -fsSL https://app.factory.ai/cli | sh &&
  droid exec --skip-permissions-unsafe 'Install all system dependencies, modify system configs, run integration tests that require root access, and clean up test databases'
"

# In ephemeral GitHub Actions runner for rapid iteration
# where the runner is destroyed after each job
droid exec --skip-permissions-unsafe "Modify /etc/hosts for test domains, install custom kernel modules, run privileged container tests, and reset network interfaces"

# In a temporary VM for security testing
droid exec --skip-permissions-unsafe "Run penetration testing tools, modify firewall rules, test privilege escalation scenarios, and generate security audit reports"
```

### Fail-fast Behavior

If a requested action exceeds the current autonomy level, droid exec will:

1. Stop immediately with a clear error message
2. Return a non-zero exit code
3. Not perform any partial changes

This ensures predictable behavior in automation scripts and CI/CD pipelines.

## Output formats and artifacts

Droid exec supports three output formats for different use cases:

### text (default)

Human-readable output for direct consumption or logs:

```bash theme={null}
$ droid exec --auto low "create a python file that prints 'hello world'"
Perfect! I've created a Python file named `hello_world.py` in your home directory that prints 'hello world' when executed.
```

### json

Structured JSON output for parsing in scripts and automation:

```bash theme={null}
$ droid exec "summarize this repository" --output-format json
{
  "type": "result",
  "subtype": "success",
  "is_error": false,
  "duration_ms": 5657,
  "num_turns": 1,
  "result": "This is a Factory documentation repository containing guides for CLI tools, web platform features, and onboarding procedures...",
  "session_id": "8af22e0a-d222-42c6-8c7e-7a059e391b0b"
}
```

Use JSON format when you need to:

- Parse the result in a script
- Check success/failure programmatically
- Extract session IDs for continuation
- Process results in a pipeline

### debug

Streaming messages showing the agent's execution in real-time:

```bash theme={null}
$ droid exec "run ls command" --output-format debug
{"type":"message","role":"user","text":"run ls command"}
{"type":"message","role":"assistant","text":"I'll run the ls command to list the contents..."}
{"type":"tool_call","toolName":"Execute","parameters":{"command":"ls -la"}}
{"type":"tool_result","value":"total 16\ndrwxr-xr-x@ 8 user staff..."}
{"type":"message","role":"assistant","text":"The ls command has been executed successfully..."}
```

Debug format is useful for:

- Monitoring agent behavior
- Troubleshooting execution issues
- Understanding tool usage patterns
- Real-time progress tracking

For automated pipelines, you can also direct the agent to write specific artifacts:

```bash theme={null}
droid exec --auto low "Analyze dependencies and write to deps.json"
droid exec --auto low "Generate metrics report in CSV format to metrics.csv"
```

## Working directory

- Use `--cwd` to scope execution:

```
droid exec --cwd /home/runner/work/repo "Map internal packages and dump graphviz DOT to deps.dot"
```

## Models and reasoning effort

- Choose a model with `-m` and adjust reasoning with `-r`:

```
droid exec -m claude-sonnet-4-20250514 -r medium -f plan.md
```

## Batch and parallel patterns

Shell loops (bounded concurrency):

```bash theme={null}
# Process files in parallel (GNU xargs -P)
find src -name "*.ts" -print0 | xargs -0 -P 4 -I {} \
  droid exec --auto low "Refactor file: {} to use modern TS patterns"
```

Background job parallelization:

```bash theme={null}
# Process multiple directories in parallel with job control
for path in packages/ui packages/models apps/factory-app; do
  (
    cd "$path" &&
    droid exec --auto low "Run targeted analysis and write report.md"
  ) &
done
wait  # Wait for all background jobs to complete
```

Chunked inputs:

```bash theme={null}
# Split large file lists into manageable chunks
git diff --name-only origin/main...HEAD | split -l 50 - /tmp/files_
for f in /tmp/files_*; do
  list=$(tr '\n' ' ' < "$f")
  droid exec --auto low "Review changed files: $list and write to review.json"
done
rm /tmp/files_*  # Clean up temporary files
```

Workflow Automation (CI/CD):

```yaml theme={null}
# Dead code detection and cleanup suggestions
name: Code Cleanup Analysis
on:
  schedule:
    - cron: "0 1 * * 0" # Weekly on Sundays
  workflow_dispatch:
jobs:
  cleanup-analysis:
    strategy:
      matrix:
        module: ["src/components", "src/services", "src/utils", "src/hooks"]
    steps:
      - uses: actions/checkout@v4
      - run: droid exec --cwd "${{ matrix.module }}" --auto low "Identify unused exports, dead code, and deprecated patterns. Generate cleanup recommendations in cleanup-report.md"
```

## Unique usage examples

License header enforcer:

```bash theme={null}
git ls-files "*.ts" | xargs -I {} \
  droid exec --auto low "Ensure {} begins with the Apache-2.0 header; add it if missing"
```

API contract drift check (read-only):

```bash theme={null}
droid exec "Compare openapi.yaml operations to our TypeScript client methods and write drift.md with any mismatches"
```

Security sweep:

```bash theme={null}
droid exec --auto low "Run a quick audit for sync child_process usage and propose fixes; write findings to sec-audit.csv"
```

## Exit behavior

- 0: success
- Non-zero: failure (permission violation, tool error, unmet objective). Treat non-zero as failed in CI.

## Best practices

- Favor `--auto low`; keep mutations minimal and commit/push in scripted steps.
- Avoid `--skip-permissions-unsafe` unless fully sandboxed.
- Ask the agent to emit artifacts your pipeline can verify.
- Use `--cwd` to constrain scope in monorepos.

# Automated Code Review

> Automate pull request reviews using Droid Exec in GitHub Actions

This tutorial shows you how to set up automated code review using Droid Exec in GitHub Actions. The workflow will analyze pull requests, identify issues, and post feedback as inline comments.

<Info>
  Unlike interactive CLI sessions, Droid Exec runs in headless mode, making it perfect for CI/CD automation. The agent analyzes code changes, identifies issues, and creates structured output that can be posted as PR comments.
</Info>

## How it works

The workflow:

1. Triggers on pull request events
2. Checks out the PR and installs the Droid CLI
3. Configures git identity and prepares review context files
4. Runs Droid Exec to analyze the diff and produce review comments
5. Submits inline comments or a summary, uploading debug artifacts on failure

<div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
  <div style={{ flex: '1', minWidth: '300px' }}>
    <img src="https://mintcdn.com/factory/-rqmtwzGn_UC9miJ/cli/droid-exec/cookbook/code-review-picture-1.png?fit=max&auto=format&n=-rqmtwzGn_UC9miJ&q=85&s=1aa44189ef07536dd64a97b90ffff089" alt="Droid Exec posting inline comments on PR with detected issues" data-og-width="1788" width="1788" data-og-height="1134" height="1134" data-path="cli/droid-exec/cookbook/code-review-picture-1.png" data-optimize="true" data-opv="3" srcset="https://mintcdn.com/factory/-rqmtwzGn_UC9miJ/cli/droid-exec/cookbook/code-review-picture-1.png?w=280&fit=max&auto=format&n=-rqmtwzGn_UC9miJ&q=85&s=716ce745be979c437987e9299341abd8 280w, https://mintcdn.com/factory/-rqmtwzGn_UC9miJ/cli/droid-exec/cookbook/code-review-picture-1.png?w=560&fit=max&auto=format&n=-rqmtwzGn_UC9miJ&q=85&s=d2381d9c435fc101a7b43279359ced9a 560w, https://mintcdn.com/factory/-rqmtwzGn_UC9miJ/cli/droid-exec/cookbook/code-review-picture-1.png?w=840&fit=max&auto=format&n=-rqmtwzGn_UC9miJ&q=85&s=90f7b65bd992cbb2ce0ecbbd02d8fa78 840w, https://mintcdn.com/factory/-rqmtwzGn_UC9miJ/cli/droid-exec/cookbook/code-review-picture-1.png?w=1100&fit=max&auto=format&n=-rqmtwzGn_UC9miJ&q=85&s=8d1e3b90f65ae5086a903505502a61c2 1100w, https://mintcdn.com/factory/-rqmtwzGn_UC9miJ/cli/droid-exec/cookbook/code-review-picture-1.png?w=1650&fit=max&auto=format&n=-rqmtwzGn_UC9miJ&q=85&s=d4ed8446d735ad4ba7cc7e1819ad630b 1650w, https://mintcdn.com/factory/-rqmtwzGn_UC9miJ/cli/droid-exec/cookbook/code-review-picture-1.png?w=2500&fit=max&auto=format&n=-rqmtwzGn_UC9miJ&q=85&s=4b0dacc72c2f082411dbfcc9cff5c2cf 2500w" />
  </div>

  <div style={{ flex: '1', minWidth: '300px' }}>
    <img src="https://mintcdn.com/factory/-rqmtwzGn_UC9miJ/cli/droid-exec/cookbook/code-review-picture-2.png?fit=max&auto=format&n=-rqmtwzGn_UC9miJ&q=85&s=0f60888a414084bf0182e2c52b1e91d2" alt="Droid Exec approval comment on clean PR" data-og-width="1626" width="1626" data-og-height="690" height="690" data-path="cli/droid-exec/cookbook/code-review-picture-2.png" data-optimize="true" data-opv="3" srcset="https://mintcdn.com/factory/-rqmtwzGn_UC9miJ/cli/droid-exec/cookbook/code-review-picture-2.png?w=280&fit=max&auto=format&n=-rqmtwzGn_UC9miJ&q=85&s=a2ffded969aad4c7fc66b4c262dc0a08 280w, https://mintcdn.com/factory/-rqmtwzGn_UC9miJ/cli/droid-exec/cookbook/code-review-picture-2.png?w=560&fit=max&auto=format&n=-rqmtwzGn_UC9miJ&q=85&s=7d63cca4f4dcb3af0bb627d9ffce6de6 560w, https://mintcdn.com/factory/-rqmtwzGn_UC9miJ/cli/droid-exec/cookbook/code-review-picture-2.png?w=840&fit=max&auto=format&n=-rqmtwzGn_UC9miJ&q=85&s=a05ff9506bc388b14c97f29432a6e77a 840w, https://mintcdn.com/factory/-rqmtwzGn_UC9miJ/cli/droid-exec/cookbook/code-review-picture-2.png?w=1100&fit=max&auto=format&n=-rqmtwzGn_UC9miJ&q=85&s=257b42879c345adcad892ef30cfca9a1 1100w, https://mintcdn.com/factory/-rqmtwzGn_UC9miJ/cli/droid-exec/cookbook/code-review-picture-2.png?w=1650&fit=max&auto=format&n=-rqmtwzGn_UC9miJ&q=85&s=09d25273a1d54834b3a3fc2982b20b5a 1650w, https://mintcdn.com/factory/-rqmtwzGn_UC9miJ/cli/droid-exec/cookbook/code-review-picture-2.png?w=2500&fit=max&auto=format&n=-rqmtwzGn_UC9miJ&q=85&s=1f3eed44ce06c7910b8e16abba9b46d4 2500w" />
  </div>
</div>

<Accordion title="Full Workflow File">
  ````yaml  theme={null}
  name: Droid Code Review

on:
pull_request:
types: [opened, synchronize, reopened, ready_for_review]

concurrency:
group: droid-review-${{ github.event.pull_request.number }}
cancel-in-progress: true

permissions:
pull-requests: write
contents: read
issues: write

jobs:
code-review:
runs-on: ubuntu-latest
timeout-minutes: 15 # Skip automated code review for draft PRs
if: github.event.pull_request.draft == false

      steps:
        - name: Checkout repository
          uses: actions/checkout@v4
          with:
            fetch-depth: 0
            ref: ${{ github.event.pull_request.head.sha }}

        - name: Install Droid CLI
          run: |
            curl -fsSL https://app.factory.ai/cli | sh
            echo "$HOME/.local/bin" >> $GITHUB_PATH
            "$HOME/.local/bin/droid" --version

        - name: Configure git identity
          run: |
            git config user.name "Droid Agent"
            git config user.email "droidagent@factory.ai"

        - name: Prepare review context
          run: |
            # Get the PR diff
            git fetch origin ${{ github.event.pull_request.base.ref }}
            git diff origin/${{ github.event.pull_request.base.ref }}...${{ github.event.pull_request.head.sha }} > diff.txt

            # Get existing comments using GitHub API
            curl -H "Authorization: token ${{ secrets.GITHUB_TOKEN }}" \
                 -H "Accept: application/vnd.github.v3+json" \
                 "https://api.github.com/repos/${{ github.repository }}/issues/${{ github.event.pull_request.number }}/comments" \
                 > existing_comments.json

            # Get changed files with patches for positioning
            curl -H "Authorization: token ${{ secrets.GITHUB_TOKEN }}" \
                 -H "Accept: application/vnd.github.v3+json" \
                 "https://api.github.com/repos/${{ github.repository }}/pulls/${{ github.event.pull_request.number }}/files" \
                 | jq '[.[] | {filename: .filename, patch: .patch}]' > files.json

        - name: Perform automated code review
          env:
            FACTORY_API_KEY: ${{ secrets.FACTORY_API_KEY }}
            GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          run: |
            cat > prompt.txt << 'EOF'
            You are an automated code review system. Review the PR diff and identify clear issues that need to be fixed.

            Input files (already in current directory):
            - diff.txt: the code changes to review
            - files.json: file patches with line numbers for positioning comments
            - existing_comments.json: skip issues already mentioned here

            Task: Create a file called comments.json with this exact format:
            [{ "path": "path/to/file.js", "position": 42, "body": "Your comment here" }]

            Focus on these types of issues:
            - Dead/unreachable code (if (false), while (false), code after return/throw/break)
            - Broken control flow (missing break in switch, fallthrough bugs)
            - Async/await mistakes (missing await, .then without return, unhandled promise rejections)
            - Array/object mutations in React components or reducers
            - UseEffect dependency array problems (missing deps, incorrect deps)
            - Incorrect operator usage (== vs ===, && vs ||, = in conditions)
            - Off-by-one errors in loops or array indexing
            - Integer overflow/underflow in calculations
            - Regex catastrophic backtracking vulnerabilities
            - Missing base cases in recursive functions
            - Incorrect type coercion that changes behavior
            - Environment variable access without defaults or validation
            - Null/undefined dereferences
            - Resource leaks (unclosed files or connections)
            - SQL/XSS injection vulnerabilities
            - Concurrency/race conditions
            - Missing error handling for critical operations

            Comment format:
            - Clearly describe the issue: "This code block is unreachable due to the if (false) condition"
            - Provide a concrete fix: "Remove this entire if block as it will never execute"
            - When possible, suggest the exact code change:
              ```suggestion
              // Remove the unreachable code
              ```
            - Be specific about why it's a problem: "This will cause a TypeError if input is null"
            - No emojis, just clear technical language

            Skip commenting on:
            - Code style, formatting, or naming conventions
            - Minor performance optimizations
            - Architectural decisions or design patterns
            - Features or functionality (unless broken)
            - Test coverage (unless tests are clearly broken)

            Position calculation:
            - Use the "position" field from files.json patches
            - This is the line number in the diff, not the file
            - Comments must align with exact changed lines only

            Output:
            - Empty array [] if no issues found
            - Otherwise array of comment objects with path, position, body
            - Each comment should be actionable and clear about what needs to be fixed
            - Maximum 10 comments total; prioritize the most critical issues
            EOF

            # Run droid exec with the prompt
            echo "Running code review analysis..."
            droid exec --auto high -f prompt.txt

            # Check if comments.json was created
            if [ ! -f comments.json ]; then
              echo "❌ ERROR: droid exec did not create comments.json"
              echo "This usually indicates the review run failed (e.g. missing FACTORY_API_KEY or runtime error)."
              exit 1
            fi

            echo "=== Review Results ==="
            cat comments.json

        - name: Submit inline review comments
          uses: actions/github-script@v7
          with:
            script: |
              const fs = require('fs');
              const prNumber = context.payload.pull_request.number;

              if (!fs.existsSync('comments.json')) {
                core.info('comments.json missing; skipping review submission');
                return;
              }

              const comments = JSON.parse(fs.readFileSync('comments.json', 'utf8'));

              if (!Array.isArray(comments) || comments.length === 0) {
                // Check if we already have a "no issues" comment
                const existing = await github.paginate(github.rest.issues.listComments, {
                  owner: context.repo.owner,
                  repo: context.repo.repo,
                  issue_number: prNumber,
                  per_page: 100
                });

                const hasNoIssuesComment = existing.some(c =>
                  c.user.login.includes('[bot]') &&
                  /no issues found|lgtm|✅/i.test(c.body || '')
                );

                if (!hasNoIssuesComment) {
                  await github.rest.pulls.createReview({
                    owner: context.repo.owner,
                    repo: context.repo.repo,
                    pull_number: prNumber,
                    event: 'COMMENT',
                    body: '✅ No issues found in the current changes.'
                  });
                }
                return;
              }

              // Submit review with inline comments
              const summary = `Found ${comments.length} potential issue${comments.length === 1 ? '' : 's'} that should be addressed.`;

              await github.rest.pulls.createReview({
                owner: context.repo.owner,
                repo: context.repo.repo,
                pull_number: prNumber,
                event: 'COMMENT',
                body: summary,
                comments: comments
              });

              core.info(`Submitted review with ${comments.length} inline comments`);

        - name: Upload debug artifacts on failure
          if: ${{ failure() }}
          uses: actions/upload-artifact@v4
          with:
            name: droid-review-debug-${{ github.run_id }}
            path: |
              diff.txt
              files.json
              existing_comments.json
              prompt.txt
              comments.json
              ${{ runner.home }}/.factory/logs/droid-log-single.log
              ${{ runner.home }}/.factory/logs/console.log
            if-no-files-found: ignore
            retention-days: 7

`````
</Accordion>

## Prerequisites

<Steps>
<Step title="GitHub Repository">
  Ensure you have a GitHub repository with Actions enabled
</Step>

<Step title="Get Factory API Key">
  Generate your API key from the [Factory Settings Page](https://app.factory.ai/settings/api-keys)
</Step>

<Step title="GitHub Actions Knowledge">
  Basic understanding of GitHub Actions workflows
</Step>
</Steps>

## Configure authentication

Add your Factory API key as a repository secret:

1. Go to your repository's Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Name: `FACTORY_API_KEY`
4. Value: Your Factory API key (starts with `fk-`)

## Build the GitHub Actions workflow

Let's build the workflow step by step to understand each component.

### Set up the workflow trigger

Create `.github/workflows/droid-code-review.yml` and configure when it should run:

```yaml  theme={null}
name: Droid Code Review

on:
pull_request:
  types: [opened, synchronize, reopened, ready_for_review]

concurrency:
group: droid-review-${{ github.event.pull_request.number }}
cancel-in-progress: true
```

The `concurrency` group ensures only one review runs per PR at a time, canceling outdated runs when new commits are pushed.

### Configure workflow permissions

Define the top-level permissions and job details used by the workflow:

```yaml  theme={null}
permissions:
pull-requests: write
contents: read
issues: write

jobs:
code-review:
  runs-on: ubuntu-latest
  timeout-minutes: 15

  # Skip draft PRs to avoid noise during development
  if: github.event.pull_request.draft == false

```

### Checkout the repository

Add the checkout step to access the PR code:

```yaml  theme={null}
  steps:
    - name: Checkout repository
      uses: actions/checkout@v4
      with:
        fetch-depth: 0  # Full history for accurate diffs
        ref: ${{ github.event.pull_request.head.sha }}
```

### Install Droid CLI

Install the Factory Droid CLI in the runner:

```yaml  theme={null}
    - name: Install Droid CLI
      run: |
        curl -fsSL https://app.factory.ai/cli | sh
        echo "$HOME/.local/bin" >> $GITHUB_PATH
        "$HOME/.local/bin/droid" --version
```

### Configure git identity

Set the git username and email so review comments originate from the expected bot account:

```yaml  theme={null}
    - name: Configure git identity
      run: |
        git config user.name "Droid Agent"
        git config user.email "droidagent@factory.ai"
```

### Prepare review context

Gather the diff, existing comments, and file patches that Droid Exec will analyze:

```yaml  theme={null}
    - name: Prepare review context
      run: |
        # Get the PR diff
        git fetch origin ${{ github.event.pull_request.base.ref }}
        git diff origin/${{ github.event.pull_request.base.ref }}...${{ github.event.pull_request.head.sha }} > diff.txt

        # Get existing comments using GitHub API
        curl -H "Authorization: token ${{ secrets.GITHUB_TOKEN }}" \
             -H "Accept: application/vnd.github.v3+json" \
             "https://api.github.com/repos/${{ github.repository }}/issues/${{ github.event.pull_request.number }}/comments" \
             > existing_comments.json

        # Get changed files with patches for positioning
        curl -H "Authorization: token ${{ secrets.GITHUB_TOKEN }}" \
             -H "Accept: application/vnd.github.v3+json" \
             "https://api.github.com/repos/${{ github.repository }}/pulls/${{ github.event.pull_request.number }}/files" \
             | jq '[.[] | {filename: .filename, patch: .patch}]' > files.json
```

### Run the automated review

Craft a detailed prompt and execute Droid Exec to produce inline comments. The command relies on both `FACTORY_API_KEY` and `GITHUB_TOKEN` secrets:

````yaml  theme={null}
    - name: Perform automated code review
      env:
        FACTORY_API_KEY: ${{ secrets.FACTORY_API_KEY }}
        GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      run: |
        cat > prompt.txt << 'EOF'
        You are an automated code review system. Review the PR diff and identify clear issues that need to be fixed.

        Input files (already in current directory):
        - diff.txt: the code changes to review
        - files.json: file patches with line numbers for positioning comments
        - existing_comments.json: skip issues already mentioned here

        Task: Create a file called comments.json with this exact format:
        [{ "path": "path/to/file.js", "position": 42, "body": "Your comment here" }]

        Focus on these types of issues:
        - Dead/unreachable code (if (false), while (false), code after return/throw/break)
        - Broken control flow (missing break in switch, fallthrough bugs)
        - Async/await mistakes (missing await, .then without return, unhandled promise rejections)
        - Array/object mutations in React components or reducers
        - UseEffect dependency array problems (missing deps, incorrect deps)
        - Incorrect operator usage (== vs ===, && vs ||, = in conditions)
        - Off-by-one errors in loops or array indexing
        - Integer overflow/underflow in calculations
        - Regex catastrophic backtracking vulnerabilities
        - Missing base cases in recursive functions
        - Incorrect type coercion that changes behavior
        - Environment variable access without defaults or validation
        - Null/undefined dereferences
        - Resource leaks (unclosed files or connections)
        - SQL/XSS injection vulnerabilities
        - Concurrency/race conditions
        - Missing error handling for critical operations

        Comment format:
        - Clearly describe the issue: "This code block is unreachable due to the if (false) condition"
        - Provide a concrete fix: "Remove this entire if block as it will never execute"
        - When possible, suggest the exact code change:
          ```suggestion
          // Remove the unreachable code
          ```
        - Be specific about why it's a problem: "This will cause a TypeError if input is null"
        - No emojis, just clear technical language

        Skip commenting on:
        - Code style, formatting, or naming conventions
        - Minor performance optimizations
        - Architectural decisions or design patterns
        - Features or functionality (unless broken)
        - Test coverage (unless tests are clearly broken)

        Position calculation:
        - Use the "position" field from files.json patches
        - This is the line number in the diff, not the file
        - Comments must align with exact changed lines only

        Output:
        - Empty array [] if no issues found
        - Otherwise array of comment objects with path, position, body
        - Each comment should be actionable and clear about what needs to be fixed
        - Prioritize the most critical issues
        EOF

        echo "Running code review analysis..."
        droid exec --auto high -f prompt.txt

        if [ ! -f comments.json ]; then
          echo "❌ ERROR: droid exec did not create comments.json"
          echo "This usually indicates the review run failed (e.g. missing FACTORY_API_KEY or runtime error)."
          exit 1
        fi

        echo "=== Review Results ==="
        cat comments.json
`````

### Submit review comments

Use `actions/github-script` to post inline feedback or a fallback summary based on the generated `comments.json`:

```yaml theme={null}
- name: Submit inline review comments
  uses: actions/github-script@v7
  with:
    script: |
      const fs = require('fs');
      const prNumber = context.payload.pull_request.number;

      if (!fs.existsSync('comments.json')) {
        core.info('comments.json missing; skipping review submission');
        return;
      }

      const comments = JSON.parse(fs.readFileSync('comments.json', 'utf8'));

      if (!Array.isArray(comments) || comments.length === 0) {
        // Check if we already have a "no issues" comment
        const existing = await github.paginate(github.rest.issues.listComments, {
          owner: context.repo.owner,
          repo: context.repo.repo,
          issue_number: prNumber,
          per_page: 100
        });
        
        const hasNoIssuesComment = existing.some(c => 
          c.user.login.includes('[bot]') && 
          /no issues found|lgtm|✅/i.test(c.body || '')
        );
        
        if (!hasNoIssuesComment) {
          await github.rest.pulls.createReview({
            owner: context.repo.owner,
            repo: context.repo.repo,
            pull_number: prNumber,
            event: 'COMMENT',
            body: '✅ No issues found in the current changes.'
          });
        }
        return;
      }

      // Submit review with inline comments
      const summary = `Found ${comments.length} potential issue${comments.length === 1 ? '' : 's'} that should be addressed.`;

      await github.rest.pulls.createReview({
        owner: context.repo.owner,
        repo: context.repo.repo,
        pull_number: prNumber,
        event: 'COMMENT',
        body: summary,
        comments: comments
      });

      core.info(`Submitted review with ${comments.length} inline comments`);
```

### Save artifacts on failure

Store review artifacts for troubleshooting if the workflow fails:

```yaml theme={null}
- name: Upload debug artifacts on failure
  if: ${{ failure() }}
  uses: actions/upload-artifact@v4
  with:
    name: droid-review-debug-${{ github.run_id }}
    path: |
      diff.txt
      files.json
      existing_comments.json
      prompt.txt
      comments.json
      ${{ runner.home }}/.factory/logs/droid-log-single.log
      ${{ runner.home }}/.factory/logs/console.log
    if-no-files-found: ignore
    retention-days: 7
```

## Test your reviewer

Create a test PR with some intentional issues to verify the workflow:

```javascript theme={null}
// Example code with issues
function processData(data) {
  if (false) {
    // Dead code
    console.log("This never runs");
  }

  data.forEach(async (item) => {
    // Missing await
    processItem(item);
  });

  if ((data = null)) {
    // Changed assignment to comparison
    return;
  }
}
```

The reviewer should identify these issues and post inline comments.

# Organize Imports

> Automatically organize imports across your entire codebase using Droid Exec

This tutorial demonstrates how to use Droid Exec to refactor import statements across hundreds of files simultaneously. The script intelligently groups, sorts, and optimizes imports while removing unused dependencies and converting module formats.

## How it works

The script:

1. **Finds files**: Searches for all `.js`, `.jsx`, `.ts`, and `.tsx` files
2. **Filters smartly**: Excludes `node_modules`, `.git`, `dist`, and `build` directories
3. **Checks for imports**: Only processes files that contain import statements
4. **Groups imports**: Organizes into external, internal, and relative imports
5. **Sorts alphabetically**: Within each group for consistency
6. **Removes unused**: Eliminates imports that aren't referenced
7. **Modernizes syntax**: Converts `require()` to ES6 `import`
8. **Consolidates duplicates**: Merges multiple imports from the same module

## Get the script

<Accordion title="View full script source">
  ```bash  theme={null}
  #!/bin/bash

# Simplified Droid Import Refactoring Script

# A cookbook example of using AI to refactor imports across a codebase

#

# Usage: ./droid-refactor-imports.sh [directory]

# Example: ./droid-refactor-imports.sh src

set -e

# Configuration

CONCURRENCY=${CONCURRENCY:-5}
  DRY_RUN=${DRY_RUN:-false}
TARGET_DIR="${1:-.}"

# Colors for output

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Temp files for tracking

TEMP_DIR=$(mktemp -d)
  FILES_LIST="$TEMP_DIR/files.txt"
MODIFIED_COUNT=0
PROCESSED_COUNT=0

# Cleanup on exit

trap "rm -rf $TEMP_DIR" EXIT

# Function to process a single file

process_file() {
local filepath="$1"
      local filename=$(basename "$filepath")

      # Check if file has imports
      if ! grep -qE "^import |^const .* = require\(|^export .* from" "$filepath" 2>/dev/null; then
          return 0
      fi

      echo -e "${BLUE}Processing: $filepath${NC}"

      # The AI prompt for refactoring imports
      local prompt="Refactor the imports in $filepath:

1. Group imports in this order with blank lines between:
   - External packages (node_modules)
   - Internal/absolute imports (@/ or src/)
   - Relative imports (./ or ../)

2. Sort alphabetically within each group
3. Remove unused imports
4. Convert require() to ES6 imports
5. Consolidate duplicate imports from same module

Only modify imports, preserve all other code exactly.
Return the complete refactored file."

      if [ "$DRY_RUN" = "true" ]; then
          echo -e "${YELLOW}  [DRY RUN] Would refactor imports${NC}"
          return 0
      fi

      # Get original file hash for comparison
      local original_hash=$(md5sum "$filepath" 2>/dev/null | cut -d' ' -f1 || md5 -q "$filepath")

      # Run droid to refactor the file
      if droid exec --auto low "$prompt" 2>/dev/null; then
          # Check if file was modified
          local new_hash=$(md5sum "$filepath" 2>/dev/null | cut -d' ' -f1 || md5 -q "$filepath")
          if [ "$original_hash" != "$new_hash" ]; then
              echo -e "${GREEN}  ✓ Refactored${NC}"
              ((MODIFIED_COUNT++))
          fi
          ((PROCESSED_COUNT++))
      else
          echo "  ✗ Failed to process"
      fi

}

# Export function and variables for parallel execution

export -f process_file
export DRY_RUN GREEN YELLOW BLUE NC

# Main execution

echo -e "${BLUE}=== Droid Import Refactoring ===${NC}"
echo -e "${BLUE}Directory: $TARGET_DIR${NC}"
echo -e "${BLUE}Concurrency: $CONCURRENCY${NC}"
[ "$DRY_RUN" = "true" ] && echo -e "${YELLOW}DRY RUN MODE${NC}"
echo ""

# Find JavaScript and TypeScript files

find "$TARGET_DIR" -type f \
      \( -name "*.js" -o -name "*.jsx" -o -name "*.ts" -o -name "*.tsx" \) \
      ! -path "*/node_modules/*" \
      ! -path "*/.git/*" \
      ! -path "*/dist/*" \
      ! -path "*/build/*" \
      > "$FILES_LIST"

FILE_COUNT=$(wc -l < "$FILES_LIST" | tr -d ' ')

if [ "$FILE_COUNT" -eq 0 ]; then
echo -e "${YELLOW}No JavaScript/TypeScript files found${NC}"
exit 0
fi

echo -e "${BLUE}Found $FILE_COUNT files to check${NC}\n"

# Process files in parallel

cat "$FILES_LIST" | xargs -n 1 -P "$CONCURRENCY" -I {} bash -c 'process*file "$@"' * {}

# Show summary

echo -e "\n${BLUE}=== Summary ===${NC}"
echo -e "${GREEN}Files processed: $PROCESSED_COUNT${NC}"
[ "$DRY_RUN" = "false" ] && echo -e "${GREEN}Files modified: $MODIFIED_COUNT${NC}"

if [ "$DRY_RUN" = "false" ] && [ "$MODIFIED_COUNT" -gt 0 ]; then
echo -e "\n${BLUE}Next steps:${NC}"
echo " git diff # Review changes"
echo " git add -A # Stage changes"
echo " git commit -m 'refactor: organize imports'"
fi

````
</Accordion>

## Prerequisites

Before you begin, complete the [Droid Exec installation](/cli/droid-exec/overview#installation).

## Basic usage

### Preview changes (dry run)

<Warning>
Always start with a dry run to preview changes before modifying files. This helps you understand what transformations will be applied.
</Warning>

The dry run feature is controlled by the `DRY_RUN` environment variable:

```bash  theme={null}
# Preview what would happen (no changes made)
DRY_RUN=true ./droid-refactor-imports.sh src

# Example output:
# === Droid Import Refactoring ===
# Directory: src
# Concurrency: 5
# DRY RUN MODE
#
# Found 25 files to check
#
# Processing: src/components/Button.tsx
#   [DRY RUN] Would refactor imports
# Processing: src/utils/api.ts
#   [DRY RUN] Would refactor imports
````

**How dry run works:**

- When `DRY_RUN=true`: The script finds all files that need processing and shows which files have imports to refactor, but doesn't modify any files
- When `DRY_RUN=false` (default): Actually runs the AI refactoring and modifies the files

This is particularly useful for:

- Testing on a small directory first to understand the changes
- Estimating time/cost before processing a large codebase
- Verifying the script finds the right files before committing to changes

### Apply refactoring

Once you're satisfied with the preview, run the actual refactoring:

```bash theme={null}
# Actually refactor the imports (default behavior)
./droid-refactor-imports.sh packages/models

# Or explicitly set DRY_RUN=false
DRY_RUN=false ./droid-refactor-imports.sh packages/models

# Adjust concurrency for faster processing
CONCURRENCY=10 ./droid-refactor-imports.sh packages/models
```

Actual execution example:

```
=== Droid Import Refactoring ===
Directory: packages/models
Concurrency: 5

Found 78 files to check

Processing: packages/models/src/organization/test-utils/fixtures.ts
Processing: packages/models/src/organization/agentReadiness/types.ts
Processing: packages/models/src/organization/utils.ts
Processing: packages/models/src/organization/agentReadiness/handlers.ts
Processing: packages/models/jest.config.ts
Processing: packages/models/src/organization/user/defaultRepositories/handlers.ts
Perfect! I've successfully refactored the imports in the file...
## Summary

I've successfully refactored the imports in `packages/models/src/organization/test-utils/fixtures.ts`.
The imports are now properly organized with comments separating external packages from relative imports...
...
```

## Real-world transformations

### Example 1: CommonJS to ES6 Conversion

<Tabs>
  <Tab title="Before">
    ```typescript  theme={null}
    // customers.ts
    const getStripeInstance = require("./instance").getStripeInstance;
    import dayjs from 'dayjs';  // unused import
    import url from 'url';  // unused import
    ```
  </Tab>

  <Tab title="After">
    ```typescript  theme={null}
    // customers.ts
    // Relative imports
    import { getStripeInstance } from './instance';
    ```

    <Note>CommonJS converted to ES6, unused imports removed</Note>

  </Tab>
</Tabs>

### Example 2: Consolidating Duplicate Imports

<Tabs>
  <Tab title="Before">
    ```typescript  theme={null}
    // admin.ts
    const { auth } = require('firebase-admin');
    import { App } from "firebase-admin/app"
    import { Firestore } from 'firebase-admin/firestore';
    import dotenv from 'dotenv';  // unused import
    const { FirebaseProjectName } = require("./enums");
    import {
      getFirestoreInstanceForProject,
      getFirebaseAuthInstanceForProject,
    } from './multi-admin';
    const { initializeFirebaseAdminApp } = require('./multi-admin');
    import {
      getFirestoreInstance as getDefaultFirestoreInstance,
      getFirestoreInstanceForTest as getDefaultFirestoreInstanceForTest,
      getFirebaseAuthInstance as getDefaultFirebaseAuthInstance,
    } from "./multi-admin"
    import express from 'express';  // unused import
    ```
  </Tab>

  <Tab title="After">
    ```typescript  theme={null}
    // admin.ts
    // External packages
    import { auth } from 'firebase-admin';
    import { App } from 'firebase-admin/app';
    import { Firestore } from 'firebase-admin/firestore';

    // Relative imports
    import { FirebaseProjectName } from './enums';
    import {
      getFirestoreInstanceForProject,
      getFirebaseAuthInstanceForProject,
      initializeFirebaseAdminApp,
      getFirestoreInstance as getDefaultFirestoreInstance,
      getFirestoreInstanceForTest as getDefaultFirestoreInstanceForTest,
      getFirebaseAuthInstance as getDefaultFirebaseAuthInstance,
    } from './multi-admin';
    ```

    <Note>Multiple imports from same module consolidated, unused removed, CommonJS converted</Note>

  </Tab>
</Tabs>

## Best practices

<Note>
  Follow these best practices for safe and effective import refactoring.
</Note>

<Steps>
  <Step title="Start with a dry run">
    Always preview changes before modifying files:

    ```bash  theme={null}
    # Preview what would happen without making changes
    DRY_RUN=true ./droid-refactor-imports.sh packages/models
    ```

  </Step>

  <Step title="Test on a small scope first">
    Start with a specific subdirectory before processing entire codebase:

    ```bash  theme={null}
    # Test on a single module first
    ./droid-refactor-imports.sh packages/models/src/utils

    # Then expand to larger directories
    ./droid-refactor-imports.sh packages/models
    ```

  </Step>

  <Step title="Process incrementally">
    For large codebases, process directories separately for easier review:

    ```bash  theme={null}
    # Process each package separately
    ./droid-refactor-imports.sh packages/models
    git add -A && git commit -m "refactor: organize imports in models"

    ./droid-refactor-imports.sh packages/services
    git add -A && git commit -m "refactor: organize imports in services"
    ```

  </Step>
</Steps>
# Automated Lint Fixes

> Automatically fix ESLint violations across your codebase using Droid Exec

This tutorial demonstrates how to use Droid Exec to automatically fix ESLint violations across your codebase. The script identifies files with lint errors and intelligently fixes them while preserving functionality.

<Info>
  This approach works with any ESLint rule - from simple formatting issues to complex architectural patterns.
</Info>

## How it works

The script:

1. **Finds violations**: Runs ESLint to identify all route.ts files missing middleware
2. **Analyzes context**: Determines the appropriate middleware type based on the route path
3. **Adds middleware**: Inserts the correct handle\*Middleware call as the first statement
4. **Preserves logic**: Wraps existing code in the middleware callback
5. **Maintains types**: Ensures TypeScript types are correctly preserved
6. **Formats code**: Maintains consistent code style

## Get the script

<Accordion title="View full script source">
  ```bash  theme={null}
  #!/bin/bash

# Droid Route Middleware Fix Script

# Automatically adds required middleware to NextJS API routes that are missing them

#

# Usage: ./droid-fix-route-middleware.sh [directory]

# Example: ./droid-fix-route-middleware.sh apps/factory-app

set -e

# Configuration

CONCURRENCY=${CONCURRENCY:-5}
  DRY_RUN=${DRY_RUN:-false}
TARGET_DIR="${1:-.}"
ESLINT_RULE="factory/require-route-middleware"

# Colors for output

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# Temp files for tracking

TEMP_DIR=$(mktemp -d)
  VIOLATIONS_FILE="$TEMP_DIR/violations.txt"
PROCESSED_COUNT=0
FIXED_COUNT=0
FAILED_COUNT=0

# Cleanup on exit

trap "rm -rf $TEMP_DIR" EXIT

# Function to detect violations using ESLint

find_violations() {
echo -e "${BLUE}Scanning for route middleware violations...${NC}"

      # Run ESLint with the specific rule and capture violations
      # Using --format json for easier parsing
      npx eslint "$TARGET_DIR" \
          --ext .ts,.tsx \
          --rule "${ESLINT_RULE}: error" \
          --format json 2>/dev/null | \
          jq -r '.[] | select(.errorCount > 0) | .filePath' > "$VIOLATIONS_FILE" || true

      # Alternative approach if the above doesn't work - find all route.ts files
      # and check them individually
      if [ ! -s "$VIOLATIONS_FILE" ]; then
          find "$TARGET_DIR" -type f -name "route.ts" \
              ! -path "*/node_modules/*" \
              ! -path "*/.next/*" \
              ! -path "*/dist/*" \
              ! -path "*/build/*" | while read -r file; do
              # Check if file has middleware violations
              if npx eslint "$file" \
                  --rule "${ESLINT_RULE}: error" \
                  --format compact 2>&1 | grep -q "require-route-middleware"; then
                  echo "$file" >> "$VIOLATIONS_FILE"
              fi
          done
      fi

}

# Function to determine the appropriate middleware type based on route path

get_middleware_type() {
local filepath="$1"

      # Check for specific route patterns
      if [[ "$filepath" == *"/api/cron/"* ]]; then
          echo "cron"
      elif [[ "$filepath" == *"/api/webhooks/"* ]]; then
          echo "public"
      elif [[ "$filepath" == *"/api/admin/"* ]]; then
          echo "admin"
      elif [[ "$filepath" == *"/api/auth/"* ]] && [[ "$filepath" != *"/logout"* ]]; then
          echo "public"
      elif [[ "$filepath" == *"/api/health"* ]] || [[ "$filepath" == *"/api/echo"* ]]; then
          echo "public"
      elif [[ "$filepath" == *"factory-admin"* ]]; then
          echo "admin"
      else
          echo "authenticated"
      fi

}

# Function to process a single file

process_file() {
local filepath="$1"
      local filename=$(basename "$filepath")
      local middleware_type=$(get_middleware_type "$filepath")

      echo -e "${BLUE}Processing: $filepath${NC}"
      echo -e "  Detected type: $middleware_type middleware needed"

      # The AI prompt for adding middleware
      local prompt="Fix the middleware violations in $filepath by adding the appropriate middleware handler.

IMPORTANT CONTEXT:
This is a NextJS API route file that needs middleware added to each exported HTTP handler (GET, POST, PUT, DELETE, etc.).
The middleware must be the FIRST statement in each handler function.

Based on the route type ($middleware_type), use the appropriate middleware:

1. For 'authenticated' routes (require user login):
   \`\`\`typescript
   import { handleAuthenticatedMiddleware } from '@/app/api/\_utils/middleware';

export async function GET(req: NextRequest) {
return handleAuthenticatedMiddleware(req, async ({ req, user }) => {
// Existing route logic here
// 'user' is the authenticated UserRecord
return NextResponse.json({ data });
});
}
\`\`\`

2. For 'public' routes (no auth required):
   \`\`\`typescript
   import { handlePublicMiddleware } from '@/app/api/\_utils/middleware';

export async function POST(req: NextRequest) {
return handlePublicMiddleware(req, async (req) => {
// Existing route logic here
return NextResponse.json({ data });
});
}
\`\`\`

3. For 'cron' routes (require cron secret):
   \`\`\`typescript
   import { handleCronMiddleware } from '@/app/api/\_utils/middleware';

export async function POST(req: NextRequest) {
return handleCronMiddleware(req, async (req) => {
// Existing route logic here
return NextResponse.json({ success: true });
});
}
\`\`\`

4. For 'admin' routes (require admin role):
   \`\`\`typescript
   import { handleAuthenticatedMiddleware, AdminRole } from '@/app/api/\_utils/middleware';

export async function GET(req: NextRequest) {
return handleAuthenticatedMiddleware(
req,
async ({ req, user }) => {
// Existing route logic here
return NextResponse.json({ data });
},
{ requiredRole: AdminRole.ADMIN_1 }
);
}
\`\`\`

Additional options can be passed:

- \`context\`: String for error logging context
- \`requireCsrf\`: Boolean to enable CSRF validation
- \`requiredRole\`: AdminRole enum value for role-based access

INSTRUCTIONS:

1. Add the appropriate import for the middleware function if not present
2. Wrap the ENTIRE body of each exported HTTP handler with the middleware call
3. The middleware should return the result of the middleware function
4. Move ALL existing logic inside the middleware callback
5. Preserve all existing imports, types, and logic exactly as-is
6. If the handler already uses try-catch for error handling, you can remove it as the middleware handles errors
7. Ensure the callback parameters match the middleware type (some provide 'user', others just 'req')

Only modify the route handlers to add middleware. Return the complete fixed file."

      if [ "$DRY_RUN" = "true" ]; then
          echo -e "${YELLOW}  [DRY RUN] Would add $middleware_type middleware${NC}"
          return 0
      fi

      # Run droid to fix the middleware
      if droid exec --auto low "$prompt" 2>/dev/null; then
          # Verify the fix worked by running ESLint again
          if npx eslint "$filepath" \
              --rule "${ESLINT_RULE}: error" \
              --no-eslintrc \
              --plugin factory \
              --format compact 2>&1 | grep -q "require-route-middleware"; then
              echo -e "${RED}  ✗ Failed to fix all violations${NC}"
              ((FAILED_COUNT++))
          else
              echo -e "${GREEN}  ✓ Fixed middleware violations${NC}"
              ((FIXED_COUNT++))
          fi
          ((PROCESSED_COUNT++))
      else
          echo -e "${RED}  ✗ Failed to process${NC}"
          ((FAILED_COUNT++))
      fi

}

# Export function and variables for parallel execution

export -f process_file get_middleware_type
export DRY_RUN GREEN YELLOW BLUE RED NC ESLINT_RULE

# Main execution

echo -e "${BLUE}=== Droid Route Middleware Fix ===${NC}"
echo -e "${BLUE}Directory: $TARGET_DIR${NC}"
echo -e "${BLUE}Concurrency: $CONCURRENCY${NC}"
[ "$DRY_RUN" = "true" ] && echo -e "${YELLOW}DRY RUN MODE${NC}"
echo ""

# Find violations

find_violations

VIOLATION_COUNT=$(wc -l < "$VIOLATIONS_FILE" 2>/dev/null | tr -d ' ' || echo 0)

if [ "$VIOLATION_COUNT" -eq 0 ]; then
echo -e "${GREEN}No middleware violations found!${NC}"
exit 0
fi

echo -e "${YELLOW}Found $VIOLATION_COUNT files with middleware violations${NC}\n"

# Process files in parallel

cat "$VIOLATIONS_FILE" | xargs -n 1 -P "$CONCURRENCY" -I {} bash -c 'process*file "$@"' * {}

# Show summary

echo -e "\n${BLUE}=== Summary ===${NC}"
echo -e "${GREEN}Files processed: $PROCESSED_COUNT${NC}"
if [ "$DRY_RUN" = "false" ]; then
echo -e "${GREEN}Files fixed: $FIXED_COUNT${NC}"
[ "$FAILED_COUNT" -gt 0 ] && echo -e "${RED}Files failed: $FAILED_COUNT${NC}"
fi

if [ "$DRY_RUN" = "false" ] && [ "$FIXED_COUNT" -gt 0 ]; then
echo -e "\n${BLUE}Next steps:${NC}"
echo " npm run lint # Verify all violations are fixed"
echo " npm run typecheck # Check TypeScript compilation"
echo " npm run test # Run tests"
echo " git diff # Review changes"
echo " git add -A # Stage changes"
echo " git commit -m 'fix: add required middleware to API routes'"
fi

# Exit with error if some files failed

[ "$FAILED_COUNT" -gt 0 ] && exit 1
exit 0

````
</Accordion>

<Warning>
**Critical for Success**: When customizing this script for your own lint rules, always include concrete before/after examples in the prompt you give to Droid Exec. This dramatically improves accuracy.

Good prompt structure:

1. Describe the violation to fix
2. Show a "before" code example with the violation
3. Show an "after" code example with the fix applied
4. List any edge cases or patterns to preserve

The more specific your examples, the better Droid will understand and implement the fix pattern.
</Warning>

## Prerequisites

Before you begin, ensure you have completed the [Droid Exec installation](/cli/droid-exec/overview#installation)

## Basic usage

### Preview violations (dry run)

<Warning>
Always start with a dry run to see which files need fixing before making changes.
</Warning>

The dry run shows you which files violate the middleware rule and what type of middleware would be added:

```bash  theme={null}
# Preview what would happen (no changes made)
DRY_RUN=true ./droid-fix-route-middleware.sh apps/factory-admin/src/app/api

# Example output:
# === Droid Route Middleware Fix ===
# Directory: apps/factory-admin/src/app/api
# Concurrency: 5
# DRY RUN MODE
#
# Scanning for route middleware violations...
# Found 3 files with middleware violations
#
# Processing: apps/factory-admin/src/app/api/health/route.ts
#   Detected type: public middleware needed
#   [DRY RUN] Would add public middleware
# Processing: apps/factory-admin/src/app/api/orgs/route.ts
#   Detected type: admin middleware needed
#   [DRY RUN] Would add admin middleware
# Processing: apps/factory-admin/src/app/api/cron/batch-friction/poll-and-report/route.ts
#   Detected type: cron middleware needed
#   [DRY RUN] Would add cron middleware
#
# === Summary ===
# Files processed: 0
````

**How dry run works:**

- When `DRY_RUN=true`: Identifies violations and shows what middleware type would be added
- When `DRY_RUN=false` (default): Actually fixes the violations by adding middleware

This helps you:

- Understand which routes are missing middleware
- Verify the correct middleware type will be used
- Estimate the scope of changes

### Apply fixes

Once ready, run the actual fix:

```bash theme={null}
# Fix all violations in a directory
./droid-fix-route-middleware.sh apps/factory-admin/src/app/api

# Example output:
# === Droid Route Middleware Fix ===
# Directory: apps/factory-admin/src/app/api
# Concurrency: 5
#
# Scanning for route middleware violations...
# Found 3 files with middleware violations
#
# Processing: apps/factory-admin/src/app/api/health/route.ts
#   Detected type: public middleware needed
# Processing: apps/factory-admin/src/app/api/cron/batch-friction/poll-and-report/route.ts
#   Detected type: cron middleware needed
# Processing: apps/factory-admin/src/app/api/orgs/route.ts
#   Detected type: admin middleware needed
# ✓ Fixed middleware violations
# ✓ Fixed middleware violations
# ✓ Fixed middleware violations
```

## Real-world transformations

### Example 1: Simple GET Handler

<Tabs>
  <Tab title="Before">
    <Note>Missing middleware - no authentication check!</Note>

    ```typescript  theme={null}
    // apps/factory-app/src/app/api/sessions/route.ts
    import { NextRequest, NextResponse } from 'next/server';
    import { getFirestoreInstance } from '@factory/services/firebase/admin';

    export async function GET(req: NextRequest) {
      const searchParams = req.nextUrl.searchParams;
      const userId = searchParams.get('userId');

      ...

      return NextResponse.json({
        sessions: sessions.docs.map(doc => doc.data())
      });
    }
    ```

  </Tab>

  <Tab title="After">
    <Note>Now properly authenticated with access to user object</Note>

    ```typescript  theme={null}
    // apps/factory-app/src/app/api/sessions/route.ts
    import { NextRequest, NextResponse } from 'next/server';
    import { getFirestoreInstance } from '@factory/services/firebase/admin';
    import { handleAuthenticatedMiddleware } from '@/app/api/_utils/middleware';

    export async function GET(req: NextRequest) {
      return handleAuthenticatedMiddleware(req, async ({ req, user }) => {
        const searchParams = req.nextUrl.searchParams;
        const userId = searchParams.get('userId');

        ...

        return NextResponse.json({
          sessions: sessions.docs.map(doc => doc.data())
        });
      });
    }
    ```

  </Tab>
</Tabs>

### Example 2: Cron Job Handler

<Tabs>
  <Tab title="Before">
    <Note>Cron job without authorization - anyone could trigger it!</Note>

    ```typescript  theme={null}
    // apps/factory-admin/src/app/api/cron/batch-friction/poll-and-report/route.ts
    export async function GET(request: NextRequest) {

      logInfo('[poll-report] Starting poll and report workflow');

      const results = {
        polledBatches: 0,
        processedBatches: 0,
        failedBatches: [],
        reportGenerated: false,
        reportError: null,
      };

      // ... rest of the cron job logic ...

      return NextResponse.json({
        success,
        message,
        summary: {
          processedBatches: results.processedBatches,
          failedBatches: results.failedBatches.length,
          reportGenerated: results.reportGenerated,
        },
      });
    }
    ```

  </Tab>

  <Tab title="After">
    <Note>Now protected by cron secret, entire handler wrapped in middleware</Note>

    ```typescript  theme={null}
    // apps/factory-admin/src/app/api/cron/batch-friction/poll-and-report/route.ts
    export async function GET(request: NextRequest) {
      return handleCronMiddleware(request, async (req) => {
        logInfo('[poll-report] Starting poll and report workflow');

        const results = {
          polledBatches: 0,
          processedBatches: 0,
          failedBatches: [],
          reportGenerated: false,
          reportError: null,
        };

        // ... rest of the cron job logic ...

        return NextResponse.json({
          success,
          message,
          summary: {
            processedBatches: results.processedBatches,
            failedBatches: results.failedBatches.length,
            reportGenerated: results.reportGenerated,
          },
        });
      });
    }
    ```

  </Tab>
</Tabs>

## Best practices

<Note>
  Follow these best practices for safe and effective middleware addition.
</Note>

<Steps>
  <Step title="Start with dry run">
    Preview changes before applying:

    ```bash  theme={null}
    # See what would be fixed without making changes
    DRY_RUN=true ./droid-fix-route-middleware.sh apps
    ```

  </Step>

  <Step title="Process by app">
    Fix one application at a time for easier review:

    ```bash  theme={null}
    # Fix factory-app routes
    ./droid-fix-route-middleware.sh apps/factory-app
    npm run typecheck -- --filter=factory-app
    git add -A && git commit -m "fix(factory-app): add required middleware to API routes"

    # Fix factory-admin routes
    ./droid-fix-route-middleware.sh apps/factory-admin
    npm run typecheck -- --filter=factory-admin
    git add -A && git commit -m "fix(factory-admin): add required middleware to API routes"
    ```

  </Step>
</Steps>
# AGENTS.md

> Teach agents everything they need to know about your project with a single Markdown file.

## 1 · What is **AGENTS.md**?

**AGENTS.md** is a Markdown file that lives in your repository (or home directory) and acts as a _briefing packet_ for AI coding agents.

### Why AGENTS.md?

**README.md** files are for humans: quick starts, project descriptions, and contribution guidelines.

**AGENTS.md** complements this by containing the extra, sometimes detailed context coding agents need: build steps, tests, and conventions that might clutter a README or aren't relevant to human contributors.

We intentionally kept it separate to:

- Give agents a clear, predictable place for instructions
- Keep READMEs concise and focused on human contributors
- Provide precise, agent-focused guidance that complements existing README and docs

### What it contains:

- Describes how to **build, test, and run** your project
- Explains architectural patterns and conventions
- Lists external services, environment variables, or design docs
- Provides domain-specific vocabulary and code style rules

Agents read AGENTS.md _before_ planning any change, giving them the same tribal knowledge senior engineers already carry in their heads.

---

## 2 · One AGENTS.md works across many agents

Your AGENTS.md file is compatible with a growing ecosystem of AI coding agents and tools, including:

- **Factory Droid** - Factory's AI coding agent
- **Cursor** - AI-powered code editor
- **Aider** - AI pair programming in your terminal
- **Gemini CLI** - Google's command-line AI assistant
- **Jules** - Google's coding assistant
- **Codex** - OpenAI's code generation model
- **Zed** - AI-enhanced editor
- **Phoenix** - AI development platform
- And many more emerging tools

Rather than introducing another proprietary file format, AGENTS.md uses a standard that works across the entire AI development ecosystem.

---

## 3 · File locations & discovery hierarchy

Agents look for AGENTS.md in this order (first match wins):

1. `./AGENTS.md` in the **current working directory**
2. The nearest parent directory up to the repo root
3. Any `AGENTS.md` in sub-folders the agent is working inside
4. Personal override: `~/.factory/AGENTS.md`

<Note>
  Multiple files can coexist. The closer one to the file being edited takes
  precedence.
</Note>

---

## 4 · File structure & syntax

AGENTS.md is plain Markdown; headings provide semantic hints.

```md theme={null}
# Build & Test ← exact commands for compiling and testing

# Architecture Overview ← short description of major modules

# Security ← auth flows, API keys, sensitive data

# Git Workflows ← branching, commit conventions, PR requirements

# Conventions & Patterns ← naming, folder layout, code style
```

Agents recognize:

- **Top-level headings** (`#`) as sections
- **Bullet lists** for commands or rules
- **Inline code** (`` ` ``) for exact commands, filenames, env vars
- **Links** to external docs (GitHub, Figma, Confluence…)

---

## 5 · Common sections

| Section                    | Purpose                                                       |
| -------------------------- | ------------------------------------------------------------- |
| **Build & Test**           | Exact commands for compiling and running the test suite.      |
| **Architecture Overview**  | One-paragraph summary of major modules and data flow.         |
| **Security**               | API keys, endpoints, auth flows, rate limits, sensitive data. |
| **Git Workflows**          | Branching strategy, commit conventions, PR requirements.      |
| **Conventions & Patterns** | Folder structure, naming patterns, code style, lint rules.    |

Include only what _future you_ will care about—brevity beats encyclopaedia-length files.

---

## 6 · Templates & examples

### Factory-style comprehensive example

```md theme={null}
# MyProject

This is an overview of My Project. It's an example app used to highlight AGENTS.md files utility.

## Core Commands

• Type-check and lint: `pnpm check`
• Auto-fix style: `pnpm check:fix`
• Run full test suite: `pnpm test --run --no-color`
• Run a single test file: `pnpm test --run <path>.test.ts`
• Start dev servers (frontend + backend): `pnpm dev`
• Build for production: `pnpm build` then `pnpm preview`

All other scripts wrap these six tasks.

## Project Layout

├─ client/ → React + Vite frontend
├─ server/ → Express backend

• Frontend code lives **only** in `client/`
• Backend code lives **only** in `server/`
• Shared, environment-agnostic helpers belong in `src/`

## Development Patterns & Constraints

Coding style
• TypeScript strict mode, single quotes, trailing commas, no semicolons.
• 100-char line limit, tabs for indent (2-space YAML/JSON/MD).
• Use interfaces for public APIs; avoid `@ts-ignore`.
• Tests first when fixing logic bugs.
• Visual diff loop for UI tweaks.
• Never introduce new runtime deps without explanation in PR description.

## Git Workflow Essentials

1. Branch from `main` with a descriptive name: `feature/<slug>` or `bugfix/<slug>`.
2. Run `pnpm check` locally **before** committing.
3. Force pushes **allowed only** on your feature branch using
   `git push --force-with-lease`. Never force-push `main`.
4. Keep commits atomic; prefer checkpoints (`feat: …`, `test: …`).

## Evidence Required for Every PR

A pull request is reviewable when it includes:

- All tests green (`pnpm test`)
- Lint & type check pass (`pnpm check`)
- Diff confined to agreed paths (see section 2)
- **Proof artifact**
  • Bug fix → failing test added first, now passes
  • Feature → new tests or visual snapshot demonstrating behavior
- One-paragraph commit / PR description covering intent & root cause
- No drop in coverage, no unexplained runtime deps
```

### Node + React monorepo

```md theme={null}
# Build & Test

- Build: `npm run build`
- Test: `npm run test -- --runInBand`

# Run Locally

- API: `npm run dev --workspace=api`
- Web: `npm run dev --workspace=web`
- Storybook: `npm run storybook`

# Conventions

- All backend code in `packages/api/src`
- React components in `packages/web/src/components`
- Use `zod` for request validation

# Architecture Overview

The API is GraphQL (Apollo). Web uses Next.js with SSR.

# External Services

- Stripe for payments (`STRIPE_KEY`)
- S3 for uploads (`AWS_BUCKET`)

# Gotchas

- Test snapshot paths are absolute—run `npm run test -- --updateSnapshot` after refactors.
```

### Python microservice

```md theme={null}
# Build & Test

- Build: `pip install -e .`
- Test: `pytest`

# Run Locally

- `uvicorn app.main:app --reload`

# Conventions

- Config via Pydantic settings (`settings.py`)
- CELERY tasks live in `tasks/`
```

---

## 7 · Best practices

<AccordionGroup>
  <Accordion title="Keep it short">
    Aim for **≤ 150 lines**. Long files slow the agent and bury signal.
  </Accordion>

{" "}

  <Accordion title="Use concrete commands">
    Wrap commands in back-ticks so agents can copy-paste without guessing.
  </Accordion>

{" "}

  <Accordion title="Update alongside code">
    Treat AGENTS.md like code—PR reviewers should nudge updates when build steps
    change.
  </Accordion>

{" "}

  <Accordion title="One source of truth">
    Avoid duplicate docs; link to READMEs or design docs instead of pasting them.
  </Accordion>

{" "}

  <Accordion title="Make requests precise">
    The more precise your guidance for the task at hand, the more likely the agent
    is to accomplish that task to your liking.
  </Accordion>

  <Accordion title="Verify before merging">
    Require objective proof: tests, lint, type check, and a diff confined to agreed paths.
  </Accordion>
</AccordionGroup>

---

## 8 · How agents use AGENTS.md

<Steps>
  <Step title="Ingestion">
    On task start, agents load the nearest AGENTS.md into their context window.
  </Step>

  <Step title="Planning">
    Build/test commands are used to form the execution plan (e.g. run tests
    after edits).
  </Step>

  <Step title="Tool selection">
    Folder and naming conventions steer tools like `edit_file` and
    `create_file`.
  </Step>

  <Step title="Validation">
    Gotchas and domain vocabulary improve reasoning and reduce hallucinations.
  </Step>
</Steps>

---

## 9 · When things go wrong

Like any development work, agent tasks sometimes need course correction when scope creeps or assumptions prove wrong. The same iteration patterns that work with human collaborators apply here.

### Warning signs of agent drift:

- Plans that rewrite themselves mid-execution
- Edits outside the declared paths
- Fixes claimed without failing tests to prove they work
- Diffs bloated with unrelated changes

### Recovery playbook:

1. **Tighten the spec**: Narrow the directory or tests the agent may touch
2. **Salvage the good**: Keep valid artifacts such as a failing test; revert noisy edits
3. **Restart clean**: Launch a fresh session with improved instructions
4. **Take over**: When you can tell the agent is failing, pair program the final changes

---

## 10 · Getting started

<CardGroup cols={2}>
  <Card title="Specification Mode" icon="list-check" href="/cli/user-guides/specification-mode">
    Specs + AGENTS.md = instant context for new features.
  </Card>

  <Card title="Auto-Run" icon="forward" href="/cli/user-guides/auto-run">
    Reliable automation depends on accurate build & test commands.
  </Card>
</CardGroup>

### Summary

1. Add **AGENTS.md** at your repo root (and optionally submodules).
2. Document build/test commands, conventions, and gotchas—_concise & actionable_.
3. Agents read it automatically; no extra flags required.

Pick one modest bug or small feature from your backlog. Write three clear sentences that state where to begin, how to reproduce the issue, and what proof signals completion. Run the agent through Explore → Plan → Code → Verify, review the evidence, and merge.

Ship faster with fewer surprises—give your agent the playbook it needs!

# Custom Droids (Subagents)

> Create specialized subagents with their own prompts, tool access, and models that droid can delegate work to.

Custom droids are reusable subagents defined in Markdown. Each droid carries its own system prompt, model preference, and tooling policy so you can hand off focused tasks—like code review, security checks, or research—without re-typing instructions.

<Warning>
  Custom Droids are experimental. You must enable them in settings before they
  will be picked up.
</Warning>

---

## 1 · What are custom droids?

Custom droids live as `.md` files under either your project’s `.factory/droids/` or your personal `~/.factory/droids/` directory. When enabled, the CLI scans these folders (top-level files only), validates each definition, and exposes them as `subagent_type` targets for the **Task** tool. This lets the primary assistant spin up purpose-built helpers mid-session.

- **Project droids** sit in `<repo>/.factory/droids/` and are shared with teammates.
- **Personal droids** live in `~/.factory/droids/` and follow you across workspaces.
- Project definitions override personal ones when the names match.

---

## 2 · Why use them?

- **Faster delegation** – encode complex checklists once and reuse them with a single tool call.
- **Stricter safety** – limit an agent to read-only, edit-only, or curated tool sets.
- **Context isolation** – each subagent runs with a fresh context window, avoiding prompt bloat.
- **Repeatable reviews** – capture team-specific review, testing, or release gates as code you can version.

---

## 3 · Quick start

1. Open **Settings** (`Shift+Tab` → **Settings**) and toggle **Custom Droids** under the _Experimental_ section. This persists `"enableCustomDroids"` in `~/.factory/settings.json` and registers the Task tool.
2. Run `/droids` to launch the Droids menu.
3. Choose **Create a new Droid**, pick a storage location (project or personal), then follow the wizard to set an identifier, system prompt, tools, and model.
4. Save. The CLI writes `<name>.md` into the chosen `droids/` directory and normalizes the filename (lowercase, hyphenated).
5. Ask droid to use it, e.g. “Run the Task tool with subagent `code-reviewer` to review this diff,” or trigger it from automation.

The loader caches scans for \~5 seconds. The current UI instantiates a fresh loader on every open, so changes usually show up on the next visit; a long-running watch is not yet enabled by default.

---

## 4 · Configuration

Each droid file is Markdown with YAML frontmatter.

```md theme={null}
---
name: code-reviewer
description: Focused reviewer that checks diffs for correctness risks
model: claude-opus-4-1-20250805 # or claude-sonnet-4-20250514, gpt-5-2025-08-07, inherit
tools: read-only # all | read-only | edit | execution | web | mcp | ["Read", "Edit", ...]
version: v1
---

You are the team’s senior reviewer. Examine the diff the parent agent shares and:

- flag correctness, security, and migration risks
- list targeted follow-up tasks if changes are required
- confirm tests or manual validation needed before merge

Respond with:
Summary: <one-line finding>
Findings:

- <bullet>
- <bullet>
```

Key metadata fields:

| Field                   | Notes                                                                                                                                                                             |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`                  | Required. Lowercase letters, digits, `-`, `_`. Drives the `subagent_type` value and filename.                                                                                     |
| `description`           | Optional. Shown in the UI list. Keep ≤500 chars.                                                                                                                                  |
| `model`                 | `claude-opus-4-1-20250805`, `claude-sonnet-4-20250514`, `gpt-5-2025-08-07`, or `inherit` (use the parent session’s model). The validator rejects other strings.                   |
| `tools`                 | `all`, a category (`read-only`, `edit`, `execution`, `web`, `mcp`), or an explicit list of tool IDs (e.g. `"Read"`, `"Execute"`). Default is `all`, which enables every CLI tool. |
| `createdAt`/`updatedAt` | Auto-filled when using the wizard; optional otherwise.                                                                                                                            |
| `version`               | Optional string to track revisions.                                                                                                                                               |

Prompts must start with YAML frontmatter containing at least `name` and include a non-empty body. `DroidValidator` surfaces errors (invalid names, unknown models, unknown tools) and warnings (missing description, duplicated tools, unrestricted `all`). Validation issues appear in the CLI logs when a file fails to load.

### Tool categories → concrete tools

| Category    | Tools granted (LLM IDs)                  |
| ----------- | ---------------------------------------- |
| `read-only` | `Read`, `Grep`, `Glob`, `LS`             |
| `edit`      | `Edit`, `MultiEdit`, `Create`            |
| `execution` | `Execute`                                |
| `web`       | `WebSearch`, `FetchUrl`                  |
| `mcp`       | Dynamically populated MCP tools (if any) |

Explicit arrays must use the tool names above (case-sensitive). Unknown names cause validation errors.

---

## 5 · Managing droids in the UI

`/droids` opens a modal with:

- **Create a new Droid** – launches the guided flow above.
- **List of droids** – shows name, summary, and location badge (Project / Personal).
- Selecting a droid lets you **View**, **Edit**, **Delete**, or go **Back**.

The “Generate from description” flow in the creator is stubbed today—it seeds placeholder content while the generation pipeline is under construction.

---

## 6 · Using custom droids effectively

- **Invoke via the Task tool** – when custom droids are enabled, the droid may call it autonomously, or you can request it directly (“Use the subagent `security-auditor` on this change”).
- **Switch models intentionally** – the subagent respects the `model` field. Use `inherit` when you want it to follow the parent session’s active provider and reasoning effort.
- **Limit tool access** – prefer categories (e.g. `read-only`) or explicit lists so the subagent can’t execute unexpected shell commands.
- **Version in git** – check `.factory/droids/*.md` into your repo to share prompts and review changes like code.

Structuring the prompt to emit sections like `Summary:` and `Findings:` helps the Task tool UI summarize results.

---

## 7 · Examples

### Code reviewer (project scope)

```md theme={null}
---
name: code-reviewer
description: Reviews diffs for correctness, tests, and migration fallout
model: claude-opus-4-1-20250805
tools: read-only
---

You are the team’s principal reviewer. Given the diff and context:

- Summarize the intent of the change.
- Flag correctness risks, missing tests, or rollback hazards.
- Call out any migrations or data changes that need coordination.

Reply with:
Summary: <one-line>
Findings:

- <issue or ✅ No blockers>
  Follow-up:
- <action or leave blank>
```

Use: “Run the subagent `code-reviewer` on the staged diff.”

### Security sweeper (personal scope)

```md theme={null}
---
name: security-sweeper
description: Looks for insecure patterns in recently edited files
model: gpt-5-2025-08-07
tools:
  - Read
  - Grep
  - WebSearch
---

Investigate the files referenced in the prompt for security issues:

- Identify injection, insecure transport, privilege escalation, or secrets exposure.
- Suggest concrete mitigations.
- Link to relevant CWE or internal standards when helpful.

Respond with:
Summary: <headline>
Findings:

- <file>: <issue>
  Mitigations:
- <recommendation>
```

---

With custom droids, you capture tribal knowledge as code. Compose specialized prompts once, assign the right tools, and let the primary assistant delegate heavy lifts to the subagents you design.

# Implementing Large Features

> A systematic approach to tackling complex, multi-phase development projects using specification planning and iterative implementation.

Large-scale features require careful planning and systematic execution to avoid overwhelming complexity. This guide outlines a proven workflow for breaking down massive projects into manageable phases, using specification mode for planning and iterative implementation with frequent validation.

<CardGroup cols={2}>
  <Card title="Systematic Planning" icon="map">
    Break complex features into discrete, manageable phases with clear
    boundaries
  </Card>

  <Card title="Incremental Progress" icon="stairs">
    Implement one phase at a time with validation and testing at each step
  </Card>

  <Card title="Version Control Strategy" icon="code-branch">
    Use git commits and PRs to track progress and enable safe rollbacks
  </Card>

  <Card title="Continuous Validation" icon="check-circle">
    Test functionality incrementally rather than waiting until the end
  </Card>
</CardGroup>

## When to use this workflow

This approach is ideal for:

**Massive refactors** - Touching 100+ files across your entire codebase

```
"Migrate from REST API to GraphQL across all frontend components"
```

**Major component migrations** - Replacing core system dependencies

```
"Switch from Stripe to a new billing provider across the entire payment system"
```

**Large feature implementations** - New functionality spanning 30+ files

```
"Add comprehensive user roles and permissions system to the existing application"
```

## The workflow

<Steps>
  <Step title="Create the master plan">
    Use Specification Mode to create comprehensive documentation breaking the
    project into major phases.
  </Step>

  <Step title="Phase-by-phase implementation">
    Start new sessions for each phase, referencing the master plan document.
  </Step>

  <Step title="Frequent commits and PRs">
    Create git commits and pull requests corresponding to each completed phase.
  </Step>

  <Step title="Incremental validation">
    Test and validate functionality after each phase rather than at the end.
  </Step>

  <Step title="Update the plan">
    Mark completed phases and adjust remaining work based on learnings.
  </Step>
</Steps>

## Phase 1: Master planning with Specification Mode

Start by using **Shift+Tab** to enter Specification Mode and create a comprehensive breakdown:

**Example prompt:**

```
Create a detailed implementation plan for migrating our entire authentication system
from Firebase Auth to Auth0. This affects user login, registration, session management,
role-based access control, and integrations across 50+ components.

Break this into major phases that can be implemented independently with clear
testing and validation points. Each phase should be completable in 1-2 days
and have minimal dependencies on other phases.
```

**Specification Mode will generate:**

- **Phase breakdown** - 4-6 major implementation phases
- **Dependencies mapping** - Which phases must be completed before others
- **Testing strategy** - How to validate each phase works correctly
- **Risk assessment** - Potential issues and mitigation strategies
- **Rollback plan** - How to safely revert if needed

**Save the plan** - Approve the specification and save it as `IMPLEMENTATION_PLAN.md` in your project root.

## Phase 2: Iterative implementation

For each phase in your plan:

### Start a fresh session

Begin each phase with a new droid session to maintain focus and clean context.

### Reference the master plan

**Example prompt for Phase 1:**

```
I'm implementing Phase 1 of the authentication migration plan documented in
IMPLEMENTATION_PLAN.md.

Phase 1 focuses on setting up Auth0 configuration and creating the basic
authentication service without affecting existing Firebase integration.

Please read the plan document and implement this phase, then update the
document to mark Phase 1 as complete.
```

### Use Specification Mode for complex phases

For phases involving significant changes, use **Shift+Tab** to get detailed planning:

```
Following IMPLEMENTATION_PLAN.md, implement Phase 3: Update all login components
to use the new Auth0 service while maintaining backward compatibility with
the existing Firebase auth as fallback.
```

### Commit frequently

After each phase completion, ask Droid to commit your changes:

```
Commit all changes for Phase 1 of the auth migration with a detailed message.
```

```
Create a commit for the Auth0 service setup work with bullet points for each major change.
```

Droid will stage all changes and create the commit with proper co-authorship attribution.

### Create phase-specific PRs

Ask Droid to create pull requests for each completed phase:

```
Create a PR for the auth migration Phase 1 work on a new branch called auth-migration-phase-1.
```

```
Open a pull request with a comprehensive description of what was completed and testing done.
```

Droid will create the branch, push the changes, and generate a detailed PR description based on the commits and changes made.

## Phase 3: Validation and testing strategy

### Test each phase independently

Don't wait until the end - validate functionality after each phase:

**Phase 1 completion:**

```
Run the authentication tests and verify the Auth0 service works in isolation.
Test user registration, login, and logout with the new service.
```

**Phase 2 completion:**

```
Test the migration script with a subset of test users. Verify data integrity
and that users can log in with both old and new systems.
```

### Use feature flags for gradual rollout

```
Add a feature flag for auth0-migration with 10% rollout that can be controlled by environment variable.
```

```
Implement progressive rollout logic using feature flags to gradually migrate users from Firebase to Auth0.
```

### Automated testing at phase boundaries

```
Run the full test suite after each phase including unit, integration, and e2e tests.
```

```
Set up automated testing that validates auth migration functionality at each phase boundary.
```

## Best practices

**Start with read-only changes** - Begin phases with analysis and preparation before making modifications.

**Maintain backward compatibility** - Keep old systems working while new ones are being built.

**Use feature toggles** - Allow gradual rollout and quick rollback if needed.

**Document learnings** - Update your plan based on discoveries during implementation.

**Test boundary conditions** - Focus testing on the interfaces between old and new systems.

**Plan for rollback** - Each phase should be reversible if critical issues are discovered.

**Communicate progress** - Keep stakeholders updated with regular progress reports.

## Recovery strategies

If a phase encounters major issues:

1. **Immediate rollback** - Use git to revert to the last stable state
2. **Issue analysis** - Document what went wrong and why
3. **Plan adjustment** - Update remaining phases based on learnings
4. **Stakeholder communication** - Update timelines and expectations

The systematic approach ensures large features are delivered reliably while maintaining code quality and system stability throughout the process.

Ready to tackle your next large-scale feature? Start with **Shift+Tab** to create your master implementation plan!

# Specification Mode

> Turn plain-English specifications into production-ready code with automatic planning and review.

Specification Mode transforms simple feature descriptions into working code with automatic planning and safety checks. You provide a brief description of what you want, and droid creates a detailed specification and implementation plan before making any changes.

<CardGroup cols={2}>
  <Card title="Simple Input" icon="message">
    Just 4-6 sentences describing what you want built
  </Card>

  <Card title="Automatic Planning" icon="list-check">
    Droid creates detailed specs and implementation plans
  </Card>

  <Card title="Safe Execution" icon="shield-check">
    No code changes until you approve the complete plan
  </Card>

  <Card title="Enterprise Ready" icon="building">
    Built-in security, compliance, and team standards
  </Card>
</CardGroup>

## How it works

<Steps>
  <Step title="Describe your feature">
    Provide a simple description in 4-6 sentences. No need to write formal
    specifications.
  </Step>

  <Step title="Droid creates the spec">
    Droid analyzes your request and generates a complete specification with
    acceptance criteria, implementation plan, and technical details.
  </Step>

  <Step title="Review and approve">
    You review the generated specification and implementation plan. Request
    changes or approve as-is.
  </Step>

  <Step title="Implementation">
    Only after approval does droid begin making actual code changes, showing
    each modification for review.
  </Step>
</Steps>

## Example workflow

**Your input:**

```
Add a feature for users to export their personal data.
It should create a ZIP file with their profile, posts, and uploaded files.
Send them an email when it's ready. Make sure it follows GDPR requirements.
The export should work for accounts up to 2GB of data.
```

**Droid generates:**

- Complete specification with detailed acceptance criteria
- Technical implementation plan covering backend, frontend, and email
- File-by-file breakdown of changes needed
- Testing strategy and verification steps
- Security and compliance considerations

**You approve, then droid implements** the complete solution while showing each change for review.

<Note>
  Specification Mode must be manually activated using **Shift+Tab** in the CLI.
  It does not automatically activate.
</Note>

## How to activate Specification Mode

To enter Specification Mode, press **Shift+Tab** while in the CLI. This will enable the specification planning workflow for your next request.

## What happens during planning

**Analysis phase (read-only):**

- Examines your existing codebase and patterns
- Reviews related files and dependencies
- Studies your AGENTS.md conventions
- Gathers context from external sources

**Planning phase:**

- Develops comprehensive implementation strategy
- Identifies all files that need changes
- Plans sequence of modifications
- Considers testing and verification steps

**Safety guarantees:**

- Cannot edit files during analysis
- Cannot run commands that modify anything
- Cannot create, delete, or move files
- All exploration is read-only until you approve

## Writing effective requests

**Focus on outcomes:** Describe what the software should accomplish, not how to build it.

```
Users need to be able to reset their passwords using email verification.
The reset link should expire after 24 hours for security.
Include rate limiting to prevent abuse.
```

**Include important constraints:**

```
Add user data export functionality that works for accounts up to 5GB.
Must comply with GDPR and include audit logging.
Should complete within 10 minutes and not impact application performance.
```

**Reference existing patterns:**

```
Add a notification system similar to how we handle email confirmations.
Use the same background job pattern as our existing report generation.
Follow the authentication patterns we use for other sensitive operations.
```

**Be specific about verification:** Tell droid how to confirm the implementation works correctly.

**Consider the full user journey:** Describe the complete experience, not just technical requirements.

**Include error scenarios:** Specify how failures should be handled and communicated to users.

**Think about scale:** Mention performance requirements and expected usage patterns.

## Enterprise integration

Reference external requirements by pasting links:

```
Implement the user management features described in this Jira ticket:
https://company.atlassian.net/browse/PROJ-123

Follow our security standards and include comprehensive error handling.
```

If you've integrated platforms through Factory's dashboard, droid can read context from tickets, documents, and specs during analysis.

## Benefits

<CardGroup cols={2}>
  <Card title="Safety First" icon="shield-check">
    No accidental changes during exploration. See the complete plan before any
    modifications.
  </Card>

  <Card title="Thorough Planning" icon="brain">
    Comprehensive analysis leads to better architecture decisions and fewer
    surprises.
  </Card>

  <Card title="Full Control" icon="eye">
    Complete visibility into what will be done before any code changes happen.
  </Card>

  <Card title="Better Outcomes" icon="trophy">
    Well-planned implementations are more likely to be correct, complete, and
    maintainable.
  </Card>
</CardGroup>

## AGENTS.md integration

Document your project conventions to enhance Specification Mode's planning. See [AGENTS.md](/cli/configuration/agents-md) for more information.

Specification Mode automatically incorporates these conventions, ensuring consistency with your team's standards.

## Breaking down large features

For complex features spanning multiple components, break them into focused phases:

**Phase 1:**

```
Implement user data export backend API and job processing.
Focus only on the server-side functionality, not the UI yet.
```

**Phase 2:**

```
Add the frontend UI for data export using the API from Phase 1.
Include progress indicators and download management.
```

This approach allows you to validate each phase before proceeding to the next.

## Specification approval options

After droid presents the specification, choose how to continue:

1. **Proceed with implementation** – Approve the plan and keep normal (manual) execution controls.
2. **Proceed, and allow file edits and read-only commands (Low)** – Enable low autonomy auto-run so droid can edit files and run safe read-only commands automatically.
3. **Proceed, and allow reversible commands (Medium)** – Enable medium autonomy auto-run so droid can also run reversible commands without additional prompts.
4. **Proceed, and allow all commands (High)** – Enable high autonomy auto-run for fully automated execution, including commands that are not easily reversible.
5. **No, keep iterating on spec** – Stay in Specification Mode to refine the plan before implementation.

Selecting any auto-run option sets the corresponding autonomy level for the rest of the session. Choosing to keep iterating leaves Specification Mode active so you can continue shaping the plan.

## Saving your specifications as Markdown

Specification Mode can automatically write the approved plan to disk. Open the CLI settings and enable **Save spec as Markdown** to turn this on.

- By default, plans are saved to `.factory/docs` inside the nearest project-level `.factory` directory. If none exists, the CLI falls back to `~/.factory/docs` in your home directory.
- Use the **Spec save directory** setting to pick between the project directory, your home directory, or a custom path. Custom values support absolute paths, `~` expansion, `.factory/...` shortcuts, and relative paths from the current workspace.
- The CLI creates the target directory if it does not exist and writes the Markdown exactly as shown in the approval dialog.
- Files are named `YYYY-MM-DD-slug.md`, where the slug comes from the spec title or first heading, and a counter is appended if a file with the same name already exists.

## What happens after approval

Once you approve a specification plan, droid systematically implements the changes while showing each modification for review. You maintain full control through the approval workflow, ensuring quality and alignment with requirements.

For simpler changes that don't need comprehensive planning, droid can proceed directly while still showing all modifications for approval.

Ready to try Specification Mode? Start with a simple description of what you want to build, and let droid handle the specification and planning complexity.
