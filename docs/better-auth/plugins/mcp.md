---
title: MCP | Better Auth
url: 
description: MCP provider plugin for Better Auth
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

# MCP

Copy MarkdownOpen in

`OAuth` `MCP`

The **MCP** plugin lets your app act as an OAuth provider for MCP clients. It handles authentication and makes it easy to issue and manage access tokens for MCP applications.

## [Installation](https://www.better-auth.com/docs/plugins/mcp\#installation)

### [Add the Plugin](https://www.better-auth.com/docs/plugins/mcp\#add-the-plugin)

Add the MCP plugin to your auth configuration and specify the login page path.

auth.ts

```
import { betterAuth } from "better-auth";
import { mcp } from "better-auth/plugins";

export const auth = betterAuth({
    plugins: [\
        mcp({\
            loginPage: "/sign-in" // path to your login page\
        })\
    ]
});
```

This doesn't have a client plugin, so you don't need to make any changes to your authClient.

### [Generate Schema](https://www.better-auth.com/docs/plugins/mcp\#generate-schema)

Run the migration or generate the schema to add the necessary fields and tables to the database.

migrategenerate

```
npx @better-auth/cli migrate
```

```
npx @better-auth/cli generate
```

The MCP plugin uses the same schema as the OIDC Provider plugin. See the [OIDC Provider Schema](https://www.better-auth.com/docs/plugins/mcp#schema) section for details.

## [Usage](https://www.better-auth.com/docs/plugins/mcp\#usage)

### [OAuth Discovery Metadata](https://www.better-auth.com/docs/plugins/mcp\#oauth-discovery-metadata)

Better Auth already handles the `/api/auth/.well-known/oauth-authorization-server` route automatically but some client may fail to parse the `WWW-Authenticate` header and default to `/.well-known/oauth-authorization-server` (this can happen, for example, if your CORS configuration doesn't expose the `WWW-Authenticate`). For this reason it's better to add a route to expose OAuth metadata for MCP clients:

.well-known/oauth-authorization-server/route.ts

```
import { oAuthDiscoveryMetadata } from "better-auth/plugins";
import { auth } from "../../../lib/auth";

export const GET = oAuthDiscoveryMetadata(auth);
```

### [OAuth Protected Resource Metadata](https://www.better-auth.com/docs/plugins/mcp\#oauth-protected-resource-metadata)

Better Auth already handles the `/api/auth/.well-known/oauth-protected-resource` route automatically but some client may fail to parse the `WWW-Authenticate` header and default to `/.well-known/oauth-protected-resource` (this can happen, for example, if your CORS configuration doesn't expose the `WWW-Authenticate`). For this reason it's better to add a route to expose OAuth metadata for MCP clients:

/.well-known/oauth-protected-resource/route.ts

```
import { oAuthProtectedResourceMetadata } from "better-auth/plugins";
import { auth } from "@/lib/auth";

export const GET = oAuthProtectedResourceMetadata(auth);
```

### [MCP Session Handling](https://www.better-auth.com/docs/plugins/mcp\#mcp-session-handling)

You can use the helper function `withMcpAuth` to get the session and handle unauthenticated calls automatically.

api/\[transport\]/route.ts

```
import { auth } from "@/lib/auth";
import { createMcpHandler } from "@vercel/mcp-adapter";
import { withMcpAuth } from "better-auth/plugins";
import { z } from "zod";

const handler = withMcpAuth(auth, (req, session) => {
    // session contains the access token record with scopes and user ID
    return createMcpHandler(
        (server) => {
            server.tool(
                "echo",
                "Echo a message",
                { message: z.string() },
                async ({ message }) => {
                    return {
                        content: [{ type: "text", text: `Tool echo: ${message}` }],
                    };
                },
            );
        },
        {
            capabilities: {
                tools: {
                    echo: {
                        description: "Echo a message",
                    },
                },
            },
        },
        {
            redisUrl: process.env.REDIS_URL,
            basePath: "/api",
            verboseLogs: true,
            maxDuration: 60,
        },
    )(req);
});

export { handler as GET, handler as POST, handler as DELETE };
```

You can also use `auth.api.getMcpSession` to get the session using the access token sent from the MCP client:

api/\[transport\]/route.ts

```
import { auth } from "@/lib/auth";
import { createMcpHandler } from "@vercel/mcp-adapter";
import { z } from "zod";

const handler = async (req: Request) => {
     // session contains the access token record with scopes and user ID
    const session = await auth.api.getMcpSession({
        headers: req.headers
    })
    if(!session){
        //this is important and you must return 401
        return new Response(null, {
            status: 401
        })
    }
    return createMcpHandler(
        (server) => {
            server.tool(
                "echo",
                "Echo a message",
                { message: z.string() },
                async ({ message }) => {
                    return {
                        content: [{ type: "text", text: `Tool echo: ${message}` }],
                    };
                },
            );
        },
        {
            capabilities: {
                tools: {
                    echo: {
                        description: "Echo a message",
                    },
                },
            },
        },
        {
            redisUrl: process.env.REDIS_URL,
            basePath: "/api",
            verboseLogs: true,
            maxDuration: 60,
        },
    )(req);
}

export { handler as GET, handler as POST, handler as DELETE };
```

## [Configuration](https://www.better-auth.com/docs/plugins/mcp\#configuration)

The MCP plugin accepts the following configuration options:

| Prop | Type | Default |
| --- | --- | --- |
| `loginPage` | `string` | - |
| `resource?` | `string` | - |
| `oidcConfig?` | `object` | - |

### [OIDC Configuration](https://www.better-auth.com/docs/plugins/mcp\#oidc-configuration)

The plugin supports additional OIDC configuration options through the `oidcConfig` parameter:

| Prop | Type | Default |
| --- | --- | --- |
| `codeExpiresIn?` | `number` | `600` |
| `accessTokenExpiresIn?` | `number` | `3600` |
| `refreshTokenExpiresIn?` | `number` | `604800` |
| `defaultScope?` | `string` | `openid` |
| `scopes?` | `string[]` | `["openid", "profile", "email", "offline_access"]` |

## [Schema](https://www.better-auth.com/docs/plugins/mcp\#schema)

The MCP plugin uses the same schema as the OIDC Provider plugin. See the [OIDC Provider Schema](https://www.better-auth.com/docs/plugins/mcp#schema) section for details.

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/plugins/mcp.mdx)

[Previous Page\\
\\
API Key](https://www.better-auth.com/docs/plugins/api-key) [Next Page\\
\\
Organization](https://www.better-auth.com/docs/plugins/organization)

### On this page

[Installation](https://www.better-auth.com/docs/plugins/mcp#installation) [Add the Plugin](https://www.better-auth.com/docs/plugins/mcp#add-the-plugin) [Generate Schema](https://www.better-auth.com/docs/plugins/mcp#generate-schema) [Usage](https://www.better-auth.com/docs/plugins/mcp#usage) [OAuth Discovery Metadata](https://www.better-auth.com/docs/plugins/mcp#oauth-discovery-metadata) [OAuth Protected Resource Metadata](https://www.better-auth.com/docs/plugins/mcp#oauth-protected-resource-metadata) [MCP Session Handling](https://www.better-auth.com/docs/plugins/mcp#mcp-session-handling) [Configuration](https://www.better-auth.com/docs/plugins/mcp#configuration) [OIDC Configuration](https://www.better-auth.com/docs/plugins/mcp#oidc-configuration) [Schema](https://www.better-auth.com/docs/plugins/mcp#schema)