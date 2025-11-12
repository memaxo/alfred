---
title: Passkey | Better Auth
url: 
description: Passkey
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

# Passkey

Copy MarkdownOpen in

Passkeys are a secure, passwordless authentication method using cryptographic key pairs, supported by WebAuthn and FIDO2 standards in web browsers. They replace passwords with unique key pairs: a private key stored on the user's device and a public key shared with the website. Users can log in using biometrics, PINs, or security keys, providing strong, phishing-resistant authentication without traditional passwords.

The passkey plugin implementation is powered by [SimpleWebAuthn](https://simplewebauthn.dev/) behind the scenes.

## [Installation](https://www.better-auth.com/docs/plugins/passkey\#installation)

### [Add the plugin to your auth config](https://www.better-auth.com/docs/plugins/passkey\#add-the-plugin-to-your-auth-config)

To add the passkey plugin to your auth config, you need to import the plugin and pass it to the `plugins` option of the auth instance.

**Options**

`rpID`: A unique identifier for your website. 'localhost' is okay for local dev

`rpName`: Human-readable title for your website

`origin`: The URL at which registrations and authentications should occur. `http://localhost` and `http://localhost:PORT` are also valid. Do **NOT** include any trailing /

`authenticatorSelection`: Allows customization of WebAuthn authenticator selection criteria. Leave unspecified for default settings.

- `authenticatorAttachment`: Specifies the type of authenticator
  - `platform`: Authenticator is attached to the platform (e.g., fingerprint reader)
  - `cross-platform`: Authenticator is not attached to the platform (e.g., security key)
  - Default: `not set` (both platform and cross-platform allowed, with platform preferred)
- `residentKey`: Determines credential storage behavior.
  - `required`: User MUST store credentials on the authenticator (highest security)
  - `preferred`: Encourages credential storage but not mandatory
  - `discouraged`: No credential storage required (fastest experience)
  - Default: `preferred`
- `userVerification`: Controls biometric/PIN verification during authentication:
  - `required`: User MUST verify identity (highest security)
  - `preferred`: Verification encouraged but not mandatory
  - `discouraged`: No verification required (fastest experience)
  - Default: `preferred`

auth.ts

```
import { betterAuth } from "better-auth"
import { passkey } from "better-auth/plugins/passkey"

export const auth = betterAuth({
    plugins: [\
        passkey(),\
    ],
})
```

### [Migrate the database](https://www.better-auth.com/docs/plugins/passkey\#migrate-the-database)

Run the migration or generate the schema to add the necessary fields and tables to the database.

migrategenerate

```
npx @better-auth/cli migrate
```

```
npx @better-auth/cli generate
```

See the [Schema](https://www.better-auth.com/docs/plugins/passkey#schema) section to add the fields manually.

### [Add the client plugin](https://www.better-auth.com/docs/plugins/passkey\#add-the-client-plugin)

auth-client.ts

```
import { createAuthClient } from "better-auth/client"
import { passkeyClient } from "better-auth/client/plugins"

export const authClient = createAuthClient({
    plugins: [\
        passkeyClient()\
    ]
})
```

## [Usage](https://www.better-auth.com/docs/plugins/passkey\#usage)

### [Add/Register a passkey](https://www.better-auth.com/docs/plugins/passkey\#addregister-a-passkey)

To add or register a passkey make sure a user is authenticated and then call the `passkey.addPasskey` function provided by the client.

ClientServer

POST

/passkey/add-passkey

```
const { data, error } = await authClient.passkey.addPasskey({
    name: "example-passkey-name",
    authenticatorAttachment: "cross-platform",
});
```

| Prop | Description | Type |
| --- | --- | --- |
| `name?` | An optional name to label the authenticator account being registered. If not provided, it will default to the user's email address or user ID | `string` |
| `authenticatorAttachment?` | You can also specify the type of authenticator you want to register. Default behavior allows both platform and cross-platform passkeys | `"platform" | "cross-platform"` |

```
const data = await auth.api.addPasskey({
    body: {
        name: "example-passkey-name",
        authenticatorAttachment: "cross-platform",
    },
});
```

This is a client-only endpoint

### [Sign in with a passkey](https://www.better-auth.com/docs/plugins/passkey\#sign-in-with-a-passkey)

To sign in with a passkey you can use the `signIn.passkey` method. This will prompt the user to sign in with their passkey.

ClientServer

POST

/sign-in/passkey

```
const { data, error } = await authClient.signIn.passkey({
    email: "example@gmail.com", // required
    autoFill: true,
});
```

| Prop | Description | Type |
| --- | --- | --- |
| `email` | The email of the user to sign in. | `string` |
| `autoFill?` | Browser autofill, a.k.a. Conditional UI. Read more: https://simplewebauthn.dev/docs/packages/browser#browser-autofill-aka-conditional-ui | `boolean` |

```
const data = await auth.api.signInPasskey({
    body: {
        email: "example@gmail.com", // required
        autoFill: true,
    },
});
```

This is a client-only endpoint

#### [Example Usage](https://www.better-auth.com/docs/plugins/passkey\#example-usage)

```
// With post authentication redirect
await authClient.signIn.passkey({
    email: "user@example.com",
    autoFill: true,
    fetchOptions: {
        onSuccess(context) {
            // Redirect to dashboard after successful authentication
            window.location.href = "/dashboard";
        },
        onError(context) {
            // Handle authentication errors
            console.error("Authentication failed:", context.error.message);
        }
    }
});
```

### [List passkeys](https://www.better-auth.com/docs/plugins/passkey\#list-passkeys)

You can list all of the passkeys for the authenticated user by calling `passkey.listUserPasskeys`:

ClientServer

GET

/passkey/list-user-passkeys

```
const { data: passkeys, error } = await authClient.passkey.listUserPasskeys();
```

GET

/passkey/list-user-passkeys

```
const passkeys = await auth.api.listPasskeys({
    // This endpoint requires session cookies.
    headers: await headers(),
});
```

### [Deleting passkeys](https://www.better-auth.com/docs/plugins/passkey\#deleting-passkeys)

You can delete a passkey by calling `passkey.delete` and providing the passkey ID.

ClientServer

POST

/passkey/delete-passkey

```
const { data, error } = await authClient.passkey.deletePasskey({
    id: "some-passkey-id", // required
});
```

| Prop | Description | Type |
| --- | --- | --- |
| `id` | The ID of the passkey to delete. | `string` |

POST

/passkey/delete-passkey

```
const data = await auth.api.deletePasskey({
    body: {
        id: "some-passkey-id", // required
    },
    // This endpoint requires session cookies.
    headers: await headers(),
});
```

| Prop | Description | Type |
| --- | --- | --- |
| `id` | The ID of the passkey to delete. | `string` |

### [Updating passkey names](https://www.better-auth.com/docs/plugins/passkey\#updating-passkey-names)

ClientServer

POST

/passkey/update-passkey

```
const { data, error } = await authClient.passkey.updatePasskey({
    id: "id of passkey", // required
    name: "my-new-passkey-name", // required
});
```

| Prop | Description | Type |
| --- | --- | --- |
| `id` | The ID of the passkey which you want to update. | `string` |
| `name` | The new name which the passkey will be updated to. | `string` |

POST

/passkey/update-passkey

```
const data = await auth.api.updatePasskey({
    body: {
        id: "id of passkey", // required
        name: "my-new-passkey-name", // required
    },
    // This endpoint requires session cookies.
    headers: await headers(),
});
```

| Prop | Description | Type |
| --- | --- | --- |
| `id` | The ID of the passkey which you want to update. | `string` |
| `name` | The new name which the passkey will be updated to. | `string` |

### [Conditional UI](https://www.better-auth.com/docs/plugins/passkey\#conditional-ui)

The plugin supports conditional UI, which allows the browser to autofill the passkey if the user has already registered a passkey.

There are two requirements for conditional UI to work:

#### [Update input fields](https://www.better-auth.com/docs/plugins/passkey\#update-input-fields)

Add the `autocomplete` attribute with the value `webauthn` to your input fields. You can add this attribute to multiple input fields, but at least one is required for conditional UI to work.

The `webauthn` value should also be the last entry of the `autocomplete` attribute.

```
<label for="name">Username:</label>
<input type="text" name="name" autocomplete="username webauthn">
<label for="password">Password:</label>
<input type="password" name="password" autocomplete="current-password webauthn">
```

#### [Preload the passkeys](https://www.better-auth.com/docs/plugins/passkey\#preload-the-passkeys)

When your component mounts, you can preload the user's passkeys by calling the `authClient.signIn.passkey` method with the `autoFill` option set to `true`.

To prevent unnecessary calls, we will also add a check to see if the browser supports conditional UI.

React

```
useEffect(() => {
   if (!PublicKeyCredential.isConditionalMediationAvailable ||
       !PublicKeyCredential.isConditionalMediationAvailable()) {
     return;
   }

  void authClient.signIn.passkey({ autoFill: true })
}, [])
```

Depending on the browser, a prompt will appear to autofill the passkey. If the user has multiple passkeys, they can select the one they want to use.

Some browsers also require the user to first interact with the input field before the autofill prompt appears.

### [Debugging](https://www.better-auth.com/docs/plugins/passkey\#debugging)

To test your passkey implementation you can use [emulated authenticators](https://developer.chrome.com/docs/devtools/webauthn). This way you can test the registration and sign-in process without even owning a physical device.

## [Schema](https://www.better-auth.com/docs/plugins/passkey\#schema)

The plugin require a new table in the database to store passkey data.

Table Name: `passkey`

| Field Name | Type | Key | Description |
| --- | --- | --- | --- |
| id | string | PK | Unique identifier for each passkey |
| name | string | ? | The name of the passkey |
| publicKey | string | - | The public key of the passkey |
| userId | string | FK | The ID of the user |
| credentialID | string | - | The unique identifier of the registered credential |
| counter | number | - | The counter of the passkey |
| deviceType | string | - | The type of device used to register the passkey |
| backedUp | boolean | - | Whether the passkey is backed up |
| transports | string | - | The transports used to register the passkey |
| createdAt | Date | - | The time when the passkey was created |
| aaguid | string | ? | Authenticator's Attestation GUID indicating the type of the authenticator |

## [Options](https://www.better-auth.com/docs/plugins/passkey\#options)

**rpID**: A unique identifier for your website. 'localhost' is okay for local dev.

**rpName**: Human-readable title for your website.

**origin**: The URL at which registrations and authentications should occur. `http://localhost` and `http://localhost:PORT` are also valid. Do NOT include any trailing /.

**authenticatorSelection**: Allows customization of WebAuthn authenticator selection criteria. When unspecified, both platform and cross-platform authenticators are allowed with `preferred` settings for `residentKey` and `userVerification`.

**aaguid**: (optional) Authenticator Attestation GUID. This is a unique identifier for the passkey provider (device or authenticator type) and can be used to identify the type of passkey device used during registration or authentication.

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/plugins/passkey.mdx)

[Previous Page\\
\\
Email OTP](https://www.better-auth.com/docs/plugins/email-otp) [Next Page\\
\\
Generic OAuth](https://www.better-auth.com/docs/plugins/generic-oauth)

### On this page

[Installation](https://www.better-auth.com/docs/plugins/passkey#installation) [Add the plugin to your auth config](https://www.better-auth.com/docs/plugins/passkey#add-the-plugin-to-your-auth-config) [Migrate the database](https://www.better-auth.com/docs/plugins/passkey#migrate-the-database) [Add the client plugin](https://www.better-auth.com/docs/plugins/passkey#add-the-client-plugin) [Usage](https://www.better-auth.com/docs/plugins/passkey#usage) [Add/Register a passkey](https://www.better-auth.com/docs/plugins/passkey#addregister-a-passkey) [Sign in with a passkey](https://www.better-auth.com/docs/plugins/passkey#sign-in-with-a-passkey) [Example Usage](https://www.better-auth.com/docs/plugins/passkey#example-usage) [List passkeys](https://www.better-auth.com/docs/plugins/passkey#list-passkeys) [Deleting passkeys](https://www.better-auth.com/docs/plugins/passkey#deleting-passkeys) [Updating passkey names](https://www.better-auth.com/docs/plugins/passkey#updating-passkey-names) [Conditional UI](https://www.better-auth.com/docs/plugins/passkey#conditional-ui) [Update input fields](https://www.better-auth.com/docs/plugins/passkey#update-input-fields) [Preload the passkeys](https://www.better-auth.com/docs/plugins/passkey#preload-the-passkeys) [Debugging](https://www.better-auth.com/docs/plugins/passkey#debugging) [Schema](https://www.better-auth.com/docs/plugins/passkey#schema) [Options](https://www.better-auth.com/docs/plugins/passkey#options)