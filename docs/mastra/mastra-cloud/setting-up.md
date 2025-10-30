---
title: Setting Up a Project
url: 
description: Configuration steps for Mastra Cloud projects
language: en
---
[Skip to Content](https://mastra.ai/en/docs/mastra-cloud/setting-up#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") [Mastra Cloud](https://mastra.ai/en/docs/mastra-cloud/overview "Mastra Cloud") Setup & Deploy

Copy page

# Setting Up and Deploying

This page explains how to set up a project on [Mastra Cloud](https://mastra.ai/cloud) with automatic deployments using our GitHub integration.

**Beta Notice**

Mastra Cloud is currently in **public beta**. Features, APIs, and UIs may change as development continues.

## Prerequisites [Permalink for this section](https://mastra.ai/en/docs/mastra-cloud/setting-up\#prerequisites)

- A [Mastra Cloud](https://mastra.ai/cloud) account
- A GitHub account / repository containing a Mastra application

> See our [Getting started](https://mastra.ai/docs/getting-started/installation) guide to scaffold out a new Mastra project with sensible defaults.

## Setup and Deploy process [Permalink for this section](https://mastra.ai/en/docs/mastra-cloud/setting-up\#setup-and-deploy-process)

### Sign in to Mastra Cloud [Permalink for this section](https://mastra.ai/en/docs/mastra-cloud/setting-up\#sign-in-to-mastra-cloud)

Head over to [https://cloud.mastra.ai/](https://cloud.mastra.ai/) and sign in with either:

- **GitHub**
- **Google**

### Install the Mastra GitHub app [Permalink for this section](https://mastra.ai/en/docs/mastra-cloud/setting-up\#install-the-mastra-github-app)

When prompted, install the Mastra GitHub app.

![Install GitHub](https://mastra.ai/_next/image?url=%2Fdocs%2F_next%2Fstatic%2Fmedia%2Fmastra-cloud-install-github.3f0099a3.jpg&w=3840&q=75)

### Create a new project [Permalink for this section](https://mastra.ai/en/docs/mastra-cloud/setting-up\#create-a-new-project)

Click the **Create new project** button to create a new project.

![Create new project](https://mastra.ai/_next/image?url=%2Fdocs%2F_next%2Fstatic%2Fmedia%2Fmastra-cloud-create-new-project.26f1114b.jpg&w=3840&q=75)

### Import a Git repository [Permalink for this section](https://mastra.ai/en/docs/mastra-cloud/setting-up\#import-a-git-repository)

Search for a repository, then click **Import**.

![Import Git repository](https://mastra.ai/_next/image?url=%2Fdocs%2F_next%2Fstatic%2Fmedia%2Fmastra-cloud-import-git-repository.599479d2.jpg&w=3840&q=75)

### Configure the deployment [Permalink for this section](https://mastra.ai/en/docs/mastra-cloud/setting-up\#configure-the-deployment)

Mastra Cloud automatically detects the right build settings, but you can customize them using the options described below.

![Deployment details](https://mastra.ai/_next/image?url=%2Fdocs%2F_next%2Fstatic%2Fmedia%2Fmastra-cloud-deployment-details.255e7893.jpg&w=3840&q=75)

- **Importing from GitHub**: The GitHub repository name
- **Project name**: Customize the project name
- **Branch**: The branch to deploy from
- **Project root**: The root directory of your project
- **Mastra directory**: Where Mastra files are located
- **Environment variables**: Add environment variables used by the application
- **Build and Store settings**:
  - **Install command**: Runs pre-build to install project dependencies
  - **Project setup command**: Runs pre-build to prepare any external dependencies
  - **Port**: The network port the server will use
  - **Store settings**: Use Mastra Cloud’s built-in [LibSQLStore](https://mastra.ai/docs/storage/overview) storage
- **Deploy Project**: Starts the deployment process

### Deploy project [Permalink for this section](https://mastra.ai/en/docs/mastra-cloud/setting-up\#deploy-project)

Click **Deploy Project** to create and deploy your application using the configuration you’ve set.

## Successful deployment [Permalink for this section](https://mastra.ai/en/docs/mastra-cloud/setting-up\#successful-deployment)

After a successful deployment you’ll be shown the **Overview** screen where you can view your project’s status, domains, latest deployments and connected agents and workflows.

![Successful deployment](https://mastra.ai/_next/image?url=%2Fdocs%2F_next%2Fstatic%2Fmedia%2Fmastra-cloud-successful-deployment.5cafab4c.jpg&w=3840&q=75)

## Continuous integration [Permalink for this section](https://mastra.ai/en/docs/mastra-cloud/setting-up\#continuous-integration)

Your project is now configured with automatic deployments which occur whenever you push to the configured branch of your GitHub repository.

## Testing your application [Permalink for this section](https://mastra.ai/en/docs/mastra-cloud/setting-up\#testing-your-application)

After a successful deployment you can test your agents and workflows from the [Playground](https://mastra.ai/docs/mastra-cloud/dashboard#playground) in Mastra Cloud, or interact with them using our [Client SDK](https://mastra.ai/docs/client-js/overview).

## Next steps [Permalink for this section](https://mastra.ai/en/docs/mastra-cloud/setting-up\#next-steps)

- [Navigating the Dashboard](https://mastra.ai/docs/mastra-cloud/dashboard)

[Overview](https://mastra.ai/en/docs/mastra-cloud/overview "Overview") [Dashboard](https://mastra.ai/en/docs/mastra-cloud/dashboard "Dashboard")