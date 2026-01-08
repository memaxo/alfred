/**
 * Code Editor Types Tests
 *
 * Tests for language detection and type utilities.
 */

import { describe, expect, it } from "bun:test";
import {
  DEFAULT_EDITOR_SETTINGS,
  getLanguageFromPath,
  LANGUAGE_MAP,
} from "../types";

describe("getLanguageFromPath", () => {
  describe("TypeScript/JavaScript files", () => {
    it("detects TypeScript files", () => {
      expect(getLanguageFromPath("/src/index.ts")).toBe("typescript");
      expect(getLanguageFromPath("/components/Button.ts")).toBe("typescript");
    });

    it("detects TypeScript React files", () => {
      expect(getLanguageFromPath("/src/App.tsx")).toBe("typescriptreact");
      expect(getLanguageFromPath("/components/Modal.tsx")).toBe(
        "typescriptreact"
      );
    });

    it("detects JavaScript files", () => {
      expect(getLanguageFromPath("/scripts/build.js")).toBe("javascript");
      expect(getLanguageFromPath("/config.js")).toBe("javascript");
    });

    it("detects JavaScript React files", () => {
      expect(getLanguageFromPath("/src/Legacy.jsx")).toBe("javascriptreact");
    });
  });

  describe("markup and style files", () => {
    it("detects JSON files", () => {
      expect(getLanguageFromPath("/package.json")).toBe("json");
      expect(getLanguageFromPath("/tsconfig.json")).toBe("json");
    });

    it("detects Markdown files", () => {
      expect(getLanguageFromPath("/README.md")).toBe("markdown");
      expect(getLanguageFromPath("/docs/guide.md")).toBe("markdown");
    });

    it("detects CSS files", () => {
      expect(getLanguageFromPath("/styles/main.css")).toBe("css");
    });

    it("detects SCSS files", () => {
      expect(getLanguageFromPath("/styles/variables.scss")).toBe("scss");
    });

    it("detects HTML files", () => {
      expect(getLanguageFromPath("/public/index.html")).toBe("html");
    });

    it("detects XML and SVG files", () => {
      expect(getLanguageFromPath("/assets/icon.svg")).toBe("xml");
      expect(getLanguageFromPath("/config.xml")).toBe("xml");
    });
  });

  describe("configuration files", () => {
    it("detects YAML files", () => {
      expect(getLanguageFromPath("/.github/workflows/ci.yaml")).toBe("yaml");
      expect(getLanguageFromPath("/docker-compose.yml")).toBe("yaml");
    });

    it("detects TOML files", () => {
      expect(getLanguageFromPath("/Cargo.toml")).toBe("ini");
      expect(getLanguageFromPath("/pyproject.toml")).toBe("ini");
    });

    it("detects shell scripts", () => {
      expect(getLanguageFromPath("/scripts/deploy.sh")).toBe("shell");
      expect(getLanguageFromPath("/scripts/setup.bash")).toBe("shell");
      // .zshrc has no extension after the dot, so returns plaintext
      expect(getLanguageFromPath("/scripts/init.zsh")).toBe("shell");
    });

    it("detects Dockerfile", () => {
      expect(getLanguageFromPath("/Dockerfile")).toBe("dockerfile");
      expect(getLanguageFromPath("/docker/Dockerfile")).toBe("dockerfile");
    });

    it("detects Makefile", () => {
      expect(getLanguageFromPath("/Makefile")).toBe("makefile");
    });
  });

  describe("programming languages", () => {
    it("detects Python files", () => {
      expect(getLanguageFromPath("/scripts/analyze.py")).toBe("python");
    });

    it("detects Rust files", () => {
      expect(getLanguageFromPath("/src/main.rs")).toBe("rust");
    });

    it("detects Go files", () => {
      expect(getLanguageFromPath("/cmd/server/main.go")).toBe("go");
    });

    it("detects Java files", () => {
      expect(getLanguageFromPath("/src/Main.java")).toBe("java");
    });

    it("detects C/C++ files", () => {
      expect(getLanguageFromPath("/src/main.c")).toBe("c");
      expect(getLanguageFromPath("/src/main.cpp")).toBe("cpp");
      expect(getLanguageFromPath("/include/header.h")).toBe("c");
      expect(getLanguageFromPath("/include/header.hpp")).toBe("cpp");
    });

    it("detects SQL files", () => {
      expect(getLanguageFromPath("/migrations/001_init.sql")).toBe("sql");
    });

    it("detects Ruby files", () => {
      expect(getLanguageFromPath("/Gemfile.rb")).toBe("ruby");
    });

    it("detects PHP files", () => {
      expect(getLanguageFromPath("/index.php")).toBe("php");
    });
  });

  describe("edge cases", () => {
    it("returns plaintext for unknown extensions", () => {
      expect(getLanguageFromPath("/file.unknown")).toBe("plaintext");
      expect(getLanguageFromPath("/data.xyz")).toBe("plaintext");
    });

    it("handles files without extensions", () => {
      expect(getLanguageFromPath("/LICENSE")).toBe("plaintext");
    });

    it("handles uppercase extensions by extracting lowercase", () => {
      // getLanguageFromPath uses .toLowerCase() on the extension
      expect(getLanguageFromPath("/README.MD")).toBe("markdown");
      expect(getLanguageFromPath("/script.PY")).toBe("python");
    });

    it("handles deeply nested paths", () => {
      expect(getLanguageFromPath("/a/b/c/d/e/f/file.ts")).toBe("typescript");
    });

    it("handles paths with dots in directory names", () => {
      expect(getLanguageFromPath("/node_modules/@types/node/index.d.ts")).toBe(
        "typescript"
      );
    });
  });
});

describe("LANGUAGE_MAP", () => {
  it("contains all common web development languages", () => {
    const webLanguages = ["ts", "tsx", "js", "jsx", "json", "css", "html"];
    for (const ext of webLanguages) {
      expect(LANGUAGE_MAP[ext]).toBeDefined();
    }
  });

  it("contains all common backend languages", () => {
    const backendLanguages = ["py", "rb", "go", "java", "rs", "php"];
    for (const ext of backendLanguages) {
      expect(LANGUAGE_MAP[ext]).toBeDefined();
    }
  });

  it("contains common config file extensions", () => {
    const configExtensions = ["yaml", "yml", "toml", "json"];
    for (const ext of configExtensions) {
      expect(LANGUAGE_MAP[ext]).toBeDefined();
    }
  });
});

describe("DEFAULT_EDITOR_SETTINGS", () => {
  it("has sensible default values", () => {
    expect(DEFAULT_EDITOR_SETTINGS.fontSize).toBeGreaterThanOrEqual(10);
    expect(DEFAULT_EDITOR_SETTINGS.fontSize).toBeLessThanOrEqual(24);
  });

  it("has valid wordWrap value", () => {
    const validValues = ["on", "off", "wordWrapColumn", "bounded"];
    expect(validValues).toContain(DEFAULT_EDITOR_SETTINGS.wordWrap);
  });

  it("has valid lineNumbers value", () => {
    const validValues = ["on", "off", "relative"];
    expect(validValues).toContain(DEFAULT_EDITOR_SETTINGS.lineNumbers);
  });

  it("has tabSize as a positive integer", () => {
    expect(DEFAULT_EDITOR_SETTINGS.tabSize).toBeGreaterThan(0);
    expect(Number.isInteger(DEFAULT_EDITOR_SETTINGS.tabSize)).toBe(true);
  });

  it("has minimap as boolean", () => {
    expect(typeof DEFAULT_EDITOR_SETTINGS.minimap).toBe("boolean");
  });
});
