Understanding where code runs is fundamental to building TanStack Start applications. This guide explains TanStack Start's execution model and how to control where your code executes.

Core Principle: Isomorphic by Default

**All code in TanStack Start is isomorphic by default** \- it runs and is included in both server and client bundles unless explicitly constrained.


 // ✅ This runs on BOTH server and client
 function formatPrice(price: number) {
 return new Intl.NumberFormat('en-US', {
 style: 'currency',
 currency: 'USD',
 }).format(price)
 }

 // ✅ Route loaders are ISOMORPHIC
 export const Route = createFileRoute('/products')({
 loader: async () => {
 // This runs on server during SSR AND on client during navigation
 const response = await fetch('/api/products')
 return response.json()
 },
 })



 // ✅ This runs on BOTH server and client
 function formatPrice(price: number) {
 return new Intl.NumberFormat('en-US', {
 style: 'currency',
 currency: 'USD',
 }).format(price)
 }

 // ✅ Route loaders are ISOMORPHIC
 export const Route = createFileRoute('/products')({
 loader: async () => {
 // This runs on server during SSR AND on client during navigation
 const response = await fetch('/api/products')
 return response.json()
 },
 })


> **Critical Understanding** : Route loaders are isomorphic - they run on both server and client, not just the server.

The Execution Boundary

TanStack Start applications run in two environments:

Server Environment

 * **Node.js runtime** with access to file system, databases, environment variables
 * **During SSR** \- Initial page renders on server
 * **API requests** \- Server functions execute server-side
 * **Build time** \- Static generation and pre-rendering

Client Environment

 * **Browser runtime** with access to DOM, localStorage, user interactions
 * **After hydration** \- Client takes over after initial server render
 * **Navigation** \- Route loaders run client-side during navigation
 * **User interactions** \- Event handlers, form submissions, etc.

Execution Control APIs Server-Only Execution API| Use Case| Client Behavior
---|---|---
createServerFn()| RPC calls, data mutations| Network request to server
createServerOnlyFn(fn)| Utility functions| Throws error


 import { createServerFn, createServerOnlyFn } from '@tanstack/react-start'

 // RPC: Server execution, callable from client
 const updateUser = createServerFn({ method: 'POST' })
 .inputValidator((data: UserData) => data)
 .handler(async ({ data }) => {
 // Only runs on server, but client can call it
 return await db.users.update(data)
 })

 // Utility: Server-only, client crashes if called
 const getEnvVar = createServerOnlyFn(() => process.env.DATABASE_URL)



 import { createServerFn, createServerOnlyFn } from '@tanstack/react-start'

 // RPC: Server execution, callable from client
 const updateUser = createServerFn({ method: 'POST' })
 .inputValidator((data: UserData) => data)
 .handler(async ({ data }) => {
 // Only runs on server, but client can call it
 return await db.users.update(data)
 })

 // Utility: Server-only, client crashes if called
 const getEnvVar = createServerOnlyFn(() => process.env.DATABASE_URL)


Client-Only Execution API| Use Case| Server Behavior
---|---|---
createClientOnlyFn(fn)| Browser utilities| Throws error
| Components needing browser APIs| Renders fallback


 import { createClientOnlyFn } from '@tanstack/react-start'
 import { ClientOnly } from '@tanstack/react-router'

 // Utility: Client-only, server crashes if called
 const saveToStorage = createClientOnlyFn((key: string, value: any) => {
 localStorage.setItem(key, JSON.stringify(value))
 })

 // Component: Only renders children after hydration
 function Analytics() {
 return (



 )
 }



 import { createClientOnlyFn } from '@tanstack/react-start'
 import { ClientOnly } from '@tanstack/react-router'

 // Utility: Client-only, server crashes if called
 const saveToStorage = createClientOnlyFn((key: string, value: any) => {
 localStorage.setItem(key, JSON.stringify(value))
 })

 // Component: Only renders children after hydration
 function Analytics() {
 return (



 )
 }


