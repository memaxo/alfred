---
title: Digital Ocean
url: 
description: Deploy your Mastra applications to Digital Ocean.
language: en
---
[Skip to Content](https://mastra.ai/en/docs/deployment/cloud-providers/digital-ocean#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") [Deployment](https://mastra.ai/en/docs/deployment/overview "Deployment") [Cloud Providers](https://mastra.ai/en/docs/deployment/cloud-providers "Cloud Providers") Digital Ocean

Copy page

# Digital Ocean

Deploy your Mastra applications to Digital Ocean’s App Platform and Droplets.

This guide assumes your Mastra application has been created using the default
`npx create-mastra@latest` command.
For more information on how to create a new Mastra application,
refer to our [getting started guide](https://mastra.ai/en/docs/getting-started/installation)

App PlatformDroplets

### App Platform

## App Platform [Permalink for this section](https://mastra.ai/en/docs/deployment/cloud-providers/digital-ocean\#app-platform-1)

### Prerequisites [Permalink for this section](https://mastra.ai/en/docs/deployment/cloud-providers/digital-ocean\#app-platform-prerequisites)

- A Git repository containing your Mastra application. This can be a [GitHub](https://github.com/) repository, [GitLab](https://gitlab.com/) repository, or any other compatible source provider.
- A [Digital Ocean account](https://www.digitalocean.com/)

### Deployment Steps [Permalink for this section](https://mastra.ai/en/docs/deployment/cloud-providers/digital-ocean\#deployment-steps)

### Create a new App [Permalink for this section](https://mastra.ai/en/docs/deployment/cloud-providers/digital-ocean\#create-a-new-app)

- Log in to your [Digital Ocean dashboard](https://cloud.digitalocean.com/).
- Navigate to the [App Platform](https://docs.digitalocean.com/products/app-platform/) service.
- Select your source provider and create a new app.

### Configure Deployment Source [Permalink for this section](https://mastra.ai/en/docs/deployment/cloud-providers/digital-ocean\#configure-deployment-source)

- Connect and select your repository. You may also choose a container image or a sample app.
- Select the branch you want to deploy from.
- Configure the source directory if necessary. If your Mastra application uses the default directory structure, no action is required here.
- Head to the next step.

### Configure Resource Settings and Environment Variables [Permalink for this section](https://mastra.ai/en/docs/deployment/cloud-providers/digital-ocean\#configure-resource-settings-and-environment-variables)

- A Node.js build should be detected automatically.
- **Configure Build Command**: You need to add a custom build command for the app platform to build your Mastra project successfully. Set the build command based on your package manager:

npmpnpmyarnbun

### npm

```nextra-code

npm run build
```

### pnpm

```nextra-code

pnpm build
```

### yarn

```nextra-code

yarn build
```

### bun

```nextra-code

bun run build
```

- Add any required environment variables for your Mastra application. This includes API keys, database URLs, and other configuration values.
- You may choose to configure the size of your resource here.
- Other things you may optionally configure include, the region of your resource, the unique app name, and what project the resource belongs to.
- Once you’re done, you may create the app after reviewing your configuration and pricing estimates.

### Deployment [Permalink for this section](https://mastra.ai/en/docs/deployment/cloud-providers/digital-ocean\#deployment)

- Your app will be built and deployed automatically.
- Digital Ocean will provide you with a URL to access your deployed application.

You can now access your deployed application at the URL provided by Digital Ocean.

The Digital Ocean App Platform uses an ephemeral file system,
meaning that any files written to the file system are short-lived and may be lost.
Avoid using a Mastra storage provider that uses the file system,
such as `LibSQLStore` with a file URL.

### Droplets

## Droplets [Permalink for this section](https://mastra.ai/en/docs/deployment/cloud-providers/digital-ocean\#droplets-1)

Deploy your Mastra application to Digital Ocean’s Droplets.

### Prerequisites [Permalink for this section](https://mastra.ai/en/docs/deployment/cloud-providers/digital-ocean\#droplets-prerequisites)

- A [Digital Ocean account](https://www.digitalocean.com/)
- A [Droplet](https://docs.digitalocean.com/products/droplets/) running Ubuntu 24+
- A domain name with an A record pointing to your droplet
- A reverse proxy configured (e.g., using [nginx](https://nginx.org/))
- SSL certificate configured (e.g., using [Let’s Encrypt](https://letsencrypt.org/))
- Node.js 18+ installed on your droplet

### Deployment Steps [Permalink for this section](https://mastra.ai/en/docs/deployment/cloud-providers/digital-ocean\#deployment-steps-1)

### Clone your Mastra application [Permalink for this section](https://mastra.ai/en/docs/deployment/cloud-providers/digital-ocean\#clone-your-mastra-application)

Connect to your Droplet and clone your repository:

Public RepositoryPrivate Repository

### Public Repository

```nextra-code

git clone https://github.com/<your-username>/<your-repository>.git
```

### Private Repository

```nextra-code

git clone https://<your-username>:<your-personal-access-token>@github.com/<your-username>/<your-repository>.git
```

Navigate to the repository directory:

```nextra-code

cd "<your-repository>"
```

### Install dependencies [Permalink for this section](https://mastra.ai/en/docs/deployment/cloud-providers/digital-ocean\#install-dependencies)

```nextra-code

npm install
```

### Set up environment variables [Permalink for this section](https://mastra.ai/en/docs/deployment/cloud-providers/digital-ocean\#set-up-environment-variables)

Create a `.env` file and add your environment variables:

```nextra-code

touch .env
```

Edit the `.env` file and add your environment variables:

```nextra-code

OPENAI_API_KEY=<your-openai-api-key>
# Add other required environment variables
```

### Build the application [Permalink for this section](https://mastra.ai/en/docs/deployment/cloud-providers/digital-ocean\#build-the-application)

```nextra-code

npm run build
```

### Run the application [Permalink for this section](https://mastra.ai/en/docs/deployment/cloud-providers/digital-ocean\#run-the-application)

```nextra-code

node --import=./.mastra/output/instrumentation.mjs --env-file=".env" .mastra/output/index.mjs
```

Your Mastra application will run on port 4111 by default. Ensure your reverse proxy is configured to forward requests to this port.

## Connect to your Mastra server [Permalink for this section](https://mastra.ai/en/docs/deployment/cloud-providers/digital-ocean\#connect-to-your-mastra-server)

You can now connect to your Mastra server from your client application using a `MastraClient` from the `@mastra/client-js` package.

Refer to the [`MastraClient` documentation](https://mastra.ai/docs/server-db/mastra-client) for more information.

```nextra-code [counter-reset:line]

import { MastraClient } from "@mastra/client-js";

const mastraClient = new MastraClient({
  baseUrl: "https://<your-domain-name>",
});
```

## Next steps [Permalink for this section](https://mastra.ai/en/docs/deployment/cloud-providers/digital-ocean\#next-steps)

- [Mastra Client SDK](https://mastra.ai/docs/client-js/overview)
- [Digital Ocean App Platform documentation](https://docs.digitalocean.com/products/app-platform/)
- [Digital Ocean Droplets documentation](https://docs.digitalocean.com/products/droplets/)

[AWS Lambda](https://mastra.ai/en/docs/deployment/cloud-providers/aws-lambda "AWS Lambda") [Azure App Services](https://mastra.ai/en/docs/deployment/cloud-providers/azure-app-services "Azure App Services")