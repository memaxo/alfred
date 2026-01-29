import { describe, expect, it } from "bun:test";

import {
  AdminAppWindow,
  AgentFSAppWindow,
  AgentsAppWindow,
  ChatAppWindow,
  DockerAppWindow,
  FilesAppWindow,
  KnowledgeAppWindow,
  LinearAppWindow,
  MetricsAppWindow,
  PolicyAppWindow,
  PRReviewAppWindow,
  TaskManagerAppWindow,
} from "@/components/apps";
import { WorkflowWindow } from "@/components/windows/workflow/workflow-window";

import { windowRegistry } from "../registry";

describe("Window Registry Registration", () => {
  it("should have admin window registered with correct component", () => {
    const entry = windowRegistry.admin;
    expect(entry).toBeDefined();
    expect(entry.type).toBe("admin");
    expect(entry.component).toBe(AdminAppWindow);
    expect(entry.metadata.label).toBe("Admin");
  });

  it("should have metrics window registered with correct component", () => {
    const entry = windowRegistry.metrics;
    expect(entry).toBeDefined();
    expect(entry.component).toBe(MetricsAppWindow);
    expect(entry.metadata.label).toBe("Metrics");
  });

  it("should have policy window registered with correct component", () => {
    const entry = windowRegistry.policy;
    expect(entry).toBeDefined();
    expect(entry.component).toBe(PolicyAppWindow);
    expect(entry.metadata.label).toBe("Policy");
  });

  it("should have taskmanager window registered with correct component", () => {
    const entry = windowRegistry.taskmanager;
    expect(entry).toBeDefined();
    expect(entry.component).toBe(TaskManagerAppWindow);
    expect(entry.metadata.label).toBe("Task Manager");
  });

  it("should have code window registered with correct component", () => {
    const entry = windowRegistry.code;
    expect(entry).toBeDefined();
    expect(typeof entry.component).toBe("function");
    expect(entry.metadata.label).toBe("Code");
  });

  it("should have files window registered with correct component", () => {
    const entry = windowRegistry.files;
    expect(entry).toBeDefined();
    expect(entry.component).toBe(FilesAppWindow);
    expect(entry.metadata.label).toBe("Files");
  });

  it("should have chat window registered with correct component", () => {
    const entry = windowRegistry.chat;
    expect(entry).toBeDefined();
    expect(entry.component).toBe(ChatAppWindow);
    expect(entry.metadata.label).toBe("Chat");
  });

  it("should have workflow window registered with correct component", () => {
    const entry = windowRegistry.workflow;
    expect(entry).toBeDefined();
    expect(entry.component).toBe(WorkflowWindow);
    expect(entry.metadata.label).toBe("Workflow");
  });

  it("should have agents window registered with correct component", () => {
    const entry = windowRegistry.agents;
    expect(entry).toBeDefined();
    expect(entry.component).toBe(AgentsAppWindow);
    expect(entry.metadata.label).toBe("Agent Waves");
  });

  it("should have docker window registered with correct component", () => {
    const entry = windowRegistry.docker;
    expect(entry).toBeDefined();
    expect(entry.component).toBe(DockerAppWindow);
    expect(entry.metadata.label).toBe("Docker");
  });

  it("should have pr-review window registered with correct component", () => {
    const entry = windowRegistry["pr-review"];
    expect(entry).toBeDefined();
    expect(entry.component).toBe(PRReviewAppWindow);
    expect(entry.metadata.label).toBe("PR Review");
  });

  it("should have agentfs window registered with correct component", () => {
    const entry = windowRegistry.agentfs;
    expect(entry).toBeDefined();
    expect(entry.component).toBe(AgentFSAppWindow);
    expect(entry.metadata.label).toBe("AgentFS");
  });

  it("should have knowledge window registered with correct component", () => {
    const entry = windowRegistry.knowledge;
    expect(entry).toBeDefined();
    expect(entry.component).toBe(KnowledgeAppWindow);
    expect(entry.metadata.label).toBe("Knowledge");
  });

  it("should have linear window registered with correct component", () => {
    const entry = windowRegistry.linear;
    expect(entry).toBeDefined();
    expect(entry.component).toBe(LinearAppWindow);
    expect(entry.metadata.label).toBe("Linear");
  });
});
