import { readFileSync } from "node:fs";

const input = JSON.parse(readFileSync(0, "utf8")) as { hookEvent: string };

console.log(JSON.stringify({ userMessage: `skip:${input.hookEvent}` }));
process.exit(4);
