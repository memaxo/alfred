import type { UIMessage } from "@alfred/type/stream";
export declare function isTextPart(part: UIMessage["parts"][number]): part is {
  type: "text";
  text: string;
};
export declare function isReasoningPart(
  part: UIMessage["parts"][number]
): part is Extract<
  UIMessage["parts"][number],
  {
    type: "reasoning";
  }
>;
export declare function isToolCallPart(
  part: UIMessage["parts"][number]
): part is Extract<
  UIMessage["parts"][number],
  {
    type: string;
  }
> & {
  type: "tool-call";
  toolName?: string;
  input?: unknown;
  toolCallId?: string;
};
export declare function isToolResultPart(
  part: UIMessage["parts"][number]
): part is Extract<
  UIMessage["parts"][number],
  {
    type: string;
  }
> & {
  type: "tool-result";
  toolName?: string;
  output?: unknown;
  toolCallId?: string;
  isError?: boolean;
  errorText?: string;
};
export declare function isFilePart(
  part: UIMessage["parts"][number]
): part is Extract<
  UIMessage["parts"][number],
  {
    type: "file";
  }
>;
export declare function isDataPart(
  part: UIMessage["parts"][number]
): part is Extract<
  UIMessage["parts"][number],
  {
    type: `data-${string}`;
  }
>;
export declare function isDataCachePart(
  part: UIMessage["parts"][number]
): part is Extract<
  UIMessage["parts"][number],
  {
    type: "data-cache";
  }
> & {
  data: unknown;
  key?: readonly unknown[];
  value?: unknown;
};
export declare function isDataStatusPart(
  part: UIMessage["parts"][number]
): part is Extract<
  UIMessage["parts"][number],
  {
    type: "data-status";
  }
> & {
  data: unknown;
  transient?: boolean;
};
export declare function isDataPartNamed(
  part: UIMessage["parts"][number],
  name: string
): part is Extract<
  UIMessage["parts"][number],
  {
    type: `data-${string}`;
  }
> & {
  type: `data-${string}`;
  data?: unknown;
  id?: string;
};
export declare function extractStructuredData(
  part: UIMessage["parts"][number]
): unknown;
export declare function getAgentLabel(message: UIMessage): string;
export declare function getTimestamp(message: UIMessage): Date | null;
