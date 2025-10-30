---
title: Polar | Better Auth
url: 
description: Better Auth Plugin for Payment and Checkouts using Polar
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

# Polar

Copy MarkdownOpen in

[Polar](https://polar.sh/) is a developer first payment infrastructure. Out of the box it provides a lot of developer first integrations for payments, checkouts and more. This plugin helps you integrate Polar with Better Auth to make your auth + payments flow seamless.

This plugin is maintained by Polar team. For bugs, issues or feature requests,
please visit the [Polar GitHub\\
repo](https://github.com/polarsource/polar-adapters).

## [Features](https://www.better-auth.com/docs/plugins/polar\#features)

- Checkout Integration
- Customer Portal
- Automatic Customer creation on signup
- Event Ingestion & Customer Meters for flexible Usage Based Billing
- Handle Polar Webhooks securely with signature verification
- Reference System to associate purchases with organizations

## [Installation](https://www.better-auth.com/docs/plugins/polar\#installation)

```
pnpm add better-auth @polar-sh/better-auth @polar-sh/sdk
```

## [Preparation](https://www.better-auth.com/docs/plugins/polar\#preparation)

Go to your Polar Organization Settings, and create an Organization Access Token. Add it to your environment.

```
# .env
POLAR_ACCESS_TOKEN=...
```

### [Configuring BetterAuth Server](https://www.better-auth.com/docs/plugins/polar\#configuring-betterauth-server)

The Polar plugin comes with a handful additional plugins which adds functionality to your stack.

- Checkout - Enables a seamless checkout integration
- Portal - Makes it possible for your customers to manage their orders, subscriptions & granted benefits
- Usage - Simple extension for listing customer meters & ingesting events for Usage Based Billing
- Webhooks - Listen for relevant Polar webhooks

```
import { betterAuth } from "better-auth";
import { polar, checkout, portal, usage, webhooks } from "@polar-sh/better-auth";
import { Polar } from "@polar-sh/sdk";

const polarClient = new Polar({
    accessToken: process.env.POLAR_ACCESS_TOKEN,
    // Use 'sandbox' if you're using the Polar Sandbox environment
    // Remember that access tokens, products, etc. are completely separated between environments.
    // Access tokens obtained in Production are for instance not usable in the Sandbox environment.
    server: 'sandbox'
});

const auth = betterAuth({
    // ... Better Auth config
    plugins: [\
        polar({\
            client: polarClient,\
            createCustomerOnSignUp: true,\
            use: [\
                checkout({\
                    products: [\
                        {\
                            productId: "123-456-789", // ID of Product from Polar Dashboard\
                            slug: "pro" // Custom slug for easy reference in Checkout URL, e.g. /checkout/pro\
                        }\
                    ],\
                    successUrl: "/success?checkout_id={CHECKOUT_ID}",\
                    authenticatedUsersOnly: true\
                }),\
                portal(),\
                usage(),\
                webhooks({\
                    secret: process.env.POLAR_WEBHOOK_SECRET,\
                    onCustomerStateChanged: (payload) => // Triggered when anything regarding a customer changes\
                    onOrderPaid: (payload) => // Triggered when an order was paid (purchase, subscription renewal, etc.)\
                    ...  // Over 25 granular webhook handlers\
                    onPayload: (payload) => // Catch-all for all events\
                })\
            ],\
        })\
    ]
});
```

### [Configuring BetterAuth Client](https://www.better-auth.com/docs/plugins/polar\#configuring-betterauth-client)

You will be using the BetterAuth Client to interact with the Polar functionalities.

```
import { createAuthClient } from "better-auth/react";
import { polarClient } from "@polar-sh/better-auth";

// This is all that is needed
// All Polar plugins, etc. should be attached to the server-side BetterAuth config
export const authClient = createAuthClient({
  plugins: [polarClient()],
});
```

## [Configuration Options](https://www.better-auth.com/docs/plugins/polar\#configuration-options)

```
import { betterAuth } from "better-auth";
import {
  polar,
  checkout,
  portal,
  usage,
  webhooks,
} from "@polar-sh/better-auth";
import { Polar } from "@polar-sh/sdk";

const polarClient = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN,
  // Use 'sandbox' if you're using the Polar Sandbox environment
  // Remember that access tokens, products, etc. are completely separated between environments.
  // Access tokens obtained in Production are for instance not usable in the Sandbox environment.
  server: "sandbox",
});

const auth = betterAuth({
  // ... Better Auth config
  plugins: [\
    polar({\
      client: polarClient,\
      createCustomerOnSignUp: true,\
      getCustomerCreateParams: ({ user }, request) => ({\
        metadata: {\
          myCustomProperty: 123,\
        },\
      }),\
      use: [\
        // This is where you add Polar plugins\
      ],\
    }),\
  ],
});
```

### [Required Options](https://www.better-auth.com/docs/plugins/polar\#required-options)

- `client`: Polar SDK client instance

### [Optional Options](https://www.better-auth.com/docs/plugins/polar\#optional-options)

- `createCustomerOnSignUp`: Automatically create a Polar customer when a user signs up
- `getCustomerCreateParams`: Custom function to provide additional customer creation metadata

### [Customers](https://www.better-auth.com/docs/plugins/polar\#customers)

When `createCustomerOnSignUp` is enabled, a new Polar Customer is automatically created when a new User is added in the Better-Auth Database.

All new customers are created with an associated `externalId`, which is the ID of your User in the Database. This allows us to skip any Polar to User mapping in your Database.

## [Checkout Plugin](https://www.better-auth.com/docs/plugins/polar\#checkout-plugin)

To support checkouts in your app, simply pass the Checkout plugin to the use-property.

```
import { polar, checkout } from "@polar-sh/better-auth";

const auth = betterAuth({
    // ... Better Auth config
    plugins: [\
        polar({\
            ...\
            use: [\
                checkout({\
                    // Optional field - will make it possible to pass a slug to checkout instead of Product ID\
                    products: [ { productId: "123-456-789", slug: "pro" } ],\
                    // Relative URL to return to when checkout is successfully completed\
                    successUrl: "/success?checkout_id={CHECKOUT_ID}",\
                    // Wheather you want to allow unauthenticated checkout sessions or not\
                    authenticatedUsersOnly: true\
                })\
            ],\
        })\
    ]
});
```

When checkouts are enabled, you're able to initialize Checkout Sessions using the checkout-method on the BetterAuth Client. This will redirect the user to the Product Checkout.

```
await authClient.checkout({
  // Any Polar Product ID can be passed here
  products: ["e651f46d-ac20-4f26-b769-ad088b123df2"],
  // Or, if you setup "products" in the Checkout Config, you can pass the slug
  slug: "pro",
});
```

Checkouts will automatically carry the authenticated User as the customer to the checkout. Email-address will be "locked-in".

If `authenticatedUsersOnly` is `false` \- then it will be possible to trigger checkout sessions without any associated customer.

### [Organization Support](https://www.better-auth.com/docs/plugins/polar\#organization-support)

This plugin supports the Organization plugin. If you pass the organization ID to the Checkout referenceId, you will be able to keep track of purchases made from organization members.

```
const organizationId = (await authClient.organization.list())?.data?.[0]?.id,

await authClient.checkout({
    // Any Polar Product ID can be passed here
    products: ["e651f46d-ac20-4f26-b769-ad088b123df2"],
    // Or, if you setup "products" in the Checkout Config, you can pass the slug
    slug: 'pro',
    // Reference ID will be saved as `referenceId` in the metadata of the checkout, order & subscription object
    referenceId: organizationId
});
```

## [Portal Plugin](https://www.better-auth.com/docs/plugins/polar\#portal-plugin)

A plugin which enables customer management of their purchases, orders and subscriptions.

```
import { polar, checkout, portal } from "@polar-sh/better-auth";

const auth = betterAuth({
    // ... Better Auth config
    plugins: [\
        polar({\
            ...\
            use: [\
                checkout(...),\
                portal()\
            ],\
        })\
    ]
});
```

The portal-plugin gives the BetterAuth Client a set of customer management methods, scoped under `authClient.customer`.

### [Customer Portal Management](https://www.better-auth.com/docs/plugins/polar\#customer-portal-management)

The following method will redirect the user to the Polar Customer Portal, where they can see orders, purchases, subscriptions, benefits, etc.

```
await authClient.customer.portal();
```

### [Customer State](https://www.better-auth.com/docs/plugins/polar\#customer-state)

The portal plugin also adds a convenient state-method for retrieving the general Customer State.

```
const { data: customerState } = await authClient.customer.state();
```

The customer state object contains:

- All the data about the customer.
- The list of their active subscriptions
  - Note: This does not include subscriptions done by a parent organization. See the subscription list-method below for more information.
- The list of their granted benefits.
- The list of their active meters, with their current balance.

Thus, with that single object, you have all the required information to check if you should provision access to your service or not.

[You can learn more about the Polar Customer State in the Polar Docs](https://docs.polar.sh/integrate/customer-state).

### [Benefits, Orders & Subscriptions](https://www.better-auth.com/docs/plugins/polar\#benefits-orders--subscriptions)

The portal plugin adds 3 convenient methods for listing benefits, orders & subscriptions relevant to the authenticated user/customer.

[All of these methods use the Polar CustomerPortal APIs](https://docs.polar.sh/api-reference/customer-portal)

#### [Benefits](https://www.better-auth.com/docs/plugins/polar\#benefits)

This method only lists granted benefits for the authenticated user/customer.

```
const { data: benefits } = await authClient.customer.benefits.list({
  query: {
    page: 1,
    limit: 10,
  },
});
```

#### [Orders](https://www.better-auth.com/docs/plugins/polar\#orders)

This method lists orders like purchases and subscription renewals for the authenticated user/customer.

```
const { data: orders } = await authClient.customer.orders.list({
  query: {
    page: 1,
    limit: 10,
    productBillingType: "one_time", // or 'recurring'
  },
});
```

#### [Subscriptions](https://www.better-auth.com/docs/plugins/polar\#subscriptions)

This method lists the subscriptions associated with authenticated user/customer.

```
const { data: subscriptions } = await authClient.customer.subscriptions.list({
  query: {
    page: 1,
    limit: 10,
    active: true,
  },
});
```

**Important** \- Organization Support

This will **not** return subscriptions made by a parent organization to the authenticated user.

However, you can pass a `referenceId` to this method. This will return all subscriptions associated with that referenceId instead of subscriptions associated with the user.

So in order to figure out if a user should have access, pass the user's organization ID to see if there is an active subscription for that organization.

```
const organizationId = (await authClient.organization.list())?.data?.[0]?.id,

const { data: subscriptions } = await authClient.customer.orders.list({
    query: {
	    page: 1,
		limit: 10,
		active: true,
        referenceId: organizationId
    },
});

const userShouldHaveAccess = subscriptions.some(
    sub => // Your logic to check subscription product or whatever.
)
```

## [Usage Plugin](https://www.better-auth.com/docs/plugins/polar\#usage-plugin)

A simple plugin for Usage Based Billing.

```
import { polar, checkout, portal, usage } from "@polar-sh/better-auth";

const auth = betterAuth({
    // ... Better Auth config
    plugins: [\
        polar({\
            ...\
            use: [\
                checkout(...),\
                portal(),\
                usage()\
            ],\
        })\
    ]
});
```

### [Event Ingestion](https://www.better-auth.com/docs/plugins/polar\#event-ingestion)

Polar's Usage Based Billing builds entirely on event ingestion. Ingest events from your application, create Meters to represent that usage, and add metered prices to Products to charge for it.

[Learn more about Usage Based Billing in the Polar Docs.](https://docs.polar.sh/features/usage-based-billing/introduction)

```
const { data: ingested } = await authClient.usage.ingest({
  event: "file-uploads",
  metadata: {
    uploadedFiles: 12,
  },
});
```

The authenticated user is automatically associated with the ingested event.

### [Customer Meters](https://www.better-auth.com/docs/plugins/polar\#customer-meters)

A simple method for listing the authenticated user's Usage Meters, or as we call them, Customer Meters.

Customer Meter's contains all information about their consumtion on your defined meters.

- Customer Information
- Meter Information
- Customer Meter Information
  - Consumed Units
  - Credited Units
  - Balance

```
const { data: customerMeters } = await authClient.usage.meters.list({
  query: {
    page: 1,
    limit: 10,
  },
});
```

## [Webhooks Plugin](https://www.better-auth.com/docs/plugins/polar\#webhooks-plugin)

The Webhooks plugin can be used to capture incoming events from your Polar organization.

```
import { polar, webhooks } from "@polar-sh/better-auth";

const auth = betterAuth({
    // ... Better Auth config
    plugins: [\
        polar({\
            ...\
            use: [\
                webhooks({\
                    secret: process.env.POLAR_WEBHOOK_SECRET,\
                    onCustomerStateChanged: (payload) => // Triggered when anything regarding a customer changes\
                    onOrderPaid: (payload) => // Triggered when an order was paid (purchase, subscription renewal, etc.)\
                    ...  // Over 25 granular webhook handlers\
                    onPayload: (payload) => // Catch-all for all events\
                })\
            ],\
        })\
    ]
});
```

Configure a Webhook endpoint in your Polar Organization Settings page. Webhook endpoint is configured at /polar/webhooks.

Add the secret to your environment.

```
# .env
POLAR_WEBHOOK_SECRET=...
```

The plugin supports handlers for all Polar webhook events:

- `onPayload` \- Catch-all handler for any incoming Webhook event
- `onCheckoutCreated` \- Triggered when a checkout is created
- `onCheckoutUpdated` \- Triggered when a checkout is updated
- `onOrderCreated` \- Triggered when an order is created
- `onOrderPaid` \- Triggered when an order is paid
- `onOrderRefunded` \- Triggered when an order is refunded
- `onRefundCreated` \- Triggered when a refund is created
- `onRefundUpdated` \- Triggered when a refund is updated
- `onSubscriptionCreated` \- Triggered when a subscription is created
- `onSubscriptionUpdated` \- Triggered when a subscription is updated
- `onSubscriptionActive` \- Triggered when a subscription becomes active
- `onSubscriptionCanceled` \- Triggered when a subscription is canceled
- `onSubscriptionRevoked` \- Triggered when a subscription is revoked
- `onSubscriptionUncanceled` \- Triggered when a subscription cancellation is reversed
- `onProductCreated` \- Triggered when a product is created
- `onProductUpdated` \- Triggered when a product is updated
- `onOrganizationUpdated` \- Triggered when an organization is updated
- `onBenefitCreated` \- Triggered when a benefit is created
- `onBenefitUpdated` \- Triggered when a benefit is updated
- `onBenefitGrantCreated` \- Triggered when a benefit grant is created
- `onBenefitGrantUpdated` \- Triggered when a benefit grant is updated
- `onBenefitGrantRevoked` \- Triggered when a benefit grant is revoked
- `onCustomerCreated` \- Triggered when a customer is created
- `onCustomerUpdated` \- Triggered when a customer is updated
- `onCustomerDeleted` \- Triggered when a customer is deleted
- `onCustomerStateChanged` \- Triggered when a customer is created

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/plugins/polar.mdx)

[Previous Page\\
\\
Stripe](https://www.better-auth.com/docs/plugins/stripe) [Next Page\\
\\
Autumn Billing](https://www.better-auth.com/docs/plugins/autumn)

### On this page

[Features](https://www.better-auth.com/docs/plugins/polar#features) [Installation](https://www.better-auth.com/docs/plugins/polar#installation) [Preparation](https://www.better-auth.com/docs/plugins/polar#preparation) [Configuring BetterAuth Server](https://www.better-auth.com/docs/plugins/polar#configuring-betterauth-server) [Configuring BetterAuth Client](https://www.better-auth.com/docs/plugins/polar#configuring-betterauth-client) [Configuration Options](https://www.better-auth.com/docs/plugins/polar#configuration-options) [Required Options](https://www.better-auth.com/docs/plugins/polar#required-options) [Optional Options](https://www.better-auth.com/docs/plugins/polar#optional-options) [Customers](https://www.better-auth.com/docs/plugins/polar#customers) [Checkout Plugin](https://www.better-auth.com/docs/plugins/polar#checkout-plugin) [Organization Support](https://www.better-auth.com/docs/plugins/polar#organization-support) [Portal Plugin](https://www.better-auth.com/docs/plugins/polar#portal-plugin) [Customer Portal Management](https://www.better-auth.com/docs/plugins/polar#customer-portal-management) [Customer State](https://www.better-auth.com/docs/plugins/polar#customer-state) [Benefits, Orders & Subscriptions](https://www.better-auth.com/docs/plugins/polar#benefits-orders--subscriptions) [Benefits](https://www.better-auth.com/docs/plugins/polar#benefits) [Orders](https://www.better-auth.com/docs/plugins/polar#orders) [Subscriptions](https://www.better-auth.com/docs/plugins/polar#subscriptions) [Usage Plugin](https://www.better-auth.com/docs/plugins/polar#usage-plugin) [Event Ingestion](https://www.better-auth.com/docs/plugins/polar#event-ingestion) [Customer Meters](https://www.better-auth.com/docs/plugins/polar#customer-meters) [Webhooks Plugin](https://www.better-auth.com/docs/plugins/polar#webhooks-plugin)