Environment-Specific Implementations


 import { createIsomorphicFn } from '@tanstack/react-start'

 // Different implementation per environment
 const getDeviceInfo = createIsomorphicFn()
 .server(() => ({ type: 'server', platform: process.platform }))
 .client(() => ({ type: 'client', userAgent: navigator.userAgent }))



 import { createIsomorphicFn } from '@tanstack/react-start'

 // Different implementation per environment
 const getDeviceInfo = createIsomorphicFn()
 .server(() => ({ type: 'server', platform: process.platform }))
 .client(() => ({ type: 'client', userAgent: navigator.userAgent }))


Architectural Patterns Progressive Enhancement

Build components that work without JavaScript and enhance with client-side functionality:


 function SearchForm() {
 const [query, setQuery] = useState('')

 return (

 setQuery(e.target.value)}
 />
 Search}>
 search(query)} />


 )
 }



 function SearchForm() {
 const [query, setQuery] = useState('')

 return (

 setQuery(e.target.value)}
 />
 Search}>
 search(query)} />


 )
 }


Environment-Aware Storage


 const storage = createIsomorphicFn()
 .server((key: string) => {
 // Server: File-based cache
 const fs = require('node:fs')
 return JSON.parse(fs.readFileSync('.cache', 'utf-8'))[key]
 })
 .client((key: string) => {
 // Client: localStorage
 return JSON.parse(localStorage.getItem(key) || 'null')
 })



 const storage = createIsomorphicFn()
 .server((key: string) => {
 // Server: File-based cache
 const fs = require('node:fs')
 return JSON.parse(fs.readFileSync('.cache', 'utf-8'))[key]
 })
 .client((key: string) => {
 // Client: localStorage
 return JSON.parse(localStorage.getItem(key) || 'null')
 })


RPC vs Direct Function Calls

Understanding when to use server functions vs server-only functions:


 // createServerFn: RPC pattern - server execution, client callable
 const fetchUser = createServerFn().handler(async () => await db.users.find())

 // Usage from client component:
 const user = await fetchUser() // ✅ Network request

 // createServerOnlyFn: Crashes if called from client
 const getSecret = createServerOnlyFn(() => process.env.SECRET)

 // Usage from client:
 const secret = getSecret() // ❌ Throws error



 // createServerFn: RPC pattern - server execution, client callable
 const fetchUser = createServerFn().handler(async () => await db.users.find())

 // Usage from client component:
 const user = await fetchUser() // ✅ Network request

 // createServerOnlyFn: Crashes if called from client
 const getSecret = createServerOnlyFn(() => process.env.SECRET)

 // Usage from client:
 const secret = getSecret() // ❌ Throws error


Common Anti-Patterns Environment Variable Exposure


 // ❌ Exposes to client bundle
 const apiKey = process.env.SECRET_KEY

 // ✅ Server-only access
 const apiKey = createServerOnlyFn(() => process.env.SECRET_KEY)



 // ❌ Exposes to client bundle
 const apiKey = process.env.SECRET_KEY

 // ✅ Server-only access
 const apiKey = createServerOnlyFn(() => process.env.SECRET_KEY)


Incorrect Loader Assumptions


 // ❌ Assuming loader is server-only
 export const Route = createFileRoute('/users')({
 loader: () => {
 // This runs on BOTH server and client!
 const secret = process.env.SECRET // Exposed to client
 return fetch(`/api/users?key=${secret}`)
 },
 })

 // ✅ Use server function for server-only operations
 const getUsersSecurely = createServerFn().handler(() => {
 const secret = process.env.SECRET // Server-only
 return fetch(`/api/users?key=${secret}`)
 })

 export const Route = createFileRoute('/users')({
 loader: () => getUsersSecurely(), // Isomorphic call to server function
 })



 // ❌ Assuming loader is server-only
 export const Route = createFileRoute('/users')({
 loader: () => {
 // This runs on BOTH server and client!
 const secret = process.env.SECRET // Exposed to client
 return fetch(`/api/users?key=${secret}`)
 },
 })

 // ✅ Use server function for server-only operations
 const getUsersSecurely = createServerFn().handler(() => {
 const secret = process.env.SECRET // Server-only
 return fetch(`/api/users?key=${secret}`)
 })

 export const Route = createFileRoute('/users')({
 loader: () => getUsersSecurely(), // Isomorphic call to server function
 })


