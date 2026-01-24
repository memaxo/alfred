Learn how to securely configure and use environment variables in your TanStack Start application across different contexts (server functions, client code, and build processes).

Quick Start

TanStack Start automatically loads .env files and makes variables available in both server and client contexts with proper security boundaries.

# .env

DATABASE_URL=postgresql://user:pass@localhost:5432/mydb
VITE_APP_NAME=My TanStack Start App

# .env

DATABASE_URL=postgresql://user:pass@localhost:5432/mydb
VITE_APP_NAME=My TanStack Start App

// Server function - can access any environment variable
const getUser = createServerFn().handler(async () => {
const db = await connect(process.env.DATABASE_URL) // ✅ Server-only
return db.user.findFirst()
})

// Client component - only VITE\_ prefixed variables
export function AppHeader() {
return {import.meta.env.VITE_APP_NAME} // ✅ Client-safe
}

// Server function - can access any environment variable
const getUser = createServerFn().handler(async () => {
const db = await connect(process.env.DATABASE_URL) // ✅ Server-only
return db.user.findFirst()
})

// Client component - only VITE\_ prefixed variables
export function AppHeader() {
return {import.meta.env.VITE_APP_NAME} // ✅ Client-safe
}

Environment Variable Contexts Server-Side Context (Server Functions & API Routes)

Server functions can access **any** environment variable using process.env:

import { createServerFn } from '@tanstack/react-start'

// Database connection (server-only)
const connectToDatabase = createServerFn().handler(async () => {
const connectionString = process.env.DATABASE_URL // No prefix needed
const apiKey = process.env.EXTERNAL_API_SECRET // Stays on server

// These variables are never exposed to the client
return await database.connect(connectionString)
})

// Authentication (server-only)
const authenticateUser = createServerFn()
.inputValidator(z.object({ token: z.string() }))
.handler(async ({ data }) => {
const jwtSecret = process.env.JWT_SECRET // Server-only
return jwt.verify(data.token, jwtSecret)
})

import { createServerFn } from '@tanstack/react-start'

// Database connection (server-only)
const connectToDatabase = createServerFn().handler(async () => {
const connectionString = process.env.DATABASE_URL // No prefix needed
const apiKey = process.env.EXTERNAL_API_SECRET // Stays on server

// These variables are never exposed to the client
return await database.connect(connectionString)
})

// Authentication (server-only)
const authenticateUser = createServerFn()
.inputValidator(z.object({ token: z.string() }))
.handler(async ({ data }) => {
const jwtSecret = process.env.JWT_SECRET // Server-only
return jwt.verify(data.token, jwtSecret)
})

Client-Side Context (Components & Client Code)

Client code can only access variables with the VITE\_ prefix:

// Client configuration
export function ApiProvider({ children }: { children: React.ReactNode }) {
const apiUrl = import.meta.env.VITE_API_URL // ✅ Public
const apiKey = import.meta.env.VITE_PUBLIC_KEY // ✅ Public

// This would be undefined (security feature):
// const secret = import.meta.env.DATABASE_URL // ❌ Undefined

return (

{children}

)
}

// Feature flags
export function FeatureGatedComponent() {
const enableNewFeature = import.meta.env.VITE_ENABLE_NEW_FEATURE === 'true'

if (!enableNewFeature) return null

return
}

// Client configuration
export function ApiProvider({ children }: { children: React.ReactNode }) {
const apiUrl = import.meta.env.VITE_API_URL // ✅ Public
const apiKey = import.meta.env.VITE_PUBLIC_KEY // ✅ Public

// This would be undefined (security feature):
// const secret = import.meta.env.DATABASE_URL // ❌ Undefined

return (

{children}

)
}

// Feature flags
export function FeatureGatedComponent() {
const enableNewFeature = import.meta.env.VITE_ENABLE_NEW_FEATURE === 'true'

if (!enableNewFeature) return null

return
}

Environment File Setup File Hierarchy (Loaded in Order)

TanStack Start automatically loads environment files in this order:

.env.local # Local overrides (add to .gitignore)
.env.production # Production-specific variables
.env.development # Development-specific variables
.env # Default variables (commit to git)

.env.local # Local overrides (add to .gitignore)
.env.production # Production-specific variables
.env.development # Development-specific variables
.env # Default variables (commit to git)

Example Setup

**.env** (committed to repository):

# Public configuration

VITE_APP_NAME=My TanStack Start App
VITE_API_URL=https://api.example.com
VITE_SENTRY_DSN=https://...

# Server configuration templates

DATABASE_URL=postgresql://localhost:5432/myapp_dev
REDIS_URL=redis://localhost:6379

# Public configuration

