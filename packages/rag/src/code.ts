import { ragRepo } from "@alfred/db";
import { embed } from "./doc";

export type CodeFile = {
  path: string;
  content: string;
  startLine?: number;
  endLine?: number;
  tokens?: number;
};

export async function ingestCodeFiles(
  source: string,
  files: CodeFile[]
): Promise<string | null> {
  if (!Array.isArray(files) || files.length === 0) {
    return null;
  }

  const prepared = files.filter(
    (file) => typeof file.content === "string" && file.content.trim().length > 0
  );
  if (prepared.length === 0) {
    return null;
  }

  const document = await ragRepo.createDocument(
    source,
    `Code context ${new Date().toISOString()}`,
    undefined,
    {
      kind: "code",
    }
  );
  const documentId = document?.id;
  if (!documentId) {
    return null;
  }

  const chunks: Array<{
    content: string;
    order: number;
    embedding: number[];
    metadata: Record<string, unknown>;
  }> = [];

  let order = 0;
  for (const file of prepared) {
    const header = file.path ? `// ${file.path}\n` : "";
    const chunkContent = `${header}${file.content}`;
    let vector: number[];
    try {
      vector = await embed(chunkContent);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`rag_code_embed_failed:${file.path}:${message}`);
    }

    const metadata: Record<string, unknown> = {
      path: file.path,
      source,
    };
    if (typeof file.startLine === "number") {
      metadata.startLine = file.startLine;
    }
    if (typeof file.endLine === "number") {
      metadata.endLine = file.endLine;
    }
    if (typeof file.tokens === "number") {
      metadata.tokens = file.tokens;
    }

    chunks.push({
      content: chunkContent,
      order: order++,
      embedding: vector,
      metadata,
    });
  }

  if (chunks.length === 0) {
    return documentId;
  }

  await ragRepo.addChunks(documentId, chunks);

  return documentId;
}
