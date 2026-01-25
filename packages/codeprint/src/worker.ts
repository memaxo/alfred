import { parseSync } from "oxc-parser";

import type {
  EnrichedEntry,
  ParseTask,
  ParseResult,
  Symbol,
  Reference,
} from "./types.js";

// ─────────────────────────────────────────────────────────
// Worker Entry Point
// ─────────────────────────────────────────────────────────

declare const self: Worker;

self.onmessage = async (event: MessageEvent<ParseTask>) => {
  const { id, workspace, path } = event.data;

  try {
    const fullPath = `${workspace}/${path}`;
    const content = await Bun.file(fullPath).text();
    const entry = parseFile(path, content);

    self.postMessage({ id, path, entry } satisfies ParseResult);
  } catch (error) {
    self.postMessage({
      id,
      path,
      error: error instanceof Error ? error.message : String(error),
    } satisfies ParseResult);
  }
};

// ─────────────────────────────────────────────────────────
// Parse Logic
// ─────────────────────────────────────────────────────────

function parseFile(path: string, content: string): EnrichedEntry {
  const result = parseSync(path, content, { sourceType: "module" });

  const exports = result.module.staticExports.flatMap((exp) =>
    exp.entries.map((e) => e.exportName.name ?? e.exportName.kind)
  );

  const imports = result.module.staticImports.map(
    (imp) => imp.moduleRequest.value
  );

  const { symbols, references } = extractSemantics(result.program);
  const keywords = extractKeywords(path, exports, imports, symbols);
  const dependencies = imports.filter(
    (i) => !i.startsWith(".") && !i.startsWith("/")
  );

  return {
    path,
    exports,
    imports,
    keywords,
    symbols,
    references,
    dependencies,
  };
}

// ─────────────────────────────────────────────────────────
// Semantic Extraction
// ─────────────────────────────────────────────────────────

function extractSemantics(program: unknown): {
  symbols: Symbol[];
  references: Reference[];
} {
  const symbols: Symbol[] = [];
  const references: Reference[] = [];

  // Walk the AST to extract symbols and references
  walkNode(program, symbols, references, false);

  return { symbols, references };
}

function walkNode(
  node: unknown,
  symbols: Symbol[],
  references: Reference[],
  isExported: boolean
): void {
  if (!node || typeof node !== "object") {
    return;
  }

  const n = node as Record<string, unknown>;
  const type = n.type as string | undefined;

  if (!type) {
    // Walk object properties
    for (const value of Object.values(n)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          walkNode(item, symbols, references, false);
        }
      } else if (value && typeof value === "object") {
        walkNode(value, symbols, references, false);
      }
    }
    return;
  }

  const line = getLine(n);

  switch (type) {
    // Export declarations - mark children as exported
    case "ExportNamedDeclaration":
    case "ExportDefaultDeclaration": {
      if (n.declaration) {
        walkNode(n.declaration, symbols, references, true);
      }
      break;
    }

    // Function declarations
    case "FunctionDeclaration": {
      const id = n.id as { name?: string } | null;
      if (id?.name) {
        symbols.push({
          name: id.name,
          kind: "function",
          exported: isExported,
          line,
        });
      }
      walkNode(n.body, symbols, references, false);
      break;
    }

    // Class declarations
    case "ClassDeclaration": {
      const id = n.id as { name?: string } | null;
      if (id?.name) {
        symbols.push({
          name: id.name,
          kind: "class",
          exported: isExported,
          line,
        });
      }
      walkNode(n.body, symbols, references, false);
      break;
    }

    // Variable declarations
    case "VariableDeclaration": {
      const declarations = n.declarations as unknown[];
      for (const decl of declarations) {
        walkVariableDeclarator(decl, symbols, isExported, line);

        if (decl && typeof decl === "object") {
          const { init } = decl as Record<string, unknown>;
          walkNode(init, symbols, references, false);
        }
      }
      break;
    }

    // TypeScript type alias
    case "TSTypeAliasDeclaration": {
      const id = n.id as { name?: string } | null;
      if (id?.name) {
        symbols.push({
          name: id.name,
          kind: "type",
          exported: isExported,
          line,
        });
      }
      break;
    }

    // TypeScript interface
    case "TSInterfaceDeclaration": {
      const id = n.id as { name?: string } | null;
      if (id?.name) {
        symbols.push({
          name: id.name,
          kind: "interface",
          exported: isExported,
          line,
        });
      }
      break;
    }

    // TypeScript enum
    case "TSEnumDeclaration": {
      const id = n.id as { name?: string } | null;
      if (id?.name) {
        symbols.push({
          name: id.name,
          kind: "enum",
          exported: isExported,
          line,
        });
      }
      break;
    }

    // TypeScript namespace/module
    case "TSModuleDeclaration": {
      const id = n.id as { name?: string } | null;
      if (id?.name) {
        symbols.push({
          name: id.name,
          kind: "namespace",
          exported: isExported,
          line,
        });
      }
      walkNode(n.body, symbols, references, false);
      break;
    }

    // Call expressions - track function calls
    case "CallExpression": {
      const callee = n.callee as Record<string, unknown> | null;
      const calleeName = getCalleeName(callee);
      if (calleeName) {
        references.push({ name: calleeName, kind: "call", line });
      }
      walkNode(callee, symbols, references, false);
      walkNode(n.arguments, symbols, references, false);
      break;
    }

    // Constructor calls
    case "NewExpression": {
      const callee = n.callee as Record<string, unknown> | null;
      const calleeName = getCalleeName(callee);
      if (calleeName) {
        references.push({ name: calleeName, kind: "call", line });
      }
      walkNode(callee, symbols, references, false);
      walkNode(n.arguments, symbols, references, false);
      break;
    }

    // Type references
    case "TSTypeReference": {
      const typeName = n.typeName as { name?: string } | null;
      if (typeName?.name) {
        references.push({ name: typeName.name, kind: "type", line });
      }
      break;
    }

    // Default: recurse into children
    default: {
      for (const [key, value] of Object.entries(n)) {
        if (
          key === "type" ||
          key === "loc" ||
          key === "range" ||
          key === "start" ||
          key === "end"
        ) {
          continue;
        }
        if (Array.isArray(value)) {
          for (const item of value) {
            walkNode(item, symbols, references, false);
          }
        } else if (value && typeof value === "object") {
          walkNode(value, symbols, references, false);
        }
      }
    }
  }
}

