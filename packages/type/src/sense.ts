export type CapturePayloadKind = "text" | "voice" | "photo";

export type CaptureStatus = "new" | "triaged" | "converted" | "archived";

export type CaptureSurface = "native" | "web" | "unknown";

export type CaptureEvidence = {
  capturedAt: Date;
  tags?: string[];
  device?: string;
  surface?: CaptureSurface;
};

export type Capture = {
  id: string;
  userId: string;
  kind: CapturePayloadKind;
  status: CaptureStatus;
  evidence: CaptureEvidence;
  createdAt: Date;
  updatedAt: Date;
};

export type Bundle = {
  id: string;
  captureId: string;
  text: string;
  createdAt: Date;
  updatedAt: Date;
};

export type ReceiptDecision = "route" | "schedule" | "link" | "suggest";

export type ReceiptEvidenceItem = {
  key: string;
  label: string;
  value?: string;
  weight?: number;
};

export type ReceiptOutcomeKind = "inbox" | "note" | "reminder" | "task";

export type ReceiptOutcome = {
  kind: ReceiptOutcomeKind;
  targetId?: string;
  projectId?: string;
};

export type ReceiptCorrection = {
  correctedAt: Date;
  outcome: ReceiptOutcome;
  note?: string;
};

export type Receipt = {
  id: string;
  captureId: string;
  decision: ReceiptDecision;
  summary: string;
  evidence: ReceiptEvidenceItem[];
  outcome: ReceiptOutcome;
  alternatives: ReceiptOutcome[];
  confidence: number;
  corrections: ReceiptCorrection[];
  createdAt: Date;
  updatedAt: Date;
};

export type WorkingSetItemKind =
  | "project"
  | "conversation"
  | "note"
  | "reminder"
  | "task";

export type WorkingSetItem = {
  kind: WorkingSetItemKind;
  id: string;
  label?: string;
};

export type WorkingSet = {
  userId: string;
  items: WorkingSetItem[];
  focus?: WorkingSetItem;
  updatedAt: Date;
};
