import { existsSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

import {
  type ComponentName,
  componentRegistry,
  componentStatus,
} from "../src/components/manifest";

type AuditReport = {
  summary: {
    total: number;
    pending: number;
    installed: number;
    integrated: number;
    statusMismatches: number;
  };
  pending: Array<{
    name: ComponentName;
    fileExists: boolean;
    usedInCode: boolean;
  }>;
  installed: Array<{
    name: ComponentName;
    filePath: string | null;
    readyForIntegration: boolean;
  }>;
  integrated: Array<{ name: ComponentName; files: string[] }>;
  gaps: Array<{ component: string; issue: string; recommendation: string }>;
};

type LocalFiles = {
  candidates: string[];
  existing: string[];
};

type ExportIndex = Map<ComponentName, string[]>;

const KNOWN_FILES: Partial<Record<ComponentName, string[]>> = {
  // ElevenLabs / custom UI mappings
  audio: ["audio.tsx", "ui/audio-player.tsx"],
  viz: ["viz.tsx", "ui/bar-visualizer.tsx"],
  chat: ["ui/conversation.tsx"],
  chatbar: ["ui/conversation-bar.tsx"],
  voice: ["voice.tsx", "ui/voice-picker.tsx"],
  orb: ["orb.tsx", "ui/orb.tsx"],
  wave: ["ui/live-waveform.tsx"],
  response: ["response.tsx", "ui/response.tsx"],
  mic: ["mic.tsx", "ui/mic-selector.tsx"],
  msg: ["ui/message.tsx"],
  voiceBtn: ["voice-btn.tsx", "ui/voice-button.tsx"],
  matrix: ["ui/matrix.tsx"],

  // Installed form primitives map to shadcn-esque base components
  text: ["ui/input.tsx"],
  select: ["ui/select.tsx"],
  checkbox: ["ui/checkbox.tsx"],
  dropdown: ["ui/dropdown-menu.tsx"],

  // Repo-local AI SDK elements are stored under ai-elements.
  tool: ["ai-elements/tool.tsx"],
};

function toKebab(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

function listFilesRecursive(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const abs = resolve(dir, entry);
    const st = statSync(abs);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === "__tests__") {
        continue;
      }
      out.push(...listFilesRecursive(abs));
      continue;
    }
    out.push(abs);
  }
  return out;
}

function getLocalFilesForComponent(
  name: ComponentName,
  componentsDir: string
): LocalFiles {
  const kebab = toKebab(name);
  const known = KNOWN_FILES[name] ?? [];
  const candidates = [
    ...known,
    `${name}.tsx`,
    `${name}.ts`,
    `${kebab}.tsx`,
    `${kebab}.ts`,
    `ui/${name}.tsx`,
    `ui/${name}.ts`,
    `ui/${kebab}.tsx`,
    `ui/${kebab}.ts`,
    // AI SDK Elements live under ./ai-elements/* in this repo.
    `ai-elements/${name}.tsx`,
    `ai-elements/${name}.ts`,
    `ai-elements/${kebab}.tsx`,
    `ai-elements/${kebab}.ts`,
  ];

  const uniqCandidates = [...new Set(candidates)];

  const existing = uniqCandidates
    .map((rel) => ({ rel, abs: resolve(componentsDir, rel) }))
    .filter((p) => existsSync(p.abs))
    .map((p) => p.rel);

  return { candidates: uniqCandidates, existing };
}

function fileContainsUsage(args: {
  content: string;
  exportNames: string[];
  moduleSignals: string[];
}): boolean {
  const { content, exportNames, moduleSignals } = args;
  // Conservative signal: explicit imports of the component module(s).
  const barrel = `"@/components"`;
  if (moduleSignals.some((sig) => sig !== barrel && content.includes(sig))) {
    return true;
  }

  // Barrel import usage: ensure the imported name is actually present in the import clause.
  if (content.includes(barrel)) {
    for (const exportName of exportNames) {
      const re = new RegExp(
        `import\\\\s+\\\\{[^}]*\\\\b${exportName}\\\\b[^}]*\\\\}\\\\s+from\\\\s+["']@/components["']`
      );
      if (re.test(content)) {
        return true;
      }
    }
  }

  return false;
}

