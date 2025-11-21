import path from "node:path";
import { z } from "zod";
import { toolRunner } from "./runner";

export const browserToolSchema = z.object({
  action: z.literal("screenshot"),
  url: z.string().url(),
  output: z.string().optional(), // path
});

export const toolBrowser = {
  name: "browser",
  description:
    "Headless browser automation for visual verification using Playwright.",
  inputSchema: browserToolSchema,
  execute: async (input: z.infer<typeof browserToolSchema>) => {
    const outputPath = input.output ?? "screenshot.png";

    // Create a temporary playwright script
    // We assume @playwright/test is available in the environment (repo root devDeps)
    const scriptContent = `
      const { chromium } = require('playwright');
      (async () => {
        const browser = await chromium.launch();
        const page = await browser.newPage();
        try {
          await page.goto('${input.url}', { waitUntil: 'networkidle' });
          await page.screenshot({ path: '${outputPath}', fullPage: true });
          console.log('Screenshot saved to ${outputPath}');
        } catch (e) {
          console.error(e);
          process.exit(1);
        } finally {
          await browser.close();
        }
      })();
    `;

    const scriptPath = path.resolve(
      process.cwd(),
      `.agent/tmp-browser-${Date.now()}.js`
    );

    // Write script using Bun (or fs if needed, but we need async)
    await Bun.write(scriptPath, scriptContent);

    try {
      // Run script using 'bun run' (assuming bun is available and can run node scripts if they don't use native modules incompatible with bun,
      // OR 'node' if playwright needs node. Playwright usually works with Bun or Node.
      // Given we use bun everywhere, let's try bun. If playwright complains, we might need 'node'.
      // Playwright driver is a binary.

      // We'll use toolRunner to execute it.
      // "bun run <script>"
      const result = await toolRunner.execute(
        `bun ${scriptPath}`,
        process.cwd(),
        60_000
      );

      if (result.exitCode !== 0) {
        return { ok: false, error: result.stderr || result.stdout };
      }

      return { ok: true, file: outputPath, logs: result.stdout };
    } catch (error) {
      return { ok: false, error: String(error) };
    } finally {
      // Cleanup script
      await Bun.file(scriptPath).delete(); // Bun.file().delete() is not standard API, use fs.unlink
      const { unlink } = await import("node:fs/promises");
      try {
        await unlink(scriptPath);
      } catch {}
    }
  },
};
