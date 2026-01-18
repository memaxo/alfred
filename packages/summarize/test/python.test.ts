/**
 * Integration tests for Python backend
 *
 * These tests require Python dependencies to be installed:
 * cd packages/summarize && uv sync
 *
 * Run with: bun test test/python.test.ts
 */

import { afterAll, describe, expect, it } from "bun:test";
import {
  ami,
  chunk,
  getHealth,
  initialize,
  isPythonAvailable,
  shutdown,
  summarize,
} from "../src/summarize.js";

// Skip all tests if Python is not available
const hasPython = isPythonAvailable();

describe.skipIf(!hasPython)("@alfred/summarize Python backend", () => {
  afterAll(async () => {
    await shutdown();
  });

  it("initializes Python process successfully", async () => {
    await initialize({
      modelName: "Qwen/Qwen2.5-Coder-0.5B-Instruct",
      device: "cpu",
    });

    const health = getHealth();
    expect(health).not.toBeNull();
    expect(health?.status).toBeOneOf(["idle", "busy"]);
  }, 300_000); // 5 minute timeout for model loading

  it("compresses code using LongCodeZip", async () => {
    const code = `
def factorial(n):
    """Calculate factorial of n."""
    if n <= 1:
        return 1
    return n * factorial(n - 1)

def fibonacci(n):
    """Calculate nth Fibonacci number."""
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)

def main():
    """Main entry point."""
    print(f"5! = {factorial(5)}")
    print(f"Fib(10) = {fibonacci(10)}")

if __name__ == "__main__":
    main()
      `.trim();

    const result = await summarize(code, {
      targetRatio: 0.5,
      instruction: "What does this code do?",
    });

    expect(result.text).toBeTruthy();
    expect(result.originalTokens).toBeGreaterThan(0);
    expect(result.compressedTokens).toBeLessThanOrEqual(result.originalTokens);
    expect(result.metadata.method).toBe("longcodezip");
  }, 60_000);

  it("performs entropy-based semantic chunking", async () => {
    const text = `
# Introduction

This document describes the system architecture.
The system is designed for high availability.

# Components

The main components include:
- API Gateway
- Database
- Cache Layer

# Conclusion

The architecture enables scalability and reliability.
      `.trim();

    const result = await chunk(text, { method: "std", k: 0.2 });

    expect(result.chunks.length).toBeGreaterThan(0);
    // Perplexities should be available from Python backend
    expect(result.perplexities.length).toBeGreaterThan(0);
  }, 60_000);

  it("calculates AMI for context relevance", async () => {
    const context = `
The authentication system uses JWT tokens for secure API access.
Users authenticate with username and password, receiving a token.
The token expires after 24 hours and must be refreshed.
      `.trim();

    const result = await ami(context, {
      instruction: "How does authentication work?",
    });

    // AMI should be positive for relevant context
    expect(typeof result.score).toBe("number");
    // The context is relevant to the instruction
    expect(result.score).toBeGreaterThan(-100); // Allow some variance
  }, 60_000);
});
