/**
 * Generative UI Tests
 *
 * Tests for the genui module: registry, interpreter, and validation.
 */

import type { UIComponent } from "@alfred/type/genui";

import { isGenUIToolResult, isUIDataPart } from "@alfred/type/genui";
import {
  validateUIComponent,
  validateUIDataPart,
} from "@alfred/type/genui.zod";
import { beforeEach, describe, expect, test } from "bun:test";
import { createElement } from "react";

import { GenUIErrorBoundary, withGenUIErrorBoundary } from "../boundary";
import { canRender, renderUISchema, validateRenderable } from "../interpreter";
import {
  ArtifactBrowser,
  ErrorPanel,
  ProgressWindow,
  ResourceMonitor,
  StreamingTerminal,
  TaskTracker,
  WorkflowTimeline,
} from "../orchestrator";
import {
  clearRegistry,
  getRegisteredComponents,
  hasComponent,
  registerComponent,
  registerComponents,
  registrySize,
  resolveComponent,
} from "../registry";
import {
  createGenUIObjectConfig,
  GenUISkeleton,
  isPartialSchemaRenderable,
  StreamingUIRenderer,
} from "../streaming";
import {
  createArtifactsResult,
  createChartResult,
  createCodeResult,
  createErrorResult,
  createGenUIResult,
  createGridResult,
  createListResult,
  createLoadingResult,
  createPlanResult,
  createProgressResult,
  createResourceMonitorResult,
  createTaskResult,
  createTaskTrackerResult,
  createTerminalResult,
  createTermResult,
  createWorkflowResult,
} from "../tool";

// Test components
function TestButton({ label }: { label: string }) {
  return createElement("button", null, label);
}

function TestContainer({ children }: { children?: React.ReactNode }) {
  return createElement("div", { className: "container" }, children);
}

function TestText({ text }: { text: string }) {
  return createElement("span", null, text);
}

describe("genui/registry", () => {
  beforeEach(() => {
    clearRegistry();
  });

  test("registerComponent adds component to registry", () => {
    registerComponent("button", TestButton);
    expect(hasComponent("button")).toBe(true);
    expect(registrySize()).toBe(1);
  });

  test("registerComponents adds multiple components", () => {
    registerComponents({
      button: TestButton,
      container: TestContainer,
      text: TestText,
    });
    expect(registrySize()).toBe(3);
    expect(hasComponent("button")).toBe(true);
    expect(hasComponent("container")).toBe(true);
    expect(hasComponent("text")).toBe(true);
  });

  test("resolveComponent returns registered component", () => {
    registerComponent("button", TestButton);
    const component = resolveComponent("button");
    expect(component).toBe(TestButton);
  });

  test("resolveComponent returns null for unknown component", () => {
    const component = resolveComponent("unknown");
    expect(component).toBeNull();
  });

  test("getRegisteredComponents returns all names", () => {
    registerComponents({
      button: TestButton,
      container: TestContainer,
    });
    const names = getRegisteredComponents();
    expect(names).toContain("button");
    expect(names).toContain("container");
    expect(names.length).toBe(2);
  });

  test("clearRegistry removes all components", () => {
    registerComponents({
      button: TestButton,
      container: TestContainer,
    });
    expect(registrySize()).toBe(2);
    clearRegistry();
    expect(registrySize()).toBe(0);
  });
});

