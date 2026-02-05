import type {
  ReceiptCorrection,
  ReceiptEvidenceItem,
  ReceiptOutcome,
  ReceiptOutcomeKind,
  WorkingSet,
} from "@alfred/type/sense";

export interface RouteScore {
  summary: string;
  outcome: ReceiptOutcome;
  alternatives: ReceiptOutcome[];
  evidence: ReceiptEvidenceItem[];
  confidence: number;
}

function clamp01(value: number): number {
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

function includesAny(haystack: string, needles: string[]): boolean {
  for (const needle of needles) {
    if (needle && haystack.includes(needle)) {
      return true;
    }
  }
  return false;
}

function guessOutcomeKind(text: string): ReceiptOutcomeKind {
  const t = text.toLowerCase();
  if (
    includesAny(t, [
      "remind me",
      "reminder",
      "tomorrow",
      "today",
      "next week",
      "at ",
      "due ",
      "schedule",
      "set a reminder",
    ])
  ) {
    return "reminder";
  }
  return "note";
}

function buildAlternatives(primary: ReceiptOutcomeKind): ReceiptOutcomeKind[] {
  const all: ReceiptOutcomeKind[] = ["inbox", "note", "reminder", "task"];
  return all.filter((k) => k !== primary);
}

export function scoreRoute({
  text,
  workingSet,
}: {
  text: string;
  workingSet?: WorkingSet | null;
}): RouteScore {
  const trimmed = text.trim();
  const outcomeKind = guessOutcomeKind(trimmed);
  const isTodoLanguage = includesAny(trimmed.toLowerCase(), [
    "todo",
    "to-do",
    "task:",
    "task ",
  ]);

  const evidence: ReceiptEvidenceItem[] = [];
  evidence.push({
    key: "payload.text",
    label: "Derived text available",
    value: trimmed.length > 120 ? `${trimmed.slice(0, 117)}...` : trimmed,
    weight: 0.2,
  });
  if (isTodoLanguage) {
    evidence.push({
      key: "payload.todo_language",
      label: "Task-like language detected",
      weight: 0.15,
    });
  }

  const focus = workingSet?.focus;
  if (focus?.kind === "project") {
    evidence.push({
      key: "workingset.focus",
      label: "Active project focus",
      value: focus.label ?? focus.id,
      weight: 0.35,
    });
  }

  let confidenceBase = outcomeKind === "reminder" ? 0.65 : 0.55;
  if (focus?.kind === "project") {
    confidenceBase += 0.1;
  }
  if (isTodoLanguage && outcomeKind === "note") {
    confidenceBase += 0.05;
  }

  const confidence = clamp01(confidenceBase);

  const outcome: ReceiptOutcome = {
    kind: outcomeKind,
    ...(focus?.kind === "project" ? { projectId: focus.id } : {}),
  };

  const alternatives: ReceiptOutcome[] = buildAlternatives(outcome.kind).map(
    (kind) => ({
      kind,
      ...(focus?.kind === "project" ? { projectId: focus.id } : {}),
    })
  );

  const summary =
    outcome.kind === "reminder"
      ? "Suggested reminder based on time-related language."
      : (outcome.kind === "note"
        ? "Suggested note as a durable capture."
        : "Suggested inbox triage due to low confidence.");

  return { summary, outcome, alternatives, evidence, confidence };
}

export function appendCorrection({
  corrections,
  correction,
}: {
  corrections: ReceiptCorrection[];
  correction: ReceiptCorrection;
}): ReceiptCorrection[] {
  return [...corrections, correction].slice(-32);
}
