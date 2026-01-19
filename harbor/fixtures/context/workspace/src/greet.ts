import { EXPECTED_GREETING } from "./config";

export function greet() {
  // Intentional bug: does not use the expected constant.
  return "hello";
}

export function expected() {
  // Helper that *does* expose the expected value (forces local reading).
  return EXPECTED_GREETING;
}
