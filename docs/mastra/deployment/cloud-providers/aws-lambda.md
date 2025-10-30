---
title: AWS Lambda
url: 
description: Deploy your Mastra applications to AWS Lambda using Docker containers and the AWS Lambda Web Adapter.
language: en
---
[Skip to Content](https://mastra.ai/en/docs/deployment/cloud-providers/aws-lambda#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") [Deployment](https://mastra.ai/en/docs/deployment/overview "Deployment") [Cloud Providers](https://mastra.ai/en/docs/deployment/cloud-providers "Cloud Providers") AWS Lambda

Copy page

# AWS Lambda

Deploy your Mastra applications to AWS Lambda using Docker containers and the AWS Lambda Web Adapter.
This approach allows you to run your Mastra server as a containerized Lambda function with automatic scaling.

This guide assumes your Mastra application has been created using the default
`npx create-mastra@latest` command.
For more information on how to create a new Mastra application,
refer to our [getting started guide](https://mastra.ai/docs/getting-started/installation)

## Prerequisites [Permalink for this section](https://mastra.ai/en/docs/deployment/cloud-providers/aws-lambda\#prerequisites)

Before deploying to AWS Lambda, ensure you have:

- [AWS CLI](https://aws.amazon.com/cli/) installed and configured
- [Docker](https://www.docker.com/) installed and running
- An AWS account with appropriate permissions for Lambda, ECR, and IAM
- Your Mastra application configured with appropriate memory storage

## Memory Configuration [Permalink for this section](https://mastra.ai/en/docs/deployment/cloud-providers/aws-lambda\#memory-configuration)

AWS Lambda uses an ephemeral file system,
meaning that any files written to the file system are short-lived and may be lost.
Avoid using a Mastra storage provider that uses the file system,
such as `LibSQLStore` with a file URL.

Lambda functions have limitations with file system storage. Configure your Mastra application to use either in-memory or external storage providers:

### Option 1: In-Memory (Simplest) [Permalink for this section](https://mastra.ai/en/docs/deployment/cloud-providers/aws-lambda\#option-1-in-memory-simplest)

src/mastra/index.ts

```nextra-code [counter-reset:line]

import { LibSQLStore } from "@mastra/libsql";

const storage = new LibSQLStore({
  url: ":memory:", // in-memory storage
});
```

### Option 2: External Storage Providers [Permalink for this section](https://mastra.ai/en/docs/deployment/cloud-providers/aws-lambda\#option-2-external-storage-providers)

For persistent memory across Lambda invocations, use external storage providers like `LibSQLStore` with Turso or other storage providers like `PostgreStore`:

src/mastra/index.ts

```nextra-code [counter-reset:line]

import { LibSQLStore } from "@mastra/libsql";

const storage = new LibSQLStore({
  url: "libsql://your-database.turso.io", // External Turso database
  authToken: process.env.TURSO_AUTH_TOKEN,
});
```

For more memory configuration options, see the [Memory documentation](https://mastra.ai/docs/memory/overview).

## Creating a Dockerfile [Permalink for this section](https://mastra.ai/en/docs/deployment/cloud-providers/aws-lambda\#creating-a-dockerfile)

Create a `Dockerfile` in your Mastra project root directory:

Dockerfile

```nextra-code [counter-reset:line]

FROM node:22-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY src ./src
RUN npx mastra build
RUN apk add --no-cache gcompat

COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.0 /lambda-adapter /opt/extensions/lambda-adapter
RUN addgroup -g 1001 -S nodejs && \
  adduser -S mastra -u 1001 && \
  chown -R mastra:nodejs /app

USER mastra

ENV PORT=8080
ENV NODE_ENV=production
ENV READINESS_CHECK_PATH="/api"

EXPOSE 8080

CMD ["node", "--import=./.mastra/output/instrumentation.mjs", ".mastra/output/index.mjs"]
```

## Building and Deploying [Permalink for this section](https://mastra.ai/en/docs/deployment/cloud-providers/aws-lambda\#building-and-deploying)

### Set up environment variables [Permalink for this section](https://mastra.ai/en/docs/deployment/cloud-providers/aws-lambda\#set-up-environment-variables)

Set up your environment variables for the deployment process:

```nextra-code

export PROJECT_NAME="your-mastra-app"
export AWS_REGION="us-east-1"
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
```

### Build the Docker image [Permalink for this section](https://mastra.ai/en/docs/deployment/cloud-providers/aws-lambda\#build-the-docker-image)

Build your Docker image locally:

```nextra-code

docker build -t "$PROJECT_NAME" .
```

### Create an ECR repository [Permalink for this section](https://mastra.ai/en/docs/deployment/cloud-providers/aws-lambda\#create-an-ecr-repository)

Create an Amazon ECR repository to store your Docker image:

```nextra-code

aws ecr create-repository --repository-name "$PROJECT_NAME" --region "$AWS_REGION"
```

### Authenticate Docker with ECR [Permalink for this section](https://mastra.ai/en/docs/deployment/cloud-providers/aws-lambda\#authenticate-docker-with-ecr)

Log in to Amazon ECR:

```nextra-code

aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
```

### Tag and push the image [Permalink for this section](https://mastra.ai/en/docs/deployment/cloud-providers/aws-lambda\#tag-and-push-the-image)

Tag your image with the ECR repository URI and push it:

```nextra-code

docker tag "$PROJECT_NAME":latest "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$PROJECT_NAME":latest
docker push "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$PROJECT_NAME":latest
```

### Create the Lambda function [Permalink for this section](https://mastra.ai/en/docs/deployment/cloud-providers/aws-lambda\#create-the-lambda-function)

Create a Lambda function using the AWS Console:

1. Navigate to the [AWS Lambda Console](https://console.aws.amazon.com/lambda/)
2. Click **Create function**
3. Select **Container image**
4. Configure the function:
   - **Function name**: Your function name (e.g., `mastra-app`)
   - **Container image URI**: Click **Browse images** and select your ECR repository, then choose the `latest` tag
   - **Architecture**: Select the architecture that matches your Docker build (typically `x86_64`)

### Configure Function URL [Permalink for this section](https://mastra.ai/en/docs/deployment/cloud-providers/aws-lambda\#configure-function-url)

Enable Function URL for external access:

1. In the Lambda function configuration, go to **Configuration** \> **Function URL**
2. Click **Create function URL**
3. Set **Auth type** to **NONE** (for public access)
4. Configure **CORS** settings:
   - **Allow-Origin**: `*` (restrict to your domain in production)
   - **Allow-Headers**: `content-type`
   - **Allow-Methods**: `*` (audit and restrict in production)
5. Click **Save**

### Configure environment variables [Permalink for this section](https://mastra.ai/en/docs/deployment/cloud-providers/aws-lambda\#configure-environment-variables)

Add your environment variables in the Lambda function configuration:

1. Go to **Configuration** \> **Environment variables**
2. Add the required variables for your Mastra application:
   - `OPENAI_API_KEY`: Your OpenAI API key (if using OpenAI)
   - `ANTHROPIC_API_KEY`: Your Anthropic API key (if using Anthropic)
   - `TURSO_AUTH_TOKEN`: Your Turso auth token (if using LibSQL with Turso)
   - Other provider-specific API keys as needed

### Adjust function settings [Permalink for this section](https://mastra.ai/en/docs/deployment/cloud-providers/aws-lambda\#adjust-function-settings)

Configure the function’s memory and timeout settings:

1. Go to **Configuration** \> **General configuration**
2. Set the following recommended values:
   - **Memory**: 512 MB (adjust based on your application needs)
   - **Timeout**: 30 seconds (adjust based on your application needs)
   - **Ephemeral storage**: 512 MB (optional, for temporary files)

## Testing your deployment [Permalink for this section](https://mastra.ai/en/docs/deployment/cloud-providers/aws-lambda\#testing-your-deployment)

Once deployed, test your Lambda function:

1. Copy the **Function URL** from the Lambda console
2. Visit the URL in your browser to see your Mastra’s server home screen
3. Test your agents and workflows using the generated API endpoints

For more information about available API endpoints, see the [Server documentation](https://mastra.ai/docs/deployment/server).

## Connecting your client [Permalink for this section](https://mastra.ai/en/docs/deployment/cloud-providers/aws-lambda\#connecting-your-client)

Update your client application to use the Lambda function URL:

src/client.ts

```nextra-code [counter-reset:line]

import { MastraClient } from "@mastra/client-js";

const mastraClient = new MastraClient({
  baseUrl: "https://your-function-url.lambda-url.us-east-1.on.aws",
});
```

## Troubleshooting [Permalink for this section](https://mastra.ai/en/docs/deployment/cloud-providers/aws-lambda\#troubleshooting)

### Function timeout errors [Permalink for this section](https://mastra.ai/en/docs/deployment/cloud-providers/aws-lambda\#function-timeout-errors)

If your Lambda function times out:

- Increase the timeout value in **Configuration** \> **General configuration**
- Optimize your Mastra application for faster cold starts
- Consider using provisioned concurrency for consistent performance

### Memory issues [Permalink for this section](https://mastra.ai/en/docs/deployment/cloud-providers/aws-lambda\#memory-issues)

If you encounter memory-related errors:

- Increase the memory allocation in **Configuration** \> **General configuration**
- Monitor memory usage in CloudWatch Logs
- Optimize your application’s memory usage

### CORS issues [Permalink for this section](https://mastra.ai/en/docs/deployment/cloud-providers/aws-lambda\#cors-issues)

If you encounter CORS errors when accessing endpoints but not the home page:

- Verify CORS headers are properly set in your Mastra server configuration
- Check the Lambda Function URL CORS configuration
- Ensure your client is making requests to the correct URL

### Container image issues [Permalink for this section](https://mastra.ai/en/docs/deployment/cloud-providers/aws-lambda\#container-image-issues)

If the Lambda function fails to start:

- Verify the Docker image builds successfully locally
- Check that the `CMD` instruction in your Dockerfile is correct
- Review CloudWatch Logs for container startup errors
- Ensure the Lambda Web Adapter is properly installed in the container

## Production considerations [Permalink for this section](https://mastra.ai/en/docs/deployment/cloud-providers/aws-lambda\#production-considerations)

For production deployments:

### Security [Permalink for this section](https://mastra.ai/en/docs/deployment/cloud-providers/aws-lambda\#security)

- Restrict CORS origins to your trusted domains
- Use AWS IAM roles for secure access to other AWS services
- Store sensitive environment variables in AWS Secrets Manager or Parameter Store

### Monitoring [Permalink for this section](https://mastra.ai/en/docs/deployment/cloud-providers/aws-lambda\#monitoring)

- Enable CloudWatch monitoring for your Lambda function
- Set up CloudWatch alarms for errors and performance metrics
- Use AWS X-Ray for distributed tracing

### Scaling [Permalink for this section](https://mastra.ai/en/docs/deployment/cloud-providers/aws-lambda\#scaling)

- Configure provisioned concurrency for predictable performance
- Monitor concurrent executions and adjust limits as needed
- Consider using Application Load Balancer for more complex routing needs

## Next steps [Permalink for this section](https://mastra.ai/en/docs/deployment/cloud-providers/aws-lambda\#next-steps)

- [Mastra Client SDK](https://mastra.ai/docs/client-js/overview)
- [AWS Lambda documentation](https://docs.aws.amazon.com/lambda/)
- [AWS Lambda Web Adapter](https://github.com/awslabs/aws-lambda-web-adapter)

[Amazon EC2](https://mastra.ai/en/docs/deployment/cloud-providers/amazon-ec2 "Amazon EC2") [Digital Ocean](https://mastra.ai/en/docs/deployment/cloud-providers/digital-ocean "Digital Ocean")