Databases are at the core of any dynamic application, providing the necessary infrastructure to store, retrieve, and manage data. TanStack Start makes it easy to integrate with a variety of databases, offering a flexible approach to managing your application's data layer.

What should I use?

TanStack Start is **designed to work with any database provider** , so if you already have a preferred database system, you can integrate it with TanStack Start using the provided full-stack APIs. Whether you're working with SQL, NoSQL, or other types of databases, TanStack Start can handle your needs.

How simple is it to use a database with TanStack Start?

Using a database with TanStack Start is as simple as calling into your database's adapter/client/driver/service from a TanStack Start server function or server route.

Here's an abstract example of how you might connect with a database and read/write to it:


 import { createServerFn } from '@tanstack/react-start'

 const db = createMyDatabaseClient()

 export const getUser = createServerFn(async ({ ctx }) => {
 const user = await db.getUser(ctx.userId)
 return user
 })

 export const createUser = createServerFn(async ({ ctx, input }) => {
 const user = await db.createUser(input)
 return user
 })



 import { createServerFn } from '@tanstack/react-start'

 const db = createMyDatabaseClient()

 export const getUser = createServerFn(async ({ ctx }) => {
 const user = await db.getUser(ctx.userId)
 return user
 })

 export const createUser = createServerFn(async ({ ctx, input }) => {
 const user = await db.createUser(input)
 return user
 })


This is obviously contrived, but it demonstrates that you can use literally any database provider with TanStack Start as long as you can call into it from a server function or server route.

Recommended Database Providers

While TanStack Start is designed to work with any database provider, we highly recommend considering one of our vetted partner database providers Neon or Convex. They have been vetted by TanStack to match our quality, openness, and performance standards and are both excellent choices for your database needs.

What is Neon?

Neon is a fully managed serverless PostgreSQL with a generous free tier. It separates storage and compute to offer autoscaling, branching, and bottomless storage. With Neon, you get all the power and reliability of PostgreSQL combined with modern cloud capabilities, making it perfect for TanStack Start applications.

Key features that make Neon stand out:

 * Serverless PostgreSQL that scales automatically
 * Database branching for development and testing
 * Built-in connection pooling
 * Point-in-time restore
 * Web-based SQL editor
 * Bottomless storage


 * To learn more about Neon, visit the Neon website
 * To sign up, visit the Neon dashboard

What is Convex?

Convex is a powerful, serverless database platform that simplifies the process of managing your application's data. With Convex, you can build full-stack applications without the need to manually manage database servers or write complex queries. Convex provides a real-time, scalable, and transactional data backend that seamlessly integrates with TanStack Start, making it an excellent choice for modern web applications.

Convex's declarative data model and automatic conflict resolution ensure that your application remains consistent and responsive, even at scale. It's designed to be developer-friendly, with a focus on simplicity and productivity.

What is Prisma Postgres?

Instant Postgres, Zero Setup: Get a production-ready Postgres database in seconds, then dive straight back into code. We handle connections, scaling, and turning knobs so your flow never breaks. Blends perfectly with TanStack Start.

 * Edge-optimized: Local region routing means lower latency and fewer hops. Even complex queries are one fast round trip.
 * Fits your stack: Works with your frameworks, libraries, and tools for a smooth DX.
 * Web UI: A hosted interface to inspect, manage, and query data with your team.
 * Auto-scaling: Grows from zero to millions of users without cold starts or manual tuning.
 * Unikernel isolation: Each DB runs as its own unikernel for security, speed, and efficiency.


 * To learn more about Prisma Postgres, visit the Prisma website
 * To sign up, visit the Prisma Console

Documentation & APIs

Documentation for integrating different databases with TanStack Start is coming soon! In the meantime, keep an eye on our examples and guide to learn how to fully leverage your data layer across your TanStack Start application.