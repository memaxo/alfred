import { cosineSimilarity } from "@alfred/embed";
import { logger } from "@alfred/logger";
import { embedMany } from "@alfred/rag";
import type { DomainName } from "@alfred/type/preference";
import type { UIMessage } from "@alfred/type/stream";

const DOMAIN_NAMES = ["general", "proxmox", "git", "docker", "kubernetes"] as const;
const DOMAIN_SET = new Set<string>(DOMAIN_NAMES);
type EmbedDomain = Exclude<DomainName, "general">;
const EMBED_DOMAINS = ["proxmox", "git", "docker", "kubernetes"] as const satisfies ReadonlyArray<EmbedDomain>;

const DOMAIN_PROTOTYPES: Record<EmbedDomain, string[]> = {
  proxmox: [
    "Proxmox: manage VMs, LXC containers, vmid, cluster, storage, snapshots.",
    "Proxmox: pve, qemu, lxc, node, pool, backups, networking bridges.",
  ],
  git: [
    "Git: commits, branches, rebase, merge conflicts, diffs, status, PRs.",
    "Git: staging, amend, reset, reflog, cherry-pick, tags, remotes.",
  ],
  docker: [
    "Docker: build images, containers, compose, volumes, networks, registry.",
    "Docker: run, exec, logs, layers, dockerfile, compose services.",
  ],
  kubernetes: [
    "Kubernetes: k8s pods, deployments, services, namespaces, cluster, kubectl.",
    "Kubernetes: helm, ingress, configmaps, secrets, rollouts, nodes.",
  ],
};

type DomainCentroids = Map<DomainName, number[]>;
let centroidPromise: Promise<DomainCentroids> | null = null;

const MIN_DOMAIN_SCORE = 0.25;
const MAX_INPUT_CHARS = 4000;

function averageVectors(vectors: number[][]): number[] | null {
  if (vectors.length === 0) {
    return null;
  }
  const len = vectors[0]?.length ?? 0;
  if (len === 0) {
    return null;
  }
  const acc = new Array<number>(len).fill(0);
  for (const vec of vectors) {
    if (vec.length !== len) {
      return null;
    }
    for (let i = 0; i < len; i += 1) {
      acc[i] = (acc[i] ?? 0) + (vec[i] ?? 0);
    }
  }
  return acc.map((value) => value / vectors.length);
}

function getDomainCentroids(): Promise<DomainCentroids> {
  if (!centroidPromise) {
    centroidPromise = (async () => {
      const prototypes: Array<{ domain: DomainName; text: string }> = [];
      for (const domain of EMBED_DOMAINS) {
        const samples = DOMAIN_PROTOTYPES[domain];
        for (const text of samples) {
          prototypes.push({ domain, text });
        }
      }
      const embeddings = await embedMany(prototypes.map((p) => p.text));
      const grouped = new Map<DomainName, number[][]>();
      for (let i = 0; i < prototypes.length; i += 1) {
        const proto = prototypes[i];
        const vec = embeddings[i];
        if (!(proto && vec)) {
          continue;
        }
        const bucket = grouped.get(proto.domain) ?? [];
        bucket.push(vec);
        grouped.set(proto.domain, bucket);
      }

      const centroids: DomainCentroids = new Map();
      for (const domain of EMBED_DOMAINS) {
        const bucket = grouped.get(domain) ?? [];
        const centroid = averageVectors(bucket);
        if (centroid) {
          centroids.set(domain, centroid);
        }
      }
      return centroids;
    })().catch((error) => {
      centroidPromise = null;
      throw error;
    });
  }
  return centroidPromise;
}

export type ToolDictionary = Record<string, { name?: string } | undefined>;

export async function detectDomain(
  messages: UIMessage[],
  tools?: ToolDictionary | string[]
): Promise<DomainName | null> {
  const toolNames = normalizeToolNames(tools);
  for (const name of toolNames) {
    const domain = extractDomainFromToolName(name);
    if (domain && domain !== "general") {
      return domain;
    }
  }

  const combined = buildEmbeddingInput(messages, toolNames);
  if (!combined) {
    return null;
  }

  try {
    const [vector] = await embedMany([combined]);
    if (!vector) {
      return null;
    }
    const centroids = await getDomainCentroids();

    let best: { domain: DomainName; score: number } | null = null;
    for (const domain of EMBED_DOMAINS) {
      const centroid = centroids.get(domain);
      if (!centroid) {
        continue;
      }
      const score = cosineSimilarity(vector, centroid);
      if (!Number.isFinite(score)) {
        continue;
      }
      if (!best || score > best.score) {
        best = { domain, score };
      }
    }

    if (!best || best.score < MIN_DOMAIN_SCORE) {
      return null;
    }

    return best.domain;
  } catch (error) {
    logger.debug("preference_domain_embed_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export function extractDomainFromToolName(name: string): DomainName | null {
  const sepIdx = firstSeparatorIndex(name);
  if (sepIdx <= 0) {
    return null;
  }
  const prefix = name.slice(0, sepIdx).toLowerCase();
  return DOMAIN_SET.has(prefix) ? (prefix as DomainName) : null;
}

function normalizeToolNames(tools?: ToolDictionary | string[]): string[] {
  if (!tools) {
    return [];
  }
  if (Array.isArray(tools)) {
    return tools.filter((name): name is string => typeof name === "string");
  }
  return Object.entries(tools)
    .map(([key, value]) => value?.name ?? key)
    .filter((name): name is string => Boolean(name));
}

function firstSeparatorIndex(name: string): number {
  const dot = name.indexOf(".");
  const colon = name.indexOf(":");
  if (dot === -1) {
    return colon;
  }
  if (colon === -1) {
    return dot;
  }
  return Math.min(dot, colon);
}

function normalizeMessageText(messages: UIMessage[]): string[] {
  const out: string[] = [];
  for (const message of messages) {
    const parts = message.parts ?? [];
    for (const part of parts) {
      if (part.type === "text" && typeof part.text === "string") {
        const normalized = part.text.trim();
        if (normalized.length > 0) {
          out.push(normalized);
        }
      }
    }
  }
  return out;
}

function buildEmbeddingInput(messages: UIMessage[], toolNames: string[]): string {
  const segments: string[] = [];
  if (toolNames.length) {
    segments.push(`Tools: ${toolNames.slice(0, 50).join(", ")}`);
  }
  const messageTexts = normalizeMessageText(messages);
  if (messageTexts.length) {
    segments.push(`Text: ${messageTexts.join("\n")}`);
  }
  const combined = segments.join("\n\n").trim();
  return combined.length > MAX_INPUT_CHARS
    ? combined.slice(0, MAX_INPUT_CHARS)
    : combined;
}
