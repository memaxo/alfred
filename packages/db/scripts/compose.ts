function isNonEmptyArray<T>(value: readonly T[]): value is readonly [T, ...T[]] {
  return value.length > 0;
}

async function run(cmd: string, args: readonly string[]): Promise<number> {
  const proc = Bun.spawn([cmd, ...args], {
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  return await proc.exited;
}

async function probe(cmd: string, args: readonly string[]): Promise<boolean> {
  try {
    const proc = Bun.spawn([cmd, ...args], {
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore",
    });
    return (await proc.exited) === 0;
  } catch {
    return false;
  }
}

const args = process.argv.slice(2);

if (!isNonEmptyArray(args)) {
  // biome-ignore lint/suspicious/noConsole: CLI tool output.
  console.error("usage: bun scripts/compose.ts <compose-args...>");
  process.exitCode = 2;
} else {
  if (await probe("docker", ["compose", "version"])) {
    process.exitCode = await run("docker", ["compose", ...args]);
  } else if (await probe("docker-compose", ["version"])) {
    process.exitCode = await run("docker-compose", args);
  } else {
    throw new Error("docker_compose_unavailable");
  }
}

