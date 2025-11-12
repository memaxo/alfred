---
title: GitLab | Better Auth
url: 
description: GitLab provider setup and usage.
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

# GitLab

Copy MarkdownOpen in

### [Get your GitLab credentials](https://www.better-auth.com/docs/authentication/gitlab\#get-your-gitlab-credentials)

To use GitLab sign in, you need a client ID and client secret. [GitLab OAuth documentation](https://docs.gitlab.com/ee/api/oauth2.html).

Make sure to set the redirect URL to `http://localhost:3000/api/auth/callback/gitlab` for local development. For production, you should set it to the URL of your application. If you change the base path of the auth routes, you should update the redirect URL accordingly.

### [Configure the provider](https://www.better-auth.com/docs/authentication/gitlab\#configure-the-provider)

To configure the provider, you need to import the provider and pass it to the `socialProviders` option of the auth instance.

auth.ts

```
import { betterAuth } from "better-auth"

export const auth = betterAuth({
    socialProviders: {
        gitlab: {
            clientId: process.env.GITLAB_CLIENT_ID as string,
            clientSecret: process.env.GITLAB_CLIENT_SECRET as string,
            issuer: process.env.GITLAB_ISSUER as string,
        },
    },
})
```

### [Sign In with GitLab](https://www.better-auth.com/docs/authentication/gitlab\#sign-in-with-gitlab)

To sign in with GitLab, you can use the `signIn.social` function provided by the client. The `signIn` function takes an object with the following properties:

- `provider`: The provider to use. It should be set to `gitlab`.

auth-client.ts

```
import { createAuthClient } from "better-auth/client"
const authClient =  createAuthClient()

const signIn = async () => {
    const data = await authClient.signIn.social({
        provider: "gitlab"
    })
}
```

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/authentication/gitlab.mdx)

[Previous Page\\
\\
LinkedIn](https://www.better-auth.com/docs/authentication/linkedin) [Next Page\\
\\
Reddit](https://www.better-auth.com/docs/authentication/reddit)

### On this page

[Get your GitLab credentials](https://www.better-auth.com/docs/authentication/gitlab#get-your-gitlab-credentials) [Configure the provider](https://www.better-auth.com/docs/authentication/gitlab#configure-the-provider) [Sign In with GitLab](https://www.better-auth.com/docs/authentication/gitlab#sign-in-with-gitlab)