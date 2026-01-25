import type { SchemaContext, UIComponent } from "@alfred/type/genui";
import type { ModelRole } from "@alfred/type/model";
import type { ModelMessage } from "ai";

import { logger } from "@alfred/logger";
import {
  genuiSchemaGenerationDurationSeconds,
  genuiSchemaGenerationTotal,
} from "@alfred/metrics/genui";
import { uiComponentSchema } from "@alfred/type/genui.zod";

import { DefaultAIAdapter } from "./aigeneration";

export interface SchemaMeta {
  path: "deterministic" | "llm" | "skipped";
  selectedComponent: string | null;
  modelKey?: string;
  validationErrors?: string[];
}

export interface SchemaResult {
  ui: UIComponent | null;
  meta: SchemaMeta;
}

interface GenUiPart {
  type: "data-ui";
  ui: UIComponent;
  id?: string;
  // NOTE: ALFRED sometimes attaches backing data for convenience in UIs.
  // This is not part of the canonical UIDataPart type.
  data?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function coerceRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function isPrimitive(
  value: unknown
): value is string | number | boolean | null {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function looksLikeIsoDate(value: string): boolean {
  // Extremely small heuristic: allow YYYY-MM-DD... prefixes.
  // We do not parse Dates here (JSON boundary + perf).
  return /^\d{4}-\d{2}-\d{2}/.test(value);
}

function looksLikeTimestampValue(value: unknown): boolean {
  if (typeof value === "number") {
    // epoch seconds or ms
    return value > 1_000_000_000;
  }
  if (typeof value === "string") {
    if (looksLikeIsoDate(value)) {
      return true;
    }
    if (/^\d{10,13}$/.test(value)) {
      return true;
    }
  }
  return false;
}

function hasTimestampishField(obj: Record<string, unknown>): boolean {
  for (const k of [
    "timestamp",
    "time",
    "createdAt",
    "updatedAt",
    "startedAt",
  ]) {
    const v = obj[k];
    if (looksLikeTimestampValue(v)) {
      return true;
    }
  }
  return false;
}

function toValidationErrors(errors: unknown): string[] | undefined {
  if (!errors) {
    return;
  }
  if (Array.isArray(errors)) {
    return errors.map((e) => String(e));
  }
  return [String(errors)];
}

function safeJson(value: unknown, limit = 12_000): string {
  let text: string;
  try {
    text = JSON.stringify(value);
  } catch {
    text = JSON.stringify({ error: "unserializable" });
  }
  if (text.length <= limit) {
    return text;
  }
  return `${text.slice(0, limit)}…(truncated)`;
}

function validateUi(
  ui: UIComponent
): { ok: true; ui: UIComponent } | { ok: false; errors: string[] } {
  const parsed = uiComponentSchema.safeParse(ui);
  if (parsed.success) {
    return { ok: true, ui: parsed.data as UIComponent };
  }
  return {
    ok: false,
    errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
  };
}

function buildDeterministicUi(args: {
  component: string;
  props: Record<string, unknown>;
  children?: UIComponent[];
  key?: string;
}): SchemaResult {
  const candidate: UIComponent = {
    component: args.component,
    props: args.props,
    children: args.children,
    key: args.key,
  };

  const validated = validateUi(candidate);
  if (!validated.ok) {
    return {
      ui: null,
      meta: {
        path: "deterministic",
        selectedComponent: args.component,
        validationErrors: validated.errors,
      },
    };
  }
  return {
    ui: validated.ui,
    meta: { path: "deterministic", selectedComponent: args.component },
  };
}

function buildChartFromNumberArray(
  nums: number[],
  title?: string
): SchemaResult {
  const data = nums.map((value, idx) => ({
    name: `${idx + 1}`,
    value,
  }));
  return buildDeterministicUi({
    component: "chart",
    props: { title, data },
  });
}

function buildListFromRecords(
  records: Record<string, unknown>[]
): SchemaResult {
  const items = records.slice(0, 20).map((r, idx) => ({
    id: typeof r.id === "string" && r.id.length > 0 ? r.id : `row-${idx}`,
    content: safeJson(r, 800),
  }));
  return buildDeterministicUi({ component: "list", props: { items } });
}

function buildGridFromRecord(rec: Record<string, unknown>): SchemaResult {
  const entries = Object.entries(rec).slice(0, 24);
  const children: UIComponent[] = entries.map(([key, value]) => ({
    component: "panel",
    props: { title: key },
    children: [
      {
        component: "term",
        props: {
          title: key,
          lines: [
            { text: isPrimitive(value) ? String(value) : safeJson(value) },
          ],
        },
      },
    ],
  }));
  return buildDeterministicUi({
    component: "grid",
    props: { cols: 2 },
    children,
  });
}

interface SchemaGeneratorInit {
  role?: ModelRole;
}

export class SchemaGenerator {
  private readonly role: ModelRole;

  constructor(init: SchemaGeneratorInit = {}) {
    this.role = init.role ?? "classify";
  }

  selectComponent(data: unknown, ctx: SchemaContext): string | null {
    if (typeof data === "string") {
      return null;
    }
    if (data === null || data === undefined) {
      return null;
    }

    if (isRecord(data)) {
      const { kind } = data;
      if (typeof kind === "string" && kind.length > 0) {
        if (kind === "workflow-timeline") {
          return "workflow-timeline";
        }
        if (kind === "plan") {
          return "plan";
        }
      }

      // Plan-like structures: { phases: [...] }
      if (Array.isArray(data.phases)) {
        return ctx.mode === "workflow" ? "workflow-timeline" : "plan";
      }

      // Simple key-value: prefer grid
      const values = Object.values(data);
      if (values.length > 0 && values.every((v) => isPrimitive(v))) {
        return "grid";
      }
      return "grid";
    }

    if (Array.isArray(data)) {
      if (data.length === 0) {
        return null;
      }

      if (data.every((v) => typeof v === "number" && Number.isFinite(v))) {
        return "chart";
      }

      if (data.every((v) => typeof v === "string")) {
        return null;
      }

      if (data.every((v) => isRecord(v))) {
        const objs = data as Record<string, unknown>[];
        if (objs.some((o) => hasTimestampishField(o))) {
          // Prefer workflow-timeline when the data appears workflowish; list otherwise.
          if (ctx.mode === "workflow") {
            return "workflow-timeline";
          }
          return "list";
        }
        return "grid";
      }

      return "list";
    }

    return null;
  }

  buildDeterministic(args: {
    component: string;
    props: Record<string, unknown>;
    children?: UIComponent[];
    key?: string;
  }): SchemaResult {
    return buildDeterministicUi(args);
  }

  async generateSchema(args: {
    data: unknown;
    ctx: SchemaContext;
    preferredComponent?: string | null;
  }): Promise<SchemaResult> {
    const startedAt = performance.now();
    const picked =
      args.preferredComponent ?? this.selectComponent(args.data, args.ctx);
    const finish = (result: SchemaResult, outcome: string): SchemaResult => {
      const durationMs = performance.now() - startedAt;
      const component =
        result.ui?.component ??
        result.meta.selectedComponent ??
        args.preferredComponent ??
        "none";

      try {
        genuiSchemaGenerationTotal.inc({
          path: result.meta.path,
          outcome,
          component,
          surface: args.ctx.surface,
          mode: args.ctx.mode,
        });
        genuiSchemaGenerationDurationSeconds.observe(
          {
            path: result.meta.path,
            component,
            surface: args.ctx.surface,
            mode: args.ctx.mode,
          },
          durationMs / 1000
        );
      } catch {
        // Metrics are best-effort.
      }
      return result;
    };

    if (!picked) {
      return finish(
        { ui: null, meta: { path: "skipped", selectedComponent: null } },
        "no_component"
      );
    }

    // Fast path: deterministic builders for common shapes.
    if (picked === "chart" && Array.isArray(args.data)) {
      const nums = args.data.filter((v) => typeof v === "number") as number[];
      if (nums.length === args.data.length) {
        const out = buildChartFromNumberArray(nums);
        return finish(out, out.ui ? "success" : "invalid");
      }
    }

    if (picked === "grid" && isRecord(args.data)) {
      const out = buildGridFromRecord(args.data);
      return finish(out, out.ui ? "success" : "invalid");
    }

    if (
      picked === "list" &&
      Array.isArray(args.data) &&
      args.data.every(isRecord)
    ) {
      const out = buildListFromRecords(args.data);
      return finish(out, out.ui ? "success" : "invalid");
    }

    if (picked === "workflow-timeline" && isRecord(args.data)) {
      const rec = coerceRecord(args.data);
      if (
        typeof rec.workflowId === "string" &&
        Array.isArray(rec.phases) &&
        (rec.title === undefined || typeof rec.title === "string")
      ) {
        const out = this.buildDeterministic({
          component: "workflow-timeline",
          props: {
            workflowId: rec.workflowId,
            title: rec.title,
            phases: rec.phases,
            elapsed: typeof rec.elapsed === "number" ? rec.elapsed : 0,
          },
        });
        return finish(out, out.ui ? "success" : "invalid");
      }
    }

    if (picked === "plan" && isRecord(args.data)) {
      const rec = coerceRecord(args.data);
      if (isRecord(rec.plan)) {
        const out = this.buildDeterministic({
          component: "plan",
          props: { plan: rec.plan },
        });
        return finish(out, out.ui ? "success" : "invalid");
      }
    }

    // LLM path: capability gating + generateObject with uiComponentSchema.
    const { userId } = args.ctx;
    const { projectId } = args.ctx;
    if (!userId) {
      // Without identity we can't safely resolve preferences/model; skip.
      return finish(
        { ui: null, meta: { path: "skipped", selectedComponent: picked } },
        "missing_user"
      );
    }

    const { getModelForRole, supportsGenUI } = await import("../selector");
    const selection = projectId
      ? await getModelForRole(this.role, { userId, projectId })
      : await getModelForRole(this.role, { userId });

    if (!supportsGenUI(selection)) {
      return finish(
        {
          ui: null,
          meta: {
            path: "skipped",
            selectedComponent: picked,
            modelKey: selection.modelKey,
          },
        },
        "unsupported"
      );
    }

    const adapter = new DefaultAIAdapter({
      userId,
      projectId,
      role: this.role,
    });

    const candidates = [picked];
    if (picked === "workflow-timeline") {
      candidates.push("list");
    } else if (picked === "grid") {
      candidates.push("list");
    }

    const system = [
      "You generate a single JSON object that matches the provided Zod schema.",
      "You must only use registered component names provided by the caller.",
      "Props must be JSON-serializable (no functions, no undefined).",
      "Prefer shallow component trees (depth <= 5).",
      "If the data is best shown as plain text, choose the simplest component available (usually list).",
    ].join("\n");

    const prompt = [
      `Surface: ${args.ctx.surface}`,
      `Mode: ${args.ctx.mode}`,
      args.ctx.viewport
        ? `Viewport: ${safeJson(args.ctx.viewport, 200)}`
        : "Viewport: unknown",
      args.ctx.preference?.verbosity
        ? `Verbosity: ${args.ctx.preference.verbosity}`
        : "Verbosity: unspecified",
      "",
      `Allowed components: ${candidates.join(", ")}`,
      "",
      "Data (JSON):",
      safeJson(args.data),
      "",
      "Return a UIComponent schema that uses one of the allowed components and renders this data appropriately.",
      "Do not include markdown code fences. Do not include explanations.",
    ].join("\n");

    const messages: ModelMessage[] = [{ role: "user", content: prompt }];
    const start = performance.now();
    try {
      const result = await adapter.generateObject({
        messages,
        system,
        schema: uiComponentSchema,
      });
      const object = result.object as unknown;
      const parsed = uiComponentSchema.safeParse(object);
      const ms = performance.now() - start;

      if (!parsed.success) {
        return finish(
          {
            ui: null,
            meta: {
              path: "llm",
              selectedComponent: picked,
              modelKey: selection.modelKey,
              validationErrors: parsed.error.issues.map(
                (i) => `${i.path.join(".")}: ${i.message}`
              ),
            },
          },
          "invalid"
        );
      }

      logger.info("genui_schema_generated", {
        path: "llm",
        component: parsed.data.component,
        surface: args.ctx.surface,
        mode: args.ctx.mode,
        model: selection.modelKey,
        durationMs: Math.round(ms),
      });

      return finish(
        {
          ui: parsed.data as UIComponent,
          meta: {
            path: "llm",
            selectedComponent: parsed.data.component,
            modelKey: selection.modelKey,
          },
        },
        "success"
      );
    } catch (error) {
      return finish(
        {
          ui: null,
          meta: {
            path: "llm",
            selectedComponent: picked,
            modelKey: selection.modelKey,
            validationErrors: toValidationErrors(error),
          },
        },
        "error"
      );
    }
  }

  async toDataUiPart(args: {
    id?: string;
    data?: unknown;
    uiData: unknown;
    preferredComponent?: string | null;
    ctx: SchemaContext;
  }): Promise<GenUiPart | null> {
    const result = await this.generateSchema({
      data: args.uiData,
      ctx: args.ctx,
      preferredComponent: args.preferredComponent,
    });
    if (!result.ui) {
      return null;
    }
    return {
      type: "data-ui",
      id: args.id,
      ui: result.ui,
      data: args.data,
    };
  }
}
