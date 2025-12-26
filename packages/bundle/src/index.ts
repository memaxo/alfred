type FeatureSource = {
  args: string[];
  env: Record<string, string | undefined>;
};

function parseFeatures({ args, env }: FeatureSource) {
  const enabled = new Set<string>();

  const envList = env.BUN_FEATURES?.trim();
  if (envList) {
    for (const part of envList.split(",")) {
      const name = part.trim();
      if (name.length > 0) {
        enabled.add(name);
      }
    }
  }

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg) {
      continue;
    }
    if (arg.startsWith("--feature=")) {
      const name = arg.slice("--feature=".length).trim();
      if (name.length > 0) {
        enabled.add(name);
      }
      continue;
    }
    if (arg === "--feature") {
      const name = args.at(i + 1)?.trim();
      if (name && name.length > 0) {
        enabled.add(name);
      }
    }
  }

  return enabled;
}

const features = parseFeatures({ args: process.argv, env: process.env });

/**
 * Compatibility shim for environments where `bun:bundle` is unavailable.
 * Bun < 1.3.5 currently resolves `bun:bundle` as a normal package import ("bundle").
 */
export function feature(name: string) {
  return features.has(name);
}

export const Registry = {
  features: Object.freeze(Array.from(features)),
} as const;

