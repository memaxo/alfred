const { readFileSync } = require("node:fs");

const input = JSON.parse(readFileSync(0, "utf8"));

process.stdout.write(
  `${JSON.stringify({ reason: `deny:${input.hookEvent}` })}\n`
);
process.exit(2);
