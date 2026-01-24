function isNonEmptyArray<T>(
  value: readonly T[]
): value is readonly [T, ...T[]] {
  return value.length > 0;
}

async function run(cmd: string, args: readonly string[]): Promise<number> {
  const proc = Bun.spawn([cmd, ...args], {
    stderr: "inherit",
    stdin: "inherit",
    stdout: "inherit",
  });
  return await proc.exited;
}

async function probe(cmd: string, args: readonly string[]): Promise<boolean> {
  try {
    const proc = Bun.spawn([cmd, ...args], {
      stderr: "ignore",
      stdin: "ignore",
      stdout: "ignore",
    });
    return (await proc.exited) === 0;
  } catch {
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (isNonEmptyArray(args)) {
    if (await probe("docker", ["compose", "version"])) {
      process.exitCode = await run("docker", ["compose", ...args]);
    } else if (await probe("docker-compose", ["version"])) {
      process.exitCode = await run("docker-compose", args);
    } else {
      throw new Error(
        "docker_compose_unavailable: Install Docker or Docker Desktop to use db:start. Verify with: docker ps"
      );
    }
  } else {
    console.error("usage: bun scripts/compose.ts <compose-args...>");
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
