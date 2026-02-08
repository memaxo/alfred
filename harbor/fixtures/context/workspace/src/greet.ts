import { EXPECTED_GREETING } from "./config";

export function greet() {
  return EXPECTED_GREETING;
}

export function expected() {
  // Helper that *does* expose the expected value (forces local reading).
  return EXPECTED_GREETING;
}
