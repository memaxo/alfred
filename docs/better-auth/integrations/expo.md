---
title: Expo Integration | Better Auth
url: 
description: Integrate Better Auth with Expo.
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

# Expo Integration

Copy MarkdownOpen in

Expo is a popular framework for building cross-platform apps with React Native. Better Auth supports both Expo native and web apps.

## [Installation](https://www.better-auth.com/docs/integrations/expo\#installation)

## [Configure A Better Auth Backend](https://www.better-auth.com/docs/integrations/expo\#configure-a-better-auth-backend)

Before using Better Auth with Expo, make sure you have a Better Auth backend set up. You can either use a separate server or leverage Expo's new [API Routes](https://docs.expo.dev/router/reference/api-routes) feature to host your Better Auth instance.

To get started, check out our [installation](https://www.better-auth.com/docs/installation) guide for setting up Better Auth on your server. If you prefer to check out the full example, you can find it [here](https://github.com/better-auth/examples/tree/main/expo-example).

To use the new API routes feature in Expo to host your Better Auth instance you can create a new API route in your Expo app and mount the Better Auth handler.

app/api/auth/\[...auth\]+api.ts

```
import { auth } from "@/lib/auth"; // import Better Auth handler

const handler = auth.handler;
export { handler as GET, handler as POST }; // export handler for both GET and POST requests
```

## [Install Server Dependencies](https://www.better-auth.com/docs/integrations/expo\#install-server-dependencies)

Install both the Better Auth package and Expo plugin into your server application.

npm

pnpm

yarn

bun

```
npm install better-auth @better-auth/expo
```

## [Install Client Dependencies](https://www.better-auth.com/docs/integrations/expo\#install-client-dependencies)

You also need to install both the Better Auth package and Expo plugin into your Expo application.

npm

pnpm

yarn

bun

```
npm install better-auth @better-auth/expo
```

If you plan on using our social integrations (Google, Apple etc.) then there are a few more dependencies that are required in your Expo app. In the default Expo template these are already installed so you may be able to skip this step if you have these dependencies already.

npm

pnpm

yarn

bun

```
npm install expo-linking expo-web-browser expo-constants
```

## [Add the Expo Plugin on Your Server](https://www.better-auth.com/docs/integrations/expo\#add-the-expo-plugin-on-your-server)

Add the Expo plugin to your Better Auth server.

lib/auth.ts

```
import { betterAuth } from "better-auth";
import { expo } from "@better-auth/expo";

export const auth = betterAuth({
    plugins: [expo()],
    emailAndPassword: {
        enabled: true, // Enable authentication using email and password.
      },
});
```

## [Initialize Better Auth Client](https://www.better-auth.com/docs/integrations/expo\#initialize-better-auth-client)

To initialize Better Auth in your Expo app, you need to call `createAuthClient` with the base URL of your Better Auth backend. Make sure to import the client from `/react`.

Make sure you install the `expo-secure-store` package into your Expo app. This is used to store the session data and cookies securely.

npm

pnpm

yarn

bun

```
npm install expo-secure-store
```

You need to also import client plugin from `@better-auth/expo/client` and pass it to the `plugins` array when initializing the auth client.

This is important because:

- **Social Authentication Support:** enables social auth flows by handling authorization URLs and callbacks within the Expo web browser.
- **Secure Cookie Management:** stores cookies securely and automatically adds them to the headers of your auth requests.

lib/auth-client.ts

```
import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";

export const authClient = createAuthClient({
    baseURL: "http://localhost:8081", // Base URL of your Better Auth backend.
    plugins: [\
        expoClient({\
            scheme: "myapp",\
            storagePrefix: "myapp",\
            storage: SecureStore,\
        })\
    ]
});
```

Be sure to include the full URL, including the path, if you've changed the default path from `/api/auth`.

## [Scheme and Trusted Origins](https://www.better-auth.com/docs/integrations/expo\#scheme-and-trusted-origins)

Better Auth uses deep links to redirect users back to your app after authentication. To enable this, you need to add your app's scheme to the `trustedOrigins` list in your Better Auth config.

First, make sure you have a scheme defined in your `app.json` file.

app.json

```
{
    "expo": {
        "scheme": "myapp"
    }
}
```

Then, update your Better Auth config to include the scheme in the `trustedOrigins` list.

auth.ts

```
export const auth = betterAuth({
    trustedOrigins: ["myapp://"]
})
```

If you have multiple schemes or need to support deep linking with various paths, you can use specific patterns or wildcards:

auth.ts

```
export const auth = betterAuth({
    trustedOrigins: [\
        // Basic scheme\
        "myapp://",\
\
        // Production & staging schemes\
        "myapp-prod://",\
        "myapp-staging://",\
\
        // Wildcard support for all paths following the scheme\
        "myapp://*"\
    ]
})
```

The wildcard pattern can be particularly useful if your app uses different URL formats for deep linking based on features or screens.

## [Configure Metro Bundler](https://www.better-auth.com/docs/integrations/expo\#configure-metro-bundler)

To resolve Better Auth exports you'll need to enable `unstable_enablePackageExports` in your metro config.

metro.config.js

```
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname)

config.resolver.unstable_enablePackageExports = true;

module.exports = config;
```

In case you don't have a `metro.config.js` file in your project run `npx expo customize metro.config.js`.

If you can't enable `unstable_enablePackageExports` option, you can use [babel-plugin-module-resolver](https://github.com/tleunen/babel-plugin-module-resolver) to manually resolve the paths.

babel.config.js

```
module.exports = function (api) {
    api.cache(true);
    return {
        presets: ["babel-preset-expo"],
        plugins: [\
            [\
                "module-resolver",\
                {\
                    alias: {\
                        "better-auth/react": "./node_modules/better-auth/dist/client/react/index.cjs",\
                        "better-auth/client/plugins": "./node_modules/better-auth/dist/client/plugins/index.cjs",\
                        "@better-auth/expo/client": "./node_modules/@better-auth/expo/dist/client.cjs",\
                    },\
                },\
            ],\
        ],
    }
}
```

In case you don't have a `babel.config.js` file in your project run `npx expo customize babel.config.js`.

Don't forget to clear the cache after making changes.

```
npx expo start --clear
```

## [Usage](https://www.better-auth.com/docs/integrations/expo\#usage)

### [Authenticating Users](https://www.better-auth.com/docs/integrations/expo\#authenticating-users)

With Better Auth initialized, you can now use the `authClient` to authenticate users in your Expo app.

sign-insign-up

app/sign-in.tsx

```
import { useState } from "react";
import { View, TextInput, Button } from "react-native";
import { authClient } from "@/lib/auth-client";

export default function SignIn() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const handleLogin = async () => {
        await authClient.signIn.email({
            email,
            password,
        })
    };

    return (
        <View>
            <TextInput
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
            />
            <TextInput
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
            />
            <Button title="Login" onPress={handleLogin} />
        </View>
    );
}
```

app/sign-up.tsx

```
import { useState } from "react";
import { View, TextInput, Button } from "react-native";
import { authClient } from "@/lib/auth-client";

export default function SignUp() {
    const [email, setEmail] = useState("");
    const [name, setName] = useState("");
    const [password, setPassword] = useState("");

    const handleLogin = async () => {
        await authClient.signUp.email({
                email,
                password,
                name
        })
    };

    return (
        <View>
            <TextInput
                placeholder="Name"
                value={name}
                onChangeText={setName}
            />
            <TextInput
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
            />
            <TextInput
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
            />
            <Button title="Login" onPress={handleLogin} />
        </View>
    );
}
```

#### [Social Sign-In](https://www.better-auth.com/docs/integrations/expo\#social-sign-in)

For social sign-in, you can use the `authClient.signIn.social` method with the provider name and a callback URL.

app/social-sign-in.tsx

```
import { Button } from "react-native";

export default function SocialSignIn() {
    const handleLogin = async () => {
        await authClient.signIn.social({
            provider: "google",
            callbackURL: "/dashboard" // this will be converted to a deep link (eg. `myapp://dashboard`) on native
        })
    };
    return <Button title="Login with Google" onPress={handleLogin} />;
}
```

#### [IdToken Sign-In](https://www.better-auth.com/docs/integrations/expo\#idtoken-sign-in)

If you want to make provider request on the mobile device and then verify the ID token on the server, you can use the `authClient.signIn.social` method with the `idToken` option.

app/social-sign-in.tsx

```
import { Button } from "react-native";

