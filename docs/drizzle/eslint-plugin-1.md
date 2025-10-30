---
title: Drizzle ORM - ESLint Plugin
url: 
description: Drizzle ORM is a lightweight and performant TypeScript ORM with developer experience in mind.
language: en
---

[Drizzle Studio Gateway is now FREE 👀](https://gateway.drizzle.team/)

[v1.0\\
\\
75%](https://orm.drizzle.team/roadmap)

[Benchmarks](https://orm.drizzle.team/benchmarks) [Extension](https://driz.link/extension) [Studio](https://orm.drizzle.team/drizzle-studio/overview) [Studio Package](https://github.com/drizzle-team/drizzle-studio-npm) [Gateway](https://gateway.drizzle.team/) [Drizzle Run](https://drizzle.run/)

Our goodies!

[![](<Base64-Image-Removed>)![Gel](<Base64-Image-Removed>)](https://driz.link/edgedb)

[![](<Base64-Image-Removed>)![Turso](<Base64-Image-Removed>)\\
\\
🚀 Drizzle is giving you 10% off Turso Scaler and Pro for 1 Year 🚀](https://driz.link/turso) [![](<Base64-Image-Removed>)![Payload](<Base64-Image-Removed>)](https://driz.link/payload) [![](<Base64-Image-Removed>)![Xata](<Base64-Image-Removed>)](https://driz.link/xataio) [![](<Base64-Image-Removed>)![Neon](<Base64-Image-Removed>)](https://driz.link/neon) [![](<Base64-Image-Removed>)![Nuxt](<Base64-Image-Removed>)](https://hub.nuxt.com/?utm_source=drizzle-docs) [![](<Base64-Image-Removed>)![SQLite Cloud](<Base64-Image-Removed>)](https://driz.link/sqlitecloud) [![](<Base64-Image-Removed>)![Upstash](<Base64-Image-Removed>)](https://driz.link/upstash) [![](<Base64-Image-Removed>)![SingleStore](<Base64-Image-Removed>)](https://driz.link/singlestore) [![](<Base64-Image-Removed>)![Lokalise](<Base64-Image-Removed>)](https://driz.link/lokalise) [![](<Base64-Image-Removed>)![Replit](<Base64-Image-Removed>)](https://driz.link/replit) [![](<Base64-Image-Removed>)![Sentry](<Base64-Image-Removed>)](https://driz.link/sentry) [![](<Base64-Image-Removed>)![Sevalla](<Base64-Image-Removed>)](https://driz.link/sevalla) [![](<Base64-Image-Removed>)![GibsonAI](<Base64-Image-Removed>)](https://driz.link/gibsonai) [![](<Base64-Image-Removed>)![Sponsor](<Base64-Image-Removed>)](https://driz.link/sponsor)

Product by Drizzle Team

[One Dollar Stats$1 per mo web analytics\\
\\
christmas\\
\\
deal](https://driz.link/onedollarstats)

# ESLint Drizzle Plugin

For cases where it’s impossible to perform type checks for specific scenarios, or where it’s possible but error messages would be challenging to understand, we’ve decided to create an ESLint package with recommended rules. This package aims to assist developers in handling crucial scenarios during development

## Install

npm

yarn

pnpm

bun

```
npm i eslint-plugin-drizzle
npm i @typescript-eslint/eslint-plugin @typescript-eslint/parser
```

```
yarn add eslint-plugin-drizzle
yarn add @typescript-eslint/eslint-plugin @typescript-eslint/parser
```

```
pnpm add eslint-plugin-drizzle
pnpm add @typescript-eslint/eslint-plugin @typescript-eslint/parser
```

```
bun add eslint-plugin-drizzle
bun add @typescript-eslint/eslint-plugin @typescript-eslint/parser
```

## Usage

**`.eslintrc.yml` example**

```
root: true
parser: '@typescript-eslint/parser'
parserOptions:
  project: './tsconfig.json'
plugins:
  - drizzle
rules:
  'drizzle/enforce-delete-with-where': "error"
  'drizzle/enforce-update-with-where': "error"
```

**All config**

This plugin exports an `all` that makes use of all rules (except for deprecated ones).

```
root: true
extends:
  - "plugin:drizzle/all"
parser: '@typescript-eslint/parser'
parserOptions:
  project: './tsconfig.json'
plugins:
  - drizzle
```

**Recommended config**

At the moment, `all` is equivalent to `recommended`

```
root: true
extends:
  - "plugin:drizzle/recommended"
parser: '@typescript-eslint/parser'
parserOptions:
  project: './tsconfig.json'
plugins:
  - drizzle
```

## Rules

### **enforce-delete-with-where**

Enforce using `delete` with the `.where()` clause in the `.delete()` statement. Most of the time,
you don’t need to delete all rows in the table and require some kind of `WHERE` statements.

Optionally, you can define a `drizzleObjectName` in the plugin options that accept a `string` or
`string[]`. This is useful when you have objects or classes with a delete method that’s not from
Drizzle. Such a `delete` method will trigger the ESLint rule. To avoid that, you can define the
name of the Drizzle object that you use in your codebase (like db) so that the rule would only
trigger if the delete method comes from this object:

Example, config 1:

```
rules:
  'drizzle/enforce-delete-with-where': "error"
```

```
class MyClass {
  public delete() {
    return {}
  }
}

const myClassObj = new MyClass();

// ---> Will be triggered by ESLint Rule
myClassObj.delete()

const db = drizzle(...)
// ---> Will be triggered by ESLint Rule
db.delete()
```

Example, config 2:

```
rules:
  'drizzle/enforce-delete-with-where':
    - "error"
    - "drizzleObjectName":
      - "db"
```

```
class MyClass {
  public delete() {
    return {}
  }
}

const myClassObj = new MyClass();

// ---> Will NOT be triggered by ESLint Rule
myClassObj.delete()

const db = drizzle(...)
// ---> Will be triggered by ESLint Rule
db.delete()
```

### **enforce-update-with-where**:

Enforce using `update` with the `.where()` clause in the `.update()` statement.
Most of the time, you don’t need to update all rows in the table and require
some kind of `WHERE` statements.

Optionally, you can define a `drizzleObjectName` in the plugin options that accept
a `string` or `string[]`. This is useful when you have objects or classes with a delete
method that’s not from Drizzle. Such as `update` method will trigger the ESLint rule. To
avoid that, you can define the name of the Drizzle object that you use in your codebase (like db)
so that the rule would only trigger if the delete method comes from this object:

Example, config 1:

```
rules:
  'drizzle/enforce-update-with-where': "error"
```

```
class MyClass {
  public update() {
    return {}
  }
}

const myClassObj = new MyClass();

// ---> Will be triggered by ESLint Rule
myClassObj.update()

const db = drizzle(...)
// ---> Will be triggered by ESLint Rule
db.update()
```

Example, config 2:

```
rules:
  'drizzle/enforce-update-with-where':
    - "error"
    - "drizzleObjectName":
      - "db"
```

```
class MyClass {
  public update() {
    return {}
  }
}

const myClassObj = new MyClass();

// ---> Will NOT be triggered by ESLint Rule
myClassObj.update()

const db = drizzle(...)
// ---> Will be triggered by ESLint Rule
db.update()
```