import { extract, toKnowledge } from "../packages/knowledge/src/extractor.js";

console.log("--- Knowledge Extraction Pipeline Test ---");

const input =
  "Elon Musk founded SpaceX in 2002. The rocket launch failed because the engine overheated.";
console.log(`Input Text: "${input}"\n`);

console.log("1. Extracting facts and relations...");
const result = extract(input, "pipeline-test");

console.log(`\nFound ${result.facts.length} facts:`);
result.facts.forEach((f, i) => {
  console.log(`  [${i}] ${f.content} (Confidence: ${f.confidence})`);
  if (f.relations.length > 0) {
    console.log(`      Relations: ${JSON.stringify(f.relations)}`);
  }
});

console.log(`\nFound ${result.causality.length} causal links:`);
result.causality.forEach((c, i) => {
  console.log(`  [${i}] Cause: "${c.cause}" -> Effect: "${c.effect}"`);
});

console.log("\n2. Converting to Hypergraph Nodes...");
const nodes = toKnowledge(result);

console.log(`\nGenerated ${nodes.length} Graph Nodes:`);
nodes.forEach((n, i) => {
  const data = n.data;
  let desc = "";
  if (data._ === "fact") {
    desc = `FACT: "${data.content}"`;
  } else if (data._ === "relation") {
    desc = `RELATION: ${data.from} -> [${data.kind}] -> ${data.to}`;
  } else if (data._ === "insight") {
    desc = `INSIGHT: "${data.conclusion}"`;
  } else {
    desc = `TYPE: ${data._}`;
  }

  console.log(`  [${i}] ${desc} (Hash: ${n.hash.slice(0, 8)}...)`);
});

if (result.facts.length > 0 && nodes.length > 0) {
  console.log("\n✅ Pipeline Test Passed: Text -> Facts -> Nodes success.");
  process.exit(0);
} else {
  console.error("\n❌ Pipeline Test Failed: No facts or nodes produced.");
  process.exit(1);
}
