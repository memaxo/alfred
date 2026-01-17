import { defineConfig, defineDocs } from "fumadocs-mdx/config";

export const { docs, meta } = defineDocs({
  // Reuse the monorepo documentation directory.
  dir: "../../docs",
});

export default defineConfig({
  mdxOptions: {},
});