VITE_APP_NAME=My TanStack Start App
VITE_API_URL=https://api.example.com
VITE_SENTRY_DSN=https://...

# Server configuration templates

DATABASE_URL=postgresql://localhost:5432/myapp_dev
REDIS_URL=redis://localhost:6379

**.env.local** (add to .gitignore):

# Override for local development

DATABASE*URL=postgresql://user:password@localhost:5432/myapp_local
STRIPE_SECRET_KEY=sk_test*...
JWT_SECRET=your-local-secret

# Override for local development

DATABASE*URL=postgresql://user:password@localhost:5432/myapp_local
STRIPE_SECRET_KEY=sk_test*...
JWT_SECRET=your-local-secret

**.env.production** :

# Production overrides

VITE_API_URL=https://api.myapp.com
DATABASE_POOL_SIZE=20

# Production overrides

VITE_API_URL=https://api.myapp.com
DATABASE_POOL_SIZE=20

Common Patterns Database Configuration

// src/lib/database.ts
import { createServerFn } from '@tanstack/react-start'

const getDatabaseConnection = createServerFn().handler(async () => {
const config = {
url: process.env.DATABASE_URL,
maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10'),
ssl: process.env.NODE_ENV === 'production',
}

return createConnection(config)
})

// src/lib/database.ts
import { createServerFn } from '@tanstack/react-start'

const getDatabaseConnection = createServerFn().handler(async () => {
const config = {
url: process.env.DATABASE_URL,
maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10'),
ssl: process.env.NODE_ENV === 'production',
}

return createConnection(config)
})

Authentication Provider Setup

// src/lib/auth.ts (Server)
export const authConfig = {
secret: process.env.AUTH_SECRET,
providers: {
auth0: {
domain: process.env.AUTH0_DOMAIN,
clientId: process.env.AUTH0_CLIENT_ID,
clientSecret: process.env.AUTH0_CLIENT_SECRET, // Server-only
}
}
}

// src/components/AuthProvider.tsx (Client)
export function AuthProvider({ children }: { children: React.ReactNode }) {
return (

{children}

)
}

// src/lib/auth.ts (Server)
export const authConfig = {
secret: process.env.AUTH_SECRET,
providers: {
auth0: {
domain: process.env.AUTH0_DOMAIN,
clientId: process.env.AUTH0_CLIENT_ID,
clientSecret: process.env.AUTH0_CLIENT_SECRET, // Server-only
}
}
}

// src/components/AuthProvider.tsx (Client)
export function AuthProvider({ children }: { children: React.ReactNode }) {
return (

{children}

)
}

External API Integration

// src/lib/external-api.ts
import { createServerFn } from '@tanstack/react-start'

// Server-side API calls (can use secret keys)
const fetchUserData = createServerFn()
.inputValidator(z.object({ userId: z.string() }))
.handler(async ({ data }) => {
const response = await fetch(
`${process.env.EXTERNAL_API_URL}/users/${data.userId}`,
{
headers: {
Authorization: `Bearer ${process.env.EXTERNAL_API_SECRET}`,
'Content-Type': 'application/json',
},
},
)

return response.json()
})

// Client-side API calls (public endpoints only)
export function usePublicData() {
const apiUrl = import.meta.env.VITE_PUBLIC_API_URL

return useQuery({
queryKey: ['public-data'],
queryFn: () => fetch(`${apiUrl}/public/stats`).then((r) => r.json()),
})
}

// src/lib/external-api.ts
import { createServerFn } from '@tanstack/react-start'

// Server-side API calls (can use secret keys)
const fetchUserData = createServerFn()
.inputValidator(z.object({ userId: z.string() }))
.handler(async ({ data }) => {
const response = await fetch(
`${process.env.EXTERNAL_API_URL}/users/${data.userId}`,
{
headers: {
Authorization: `Bearer ${process.env.EXTERNAL_API_SECRET}`,
'Content-Type': 'application/json',
},
},
)

return response.json()
})

// Client-side API calls (public endpoints only)
export function usePublicData() {
const apiUrl = import.meta.env.VITE_PUBLIC_API_URL

return useQuery({
queryKey: ['public-data'],
queryFn: () => fetch(`${apiUrl}/public/stats`).then((r) => r.json()),
})
}

Feature Flags and Configuration

// src/config/features.ts
export const featureFlags = {
enableNewDashboard: import.meta.env.VITE_ENABLE_NEW_DASHBOARD === 'true',
enableAnalytics: import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
debugMode: import.meta.env.VITE_DEBUG_MODE === 'true',
}

// Usage in components
export function Dashboard() {
if (featureFlags.enableNewDashboard) {
return
}

return
}

