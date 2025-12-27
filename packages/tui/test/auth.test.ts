import { describe, expect, test } from "bun:test";
import { deviceLogin } from "../src/cli/auth";

describe("Auth Module", () => {
  test("deviceLogin is defined", () => {
    expect(deviceLogin).toBeDefined();
  });
});
