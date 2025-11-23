import { spawn } from "bun";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const FORBIDDEN_STRINGS = [
  "drizzle-orm",
  "postgres", 
  "googleapis",
  "@alfred/db",
  "openai", // Check for OpenAI SDK leakage
  "process.env.OPENAI_API_KEY", // Check for secret leakage
  "process.env.DATABASE_URL"
];

async function verifyBuild() {
  console.log("🔍 Starting Build Verification...");
  
  // 1. Run Build
  console.log("📦 Running 'vite build' in apps/web...");
  const build = spawn(["bun", "run", "build"], {
    cwd: "apps/web",
    stdout: "inherit",
    stderr: "inherit",
  });

  const exitCode = await build.exited;
  if (exitCode !== 0) {
    console.error("❌ Build failed!");
    process.exit(1);
  }

  // 2. Analyze Bundles
  console.log("🕵️  Analyzing client bundles for forbidden code...");
  const distPath = join(process.cwd(), "apps/web/dist/client/assets");
  
  try {
    const files = await readdir(distPath);
    const jsFiles = files.filter(f => f.endsWith(".js"));
    
    let leaked = false;

    for (const file of jsFiles) {
      const content = await readFile(join(distPath, file), "utf-8");
      
      for (const forbidden of FORBIDDEN_STRINGS) {
        const index = content.indexOf(forbidden);
        if (index !== -1) {
          // Ignore innocuous mentions (e.g. in error messages strings), but catch imports/logic
          // For strictness, we warn on ANY occurrence.
          const start = Math.max(0, index - 50);
          const end = Math.min(content.length, index + forbidden.length + 50);
          const context = content.slice(start, end).replace(/\n/g, "\\n");
          
          // Allow list for known false positives
          const isFalsePositive = 
            (forbidden === "postgres" && (file.includes("ts-tags") || file.includes("emacs-lisp") || context.includes("sql-comint-postgres"))) ||
            (forbidden === "googleapis" && context.includes("storage.googleapis.com")) ||
            (forbidden === "openai" && context.includes('["local","openai"]'));

          if (!isFalsePositive) {
            console.error(`❌ FORBIDDEN STRING DETECTED in ${file}: "${forbidden}"`);
            console.error(`   Context: ...${context}...`);
            leaked = true;
          }
        }
      }
    }

    if (leaked) {
      console.error("🚨 Build verification FAILED: Server code leaked into client bundle.");
      process.exit(1);
    } else {
      console.log("✅ Build verification PASSED: No server leakage detected.");
    }

  } catch (error) {
    console.error("❌ Error analyzing build artifacts:", error);
    process.exit(1);
  }
}

verifyBuild();
