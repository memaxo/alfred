const { readFileSync } = require("node:fs");

const input = JSON.parse(readFileSync(0, "utf8"));

process.stdout.write(
  `${JSON.stringify({ userMessage: `skip:${input.hookEvent}` })}\n`
);
process.exit(4);
