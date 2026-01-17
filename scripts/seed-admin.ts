#!/usr/bin/env bun
/**
 * Seed script to create an admin user
 *
 * Usage:
 *   bun scripts/seed-admin.ts
 *   bun scripts/seed-admin.ts --email admin@example.com --password secure123 --name "Admin User"
 */

import { auth } from "@alfred/auth";
import { db } from "@alfred/db";
import { user } from "@alfred/db/schema/auth";
import { eq } from "drizzle-orm";

const DEFAULT_EMAIL = "admin@example.com";
const DEFAULT_PASSWORD = "admin123456";
const DEFAULT_NAME = "Admin User";

async function main() {
  const args = process.argv.slice(2);
  const emailArg = args
    .find((arg) => arg.startsWith("--email="))
    ?.split("=")[1];
  const passwordArg = args
    .find((arg) => arg.startsWith("--password="))
    ?.split("=")[1];
  const nameArg = args.find((arg) => arg.startsWith("--name="))?.split("=")[1];

  const email = emailArg || process.env.ADMIN_EMAIL || DEFAULT_EMAIL;
  const password =
    passwordArg || process.env.ADMIN_PASSWORD || DEFAULT_PASSWORD;
  const name = nameArg || process.env.ADMIN_NAME || DEFAULT_NAME;

  console.log("Creating admin user...");
  console.log(`  Email: ${email}`);
  console.log(`  Name: ${name}`);

  try {
    // Check if user already exists
    const existingUser = await db
      .select()
      .from(user)
      .where(eq(user.email, email))
      .limit(1);

    if (existingUser.length > 0) {
      console.log(`❌ User with email ${email} already exists`);
      console.log(`   User ID: ${existingUser[0].id}`);
      process.exit(1);
    }

    // Create user using Better Auth API
    const result = await auth.api.signUpEmail({
      body: {
        email,
        password,
        name,
      },
    });

    if (result.user) {
      console.log("✅ Admin user created successfully!");
      console.log(`   User ID: ${result.user.id}`);
      console.log(`   Email: ${result.user.email}`);
      console.log(`   Name: ${result.user.name}`);
      console.log("\nYou can now sign in with:");
      console.log(`   Email: ${email}`);
      console.log(`   Password: ${password}`);
    } else {
      console.error("❌ Failed to create user");
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Error creating admin user:", error);
    if (error instanceof Error) {
      console.error(`   ${error.message}`);
    }
    process.exit(1);
  }
}

main();
