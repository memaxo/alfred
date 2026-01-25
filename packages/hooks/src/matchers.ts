import type { HookEvent, HookMatcher } from "@alfred/type";

export function matchesHook(event: HookEvent, matcher: HookMatcher): boolean {
  if (!matcher || Object.keys(matcher).length === 0) {
    return true;
  }

  if (matcher.toolName) {
    if (!matchesToolName(event, matcher.toolName)) {
      return false;
    }
  }

  if (matcher.agentType) {
    if (!matchesAgentType(event, matcher.agentType)) {
      return false;
    }
  }

  if (matcher.commandPattern) {
    if (!matchesCommandPattern(event, matcher.commandPattern)) {
      return false;
    }
  }

  if (matcher.stateFrom || matcher.stateTo) {
    if (!matchesTransition(event, matcher.stateFrom, matcher.stateTo)) {
      return false;
    }
  }

  if (matcher.risk) {
    if (!matchesRisk(event, matcher.risk)) {
      return false;
    }
  }

  if (matcher.memoryKind) {
    if (!matchesMemoryKind(event, matcher.memoryKind)) {
      return false;
    }
  }

  return true;
}

function matchesToolName(event: HookEvent, toolName: string): boolean {
  switch (event.type) {
    case "agent:tool:before":
    case "agent:tool:after":
    case "agent:tool:error":
    case "agent:mcp:before":
    case "agent:mcp:after": {
      return event.toolName === toolName;
    }
    default: {
      return false;
    }
  }
}

function matchesAgentType(event: HookEvent, agentType: string): boolean {
  if (event.type !== "agent:spawn") {
    return false;
  }
  return event.agentType === agentType;
}

function matchesCommandPattern(event: HookEvent, pattern: string): boolean {
  let command: string | null = null;

  switch (event.type) {
    case "agent:shell:before":
    case "agent:shell:after": {
      ({ command } = event);
      break;
    }
    default: {
      command = null;
    }
  }

  if (!command) {
    return false;
  }

  try {
    return new RegExp(pattern).test(command);
  } catch {
    return false;
  }
}

function matchesTransition(
  event: HookEvent,
  from: HookMatcher["stateFrom"],
  to: HookMatcher["stateTo"]
): boolean {
  if (event.type !== "cognitive:transition") {
    return false;
  }

  if (from && event.fromState !== from) {
    return false;
  }

  if (to && event.toState !== to) {
    return false;
  }

  return true;
}

function matchesRisk(
  event: HookEvent,
  risk: NonNullable<HookMatcher["risk"]>
): boolean {
  if (event.type !== "cognitive:deciding") {
    return false;
  }
  return event.action.risk === risk;
}

function matchesMemoryKind(
  event: HookEvent,
  kind: NonNullable<HookMatcher["memoryKind"]>
): boolean {
  if (event.type !== "memory:create") {
    return false;
  }
  return event.kind === kind;
}
