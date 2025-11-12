---
title: Self hosting Laminar by forking from GitHub and running docker compose locally - Laminar documentation
url: 
language: en
---
[Skip to main content](https://docs.lmnr.ai/self-hosting/setup#content-area)

[Laminar documentation home page![logo](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/logo/logo.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=568416e0ece6e167d975769bcccddac6)](https://docs.lmnr.ai/)

Search...

Ctrl K

Search...

Navigation

Self-hosting

Self hosting Laminar by forking from GitHub and running docker compose locally

[Documentation](https://docs.lmnr.ai/overview) [Guides](https://docs.lmnr.ai/guides/fastapi) [API Reference](https://docs.lmnr.ai/api-reference/introduction)

1

Pull the repository

Copy

```
git clone https://github.com/lmnr-ai/lmnr

```

2

Copy

```
cd lmnr

```

3

Spin up the docker compose stack

Copy

```
docker compose up -d

```

4

\[Optional\] Learn more about self-hosting options

There is more information about the set up and self-hosting options
including the contributing guide in the [GitHub repository](https://github.com/lmnr-ai/lmnr).

5

Access the dashboard

The dashboard will be available at `http://localhost:5667/`.

6

Create a project and get the API key

In the dashboard, go over the onboarding flow. By default, any email is accepted,
so just enter a valid email address and follow the instructions.If you want to manage users/authentication, read the [access control](https://docs.lmnr.ai/self-hosting/access-control-setup) page.Once you have your first workspace and the project, go to the project settings,
create a new API key and copy the value. You will not be able to see the key again.

7

Configure the SDK to export traces to the local instance

By default, the backend will listen on port 8000 for HTTP and 8001 for gRPC.

- JavaScript/Typescript

- Python


Copy

```
import { Laminar } from `@lmnr-ai/lmnr`;

Laminar.initialize({
    projectApiKey: "<YOUR_PROJECT_API_KEY>",
    baseUrl: "http://localhost",
    httpPort: 8000,
    grpcPort: 8001,
    instrumentModules: {
        // your libraries to instrument
    }
})

```

[Installation](https://docs.lmnr.ai/installation) [Access Control Setup](https://docs.lmnr.ai/self-hosting/access-control-setup)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.