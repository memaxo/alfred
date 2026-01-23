import type { Obligation } from "@alfred/type";

export function requiresBiometric(obligations: Obligation[]): boolean {
  return obligations.some(
    (obligation) =>
      obligation.type === "biometric" ||
      (typeof obligation.metadata?.code === "string" &&
        obligation.metadata.code === "requireBio")
  );
}