export default function SocialSignIn() {
    const handleLogin = async () => {
        await authClient.signIn.social({
            provider: "google", // only google, apple and facebook are supported for idToken signIn
            idToken: {
                token: "...", // ID token from provider
                nonce: "...", // nonce from provider (optional)
            }
            callbackURL: "/dashboard" // this will be converted to a deep link (eg. `myapp://dashboard`) on native
        })
    };
    return <Button title="Login with Google" onPress={handleLogin} />;
}
```

### [Session](https://www.better-auth.com/docs/integrations/expo\#session)

Better Auth provides a `useSession` hook to access the current user's session in your app.

app/index.tsx

```
import { Text } from "react-native";
import { authClient } from "@/lib/auth-client";

export default function Index() {
    const { data: session } = authClient.useSession();

    return <Text>Welcome, {session?.user.name}</Text>;
}
```

On native, the session data will be cached in SecureStore. This will allow you to remove the need for a loading spinner when the app is reloaded. You can disable this behavior by passing the `disableCache` option to the client.

### [Making Authenticated Requests to Your Server](https://www.better-auth.com/docs/integrations/expo\#making-authenticated-requests-to-your-server)

To make authenticated requests to your server that require the user's session, you have to retrieve the session cookie from `SecureStore` and manually add it to your request headers.

```
import { authClient } from "@/lib/auth-client";