describe("genui/interpreter", () => {
  beforeEach(() => {
    clearRegistry();
    registerComponents({
      button: TestButton,
      container: TestContainer,
      text: TestText,
    });
  });

  test("canRender returns true for registered component", () => {
    expect(canRender("button")).toBe(true);
  });

  test("canRender returns false for unknown component", () => {
    expect(canRender("unknown")).toBe(false);
  });

  test("validateRenderable returns valid for known components", () => {
    const schema: UIComponent = {
      component: "container",
      props: {},
      children: [{ component: "button", props: { label: "Click" } }],
    };
    const result = validateRenderable(schema);
    expect(result.valid).toBe(true);
    expect(result.missing).toEqual([]);
  });

  test("validateRenderable returns missing for unknown components", () => {
    const schema: UIComponent = {
      component: "container",
      props: {},
      children: [{ component: "unknown", props: {} }],
    };
    const result = validateRenderable(schema);
    expect(result.valid).toBe(false);
    expect(result.missing).toContain("unknown");
  });

  test("renderUISchema renders single component", () => {
    const schema: UIComponent = {
      component: "button",
      props: { label: "Click me" },
    };
    const result = renderUISchema(schema);
    expect(result).not.toBeNull();
    // Verify it's a React element with correct type
    expect(result).toHaveProperty("type", TestButton);
    expect(result).toHaveProperty("props.label", "Click me");
  });

  test("renderUISchema renders nested components", () => {
    const schema: UIComponent = {
      component: "container",
      props: {},
      children: [
        { component: "text", props: { text: "Hello" } },
        { component: "button", props: { label: "World" } },
      ],
    };
    const result = renderUISchema(schema);
    expect(result).not.toBeNull();
    // Verify container type and children count
    expect(result).toHaveProperty("type", TestContainer);
    expect(result.props.children).toHaveLength(2);
  });

  test("renderUISchema handles unknown component with placeholder", () => {
    const schema: UIComponent = {
      component: "unknown",
      props: { foo: "bar" },
    };
    const result = renderUISchema(schema);
    expect(result).not.toBeNull();
    // Unknown components render as UnknownComponent wrapper
    expect(typeof result.type).toBe("function");
    expect(result.props.name).toBe("unknown");
  });

  test("renderUISchema respects maxDepth option", () => {
    // Create a deeply nested structure
    const deepSchema: UIComponent = {
      component: "container",
      props: {},
      children: [
        {
          component: "container",
          props: {},
          children: [
            {
              component: "container",
              props: {},
              children: [
                {
                  component: "text",
                  props: { text: "Deep" },
                },
              ],
            },
          ],
        },
      ],
    };

    // With maxDepth=2, the innermost should be truncated
    const result = renderUISchema(deepSchema, { maxDepth: 2 });
    expect(result).not.toBeNull();
    // Should still be a container at root
    expect(result).toHaveProperty("type", TestContainer);
  });
});

describe("genui/validation", () => {
  test("validateUIComponent accepts valid schema", () => {
    const schema = {
      component: "button",
      props: { label: "Click" },
    };
    const result = validateUIComponent(schema);
    expect(result.valid).toBe(true);
    expect(result.component).toBeDefined();
  });

  test("validateUIComponent rejects empty component name", () => {
    const schema = {
      component: "",
      props: {},
    };
    const result = validateUIComponent(schema);
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors?.length).toBeGreaterThan(0);
  });

  test("validateUIComponent accepts nested children", () => {
    const schema = {
      component: "container",
      props: {},
      children: [
        { component: "button", props: { label: "A" } },
        { component: "button", props: { label: "B" } },
      ],
    };
    const result = validateUIComponent(schema);
    expect(result.valid).toBe(true);
  });

  test("validateUIDataPart accepts valid data-ui part", () => {
    const part = {
      type: "data-ui",
      ui: {
        component: "button",
        props: { label: "Click" },
      },
    };
    const result = validateUIDataPart(part);
    expect(result.valid).toBe(true);
    expect(result.part).toBeDefined();
  });

  test("validateUIDataPart rejects wrong type", () => {
    const part = {
      type: "data-other",
      ui: {
        component: "button",
        props: {},
      },
    };
    const result = validateUIDataPart(part);
    expect(result.valid).toBe(false);
  });
});

