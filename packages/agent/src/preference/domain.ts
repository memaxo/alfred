import type { DomainName } from "@alfred/type/preference";
import type { UIMessage } from "@alfred/type/stream";

const TOOL_DOMAIN_PREFIXES: Array<{ domain: DomainName; pattern: RegExp }> = [
  { domain: "proxmox", pattern: /^proxmox[.:]/i },
  { domain: "git", pattern: /^git[.:]/i },
  { domain: "docker", pattern: /^docker[.:]/i },
  { domain: "kubernetes", pattern: /^(k(8|ube)s|kubernetes)[.:]?/i },
];

const MESSAGE_KEYWORDS: Array<{ domain: DomainName; matcher: RegExp }> = [
  { domain: "proxmox", matcher: /\b(proxmox|lxc|vmid|cluster)\b/i },
  { domain: "git", matcher: /\b(git|commit|branch|merge|rebase)\b/i },
  { domain: "docker", matcher: /\b(docker|compose|container|image)\b/i },
  {
    domain: "kubernetes",
    matcher: /\b(kubernetes|k8s|pod|deployment|cluster)\b/i,
  },
];

export type ToolDictionary = Record<string, { name?: string } | undefined>;

export function detectDomain(
  messages: UIMessage[],
  tools?: ToolDictionary | string[]
): DomainName | null {
  const toolNames = normalizeToolNames(tools);
  for (const name of toolNames) {
    const domain = extractDomainFromToolName(name);
    if (domain && domain !== "general") {
      return domain;
    }
  }

  const combined = normalizeMessageText(messages);
  for (const { domain, matcher } of MESSAGE_KEYWORDS) {
    if (matcher.test(combined)) {
      return domain;
    }
  }

  return null;
}

export function extractDomainFromToolName(name: string): DomainName | null {
  for (const { domain, pattern } of TOOL_DOMAIN_PREFIXES) {
    if (pattern.test(name)) {
      return domain;
    }
  }
  return null;
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

function normalizeMessageText(messages: UIMessage[]): string {
  return messages
    .map(
      (message) =>
        message.parts
          ?.filter(
            (part): part is { type: "text"; text: string } =>
              part.type === "text" && typeof part.text === "string"
          )
          .map((part) => part.text.toLowerCase())
          .join(" ") ?? ""
    )
    .join(" ");
}
