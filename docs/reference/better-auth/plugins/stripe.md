---
title: Stripe | Better Auth
url:
description: Stripe plugin for Better Auth to manage subscriptions and payments.
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

# Stripe

Copy MarkdownOpen in

The Stripe plugin integrates Stripe's payment and subscription functionality with Better Auth. Since payment and authentication are often tightly coupled, this plugin simplifies the integration of Stripe into your application, handling customer creation, subscription management, and webhook processing.

## [Features](https://www.better-auth.com/docs/plugins/stripe#features)

- Create Stripe Customers automatically when users sign up
- Manage subscription plans and pricing
- Process subscription lifecycle events (creation, updates, cancellations)
- Handle Stripe webhooks securely with signature verification
- Expose subscription data to your application
- Support for trial periods and subscription upgrades
- **Automatic trial abuse prevention** \- Users can only get one trial per account across all plans
- Flexible reference system to associate subscriptions with users or organizations
- Team subscription support with seats management

## [Installation](https://www.better-auth.com/docs/plugins/stripe#installation)

### [Install the plugin](https://www.better-auth.com/docs/plugins/stripe#install-the-plugin)

First, install the plugin:

npm

bun

yarn

bun

```
npm install @better-auth/stripe
```

If you're using a separate client and server setup, make sure to install the plugin in both parts of your project.

### [Install the Stripe SDK](https://www.better-auth.com/docs/plugins/stripe#install-the-stripe-sdk)

Next, install the Stripe SDK on your server:

npm

bun

yarn

bun

```
npm install stripe@^18.0.0
```

### [Add the plugin to your auth config](https://www.better-auth.com/docs/plugins/stripe#add-the-plugin-to-your-auth-config)

auth.ts

```
import { betterAuth } from "better-auth"
import { stripe } from "@better-auth/stripe"
import Stripe from "stripe"

const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2025-02-24.acacia",
})

export const auth = betterAuth({
    // ... your existing config
    plugins: [\
        stripe({\
            stripeClient,\
            stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,\
            createCustomerOnSignUp: true,\
        })\
    ]
})
```

### [Add the client plugin](https://www.better-auth.com/docs/plugins/stripe#add-the-client-plugin)

auth-client.ts

```
import { createAuthClient } from "better-auth/client"
import { stripeClient } from "@better-auth/stripe/client"

export const client = createAuthClient({
    // ... your existing config
    plugins: [\
        stripeClient({\
            subscription: true //if you want to enable subscription management\
        })\
    ]
})
```

### [Migrate the database](https://www.better-auth.com/docs/plugins/stripe#migrate-the-database)

Run the migration or generate the schema to add the necessary tables to the database.

migrategenerate

```
npx @better-auth/cli migrate
```

```
npx @better-auth/cli generate
```

