---
title: Autumn Billing | Better Auth
url:
description: Better Auth Plugin for Autumn Billing
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

# Autumn Billing

Copy MarkdownOpen in

[Autumn](https://useautumn.com/) is open source infrastructure to run SaaS pricing plans. It sits between your app and Stripe, and acts as the database for your customers' subscription status, usage metering and feature permissions.

[**Get help on Autumn's Discord** \\
\\
We're online to help you with any questions you have.](https://discord.gg/STqxY92zuS)

## [Features](https://www.better-auth.com/docs/plugins/autumn#features)

- One function for all checkout, subscription and payment flows
- No webhooks required: query Autumn for the data you need
- Manages your application's free and paid plans
- Usage tracking for usage billing and periodic limits
- Custom plans and pricing changes through Autumn's dashboard

### [Setup Autumn Account](https://www.better-auth.com/docs/plugins/autumn#setup-autumn-account)

First, create your pricing plans in Autumn's [dashboard](https://app.useautumn.com/), where you define what each plan and product gets access to and how it should be billed. In this example, we're handling the free and pro plans for an AI chatbot, which comes with a number of `messages` per month.

### [Install Autumn SDK](https://www.better-auth.com/docs/plugins/autumn#install-autumn-sdk)

npm

bun

yarn

bun

```
npm install autumn-js
```

If you're using a separate client and server setup, make sure to install the plugin in both parts of your project.

### [Add `AUTUMN_SECRET_KEY` to your environment variables](https://www.better-auth.com/docs/plugins/autumn#add-autumn_secret_key-to-your-environment-variables)

You can find it in Autumn's dashboard under " [Developer](https://app.useautumn.com/sandbox/onboarding)".

.env

```
AUTUMN_SECRET_KEY=am_sk_xxxxxxxxxx
```

### [Add the Autumn plugin to your `auth` config](https://www.better-auth.com/docs/plugins/autumn#add-the-autumn-plugin-to-your-auth-config)

auth.ts

```
import { autumn } from "autumn-js/better-auth";

export const auth = betterAuth({
  // ...
  plugins: [autumn()],
});
```

Autumn will auto-create your customers when they sign up, and assign them any
default plans you created (eg your Free plan)

### [Add `<AutumnProvider />`](https://www.better-auth.com/docs/plugins/autumn#add-autumnprovider-)

Client side, wrap your application with the AutumnProvider component, and pass in the `baseUrl` that you define within better-auth's `authClient`.

app/layout.tsx

```
import { AutumnProvider } from "autumn-js/react";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html>
      <body>
        {/* or meta.env.BETTER_AUTH_URL for vite */}
        <AutumnProvider betterAuthUrl={process.env.NEXT_PUBLIC_BETTER_AUTH_URL}>
          {children}
        </AutumnProvider>
      </body>
    </html>
  );
}
```

## [Usage](https://www.better-auth.com/docs/plugins/autumn#usage)

### [Handle payments](https://www.better-auth.com/docs/plugins/autumn#handle-payments)

Call `attach` to redirect the customer to a Stripe checkout page when they want to purchase the Pro plan.

If their payment method is already on file, `AttachDialog` will open instead to let the customer confirm their new subscription or purchase, and handle the payment.

Make sure you've pasted in your [Stripe test secret\\
key](https://dashboard.stripe.com/test/apikeys) in the [Autumn\\
dashboard](https://app.useautumn.com/integrations/stripe).

```
import { useCustomer, AttachDialog } from "autumn-js/react";

export default function PurchaseButton() {
  const { attach } = useCustomer();

  return (
    <button
      onClick={async () => {
        await attach({
          productId: "pro",
          dialog: AttachDialog,
        });
      }}
    >
      Upgrade to Pro
    </button>
  );
}
```

The AttachDialog component can be used directly from the `autumn-js/react`
library (as shown in the example above), or downloaded as a [shadcn/ui component](https://docs.useautumn.com/quickstart/shadcn) to customize.

### [Integrate Pricing Logic](https://www.better-auth.com/docs/plugins/autumn#integrate-pricing-logic)

Integrate your client and server pricing tiers logic with the following functions:

- `check` to see if the customer is `allowed` to send a message.
- `track` a usage event in Autumn (typically done server-side)
- `customer` to display any relevant billing data in your UI (subscriptions, feature balances)

Server-side, you can access Autumn's functions through the `auth` object.

ClientServer

```
import { useCustomer } from "autumn-js/react";

export default function SendChatMessage() {
  const { customer, allowed, refetch } = useCustomer();

  return (
    <>
      <button
        onClick={async () => {
          if (allowed({ featureId: "messages" })) {
            //... send chatbot message server-side, then
            await refetch(); // refetch customer usage data
            alert(
              "Remaining messages: " + customer?.features.messages?.balance
            );
          } else {
            alert("You're out of messages");
          }
        }}
      >
        Send Message
      </button>
    </>
  );
}
```

```
import { auth } from "@/lib/auth";

// check on the backend if the customer can send a message
const { allowed } = await auth.api.check({
  headers: await headers(), // pass the request headers
  body: {
    feature_id: "messages",
  },
});

// server-side function to send the message

// then track the usage
await auth.api.track({
  headers: await headers(),
  body: {
    feature_id: "messages",
    value: 2,
  },
});
```

### [Additional Functions](https://www.better-auth.com/docs/plugins/autumn#additional-functions)

#### [openBillingPortal()](https://www.better-auth.com/docs/plugins/autumn#openbillingportal)

Opens a billing portal where the customer can update their payment method or cancel their plan.

```
import { useCustomer } from "autumn-js/react";

export default function BillingSettings() {
  const { openBillingPortal } = useCustomer();

  return (
    <button
      onClick={async () => {
        await openBillingPortal({
          returnUrl: "/settings/billing",
        });
      }}
    >
      Manage Billing
    </button>
  );
}
```

#### [cancel()](https://www.better-auth.com/docs/plugins/autumn#cancel)

Cancel a product or subscription.

```
import { useCustomer } from "autumn-js/react";

export default function CancelSubscription() {
  const { cancel } = useCustomer();

  return (
    <button
      onClick={async () => {
        await cancel({ productId: "pro" });
      }}
    >
      Cancel Subscription
    </button>
  );
}
```

#### [Get invoice history](https://www.better-auth.com/docs/plugins/autumn#get-invoice-history)

Pass in an `expand` param into `useCustomer` to get additional information. You can expand `invoices`, `trials_used`, `payment_method`, or `rewards`.

```
import { useCustomer } from "autumn-js/react";

export default function CustomerProfile() {
  const { customer } = useCustomer({ expand: ["invoices"] });

  return (
    <div>
      <h2>Customer Profile</h2>
      <p>Name: {customer?.name}</p>
      <p>Email: {customer?.email}</p>
      <p>Balance: {customer?.features.chat_messages?.balance}</p>
    </div>
  );
}
```

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/plugins/autumn.mdx)

[Previous Page\\
\\
Polar](https://www.better-auth.com/docs/plugins/polar) [Next Page\\
\\
Dodo Payments](https://www.better-auth.com/docs/plugins/dodopayments)

### On this page

[Features](https://www.better-auth.com/docs/plugins/autumn#features) [Setup Autumn Account](https://www.better-auth.com/docs/plugins/autumn#setup-autumn-account) [Install Autumn SDK](https://www.better-auth.com/docs/plugins/autumn#install-autumn-sdk) [Add `AUTUMN_SECRET_KEY` to your environment variables](https://www.better-auth.com/docs/plugins/autumn#add-autumn_secret_key-to-your-environment-variables) [Add the Autumn plugin to your `auth` config](https://www.better-auth.com/docs/plugins/autumn#add-the-autumn-plugin-to-your-auth-config) [Add `<AutumnProvider />`](https://www.better-auth.com/docs/plugins/autumn#add-autumnprovider-) [Usage](https://www.better-auth.com/docs/plugins/autumn#usage) [Handle payments](https://www.better-auth.com/docs/plugins/autumn#handle-payments) [Integrate Pricing Logic](https://www.better-auth.com/docs/plugins/autumn#integrate-pricing-logic) [Additional Functions](https://www.better-auth.com/docs/plugins/autumn#additional-functions) [openBillingPortal()](https://www.better-auth.com/docs/plugins/autumn#openbillingportal) [cancel()](https://www.better-auth.com/docs/plugins/autumn#cancel) [Get invoice history](https://www.better-auth.com/docs/plugins/autumn#get-invoice-history)
