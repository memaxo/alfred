/**
 * Review System Performance Benchmark
 *
 * Requires: RUN_DB_TESTS=1 and a Postgres database
 *
 * Run with: RUN_DB_TESTS=1 bun test packages/db/test/review.perf.test.ts
 */

import { describePostgres, requirePostgresTestEnv } from "@alfred/db/testing";
import { beforeAll, describe, expect, it } from "bun:test";

const SHOULD_RUN =
  process.env.RUN_DB_TESTS === "1" && process.env.RUN_PERF_TESTS === "1";
const describeFn = SHOULD_RUN ? describePostgres : describe.skip;

const TEST_USER_ID = "review-perf-test-user";
const BATCH_SIZE = 1000;
const TOTAL_REVIEWS = 10_000;

let reviewRepo: typeof import("@alfred/db").reviewRepo;
let db: typeof import("@alfred/db").db;

describeFn("reviewRepo performance", () => {
  beforeAll(async () => {
    requirePostgresTestEnv(
      "Performance tests require Postgres. Set DATABASE_URL, RUN_DB_TESTS=1, and RUN_PERF_TESTS=1."
    );
    const mod = await import("@alfred/db");
    ({ reviewRepo } = mod);
    ({ db } = mod);
  });

  it(`seeds ${TOTAL_REVIEWS} reviews`, async () => {
    const start = performance.now();

    for (let batch = 0; batch < TOTAL_REVIEWS / BATCH_SIZE; batch++) {
      const reviews = Array.from({ length: BATCH_SIZE }, (_, i) => ({
        priority: ["low", "medium", "high", "critical"][i % 4] as
          | "low"
          | "medium"
          | "high"
          | "critical",
        reviewType: ["tool_execution", "memory", "code", "workflow", "message"][
          i % 5
        ] as "tool_execution" | "memory" | "code" | "workflow" | "message",
        subjectData: { testData: `batch-${batch}-item-${i}` },
        subjectId: `perf-${batch}-${i}`,
        userId: TEST_USER_ID,
      }));

      for (const review of reviews) {
        await reviewRepo.createReview(review);
      }

      console.log(`  Seeded batch ${batch + 1}/${TOTAL_REVIEWS / BATCH_SIZE}`);
    }

    const duration = performance.now() - start;
    console.log(`  Total seed time: ${(duration / 1000).toFixed(2)}s`);
    console.log(
      `  Average per review: ${(duration / TOTAL_REVIEWS).toFixed(2)}ms`
    );

    expect(duration).toBeLessThan(300_000); // 5 minutes max
  });

  it("queries pending reviews with pagination", async () => {
    const iterations = 100;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      await reviewRepo.getReviewQueue(TEST_USER_ID, {
        limit: 50,
        offset: i * 50,
        status: "pending",
      });
    }

    const duration = performance.now() - start;
    const avgMs = duration / iterations;

    console.log(
      `  ${iterations} paginated queries in ${duration.toFixed(2)}ms`
    );
    console.log(`  Average query time: ${avgMs.toFixed(2)}ms`);

    expect(avgMs).toBeLessThan(100); // Each query should be < 100ms
  });

  it("queries risk counts", async () => {
    const iterations = 50;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      await reviewRepo.getRiskCounts(TEST_USER_ID);
    }

    const duration = performance.now() - start;
    const avgMs = duration / iterations;

    console.log(
      `  ${iterations} risk count queries in ${duration.toFixed(2)}ms`
    );
    console.log(`  Average query time: ${avgMs.toFixed(2)}ms`);

    expect(avgMs).toBeLessThan(200); // Each query should be < 200ms
  });

  it("queries analytics", async () => {
    const iterations = 20;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      await reviewRepo.getAnalytics(TEST_USER_ID, { days: 30 });
    }

    const duration = performance.now() - start;
    const avgMs = duration / iterations;

    console.log(
      `  ${iterations} analytics queries in ${duration.toFixed(2)}ms`
    );
    console.log(`  Average query time: ${avgMs.toFixed(2)}ms`);

    expect(avgMs).toBeLessThan(500); // Analytics can be slower
  });

  it("queries cycle time stats", async () => {
    const iterations = 20;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      await reviewRepo.getCycleTimeStats(TEST_USER_ID, "week");
    }

    const duration = performance.now() - start;
    const avgMs = duration / iterations;

    console.log(
      `  ${iterations} cycle time queries in ${duration.toFixed(2)}ms`
    );
    console.log(`  Average query time: ${avgMs.toFixed(2)}ms`);

    expect(avgMs).toBeLessThan(500);
  });

  it("queries blocked reviews", async () => {
    const iterations = 50;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      await reviewRepo.getBlockedReviews(TEST_USER_ID, 20);
    }

    const duration = performance.now() - start;
    const avgMs = duration / iterations;

    console.log(`  ${iterations} blocked queries in ${duration.toFixed(2)}ms`);
    console.log(`  Average query time: ${avgMs.toFixed(2)}ms`);

    expect(avgMs).toBeLessThan(100);
  });
});
