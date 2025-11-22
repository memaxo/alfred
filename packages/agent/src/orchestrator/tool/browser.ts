import { chromium } from "playwright";

export const browserTool = {
  screenshot: async (url: string, outputPath: string): Promise<void> => {
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      await page.goto(url);
      await page.screenshot({ path: outputPath });
    } finally {
      await browser.close();
    }
  },
};
