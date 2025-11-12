---
title: Organization | Better Auth
url: 
description: The organization plugin allows you to manage your organization's members and teams.
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

# Organization

Copy MarkdownOpen in

Organizations simplifies user access and permissions management. Assign roles and permissions to streamline project management, team coordination, and partnerships.

## [Installation](https://www.better-auth.com/docs/plugins/organization\#installation)

### [Add the plugin to your **auth** config](https://www.better-auth.com/docs/plugins/organization\#add-the-plugin-to-your-auth-config)

auth.ts

```
import { betterAuth } from "better-auth"
import { organization } from "better-auth/plugins"

export const auth = betterAuth({
    plugins: [\
        organization()\
    ]
})
```

### [Migrate the database](https://www.better-auth.com/docs/plugins/organization\#migrate-the-database)

Run the migration or generate the schema to add the necessary fields and tables to the database.

migrategenerate

```
npx @better-auth/cli migrate
```

```
npx @better-auth/cli generate
```

See the [Schema](https://www.better-auth.com/docs/plugins/organization#schema) section to add the fields manually.

### [Add the client plugin](https://www.better-auth.com/docs/plugins/organization\#add-the-client-plugin)

auth-client.ts

```
import { createAuthClient } from "better-auth/client"
import { organizationClient } from "better-auth/client/plugins"

export const authClient = createAuthClient({
    plugins: [\
        organizationClient()\
    ]
})
```

## [Usage](https://www.better-auth.com/docs/plugins/organization\#usage)

Once you've installed the plugin, you can start using the organization plugin to manage your organization's members and teams. The client plugin will provide you with methods under the `organization` namespace, and the server `api` will provide you with the necessary endpoints to manage your organization and give you an easier way to call the functions on your own backend.

## [Organization](https://www.better-auth.com/docs/plugins/organization\#organization)

### [Create an organization](https://www.better-auth.com/docs/plugins/organization\#create-an-organization)

ClientServer

POST

/organization/create

```
const metadata = { someKey: "someValue" };const { data, error } = await authClient.organization.create({    name: "My Organization", // required    slug: "my-org", // required    logo: "https://example.com/logo.png",    metadata,    keepCurrentActiveOrganization: false,});
```

| Prop | Description | Type |
| --- | --- | --- |
| `name` | The organization name. | `string` |
| `slug` | The organization slug. | `string` |
| `logo?` | The organization logo. | `string` |
| `metadata?` | The metadata of the organization. | `Record<string, any>` |
| `keepCurrentActiveOrganization?` | Whether to keep the current active organization active after creating a new one. | `boolean` |

POST

/organization/create

```
const metadata = { someKey: "someValue" };const data = await auth.api.createOrganization({    body: {        name: "My Organization", // required        slug: "my-org", // required        logo: "https://example.com/logo.png",        metadata,        userId: "some_user_id", // server-only        keepCurrentActiveOrganization: false,    },    // This endpoint requires session cookies.    headers: await headers(),});
```

| Prop | Description | Type |
| --- | --- | --- |
| `name` | The organization name. | `string` |
| `slug` | The organization slug. | `string` |
| `logo?` | The organization logo. | `string` |
| `metadata?` | The metadata of the organization. | `Record<string, any>` |
| `userId?`(server-only) | The user ID of the organization creator. If not provided, the current user will be used. Should only be used by admins or when called by the server. | `string` |
| `keepCurrentActiveOrganization?` | Whether to keep the current active organization active after creating a new one. | `boolean` |

#### [Restrict who can create an organization](https://www.better-auth.com/docs/plugins/organization\#restrict-who-can-create-an-organization)

By default, any user can create an organization. To restrict this, set the `allowUserToCreateOrganization` option to a function that returns a boolean, or directly to `true` or `false`.

auth.ts

```
import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";

const auth = betterAuth({
  //...
  plugins: [\
    organization({\
      allowUserToCreateOrganization: async (user) => {\
        const subscription = await getSubscription(user.id);\
        return subscription.plan === "pro";\
      },\
    }),\
  ],
});
```

#### [Check if organization slug is taken](https://www.better-auth.com/docs/plugins/organization\#check-if-organization-slug-is-taken)

To check if an organization slug is taken or not you can use the `checkSlug` function provided by the client. The function takes an object with the following properties:

ClientServer

POST

/organization/check-slug

```
const { data, error } = await authClient.organization.checkSlug({    slug: "my-org", // required});
```

| Prop | Description | Type |
| --- | --- | --- |
| `slug` | The organization slug to check. | `string` |

POST

/organization/check-slug

```
const data = await auth.api.checkOrganizationSlug({    body: {        slug: "my-org", // required    },});
```

| Prop | Description | Type |
| --- | --- | --- |
| `slug` | The organization slug to check. | `string` |

### [Organization Hooks](https://www.better-auth.com/docs/plugins/organization\#organization-hooks)

You can customize organization operations using hooks that run before and after various organization-related activities. Better Auth provides two ways to configure hooks:

1. **Legacy organizationCreation hooks** (deprecated, use `organizationHooks` instead)
2. **Modern organizationHooks** (recommended) - provides comprehensive control over all organization-related activities

#### [Organization Creation and Management Hooks](https://www.better-auth.com/docs/plugins/organization\#organization-creation-and-management-hooks)

Control organization lifecycle operations:

auth.ts

```
import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";

export const auth = betterAuth({
  plugins: [\
    organization({\
      organizationHooks: {\
        // Organization creation hooks\
        beforeCreateOrganization: async ({ organization, user }) => {\
          // Run custom logic before organization is created\
          // Optionally modify the organization data\
          return {\
            data: {\
              ...organization,\
              metadata: {\
                customField: "value",\
              },\
            },\
          };\
        },\
\
        afterCreateOrganization: async ({ organization, member, user }) => {\
          // Run custom logic after organization is created\
          // e.g., create default resources, send notifications\
          await setupDefaultResources(organization.id);\
        },\
\
        // Organization update hooks\
        beforeUpdateOrganization: async ({ organization, user, member }) => {\
          // Validate updates, apply business rules\
          return {\
            data: {\
              ...organization,\
              name: organization.name?.toLowerCase(),\
            },\
          };\
        },\
\
        afterUpdateOrganization: async ({ organization, user, member }) => {\
          // Sync changes to external systems\
          await syncOrganizationToExternalSystems(organization);\
        },\
      },\
    }),\
  ],
});
```

The legacy `organizationCreation` hooks are still supported but deprecated.
Use `organizationHooks.beforeCreateOrganization` and
`organizationHooks.afterCreateOrganization` instead for new projects.

#### [Member Hooks](https://www.better-auth.com/docs/plugins/organization\#member-hooks)

Control member operations within organizations:

auth.ts

```
import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";

export const auth = betterAuth({
  plugins: [\
    organization({\
      organizationHooks: {\
        // Before a member is added to an organization\
        beforeAddMember: async ({ member, user, organization }) => {\
          // Custom validation or modification\
          console.log(`Adding ${user.email} to ${organization.name}`);\
\
          // Optionally modify member data\
          return {\
            data: {\
              ...member,\
              role: "custom-role", // Override the role\
            },\
          };\
        },\
\
        // After a member is added\
        afterAddMember: async ({ member, user, organization }) => {\
          // Send welcome email, create default resources, etc.\
          await sendWelcomeEmail(user.email, organization.name);\
        },\
\
        // Before a member is removed\
        beforeRemoveMember: async ({ member, user, organization }) => {\
          // Cleanup user's resources, send notification, etc.\
          await cleanupUserResources(user.id, organization.id);\
        },\
\
        // After a member is removed\
        afterRemoveMember: async ({ member, user, organization }) => {\
          await logMemberRemoval(user.id, organization.id);\
        },\
\
        // Before updating a member's role\
        beforeUpdateMemberRole: async ({\
          member,\
          newRole,\
          user,\
          organization,\
        }) => {\
          // Validate role change permissions\
          if (newRole === "owner" && !hasOwnerUpgradePermission(user)) {\
            throw new Error("Cannot upgrade to owner role");\
          }\
\
          // Optionally modify the role\
          return {\
            data: {\
              role: newRole,\
            },\
          };\
        },\
\
        // After updating a member's role\
        afterUpdateMemberRole: async ({\
          member,\
          previousRole,\
          user,\
          organization,\
        }) => {\
          await logRoleChange(user.id, previousRole, member.role);\
        },\
      },\
    }),\
  ],
});
```

#### [Invitation Hooks](https://www.better-auth.com/docs/plugins/organization\#invitation-hooks)

Control invitation lifecycle:

auth.ts

```
export const auth = betterAuth({
  plugins: [\
    organization({\
      organizationHooks: {\
        // Before creating an invitation\
        beforeCreateInvitation: async ({\
          invitation,\
          inviter,\
          organization,\
        }) => {\
          // Custom validation or expiration logic\
          const customExpiration = new Date(\
            Date.now() + 1000 * 60 * 60 * 24 * 7\
          ); // 7 days\
\
          return {\
            data: {\
              ...invitation,\
              expiresAt: customExpiration,\
            },\
          };\
        },\
\
        // After creating an invitation\
        afterCreateInvitation: async ({\
          invitation,\
          inviter,\
          organization,\
        }) => {\
          // Send custom invitation email, track metrics, etc.\
          await sendCustomInvitationEmail(invitation, organization);\
        },\
\
        // Before accepting an invitation\
        beforeAcceptInvitation: async ({ invitation, user, organization }) => {\
          // Additional validation before acceptance\
          await validateUserEligibility(user, organization);\
        },\
\
        // After accepting an invitation\
        afterAcceptInvitation: async ({\
          invitation,\
          member,\
          user,\
          organization,\
        }) => {\
          // Setup user account, assign default resources\
          await setupNewMemberResources(user, organization);\
        },\
\
        // Before/after rejecting invitations\
        beforeRejectInvitation: async ({ invitation, user, organization }) => {\
          // Log rejection reason, send notification to inviter\
        },\
\
        afterRejectInvitation: async ({ invitation, user, organization }) => {\
          await notifyInviterOfRejection(invitation.inviterId, user.email);\
        },\
\
        // Before/after cancelling invitations\
        beforeCancelInvitation: async ({\
          invitation,\
          cancelledBy,\
          organization,\
        }) => {\
          // Verify cancellation permissions\
        },\
\
        afterCancelInvitation: async ({\
          invitation,\
          cancelledBy,\
          organization,\
        }) => {\
          await logInvitationCancellation(invitation.id, cancelledBy.id);\
        },\
      },\
    }),\
  ],
});
```

#### [Team Hooks](https://www.better-auth.com/docs/plugins/organization\#team-hooks)

Control team operations (when teams are enabled):

auth.ts

```
export const auth = betterAuth({
  plugins: [\
    organization({\
      teams: { enabled: true },\
      organizationHooks: {\
        // Before creating a team\
        beforeCreateTeam: async ({ team, user, organization }) => {\
          // Validate team name, apply naming conventions\
          return {\
            data: {\
              ...team,\
              name: team.name.toLowerCase().replace(/\s+/g, "-"),\
            },\
          };\
        },\
\
        // After creating a team\
        afterCreateTeam: async ({ team, user, organization }) => {\
          // Create default team resources, channels, etc.\
          await createDefaultTeamResources(team.id);\
        },\
\
        // Before updating a team\
        beforeUpdateTeam: async ({ team, updates, user, organization }) => {\
          // Validate updates, apply business rules\
          return {\
            data: {\
              ...updates,\
              name: updates.name?.toLowerCase(),\
            },\
          };\
        },\
\
        // After updating a team\
        afterUpdateTeam: async ({ team, user, organization }) => {\
          await syncTeamChangesToExternalSystems(team);\
        },\
\
        // Before deleting a team\
        beforeDeleteTeam: async ({ team, user, organization }) => {\
          // Backup team data, notify members\
          await backupTeamData(team.id);\
        },\
\
        // After deleting a team\
        afterDeleteTeam: async ({ team, user, organization }) => {\
          await cleanupTeamResources(team.id);\
        },\
\
        // Team member operations\
        beforeAddTeamMember: async ({\
          teamMember,\
          team,\
          user,\
          organization,\
        }) => {\
          // Validate team membership limits, permissions\
          const memberCount = await getTeamMemberCount(team.id);\
          if (memberCount >= 10) {\
            throw new Error("Team is full");\
          }\
        },\
\
        afterAddTeamMember: async ({\
          teamMember,\
          team,\
          user,\
          organization,\
        }) => {\
          await grantTeamAccess(user.id, team.id);\
        },\
\
        beforeRemoveTeamMember: async ({\
          teamMember,\
          team,\
          user,\
          organization,\
        }) => {\
          // Backup user's team-specific data\
          await backupTeamMemberData(user.id, team.id);\
        },\
\
        afterRemoveTeamMember: async ({\
          teamMember,\
          team,\
          user,\
          organization,\
        }) => {\
          await revokeTeamAccess(user.id, team.id);\
        },\
      },\
    }),\
  ],
});
```

#### [Hook Error Handling](https://www.better-auth.com/docs/plugins/organization\#hook-error-handling)

All hooks support error handling. Throwing an error in a `before` hook will prevent the operation from proceeding:

auth.ts

```
import { APIError } from "better-auth/api";

export const auth = betterAuth({
  plugins: [\
    organization({\
      organizationHooks: {\
        beforeAddMember: async ({ member, user, organization }) => {\
          // Check if user has pending violations\
          const violations = await checkUserViolations(user.id);\
          if (violations.length > 0) {\
            throw new APIError("BAD_REQUEST", {\
              message:\
                "User has pending violations and cannot join organizations",\
            });\
          }\
        },\
\
        beforeCreateTeam: async ({ team, user, organization }) => {\
          // Validate team name uniqueness\
          const existingTeam = await findTeamByName(team.name, organization.id);\
          if (existingTeam) {\
            throw new APIError("BAD_REQUEST", {\
              message: "Team name already exists in this organization",\
            });\
          }\
        },\
      },\
    }),\
  ],
});
```

### [List User's Organizations](https://www.better-auth.com/docs/plugins/organization\#list-users-organizations)

To list the organizations that a user is a member of, you can use `useListOrganizations` hook. It implements a reactive way to get the organizations that the user is a member of.

ReactVueSvelte

client.tsx

```
import { authClient } from "@/lib/auth-client"

function App(){
const { data: organizations } = authClient.useListOrganizations()
return (
  <div>
    {organizations.map((org) => (
      <p>{org.name}</p>
    ))}
  </div>)
}
```

page.svelte

```
<script lang="ts">
  import { authClient } from "$lib/auth-client";
  const organizations = authClient.useListOrganizations();
</script>

<h1>Organizations</h1>

{#if $organizations.isPending}

  <p>Loading...</p>
{:else if !$organizations.data?.length}
  <p>No organizations found.</p>
{:else}
  <ul>
    {#each $organizations.data as organization}
      <li>{organization.name}</li>
    {/each}
  </ul>
{/if}
```

organization.vue

```
<script lang="ts">;
export default {
    setup() {
        const organizations = authClient.useListOrganizations()
        return { organizations };
    }
};
</script>

<template>
    <div>
        <h1>Organizations</h1>
        <div v-if="organizations.isPending">Loading...</div>
        <div v-else-if="organizations.data === null">No organizations found.</div>
        <ul v-else>
            <li v-for="organization in organizations.data" :key="organization.id">
                {{ organization.name }}
            </li>
        </ul>
    </div>
</template>
```

Or alternatively, you can call `organization.list` if you don't want to use a hook.

ClientServer

GET

/organization/list

```
const { data, error } = await authClient.organization.list();
```

GET

/organization/list

```
const data = await auth.api.listOrganizations({    // This endpoint requires session cookies.    headers: await headers(),});
```

### [Active Organization](https://www.better-auth.com/docs/plugins/organization\#active-organization)

Active organization is the workspace the user is currently working on. By default when the user is signed in the active organization is set to `null`. You can set the active organization to the user session.

It's not always you want to persist the active organization in the session.
You can manage the active organization in the client side only. For example,
multiple tabs can have different active organizations.

#### [Set Active Organization](https://www.better-auth.com/docs/plugins/organization\#set-active-organization)

You can set the active organization by calling the `organization.setActive` function. It'll set the active organization for the user session.

In some applications, you may want the ability to unset an active
organization. In this case, you can call this endpoint with `organizationId`
set to `null`.

ClientServer

POST

/organization/set-active

```
const { data, error } = await authClient.organization.setActive({    organizationId: "org-id",    organizationSlug: "org-slug",});
```

| Prop | Description | Type |
| --- | --- | --- |
| `organizationId?` | The organization ID to set as active. It can be null to unset the active organization. | `string | null` |
| `organizationSlug?` | The organization slug to set as active. It can be null to unset the active organization if organizationId is not provided. | `string` |

POST

/organization/set-active

```
const data = await auth.api.setActiveOrganization({    body: {        organizationId: "org-id",        organizationSlug: "org-slug",    },});
```

| Prop | Description | Type |
| --- | --- | --- |
| `organizationId?` | The organization ID to set as active. It can be null to unset the active organization. | `string | null` |
| `organizationSlug?` | The organization slug to set as active. It can be null to unset the active organization if organizationId is not provided. | `string` |

To set active organization when a session is created you can use [database hooks](https://www.better-auth.com/docs/concepts/database#database-hooks).

auth.ts

```
export const auth = betterAuth({
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const organization = await getActiveOrganization(session.userId);
          return {
            data: {
              ...session,
              activeOrganizationId: organization.id,
            },
          };
        },
      },
    },
  },
});
```

#### [Use Active Organization](https://www.better-auth.com/docs/plugins/organization\#use-active-organization)

To retrieve the active organization for the user, you can call the `useActiveOrganization` hook. It returns the active organization for the user. Whenever the active organization changes, the hook will re-evaluate and return the new active organization.

ReactVueSvelte

client.tsx

```
import { authClient } from "@/lib/auth-client"

function App(){
    const { data: activeOrganization } = authClient.useActiveOrganization()
    return (
        <div>
            {activeOrganization ? <p>{activeOrganization.name}</p> : null}
        </div>
    )
}
```

client.tsx

```
<script lang="ts">
import { authClient } from "$lib/auth-client";
const activeOrganization = authClient.useActiveOrganization();
</script>

<h2>Active Organization</h2>

{#if $activeOrganization.isPending}
<p>Loading...</p>
{:else if $activeOrganization.data === null}
<p>No active organization found.</p>
{:else}
<p>{$activeOrganization.data.name}</p>
{/if}
```

organization.vue

```
<script lang="ts">;
export default {
    setup() {
        const activeOrganization = authClient.useActiveOrganization();
        return { activeOrganization };
    }
};
</script>

<template>
    <div>
        <h2>Active organization</h2>
        <div v-if="activeOrganization.isPending">Loading...</div>
        <div v-else-if="activeOrganization.data === null">No active organization.</div>
        <div v-else>
            {{ activeOrganization.data.name }}
        </div>
    </div>
</template>
```

### [Get Full Organization](https://www.better-auth.com/docs/plugins/organization\#get-full-organization)

To get the full details of an organization, you can use the `getFullOrganization` function.
By default, if you don't pass any properties, it will use the active organization.

ClientServer

GET

/organization/get-full-organization

```
const { data, error } = await authClient.organization.getFullOrganization({    organizationId: "org-id",    organizationSlug: "org-slug",    membersLimit: 100,});
```

| Prop | Description | Type |
| --- | --- | --- |
| `organizationId?` | The organization ID to get. By default, it will use the active organization. | `string` |
| `organizationSlug?` | The organization slug to get. | `string` |
| `membersLimit?` | The limit of members to get. By default, it uses the membershipLimit option which defaults to 100. | `number` |

GET

/organization/get-full-organization

```
const data = await auth.api.getFullOrganization({    query: {        organizationId: "org-id",        organizationSlug: "org-slug",        membersLimit: 100,    },    // This endpoint requires session cookies.    headers: await headers(),});
```

| Prop | Description | Type |
| --- | --- | --- |
| `organizationId?` | The organization ID to get. By default, it will use the active organization. | `string` |
| `organizationSlug?` | The organization slug to get. | `string` |
| `membersLimit?` | The limit of members to get. By default, it uses the membershipLimit option which defaults to 100. | `number` |

### [Update Organization](https://www.better-auth.com/docs/plugins/organization\#update-organization)

To update organization info, you can use `organization.update`

ClientServer

POST

/organization/update

```
const { data, error } = await authClient.organization.update({    data: { // required        name: "updated-name",        slug: "updated-slug",        logo: "new-logo.url",        metadata: { customerId: "test" },    },    organizationId: "org-id",});
```

| Prop | Description | Type |
| --- | --- | --- |
| `data` | A partial list of data to update the organization. | `Object` |
| `data.name?` | The name of the organization. | `string` |
| `data.slug?` | The slug of the organization. | `string` |
| `data.logo?` | The logo of the organization. | `string` |
| `data.metadata?` | The metadata of the organization. | `Record<string, any> | null` |
| `organizationId?` | The organization ID. to update. | `string` |

POST

/organization/update

```
const data = await auth.api.updateOrganization({    body: {        data: { // required            name: "updated-name",            slug: "updated-slug",            logo: "new-logo.url",            metadata: { customerId: "test" },        },        organizationId: "org-id",    },    // This endpoint requires session cookies.    headers: await headers(),});
```

| Prop | Description | Type |
| --- | --- | --- |
| `data` | A partial list of data to update the organization. | `Object` |
| `data.name?` | The name of the organization. | `string` |
| `data.slug?` | The slug of the organization. | `string` |
| `data.logo?` | The logo of the organization. | `string` |
| `data.metadata?` | The metadata of the organization. | `Record<string, any> | null` |
| `organizationId?` | The organization ID. to update. | `string` |

### [Delete Organization](https://www.better-auth.com/docs/plugins/organization\#delete-organization)

To remove user owned organization, you can use `organization.delete`

ClientServer

POST

/organization/delete

```
const { data, error } = await authClient.organization.delete({    organizationId: "org-id", // required});
```

| Prop | Description | Type |
| --- | --- | --- |
| `organizationId` | The organization ID to delete. | `string` |

POST

/organization/delete

```
const data = await auth.api.deleteOrganization({    body: {        organizationId: "org-id", // required    },    // This endpoint requires session cookies.    headers: await headers(),});
```

| Prop | Description | Type |
| --- | --- | --- |
| `organizationId` | The organization ID to delete. | `string` |

If the user has the necessary permissions (by default: role is owner) in the specified organization, all members, invitations and organization information will be removed.

You can configure how organization deletion is handled through `organizationDeletion` option:

```
const auth = betterAuth({
  plugins: [\
    organization({\
      disableOrganizationDeletion: true, //to disable it altogether\
      organizationHooks: {\
        beforeDeleteOrganization: async (data, request) => {\
          // a callback to run before deleting org\
        },\
        afterDeleteOrganization: async (data, request) => {\
          // a callback to run after deleting org\
        },\
      },\
    }),\
  ],
});
```

## [Invitations](https://www.better-auth.com/docs/plugins/organization\#invitations)

To add a member to an organization, we first need to send an invitation to the user. The user will receive an email/sms with the invitation link. Once the user accepts the invitation, they will be added to the organization.

### [Setup Invitation Email](https://www.better-auth.com/docs/plugins/organization\#setup-invitation-email)

For member invitation to work we first need to provide `sendInvitationEmail` to the `better-auth` instance. This function is responsible for sending the invitation email to the user.

You'll need to construct and send the invitation link to the user. The link should include the invitation ID, which will be used with the acceptInvitation function when the user clicks on it.

auth.ts

```
import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";
import { sendOrganizationInvitation } from "./email";
export const auth = betterAuth({
  plugins: [\
    organization({\
      async sendInvitationEmail(data) {\
        const inviteLink = `https://example.com/accept-invitation/${data.id}`;\
        sendOrganizationInvitation({\
          email: data.email,\
          invitedByUsername: data.inviter.user.name,\
          invitedByEmail: data.inviter.user.email,\
          teamName: data.organization.name,\
          inviteLink,\
        });\
      },\
    }),\
  ],
});
```

### [Send Invitation](https://www.better-auth.com/docs/plugins/organization\#send-invitation)

To invite users to an organization, you can use the `invite` function provided by the client. The `invite` function takes an object with the following properties:

ClientServer

POST

/organization/invite-member

```
const { data, error } = await authClient.organization.inviteMember({    email: "example@gmail.com", // required    role: "member", // required    organizationId: "org-id",    resend: true,    teamId: "team-id",});
```

| Prop | Description | Type |
| --- | --- | --- |
| `email` | The email address of the user to invite. | `string` |
| `role` | The role(s) to assign to the user. It can be `admin`, `member`, or `guest`. | `string | string[]` |
| `organizationId?` | The organization ID to invite the user to. Defaults to the active organization. | `string` |
| `resend?` | Resend the invitation email, if the user is already invited. | `boolean` |
| `teamId?` | The team ID to invite the user to. | `string` |

POST

/organization/invite-member

```
const data = await auth.api.createInvitation({    body: {        email: "example@gmail.com", // required        role: "member", // required        organizationId: "org-id",        resend: true,        teamId: "team-id",    },});
```

| Prop | Description | Type |
| --- | --- | --- |
| `email` | The email address of the user to invite. | `string` |
| `role` | The role(s) to assign to the user. It can be `admin`, `member`, or `guest`. | `string | string[]` |
| `organizationId?` | The organization ID to invite the user to. Defaults to the active organization. | `string` |
| `resend?` | Resend the invitation email, if the user is already invited. | `boolean` |
| `teamId?` | The team ID to invite the user to. | `string` |

- If the user is already a member of the organization, the invitation will be
canceled. - If the user is already invited to the organization, unless
`resend` is set to `true`, the invitation will not be sent again. - If
`cancelPendingInvitationsOnReInvite` is set to `true`, the invitation will be
canceled if the user is already invited to the organization and a new
invitation is sent.

### [Accept Invitation](https://www.better-auth.com/docs/plugins/organization\#accept-invitation)

When a user receives an invitation email, they can click on the invitation link to accept the invitation. The invitation link should include the invitation ID, which will be used to accept the invitation.

Make sure to call the `acceptInvitation` function after the user is logged in.

ClientServer

POST

/organization/accept-invitation

```
const { data, error } = await authClient.organization.acceptInvitation({    invitationId: "invitation-id", // required});
```

| Prop | Description | Type |
| --- | --- | --- |
| `invitationId` | The ID of the invitation to accept. | `string` |

POST

/organization/accept-invitation

```
const data = await auth.api.acceptInvitation({    body: {        invitationId: "invitation-id", // required    },});
```

| Prop | Description | Type |
| --- | --- | --- |
| `invitationId` | The ID of the invitation to accept. | `string` |

#### [Email Verification Requirement](https://www.better-auth.com/docs/plugins/organization\#email-verification-requirement)

If the `requireEmailVerificationOnInvitation` option is enabled in your organization configuration, users must verify their email address before they can accept invitations. This adds an extra security layer to ensure that only verified users can join your organization.

auth.ts

```
import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";

export const auth = betterAuth({
  plugins: [\
    organization({\
      requireEmailVerificationOnInvitation: true,\
      async sendInvitationEmail(data) {\
        // ... your email sending logic\
      },\
    }),\
  ],
});
```

### [Invitation Accepted Callback](https://www.better-auth.com/docs/plugins/organization\#invitation-accepted-callback)

You can configure Better Auth to execute a callback function when an invitation is accepted. This is useful for logging events, updating analytics, sending notifications, or any other custom logic you need to run when someone joins your organization.

auth.ts

```
import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";

export const auth = betterAuth({
  plugins: [\
    organization({\
      async sendInvitationEmail(data) {\
        // ... your invitation email logic\
      },\
      async onInvitationAccepted(data) {\
        // This callback gets triggered when an invitation is accepted\
      },\
    }),\
  ],
});
```

The callback receives the following data:

- `id`: The invitation ID
- `role`: The role assigned to the user
- `organization`: The organization the user joined
- `invitation`: The invitation object
- `inviter`: The member who sent the invitation (including user details)
- `acceptedUser`: The user who accepted the invitation

### [Cancel Invitation](https://www.better-auth.com/docs/plugins/organization\#cancel-invitation)

If a user has sent out an invitation, you can use this method to cancel it.

If you're looking for how a user can reject an invitation, you can find that [here](https://www.better-auth.com/docs/plugins/organization#reject-invitation).

ClientServer

POST

/organization/cancel-invitation

```
await authClient.organization.cancelInvitation({    invitationId: "invitation-id", // required});
```

| Prop | Description | Type |
| --- | --- | --- |
| `invitationId` | The ID of the invitation to cancel. | `string` |

POST

/organization/cancel-invitation

```
await auth.api.cancelInvitation({    body: {        invitationId: "invitation-id", // required    },});
```

| Prop | Description | Type |
| --- | --- | --- |
| `invitationId` | The ID of the invitation to cancel. | `string` |

### [Reject Invitation](https://www.better-auth.com/docs/plugins/organization\#reject-invitation)

If this user has received an invitation, but wants to decline it, this method will allow you to do so by rejecting it.

ClientServer

POST

/organization/reject-invitation

```
await authClient.organization.rejectInvitation({    invitationId: "invitation-id", // required});
```

| Prop | Description | Type |
| --- | --- | --- |
| `invitationId` | The ID of the invitation to reject. | `string` |

POST

/organization/reject-invitation

```
await auth.api.rejectInvitation({    body: {        invitationId: "invitation-id", // required    },});
```

| Prop | Description | Type |
| --- | --- | --- |
| `invitationId` | The ID of the invitation to reject. | `string` |

Like accepting invitations, rejecting invitations also requires email
verification when the `requireEmailVerificationOnInvitation` option is
enabled. Users with unverified emails will receive an error when attempting to
reject invitations.

### [Get Invitation](https://www.better-auth.com/docs/plugins/organization\#get-invitation)

To get an invitation you can use the `organization.getInvitation` function provided by the client. You need to provide the invitation id as a query parameter.

ClientServer

GET

/organization/get-invitation

```
const { data, error } = await authClient.organization.getInvitation({    id: "invitation-id", // required});
```

| Prop | Description | Type |
| --- | --- | --- |
| `id` | The ID of the invitation to get. | `string` |

GET

/organization/get-invitation

```
const data = await auth.api.getInvitation({    query: {        id: "invitation-id", // required    },    // This endpoint requires session cookies.    headers: await headers(),});
```

| Prop | Description | Type |
| --- | --- | --- |
| `id` | The ID of the invitation to get. | `string` |

### [List Invitations](https://www.better-auth.com/docs/plugins/organization\#list-invitations)

To list all invitations for a given organization you can use the `listInvitations` function provided by the client.

ClientServer

GET

/organization/list-invitations

```
const { data, error } = await authClient.organization.listInvitations({    organizationId: "organization-id",});
```

| Prop | Description | Type |
| --- | --- | --- |
| `organizationId?` | An optional ID of the organization to list invitations for. If not provided, will default to the user's active organization. | `string` |

GET

/organization/list-invitations

```
const data = await auth.api.listInvitations({    query: {        organizationId: "organization-id",    },});
```

| Prop | Description | Type |
| --- | --- | --- |
| `organizationId?` | An optional ID of the organization to list invitations for. If not provided, will default to the user's active organization. | `string` |

### [List user invitations](https://www.better-auth.com/docs/plugins/organization\#list-user-invitations)

To list all invitations for a given user you can use the `listUserInvitations` function provided by the client.

auth-client.ts

```
const invitations = await authClient.organization.listUserInvitations();
```

On the server, you can pass the user ID as a query parameter.

api.ts

```
const invitations = await auth.api.listUserInvitations({
  query: {
    email: "user@example.com",
  },
});
```

The `email` query parameter is only available on the server to query for
invitations for a specific user.

## [Members](https://www.better-auth.com/docs/plugins/organization\#members)

### [List Members](https://www.better-auth.com/docs/plugins/organization\#list-members)

To list all members of an organization you can use the `listMembers` function.

ClientServer

GET

/organization/list-members

```
const { data, error } = await authClient.organization.listMembers({    organizationId: "organization-id",    limit: 100,    offset: 0,    sortBy: "createdAt",    sortDirection: "desc",    filterField: "createdAt",    filterOperator: "eq",    filterValue: "value",});
```

| Prop | Description | Type |
| --- | --- | --- |
| `organizationId?` | An optional organization ID to list members for. If not provided, will default to the user's active organization. | `string` |
| `limit?` | The limit of members to return. | `number` |
| `offset?` | The offset to start from. | `number` |
| `sortBy?` | The field to sort by. | `string` |
| `sortDirection?` | The direction to sort by. | `"asc" | "desc"` |
| `filterField?` | The field to filter by. | `string` |
| `filterOperator?` | The operator to filter by. | `"eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "in" | "nin" | "contains"` |
| `filterValue?` | The value to filter by. | `string` |

GET

/organization/list-members

```
const data = await auth.api.listMembers({    query: {        organizationId: "organization-id",        limit: 100,        offset: 0,        sortBy: "createdAt",        sortDirection: "desc",        filterField: "createdAt",        filterOperator: "eq",        filterValue: "value",    },});
```

| Prop | Description | Type |
| --- | --- | --- |
| `organizationId?` | An optional organization ID to list members for. If not provided, will default to the user's active organization. | `string` |
| `limit?` | The limit of members to return. | `number` |
| `offset?` | The offset to start from. | `number` |
| `sortBy?` | The field to sort by. | `string` |
| `sortDirection?` | The direction to sort by. | `"asc" | "desc"` |
| `filterField?` | The field to filter by. | `string` |
| `filterOperator?` | The operator to filter by. | `"eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "in" | "nin" | "contains"` |
| `filterValue?` | The value to filter by. | `string` |

### [Remove Member](https://www.better-auth.com/docs/plugins/organization\#remove-member)

To remove you can use `organization.removeMember`

ClientServer

POST

/organization/remove-member

```
const { data, error } = await authClient.organization.removeMember({    memberIdOrEmail: "user@example.com", // required    organizationId: "org-id",});
```

| Prop | Description | Type |
| --- | --- | --- |
| `memberIdOrEmail` | The ID or email of the member to remove. | `string` |
| `organizationId?` | The ID of the organization to remove the member from. If not provided, the active organization will be used. | `string` |

POST

/organization/remove-member

```
const data = await auth.api.removeMember({    body: {        memberIdOrEmail: "user@example.com", // required        organizationId: "org-id",    },});
```

| Prop | Description | Type |
| --- | --- | --- |
| `memberIdOrEmail` | The ID or email of the member to remove. | `string` |
| `organizationId?` | The ID of the organization to remove the member from. If not provided, the active organization will be used. | `string` |

### [Update Member Role](https://www.better-auth.com/docs/plugins/organization\#update-member-role)

To update the role of a member in an organization, you can use the `organization.updateMemberRole`. If the user has the permission to update the role of the member, the role will be updated.

ClientServer

POST

/organization/update-member-role

```
await authClient.organization.updateMemberRole({    role: ["admin", "sale"], // required    memberId: "member-id", // required    organizationId: "organization-id",});
```

| Prop | Description | Type |
| --- | --- | --- |
| `role` | The new role to be applied. This can be a string or array of strings representing the roles. | `string | string[]` |
| `memberId` | The member id to apply the role update to. | `string` |
| `organizationId?` | An optional organization ID which the member is a part of to apply the role update. If not provided, you must provide session headers to get the active organization. | `string` |

POST

/organization/update-member-role

```
await auth.api.updateMemberRole({    body: {        role: ["admin", "sale"], // required        memberId: "member-id", // required        organizationId: "organization-id",    },});
```

| Prop | Description | Type |
| --- | --- | --- |
| `role` | The new role to be applied. This can be a string or array of strings representing the roles. | `string | string[]` |
| `memberId` | The member id to apply the role update to. | `string` |
| `organizationId?` | An optional organization ID which the member is a part of to apply the role update. If not provided, you must provide session headers to get the active organization. | `string` |

### [Get Active Member](https://www.better-auth.com/docs/plugins/organization\#get-active-member)

To get the current member of the active organization you can use the `organization.getActiveMember` function. This function will return the user's member details in their active organization.

ClientServer

GET

/organization/get-active-member

```
const { data: member, error } = await authClient.organization.getActiveMember();
```

GET

/organization/get-active-member

```
const member = await auth.api.getActiveMember({    // This endpoint requires session cookies.    headers: await headers(),});
```

### [Get Active Member Role](https://www.better-auth.com/docs/plugins/organization\#get-active-member-role)

To get the current role member of the active organization you can use the `organization.getActiveMemberRole` function. This function will return the user's member role in their active organization.

ClientServer

GET

/organization/get-active-member-role

```
const { data: { role }, error } = await authClient.organization.getActiveMemberRole();
```

GET

/organization/get-active-member-role

```
const { role } = await auth.api.getActiveMemberRole({    // This endpoint requires session cookies.    headers: await headers(),});
```

### [Add Member](https://www.better-auth.com/docs/plugins/organization\#add-member)

If you want to add a member directly to an organization without sending an invitation, you can use the `addMember` function which can only be invoked on the server.

ClientServer

```
const { data, error } = await authClient.organization.addMember({    userId: "user-id",    role: ["admin", "sale"], // required    organizationId: "org-id",    teamId: "team-id",});
```

This is a server-only endpoint

POST

/organization/add-member

```
const data = await auth.api.addMember({    body: {        userId: "user-id",        role: ["admin", "sale"], // required        organizationId: "org-id",        teamId: "team-id",    },});
```

| Prop | Description | Type |
| --- | --- | --- |
| `userId?` | The user ID which represents the user to be added as a member. If `null` is provided, then it's expected to provide session headers. | `string | null` |
| `role` | The role(s) to assign to the new member. | `string | string[]` |
| `organizationId?` | An optional organization ID to pass. If not provided, will default to the user's active organization. | `string` |
| `teamId?` | An optional team ID to add the member to. | `string` |

### [Leave Organization](https://www.better-auth.com/docs/plugins/organization\#leave-organization)

To leave organization you can use `organization.leave` function. This function will remove the current user from the organization.

ClientServer

POST

/organization/leave

```
await authClient.organization.leave({    organizationId: "organization-id", // required});
```

| Prop | Description | Type |
| --- | --- | --- |
| `organizationId` | The organization ID for the member to leave. | `string` |

POST

/organization/leave

```
await auth.api.leaveOrganization({    body: {        organizationId: "organization-id", // required    },    // This endpoint requires session cookies.    headers: await headers(),});
```

| Prop | Description | Type |
| --- | --- | --- |
| `organizationId` | The organization ID for the member to leave. | `string` |

## [Access Control](https://www.better-auth.com/docs/plugins/organization\#access-control)

The organization plugin provides a very flexible access control system. You can control the access of the user based on the role they have in the organization. You can define your own set of permissions based on the role of the user.

### [Roles](https://www.better-auth.com/docs/plugins/organization\#roles)

By default, there are three roles in the organization:

`owner`: The user who created the organization by default. The owner has full control over the organization and can perform any action.

`admin`: Users with the admin role have full control over the organization except for deleting the organization or changing the owner.

`member`: Users with the member role have limited control over the organization. They can create projects, invite users, and manage projects they have created.

A user can have multiple roles. Multiple roles are stored as string separated
by comma (",").

### [Permissions](https://www.better-auth.com/docs/plugins/organization\#permissions)

By default, there are three resources, and these have two to three actions.

**organization**:

`update` `delete`

**member**:

`create` `update` `delete`

**invitation**:

`create` `cancel`

The owner has full control over all the resources and actions. The admin has full control over all the resources except for deleting the organization or changing the owner. The member has no control over any of those actions other than reading the data.

### [Custom Permissions](https://www.better-auth.com/docs/plugins/organization\#custom-permissions)

The plugin provides an easy way to define your own set of permissions for each role.

#### [Create Access Control](https://www.better-auth.com/docs/plugins/organization\#create-access-control)

You first need to create access controller by calling `createAccessControl` function and passing the statement object. The statement object should have the resource name as the key and the array of actions as the value.

permissions.ts

```
import { createAccessControl } from "better-auth/plugins/access";

/**
 * make sure to use `as const` so typescript can infer the type correctly
 */
const statement = {
    project: ["create", "share", "update", "delete"],
} as const;

const ac = createAccessControl(statement);
```

#### [Create Roles](https://www.better-auth.com/docs/plugins/organization\#create-roles)

Once you have created the access controller you can create roles with the permissions you have defined.

permissions.ts

```
import { createAccessControl } from "better-auth/plugins/access";

const statement = {
    project: ["create", "share", "update", "delete"],
} as const;

const ac = createAccessControl(statement);

const member = ac.newRole({
    project: ["create"],
});

const admin = ac.newRole({
    project: ["create", "update"],
});

const owner = ac.newRole({
    project: ["create", "update", "delete"],
});

const myCustomRole = ac.newRole({
    project: ["create", "update", "delete"],
    organization: ["update"],
});
```

When you create custom roles for existing roles, the predefined permissions for those roles will be overridden. To add the existing permissions to the custom role, you need to import `defaultStatements` and merge it with your new statement, plus merge the roles' permissions set with the default roles.

permissions.ts

```
import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements, adminAc } from 'better-auth/plugins/organization/access'

const statement = {
    ...defaultStatements,
    project: ["create", "share", "update", "delete"],
} as const;

const ac = createAccessControl(statement);

const admin = ac.newRole({
    project: ["create", "update"],
    ...adminAc.statements,
});
```

#### [Pass Roles to the Plugin](https://www.better-auth.com/docs/plugins/organization\#pass-roles-to-the-plugin)

Once you have created the roles you can pass them to the organization plugin both on the client and the server.

auth.ts

```
import { betterAuth } from "better-auth"
import { organization } from "better-auth/plugins"
import { ac, owner, admin, member } from "@/auth/permissions"

export const auth = betterAuth({
    plugins: [\
        organization({\
            ac,\
            roles: {\
                owner,\
                admin,\
                member,\
                myCustomRole\
            }\
        }),\
    ],
});
```

You also need to pass the access controller and the roles to the client plugin.

auth-client

```
import { createAuthClient } from "better-auth/client"
import { organizationClient } from "better-auth/client/plugins"
import { ac, owner, admin, member, myCustomRole } from "@/auth/permissions"

export const authClient = createAuthClient({
    plugins: [\
        organizationClient({\
            ac,\
            roles: {\
                owner,\
                admin,\
                member,\
                myCustomRole\
            }\
        })\
  ]
})
```

### [Access Control Usage](https://www.better-auth.com/docs/plugins/organization\#access-control-usage)

**Has Permission**:

You can use the `hasPermission` action provided by the `api` to check the permission of the user.

api.ts

```
import { auth } from "@/auth";

await auth.api.hasPermission({
  headers: await headers(),
  body: {
    permissions: {
      project: ["create"], // This must match the structure in your access control
    },
  },
});

// You can also check multiple resource permissions at the same time
await auth.api.hasPermission({
  headers: await headers(),
  body: {
    permissions: {
      project: ["create"], // This must match the structure in your access control
      sale: ["create"],
    },
  },
});
```

If you want to check the permission of the user on the client from the server you can use the `hasPermission` function provided by the client.

auth-client.ts

```
const canCreateProject = await authClient.organization.hasPermission({
  permissions: {
    project: ["create"],
  },
});

// You can also check multiple resource permissions at the same time
const canCreateProjectAndCreateSale =
  await authClient.organization.hasPermission({
    permissions: {
      project: ["create"],
      sale: ["create"],
    },
  });
```

**Check Role Permission**:

Once you have defined the roles and permissions to avoid checking the permission from the server you can use the `checkRolePermission` function provided by the client.

auth-client.ts

```
const canCreateProject = authClient.organization.checkRolePermission({
  permissions: {
    organization: ["delete"],
  },
  role: "admin",
});

// You can also check multiple resource permissions at the same time
const canCreateProjectAndCreateSale =
  authClient.organization.checkRolePermission({
    permissions: {
      organization: ["delete"],
      member: ["delete"],
    },
    role: "admin",
  });
```

This will not include any dynamic roles as everything is ran syncronously on the client side.
Please use the [hasPermission](https://www.better-auth.com/docs/plugins/organization#access-control-usage) APIs to include checks for any dynamic roles & permissions.

* * *

## [Dynamic Access Control](https://www.better-auth.com/docs/plugins/organization\#dynamic-access-control)

Dynamic access control allows you to create roles at runtime for organizations. This is achieved by storing the
created roles and permissions associated with an organization in a database table.

### [Enabling Dynamic Access Control](https://www.better-auth.com/docs/plugins/organization\#enabling-dynamic-access-control)

To enable dynamic access control, pass the `dynamicAccessControl` configuration option with `enabled` set to `true` to both server and client plugins.

Ensure you have pre-defined an `ac` instance on the server auth plugin.
This is important as this is how we can infer the permissions that are available for use.

auth.ts

```
import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";
import { ac } from "@/auth/permissions";

export const auth = betterAuth({
    plugins: [\
        organization({\
            ac, // Must be defined in order for dynamic access control to work\
            dynamicAccessControl: {\
              enabled: true,\
            },\
        })\
    ]
})
```

auth-client.ts

```
import { createAuthClient } from "better-auth/client";
import { organizationClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
    plugins: [\
        organizationClient({\
            dynamicAccessControl: {\
              enabled: true,\
            },\
        })\
    ]
})
```

This will require you to run migrations to add the new `organizationRole` table to the database.

The `authClient.organization.checkRolePermission` function will not include any dynamic roles as everything is ran syncronously on the client side.
Please use the [hasPermission](https://www.better-auth.com/docs/plugins/organization#access-control-usage) APIs to include checks for any dynamic roles.

### [Creating a role](https://www.better-auth.com/docs/plugins/organization\#creating-a-role)

To create a new role for an organization at runtime, you can use the `createRole` function.

Only users with roles which contain the `ac` resource with the `create` permission can create a new role.
By default, only the `admin` and `owner` roles have this permission. You also cannot add permissions that your
current role in that organization can't already access.

TIP: You can validate role names by using the `dynamicAccessControl.validateRoleName` option in the organization plugin config.
Learn more [here](https://www.better-auth.com/docs/plugins/organization#validaterolename).

ClientServer

POST

/organization/create-role

```
// To use custom resources or permissions,// make sure they are defined in the `ac` instance of your organization config.const permission = {  project: ["create", "update", "delete"]}await authClient.organization.createRole({    role: "my-unique-role", // required    permission: permission,    organizationId: "organization-id",});
```

| Prop | Description | Type |
| --- | --- | --- |
| `role` | A unique name of the role to create. | `string` |
| `permission?` | The permissions to assign to the role. | `Record<string, string[]>` |
| `organizationId?` | The organization ID which the role will be created in. Defaults to the active organization. | `string` |

POST

/organization/create-role

```
// To use custom resources or permissions,// make sure they are defined in the `ac` instance of your organization config.const permission = {  project: ["create", "update", "delete"]}await auth.api.createOrgRole({    body: {        role: "my-unique-role", // required        permission: permission,        organizationId: "organization-id",    },    // This endpoint requires session cookies.    headers: await headers(),});
```

| Prop | Description | Type |
| --- | --- | --- |
| `role` | A unique name of the role to create. | `string` |
| `permission?` | The permissions to assign to the role. | `Record<string, string[]>` |
| `organizationId?` | The organization ID which the role will be created in. Defaults to the active organization. | `string` |

Now you can freely call [`updateMemberRole`](https://www.better-auth.com/docs/plugins/organization#updating-a-member-role) to update the role of a member with your newly created role!

### [Deleting a role](https://www.better-auth.com/docs/plugins/organization\#deleting-a-role)

To delete a role, you can use the `deleteRole` function, then provide either a `roleName` or `roleId` parameter along
with the `organizationId` parameter.

ClientServer

POST

/organization/delete-role

```
await authClient.organization.deleteRole({    roleName: "my-role",    roleId: "role-id",    organizationId: "organization-id",});
```

| Prop | Description | Type |
| --- | --- | --- |
| `roleName?` | The name of the role to delete. Alternatively, you can pass a `roleId` parameter instead. | `string` |
| `roleId?` | The id of the role to delete. Alternatively, you can pass a `roleName` parameter instead. | `string` |
| `organizationId?` | The organization ID which the role will be deleted in. Defaults to the active organization. | `string` |

POST

/organization/delete-role

```
await auth.api.deleteOrgRole({    body: {        roleName: "my-role",        roleId: "role-id",        organizationId: "organization-id",    },    // This endpoint requires session cookies.    headers: await headers(),});
```

| Prop | Description | Type |
| --- | --- | --- |
| `roleName?` | The name of the role to delete. Alternatively, you can pass a `roleId` parameter instead. | `string` |
| `roleId?` | The id of the role to delete. Alternatively, you can pass a `roleName` parameter instead. | `string` |
| `organizationId?` | The organization ID which the role will be deleted in. Defaults to the active organization. | `string` |

### [Listing roles](https://www.better-auth.com/docs/plugins/organization\#listing-roles)

To list roles, you can use the `listOrgRoles` function.
This requires the `ac` resource with the `read` permission for the member to be able to list roles.

ClientServer

GET

/organization/list-roles

```
const { data: roles, error } = await authClient.organization.listRoles({    organizationId: "organization-id",});
```

| Prop | Description | Type |
| --- | --- | --- |
| `organizationId?` | The organization ID which the roles are under to list. Defaults to the user's active organization. | `string` |

GET

/organization/list-roles

```
const roles = await auth.api.listOrgRoles({    query: {        organizationId: "organization-id",    },    // This endpoint requires session cookies.    headers: await headers(),});
```

| Prop | Description | Type |
| --- | --- | --- |
| `organizationId?` | The organization ID which the roles are under to list. Defaults to the user's active organization. | `string` |

### [Getting a specific role](https://www.better-auth.com/docs/plugins/organization\#getting-a-specific-role)

To get a specific role, you can use the `getOrgRole` function and pass either a `roleName` or `roleId` parameter.
This requires the `ac` resource with the `read` permission for the member to be able to get a role.

ClientServer

GET

/organization/get-role

```
const { data: role, error } = await authClient.organization.getRole({    roleName: "my-role",    roleId: "role-id",    organizationId: "organization-id",});
```

| Prop | Description | Type |
| --- | --- | --- |
| `roleName?` | The name of the role to get. Alternatively, you can pass a `roleId` parameter instead. | `string` |
| `roleId?` | The id of the role to get. Alternatively, you can pass a `roleName` parameter instead. | `string` |
| `organizationId?` | The organization ID which the role will be deleted in. Defaults to the active organization. | `string` |

GET

/organization/get-role

```
const role = await auth.api.getOrgRole({    query: {        roleName: "my-role",        roleId: "role-id",        organizationId: "organization-id",    },    // This endpoint requires session cookies.    headers: await headers(),});
```

| Prop | Description | Type |
| --- | --- | --- |
| `roleName?` | The name of the role to get. Alternatively, you can pass a `roleId` parameter instead. | `string` |
| `roleId?` | The id of the role to get. Alternatively, you can pass a `roleName` parameter instead. | `string` |
| `organizationId?` | The organization ID which the role will be deleted in. Defaults to the active organization. | `string` |

### [Updating a role](https://www.better-auth.com/docs/plugins/organization\#updating-a-role)

To update a role, you can use the `updateOrgRole` function and pass either a `roleName` or `roleId` parameter.

ClientServer

POST

/organization/update-role

```
const { data: updatedRole, error } = await authClient.organization.updateRole({    roleName: "my-role",    roleId: "role-id",    organizationId: "organization-id",    data: { // required        permission: { project: ["create", "update", "delete"] },        roleName: "my-new-role",    },});
```

| Prop | Description | Type |
| --- | --- | --- |
| `roleName?` | The name of the role to update. Alternatively, you can pass a `roleId` parameter instead. | `string` |
| `roleId?` | The id of the role to update. Alternatively, you can pass a `roleName` parameter instead. | `string` |
| `organizationId?` | The organization ID which the role will be updated in. Defaults to the active organization. | `string` |
| `data` | The data which will be updated | `Object` |
| `data.permission?` | Optionally update the permissions of the role. | `Record<string, string[]>` |
| `data.roleName?` | Optionally update the name of the role. | `string` |

POST

/organization/update-role

```
const updatedRole = await auth.api.updateOrgRole({    body: {        roleName: "my-role",        roleId: "role-id",        organizationId: "organization-id",        data: { // required            permission: { project: ["create", "update", "delete"] },            roleName: "my-new-role",        },    },    // This endpoint requires session cookies.    headers: await headers(),});
```

| Prop | Description | Type |
| --- | --- | --- |
| `roleName?` | The name of the role to update. Alternatively, you can pass a `roleId` parameter instead. | `string` |
| `roleId?` | The id of the role to update. Alternatively, you can pass a `roleName` parameter instead. | `string` |
| `organizationId?` | The organization ID which the role will be updated in. Defaults to the active organization. | `string` |
| `data` | The data which will be updated | `Object` |
| `data.permission?` | Optionally update the permissions of the role. | `Record<string, string[]>` |
| `data.roleName?` | Optionally update the name of the role. | `string` |

### [Configuration Options](https://www.better-auth.com/docs/plugins/organization\#configuration-options)

Below is a list of options that can be passed to the `dynamicAccessControl` object.

#### [`enabled`](https://www.better-auth.com/docs/plugins/organization\#enabled)

This option is used to enable or disable dynamic access control. By default, it is disabled.

```
organization({
  dynamicAccessControl: {
    enabled: true
  }
})
```

#### [`maximumRolesPerOrganization`](https://www.better-auth.com/docs/plugins/organization\#maximumrolesperorganization)

This option is used to limit the number of roles that can be created for an organization.

By default, the maximum number of roles that can be created for an organization is infinite.

```
organization({
  dynamicAccessControl: {
    maximumRolesPerOrganization: 10
  }
})
```

You can also pass a function that returns a number.

```
organization({
  dynamicAccessControl: {
    maximumRolesPerOrganization: async (organizationId) => {
      const organization = await getOrganization(organizationId);
      return organization.plan === "pro" ? 100 : 10;
    }
  }
})
```

### [Additional Fields](https://www.better-auth.com/docs/plugins/organization\#additional-fields)

To add additional fields to the `organizationRole` table, you can pass the `additionalFields` configuration option to the `organization` plugin.

```
organization({
  schema: {
    organizationRole: {
      additionalFields: {
        // Role colors!
        color: {
          type: "string",
          defaultValue: "#ffffff",
        },
        //... other fields
      },
    },
  },
})
```

Then, if you don't already use `inferOrgAdditionalFields` to infer the additional fields, you can use it to infer the additional fields.

auth-client.ts

```
import { createAuthClient } from "better-auth/client"
import { organizationClient, inferOrgAdditionalFields } from "better-auth/client/plugins"
import type { auth } from "./auth"

export const authClient = createAuthClient({
    plugins: [\
        organizationClient({\
            schema: inferOrgAdditionalFields<typeof auth>()\
        })\
    ]
})
```

Otherwise, you can pass the schema values directly, the same way you do on the org plugin in the server.

auth-client.ts

```
import { createAuthClient } from "better-auth/client"
import { organizationClient } from "better-auth/client/plugins"

export const authClient = createAuthClient({
    plugins: [\
        organizationClient({\
            schema: {\
                organizationRole: {\
                    additionalFields: {\
                        color: {\
                            type: "string",\
                            defaultValue: "#ffffff",\
                        }\
                    }\
                }\
            }\
        })\
    ]
})
```

* * *

## [Teams](https://www.better-auth.com/docs/plugins/organization\#teams)

Teams allow you to group members within an organization. The teams feature provides additional organization structure and can be used to manage permissions at a more granular level.

### [Enabling Teams](https://www.better-auth.com/docs/plugins/organization\#enabling-teams)

To enable teams, pass the `teams` configuration option to both server and client plugins:

auth.ts

```
import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";

export const auth = betterAuth({
  plugins: [\
    organization({\
      teams: {\
        enabled: true,\
        maximumTeams: 10, // Optional: limit teams per organization\
        allowRemovingAllTeams: false, // Optional: prevent removing the last team\
      },\
    }),\
  ],
});
```

auth-client.ts

```
import { createAuthClient } from "better-auth/client";
import { organizationClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [\
    organizationClient({\
      teams: {\
        enabled: true,\
      },\
    }),\
  ],
});
```

### [Managing Teams](https://www.better-auth.com/docs/plugins/organization\#managing-teams)

#### [Create Team](https://www.better-auth.com/docs/plugins/organization\#create-team)

Create a new team within an organization:

ClientServer

POST

/organization/create-team

```
const { data, error } = await authClient.organization.createTeam({    name: "my-team", // required    organizationId: "organization-id",});
```

| Prop | Description | Type |
| --- | --- | --- |
| `name` | The name of the team. | `string` |
| `organizationId?` | The organization ID which the team will be created in. Defaults to the active organization. | `string` |

POST

/organization/create-team

```
const data = await auth.api.createTeam({    body: {        name: "my-team", // required        organizationId: "organization-id",    },});
```

| Prop | Description | Type |
| --- | --- | --- |
| `name` | The name of the team. | `string` |
| `organizationId?` | The organization ID which the team will be created in. Defaults to the active organization. | `string` |

#### [List Teams](https://www.better-auth.com/docs/plugins/organization\#list-teams)

Get all teams in an organization:

ClientServer

GET

/organization/list-teams

```
const { data, error } = await authClient.organization.listTeams({    query: {        organizationId: "organization-id",    },});
```

| Prop | Description | Type |
| --- | --- | --- |
| `query?` | Query parameters for filtering or scoping the list of teams. | `Object` |
| `query.organizationId?` | The organization ID which the teams are under to list. Defaults to the user's active organization. | `string` |

GET

/organization/list-teams

```
const data = await auth.api.listOrganizationTeams({    query: {        query: {            organizationId: "organization-id",        },    },    // This endpoint requires session cookies.    headers: await headers(),});
```

| Prop | Description | Type |
| --- | --- | --- |
| `query?` | Query parameters for filtering or scoping the list of teams. | `Object` |
| `query.organizationId?` | The organization ID which the teams are under to list. Defaults to the user's active organization. | `string` |

#### [Update Team](https://www.better-auth.com/docs/plugins/organization\#update-team)

Update a team's details:

ClientServer

POST

/organization/update-team

```
const { data, error } = await authClient.organization.updateTeam({    teamId: "team-id", // required    data: { // required        name: "My new team name",        organizationId: "My new organization ID for this team",        createdAt: new Date(),        updatedAt: new Date(),    },});
```

| Prop | Description | Type |
| --- | --- | --- |
| `teamId` | The ID of the team to be updated. | `string` |
| `data` | A partial object containing options for you to update. | `Object` |
| `data.name?` | The name of the team to be updated. | `string` |
| `data.organizationId?` | The organization ID which the team falls under. | `string` |
| `data.createdAt?` | The timestamp of when the team was created. | `Date` |
| `data.updatedAt?` | The timestamp of when the team was last updated. | `Date` |

POST

/organization/update-team

```
const data = await auth.api.updateTeam({    body: {        teamId: "team-id", // required        data: { // required            name: "My new team name",            organizationId: "My new organization ID for this team",            createdAt: new Date(),            updatedAt: new Date(),        },    },    // This endpoint requires session cookies.    headers: await headers(),});
```

| Prop | Description | Type |
| --- | --- | --- |
| `teamId` | The ID of the team to be updated. | `string` |
| `data` | A partial object containing options for you to update. | `Object` |
| `data.name?` | The name of the team to be updated. | `string` |
| `data.organizationId?` | The organization ID which the team falls under. | `string` |
| `data.createdAt?` | The timestamp of when the team was created. | `Date` |
| `data.updatedAt?` | The timestamp of when the team was last updated. | `Date` |

#### [Remove Team](https://www.better-auth.com/docs/plugins/organization\#remove-team)

Delete a team from an organization:

ClientServer

POST

/organization/remove-team

```
const { data, error } = await authClient.organization.removeTeam({    teamId: "team-id", // required    organizationId: "organization-id",});
```

| Prop | Description | Type |
| --- | --- | --- |
| `teamId` | The team ID of the team to remove. | `string` |
| `organizationId?` | The organization ID which the team falls under. If not provided, it will default to the user's active organization. | `string` |

POST

/organization/remove-team

```
const data = await auth.api.removeTeam({    body: {        teamId: "team-id", // required        organizationId: "organization-id",    },});
```

| Prop | Description | Type |
| --- | --- | --- |
| `teamId` | The team ID of the team to remove. | `string` |
| `organizationId?` | The organization ID which the team falls under. If not provided, it will default to the user's active organization. | `string` |

#### [Set Active Team](https://www.better-auth.com/docs/plugins/organization\#set-active-team)

Sets the given team as the current active team. If `teamId` is `null` the current active team is unset.

ClientServer

POST

/organization/set-active-team

```
const { data, error } = await authClient.organization.setActiveTeam({    teamId: "team-id",});
```

| Prop | Description | Type |
| --- | --- | --- |
| `teamId?` | The team ID of the team to set as the current active team. | `string` |

POST

/organization/set-active-team

```
const data = await auth.api.setActiveTeam({    body: {        teamId: "team-id",    },});
```

| Prop | Description | Type |
| --- | --- | --- |
| `teamId?` | The team ID of the team to set as the current active team. | `string` |

#### [List User Teams](https://www.better-auth.com/docs/plugins/organization\#list-user-teams)

List all teams that the current user is a part of.

ClientServer

GET

/organization/list-user-teams

```
const { data, error } = await authClient.organization.listUserTeams();
```

GET

/organization/list-user-teams

```
const data = await auth.api.listUserTeams();
```

#### [List Team Members](https://www.better-auth.com/docs/plugins/organization\#list-team-members)

List the members of the given team.

ClientServer

POST

/organization/list-team-members

```
const { data, error } = await authClient.organization.listTeamMembers({    teamId: "team-id",});
```

| Prop | Description | Type |
| --- | --- | --- |
| `teamId?` | The team whose members we should return. If this is not provided the members of the current active team get returned. | `string` |

POST

/organization/list-team-members

```
const data = await auth.api.listTeamMembers({    body: {        teamId: "team-id",    },});
```

| Prop | Description | Type |
| --- | --- | --- |
| `teamId?` | The team whose members we should return. If this is not provided the members of the current active team get returned. | `string` |

#### [Add Team Member](https://www.better-auth.com/docs/plugins/organization\#add-team-member)

Add a member to a team.

ClientServer

POST

/organization/add-team-member

```
const { data, error } = await authClient.organization.addTeamMember({    teamId: "team-id", // required    userId: "user-id", // required});
```

| Prop | Description | Type |
| --- | --- | --- |
| `teamId` | The team the user should be a member of. | `string` |
| `userId` | The user ID which represents the user to be added as a member. | `string` |

POST

/organization/add-team-member

```
const data = await auth.api.addTeamMember({    body: {        teamId: "team-id", // required        userId: "user-id", // required    },});
```

| Prop | Description | Type |
| --- | --- | --- |
| `teamId` | The team the user should be a member of. | `string` |
| `userId` | The user ID which represents the user to be added as a member. | `string` |

#### [Remove Team Member](https://www.better-auth.com/docs/plugins/organization\#remove-team-member)

Remove a member from a team.

ClientServer

POST

/organization/remove-team-member

```
const { data, error } = await authClient.organization.removeTeamMember({    teamId: "team-id", // required    userId: "user-id", // required});
```

| Prop | Description | Type |
| --- | --- | --- |
| `teamId` | The team the user should be removed from. | `string` |
| `userId` | The user which should be removed from the team. | `string` |

POST

/organization/remove-team-member

```
const data = await auth.api.removeTeamMember({    body: {        teamId: "team-id", // required        userId: "user-id", // required    },});
```

| Prop | Description | Type |
| --- | --- | --- |
| `teamId` | The team the user should be removed from. | `string` |
| `userId` | The user which should be removed from the team. | `string` |

### [Team Permissions](https://www.better-auth.com/docs/plugins/organization\#team-permissions)

Teams follow the organization's permission system. To manage teams, users need the following permissions:

- `team:create` \- Create new teams
- `team:update` \- Update team details
- `team:delete` \- Remove teams

By default:

- Organization owners and admins can manage teams
- Regular members cannot create, update, or delete teams

### [Team Configuration Options](https://www.better-auth.com/docs/plugins/organization\#team-configuration-options)

The teams feature supports several configuration options:

- `maximumTeams`: Limit the number of teams per organization










```
teams: {
    enabled: true,
    maximumTeams: 10 // Fixed number
    // OR
    maximumTeams: async ({ organizationId, session }, request) => {
      // Dynamic limit based on organization plan
      const plan = await getPlan(organizationId)
      return plan === 'pro' ? 20 : 5
    },
    maximumMembersPerTeam: 10 // Fixed number
    // OR
    maximumMembersPerTeam: async ({ teamId, session, organizationId }, request) => {
      // Dynamic limit based on team plan
      const plan = await getPlan(organizationId, teamId)
      return plan === 'pro' ? 50 : 10
    },
}
```

- `allowRemovingAllTeams`: Control whether the last team can be removed










```
teams: {
    enabled: true,
    allowRemovingAllTeams: false // Prevent removing the last team
}
```


### [Team Members](https://www.better-auth.com/docs/plugins/organization\#team-members)

When inviting members to an organization, you can specify a team:

```
await authClient.organization.inviteMember({
  email: "user@example.com",
  role: "member",
  teamId: "team-id",
});
```

The invited member will be added to the specified team upon accepting the invitation.

### [Database Schema](https://www.better-auth.com/docs/plugins/organization\#database-schema)

When teams are enabled, new `team` and `teamMember` tables are added to the database.

Table Name: `team`

| Field Name | Type | Key | Description |
| --- | --- | --- | --- |
| id | string | PK | Unique identifier for each team |
| name | string | - | The name of the team |
| organizationId | string | FK | The ID of the organization |
| createdAt | Date | - | Timestamp of when the team was created |
| updatedAt | Date | ? | Timestamp of when the team was created |

Table Name: `teamMember`

| Field Name | Type | Key | Description |
| --- | --- | --- | --- |
| id | string | PK | Unique identifier for each team member |
| teamId | string | FK | Unique identifier for each team |
| userId | string | FK | The ID of the user |
| createdAt | Date | - | Timestamp of when the team member was created |

## [Schema](https://www.better-auth.com/docs/plugins/organization\#schema)

The organization plugin adds the following tables to the database:

### [Organization](https://www.better-auth.com/docs/plugins/organization\#organization-1)

Table Name: `organization`

| Field Name | Type | Key | Description |
| --- | --- | --- | --- |
| id | string | PK | Unique identifier for each organization |
| name | string | - | The name of the organization |
| slug | string | - | The slug of the organization |
| logo | string | ? | The logo of the organization |
| metadata | string | ? | Additional metadata for the organization |
| createdAt | Date | - | Timestamp of when the organization was created |

### [Member](https://www.better-auth.com/docs/plugins/organization\#member)

Table Name: `member`

| Field Name | Type | Key | Description |
| --- | --- | --- | --- |
| id | string | PK | Unique identifier for each member |
| userId | string | FK | The ID of the user |
| organizationId | string | FK | The ID of the organization |
| role | string | - | The role of the user in the organization |
| createdAt | Date | - | Timestamp of when the member was added to the organization |

### [Invitation](https://www.better-auth.com/docs/plugins/organization\#invitation)

Table Name: `invitation`

| Field Name | Type | Key | Description |
| --- | --- | --- | --- |
| id | string | PK | Unique identifier for each invitation |
| email | string | - | The email address of the user |
| inviterId | string | FK | The ID of the inviter |
| organizationId | string | FK | The ID of the organization |
| role | string | - | The role of the user in the organization |
| status | string | - | The status of the invitation |
| expiresAt | Date | - | Timestamp of when the invitation expires |

If teams are enabled, you need to add the following fields to the invitation table:

| Field Name | Type | Key | Description |
| --- | --- | --- | --- |
| teamId | string | ? | The ID of the team |

### [Session](https://www.better-auth.com/docs/plugins/organization\#session)

Table Name: `session`

You need to add two more fields to the session table to store the active organization ID and the active team ID.

| Field Name | Type | Key | Description |
| --- | --- | --- | --- |
| activeOrganizationId | string | ? | The ID of the active organization |
| activeTeamId | string | ? | The ID of the active team |

### [Teams (optional)](https://www.better-auth.com/docs/plugins/organization\#teams-optional)

Table Name: `team`

| Field Name | Type | Key | Description |
| --- | --- | --- | --- |
| id | string | PK | Unique identifier for each team |
| name | string | - | The name of the team |
| organizationId | string | FK | The ID of the organization |
| createdAt | Date | - | Timestamp of when the team was created |
| updatedAt | Date | ? | Timestamp of when the team was created |

Table Name: `teamMember`

| Field Name | Type | Key | Description |
| --- | --- | --- | --- |
| id | string | PK | Unique identifier for each team member |
| teamId | string | FK | Unique identifier for each team |
| userId | string | FK | The ID of the user |
| createdAt | Date | - | Timestamp of when the team member was created |

Table Name: `invitation`

| Field Name | Type | Key | Description |
| --- | --- | --- | --- |
| teamId | string | ? | The ID of the team |

### [Customizing the Schema](https://www.better-auth.com/docs/plugins/organization\#customizing-the-schema)

To change the schema table name or fields, you can pass `schema` option to the organization plugin.

auth.ts

```
const auth = betterAuth({
  plugins: [\
    organization({\
      schema: {\
        organization: {\
          modelName: "organizations", //map the organization table to organizations\
          fields: {\
            name: "title", //map the name field to title\
          },\
          additionalFields: {\
            // Add a new field to the organization table\
            myCustomField: {\
              type: "string",\
              input: true,\
              required: false,\
            },\
          },\
        },\
      },\
    }),\
  ],
});
```

#### [Additional Fields](https://www.better-auth.com/docs/plugins/organization\#additional-fields-1)

Starting with [Better Auth v1.3](https://github.com/better-auth/better-auth/releases/tag/v1.3.0), you can easily add custom fields to the `organization`, `invitation`, `member`, and `team` tables.

When you add extra fields to a model, the relevant API endpoints will automatically accept and return these new properties. For instance, if you add a custom field to the `organization` table, the `createOrganization` endpoint will include this field in its request and response payloads as needed.

auth.ts

```
const auth = betterAuth({
  plugins: [\
    organization({\
      schema: {\
        organization: {\
          additionalFields: {\
            myCustomField: {\
              type: "string",\
              input: true,\
              required: false,\
            },\
          },\
        },\
      },\
    }),\
  ],
});
```

For inferring the additional fields, you can use the `inferOrgAdditionalFields` function. This function will infer the additional fields from the auth object type.

auth-client.ts

```
import { createAuthClient } from "better-auth/client";
import {
  inferOrgAdditionalFields,
  organizationClient,
} from "better-auth/client/plugins";
import type { auth } from "@/auth"; // import the auth object type only

const client = createAuthClient({
  plugins: [\
    organizationClient({\
      schema: inferOrgAdditionalFields<typeof auth>(),\
    }),\
  ],
});
```

if you can't import the auth object type, you can use the `inferOrgAdditionalFields` function without the generic. This function will infer the additional fields from the schema object.

auth-client.ts

```
const client = createAuthClient({
  plugins: [\
    organizationClient({\
      schema: inferOrgAdditionalFields({\
        organization: {\
          additionalFields: {\
            newField: {\
              type: "string",\
            },\
          },\
        },\
      }),\
    }),\
  ],
});

//example usage
await client.organization.create({
  name: "Test",
  slug: "test",
  newField: "123", //this should be allowed
  //@ts-expect-error - this field is not available
  unavalibleField: "123", //this should be not allowed
});
```

## [Options](https://www.better-auth.com/docs/plugins/organization\#options)

**allowUserToCreateOrganization**: `boolean` \| `((user: User) => Promise<boolean> | boolean)` \- A function that determines whether a user can create an organization. By default, it's `true`. You can set it to `false` to restrict users from creating organizations.

**organizationLimit**: `number` \| `((user: User) => Promise<boolean> | boolean)` \- The maximum number of organizations allowed for a user. By default, it's `5`. You can set it to any number you want or a function that returns a boolean.

**creatorRole**: `admin | owner` \- The role of the user who creates the organization. By default, it's `owner`. You can set it to `admin`.

**membershipLimit**: `number` \- The maximum number of members allowed in an organization. By default, it's `100`. You can set it to any number you want.

**sendInvitationEmail**: `async (data) => Promise<void>` \- A function that sends an invitation email to the user.

**invitationExpiresIn** : `number` \- How long the invitation link is valid for in seconds. By default, it's 48 hours (2 days).

**cancelPendingInvitationsOnReInvite**: `boolean` \- Whether to cancel pending invitations if the user is already invited to the organization. By default, it's `false`.

**invitationLimit**: `number` \| `((user: User) => Promise<boolean> | boolean)` \- The maximum number of invitations allowed for a user. By default, it's `100`. You can set it to any number you want or a function that returns a boolean.

**requireEmailVerificationOnInvitation**: `boolean` \- Whether to require email verification before accepting or rejecting invitations. By default, it's `false`. When enabled, users must have verified their email address before they can accept or reject organization invitations.

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/plugins/organization.mdx)

[Previous Page\\
\\
MCP](https://www.better-auth.com/docs/plugins/mcp) [Next Page\\
\\
Enterprise](https://www.better-auth.com/docs/plugins/organization)

### On this page

[Installation](https://www.better-auth.com/docs/plugins/organization#installation) [Add the plugin to your **auth** config](https://www.better-auth.com/docs/plugins/organization#add-the-plugin-to-your-auth-config) [Migrate the database](https://www.better-auth.com/docs/plugins/organization#migrate-the-database) [Add the client plugin](https://www.better-auth.com/docs/plugins/organization#add-the-client-plugin) [Usage](https://www.better-auth.com/docs/plugins/organization#usage) [Organization](https://www.better-auth.com/docs/plugins/organization#organization) [Create an organization](https://www.better-auth.com/docs/plugins/organization#create-an-organization) [Restrict who can create an organization](https://www.better-auth.com/docs/plugins/organization#restrict-who-can-create-an-organization) [Check if organization slug is taken](https://www.better-auth.com/docs/plugins/organization#check-if-organization-slug-is-taken) [Organization Hooks](https://www.better-auth.com/docs/plugins/organization#organization-hooks) [Organization Creation and Management Hooks](https://www.better-auth.com/docs/plugins/organization#organization-creation-and-management-hooks) [Member Hooks](https://www.better-auth.com/docs/plugins/organization#member-hooks) [Invitation Hooks](https://www.better-auth.com/docs/plugins/organization#invitation-hooks) [Team Hooks](https://www.better-auth.com/docs/plugins/organization#team-hooks) [Hook Error Handling](https://www.better-auth.com/docs/plugins/organization#hook-error-handling) [List User's Organizations](https://www.better-auth.com/docs/plugins/organization#list-users-organizations) [Active Organization](https://www.better-auth.com/docs/plugins/organization#active-organization) [Set Active Organization](https://www.better-auth.com/docs/plugins/organization#set-active-organization) [Use Active Organization](https://www.better-auth.com/docs/plugins/organization#use-active-organization) [Get Full Organization](https://www.better-auth.com/docs/plugins/organization#get-full-organization) [Update Organization](https://www.better-auth.com/docs/plugins/organization#update-organization) [Delete Organization](https://www.better-auth.com/docs/plugins/organization#delete-organization) [Invitations](https://www.better-auth.com/docs/plugins/organization#invitations) [Setup Invitation Email](https://www.better-auth.com/docs/plugins/organization#setup-invitation-email) [Send Invitation](https://www.better-auth.com/docs/plugins/organization#send-invitation) [Accept Invitation](https://www.better-auth.com/docs/plugins/organization#accept-invitation) [Email Verification Requirement](https://www.better-auth.com/docs/plugins/organization#email-verification-requirement) [Invitation Accepted Callback](https://www.better-auth.com/docs/plugins/organization#invitation-accepted-callback) [Cancel Invitation](https://www.better-auth.com/docs/plugins/organization#cancel-invitation) [Reject Invitation](https://www.better-auth.com/docs/plugins/organization#reject-invitation) [Get Invitation](https://www.better-auth.com/docs/plugins/organization#get-invitation) [List Invitations](https://www.better-auth.com/docs/plugins/organization#list-invitations) [List user invitations](https://www.better-auth.com/docs/plugins/organization#list-user-invitations) [Members](https://www.better-auth.com/docs/plugins/organization#members) [List Members](https://www.better-auth.com/docs/plugins/organization#list-members) [Remove Member](https://www.better-auth.com/docs/plugins/organization#remove-member) [Update Member Role](https://www.better-auth.com/docs/plugins/organization#update-member-role) [Get Active Member](https://www.better-auth.com/docs/plugins/organization#get-active-member) [Get Active Member Role](https://www.better-auth.com/docs/plugins/organization#get-active-member-role) [Add Member](https://www.better-auth.com/docs/plugins/organization#add-member) [Leave Organization](https://www.better-auth.com/docs/plugins/organization#leave-organization) [Access Control](https://www.better-auth.com/docs/plugins/organization#access-control) [Roles](https://www.better-auth.com/docs/plugins/organization#roles) [Permissions](https://www.better-auth.com/docs/plugins/organization#permissions) [Custom Permissions](https://www.better-auth.com/docs/plugins/organization#custom-permissions) [Create Access Control](https://www.better-auth.com/docs/plugins/organization#create-access-control) [Create Roles](https://www.better-auth.com/docs/plugins/organization#create-roles) [Pass Roles to the Plugin](https://www.better-auth.com/docs/plugins/organization#pass-roles-to-the-plugin) [Access Control Usage](https://www.better-auth.com/docs/plugins/organization#access-control-usage) [Dynamic Access Control](https://www.better-auth.com/docs/plugins/organization#dynamic-access-control) [Enabling Dynamic Access Control](https://www.better-auth.com/docs/plugins/organization#enabling-dynamic-access-control) [Creating a role](https://www.better-auth.com/docs/plugins/organization#creating-a-role) [Deleting a role](https://www.better-auth.com/docs/plugins/organization#deleting-a-role) [Listing roles](https://www.better-auth.com/docs/plugins/organization#listing-roles) [Getting a specific role](https://www.better-auth.com/docs/plugins/organization#getting-a-specific-role) [Updating a role](https://www.better-auth.com/docs/plugins/organization#updating-a-role) [Configuration Options](https://www.better-auth.com/docs/plugins/organization#configuration-options) [`enabled`](https://www.better-auth.com/docs/plugins/organization#enabled) [`maximumRolesPerOrganization`](https://www.better-auth.com/docs/plugins/organization#maximumrolesperorganization) [Additional Fields](https://www.better-auth.com/docs/plugins/organization#additional-fields) [Teams](https://www.better-auth.com/docs/plugins/organization#teams) [Enabling Teams](https://www.better-auth.com/docs/plugins/organization#enabling-teams) [Managing Teams](https://www.better-auth.com/docs/plugins/organization#managing-teams) [Create Team](https://www.better-auth.com/docs/plugins/organization#create-team) [List Teams](https://www.better-auth.com/docs/plugins/organization#list-teams) [Update Team](https://www.better-auth.com/docs/plugins/organization#update-team) [Remove Team](https://www.better-auth.com/docs/plugins/organization#remove-team) [Set Active Team](https://www.better-auth.com/docs/plugins/organization#set-active-team) [List User Teams](https://www.better-auth.com/docs/plugins/organization#list-user-teams) [List Team Members](https://www.better-auth.com/docs/plugins/organization#list-team-members) [Add Team Member](https://www.better-auth.com/docs/plugins/organization#add-team-member) [Remove Team Member](https://www.better-auth.com/docs/plugins/organization#remove-team-member) [Team Permissions](https://www.better-auth.com/docs/plugins/organization#team-permissions) [Team Configuration Options](https://www.better-auth.com/docs/plugins/organization#team-configuration-options) [Team Members](https://www.better-auth.com/docs/plugins/organization#team-members) [Database Schema](https://www.better-auth.com/docs/plugins/organization#database-schema) [Schema](https://www.better-auth.com/docs/plugins/organization#schema) [Organization](https://www.better-auth.com/docs/plugins/organization#organization-1) [Member](https://www.better-auth.com/docs/plugins/organization#member) [Invitation](https://www.better-auth.com/docs/plugins/organization#invitation) [Session](https://www.better-auth.com/docs/plugins/organization#session) [Teams (optional)](https://www.better-auth.com/docs/plugins/organization#teams-optional) [Customizing the Schema](https://www.better-auth.com/docs/plugins/organization#customizing-the-schema) [Additional Fields](https://www.better-auth.com/docs/plugins/organization#additional-fields-1) [Options](https://www.better-auth.com/docs/plugins/organization#options)