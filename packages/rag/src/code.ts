import { ragRepo } from "@alfred/db";

export interface CodeFile {
  path: string;
  content: string;
}

export async function ingestCodeFiles(source: string, files: CodeFile[]): Promise<string | null> {
  if (!files || files.length === 0) {
    return null;
  }

  const document = await ragRepo.createDocument(source, `Code context ${new Date().toISOString()}`);
  let order = 0;
  await ragRepo.addChunks(
    document.id,
    files.map(file => ({
      content: `// ${file.path}\n${file.content}`,
      order: order += 1,
      metadata: {
        path: file.path,
        source,
      },
    })),
  );

  return document.id;
}
