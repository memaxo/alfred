"use strict";
/** @type {import('drizzle-kit').Config} */
module.exports = {
  schema: "./src/schema",
  out: "./src/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "",
  },
};
