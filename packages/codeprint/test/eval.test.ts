import { describe, test, expect } from "bun:test";

import {
  computePrecision,
  computeRecall,
  computeMrr,
  computeNdcg,
} from "../src/eval/metrics.js";

describe("eval metrics", () => {
  const relevant = new Set(["a.ts", "b.ts", "c.ts"]);

  test("precision - all relevant", () => {
    const returned = ["a.ts", "b.ts", "c.ts"];
    expect(computePrecision(returned, relevant)).toBe(1);
  });

  test("precision - half relevant", () => {
    const returned = ["a.ts", "b.ts", "x.ts", "y.ts"];
    expect(computePrecision(returned, relevant)).toBe(0.5);
  });

  test("precision - none relevant", () => {
    const returned = ["x.ts", "y.ts"];
    expect(computePrecision(returned, relevant)).toBe(0);
  });

  test("precision - empty returned", () => {
    expect(computePrecision([], relevant)).toBe(0);
  });

  test("recall - all found", () => {
    const returned = ["a.ts", "b.ts", "c.ts", "x.ts"];
    expect(computeRecall(returned, relevant)).toBe(1);
  });

  test("recall - partial", () => {
    const returned = ["a.ts", "x.ts"];
    expect(computeRecall(returned, relevant)).toBeCloseTo(1 / 3);
  });

  test("recall - none found", () => {
    const returned = ["x.ts", "y.ts"];
    expect(computeRecall(returned, relevant)).toBe(0);
  });

  test("recall - empty relevant set returns 1", () => {
    expect(computeRecall(["a.ts"], new Set())).toBe(1);
  });

  test("mrr - first is relevant", () => {
    const returned = ["a.ts", "x.ts", "y.ts"];
    expect(computeMrr(returned, relevant)).toBe(1);
  });

  test("mrr - second is relevant", () => {
    const returned = ["x.ts", "a.ts", "y.ts"];
    expect(computeMrr(returned, relevant)).toBe(0.5);
  });

  test("mrr - third is relevant", () => {
    const returned = ["x.ts", "y.ts", "a.ts"];
    expect(computeMrr(returned, relevant)).toBeCloseTo(1 / 3);
  });

  test("mrr - none relevant", () => {
    const returned = ["x.ts", "y.ts"];
    expect(computeMrr(returned, relevant)).toBe(0);
  });

  test("ndcg - perfect order", () => {
    const returned = ["a.ts", "b.ts", "c.ts", "x.ts"];
    expect(computeNdcg(returned, relevant)).toBe(1);
  });

  test("ndcg - no relevant", () => {
    const returned = ["x.ts", "y.ts"];
    expect(computeNdcg(returned, relevant)).toBe(0);
  });

  test("ndcg - empty relevant returns 1", () => {
    expect(computeNdcg(["a.ts"], new Set())).toBe(1);
  });
});