describe("genui/schema edge cases", () => {
  test("validateUIComponent handles null input gracefully", () => {
    const result = validateUIComponent(null);
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  test("validateUIComponent handles undefined input gracefully", () => {
    const result = validateUIComponent(undefined);
    expect(result.valid).toBe(false);
  });

  test("validateUIComponent accepts special characters in component name", () => {
    const schema = {
      component: "my-custom-component_v2",
      props: {},
    };
    const result = validateUIComponent(schema);
    expect(result.valid).toBe(true);
  });

  test("validateUIComponent accepts unicode in props", () => {
    const schema = {
      component: "text",
      props: { content: "Hello 世界 🌍" },
    };
    const result = validateUIComponent(schema);
    expect(result.valid).toBe(true);
    expect(result.component?.props.content).toBe("Hello 世界 🌍");
  });

  test("validateUIComponent handles deeply nested schemas", () => {
    // Create 50-level deep nesting
    let schema: UIComponent = { component: "leaf", props: {} };
    for (let i = 0; i < 50; i++) {
      schema = { component: "container", props: {}, children: [schema] };
    }
    const result = validateUIComponent(schema);
    expect(result.valid).toBe(true);
  });

  test("validateUIComponent handles empty children array", () => {
    const schema = {
      component: "container",
      props: {},
      children: [],
    };
    const result = validateUIComponent(schema);
    expect(result.valid).toBe(true);
    expect(result.component?.children).toEqual([]);
  });

  test("validateUIComponent handles props with various types", () => {
    const schema = {
      component: "complex",
      props: {
        stringProp: "hello",
        numberProp: 42,
        boolProp: true,
        nullProp: null,
        arrayProp: [1, 2, 3],
        objectProp: { nested: "value" },
      },
    };
    const result = validateUIComponent(schema);
    expect(result.valid).toBe(true);
    expect(result.component?.props.numberProp).toBe(42);
    expect(result.component?.props.boolProp).toBe(true);
  });

  test("validateUIComponent rejects non-object input", () => {
    expect(validateUIComponent("string").valid).toBe(false);
    expect(validateUIComponent(123).valid).toBe(false);
    expect(validateUIComponent([]).valid).toBe(false);
  });
});

describe("genui/type guards", () => {
  test("isUIDataPart returns true for valid part", () => {
    const part = {
      type: "data-ui",
      ui: {
        component: "button",
        props: {},
      },
    };
    expect(isUIDataPart(part)).toBe(true);
  });

  test("isUIDataPart returns false for invalid type", () => {
    const part = {
      type: "data-other",
      ui: {
        component: "button",
        props: {},
      },
    };
    expect(isUIDataPart(part)).toBe(false);
  });

  test("isUIDataPart returns false for missing ui", () => {
    const part = {
      type: "data-ui",
    };
    expect(isUIDataPart(part)).toBe(false);
  });

  test("isGenUIToolResult returns true for valid result", () => {
    const result = {
      ui: {
        component: "button",
        props: {},
      },
      data: { foo: "bar" },
    };
    expect(isGenUIToolResult(result)).toBe(true);
  });

  test("isGenUIToolResult returns false for missing ui", () => {
    const result = {
      data: { foo: "bar" },
    };
    expect(isGenUIToolResult(result)).toBe(false);
  });
});

describe("genui/error boundary", () => {
  beforeEach(() => {
    clearRegistry();
  });

  test("GenUIErrorBoundary is exported", () => {
    expect(GenUIErrorBoundary).toBeDefined();
    expect(typeof GenUIErrorBoundary).toBe("function");
  });

  test("withGenUIErrorBoundary is exported", () => {
    expect(withGenUIErrorBoundary).toBeDefined();
    expect(typeof withGenUIErrorBoundary).toBe("function");
  });

  test("withGenUIErrorBoundary wraps component", () => {
    function TestComponent() {
      return createElement("div", null, "test");
    }
    const Wrapped = withGenUIErrorBoundary(TestComponent);
    expect(Wrapped.displayName).toBe("withGenUIErrorBoundary(TestComponent)");
  });

  test("GenUIErrorBoundary renders children when no error", () => {
    registerComponent("button", TestButton);
    const schema: UIComponent = { component: "button", props: { label: "OK" } };
    const child = renderUISchema(schema);

    const element = createElement(GenUIErrorBoundary, { schema }, child);
    expect(element).not.toBeNull();
    expect(element.props.children).toBe(child);
  });

  test("GenUIErrorBoundary provides schema context for error recovery", () => {
    const schema: UIComponent = {
      component: "failing",
      props: { dangerous: true },
    };
    const element = createElement(
      GenUIErrorBoundary,
      { schema },
      createElement("div", null, "content")
    );
    expect(element.props.schema).toBe(schema);
  });
});

describe("genui/tool integration", () => {
  test("createGenUIResult creates valid result", () => {
    const result = createGenUIResult(
      { component: "chart", props: { data: [] } },
      { raw: "data" }
    );
    expect(result.ui.component).toBe("chart");
    expect(result.data).toEqual({ raw: "data" });
  });

  test("createChartResult creates chart UI", () => {
    const result = createChartResult("Test Chart", [{ x: "A", y: 10 }], {
      total: 10,
    });
    expect(result.ui.component).toBe("chart");
    expect(result.ui.props.title).toBe("Test Chart");
    expect(result.data).toEqual({ total: 10 });
  });

  test("createGridResult creates grid UI with children", () => {
    const children: UIComponent[] = [
      { component: "chart", props: {} },
      { component: "list", props: {} },
    ];
    const result = createGridResult(children, { items: [] }, 2);
    expect(result.ui.component).toBe("grid");
    expect(result.ui.props.cols).toBe(2);
    expect(result.ui.children).toHaveLength(2);
  });

  test("createListResult creates list UI", () => {
    const items = [
      { id: "1", content: "Item 1" },
      { id: "2", content: "Item 2" },
    ];
    const result = createListResult(items, { count: 2 });
    expect(result.ui.component).toBe("list");
    expect(result.data).toEqual({ count: 2 });
  });

  test("createTermResult creates terminal UI", () => {
    const lines = [
      { text: "$ ls", type: "input" as const },
      { text: "file.txt", type: "output" as const },
    ];
    const result = createTermResult("Terminal", lines, { exitCode: 0 });
    expect(result.ui.component).toBe("term");
    expect(result.ui.props.title).toBe("Terminal");
  });

  test("createCodeResult creates code UI", () => {
    const result = createCodeResult("const x = 1;", "typescript", {
      parsed: true,
    });
    expect(result.ui.component).toBe("code");
    expect(result.ui.props.code).toBe("const x = 1;");
    expect(result.ui.props.language).toBe("typescript");
  });

  test("createLoadingResult creates loading UI", () => {
    const result = createLoadingResult("Loading data...");
    expect(result.ui.component).toBe("loading");
    expect(result.ui.props.message).toBe("Loading data...");
    expect(result.data).toBeNull();
  });

  test("createPlanResult creates plan UI", () => {
    const tasks = [
      { id: "1", title: "Task 1", status: "completed" as const },
      { id: "2", title: "Task 2", status: "pending" as const },
    ];
    const result = createPlanResult("Build feature", tasks, { version: 1 });
    expect(result.ui.component).toBe("plan");
    expect(result.ui.props.plan.requirement).toBe("Build feature");
  });

  test("createTaskResult creates task UI", () => {
    const result = createTaskResult("t1", "Build UI", "running", 50, {
      startedAt: "now",
    });
    expect(result.ui.component).toBe("task");
    expect(result.ui.props.title).toBe("Build UI");
    expect(result.ui.props.progress).toBe(50);
  });
});

describe("genui/tool result validation", () => {
  test("createGenUIResult produces valid UIComponent", () => {
    const result = createGenUIResult(
      { component: "test", props: { value: 42 } },
      { raw: "data" }
    );
    const validation = validateUIComponent(result.ui);
    expect(validation.valid).toBe(true);
    expect(validation.component?.component).toBe("test");
  });

  test("createChartResult produces valid UIComponent", () => {
    const result = createChartResult("Sales", [{ x: "Q1", y: 100 }], {});
    const validation = validateUIComponent(result.ui);
    expect(validation.valid).toBe(true);
    expect(validation.component?.props.title).toBe("Sales");
    expect(validation.component?.props.data).toHaveLength(1);
  });

  test("createGridResult produces valid nested structure", () => {
    const children: UIComponent[] = [
      { component: "a", props: {} },
      { component: "b", props: {} },
    ];
    const result = createGridResult(children, {}, 3);
    const validation = validateUIComponent(result.ui);
    expect(validation.valid).toBe(true);
    expect(validation.component?.children).toHaveLength(2);
    expect(validation.component?.props.cols).toBe(3);
  });

  test("createListResult produces valid UIComponent with items", () => {
    const items = [
      { id: "1", content: "A" },
      { id: "2", content: "B" },
    ];
    const result = createListResult(items, { total: 2 });
    const validation = validateUIComponent(result.ui);
    expect(validation.valid).toBe(true);
    expect(validation.component?.props.items).toHaveLength(2);
  });

  test("createTerminalResult produces valid orchestrator schema", () => {
    const result = createTerminalResult(
      "Build",
      [{ type: "stdout", content: "OK" }],
      "completed",
      10,
      {}
    );
    const validation = validateUIComponent(result.ui);
    expect(validation.valid).toBe(true);
    expect(validation.component?.component).toBe("streaming-terminal");
  });

  test("createWorkflowResult produces valid phases structure", () => {
    const result = createWorkflowResult(
      "wf-1",
      "Deploy",
      [
        {
          id: "p1",
          name: "Build",
          status: "completed",
          progress: 100,
          tasks: [{ id: "t1", name: "Compile", status: "completed" }],
        },
      ],
      60,
      {}
    );
    const validation = validateUIComponent(result.ui);
    expect(validation.valid).toBe(true);
    expect(validation.component?.props.phases).toHaveLength(1);
    expect(validation.component?.props.phases[0].tasks).toHaveLength(1);
  });

  test("isGenUIToolResult validates tool helper outputs", () => {
    const chartResult = createChartResult("Test", [], {});
    const listResult = createListResult([], {});
    const termResult = createTerminalResult("T", [], "running", 0, {});

    expect(isGenUIToolResult(chartResult)).toBe(true);
    expect(isGenUIToolResult(listResult)).toBe(true);
    expect(isGenUIToolResult(termResult)).toBe(true);
  });
});

describe("genui/streaming", () => {
  beforeEach(() => {
    clearRegistry();
    registerComponents({
      button: TestButton,
      container: TestContainer,
      text: TestText,
    });
  });

  test("GenUISkeleton renders default variant", () => {
    const result = GenUISkeleton({ variant: "default" });
    expect(result).not.toBeNull();
    expect(result).toHaveProperty("type", "div");
    expect(result.props.style).toHaveProperty("animation");
  });

  test("GenUISkeleton renders chart variant", () => {
    const result = GenUISkeleton({ variant: "chart" });
    expect(result).not.toBeNull();
    expect(result).toHaveProperty("type", "div");
    expect(result.props.style.height).toBe("200px");
  });

  test("GenUISkeleton renders list variant", () => {
    const result = GenUISkeleton({ variant: "list" });
    expect(result).not.toBeNull();
    expect(result).toHaveProperty("type", "div");
    // List variant has flexDirection column
    expect(result.props.style.flexDirection).toBe("column");
    // List variant renders 3 child skeletons
    expect(result.props.children).toHaveLength(3);
  });

  test("GenUISkeleton renders card variant", () => {
    const result = GenUISkeleton({ variant: "card" });
    expect(result).not.toBeNull();
    expect(result).toHaveProperty("type", "div");
    // Card variant has padding and column layout
    expect(result.props.style.padding).toBe("16px");
    expect(result.props.style.flexDirection).toBe("column");
  });

  test("isPartialSchemaRenderable returns false for undefined", () => {
    expect(isPartialSchemaRenderable(undefined)).toBe(false);
  });

  test("isPartialSchemaRenderable returns false for empty object", () => {
    expect(isPartialSchemaRenderable({})).toBe(false);
  });

  test("isPartialSchemaRenderable returns false for empty component", () => {
    expect(isPartialSchemaRenderable({ component: "" })).toBe(false);
  });

  test("isPartialSchemaRenderable returns true for valid partial", () => {
    expect(isPartialSchemaRenderable({ component: "chart" })).toBe(true);
  });

  test("isPartialSchemaRenderable returns true for complete schema", () => {
    expect(
      isPartialSchemaRenderable({ component: "chart", props: { data: [] } })
    ).toBe(true);
  });

  test("createGenUIObjectConfig creates valid config", () => {
    const config = createGenUIObjectConfig({
      api: "/api/genui",
      headers: { "X-Custom": "value" },
    });
    expect(config.api).toBe("/api/genui");
    expect(config.headers).toEqual({ "X-Custom": "value" });
    expect(config.schema).toBeDefined();
  });

  test("StreamingUIRenderer returns null for undefined schema", () => {
    const result = StreamingUIRenderer({
      schema: undefined,
      isStreaming: false,
    });
    expect(result).toBeNull();
  });

  test("StreamingUIRenderer shows skeleton when streaming with incomplete schema", () => {
    const result = StreamingUIRenderer({
      schema: {},
      isStreaming: true,
    });
    expect(result).not.toBeNull();
  });

  test("StreamingUIRenderer renders complete schema", () => {
    const result = StreamingUIRenderer({
      schema: { component: "button", props: { label: "Test" } },
      isStreaming: false,
    });
    expect(result).not.toBeNull();
  });
});

describe("genui/orchestrator components", () => {
  test("StreamingTerminal renders", () => {
    const result = StreamingTerminal({
      title: "Build Output",
      output: [
        { type: "stdout", content: "Building..." },
        { type: "stderr", content: "Warning: deprecated API" },
      ],
      status: "running",
      elapsed: 30,
    });
    expect(result).not.toBeNull();
  });

  test("ProgressWindow renders", () => {
    const result = ProgressWindow({
      title: "Docker Build",
      operation: "Building image app:latest",
      progress: 65,
      status: "running",
      elapsed: 120,
      currentStep: "Step 6/10: npm install",
    });
    expect(result).not.toBeNull();
  });

  test("WorkflowTimeline renders", () => {
    const result = WorkflowTimeline({
      workflowId: "wf-123",
      title: "Deploy Pipeline",
      phases: [
        {
          id: "scan",
          name: "Scan",
          status: "completed",
          progress: 100,
          tasks: [
            { id: "t1", name: "Analyze", status: "completed", duration: 5 },
          ],
        },
        {
          id: "plan",
          name: "Plan",
          status: "running",
          progress: 50,
          tasks: [{ id: "t2", name: "Generate", status: "running" }],
        },
      ],
      elapsed: 60,
    });
    expect(result).not.toBeNull();
  });

  test("TaskTracker renders", () => {
    const result = TaskTracker({
      taskId: "UPID:pve1:00000001",
      operation: "Creating LXC container",
      status: "running",
      elapsed: 45,
      progress: 75,
      currentStep: "Downloading template",
    });
    expect(result).not.toBeNull();
  });

  test("ErrorPanel renders", () => {
    const result = ErrorPanel({
      message: "npm ERR! ENOENT: no such file or directory",
      code: "ENOENT",
      context: {
        operation: "docker.build",
        step: "Step 6/10",
        exitCode: 1,
      },
    });
    expect(result).not.toBeNull();
  });

  test("ArtifactBrowser renders", () => {
    const result = ArtifactBrowser({
      title: "Build Artifacts",
      artifacts: [
        { path: "/app/Dockerfile", kind: "dockerfile", size: 1024 },
        { path: "/app/docker-compose.yml", kind: "yaml", size: 856 },
      ],
      executionId: "exec-123",
    });
    expect(result).not.toBeNull();
  });

  test("ResourceMonitor renders", () => {
    const result = ResourceMonitor({
      title: "Docker Containers",
      resources: [
        {
          id: "c1",
          name: "app-1",
          type: "container",
          status: "running",
          cpu: 45,
          memory: 2_147_483_648,
          ports: [{ host: 3000, container: 3000 }],
        },
      ],
      autoRefresh: true,
      refreshInterval: 5,
    });
    expect(result).not.toBeNull();
  });
});

describe("genui/orchestrator tool helpers", () => {
  test("createTerminalResult creates streaming-terminal UI", () => {
    const result = createTerminalResult(
      "Build",
      [{ type: "stdout", content: "Done" }],
      "completed",
      30,
      { exitCode: 0 }
    );
    expect(result.ui.component).toBe("streaming-terminal");
    expect(result.ui.props.title).toBe("Build");
    expect(result.data.exitCode).toBe(0);
  });

  test("createProgressResult creates progress-window UI", () => {
    const result = createProgressResult(
      "Docker Build",
      "Building app:latest",
      65,
      "running",
      120,
      { imageId: "sha256:abc" },
      { currentStep: "npm install" }
    );
    expect(result.ui.component).toBe("progress-window");
    expect(result.ui.props.progress).toBe(65);
    expect(result.ui.props.currentStep).toBe("npm install");
  });

  test("createWorkflowResult creates workflow-timeline UI", () => {
    const result = createWorkflowResult(
      "wf-1",
      "Deploy",
      [
        {
          id: "p1",
          name: "Scan",
          status: "completed",
          progress: 100,
          tasks: [],
        },
      ],
      60,
      { runId: "run-123" }
    );
    expect(result.ui.component).toBe("workflow-timeline");
    expect(result.ui.props.workflowId).toBe("wf-1");
  });

  test("createTaskTrackerResult creates task-tracker UI", () => {
    const result = createTaskTrackerResult(
      "UPID:123",
      "Create VM",
      "running",
      45,
      { vmid: 101 },
      { progress: 50 }
    );
    expect(result.ui.component).toBe("task-tracker");
    expect(result.ui.props.taskId).toBe("UPID:123");
  });

  test("createErrorResult creates error-panel UI", () => {
    const result = createErrorResult(
      "Build failed",
      { stderr: "error output" },
      { code: "BUILD_FAIL", context: { operation: "build", exitCode: 1 } }
    );
    expect(result.ui.component).toBe("error-panel");
    expect(result.ui.props.message).toBe("Build failed");
    expect(result.ui.props.code).toBe("BUILD_FAIL");
  });

  test("createArtifactsResult creates artifact-browser UI", () => {
    const result = createArtifactsResult(
      [{ path: "/app/out.log", kind: "log", size: 1024 }],
      { count: 1 },
      { title: "Outputs" }
    );
    expect(result.ui.component).toBe("artifact-browser");
    expect(result.ui.props.artifacts).toHaveLength(1);
  });

  test("createResourceMonitorResult creates resource-monitor UI", () => {
    const result = createResourceMonitorResult(
      [
        {
          id: "c1",
          name: "app",
          type: "container",
          status: "running",
          cpu: 50,
          memory: 1_073_741_824,
        },
      ],
      { total: 1 },
      { autoRefresh: true }
    );
    expect(result.ui.component).toBe("resource-monitor");
    expect(result.ui.props.resources).toHaveLength(1);
  });
});
