Server Entry Point

Note

The server entry point is **optional** out of the box. If not provided, TanStack Start will automatically handle the server entry point for you using the below as a default.

This is done via the src/server.ts file.


 // src/server.ts
 import handler, { type ServerEntry } from '@tanstack/react-start/server-entry'

 export default {
 fetch(request) {
 return handler.fetch(request)
 },
 } satisfies ServerEntry



 // src/server.ts
 import handler, { type ServerEntry } from '@tanstack/react-start/server-entry'

 export default {
 fetch(request) {
 return handler.fetch(request)
 },
 } satisfies ServerEntry


The default export must conform to the ServerEntry interface:


 export default {
 fetch(req: Request, opts?: RequestOptions): Promise {
 // ...
 },
 }



 export default {
 fetch(req: Request, opts?: RequestOptions): Promise {
 // ...
 },
 }


Whether we are statically generating our app or serving it dynamically, the server.ts file is the entry point for doing all SSR-related work as well as for handling server routes and server function requests.

Custom Server Handlers

You can create custom server handlers to modify how your application is rendered:


 // src/server.ts
 import {
 createStartHandler,
 defaultStreamHandler,
 defineHandlerCallback,
 } from '@tanstack/react-start/server'
 import type { ServerEntry } from '@tanstack/react-start/server-entry'

 const customHandler = defineHandlerCallback((ctx) => {
 // add custom logic here
 return defaultStreamHandler(ctx)
 })

 const fetch = createStartHandler(customHandler)

 export default {
 fetch,
 } satisfies ServerEntry



 // src/server.ts
 import {
 createStartHandler,
 defaultStreamHandler,
 defineHandlerCallback,
 } from '@tanstack/react-start/server'
 import type { ServerEntry } from '@tanstack/react-start/server-entry'

 const customHandler = defineHandlerCallback((ctx) => {
 // add custom logic here
 return defaultStreamHandler(ctx)
 })

 const fetch = createStartHandler(customHandler)

 export default {
 fetch,
 } satisfies ServerEntry


Request context

When your server needs to pass additional, typed data into request handlers (for example, authenticated user info, a database connection, or per-request flags), register a request context type via TypeScript module augmentation. The registered context is delivered as the second argument to the server fetch handler and is available throughout the server-side middleware chain — including global middleware, request/function middleware, server routes, server functions, and the router itself.

To add types for your request context, augment the Register interface from @tanstack/react-start with a server.requestContext property. The runtime context you pass to handler.fetch will then match that type. Example:


 import handler, { type ServerEntry } from '@tanstack/react-start/server-entry'

 type MyRequestContext = {
 hello: string
 foo: number
 }

 declare module '@tanstack/react-start' {
 interface Register {
 server: {
 requestContext: MyRequestContext
 }
 }
 }

 export default {
 async fetch(request) {
 return handler.fetch(request, { context: { hello: 'world', foo: 123 } })
 },
 } satisfies ServerEntry



 import handler, { type ServerEntry } from '@tanstack/react-start/server-entry'

 type MyRequestContext = {
 hello: string
 foo: number
 }

 declare module '@tanstack/react-start' {
 interface Register {
 server: {
 requestContext: MyRequestContext
 }
 }
 }

 export default {
 async fetch(request) {
 return handler.fetch(request, { context: { hello: 'world', foo: 123 } })
 },
 } satisfies ServerEntry


Server Configuration

The server entry point is where you can configure server-specific behavior:

 * Request/response middleware
 * Custom error handling
 * Authentication logic
 * Database connections
 * Logging and monitoring

This flexibility allows you to customize how your TanStack Start application handles server-side rendering while maintaining the framework's conventions.