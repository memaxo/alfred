# Harbor base image (ALFRED)

This image is a **pruned** ALFRED workspace intended for Harbor evaluations where the **agent under test is ALFRED**.

It uses `turbo prune` to avoid pulling in unrelated workspace packages (notably `@alfred/voice` which depends on native modules like `@discordjs/opus`).

## Build

```bash
docker build -f docker/harbor/alfred-base.Dockerfile -t alfred-harbor-base .
```

## Use

- In Harbor tasks that require ALFRED, use a task `environment/Dockerfile` like:

```dockerfile
FROM alfred-harbor-base
WORKDIR /workspace
COPY workspace/ /workspace/
```

- Run Harbor with the custom ALFRED agent import path:

```bash
PYTHONPATH=$PWD harbor run -p <datasetDir> --agent-import-path alfredharbor.agent:AlfredAgent
```
