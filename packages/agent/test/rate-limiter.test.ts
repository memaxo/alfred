import { describe, expect, it } from "bun:test";
import { Semaphore, TokenBucket } from "../src/utils/rate-limiter";

describe("Rate Limiting Utils", () => {
  describe("TokenBucket", () => {
    it("consumes tokens correctly", () => {
      const bucket = new TokenBucket(10, 1); // 10 capacity, 1/sec refill
      expect(bucket.consume(1)).toBe(true);
      expect(bucket.consume(5)).toBe(true);
      expect(bucket.consume(10)).toBe(false); // 4 remaining < 10
    });

    it("refills tokens over time", async () => {
      const bucket = new TokenBucket(1, 10); // 1 capacity, 10/sec refill
      expect(bucket.consume(1)).toBe(true);
      expect(bucket.consume(1)).toBe(false);

      await new Promise((r) => setTimeout(r, 150)); // Wait > 0.1s
      expect(bucket.consume(1)).toBe(true);
    });
  });

  describe("Semaphore", () => {
    it("limits concurrency", async () => {
      const sem = new Semaphore(2);
      let active = 0;
      let maxActive = 0;

      const task = async () => {
        await sem.acquire();
        active++;
        maxActive = Math.max(maxActive, active);
        await new Promise((r) => setTimeout(r, 10));
        active--;
        sem.release();
      };

      await Promise.all([task(), task(), task(), task()]);
      expect(maxActive).toBe(2);
    });
  });
});
