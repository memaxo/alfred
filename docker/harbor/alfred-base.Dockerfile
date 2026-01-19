FROM oven/bun:1.3.5 AS pruner

WORKDIR /repo
COPY . .

# Create a minimal monorepo subset for running ALFRED Harbor evals.
# This avoids installing unrelated workspace packages (e.g. voice deps like @discordjs/opus).
RUN bunx turbo prune --scope=@alfred/harbor --docker --out-dir /out

FROM oven/bun:1.3.5 AS runtime

WORKDIR /alfred

RUN apt-get update && apt-get install -y git ca-certificates python3 make g++ docker.io && rm -rf /var/lib/apt/lists/*

# Install dependencies from the pruned workspace graph (cache-friendly).
COPY --from=pruner /out/json/ .
RUN bun install --ignore-scripts

# Copy the full pruned sources.
COPY --from=pruner /out/full/ .

# Harbor verifier scripts are referenced by some ALFRED-runner task verifiers.
COPY --from=pruner /repo/scripts/harbor-verifiers ./scripts/harbor-verifiers

# Runtime policy file is loaded from repo-relative path.
COPY --from=pruner /repo/config/policy.yaml ./config/policy.yaml

ENV NODE_ENV=production

WORKDIR /alfred

