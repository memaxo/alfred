export type ReviewCheckStatus = {
  id: string;
  type: string;
  status: "pending" | "running" | "passed" | "failed";
  attempts: number;
  evidence?: string;
};

export class ReviewGate {
  private readonly checks = new Map<string, ReviewCheckStatus>();
  private planInitialized = false;
  private planRequired = false;

  applyPlan(plan: { checks?: Array<{ id?: string; type?: string }> }): void {
    const items = Array.isArray(plan.checks) ? plan.checks : [];
    this.planInitialized = true;
    this.planRequired = items.length > 0;
    for (const item of items) {
      const id = typeof item.id === "string" && item.id.length > 0
        ? item.id
        : typeof item.type === "string" && item.type.length > 0
          ? item.type
          : undefined;
      if (!id) {
        continue;
      }
      const type = typeof item.type === "string" && item.type.length > 0
        ? item.type
        : "check";
      if (this.checks.has(id)) {
        continue;
      }
      this.checks.set(id, {
        id,
        type,
        status: "pending",
        attempts: 0,
      });
    }
  }

  recordCheck(result: {
    id?: string;
    type?: string;
    status?: string;
    attempt?: number;
    evidence?: string;
  }): void {
    const id = typeof result.id === "string" && result.id.length > 0
      ? result.id
      : typeof result.type === "string" && result.type.length > 0
        ? result.type
        : undefined;
    if (!id) {
      return;
    }
    const type = typeof result.type === "string" && result.type.length > 0
      ? result.type
      : "check";
    const normalizedStatus =
      result.status === "passed"
        ? "passed"
        : result.status === "failed"
          ? "failed"
          : result.status === "running"
            ? "running"
            : "pending";
    const attempts = Number.isFinite(result.attempt)
      ? Math.max(0, Number(result.attempt))
      : undefined;
    const existing = this.checks.get(id) ?? {
      id,
      type,
      status: "pending" as const,
      attempts: 0,
    };
    this.checks.set(id, {
      id,
      type,
      status: normalizedStatus,
      attempts: attempts ?? existing.attempts,
      evidence: result.evidence ?? existing.evidence,
    });
    if (!this.planInitialized) {
      this.planRequired = true;
    }
  }

  isSatisfied(): boolean {
    if (!this.planRequired) {
      return true;
    }
    if (this.checks.size === 0) {
      return false;
    }
    for (const check of this.checks.values()) {
      if (check.status !== "passed") {
        return false;
      }
    }
    return true;
  }

  summary(): ReviewCheckStatus[] {
    return Array.from(this.checks.values());
  }
}
