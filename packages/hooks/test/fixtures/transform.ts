import { readFileSync } from "node:fs";

const input = JSON.parse(readFileSync(0, "utf8")) as {
  payload: { type: string; taskSummary?: string };
};

console.log(
  JSON.stringify({
    transformed: {
      ...input.payload,
      taskSummary: `x:${input.payload.taskSummary ?? ""}`,
    },
  })
);
