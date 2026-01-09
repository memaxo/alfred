import { describe, expect, it } from "bun:test";
import { getSpawnActions } from "../desktop-actions";

describe("Desktop Actions", () => {
  it("includes spawn-admin action", () => {
    const actions = getSpawnActions();
    const adminAction = actions.find((a) => a.id === "spawn-admin");
    expect(adminAction).toBeDefined();
    expect(adminAction?.label).toBe("New Admin");
  });

  it("includes spawn-metrics action", () => {
    const actions = getSpawnActions();
    const metricsAction = actions.find((a) => a.id === "spawn-metrics");
    expect(metricsAction).toBeDefined();
    expect(metricsAction?.label).toBe("New Metrics");
  });

  it("includes spawn-policy action", () => {
    const actions = getSpawnActions();
    const policyAction = actions.find((a) => a.id === "spawn-policy");
    expect(policyAction).toBeDefined();
    expect(policyAction?.label).toBe("New Policy");
  });

  it("includes spawn-taskmanager action", () => {
    const actions = getSpawnActions();
    const tmAction = actions.find((a) => a.id === "spawn-taskmanager");
    expect(tmAction).toBeDefined();
    expect(tmAction?.label).toBe("New Task Manager");
  });

  it("includes spawn-code action", () => {
    const actions = getSpawnActions();
    const action = actions.find((a) => a.id === "spawn-code");
    expect(action).toBeDefined();
    expect(action?.label).toBe("New Code");
  });

  it("includes spawn-files action", () => {
    const actions = getSpawnActions();
    const action = actions.find((a) => a.id === "spawn-files");
    expect(action).toBeDefined();
    expect(action?.label).toBe("New Files");
  });

  it("includes spawn-docker action", () => {
    const actions = getSpawnActions();
    const action = actions.find((a) => a.id === "spawn-docker");
    expect(action).toBeDefined();
    expect(action?.label).toBe("New Docker");
  });

  it("includes spawn-pr-review action", () => {
    const actions = getSpawnActions();
    const action = actions.find((a) => a.id === "spawn-pr-review");
    expect(action).toBeDefined();
    expect(action?.label).toBe("New PR Review");
  });
});
