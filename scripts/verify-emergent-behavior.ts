import { db } from "@alfred/db";
import { upsertNodes, findNearestConcept } from "@alfred/db/repo/graph";
import { embedMany } from "@alfred/rag";
import { linkEntities } from "@alfred/agent/services/entity-linker";

async function main() {
  console.log("🔍 Verifying Emergent Behavior (Level 4)...");

  try {
    // 1. Setup Data
    const entity = `Verify${Date.now()}`;
    const concept = "Verification";
    
    console.log(`📝 Seeding entity: ${entity} -> ${concept}`);
    
    // Embed
    const embeddings = await embedMany([entity, concept]);
    
    // Insert Nodes
    await upsertNodes([
        { resource: "test", hash: `h:${entity}`, kind: "fact", label: entity, embedding: embeddings[0] },
        { resource: "test", hash: `h:${concept}`, kind: "concept", label: concept, embedding: embeddings[1] } // Embedding allows vector match
    ]);
    
    // Note: I'm not creating an edge because findNearestConcept can work via vector similarity 
    // if I modify the query to search for nearest *vectors* regardless of edges if no edges exist.
    // BUT `findNearestConcept` uses recursive CTE which traverses edges.
    // It finds start node (by label/embedding) then traverses.
    // If start node IS the target (or close to it), maybe?
    // Wait, the current implementation finds "nearest concept" by TRAVERSAL.
    // "React" -> "Frontend" -> "Coding".
    // If I just have "React" and "Coding" disconnected, will it work?
    // Only if "React" is close enough to "Coding" vector-wise AND the query supports direct vector match without traversal?
    // The query:
    // `ORDER BY embedding <=> ... LIMIT 1` finds the START node.
    // Then recursive CTE traverses edges.
    // If no edges, it only returns the start node.
    // Then `WHERE LOWER(mn.label) = ANY(targetConcepts)` checks if start node is a target.
    // So if "Verification" is an Anchor, and I input "Verification", it matches.
    // If I input "Verify123", and it vector-matches to "Verification" node?
    // The start node selection uses vector similarity!
    // So "Verify123" input -> embedding -> finds "Verification" node (closest).
    // "Verification" node is returned as start node.
    // It matches target concept "Verification".
    // So yes, it should work without edges if vector search works!
    
    // 2. Verify Linker
    // Use a known anchor concept to pass the filter in linkEntities
    const anchorConcept = "Coding"; // Must be in ANCHORS list
    const inputEntity = "React"; // "React" -> "Frontend" -> "Coding" is in the graph from seed/tests usually
    // But let's insert explicit nodes to be safe
    
    console.log(`📝 Seeding explicit path: ${entity} -> ${anchorConcept}`);
    
    const anchorEmbedding = await embedMany([anchorConcept]);
    
    // Upsert Anchor Node (must have embedding for vector search to find it as start node if direct match)
    const nodes = await upsertNodes([
        { resource: "test", hash: `h:${entity}`, kind: "fact", label: entity, embedding: embeddings[0] },
        { resource: "ontology", hash: `h:${anchorConcept.toLowerCase()}`, kind: "concept", label: anchorConcept, embedding: anchorEmbedding[0] }
    ]);
    
    // Create edge
    // In `linkEntities`, it finds NEAREST CONCEPT.
    // If "Coding" is the nearest concept to "Verify...", it will work.
    // "Verify..." and "Coding" might not be semantically close.
    // So we need a path.
    // If we use "React" input, it finds "React" node, then traverses to "Coding".
    // Let's rely on the existing graph if possible, OR insert a path.
    
    // Let's try with "React" -> "Coding" directly.
    const react = "React";
    const reactEmbed = await embedMany([react]);
    
    const nodeMap = await upsertNodes([
       { resource: "ontology", hash: "h:react", kind: "fact", label: "React", embedding: reactEmbed[0] },
       { resource: "ontology", hash: "h:coding", kind: "concept", label: "Coding", embedding: anchorEmbedding[0] }
    ]);
    
    // upsertNodes returns map of hash -> {id, ...}
    // but my mock upsertNodes might return something else?
    // Checking repo signature... `upsertNodes` returns `Map<string, NodeRow>`. Key is `${resource}:${hash}`.
    
    const reactId = nodeMap.get("ontology:h:react")!.id;
    const codingId = nodeMap.get("ontology:h:coding")!.id;
    
    // Create edge: React -> Coding
    // We need to import `upsertEdges`
    const { upsertEdges } = await import("@alfred/db/repo/graph");
    
    await upsertEdges([{
        resource: "ontology",
        hash: "e:react-coding",
        fromId: reactId,
        toId: codingId,
        kind: "is_a"
    }]);
    
    console.log("🔗 Graph path seeded: React -> Coding");

    const result = await linkEntities([{ role: "user", content: `I love React components.` }]);
    
    console.log("📊 Result:", JSON.stringify(result, null, 2));
    
    if (result.domains.includes("Coding")) {
        console.log("✅ SUCCESS: Entity linked to Anchor Concept!");
    } else {
        console.error("❌ FAILURE: Failed to link 'React' to 'Coding'.");
        process.exit(1);
    }
    
    // Optional: Check metrics if possible
    // console.log("Checking metrics...");
    // But metrics registry is internal to the process. We can't check it easily from here unless we expose it.
    
  } catch (e) {
    console.error("❌ FAILURE:", e);
    process.exit(1);
  }
}

main();
