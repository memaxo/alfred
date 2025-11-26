# Security and Autonomy

**Owner:** Policy  
**Last Updated:** 2025-11-26

## Purpose

This guide explains ALFRED's security model and graduated autonomy system—how policy enforcement protects against unauthorized actions, how biometric elevation gates high-risk operations, and how autonomy adapts based on demonstrated reliability.

---

An AI assistant with the power to modify infrastructure, manage data, and execute code must operate within strict security boundaries. Unrestricted autonomy risks catastrophic mistakes—a misunderstood command could delete production data or deploy broken code. But excessive restriction defeats the purpose of having an assistant—if every action requires manual approval, automation provides no value.

ALFRED navigates this tension through graduated autonomy: a spectrum from fully restricted to fully autonomous, where current position depends on demonstrated reliability, operation risk, and explicit policy rules. Low-risk operations proceed without friction; high-risk operations require biometric confirmation. The system learns which autonomy level is appropriate and adapts over time.

## Core Concepts

The Policy Decision Point (PDP) evaluates every sensitive operation against configured rules. When ALFRED attempts an action—deploying code, deleting data, modifying configuration—the PDP receives the request context (who is asking, what resource is targeted, what action is requested) and returns a decision: allow, deny, or allow with obligations.

Obligations are conditions that must be satisfied before an allowed action can proceed. The most common obligation is biometric verification—requiring the user to authenticate with a passkey or biometric before the action executes. Obligations enable nuanced policy: rather than blanket denials, the system can permit risky actions with appropriate safeguards.

Token scoping limits what operations an authenticated session can perform. Rather than granting broad access, ALFRED issues tokens with explicit scope lists. A token might permit read operations but not writes, or allow access to development environments but not production. Scopes provide defense in depth—even if an attacker obtains a token, its capabilities are constrained.

Audit logging records every policy decision for accountability and forensics. Allowed actions, denied actions, and obligation fulfillments are all logged with context sufficient to reconstruct what happened and why. This audit trail supports both security review and system debugging.

## Architecture

The policy engine loads rules from YAML configuration at startup. Rules specify subjects (who), actions (what), resources (on what), and effects (allow or deny). Optional conditions add context-dependent logic; optional obligations attach requirements to allowed actions. This declarative approach separates policy definition from enforcement code.

Rule evaluation follows a priority ordering. Higher-priority rules take precedence, enabling broad defaults with specific exceptions. A base rule might allow authenticated users to read all resources, while a higher-priority rule denies unauthenticated access to sensitive resources. This layering supports complex policies without combinatorial explosion.

Caching improves evaluation performance. Policy decisions for the same context are cached with a 30-second TTL, avoiding repeated rule evaluation for identical requests. The cache key incorporates all context elements, ensuring that different contexts produce distinct cache entries even for the same user and action.

Ed25519 tokens provide cryptographic authentication without database lookups. Tokens are signed with a server-held private key and verified with the corresponding public key. Token claims include user identity, granted scopes, elevation status, and expiration time. Verification is pure cryptography—no network calls or database queries on the hot path.

## Autonomy Bands

The autonomy level—a continuous value from 0 to 1—maps to discrete behavioral bands that determine what actions ALFRED can take without approval.

At the read-only band (0.0–0.3), ALFRED can observe and report but never modify state. It can query databases, read files, and analyze logs, but cannot create, update, or delete anything. This band is appropriate for new deployments or after significant failures that erode trust.

The suggest band (0.3–0.5) permits ALFRED to propose actions that require explicit user approval. ALFRED can draft changes, prepare deployments, and plan workflows, but execution waits for human confirmation. This band balances automation value against human oversight.

Cautious execution (0.5–0.7) permits safe mutations with clear rollback paths. Creating notes, setting reminders, and making reversible changes can proceed automatically. Irreversible actions still require approval. This band suits established deployments with demonstrated reliability.

Supervised execution (0.7–0.9) permits consequential actions with monitoring. Deployments can proceed automatically, but monitoring remains active and rollback is prepared. ALFRED has earned trust through consistent success but hasn't achieved full autonomy.