// src/config/features.ts
export const featureFlags = {
enableNewDashboard: import.meta.env.VITE_ENABLE_NEW_DASHBOARD === 'true',
enableAnalytics: import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
debugMode: import.meta.env.VITE_DEBUG_MODE === 'true',
}

// Usage in components
export function Dashboard() {
if (featureFlags.enableNewDashboard) {
return
}

return
}

Type Safety TypeScript Declarations

Create src/env.d.ts to add type safety:

///

interface ImportMetaEnv {
// Client-side environment variables
readonly VITE_APP_NAME: string
readonly VITE_API_URL: string
readonly VITE_AUTH0_DOMAIN: string
readonly VITE_AUTH0_CLIENT_ID: string
readonly VITE_SENTRY_DSN?: string
readonly VITE_ENABLE_NEW_DASHBOARD?: string
}

interface ImportMeta {
readonly env: ImportMetaEnv
}

// Server-side environment variables
declare global {
namespace NodeJS {
interface ProcessEnv {
readonly DATABASE_URL: string
readonly REDIS_URL: string
readonly JWT_SECRET: string
readonly AUTH0_CLIENT_SECRET: string
readonly STRIPE_SECRET_KEY: string
readonly NODE_ENV: 'development' | 'production' | 'test'
}
}
}

export {}

///

interface ImportMetaEnv {
// Client-side environment variables
readonly VITE_APP_NAME: string
readonly VITE_API_URL: string
readonly VITE_AUTH0_DOMAIN: string
readonly VITE_AUTH0_CLIENT_ID: string
readonly VITE_SENTRY_DSN?: string
readonly VITE_ENABLE_NEW_DASHBOARD?: string
}

interface ImportMeta {
readonly env: ImportMetaEnv
}

// Server-side environment variables
declare global {
namespace NodeJS {
interface ProcessEnv {
readonly DATABASE_URL: string
readonly REDIS_URL: string
readonly JWT_SECRET: string
readonly AUTH0_CLIENT_SECRET: string
readonly STRIPE_SECRET_KEY: string
readonly NODE_ENV: 'development' | 'production' | 'test'
}
}
}

export {}

Runtime Validation

Use Zod for runtime validation of environment variables:

// src/config/env.ts
import { z } from 'zod'

const envSchema = z.object({
DATABASE_URL: z.string().url(),
JWT_SECRET: z.string().min(32),
NODE_ENV: z.enum(['development', 'production', 'test']),
})

const clientEnvSchema = z.object({
VITE_APP_NAME: z.string(),
VITE_API_URL: z.string().url(),
VITE_AUTH0_DOMAIN: z.string(),
VITE_AUTH0_CLIENT_ID: z.string(),
})

// Validate server environment
export const serverEnv = envSchema.parse(process.env)

// Validate client environment
export const clientEnv = clientEnvSchema.parse(import.meta.env)

// src/config/env.ts
import { z } from 'zod'

const envSchema = z.object({
DATABASE_URL: z.string().url(),
JWT_SECRET: z.string().min(32),
NODE_ENV: z.enum(['development', 'production', 'test']),
})

const clientEnvSchema = z.object({
VITE_APP_NAME: z.string(),
VITE_API_URL: z.string().url(),
VITE_AUTH0_DOMAIN: z.string(),
VITE_AUTH0_CLIENT_ID: z.string(),
})

// Validate server environment
export const serverEnv = envSchema.parse(process.env)

// Validate client environment
export const clientEnv = clientEnvSchema.parse(import.meta.env)

Security Best Practices 1\. Never Expose Secrets to Client

// ❌ WRONG - Secret exposed to client bundle
const config = {
apiKey: import.meta.env.VITE_SECRET_API_KEY, // This will be in your JS bundle!
}

// ✅ CORRECT - Keep secrets on server
const getApiData = createServerFn().handler(async () => {
const response = await fetch(apiUrl, {
headers: { Authorization: `Bearer ${process.env.SECRET_API_KEY}` },
})
return response.json()
})

// ❌ WRONG - Secret exposed to client bundle
const config = {
apiKey: import.meta.env.VITE_SECRET_API_KEY, // This will be in your JS bundle!
}

// ✅ CORRECT - Keep secrets on server
const getApiData = createServerFn().handler(async () => {
const response = await fetch(apiUrl, {
headers: { Authorization: `Bearer ${process.env.SECRET_API_KEY}` },
})
return response.json()
})

2\. Use Appropriate Prefixes

# ✅ Server-only (no prefix)

DATABASE*URL=postgresql://...
JWT_SECRET=super-secret-key
STRIPE_SECRET_KEY=sk_live*...

# ✅ Client-safe (VITE\_ prefix)

