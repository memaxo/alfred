---
title: Dodo Payments | Better Auth
url: 
description: Better Auth Plugin for Dodo Payments
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

# Dodo Payments

Copy MarkdownOpen in

[Dodo Payments](https://dodopayments.com/) is a global Merchant-of-Record platform that lets AI, SaaS and digital businesses sell in 150+ countries without touching tax, fraud, or compliance. A single, developer-friendly API powers checkout, billing, and payouts so you can launch worldwide in minutes.

[**Get support on Dodo Payments' Discord** \\
\\
This plugin is maintained by the Dodo Payments team.\\
\\
Have questions? Our team is available on Discord to assist you anytime.](https://discord.gg/bYqAp4ayYh)

## [Features](https://www.better-auth.com/docs/plugins/dodopayments\#features)

- Automatic customer creation on sign-up
- Type-safe checkout flows with product slug mapping
- Self-service customer portal
- Real-time webhook event processing with signature verification

[**Get started with Dodo Payments** \\
\\
You need a Dodo Payments account and API keys to use this integration.](https://app.dodopayments.com/)

## [Installation](https://www.better-auth.com/docs/plugins/dodopayments\#installation)

Run the following command in your project root:

```
npm install @dodopayments/better-auth dodopayments better-auth zod
```

Add these to your `.env` file:

```
DODO_PAYMENTS_API_KEY=your_api_key_here
DODO_PAYMENTS_WEBHOOK_SECRET=your_webhook_secret_here
```

Create or update `src/lib/auth.ts`:

```
import { betterAuth } from "better-auth";
import {
  dodopayments,
  checkout,
  portal,
  webhooks,
} from "@dodopayments/better-auth";
import DodoPayments from "dodopayments";

export const dodoPayments = new DodoPayments({
  bearerToken: process.env.DODO_PAYMENTS_API_KEY!,
  environment: "test_mode"
});

export const auth = betterAuth({
  plugins: [\
    dodopayments({\
      client: dodoPayments,\
      createCustomerOnSignUp: true,\
      use: [\
        checkout({\
          products: [\
            {\
              productId: "pdt_xxxxxxxxxxxxxxxxxxxxx",\
              slug: "premium-plan",\
            },\
          ],\
          successUrl: "/dashboard/success",\
          authenticatedUsersOnly: true,\
        }),\
        portal(),\
        webhooks({\
          webhookKey: process.env.DODO_PAYMENTS_WEBHOOK_SECRET!,\
          onPayload: async (payload) => {\
            console.log("Received webhook:", payload.event_type);\
          },\
        }),\
      ],\
    }),\
  ],
});
```

Set `environment` to `live_mode` for production.

Create or update `src/lib/auth-client.ts`:

```
import { dodopaymentsClient } from "@dodopayments/better-auth";

export const authClient = createAuthClient({
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  plugins: [dodopaymentsClient()],
});
```

## [Usage](https://www.better-auth.com/docs/plugins/dodopayments\#usage)

### [Creating a Checkout Session](https://www.better-auth.com/docs/plugins/dodopayments\#creating-a-checkout-session)

```
const { data: checkout, error } = await authClient.dodopayments.checkout({
  slug: "premium-plan",
  customer: {
    email: "customer@example.com",
    name: "John Doe",
  },
  billing: {
    city: "San Francisco",
    country: "US",
    state: "CA",
    street: "123 Market St",
    zipcode: "94103",
  },
  referenceId: "order_123",
});

if (checkout) {
  window.location.href = checkout.url;
}
```

### [Accessing the Customer Portal](https://www.better-auth.com/docs/plugins/dodopayments\#accessing-the-customer-portal)

```
const { data: customerPortal, error } = await authClient.dodopayments.customer.portal();
if (customerPortal && customerPortal.redirect) {
  window.location.href = customerPortal.url;
}
```

### [Listing Customer Data](https://www.better-auth.com/docs/plugins/dodopayments\#listing-customer-data)

```
// Get subscriptions
const { data: subscriptions, error } =
  await authClient.dodopayments.customer.subscriptions.list({
    query: {
      limit: 10,
      page: 1,
      active: true,
    },
  });

// Get payment history
const { data: payments, error } = await authClient.dodopayments.customer.payments.list({
  query: {
    limit: 10,
    page: 1,
    status: "succeeded",
  },
});
```

### [Webhooks](https://www.better-auth.com/docs/plugins/dodopayments\#webhooks)

The webhooks plugin processes real-time payment events from Dodo Payments with secure signature verification. The default endpoint is `/api/auth/dodopayments/webhooks`.

Generate a webhook secret for your endpoint URL (e.g., `https://your-domain.com/api/auth/dodopayments/webhooks`) in the Dodo Payments Dashboard and set it in your .env file:

```
DODO_PAYMENTS_WEBHOOK_SECRET=your_webhook_secret_here
```

Example handler:

```
webhooks({
  webhookKey: process.env.DODO_PAYMENTS_WEBHOOK_SECRET!,
  onPayload: async (payload) => {
    console.log("Received webhook:", payload.event_type);
  },
});
```

## [Configuration Reference](https://www.better-auth.com/docs/plugins/dodopayments\#configuration-reference)

### [Plugin Options](https://www.better-auth.com/docs/plugins/dodopayments\#plugin-options)

- **client** (required): DodoPayments client instance
- **createCustomerOnSignUp** (optional): Auto-create customers on user signup
- **use** (required): Array of plugins to enable (checkout, portal, webhooks)

### [Checkout Plugin Options](https://www.better-auth.com/docs/plugins/dodopayments\#checkout-plugin-options)

- **products**: Array of products or async function returning products
- **successUrl**: URL to redirect after successful payment
- **authenticatedUsersOnly**: Require user authentication (default: false)

If you encounter any issues, please refer to the [Dodo Payments documentation](https://docs.dodopayments.com/) for troubleshooting steps.

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/plugins/dodopayments.mdx)

[Previous Page\\
\\
Autumn Billing](https://www.better-auth.com/docs/plugins/autumn) [Next Page\\
\\
Dub](https://www.better-auth.com/docs/plugins/dub)

### On this page

[Features](https://www.better-auth.com/docs/plugins/dodopayments#features) [Installation](https://www.better-auth.com/docs/plugins/dodopayments#installation) [Usage](https://www.better-auth.com/docs/plugins/dodopayments#usage) [Creating a Checkout Session](https://www.better-auth.com/docs/plugins/dodopayments#creating-a-checkout-session) [Accessing the Customer Portal](https://www.better-auth.com/docs/plugins/dodopayments#accessing-the-customer-portal) [Listing Customer Data](https://www.better-auth.com/docs/plugins/dodopayments#listing-customer-data) [Webhooks](https://www.better-auth.com/docs/plugins/dodopayments#webhooks) [Configuration Reference](https://www.better-auth.com/docs/plugins/dodopayments#configuration-reference) [Plugin Options](https://www.better-auth.com/docs/plugins/dodopayments#plugin-options) [Checkout Plugin Options](https://www.better-auth.com/docs/plugins/dodopayments#checkout-plugin-options)