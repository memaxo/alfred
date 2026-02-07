---
title: Browser Extension Guide | Better Auth
url:
description: A step-by-step guide to creating a browser extension with Better Auth.
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

# Browser Extension Guide

Copy MarkdownOpen in

In this guide, we'll walk you through the steps of creating a browser extension using [Plasmo](https://docs.plasmo.com/) with Better Auth for authentication.

If you would like to view a completed example, you can check out the [browser extension example](https://github.com/better-auth/better-auth/tree/main/examples/browser-extension-example).

The Plasmo framework does not provide a backend for the browser extension.
This guide assumes you have [a backend setup](https://www.better-auth.com/docs/integrations/hono) of Better Auth and
are ready to create a browser extension to connect to it.

## [Setup & Installations](https://www.better-auth.com/docs/guides/browser-extension-guide#setup--installations)

Initialize a new Plasmo project with TailwindCSS and a src directory.

```
bun create plasmo --with-tailwindcss --with-src
```

Then, install the Better Auth package.

```
bun add better-auth
```

To start the Plasmo development server, run the following command.

```
bun dev
```

## [Configure tsconfig](https://www.better-auth.com/docs/guides/browser-extension-guide#configure-tsconfig)

Configure the `tsconfig.json` file to include `strict` mode.

For this demo, we have also changed the import alias from `~` to `@` and set it to the `src` directory.

tsconfig.json

```
{
    "compilerOptions": {
        "paths": {
            "@/_": [\
                "./src/_"\
            ]
        },
        "strict": true,
        "baseUrl": "."
    }
}
```

## [Create the client auth instance](https://www.better-auth.com/docs/guides/browser-extension-guide#create-the-client-auth-instance)

Create a new file at `src/auth/auth-client.ts` and add the following code.

src

auth

auth-client.ts

auth-client.ts

```
import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
    baseURL: "http://localhost:3000" /* Base URL of your Better Auth backend. */,
    plugins: [],
});
```

## [Configure the manifest](https://www.better-auth.com/docs/guides/browser-extension-guide#configure-the-manifest)

We must ensure the extension knows the URL to the Better Auth backend.

Head to your package.json file, and add the following code.

package.json

```
{
    //...
    "manifest": {
        "host_permissions": [\
            "https://URL_TO_YOUR_BACKEND" // localhost works too (e.g. http://localhost:3000)\
        ]
    }
}
```

## [You're now ready!](https://www.better-auth.com/docs/guides/browser-extension-guide#youre-now-ready)

You have now set up Better Auth for your browser extension.

Add your desired UI and create your dream extension!

To learn more about the client Better Auth API, check out the [client documentation](https://www.better-auth.com/docs/concepts/client).

Here's a quick example 😎

src/popup.tsx

```
import { authClient } from "./auth/auth-client"

function IndexPopup() {
    const {data, isPending, error} = authClient.useSession();
    if(isPending){
        return <>Loading...</>
    }
    if(error){
        return <>Error: {error.message}</>
    }
    if(data){
        return <>Signed in as {data.user.name}</>
    }
}

export default IndexPopup;
```

## [Bundle your extension](https://www.better-auth.com/docs/guides/browser-extension-guide#bundle-your-extension)

To get a production build, run the following command.

```
bun build
```

Head over to [chrome://extensions](chrome://extensions/) and enable developer mode.

![](https://docs.plasmo.com/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fdeveloper_mode.76f090f7.png&w=1920&q=75)

Click on "Load Unpacked" and navigate to your extension's `build/chrome-mv3-dev` (or `build/chrome-mv3-prod`) directory.

To see your popup, click on the puzzle piece icon on the Chrome toolbar, and click on your extension.

Learn more about [bundling your extension here.](https://docs.plasmo.com/framework#loading-the-extension-in-chrome)

## [Configure the server auth instance](https://www.better-auth.com/docs/guides/browser-extension-guide#configure-the-server-auth-instance)

First, we will need your extension URL.

An extension URL formed like this: `chrome-extension://YOUR_EXTENSION_ID`.

You can find your extension ID at [chrome://extensions](chrome://extensions/).

![](https://www.better-auth.com/extension-id.png)

Head to your server's auth file, and make sure that your extension's URL is added to the `trustedOrigins` list.

server.ts

```
import { betterAuth } from "better-auth"
import { auth } from "@/auth/auth"

export const auth = betterAuth({
    trustedOrigins: ["chrome-extension://YOUR_EXTENSION_ID"],
})
```

If you're developing multiple extensions or need to support different browser extensions with different IDs, you can use wildcard patterns:

server.ts

```
export const auth = betterAuth({
    trustedOrigins: [\
        // Support a specific extension ID\
        "chrome-extension://YOUR_EXTENSION_ID",\
\
        // Or support multiple extensions with wildcard (less secure)\
        "chrome-extension://*"\
    ],
})
```

Using wildcards for extension origins ( `chrome-extension://*`) reduces security by trusting all extensions.
It's safer to explicitly list each extension ID you trust. Only use wildcards for development and testing.

## [That's it!](https://www.better-auth.com/docs/guides/browser-extension-guide#thats-it)

Everything is set up! You can now start developing your extension. 🎉

## [Wrapping Up](https://www.better-auth.com/docs/guides/browser-extension-guide#wrapping-up)

Congratulations! You've successfully created a browser extension using Better Auth and Plasmo.
We highly recommend you visit the [Plasmo documentation](https://docs.plasmo.com/) to learn more about the framework.

If you would like to view a completed example, you can check out the [browser extension example](https://github.com/better-auth/better-auth/tree/main/examples/browser-extension-example).

If you have any questions, feel free to open an issue on our [GitHub repo](https://github.com/better-auth/better-auth/issues), or join our [Discord server](https://discord.gg/better-auth) for support.

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/guides/browser-extension-guide.mdx)

[Previous Page\\
\\
Create a Database Adapter](https://www.better-auth.com/docs/guides/create-a-db-adapter) [Next Page\\
\\
Optimize for Performance](https://www.better-auth.com/docs/guides/optimizing-for-performance)

### On this page

[Setup & Installations](https://www.better-auth.com/docs/guides/browser-extension-guide#setup--installations) [Configure tsconfig](https://www.better-auth.com/docs/guides/browser-extension-guide#configure-tsconfig) [Create the client auth instance](https://www.better-auth.com/docs/guides/browser-extension-guide#create-the-client-auth-instance) [Configure the manifest](https://www.better-auth.com/docs/guides/browser-extension-guide#configure-the-manifest) [You're now ready!](https://www.better-auth.com/docs/guides/browser-extension-guide#youre-now-ready) [Bundle your extension](https://www.better-auth.com/docs/guides/browser-extension-guide#bundle-your-extension) [Configure the server auth instance](https://www.better-auth.com/docs/guides/browser-extension-guide#configure-the-server-auth-instance) [That's it!](https://www.better-auth.com/docs/guides/browser-extension-guide#thats-it) [Wrapping Up](https://www.better-auth.com/docs/guides/browser-extension-guide#wrapping-up)
