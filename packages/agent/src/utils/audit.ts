import type { PolicyResource } from "@alfred/policy";

type AuditArgs = {
  userId: string | null;
  projectId?: string | null;
  action: string;
  resource: PolicyResource | { kind: string; id?: string };
  decision?: "allow" | "deny";
  obligations?: string[];
  context?: Record<string, unknown>;
  traceId?: string | null;
};

export async function recordAudit(args: AuditArgs): Promise<void> {
  try {
    if (!process.env.DATABASE_URL) {
      return;
    }
    const policyRepo = await import("@alfred/db/repo/policy");
    await policyRepo.createAuditLog({
      userId: args.userId ?? "",
      projectId: args.projectId ?? undefined,
      action: args.action,
      resource: args.resource,
      decision: args.decision ?? "allow",
      obligations: args.obligations ?? [],
      context: args.context ?? {},
      traceId: args.traceId ?? null,
    });
  } catch (_) {
    // Audits must never break primary flow
  }
}
