This guide covers patterns for controlling where code runs in your TanStack Start application - server-only, client-only, or isomorphic (both environments). For foundational concepts, see the Execution Model guide.

Quick Start

Set up execution boundaries in your TanStack Start application:

import {
createServerFn,
createServerOnlyFn,
createClientOnlyFn,
createIsomorphicFn,
} from '@tanstack/react-start'

// Server function (RPC call)
const getUsers = createServerFn().handler(async () => {
return await db.users.findMany()
})

// Server-only utility (crashes on client)
const getSecret = createServerOnlyFn(() => process.env.API_SECRET)

// Client-only utility (crashes on server)
const saveToStorage = createClientOnlyFn((data: any) => {
localStorage.setItem('data', JSON.stringify(data))
})

// Different implementations per environment
const logger = createIsomorphicFn()
.server((msg) => console.log(`[SERVER]: ${msg}`))
.client((msg) => console.log(`[CLIENT]: ${msg}`))

import {
createServerFn,
createServerOnlyFn,
createClientOnlyFn,
createIsomorphicFn,
} from '@tanstack/react-start'

// Server function (RPC call)
const getUsers = createServerFn().handler(async () => {
return await db.users.findMany()
})

// Server-only utility (crashes on client)
const getSecret = createServerOnlyFn(() => process.env.API_SECRET)

// Client-only utility (crashes on server)
const saveToStorage = createClientOnlyFn((data: any) => {
localStorage.setItem('data', JSON.stringify(data))
})

// Different implementations per environment
const logger = createIsomorphicFn()
.server((msg) => console.log(`[SERVER]: ${msg}`))
.client((msg) => console.log(`[CLIENT]: ${msg}`))

Implementation Patterns Progressive Enhancement

// Component works without JS, enhanced with JS
function SearchForm() {
const [query, setQuery] = useState('')

return (

setQuery(e.target.value)}
/>
Search}>
search(query)} />

)
}

// Component works without JS, enhanced with JS
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

Common Problems Environment Variable Exposure

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

Production Checklist