const makeAuthenticatedRequest = async () => {
  const cookies = authClient.getCookie();
  const headers = {
    "Cookie": cookies,
  };
  const response = await fetch("http://localhost:8081/api/secure-endpoint", {
    headers,
    // 'include' can interfere with the cookies we just set manually in the headers
    credentials: "omit"
  });
  const data = await response.json();
  return data;
};
```

**Example: Usage With TRPC**

lib/trpc-provider.tsx

```
//...other imports
import { authClient } from "@/lib/auth-client";

export const api = createTRPCReact<AppRouter>();

export function TRPCProvider(props: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    api.createClient({
      links: [\
        httpBatchLink({\
          //...your other options\
          headers() {\
            const headers = new Map<string, string>();\
            const cookies = authClient.getCookie();\
            if (cookies) {\
              headers.set("Cookie", cookies);\
            }\
            return Object.fromEntries(headers);\
          },\
        }),\
      ],
    }),
  );

  return (
    <api.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {props.children}
      </QueryClientProvider>
    </api.Provider>
  );
}
```

## [Options](https://www.better-auth.com/docs/integrations/expo\#options)

### [Expo Client](https://www.better-auth.com/docs/integrations/expo\#expo-client)

**storage**: the storage mechanism used to cache the session data and cookies.

lib/auth-client.ts

```
import { createAuthClient } from "better-auth/react";
import SecureStorage from "expo-secure-store";

const authClient = createAuthClient({
    baseURL: "http://localhost:8081",
    storage: SecureStorage
});
```

**scheme**: scheme is used to deep link back to your app after a user has authenticated using oAuth providers. By default, Better Auth tries to read the scheme from the `app.json` file. If you need to override this, you can pass the scheme option to the client.

lib/auth-client.ts

```
import { createAuthClient } from "better-auth/react";

const authClient = createAuthClient({
    baseURL: "http://localhost:8081",
    scheme: "myapp"
});
```

**disableCache**: By default, the client will cache the session data in SecureStore. You can disable this behavior by passing the `disableCache` option to the client.

lib/auth-client.ts

```
import { createAuthClient } from "better-auth/react";

const authClient = createAuthClient({
    baseURL: "http://localhost:8081",
    disableCache: true
});
```

### [Expo Servers](https://www.better-auth.com/docs/integrations/expo\#expo-servers)

Server plugin options:

**overrideOrigin**: Override the origin for Expo API routes (default: false). Enable this if you're facing cors origin issues with Expo API routes.

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/integrations/expo.mdx)

[Previous Page\\
\\
Mobile & Desktop](https://www.better-auth.com/docs/integrations/expo) [Next Page\\
\\
Lynx](https://www.better-auth.com/docs/integrations/lynx)

### On this page

[Installation](https://www.better-auth.com/docs/integrations/expo#installation) [Configure A Better Auth Backend](https://www.better-auth.com/docs/integrations/expo#configure-a-better-auth-backend) [Install Server Dependencies](https://www.better-auth.com/docs/integrations/expo#install-server-dependencies) [Install Client Dependencies](https://www.better-auth.com/docs/integrations/expo#install-client-dependencies) [Add the Expo Plugin on Your Server](https://www.better-auth.com/docs/integrations/expo#add-the-expo-plugin-on-your-server) [Initialize Better Auth Client](https://www.better-auth.com/docs/integrations/expo#initialize-better-auth-client) [Scheme and Trusted Origins](https://www.better-auth.com/docs/integrations/expo#scheme-and-trusted-origins) [Configure Metro Bundler](https://www.better-auth.com/docs/integrations/expo#configure-metro-bundler) [Usage](https://www.better-auth.com/docs/integrations/expo#usage) [Authenticating Users](https://www.better-auth.com/docs/integrations/expo#authenticating-users) [Social Sign-In](https://www.better-auth.com/docs/integrations/expo#social-sign-in) [IdToken Sign-In](https://www.better-auth.com/docs/integrations/expo#idtoken-sign-in) [Session](https://www.better-auth.com/docs/integrations/expo#session) [Making Authenticated Requests to Your Server](https://www.better-auth.com/docs/integrations/expo#making-authenticated-requests-to-your-server) [Options](https://www.better-auth.com/docs/integrations/expo#options) [Expo Client](https://www.better-auth.com/docs/integrations/expo#expo-client) [Expo Servers](https://www.better-auth.com/docs/integrations/expo#expo-servers)