Hydration Mismatches


 // ❌ Different content server vs client
 function CurrentTime() {
 return {new Date().toLocaleString()}
 }

 // ✅ Consistent rendering
 function CurrentTime() {
 const [time, setTime] = useState()

 useEffect(() => {
 setTime(new Date().toLocaleString())
 }, [])

 return {time || 'Loading...'}
 }



 // ❌ Different content server vs client
 function CurrentTime() {
 return {new Date().toLocaleString()}
 }

 // ✅ Consistent rendering
 function CurrentTime() {
 const [time, setTime] = useState()

 useEffect(() => {
 setTime(new Date().toLocaleString())
 }, [])

 return {time || 'Loading...'}
 }


Manual vs API-Driven Environment Detection


 // Manual: You handle the logic
 function logMessage(msg: string) {
 if (typeof window === 'undefined') {
 console.log(`[SERVER]: ${msg}`)
 } else {
 console.log(`[CLIENT]: ${msg}`)
 }
 }

 // API: Framework handles it
 const logMessage = createIsomorphicFn()
 .server((msg) => console.log(`[SERVER]: ${msg}`))
 .client((msg) => console.log(`[CLIENT]: ${msg}`))



 // Manual: You handle the logic
 function logMessage(msg: string) {
 if (typeof window === 'undefined') {
 console.log(`[SERVER]: ${msg}`)
 } else {
 console.log(`[CLIENT]: ${msg}`)
 }
 }

 // API: Framework handles it
 const logMessage = createIsomorphicFn()
 .server((msg) => console.log(`[SERVER]: ${msg}`))
 .client((msg) => console.log(`[CLIENT]: ${msg}`))


Architecture Decision Framework

**Choose Server-Only when:**

 * Accessing sensitive data (environment variables, secrets)
 * File system operations
 * Database connections
 * External API keys

**Choose Client-Only when:**

 * DOM manipulation
 * Browser APIs (localStorage, geolocation)
 * User interaction handling
 * Analytics/tracking

**Choose Isomorphic when:**

 * Data formatting/transformation
 * Business logic
 * Shared utilities
 * Route loaders (they're isomorphic by nature)

Security Considerations Bundle Analysis

Always verify server-only code isn't included in client bundles:


 # Analyze client bundle
 npm run build
 # Check dist/client for any server-only imports



 # Analyze client bundle
 npm run build
 # Check dist/client for any server-only imports


Environment Variable Strategy

 * **Client-exposed** : Use VITE_ prefix for client-accessible variables
 * **Server-only** : Access via createServerOnlyFn() or createServerFn()
 * **Never expose** : Database URLs, API keys, secrets

Error Boundaries

Handle server/client execution errors gracefully:


 function ErrorBoundary({ children }: { children: React.ReactNode }) {
 return (
 Something went wrong}
 onError={(error) => {
 if (typeof window === 'undefined') {
 console.error('[SERVER ERROR]:', error)
 } else {
 console.error('[CLIENT ERROR]:', error)
 }
 }}
 >
 {children}

 )
 }



 function ErrorBoundary({ children }: { children: React.ReactNode }) {
 return (
 Something went wrong}
 onError={(error) => {
 if (typeof window === 'undefined') {
 console.error('[SERVER ERROR]:', error)
 } else {
 console.error('[CLIENT ERROR]:', error)
 }
 }}
 >
 {children}

 )
 }


Understanding TanStack Start's execution model is crucial for building secure, performant, and maintainable applications. The isomorphic-by-default approach provides flexibility while the execution control APIs give you precise control when needed.