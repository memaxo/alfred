# harbor-stage2

Owner: runtime

### Purpose

Stage 2 scaffolding: generate **Harbor task directories** that run **ALFRED** inside the task container, producing an **ATIF `trajectory.json`** and a **reward** file so Harbor can drive trials/jobs.

### What's in place

- **Workflow runner CLI (ALFRED)**: `bun workflow:run`
  - Runs a workflow from a `--requirement` in a `--workspace`.
  - Writes ATIF to `--outTrajectory` even when the run fails (useful for evaluation/debugging).
- **Harbor task generator (ALFRED)**: `bun harbor:gen`
  - Emits a Harbor-compatible task directory:
    - `task.toml`
    - `instruction.md`
    - `environment/Dockerfile`
    - `agents/alfred.sh` (Harbor agent adapter that invokes `bun workflow:run`)
    - `solution/solve.sh` (oracle implementation - must always pass)
    - `tests/test.sh` (runs verifier command + writes `/logs/verifier/reward.txt`)
    - `workspace/` placeholder (replace with a real repo snapshot)
- **Dataset generator**: `bun harbor:dataset <outDir>`
  - Generates multiple deterministic tasks and a `registry.json` entry
- **Eval ingestion**: `bun harbor:ingest --dir <harbor-output-dir>`
  - Imports `reward.txt` + `trajectory.json` from Harbor runs into `@alfred/db`
- **Smoke test**: `bun harbor:smoke`
  - End-to-end validation of Harbor integration

### Generate a task directory

```bash
ALFRED_GIT_URL="git@github.com:<org>/alfred.git" \
bun harbor:gen \
  --outDir ./harbor/datasets/alfred \
  --id hello \
  --requirement "Create HELLO.txt with the text: hello" \
  --verify "test -f HELLO.txt && grep -qx 'hello' HELLO.txt"
```

This produces:

```
harbor/datasets/alfred/hello/
  task.toml
  instruction.md
  environment/Dockerfile
  agents/alfred.sh
  solution/solve.sh
  tests/test.sh
  workspace/README.md
```

Replace `workspace/` with the repo/project you want ALFRED to operate on.

### Required environment for ALFRED inside Harbor

ALFRED's provider selection supports two modes:

1. **Vercel AI Gateway** (default for production):
   - Set `AI_GATEWAY_API_KEY` (or `VERCEL_OIDC_TOKEN` for OIDC auth)

2. **Direct OpenAI** (for Harbor and environments without gateway):
   - Set `OPENAI_API_KEY` (ALFRED will use `@ai-sdk/openai` directly)
   - No `AI_GATEWAY_API_KEY` required

`agents/alfred.sh` sets:

- `DATABASE_URL=sqlite:/logs/verifier/alfred.db`
- `--outTrajectory /logs/verifier/trajectory.json`

### Running with Harbor

**Single trial:**
```bash
uv run harbor trials start -p /path/to/alfred/harbor/datasets/alfred/hello -a alfred
```

**Job over dataset:**
```bash
uv run harbor jobs start -p /path/to/alfred/harbor/datasets/alfred -a alfred
```

The `-a alfred` flag tells Harbor to use `agents/alfred.sh` as the agent under test.

### Generating datasets

Generate a complete dataset with multiple tasks:

```bash
ALFRED_GIT_URL="git@github.com:<org>/alfred.git" \
bun harbor:dataset ./harbor/datasets/alfred
```

This creates:
- Multiple task directories (hello, counter, greet, sum, readme, json, dir, math)
- `registry.json` listing all tasks

### Ingesting evaluation results

After Harbor runs, ingest results into ALFRED's database:

```bash
DATABASE_URL="postgresql://..." \
bun harbor:ingest --dir ./harbor/output
```

This imports `reward.txt` and `trajectory.json` from each task subdirectory into `@alfred/db` for analysis and comparison over time.
