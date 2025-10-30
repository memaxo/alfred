---
title: MastraAuthFirebase Class
url: 
description: Documentation for the MastraAuthFirebase class, which authenticates Mastra applications using Firebase Authentication.
language: en
---
[Skip to Content](https://mastra.ai/en/docs/auth/firebase#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") [Authexp.](https://mastra.ai/en/docs/auth "Auth") Firebase

Copy page

# MastraAuthFirebase Class

The `MastraAuthFirebase` class provides authentication for Mastra using Firebase Authentication. It verifies incoming requests using Firebase ID tokens and integrates with the Mastra server using the `experimental_auth` option.

## Prerequisites [Permalink for this section](https://mastra.ai/en/docs/auth/firebase\#prerequisites)

This example uses Firebase Authentication. Make sure to:

1. Create a Firebase project in the [Firebase Console](https://console.firebase.google.com/)
2. Enable Authentication and configure your preferred sign-in methods (Google, Email/Password, etc.)
3. Generate a service account key from Project Settings > Service Accounts
4. Download the service account JSON file

.env

```nextra-code

FIREBASE_SERVICE_ACCOUNT=/path/to/your/service-account-key.json
FIRESTORE_DATABASE_ID=(default)
# Alternative environment variable names:
# FIREBASE_DATABASE_ID=(default)
```

> **Note:** Store your service account JSON file securely and never commit it to version control.

## Installation [Permalink for this section](https://mastra.ai/en/docs/auth/firebase\#installation)

Before you can use the `MastraAuthFirebase` class you have to install the `@mastra/auth-firebase` package.

```nextra-code

npm install @mastra/auth-firebase@latest
```

## Usage examples [Permalink for this section](https://mastra.ai/en/docs/auth/firebase\#usage-examples)

### Basic usage with environment variables [Permalink for this section](https://mastra.ai/en/docs/auth/firebase\#basic-usage-with-environment-variables)

If you set the required environment variables ( `FIREBASE_SERVICE_ACCOUNT` and `FIRESTORE_DATABASE_ID`), you can initialize `MastraAuthFirebase` without any constructor arguments. The class will automatically read these environment variables as configuration:

src/mastra/index.ts

```nextra-code [counter-reset:line]

import { Mastra } from "@mastra/core/mastra";
import { MastraAuthFirebase } from '@mastra/auth-firebase';

// Automatically uses FIREBASE_SERVICE_ACCOUNT and FIRESTORE_DATABASE_ID env vars
export const mastra = new Mastra({
  // ..
  server: {
    experimental_auth: new MastraAuthFirebase(),
  },
});
```

### Custom configuration [Permalink for this section](https://mastra.ai/en/docs/auth/firebase\#custom-configuration)

src/mastra/index.ts

```nextra-code [counter-reset:line]

import { Mastra } from "@mastra/core/mastra";
import { MastraAuthFirebase } from '@mastra/auth-firebase';

export const mastra = new Mastra({
  // ..
  server: {
    experimental_auth: new MastraAuthFirebase({
      serviceAccount: '/path/to/service-account.json',
      databaseId: 'your-database-id'
    }),
  },
});
```

## Configuration [Permalink for this section](https://mastra.ai/en/docs/auth/firebase\#configuration)

The `MastraAuthFirebase` class can be configured through constructor options or environment variables.

### Environment Variables [Permalink for this section](https://mastra.ai/en/docs/auth/firebase\#environment-variables)

- `FIREBASE_SERVICE_ACCOUNT`: Path to Firebase service account JSON file
- `FIRESTORE_DATABASE_ID` or `FIREBASE_DATABASE_ID`: Firestore database ID

> **Note:** When constructor options are not provided, the class automatically reads these environment variables. This means you can simply call `new MastraAuthFirebase()` without any arguments if your environment variables are properly configured.

### User Authorization [Permalink for this section](https://mastra.ai/en/docs/auth/firebase\#user-authorization)

By default, `MastraAuthFirebase` uses Firestore to manage user access. It expects a collection named `user_access` with documents keyed by user UIDs. The presence of a document in this collection determines whether a user is authorized.

firestore-structure.txt

```nextra-code

user_access/
  {user_uid_1}/     // Document exists = user authorized
  {user_uid_2}/     // Document exists = user authorized
```

To customize user authorization, provide a custom `authorizeUser` function:

src/mastra/auth.ts

```nextra-code [counter-reset:line]

import { MastraAuthFirebase } from '@mastra/auth-firebase';

const firebaseAuth = new MastraAuthFirebase({
  authorizeUser: async (user) => {
    // Custom authorization logic
    return user.email?.endsWith('@yourcompany.com') || false;
  }
});
```

> See the [MastraAuthFirebase](https://mastra.ai/reference/auth/firebase) API reference for all available configuration options.

## Client-side setup [Permalink for this section](https://mastra.ai/en/docs/auth/firebase\#client-side-setup)

When using Firebase auth, you’ll need to initialize Firebase on the client side, authenticate users, and retrieve their ID tokens to pass to your Mastra requests.

### Setting up Firebase on the client [Permalink for this section](https://mastra.ai/en/docs/auth/firebase\#setting-up-firebase-on-the-client)

First, initialize Firebase in your client application:

lib/firebase.ts

```nextra-code [counter-reset:line]

import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
```

### Authenticating users and retrieving tokens [Permalink for this section](https://mastra.ai/en/docs/auth/firebase\#authenticating-users-and-retrieving-tokens)

Use Firebase authentication to sign in users and retrieve their ID tokens:

lib/auth.ts

```nextra-code [counter-reset:line]

import { signInWithPopup, signOut, User } from 'firebase/auth';
import { auth, googleProvider } from './firebase';

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('Error signing in:', error);
    throw error;
  }
};

export const getIdToken = async (user: User) => {
  try {
    const idToken = await user.getIdToken();
    return idToken;
  } catch (error) {
    console.error('Error getting ID token:', error);
    throw error;
  }
};

export const signOutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};
```

> Refer to the [Firebase documentation](https://firebase.google.com/docs/auth) for other authentication methods like email/password, phone authentication, and more.

## Configuring `MastraClient` [Permalink for this section](https://mastra.ai/en/docs/auth/firebase\#configuring-mastraclient)

When `experimental_auth` is enabled, all requests made with `MastraClient` must include a valid Firebase ID token in the `Authorization` header:

lib/mastra/mastra-client.ts

```nextra-code [counter-reset:line]

import { MastraClient } from "@mastra/client-js";

export const createMastraClient = (idToken: string) => {
  return new MastraClient({
    baseUrl: "https://<mastra-api-url>",
    headers: {
      Authorization: `Bearer ${idToken}`
    }
  });
};
```

> **Note:** The ID token must be prefixed with `Bearer` in the Authorization header.

> See [Mastra Client SDK](https://mastra.ai/docs/server-db/mastra-client) for more configuration options.

### Making authenticated requests [Permalink for this section](https://mastra.ai/en/docs/auth/firebase\#making-authenticated-requests)

Once `MastraClient` is configured with the Firebase ID token, you can send authenticated requests:

React ComponentNode.js Servercurl

src/components/test-agent.tsx

```nextra-code [counter-reset:line]

"use client";

import { useAuthState } from 'react-firebase-hooks/auth';
import { MastraClient } from "@mastra/client-js";
import { auth } from '../lib/firebase';
import { getIdToken } from '../lib/auth';

export const TestAgent = () => {
  const [user] = useAuthState(auth);

  async function handleClick() {
    if (!user) return;

    const token = await getIdToken(user);
    const client = createMastraClient(token);

    const weatherAgent = client.getAgent("weatherAgent");
    const response = await weatherAgent.generate({
      messages: "What's the weather like in New York",
    });

    console.log({ response });
  }

  return (
    <button onClick={handleClick} disabled={!user}>
      Test Agent
    </button>
  );
};
```

server.js

```nextra-code [counter-reset:line]

const express = require('express');
const admin = require('firebase-admin');
const { MastraClient } = require('@mastra/client-js');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert({
    // Your service account credentials
  })
});

const app = express();
app.use(express.json());

app.post('/generate', async (req, res) => {
  try {
    const { idToken } = req.body;

    // Verify the token
    await admin.auth().verifyIdToken(idToken);

    const mastra = new MastraClient({
      baseUrl: "http://localhost:4111",
      headers: {
        Authorization: `Bearer ${idToken}`
      }
    });

    const weatherAgent = mastra.getAgent("weatherAgent");
    const response = await weatherAgent.generate({
      messages: "What's the weather like in Nairobi"
    });

    res.json({ response: response.text });
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized' });
  }
});
```

```nextra-code

curl -X POST http://localhost:4111/api/agents/weatherAgent/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-firebase-id-token>" \
  -d '{
    "messages": "Weather in London"
  }'
```

[Supabase](https://mastra.ai/en/docs/auth/supabase "Supabase") [WorkOS](https://mastra.ai/en/docs/auth/workos "WorkOS")