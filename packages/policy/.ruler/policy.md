# Policy Enforcement

1. **PDP Pattern.** Use the Policy Decision Point (PDP) for all authorization logic. Call `decide()` with user context, action, and resource.

2. **Rule-Based Access.** Define policies as pure rule functions. Avoid embedding permission logic directly in routers or repos.

3. **Biometric Elevation.** Sensitive actions require `requireRecentBiometric` check. Enforce TTL (≤ 2 minutes) for bio-tickets.

4. **Audit Logging.** Record every policy decision via `policyRepo.createAuditLog`.