function walkVariableDeclarator(
  decl: unknown,
  symbols: Symbol[],
  isExported: boolean,
  line: number
): void {
  if (!decl || typeof decl !== "object") {
    return;
  }

  const d = decl as Record<string, unknown>;
  const id = d.id as Record<string, unknown> | null;

  if (!id) {
    return;
  }

  // Simple identifier
  if (id.type === "Identifier" && typeof id.name === "string") {
    // Check if initialized to function/class for better kind inference
    const init = d.init as Record<string, unknown> | null;
    let kind: "function" | "class" | "variable" = "variable";

    if (
      init?.type === "ArrowFunctionExpression" ||
      init?.type === "FunctionExpression"
    ) {
      kind = "function";
    } else if (init?.type === "ClassExpression") {
      kind = "class";
    }

    symbols.push({ name: id.name, kind, exported: isExported, line });
  }

  // Object pattern destructuring
  if (id.type === "ObjectPattern") {
    const properties = id.properties as unknown[];
    for (const prop of properties) {
      const p = prop as Record<string, unknown>;
      const key = p.key as { name?: string } | null;
      if (key?.name) {
        symbols.push({
          name: key.name,
          kind: "variable",
          exported: isExported,
          line,
        });
      }
    }
  }

  // Array pattern destructuring
  if (id.type === "ArrayPattern") {
    const elements = id.elements as unknown[];
    for (const el of elements) {
      if (el && typeof el === "object") {
        const e = el as Record<string, unknown>;
        if (e.type === "Identifier" && typeof e.name === "string") {
          symbols.push({
            name: e.name,
            kind: "variable",
            exported: isExported,
            line,
          });
        }
      }
    }
  }
}

function getCalleeName(callee: Record<string, unknown> | null): string | null {
  if (!callee) {
    return null;
  }

  // Direct call: foo()
  if (callee.type === "Identifier" && typeof callee.name === "string") {
    return callee.name;
  }

  // Member call: obj.method()
  if (callee.type === "MemberExpression") {
    const property = callee.property as { name?: string } | null;
    if (property?.name) {
      return property.name;
    }
  }

  return null;
}

function getLine(node: Record<string, unknown>): number {
  const loc = node.loc as { start?: { line?: number } } | null;
  return loc?.start?.line ?? 0;
}

// ─────────────────────────────────────────────────────────
// Keyword Extraction
// ─────────────────────────────────────────────────────────

function extractKeywords(
  path: string,
  exports: readonly string[],
  imports: readonly string[],
  symbols: readonly Symbol[]
): string[] {
  const keywords = new Set<string>();

  // Path segments
  for (const segment of path.split("/")) {
    for (const word of splitIdentifier(segment.replace(/\.[^.]+$/, ""))) {
      keywords.add(word);
    }
  }

  // Exports
  for (const exp of exports) {
    for (const word of splitIdentifier(exp)) {
      keywords.add(word);
    }
  }

  // Imports (package name only)
  for (const imp of imports) {
    const name =
      imp
        .split("/")
        .pop()
        ?.replace(/\.[^.]+$/, "") ?? "";
    for (const word of splitIdentifier(name)) {
      keywords.add(word);
    }
  }

  // Symbol names (adds function/class names not in exports)
  for (const sym of symbols) {
    for (const word of splitIdentifier(sym.name)) {
      keywords.add(word);
    }
  }

  return [...keywords].filter((k) => k.length >= 2);
}

function splitIdentifier(name: string): string[] {
  return name
    .replaceAll(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length >= 2);
}
