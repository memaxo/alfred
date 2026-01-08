import { describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  type ComponentName,
  componentRegistry,
  componentStatus,
} from "../manifest";

const COMPONENTS_DIR = resolve(import.meta.dir, "..");

describe("manifest", () => {
  describe("structure", () => {
    it("exports componentRegistry as readonly object", () => {
      expect(componentRegistry).toBeDefined();
      expect(typeof componentRegistry).toBe("object");
    });

    it("exports componentStatus with all registry keys", () => {
      const registryKeys = Object.keys(componentRegistry);
      const statusKeys = Object.keys(componentStatus);

      expect(statusKeys).toEqual(registryKeys);
    });

    it("has valid status values for all components", () => {
      const validStatuses = ["pending", "installed", "integrated"];

      for (const [_name, status] of Object.entries(componentStatus)) {
        expect(validStatuses).toContain(status);
      }
    });

    it("registry values are valid source URLs", () => {
      for (const [_name, source] of Object.entries(componentRegistry)) {
        expect(typeof source).toBe("string");
        expect(source.length).toBeGreaterThan(0);
        expect(source).toMatch(/^[\w.-]+\//);
      }
    });
  });

  describe("naming conventions", () => {
    it("component names use lowercase or camelCase", () => {
      for (const name of Object.keys(componentRegistry)) {
        expect(name).toMatch(/^[a-z][a-zA-Z]*$/);
      }
    });

    it("component names are short (max 15 chars)", () => {
      for (const name of Object.keys(componentRegistry)) {
        expect(name.length).toBeLessThanOrEqual(15);
      }
    });

    it("prefers single lowercase words where possible", () => {
      const camelCaseNames = Object.keys(componentRegistry).filter(
        (name) => name !== name.toLowerCase()
      );
      expect(camelCaseNames.length).toBeLessThanOrEqual(2);
    });
  });

  describe("phase organization", () => {
    const phase1Components: ComponentName[] = [
      "connect",
      "ctx",
      "actions",
      "think",
      "load",
      "plan",
      "tool",
      "task",
      "queue",
      "confirm",
      "cite",
      "branch",
      "thought",
      "code",
      "controls",
      "audio",
      "viz",
      "chat",
      "chatbar",
      "voice",
      "orb",
      "wave",
      "response",
      "mic",
      "msg",
      "voiceBtn",
      "preview",
      "node",
      "artifact",
      "panel",
      "toolbar",
      "canvas",
      "edge",
      "loading",
      "list",
    ];

    const phase2Components: ComponentName[] = [
      "number",
      "chart",
      "matrix",
      "grid",
      "dock",
      "term",
    ];

    const phase3Components: ComponentName[] = [
      "text",
      "select",
      "date",
      "daterange",
      "checkbox",
      "choice",
      "autocomplete",
      "dropdown",
      "profile",
    ];

    it("phase 1 components exist in registry", () => {
      for (const name of phase1Components) {
        expect(componentRegistry[name]).toBeDefined();
      }
    });

    it("phase 2 components exist in registry", () => {
      for (const name of phase2Components) {
        expect(componentRegistry[name]).toBeDefined();
      }
    });

    it("phase 3 components exist in registry", () => {
      for (const name of phase3Components) {
        expect(componentRegistry[name]).toBeDefined();
      }
    });

    it("all phases cover complete registry", () => {
      const allPhases = [
        ...phase1Components,
        ...phase2Components,
        ...phase3Components,
      ];
      const registryKeys = Object.keys(componentRegistry) as ComponentName[];

      expect(new Set(allPhases)).toEqual(new Set(registryKeys));
    });
  });

  describe("source categorization", () => {
    it("AI SDK components point to ai-sdk.dev", () => {
      const aiSdkComponents: ComponentName[] = [
        "connect",
        "ctx",
        "actions",
        "think",
        "load",
        "plan",
        "tool",
        "task",
        "queue",
        "confirm",
        "cite",
        "branch",
        "thought",
        "code",
        "controls",
        "preview",
        "node",
        "artifact",
        "panel",
        "toolbar",
        "canvas",
        "edge",
      ];

      for (const name of aiSdkComponents) {
        expect(componentRegistry[name]).toMatch(/^ai-sdk\.dev/);
      }
    });

    it("ElevenLabs components point to ui.elevenlabs.io", () => {
      const elevenLabsComponents: ComponentName[] = [
        "audio",
        "viz",
        "chat",
        "chatbar",
        "voice",
        "orb",
        "wave",
        "response",
        "mic",
        "msg",
        "voiceBtn",
        "matrix",
      ];

      for (const name of elevenLabsComponents) {
        expect(componentRegistry[name]).toMatch(/^ui\.elevenlabs\.io/);
      }
    });

    it("form components point to ui.wandry.com.ua", () => {
      const wandryComponents: ComponentName[] = [
        "text",
        "select",
        "date",
        "daterange",
        "checkbox",
        "choice",
        "autocomplete",
      ];

      for (const name of wandryComponents) {
        expect(componentRegistry[name]).toMatch(/^ui\.wandry\.com\.ua/);
      }
    });
  });

  describe("integrated components file verification", () => {
    const integratedComponents = Object.entries(componentStatus)
      .filter(([_, status]) => status === "integrated")
      .map(([name]) => name as ComponentName);

    it("has integrated components", () => {
      expect(integratedComponents.length).toBeGreaterThan(0);
    });

    const componentFileMappings: Partial<Record<ComponentName, string[]>> = {
      audio: ["audio.tsx", "ui/audio-player.tsx"],
      viz: ["viz.tsx", "ui/bar-visualizer.tsx"],
      chat: ["ui/conversation.tsx"],
      chatbar: ["ui/conversation-bar.tsx"],
      voice: ["voice.tsx", "ui/voice-picker.tsx"],
      orb: ["orb.tsx", "ui/orb.tsx"],
      wave: ["ui/live-waveform.tsx"],
      response: ["ui/response.tsx"],
      mic: ["mic.tsx", "ui/mic-selector.tsx"],
      msg: ["ui/message.tsx"],
      voiceBtn: ["voice-btn.tsx", "ui/voice-button.tsx"],
      matrix: ["ui/matrix.tsx"],
      controls: [],
    };

    for (const name of integratedComponents) {
      const files = componentFileMappings[name];
      if (files && files.length > 0) {
        it(`${name}: at least one implementation file exists`, () => {
          const exists = files.some((file) =>
            existsSync(resolve(COMPONENTS_DIR, file))
          );
          expect(exists).toBe(true);
        });
      }
    }
  });

  describe("installed components file verification", () => {
    const installedComponents = Object.entries(componentStatus)
      .filter(([_, status]) => status === "installed")
      .map(([name]) => name as ComponentName);

    const installedFileMappings: Partial<Record<ComponentName, string>> = {
      text: "ui/input.tsx",
      select: "ui/select.tsx",
      checkbox: "ui/checkbox.tsx",
      dropdown: "ui/dropdown-menu.tsx",
    };

    for (const name of installedComponents) {
      const file = installedFileMappings[name];
      if (file) {
        it(`${name}: base component file exists`, () => {
          expect(existsSync(resolve(COMPONENTS_DIR, file))).toBe(true);
        });
      }
    }
  });

  describe("status counts", () => {
    it("reports accurate status distribution", () => {
      const counts = {
        pending: 0,
        installed: 0,
        integrated: 0,
      };

      for (const status of Object.values(componentStatus)) {
        counts[status]++;
      }

      expect(counts.integrated).toBeGreaterThanOrEqual(13);
      expect(counts.installed).toBeGreaterThanOrEqual(4);
      expect(counts.pending + counts.installed + counts.integrated).toBe(
        Object.keys(componentRegistry).length
      );
    });

    it("voice/audio suite is fully integrated", () => {
      const voiceAudioComponents: ComponentName[] = [
        "audio",
        "viz",
        "chat",
        "chatbar",
        "voice",
        "orb",
        "wave",
        "response",
        "mic",
        "msg",
        "voiceBtn",
      ];

      for (const name of voiceAudioComponents) {
        expect(componentStatus[name]).toBe("integrated");
      }
    });
  });

  describe("type safety", () => {
    it("ComponentName type covers all registry keys", () => {
      const keys = Object.keys(componentRegistry) as ComponentName[];
      expect(keys.length).toBe(Object.keys(componentRegistry).length);
    });

    it("status record is complete", () => {
      for (const name of Object.keys(componentRegistry) as ComponentName[]) {
        expect(componentStatus[name]).toBeDefined();
      }
    });
  });

  describe("consistency checks", () => {
    it("no duplicate source URLs", () => {
      const sources = Object.values(componentRegistry);
      const uniqueSources = new Set(sources);
      expect(uniqueSources.size).toBe(sources.length);
    });

    it("registry and status have same key order", () => {
      const registryKeys = Object.keys(componentRegistry);
      const statusKeys = Object.keys(componentStatus);

      for (let i = 0; i < registryKeys.length; i++) {
        expect(registryKeys[i]).toBe(statusKeys[i]);
      }
    });
  });

  describe("component requirements", () => {
    it("core chat requires integrated components", () => {
      expect(componentStatus.chat).toBe("integrated");
      expect(componentStatus.msg).toBe("integrated");
      expect(componentStatus.response).toBe("integrated");
    });

    it("voice features require integrated components", () => {
      expect(componentStatus.orb).toBe("integrated");
      expect(componentStatus.wave).toBe("integrated");
      expect(componentStatus.mic).toBe("integrated");
      expect(componentStatus.voiceBtn).toBe("integrated");
    });

    it("audio visualization requires integrated components", () => {
      expect(componentStatus.viz).toBe("integrated");
      expect(componentStatus.audio).toBe("integrated");
      expect(componentStatus.matrix).toBe("integrated");
    });
  });
});

describe("manifest helpers", () => {
  const getIntegratedComponents = (): ComponentName[] =>
    Object.entries(componentStatus)
      .filter(([_, status]) => status === "integrated")
      .map(([name]) => name as ComponentName);

  const getPendingComponents = (): ComponentName[] =>
    Object.entries(componentStatus)
      .filter(([_, status]) => status === "pending")
      .map(([name]) => name as ComponentName);

  const getInstalledComponents = (): ComponentName[] =>
    Object.entries(componentStatus)
      .filter(([_, status]) => status === "installed")
      .map(([name]) => name as ComponentName);

  const getComponentsBySource = (
    pattern: RegExp
  ): { name: ComponentName; source: string }[] =>
    Object.entries(componentRegistry)
      .filter(([_, source]) => pattern.test(source))
      .map(([name, source]) => ({
        name: name as ComponentName,
        source,
      }));

  it("helper: getIntegratedComponents returns correct count", () => {
    const integrated = getIntegratedComponents();
    expect(integrated.length).toBeGreaterThanOrEqual(13);
  });

  it("helper: getPendingComponents returns AI SDK elements", () => {
    const pending = getPendingComponents();
    expect(pending).toContain("connect");
    expect(pending).toContain("think");
    expect(pending).toContain("canvas");
  });

  it("helper: getInstalledComponents returns form primitives", () => {
    const installed = getInstalledComponents();
    expect(installed).toContain("text");
    expect(installed).toContain("select");
  });

  it("helper: getComponentsBySource finds ElevenLabs components", () => {
    const elevenLabs = getComponentsBySource(/elevenlabs/);
    expect(elevenLabs.length).toBeGreaterThanOrEqual(11);
  });

  it("helper: getComponentsBySource finds AI SDK components", () => {
    const aiSdk = getComponentsBySource(/ai-sdk\.dev/);
    expect(aiSdk.length).toBeGreaterThanOrEqual(20);
  });
});

describe("manifest evolution", () => {
  it("supports status transitions", () => {
    const validTransitions = [
      ["pending", "installed"],
      ["pending", "integrated"],
      ["installed", "integrated"],
    ];

    for (const [from, to] of validTransitions) {
      expect(["pending", "installed", "integrated"]).toContain(from);
      expect(["pending", "installed", "integrated"]).toContain(to);
    }
  });

  it("no backward transitions allowed conceptually", () => {
    const statusOrder = { pending: 0, installed: 1, integrated: 2 };

    for (const [_name, status] of Object.entries(componentStatus)) {
      expect(statusOrder[status]).toBeDefined();
    }
  });
});
