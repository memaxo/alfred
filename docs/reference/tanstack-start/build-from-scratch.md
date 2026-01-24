Note

If you chose to quick start with an example or cloned project, you can skip this guide and move on to the Routing guide.

_So you want to build a TanStack Start project from scratch?_

This guide will help you build a **very** basic TanStack Start web application. Together, we will use TanStack Start to:

- Serve an index page
- Display a counter
- Increment the counter on the server and client

Here is what that will look like

Let's create a new project directory and initialize it.

mkdir myApp
cd myApp
npm init -y

mkdir myApp
cd myApp
npm init -y

Note

> We use npm in all of these examples, but you can use your package manager of choice instead.

TypeScript Configuration

We highly recommend using TypeScript with TanStack Start. Create a tsconfig.json file with at least the following settings:

{
"compilerOptions": {
"jsx": "react-jsx",
"moduleResolution": "Bundler",
"module": "ESNext",
"target": "ES2022",
"skipLibCheck": true,
"strictNullChecks": true
}
}

{
"compilerOptions": {
"jsx": "react-jsx",
"moduleResolution": "Bundler",
"module": "ESNext",
"target": "ES2022",
"skipLibCheck": true,
"strictNullChecks": true
}
}

Note

> Enabling verbatimModuleSyntax can result in server bundles leaking into client bundles. It is recommended to keep this option disabled.

Install Dependencies

TanStack Start is powered by Vite and TanStack Router and requires them as dependencies.

To install them, run:

npm i @tanstack/react-start @tanstack/react-router

npm i @tanstack/react-start @tanstack/react-router

We also need vite as a devDependency:

npm i -D vite

npm i -D vite

You'll also need React:

npm i react react-dom

npm i react react-dom

As well as React's Vite plugin:

npm i -D @vitejs/plugin-react

npm i -D @vitejs/plugin-react

Alternatively, you can also use @vitejs/plugin-react-oxc or @vitejs/plugin-react-swc.

and some TypeScript:

npm i -D typescript @types/react @types/react-dom @types/node vite-tsconfig-paths

npm i -D typescript @types/react @types/react-dom @types/node vite-tsconfig-paths

Update Configuration Files

We'll then update our package.json to use Vite's CLI and set "type": "module":

{
// ...
"type": "module",
"scripts": {
"dev": "vite dev",
"build": "vite build"
}
}

{
// ...
"type": "module",
"scripts": {
"dev": "vite dev",
"build": "vite build"
}
}

Then configure TanStack Start's Vite plugin in vite.config.ts:

// vite.config.ts
import { defineConfig } from 'vite'
import tsConfigPaths from 'vite-tsconfig-paths'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'

export default defineConfig({
server: {
port: 3000,
},
plugins: [
tsConfigPaths(),
tanstackStart(),
// react's vite plugin must come after start's vite plugin
viteReact(),
],
})

// vite.config.ts
import { defineConfig } from 'vite'
import tsConfigPaths from 'vite-tsconfig-paths'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'

export default defineConfig({
server: {
port: 3000,
},
plugins: [
tsConfigPaths(),
tanstackStart(),
// react's vite plugin must come after start's vite plugin
viteReact(),
],
})

Add the Basic Templating

There are 2 required files for TanStack Start usage:

1.  The router configuration
2.  The root of your application

Once configuration is done, we'll have a file tree that looks like the following:

.
├── src/
│ ├── routes/
│ │ └── `__root.tsx`
│ ├── `router.tsx`
│ ├── `routeTree.gen.ts`
├── `vite.config.ts`
├── `package.json`
└── `tsconfig.json`

.
├── src/
│ ├── routes/
│ │ └── `__root.tsx`
│ ├── `router.tsx`
│ ├── `routeTree.gen.ts`
├── `vite.config.ts`
├── `package.json`
└── `tsconfig.json`

The Router Configuration

This is the file that will dictate the behavior of TanStack Router used within Start. Here, you can configure everything from the default preloading functionality to caching staleness.

Note

You won't have a routeTree.gen.ts file yet. This file will be generated when you run TanStack Start for the first time.

// src/router.tsx
import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

export function getRouter() {
const router = createRouter({
routeTree,
scrollRestoration: true,
})

return router
}

// src/router.tsx
import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

export function getRouter() {
const router = createRouter({
routeTree,
scrollRestoration: true,
})

return router
}

The Root of Your Application

Finally, we need to create the root of our application. This is the entry point for all other routes. The code in this file will wrap all other routes in the application.

// src/routes/\_\_root.tsx
///
import type { ReactNode } from 'react'
import {
Outlet,
createRootRoute,
HeadContent,
Scripts,
} from '@tanstack/react-router'

export const Route = createRootRoute({
head: () => ({
meta: [
{
charSet: 'utf-8',
},
{
name: 'viewport',
content: 'width=device-width, initial-scale=1',
},
{
title: 'TanStack Start Starter',
},
],
}),
component: RootComponent,
})

function RootComponent() {
return (

)
}

function RootDocument({ children }: Readonly) {
return (

{children}

)
}

// src/routes/\_\_root.tsx
///
import type { ReactNode } from 'react'
import {
Outlet,
createRootRoute,
HeadContent,
Scripts,
} from '@tanstack/react-router'

export const Route = createRootRoute({
head: () => ({
meta: [
{
charSet: 'utf-8',
},
{
name: 'viewport',
content: 'width=device-width, initial-scale=1',
},
{
title: 'TanStack Start Starter',
},
],
}),
component: RootComponent,
})

function RootComponent() {
return (

)
}

function RootDocument({ children }: Readonly) {
return (

{children}

)
}

Writing Your First Route

Now that we have the basic templating setup, we can write our first route. This is done by creating a new file in the src/routes directory.

// src/routes/index.tsx
import \* as fs from 'node:fs'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

const filePath = 'count.txt'

async function readCount() {
return parseInt(
await fs.promises.readFile(filePath, 'utf-8').catch(() => '0'),
)
}

const getCount = createServerFn({
method: 'GET',
}).handler(() => {
return readCount()
})

const updateCount = createServerFn({ method: 'POST' })
.inputValidator((d: number) => d)
.handler(async ({ data }) => {
const count = await readCount()
await fs.promises.writeFile(filePath, `${count + data}`)
})

export const Route = createFileRoute('/')({
component: Home,
loader: async () => await getCount(),
})

function Home() {
const router = useRouter()
const state = Route.useLoaderData()

return (
{
updateCount({ data: 1 }).then(() => {
router.invalidate()
})
}}

> Add 1 to {state}?

)
}

// src/routes/index.tsx
import \* as fs from 'node:fs'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

const filePath = 'count.txt'

async function readCount() {
return parseInt(
await fs.promises.readFile(filePath, 'utf-8').catch(() => '0'),
)
}

const getCount = createServerFn({
method: 'GET',
}).handler(() => {
return readCount()
})

const updateCount = createServerFn({ method: 'POST' })
.inputValidator((d: number) => d)
.handler(async ({ data }) => {
const count = await readCount()
await fs.promises.writeFile(filePath, `${count + data}`)
})

export const Route = createFileRoute('/')({
component: Home,
loader: async () => await getCount(),
})

function Home() {
const router = useRouter()
const state = Route.useLoaderData()

return (
{
updateCount({ data: 1 }).then(() => {
router.invalidate()
})
}}

> Add 1 to {state}?

)
}

That's it! 🤯 You've now set up a TanStack Start project and written your first route. 🎉

You can now run npm run dev to start your server and navigate to http://localhost:3000 to see your route in action.

You want to deploy your application? Check out the hosting guide.
