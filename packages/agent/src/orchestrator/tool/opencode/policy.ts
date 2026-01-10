import path from "node:path";
import { requireToolScopesAndPolicy } from "@alfred/auth/token";
import type { OpenCodeToolInput } from "./definition.js";

export async function enforcePolicy(input: OpenCodeToolInput) {
  await requireToolScopesAndPolicy(input.authz, ["droid.exec"], {
    action: "droid.exec",
    resource: {
      kind: "repo",
      id: input.cw ? path.resolve(input.cw) : undefined,
    },
    context: {
      auto: input.auto,
    },
  });
}
