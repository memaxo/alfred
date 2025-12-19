#!/usr/bin/env bun

/**
 * Test script to verify Bun debugger setup
 * Run with: bun scripts/test-debug-setup.ts
 */

console.log("✓ Debug setup test started");

// Test 1: Verify inspector is available
try {
  const inspector = Bun.inspect;
  console.log("✓ Bun.inspect is available");
} catch (e) {
  console.error("✗ Bun.inspect not available:", e);
  process.exit(1);
}

// Test 2: Verify we can create inspectable objects
const testObj = {
  name: "test",
  nested: {
    value: 42,
  },
};

const inspected = Bun.inspect(testObj);
if (inspected.includes("test") && inspected.includes("42")) {
  console.log("✓ Bun.inspect() works correctly");
} else {
  console.error("✗ Bun.inspect() output unexpected");
  process.exit(1);
}

// Test 3: Verify error inspection
try {
  throw new Error("Test error");
} catch (error) {
  const errorInspected = Bun.inspect(error, { colors: true });
  if (errorInspected.includes("Test error")) {
    console.log("✓ Error inspection works");
  } else {
    console.error("✗ Error inspection failed");
    process.exit(1);
  }
}

console.log("\n✅ All debug setup tests passed!");
console.log("\nTo test inspector:");
console.log("  1. Run: bun --inspect scripts/test-debug-setup.ts");
console.log("  2. Open the debug.bun.sh URL from output");
console.log("  3. Set breakpoints and debug");
