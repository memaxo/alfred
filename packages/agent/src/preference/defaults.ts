import type {
  DomainName,
  PreferenceDetail,
  PreferenceKey,
} from "@alfred/type/preference";

const DEFAULT_CONFIDENCE = 0.5;

const DOMAIN_DEFAULTS: Record<DomainName, Array<[PreferenceKey, PreferenceDetail]>> = {
  general: [],
  proxmox: [
    [
      "domain.proxmox.config_format",
      { value: "yaml", confidence: DEFAULT_CONFIDENCE, source: "default" },
    ],
  ],
  git: [
    [
      "domain.git.commit_style",
      { value: "conventional", confidence: DEFAULT_CONFIDENCE, source: "default" },
    ],
    [
      "domain.git.output_style",
      { value: "annotated", confidence: DEFAULT_CONFIDENCE, source: "default" },
    ],
  ],
  docker: [
    [
      "domain.docker.compose_version",
      { value: "3.9", confidence: DEFAULT_CONFIDENCE, source: "default" },
    ],
    [
      "domain.docker.config_format",
      { value: "yaml", confidence: DEFAULT_CONFIDENCE, source: "default" },
    ],
  ],
  kubernetes: [
    [
      "domain.kubernetes.config_format",
      { value: "yaml", confidence: DEFAULT_CONFIDENCE, source: "default" },
    ],
  ],
};

export function loadDomainDefaults(
  domain: DomainName
): Map<PreferenceKey, PreferenceDetail> {
  const entries = DOMAIN_DEFAULTS[domain];
  if (!entries?.length) {
    return new Map();
  }
  return new Map(
    entries.map(([key, detail]) => [key, { ...detail }])
  );
}