async function computeUsageAsync(
  srcDir: string,
  name: ComponentName,
  localFiles: LocalFiles,
  exportIndex: ExportIndex
): Promise<boolean> {
  const kebab = toKebab(name);
  const exportNames = exportIndex.get(name) ?? [
    name.charAt(0).toUpperCase() + name.slice(1),
  ];

  const moduleSignals = [
    `"./${name}"`,
    `"./${kebab}"`,
    `"@/components/${name}"`,
    `"@/components/${kebab}"`,
    `"@/components"`,
    ...localFiles.existing.flatMap((rel) => {
      const noExt = rel.replace(/\.(ts|tsx)$/, "");
      return [`"@/components/${noExt}"`, `"./${noExt}"`];
    }),
  ];
  const allFiles = listFilesRecursive(srcDir).filter((abs) => {
    if (!(abs.endsWith(".ts") || abs.endsWith(".tsx"))) {
      return false;
    }
    const rel = abs.slice(srcDir.length + 1).replaceAll("\\", "/");
    if (
      rel.startsWith("components/manifest.ts") ||
      rel.startsWith("components/__tests__/") ||
      rel.startsWith("components/index.ts")
    ) {
      return false;
    }
    const componentDir = resolve(srcDir, "components");
    const componentRel = abs
      .slice(componentDir.length + 1)
      .replaceAll("\\", "/");
    if (localFiles.existing.includes(componentRel)) {
      return false;
    }
    return true;
  });

  for (const abs of allFiles) {
    const content = await Bun.file(abs).text();
    if (
      fileContainsUsage({
        content,
        exportNames,
        moduleSignals,
      })
    ) {
      return true;
    }
  }

  return false;
}

async function main() {
  const webRoot = resolve(import.meta.dir, "..");
  const srcDir = resolve(webRoot, "src");
  const componentsDir = resolve(srcDir, "components");
  const indexPath = resolve(componentsDir, "index.ts");
  const componentNames = Object.keys(componentRegistry) as ComponentName[];

  const indexText = await Bun.file(indexPath).text();
  const exportIndex: ExportIndex = new Map();
  const exportRe = /export\s+\{\s*([^}]+)\s*\}\s+from\s+"\.\/([^"]+)";/g;
  for (const match of indexText.matchAll(exportRe)) {
    const namesText = match[1] ?? "";
    const mod = match[2] ?? "";
    const exports = namesText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => s.replace(/^type\s+/, ""));

    for (const componentName of componentNames) {
      const kebab = toKebab(componentName);
      if (mod === componentName || mod === kebab) {
        const prev = exportIndex.get(componentName) ?? [];
        exportIndex.set(componentName, [...new Set([...prev, ...exports])]);
      }
    }
  }

  const report: AuditReport = {
    summary: {
      total: componentNames.length,
      pending: 0,
      installed: 0,
      integrated: 0,
      statusMismatches: 0,
    },
    pending: [],
    installed: [],
    integrated: [],
    gaps: [],
  };

  for (const name of componentNames) {
    const status = componentStatus[name];
    const localFiles = getLocalFilesForComponent(name, componentsDir);
    const fileExists = localFiles.existing.length > 0;
    const usedInCode = await computeUsageAsync(
      srcDir,
      name,
      localFiles,
      exportIndex
    );

    report.summary[status]++;

    const isMismatch =
      (status === "pending" && fileExists) ||
      ((status === "installed" || status === "integrated") && !fileExists);

    if (isMismatch) {
      report.summary.statusMismatches++;
    }

    if (status === "pending") {
      report.pending.push({ name, fileExists, usedInCode });
      if (fileExists) {
        report.gaps.push({
          component: name,
          issue: "Status is pending but implementation files exist.",
          recommendation: usedInCode
            ? "Promote to integrated."
            : "Promote to installed.",
        });
      }
      continue;
    }

    if (status === "installed") {
      report.installed.push({
        name,
        filePath: localFiles.existing[0] ?? null,
        readyForIntegration: usedInCode,
      });
      if (!fileExists) {
        report.gaps.push({
          component: name,
          issue:
            "Status is installed but no local implementation file was found.",
          recommendation:
            "Either add the component file(s) or mark as pending.",
        });
      }
      continue;
    }

    report.integrated.push({ name, files: localFiles.existing });
    if (!fileExists) {
      report.gaps.push({
        component: name,
        issue:
          "Status is integrated but no local implementation file was found.",
        recommendation: "Either add the component file(s) or mark as pending.",
      });
    } else if (!usedInCode) {
      report.gaps.push({
        component: name,
        issue: "Status is integrated but component is not referenced anywhere.",
        recommendation:
          "If not actually wired into the UI, downgrade to installed.",
      });
    }
  }

  console.log(JSON.stringify(report, null, 2));
}

await main();
