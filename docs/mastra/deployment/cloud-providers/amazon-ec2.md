---
title: Amazon EC2
url: 
description: Deploy your Mastra applications to Amazon EC2.
language: en
---
[Skip to Content](https://mastra.ai/en/docs/deployment/cloud-providers/amazon-ec2#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") [Deployment](https://mastra.ai/en/docs/deployment/overview "Deployment") [Cloud Providers](https://mastra.ai/en/docs/deployment/cloud-providers "Cloud Providers") Amazon EC2

Copy page

# Amazon EC2

Deploy your Mastra applications to Amazon EC2 (Elastic Cloud Compute).

This guide assumes your Mastra application has been created using the default
`npx create-mastra@latest` command.
For more information on how to create a new Mastra application,
refer to our [getting started guide](https://mastra.ai/docs/getting-started/installation)

## Prerequisites [Permalink for this section](https://mastra.ai/en/docs/deployment/cloud-providers/amazon-ec2\#prerequisites)

- An AWS account with [EC2](https://aws.amazon.com/ec2/) access
- An EC2 instance running Ubuntu 24+ or Amazon Linux
- A domain name with an A record pointing to your instance
- A reverse proxy configured (e.g., using [nginx](https://nginx.org/))
- SSL certificate configured (e.g., using [Let’s Encrypt](https://letsencrypt.org/))
- Node.js 18+ installed on your instance

## Deployment Steps [Permalink for this section](https://mastra.ai/en/docs/deployment/cloud-providers/amazon-ec2\#deployment-steps)

### Clone your Mastra application [Permalink for this section](https://mastra.ai/en/docs/deployment/cloud-providers/amazon-ec2\#clone-your-mastra-application)

Connect to your EC2 instance and clone your repository:

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

### Install dependencies [Permalink for this section](https://mastra.ai/en/docs/deployment/cloud-providers/amazon-ec2\#install-dependencies)

```nextra-code

npm install
```

### Set up environment variables [Permalink for this section](https://mastra.ai/en/docs/deployment/cloud-providers/amazon-ec2\#set-up-environment-variables)

Create a `.env` file and add your environment variables:

```nextra-code

touch .env
```

Edit the `.env` file and add your environment variables:

```nextra-code

OPENAI_API_KEY=<your-openai-api-key>
# Add other required environment variables
```

### Build the application [Permalink for this section](https://mastra.ai/en/docs/deployment/cloud-providers/amazon-ec2\#build-the-application)

```nextra-code

npm run build
```

### Run the application [Permalink for this section](https://mastra.ai/en/docs/deployment/cloud-providers/amazon-ec2\#run-the-application)

```nextra-code

node --import=./.mastra/output/instrumentation.mjs --env-file=".env" .mastra/output/index.mjs
```

Your Mastra application will run on port 4111 by default. Ensure your reverse proxy is configured to forward requests to this port.

## Connect to your Mastra server [Permalink for this section](https://mastra.ai/en/docs/deployment/cloud-providers/amazon-ec2\#connect-to-your-mastra-server)

You can now connect to your Mastra server from your client application using a `MastraClient` from the `@mastra/client-js` package.

Refer to the [`MastraClient` documentation](https://mastra.ai/docs/client-js/overview) for more information.

```nextra-code [counter-reset:line]

import { MastraClient } from "@mastra/client-js";

const mastraClient = new MastraClient({
  baseUrl: "https://<your-domain-name>",
});
```

## Next steps [Permalink for this section](https://mastra.ai/en/docs/deployment/cloud-providers/amazon-ec2\#next-steps)

- [Mastra Client SDK](https://mastra.ai/docs/client-js/overview)

[Overview](https://mastra.ai/en/docs/deployment/cloud-providers "Overview") [AWS Lambda](https://mastra.ai/en/docs/deployment/cloud-providers/aws-lambda "AWS Lambda")