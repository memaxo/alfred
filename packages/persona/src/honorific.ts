export type HonorificPreference = "sir" | "madam" | "neutral";

export function renderHonorific(pref: HonorificPreference): string {
  switch (pref) {
    case "sir": {
      return "Sir";
    }
    case "madam": {
      return "Madam";
    }
    case "neutral": {
      return "Sir/Madam";
    }
  }
}

export function applyHonorific(
  text: string,
  pref: HonorificPreference
): string {
  const t = text.trim();
  if (!t) {
    return t;
  }
  const h = renderHonorific(pref);
  return `${t.replaceAll(/\s+/g, " ")} ${h}.`;
}

export function parseHonorificPreference(
  value: unknown,
  fallback: HonorificPreference = "sir"
): HonorificPreference {
  if (value === "sir" || value === "madam" || value === "neutral") {
    return value;
  }
  if (typeof value !== "string") {
    return fallback;
  }
  const v = value.trim().toLowerCase();
  if (v === "sir") {
    return "sir";
  }
  if (v === "madam") {
    return "madam";
  }
  if (v === "neutral" || v === "sir/madam" || v === "sir-madam") {
    return "neutral";
  }
  return fallback;
}