Full autonomy (0.9–1.0) permits unrestricted action. ALFRED can take any action without approval. This band is rarely reached and never by default—it requires sustained excellent performance and explicit configuration enabling it.

## Biometric Elevation

High-risk operations require proof that the requesting user is physically present and intentionally authorizing the action. Password authentication is insufficient: passwords can be stolen, sessions can be hijacked. Biometric verification—fingerprint, face recognition, or hardware security key—provides stronger assurance.

The elevation flow suspends workflow execution when an obligation requires biometric verification. The workflow enters suspended state, the client receives an obligation event, and the user is prompted to authenticate biometrically. After successful authentication, the workflow receives a resume event with the verification ticket and continues execution.

Bio-tickets have short TTLs (two minutes by default). This prevents ticket hoarding—an attacker who obtains a ticket has limited time to use it. Operations requiring elevation must be performed promptly after verification; stale tickets are rejected.

The ticket validation flow checks signature, expiration, and scope. Even valid tickets can be rejected if they don't match the requested operation's requirements. This binding prevents tickets issued for one operation from being replayed against different operations.

## Adaptive Autonomy

Static autonomy levels would require constant manual adjustment. ALFRED's autonomy adapts automatically based on outcomes: success increases autonomy, failure decreases it. This adaptation uses the same Bayesian framework described in the cognitive state machine guide.

Evidence from workflow outcomes updates the Beta prior that underlies autonomy. Successful workflows increment alpha (positive evidence); failed workflows increment beta (negative evidence). The autonomy level is the mode of the resulting distribution—the most likely reliability given observed outcomes.

Physiological regulation provides additional adaptation. High frustration (many recent errors) reduces autonomy regardless of historical success. Low energy (extended operation without rest) adds caution. These regulators prevent autonomy from rising inappropriately when current conditions suggest increased risk.

Feedback from users provides weighted evidence. Explicit positive feedback ("that was exactly right") provides stronger evidence than successful completion alone. Explicit negative feedback ("that was wrong") provides stronger evidence than operational failure. This weighting ensures that user assessment influences autonomy more than automatic metrics.

## Design Decisions

Graduated autonomy was chosen over binary allow/deny because real-world risk varies continuously. Some operations are clearly safe; others are clearly dangerous; most fall somewhere between. A continuous autonomy spectrum with discrete bands provides intuitive levels while supporting nuanced policy.

Biometric elevation for high-risk operations adds friction intentionally. The friction ensures that consequential actions aren't taken accidentally or through automation gone wrong. The brief interruption to authenticate is a small price for protection against irreversible mistakes.

Declarative policy rules separate policy definition from enforcement. Security policies should be visible and auditable, not buried in code. YAML rules can be reviewed, version-controlled, and modified without code changes. This separation also enables policy customization for different deployment contexts.

Token scoping provides defense in depth beyond policy rules. Even if policy allows an action, the token must include the relevant scope. This redundancy catches configuration errors and limits damage from token theft.

## Integration Points

The workflow runtime checks policy before sensitive operations. Tools that modify state query the PDP and handle denials or obligations appropriately. Obligations trigger workflow suspension; denials abort the operation with clear error messages.

The cognitive loop consumes autonomy band for behavior adjustment. Current autonomy level influences which actions ALFRED attempts without approval, how much risk it accepts in planning, and how cautiously it executes. Lower autonomy produces more conservative behavior.

The API layer enforces authentication and scope requirements. Routers check session validity and scope membership before processing requests. This enforcement happens at the API boundary, preventing unauthenticated requests from reaching business logic.

The audit system logs policy decisions for compliance and forensics. Every PDP evaluation—whether allowed, denied, or subject to obligations—is recorded with timestamp, context, and decision. These logs support security review and incident investigation.

## Related Documentation

- [Architecture Overview](../architecture/overview.md) — System-wide architecture context
- [Cognitive State Machine](cognitive-state-machine.md) — How autonomy gradient works
- [Workflow Orchestration](workflow-orchestration.md) — How workflows suspend for obligations
- [Policy Confidence Guide](policy-confidence.md) — Detailed policy configuration

