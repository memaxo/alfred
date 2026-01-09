import { describe, expect, it } from "bun:test";
import { AdminAppWindow } from "@/components/apps/admin";
import { MetricsAppWindow } from "@/components/apps/metrics";
import { PolicyAppWindow } from "@/components/apps/policy";
import { TaskManagerAppWindow } from "@/components/apps/taskmanager";
import { windowRegistry } from "../registry";

describe("Admin Windows Registration", () => {
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
});