VITE_APP_NAME=My App
VITE_API_URL=https://api.example.com
VITE_SENTRY_DSN=https://...

# ✅ Server-only (no prefix)

DATABASE*URL=postgresql://...
JWT_SECRET=super-secret-key
STRIPE_SECRET_KEY=sk_live*...

# ✅ Client-safe (VITE\_ prefix)

VITE_APP_NAME=My App
VITE_API_URL=https://api.example.com
VITE_SENTRY_DSN=https://...

3\. Validate Required Variables

// src/config/validation.ts
const requiredServerEnv = ['DATABASE_URL', 'JWT_SECRET'] as const

const requiredClientEnv = ['VITE_APP_NAME', 'VITE_API_URL'] as const

// Validate on server startup
for (const key of requiredServerEnv) {
if (!process.env[key]) {
throw new Error(`Missing required environment variable: ${key}`)
}
}

// Validate client environment at build time
for (const key of requiredClientEnv) {
if (!import.meta.env[key]) {
throw new Error(`Missing required environment variable: ${key}`)
}
}

// src/config/validation.ts
const requiredServerEnv = ['DATABASE_URL', 'JWT_SECRET'] as const

const requiredClientEnv = ['VITE_APP_NAME', 'VITE_API_URL'] as const

// Validate on server startup
for (const key of requiredServerEnv) {
if (!process.env[key]) {
throw new Error(`Missing required environment variable: ${key}`)
}
}

// Validate client environment at build time
for (const key of requiredClientEnv) {
if (!import.meta.env[key]) {
throw new Error(`Missing required environment variable: ${key}`)
}
}

Production Checklist Common Problems Environment Variable is Undefined

**Problem** : import.meta.env.MY_VARIABLE returns undefined

**Solutions** :

1.  **Add correct prefix** : Use VITE\_ prefix (e.g. VITE_MY_VARIABLE)
2.  **Restart development server** after adding new variables
3.  **Check file location** : .env file must be in project root
4.  **Verify bundler configuration** : Ensure variables are properly injected

**Example** :

# ❌ Won't work in client code

API_KEY=abc123

# ✅ Works in client code

VITE_API_KEY=abc123

# ❌ Won't bundle the variable (assuming it is not set in the environment of the build)

npm run build

# ✅ Works in client code and will bundle the variable for production

VITE_API_KEY=abc123 npm run build

# ❌ Won't work in client code

API_KEY=abc123

# ✅ Works in client code

VITE_API_KEY=abc123

# ❌ Won't bundle the variable (assuming it is not set in the environment of the build)

npm run build

# ✅ Works in client code and will bundle the variable for production

VITE_API_KEY=abc123 npm run build

Runtime Client Environment Variables in Production

**Problem** : If VITE\_ variables are replaced at bundle time only, how to make runtime variables available on the client?

**Solutions** :

Pass variables from the server down to the client:

const getRuntimeVar = createServerFn({ method: 'GET' }).handler(() => {
return process.env.MY*RUNTIME_VAR // notice `process.env` on the server, and no `VITE*` prefix
})

export const Route = createFileRoute('/')({
loader: async () => {
const foo = await getRuntimeVar()
return { foo }
},
component: RouteComponent,
})

function RouteComponent() {
const { foo } = Route.useLoaderData()
// ... use your variable however you want
}

const getRuntimeVar = createServerFn({ method: 'GET' }).handler(() => {
return process.env.MY*RUNTIME_VAR // notice `process.env` on the server, and no `VITE*` prefix
})

export const Route = createFileRoute('/')({
loader: async () => {
const foo = await getRuntimeVar()
return { foo }
},
component: RouteComponent,
})

function RouteComponent() {
const { foo } = Route.useLoaderData()
// ... use your variable however you want
}

Variable Not Updating

**Problem** : Environment variable changes aren't reflected

**Solutions** :

1.  Restart development server
2.  Check if you're modifying the correct .env file
3.  Verify file hierarchy (.env.local overrides .env)

TypeScript Errors

**Problem** : Property 'VITE_MY_VAR' does not exist on type 'ImportMetaEnv'

**Solution** : Add to src/env.d.ts:

interface ImportMetaEnv {
readonly VITE_MY_VAR: string
}

interface ImportMetaEnv {
readonly VITE_MY_VAR: string
}

Security: Secret Exposed to Client

**Problem** : Sensitive data appearing in client bundle

**Solutions** :

1.  Remove VITE\_ prefix from sensitive variables
2.  Move sensitive operations to server functions
3.  Use build tools to verify no secrets in client bundle

Build Errors in Production

**Problem** : Missing environment variables in production build

**Solutions** :

1.  Configure variables on hosting platform
2.  Validate required variables at build time
3.  Use deployment-specific .env files
