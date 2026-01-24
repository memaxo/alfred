Error Boundaries (React Start)

TanStack Start uses TanStack Router's route-level error boundaries.

- Set a default for all routes via the router
- Override per-route with errorComponent

Configure a default

// src/router.tsx
import { createRouter, ErrorComponent } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

export function getRouter() {
const router = createRouter({
routeTree,
// Shown when an error bubbles to the router
defaultErrorComponent: ({ error, reset }) => (

),
})
return router
}

// src/router.tsx
import { createRouter, ErrorComponent } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

export function getRouter() {
const router = createRouter({
routeTree,
// Shown when an error bubbles to the router
defaultErrorComponent: ({ error, reset }) => (

),
})
return router
}

Per-route override

// src/routes/posts.$postId.tsx
import { createFileRoute, ErrorComponent } from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'

function PostError({ error, reset }: ErrorComponentProps) {
return
}

export const Route = createFileRoute('/posts/$postId')({
component: PostComponent,
errorComponent: PostError,
})

// src/routes/posts.$postId.tsx
import { createFileRoute, ErrorComponent } from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'

function PostError({ error, reset }: ErrorComponentProps) {
return
}

export const Route = createFileRoute('/posts/$postId')({
component: PostComponent,
errorComponent: PostError,
})

Notes:

- ErrorComponent is a simple built-in UI you can replace.
- Call reset() to retry rendering the route after fixing state.
- Use beforeLoad/loader to throw errors that will be caught.
