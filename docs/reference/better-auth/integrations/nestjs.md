---
title: NestJS Integration | Better Auth
url:
description: Integrate Better Auth with NestJS.
language: en
---

[\_helo](https://www.better-auth.com/) [docs](https://www.better-auth.com/docs) [examples](https://www.better-auth.com/docs/examples/next-js) [changelogs](https://www.better-auth.com/changelogs) [blogs](https://www.better-auth.com/blog) [community](https://www.better-auth.com/community)

### Get Started

### Concepts

### Authentication

### Databases

### Integrations

### Plugins

### Guides

### Reference

# NestJS Integration

Copy MarkdownOpen in

This guide will show you how to integrate Better Auth with [NestJS](https://nestjs.com/).

Before you start, make sure you have a Better Auth instance configured. If you haven't done that yet, check out the [installation](https://www.better-auth.com/docs/installation).

The NestJS integration is **community maintained**. If you encounter any issues, please open them at [nestjs-better-auth](https://github.com/ThallesP/nestjs-better-auth).

## [Installation](https://www.better-auth.com/docs/integrations/nestjs#installation)

Install the NestJS integration library:

npm

pnpm

yarn

bun

```
npm install @thallesp/nestjs-better-auth
```

## [Basic Setup](https://www.better-auth.com/docs/integrations/nestjs#basic-setup)

Currently, Better Auth's NestJS integration **only supports Express** and does not work with Fastify.

### [1\. Disable Body Parser](https://www.better-auth.com/docs/integrations/nestjs#1-disable-body-parser)

Disable NestJS's built-in body parser to allow Better Auth to handle the raw request body:

main.ts

```
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false, // Required for Better Auth
  });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

### [2\. Import AuthModule](https://www.better-auth.com/docs/integrations/nestjs#2-import-authmodule)

Import the `AuthModule` in your root module:

app.module.ts

```
import { Module } from '@nestjs/common';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { auth } from "./auth"; // Your Better Auth instance

@Module({
  imports: [\
    AuthModule.forRoot(auth),\
  ],
})
export class AppModule {}
```

### [3\. Protect Routes](https://www.better-auth.com/docs/integrations/nestjs#3-protect-routes)

Use the `AuthGuard` to protect your routes:

user.controller.ts

```
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard, Session, UserSession } from '@thallesp/nestjs-better-auth';

@Controller('users')
@UseGuards(AuthGuard)
export class UserController {
  @Get('me')
  async getProfile(@Session() session: UserSession) {
    return { user: session.user };
  }
}
```

## [Full Documentation](https://www.better-auth.com/docs/integrations/nestjs#full-documentation)

For comprehensive documentation including decorators, hooks, global guards, and advanced configuration, visit the [NestJS Better Auth repository](https://github.com/thallesp/nestjs-better-auth).

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/integrations/nestjs.mdx)

[Previous Page\\
\\
Nitro](https://www.better-auth.com/docs/integrations/nitro) [Next Page\\
\\
Mobile & Desktop](https://www.better-auth.com/docs/integrations/nestjs)

### On this page

[Installation](https://www.better-auth.com/docs/integrations/nestjs#installation) [Basic Setup](https://www.better-auth.com/docs/integrations/nestjs#basic-setup) [1\. Disable Body Parser](https://www.better-auth.com/docs/integrations/nestjs#1-disable-body-parser) [2\. Import AuthModule](https://www.better-auth.com/docs/integrations/nestjs#2-import-authmodule) [3\. Protect Routes](https://www.better-auth.com/docs/integrations/nestjs#3-protect-routes) [Full Documentation](https://www.better-auth.com/docs/integrations/nestjs#full-documentation)