See the [Schema](https://www.better-auth.com/docs/plugins/stripe#schema) section to add the tables manually.

### [Set up Stripe webhooks](https://www.better-auth.com/docs/plugins/stripe#set-up-stripe-webhooks)

Create a webhook endpoint in your Stripe dashboard pointing to:

```
https://your-domain.com/api/auth/stripe/webhook
```

`/api/auth` is the default path for the auth server.

Make sure to select at least these events:

- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Save the webhook signing secret provided by Stripe and add it to your environment variables as `STRIPE_WEBHOOK_SECRET`.

## [Usage](https://www.better-auth.com/docs/plugins/stripe#usage)

### [Customer Management](https://www.better-auth.com/docs/plugins/stripe#customer-management)

You can use this plugin solely for customer management without enabling subscriptions. This is useful if you just want to link Stripe customers to your users.

By default, when a user signs up, a Stripe customer is automatically created if you set `createCustomerOnSignUp: true`. This customer is linked to the user in your database.
You can customize the customer creation process:

auth.ts

```
stripe({
    // ... other options
    createCustomerOnSignUp: true,
    onCustomerCreate: async ({ customer, stripeCustomer, user }, request) => {
        // Do something with the newly created customer
        console.log(`Customer ${customer.id} created for user ${user.id}`);
    },
    getCustomerCreateParams: async ({ user, session }, request) => {
        // Customize the Stripe customer creation parameters
        return {
            metadata: {
                referralSource: user.metadata?.referralSource
            }
        };
    }
})
```

### [Subscription Management](https://www.better-auth.com/docs/plugins/stripe#subscription-management)

#### [Defining Plans](https://www.better-auth.com/docs/plugins/stripe#defining-plans)

You can define your subscription plans either statically or dynamically:

auth.ts

```
// Static plans
subscription: {
    enabled: true,
    plans: [\
        {\
            name: "basic", // the name of the plan, it'll be automatically lower cased when stored in the database\
            priceId: "price_1234567890", // the price ID from stripe\
            annualDiscountPriceId: "price_1234567890", // (optional) the price ID for annual billing with a discount\
            limits: {\
                projects: 5,\
                storage: 10\
            }\
        },\
        {\
            name: "pro",\
            priceId: "price_0987654321",\
            limits: {\
                projects: 20,\
                storage: 50\
            },\
            freeTrial: {\
                days: 14,\
            }\
        }\
    ]
}

// Dynamic plans (fetched from database or API)
subscription: {
    enabled: true,
    plans: async () => {
        const plans = await db.query("SELECT * FROM plans");
        return plans.map(plan => ({
            name: plan.name,
            priceId: plan.stripe_price_id,
            limits: JSON.parse(plan.limits)
        }));
    }
}
```

see [plan configuration](https://www.better-auth.com/docs/plugins/stripe#plan-configuration) for more.

#### [Creating a Subscription](https://www.better-auth.com/docs/plugins/stripe#creating-a-subscription)

To create a subscription, use the `subscription.upgrade` method:

ClientServer

POST

/subscription/upgrade

```
const { data, error } = await authClient.subscription.upgrade({
    plan: "pro", // required
    annual: true,
    referenceId: "123",
    subscriptionId: "sub_123",
    metadata,
    seats: 1,
    successUrl, // required
    cancelUrl, // required
    returnUrl,
    disableRedirect: true, // required
});
```

| Prop              | Description                                                                                      | Type                  |
| ----------------- | ------------------------------------------------------------------------------------------------ | --------------------- |
| `plan`            | The name of the plan to upgrade to.                                                              | `string`              |
| `annual?`         | Whether to upgrade to an annual plan.                                                            | `boolean`             |
| `referenceId?`    | Reference id of the subscription to upgrade.                                                     | `string`              |
| `subscriptionId?` | The id of the subscription to upgrade.                                                           | `string`              |
| `metadata?`       |                                                                                                  | `Record<string, any>` |
| `seats?`          | Number of seats to upgrade to (if applicable).                                                   | `number`              |
| `successUrl`      | Callback URL to redirect back after successful subscription.                                     | `string`              |
| `cancelUrl`       | If set, checkout shows a back button and customers will be directed here if they cancel payment. | `string`              |
| `returnUrl?`      | URL to take customers to when they click on the billing portal’s link to return to your website. | `string`              |
| `disableRedirect` | Disable redirect after successful subscription.                                                  | `boolean`             |

POST

/subscription/upgrade

```
const data = await auth.api.upgradeSubscription({
    body: {
        plan: "pro", // required
        annual: true,
        referenceId: "123",
        subscriptionId: "sub_123",
        metadata,
        seats: 1,
        successUrl, // required
        cancelUrl, // required
        returnUrl,
        disableRedirect: true, // required
    },
    // This endpoint requires session cookies.
    headers: await headers(),
});
```

| Prop              | Description                                                                                      | Type                  |
| ----------------- | ------------------------------------------------------------------------------------------------ | --------------------- |
| `plan`            | The name of the plan to upgrade to.                                                              | `string`              |
| `annual?`         | Whether to upgrade to an annual plan.                                                            | `boolean`             |
| `referenceId?`    | Reference id of the subscription to upgrade.                                                     | `string`              |
| `subscriptionId?` | The id of the subscription to upgrade.                                                           | `string`              |
| `metadata?`       |                                                                                                  | `Record<string, any>` |
| `seats?`          | Number of seats to upgrade to (if applicable).                                                   | `number`              |
| `successUrl`      | Callback URL to redirect back after successful subscription.                                     | `string`              |
| `cancelUrl`       | If set, checkout shows a back button and customers will be directed here if they cancel payment. | `string`              |
| `returnUrl?`      | URL to take customers to when they click on the billing portal’s link to return to your website. | `string`              |
| `disableRedirect` | Disable redirect after successful subscription.                                                  | `boolean`             |

**Simple Example:**

client.ts

```
await client.subscription.upgrade({
    plan: "pro",
    successUrl: "/dashboard",
    cancelUrl: "/pricing",
    annual: true, // Optional: upgrade to an annual plan
    referenceId: "org_123", // Optional: defaults to the current logged in user ID
    seats: 5 // Optional: for team plans
});
```

This will create a Checkout Session and redirect the user to the Stripe Checkout page.

If the user already has an active subscription, you _must_ provide the `subscriptionId` parameter. Otherwise, the user will be subscribed to (and pay for) both plans.

> **Important:** The `successUrl` parameter will be internally modified to handle race conditions between checkout completion and webhook processing. The plugin creates an intermediate redirect that ensures subscription status is properly updated before redirecting to your success page.

```
const { error } = await client.subscription.upgrade({
    plan: "pro",
    successUrl: "/dashboard",
    cancelUrl: "/pricing",
});
if(error) {
    alert(error.message);
}
```

For each reference ID (user or organization), only one active or trialing subscription is supported at a time. The plugin doesn't currently support multiple concurrent active subscriptions for the same reference ID.

#### [Switching Plans](https://www.better-auth.com/docs/plugins/stripe#switching-plans)

To switch a subscription to a different plan, use the `subscription.upgrade` method:

client.ts

```
await client.subscription.upgrade({
    plan: "pro",
    successUrl: "/dashboard",
    cancelUrl: "/pricing",
    subscriptionId: "sub_123", // the Stripe subscription ID of the user's current plan
});
```

This ensures that the user only pays for the new plan, and not both.

#### [Listing Active Subscriptions](https://www.better-auth.com/docs/plugins/stripe#listing-active-subscriptions)

To get the user's active subscriptions:

ClientServer

GET

/subscription/list

```
const { data: subscriptions, error } = await authClient.subscription.list({
    referenceId: '123',
});

// get the active subscription
const activeSubscription = subscriptions.find(
    sub => sub.status === "active" || sub.status === "trialing"
);

// Check subscription limits
const projectLimit = subscriptions?.limits?.projects || 0;
```

| Prop           | Description                               | Type     |
| -------------- | ----------------------------------------- | -------- |
| `referenceId?` | Reference id of the subscription to list. | `string` |

GET

/subscription/list

```
const subscriptions = await auth.api.listActiveSubscriptions({
    query: {
        referenceId: '123',
    },
    // This endpoint requires session cookies.
    headers: await headers(),
});

// get the active subscription
const activeSubscription = subscriptions.find(
    sub => sub.status === "active" || sub.status === "trialing"
);

// Check subscription limits
const projectLimit = subscriptions?.limits?.projects || 0;
```

| Prop           | Description                               | Type     |
| -------------- | ----------------------------------------- | -------- |
| `referenceId?` | Reference id of the subscription to list. | `string` |

#### [Canceling a Subscription](https://www.better-auth.com/docs/plugins/stripe#canceling-a-subscription)

To cancel a subscription:

ClientServer

POST

/subscription/cancel

```
const { data, error } = await authClient.subscription.cancel({
    referenceId: 'org_123',
    subscriptionId: 'sub_123',
    returnUrl: '/account', // required
});
```

| Prop              | Description                                                                                      | Type     |
| ----------------- | ------------------------------------------------------------------------------------------------ | -------- |
| `referenceId?`    | Reference id of the subscription to cancel. Defaults to the userId.                              | `string` |
| `subscriptionId?` | The id of the subscription to cancel.                                                            | `string` |
| `returnUrl`       | URL to take customers to when they click on the billing portal’s link to return to your website. | `string` |

POST

/subscription/cancel

```
const data = await auth.api.cancelSubscription({
    body: {
        referenceId: 'org_123',
        subscriptionId: 'sub_123',
        returnUrl: '/account', // required
    },
    // This endpoint requires session cookies.
    headers: await headers(),
});
```

| Prop              | Description                                                                                      | Type     |
| ----------------- | ------------------------------------------------------------------------------------------------ | -------- |
| `referenceId?`    | Reference id of the subscription to cancel. Defaults to the userId.                              | `string` |
| `subscriptionId?` | The id of the subscription to cancel.                                                            | `string` |
| `returnUrl`       | URL to take customers to when they click on the billing portal’s link to return to your website. | `string` |

This will redirect the user to the Stripe Billing Portal where they can cancel their subscription.

#### [Restoring a Canceled Subscription](https://www.better-auth.com/docs/plugins/stripe#restoring-a-canceled-subscription)

If a user changes their mind after canceling a subscription (but before the subscription period ends), you can restore the subscription:

ClientServer

POST

/subscription/restore

```
const { data, error } = await authClient.subscription.restore({
    referenceId: '123',
    subscriptionId: 'sub_123',
});
```

| Prop              | Description                                                          | Type     |
| ----------------- | -------------------------------------------------------------------- | -------- |
| `referenceId?`    | Reference id of the subscription to restore. Defaults to the userId. | `string` |
| `subscriptionId?` | The id of the subscription to restore.                               | `string` |

POST

/subscription/restore

```
const data = await auth.api.restoreSubscription({
    body: {
        referenceId: '123',
        subscriptionId: 'sub_123',
    },
    // This endpoint requires session cookies.
    headers: await headers(),
});
```

| Prop              | Description                                                          | Type     |
| ----------------- | -------------------------------------------------------------------- | -------- |
| `referenceId?`    | Reference id of the subscription to restore. Defaults to the userId. | `string` |
| `subscriptionId?` | The id of the subscription to restore.                               | `string` |

This will reactivate a subscription that was previously set to cancel at the end of the billing period ( `cancelAtPeriodEnd: true`). The subscription will continue to renew automatically.

> **Note:** This only works for subscriptions that are still active but marked to cancel at the end of the period. It cannot restore subscriptions that have already ended.

#### [Creating Billing Portal Sessions](https://www.better-auth.com/docs/plugins/stripe#creating-billing-portal-sessions)

To create a [Stripe billing portal session](https://docs.stripe.com/api/customer_portal/sessions/create) where customers can manage their subscriptions, update payment methods, and view billing history:

ClientServer

POST

/subscription/billing-portal

```
const { data, error } = await authClient.subscription.billingPortal({
    locale,
    referenceId: "123",
    returnUrl,
});
```

| Prop           | Description                                                                                                      | Type     |
| -------------- | ---------------------------------------------------------------------------------------------------------------- | -------- |
| `locale?`      | The IETF language tag of the locale customer portal is displayed in. If blank or auto, browser's locale is used. | `string` |
| `referenceId?` | Reference id of the subscription to upgrade.                                                                     | `string` |
| `returnUrl?`   | Return URL to redirect back after successful subscription.                                                       | `string` |

POST

/subscription/billing-portal

```
const data = await auth.api.createBillingPortal({
    body: {
        locale,
        referenceId: "123",
        returnUrl,
    },
    // This endpoint requires session cookies.
    headers: await headers(),
});
```

| Prop           | Description                                                                                                      | Type     |
| -------------- | ---------------------------------------------------------------------------------------------------------------- | -------- |
| `locale?`      | The IETF language tag of the locale customer portal is displayed in. If blank or auto, browser's locale is used. | `string` |
| `referenceId?` | Reference id of the subscription to upgrade.                                                                     | `string` |
| `returnUrl?`   | Return URL to redirect back after successful subscription.                                                       | `string` |

For supported locales, see the [IETF language tag documentation](https://docs.stripe.com/js/appendix/supported_locales).

This endpoint creates a Stripe billing portal session and returns a URL in the response as `data.url`. You can redirect users to this URL to allow them to manage their subscription, payment methods, and billing history.

### [Reference System](https://www.better-auth.com/docs/plugins/stripe#reference-system)

By default, subscriptions are associated with the user ID. However, you can use a custom reference ID to associate subscriptions with other entities, such as organizations:

client.ts

```
// Create a subscription for an organization
await client.subscription.upgrade({
    plan: "pro",
    referenceId: "org_123456",
    successUrl: "/dashboard",
    cancelUrl: "/pricing",
    seats: 5 // Number of seats for team plans
});

// List subscriptions for an organization
const { data: subscriptions } = await client.subscription.list({
    query: {
        referenceId: "org_123456"
    }
});
```

#### [Team Subscriptions with Seats](https://www.better-auth.com/docs/plugins/stripe#team-subscriptions-with-seats)

For team or organization plans, you can specify the number of seats:

```
await client.subscription.upgrade({
    plan: "team",
    referenceId: "org_123456",
    seats: 10, // 10 team members
    successUrl: "/org/billing/success",
    cancelUrl: "/org/billing"
});
```

The `seats` parameter is passed to Stripe as the quantity for the subscription item. You can use this value in your application logic to limit the number of members in a team or organization.

To authorize reference IDs, implement the `authorizeReference` function:

auth.ts

```
subscription: {
    // ... other options
    authorizeReference: async ({ user, session, referenceId, action }) => {
        // Check if the user has permission to manage subscriptions for this reference
        if (action === "upgrade-subscription" || action === "cancel-subscription" || action === "restore-subscription") {
            const org = await db.member.findFirst({
                where: {
                    organizationId: referenceId,
                    userId: user.id
                }
            });
            return org?.role === "owner"
        }
        return true;
    }
}
```

### [Webhook Handling](https://www.better-auth.com/docs/plugins/stripe#webhook-handling)

The plugin automatically handles common webhook events:

- `checkout.session.completed`: Updates subscription status after checkout
- `customer.subscription.updated`: Updates subscription details when changed
- `customer.subscription.deleted`: Marks subscription as canceled

You can also handle custom events:

auth.ts

```
stripe({
    // ... other options
    onEvent: async (event) => {
        // Handle any Stripe event
        switch (event.type) {
            case "invoice.paid":
                // Handle paid invoice
                break;
            case "payment_intent.succeeded":
                // Handle successful payment
                break;
        }
    }
})
```

### [Subscription Lifecycle Hooks](https://www.better-auth.com/docs/plugins/stripe#subscription-lifecycle-hooks)

You can hook into various subscription lifecycle events:

auth.ts

```
subscription: {
    // ... other options
    onSubscriptionComplete: async ({ event, subscription, stripeSubscription, plan }) => {
        // Called when a subscription is successfully created
        await sendWelcomeEmail(subscription.referenceId, plan.name);
    },
    onSubscriptionUpdate: async ({ event, subscription }) => {
        // Called when a subscription is updated
        console.log(`Subscription ${subscription.id} updated`);
    },
    onSubscriptionCancel: async ({ event, subscription, stripeSubscription, cancellationDetails }) => {
        // Called when a subscription is canceled
        await sendCancellationEmail(subscription.referenceId);
    },
    onSubscriptionDeleted: async ({ event, subscription, stripeSubscription }) => {
        // Called when a subscription is deleted
        console.log(`Subscription ${subscription.id} deleted`);
    }
}
```

### [Trial Periods](https://www.better-auth.com/docs/plugins/stripe#trial-periods)

You can configure trial periods for your plans:

auth.ts

```
{
    name: "pro",
    priceId: "price_0987654321",
    freeTrial: {
        days: 14,
        onTrialStart: async (subscription) => {
            // Called when a trial starts
            await sendTrialStartEmail(subscription.referenceId);
        },
        onTrialEnd: async ({ subscription, user }, request) => {
            // Called when a trial ends
            await sendTrialEndEmail(user.email);
        },
        onTrialExpired: async (subscription) => {
            // Called when a trial expires without conversion
            await sendTrialExpiredEmail(subscription.referenceId);
        }
    }
}
```

## [Schema](https://www.better-auth.com/docs/plugins/stripe#schema)

The Stripe plugin adds the following tables to your database:

### [User](https://www.better-auth.com/docs/plugins/stripe#user)

Table Name: `user`

| Field Name       | Type   | Key | Description            |
| ---------------- | ------ | --- | ---------------------- |
| stripeCustomerId | string | ?   | The Stripe customer ID |

### [Subscription](https://www.better-auth.com/docs/plugins/stripe#subscription)

Table Name: `subscription`

| Field Name           | Type    | Key | Description                                                        |
| -------------------- | ------- | --- | ------------------------------------------------------------------ |
| id                   | string  | PK  | Unique identifier for each subscription                            |
| plan                 | string  | -   | The name of the subscription plan                                  |
| referenceId          | string  | -   | The ID this subscription is associated with (user ID by default)   |
| stripeCustomerId     | string  | ?   | The Stripe customer ID                                             |
| stripeSubscriptionId | string  | ?   | The Stripe subscription ID                                         |
| status               | string  | -   | The status of the subscription (active, canceled, etc.)            |
| periodStart          | Date    | ?   | Start date of the current billing period                           |
| periodEnd            | Date    | ?   | End date of the current billing period                             |
| cancelAtPeriodEnd    | boolean | ?   | Whether the subscription will be canceled at the end of the period |
| seats                | number  | ?   | Number of seats for team plans                                     |
| trialStart           | Date    | ?   | Start date of the trial period                                     |
| trialEnd             | Date    | ?   | End date of the trial period                                       |

### [Customizing the Schema](https://www.better-auth.com/docs/plugins/stripe#customizing-the-schema)

To change the schema table names or fields, you can pass a `schema` option to the Stripe plugin:

auth.ts

```
stripe({
    // ... other options
    schema: {
        subscription: {
            modelName: "stripeSubscriptions", // map the subscription table to stripeSubscriptions
            fields: {
                plan: "planName" // map the plan field to planName
            }
        }
    }
})
```

## [Options](https://www.better-auth.com/docs/plugins/stripe#options)

### [Main Options](https://www.better-auth.com/docs/plugins/stripe#main-options)

**stripeClient**: `Stripe` \- The Stripe client instance. Required.

**stripeWebhookSecret**: `string` \- The webhook signing secret from Stripe. Required.

**createCustomerOnSignUp**: `boolean` \- Whether to automatically create a Stripe customer when a user signs up. Default: `false`.

**onCustomerCreate**: `(data: { customer: Customer, stripeCustomer: Stripe.Customer, user: User }, request?: Request) => Promise<void>` \- A function called after a customer is created.

**getCustomerCreateParams**: `(data: { user: User, session: Session }, request?: Request) => Promise<{}>` \- A function to customize the Stripe customer creation parameters.

**onEvent**: `(event: Stripe.Event) => Promise<void>` \- A function called for any Stripe webhook event.

### [Subscription Options](https://www.better-auth.com/docs/plugins/stripe#subscription-options)

**enabled**: `boolean` \- Whether to enable subscription functionality. Required.

**plans**: `Plan[] | (() => Promise<Plan[]>)` \- An array of subscription plans or a function that returns plans. Required if subscriptions are enabled.

**requireEmailVerification**: `boolean` \- Whether to require email verification before allowing subscription upgrades. Default: `false`.

**authorizeReference**: `(data: { user: User, session: Session, referenceId: string, action: "upgrade-subscription" | "list-subscription" | "cancel-subscription" | "restore-subscription"}, request?: Request) => Promise<boolean>` \- A function to authorize reference IDs.

### [Plan Configuration](https://www.better-auth.com/docs/plugins/stripe#plan-configuration)

Each plan can have the following properties:

**name**: `string` \- The name of the plan. Required.

**priceId**: `string` \- The Stripe price ID. Required unless using `lookupKey`.

**lookupKey**: `string` \- The Stripe price lookup key. Alternative to `priceId`.

**annualDiscountPriceId**: `string` \- A price ID for annual billing.

**annualDiscountLookupKey**: `string` \- The Stripe price lookup key for annual billing. Alternative to `annualDiscountPriceId`.

**limits**: `Record<string, number>` \- Limits associated with the plan (e.g., `{ projects: 10, storage: 5 }`).

**group**: `string` \- A group name for the plan, useful for categorizing plans.

**freeTrial**: Object containing trial configuration:

- **days**: `number` \- Number of trial days.
- **onTrialStart**: `(subscription: Subscription) => Promise<void>` \- Called when a trial starts.
- **onTrialEnd**: `(data: { subscription: Subscription, user: User }, request?: Request) => Promise<void>` \- Called when a trial ends.
- **onTrialExpired**: `(subscription: Subscription) => Promise<void>` \- Called when a trial expires without conversion.

## [Advanced Usage](https://www.better-auth.com/docs/plugins/stripe#advanced-usage)

### [Using with Organizations](https://www.better-auth.com/docs/plugins/stripe#using-with-organizations)

The Stripe plugin works well with the organization plugin. You can associate subscriptions with organizations instead of individual users:

client.ts

```
// Get the active organization
const { data: activeOrg } = client.useActiveOrganization();

// Create a subscription for the organization
await client.subscription.upgrade({
    plan: "team",
    referenceId: activeOrg.id,
    seats: 10,
    annual: true, // upgrade to an annual plan (optional)
    successUrl: "/org/billing/success",
    cancelUrl: "/org/billing"
});
```

Make sure to implement the `authorizeReference` function to verify that the user has permission to manage subscriptions for the organization:

auth.ts

```
authorizeReference: async ({ user, referenceId, action }) => {
    const member = await db.members.findFirst({
        where: {
            userId: user.id,
            organizationId: referenceId
        }
    });

    return member?.role === "owner" || member?.role === "admin";
}
```

### [Custom Checkout Session Parameters](https://www.better-auth.com/docs/plugins/stripe#custom-checkout-session-parameters)

You can customize the Stripe Checkout session with additional parameters:

auth.ts

```
getCheckoutSessionParams: async ({ user, session, plan, subscription }, request) => {
    return {
        params: {
            allow_promotion_codes: true,
            tax_id_collection: {
                enabled: true
            },
            billing_address_collection: "required",
            custom_text: {
                submit: {
                    message: "We'll start your subscription right away"
                }
            },
            metadata: {
                planType: "business",
                referralCode: user.metadata?.referralCode
            }
        },
        options: {
            idempotencyKey: `sub_${user.id}_${plan.name}_${Date.now()}`
        }
    };
}
```

### [Tax Collection](https://www.better-auth.com/docs/plugins/stripe#tax-collection)

To collect tax IDs from the customer, set `tax_id_collection` to true:

auth.ts

```
subscription: {
    // ... other options
    getCheckoutSessionParams: async ({ user, session, plan, subscription }, request) => {
        return {
            params: {
                tax_id_collection: {
                    enabled: true
                }
            }
        };
    }
}
```

### [Automatic Tax Calculation](https://www.better-auth.com/docs/plugins/stripe#automatic-tax-calculation)

To enable automatic tax calculation using the customer's location, set `automatic_tax` to true. Enabling this parameter causes Checkout to collect any billing address information necessary for tax calculation. You need to have tax registration setup and configured in the Stripe dashboard first for this to work.

auth.ts

```
subscription: {
    // ... other options
    getCheckoutSessionParams: async ({ user, session, plan, subscription }, request) => {
        return {
            params: {
                automatic_tax: {
                    enabled: true
                }
            }
        };
    }
}
```

### [Trial Period Management](https://www.better-auth.com/docs/plugins/stripe#trial-period-management)

The Stripe plugin automatically prevents users from getting multiple free trials. Once a user has used a trial period (regardless of which plan), they will not be eligible for additional trials on any plan.

**How it works:**

- The system tracks trial usage across all plans for each user
- When a user subscribes to a plan with a trial, the system checks their subscription history
- If the user has ever had a trial (indicated by `trialStart`/ `trialEnd` fields or `trialing` status), no new trial will be offered
- This prevents abuse where users cancel subscriptions and resubscribe to get multiple free trials

**Example scenario:**

1. User subscribes to "Starter" plan with 7-day trial
2. User cancels the subscription after the trial
3. User tries to subscribe to "Premium" plan - no trial will be offered
4. User will be charged immediately for the Premium plan

This behavior is automatic and requires no additional configuration. The trial eligibility is determined at the time of subscription creation and cannot be overridden through configuration.

## [Troubleshooting](https://www.better-auth.com/docs/plugins/stripe#troubleshooting)

### [Webhook Issues](https://www.better-auth.com/docs/plugins/stripe#webhook-issues)

If webhooks aren't being processed correctly:

1. Check that your webhook URL is correctly configured in the Stripe dashboard
2. Verify that the webhook signing secret is correct
3. Ensure you've selected all the necessary events in the Stripe dashboard
4. Check your server logs for any errors during webhook processing

### [Subscription Status Issues](https://www.better-auth.com/docs/plugins/stripe#subscription-status-issues)

If subscription statuses aren't updating correctly:

1. Make sure the webhook events are being received and processed
2. Check that the `stripeCustomerId` and `stripeSubscriptionId` fields are correctly populated
3. Verify that the reference IDs match between your application and Stripe

### [Testing Webhooks Locally](https://www.better-auth.com/docs/plugins/stripe#testing-webhooks-locally)

For local development, you can use the Stripe CLI to forward webhooks to your local environment:

```
stripe listen --forward-to localhost:3000/api/auth/stripe/webhook
```

This will provide you with a webhook signing secret that you can use in your local environment.

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/plugins/stripe.mdx)

[Previous Page\\
\\
3rd party](https://www.better-auth.com/docs/plugins/stripe) [Next Page\\
\\
Polar](https://www.better-auth.com/docs/plugins/polar)

### On this page

[Features](https://www.better-auth.com/docs/plugins/stripe#features) [Installation](https://www.better-auth.com/docs/plugins/stripe#installation) [Install the plugin](https://www.better-auth.com/docs/plugins/stripe#install-the-plugin) [Install the Stripe SDK](https://www.better-auth.com/docs/plugins/stripe#install-the-stripe-sdk) [Add the plugin to your auth config](https://www.better-auth.com/docs/plugins/stripe#add-the-plugin-to-your-auth-config) [Add the client plugin](https://www.better-auth.com/docs/plugins/stripe#add-the-client-plugin) [Migrate the database](https://www.better-auth.com/docs/plugins/stripe#migrate-the-database) [Set up Stripe webhooks](https://www.better-auth.com/docs/plugins/stripe#set-up-stripe-webhooks) [Usage](https://www.better-auth.com/docs/plugins/stripe#usage) [Customer Management](https://www.better-auth.com/docs/plugins/stripe#customer-management) [Subscription Management](https://www.better-auth.com/docs/plugins/stripe#subscription-management) [Defining Plans](https://www.better-auth.com/docs/plugins/stripe#defining-plans) [Creating a Subscription](https://www.better-auth.com/docs/plugins/stripe#creating-a-subscription) [Switching Plans](https://www.better-auth.com/docs/plugins/stripe#switching-plans) [Listing Active Subscriptions](https://www.better-auth.com/docs/plugins/stripe#listing-active-subscriptions) [Canceling a Subscription](https://www.better-auth.com/docs/plugins/stripe#canceling-a-subscription) [Restoring a Canceled Subscription](https://www.better-auth.com/docs/plugins/stripe#restoring-a-canceled-subscription) [Creating Billing Portal Sessions](https://www.better-auth.com/docs/plugins/stripe#creating-billing-portal-sessions) [Reference System](https://www.better-auth.com/docs/plugins/stripe#reference-system) [Team Subscriptions with Seats](https://www.better-auth.com/docs/plugins/stripe#team-subscriptions-with-seats) [Webhook Handling](https://www.better-auth.com/docs/plugins/stripe#webhook-handling) [Subscription Lifecycle Hooks](https://www.better-auth.com/docs/plugins/stripe#subscription-lifecycle-hooks) [Trial Periods](https://www.better-auth.com/docs/plugins/stripe#trial-periods) [Schema](https://www.better-auth.com/docs/plugins/stripe#schema) [User](https://www.better-auth.com/docs/plugins/stripe#user) [Subscription](https://www.better-auth.com/docs/plugins/stripe#subscription) [Customizing the Schema](https://www.better-auth.com/docs/plugins/stripe#customizing-the-schema) [Options](https://www.better-auth.com/docs/plugins/stripe#options) [Main Options](https://www.better-auth.com/docs/plugins/stripe#main-options) [Subscription Options](https://www.better-auth.com/docs/plugins/stripe#subscription-options) [Plan Configuration](https://www.better-auth.com/docs/plugins/stripe#plan-configuration) [Advanced Usage](https://www.better-auth.com/docs/plugins/stripe#advanced-usage) [Using with Organizations](https://www.better-auth.com/docs/plugins/stripe#using-with-organizations) [Custom Checkout Session Parameters](https://www.better-auth.com/docs/plugins/stripe#custom-checkout-session-parameters) [Tax Collection](https://www.better-auth.com/docs/plugins/stripe#tax-collection) [Automatic Tax Calculation](https://www.better-auth.com/docs/plugins/stripe#automatic-tax-calculation) [Trial Period Management](https://www.better-auth.com/docs/plugins/stripe#trial-period-management) [Troubleshooting](https://www.better-auth.com/docs/plugins/stripe#troubleshooting) [Webhook Issues](https://www.better-auth.com/docs/plugins/stripe#webhook-issues) [Subscription Status Issues](https://www.better-auth.com/docs/plugins/stripe#subscription-status-issues) [Testing Webhooks Locally](https://www.better-auth.com/docs/plugins/stripe#testing-webhooks-locally)
