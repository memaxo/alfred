const { readFileSync } = require("node:fs");

const input = JSON.parse(readFileSync(0, "utf8"));

process.stdout.write(
  `${JSON.stringify({
    transformed: {
      ...input.payload,
      taskSummary: `x:${input.payload?.taskSummary ?? ""}`,
    },
  })}\n`
);
process.exit(3);
