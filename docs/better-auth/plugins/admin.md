---
title: Admin | Better Auth
url: 
description: Admin plugin for Better Auth
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

# Admin

Copy MarkdownOpen in

The Admin plugin provides a set of administrative functions for user management in your application. It allows administrators to perform various operations such as creating users, managing user roles, banning/unbanning users, impersonating users, and more.

## [Installation](https://www.better-auth.com/docs/plugins/admin\#installation)

### [Add the plugin to your auth config](https://www.better-auth.com/docs/plugins/admin\#add-the-plugin-to-your-auth-config)

To use the Admin plugin, add it to your auth config.

auth.ts

```
import { betterAuth } from "better-auth"
import { admin } from "better-auth/plugins"

export const auth = betterAuth({
    // ... other config options
    plugins: [\
        admin()\
    ]
})
```

### [Migrate the database](https://www.better-auth.com/docs/plugins/admin\#migrate-the-database)

Run the migration or generate the schema to add the necessary fields and tables to the database.

migrategenerate

```
npx @better-auth/cli migrate
```

```
npx @better-auth/cli generate
```

See the [Schema](https://www.better-auth.com/docs/plugins/admin#schema) section to add the fields manually.

### [Add the client plugin](https://www.better-auth.com/docs/plugins/admin\#add-the-client-plugin)

Next, include the admin client plugin in your authentication client instance.

auth-client.ts

```
import { createAuthClient } from "better-auth/client"
import { adminClient } from "better-auth/client/plugins"

export const authClient = createAuthClient({
    plugins: [\
        adminClient()\
    ]
})
```

## [Usage](https://www.better-auth.com/docs/plugins/admin\#usage)

Before performing any admin operations, the user must be authenticated with an admin account. An admin is any user assigned the `admin` role or any user whose ID is included in the `adminUserIds` option.

### [Create User](https://www.better-auth.com/docs/plugins/admin\#create-user)

Allows an admin to create a new user.

ClientServer

POST

/admin/create-user

```
const { data: newUser, error } = await authClient.admin.createUser({
    email: "user@example.com", // required
    password: "some-secure-password", // required
    name: "James Smith", // required
    role: "user",
    data: { customField: "customValue" },
});
```

| Prop | Description | Type |
| --- | --- | --- |
| `email` | The email of the user. | `string` |
| `password` | The password of the user. | `string` |
| `name` | The name of the user. | `string` |
| `role?` | A string or array of strings representing the roles to apply to the new user. | `string | string[]` |
| `data?` | Extra fields for the user. Including custom additional fields. | `Record<string, any>` |

POST

/admin/create-user

```
const newUser = await auth.api.createUser({
    body: {
        email: "user@example.com", // required
        password: "some-secure-password", // required
        name: "James Smith", // required
        role: "user",
        data: { customField: "customValue" },
    },
});
```

| Prop | Description | Type |
| --- | --- | --- |
| `email` | The email of the user. | `string` |
| `password` | The password of the user. | `string` |
| `name` | The name of the user. | `string` |
| `role?` | A string or array of strings representing the roles to apply to the new user. | `string | string[]` |
| `data?` | Extra fields for the user. Including custom additional fields. | `Record<string, any>` |

### [List Users](https://www.better-auth.com/docs/plugins/admin\#list-users)

Allows an admin to list all users in the database.

ClientServer

GET

/admin/list-users

Notes

All properties are optional to configure. By default, 100 rows are returned, you can configure this by the `limit` property.

```
const { data: users, error } = await authClient.admin.listUsers({
    query: {
        searchValue: "some name",
        searchField: "name",
        searchOperator: "contains",
        limit: 100,
        offset: 100,
        sortBy: "name",
        sortDirection: "desc",
        filterField: "email",
        filterValue: "hello@example.com",
        filterOperator: "eq",
    },
});
```

| Prop | Description | Type |
| --- | --- | --- |
| `query?` | Query parameters for filtering, searching, and pagination. | `Object` |
| `query.searchValue?` | The value to search for. | `string` |
| `query.searchField?` | The field to search in, defaults to email. Can be `email` or `name`. | `"email" | "name"` |
| `query.searchOperator?` | The operator to use for the search. Can be `contains`, `starts_with` or `ends_with`. | `"contains" | "starts_with" | "ends_with"` |
| `query.limit?` | The number of users to return. Defaults to 100. | `string | number` |
| `query.offset?` | The offset to start from. | `string | number` |
| `query.sortBy?` | The field to sort by. | `string` |
| `query.sortDirection?` | The direction to sort by. | `"asc" | "desc"` |
| `query.filterField?` | The field to filter by. | `string` |
| `query.filterValue?` | The value to filter by. | `string | number | boolean` |
| `query.filterOperator?` | The operator to use for the filter. | `"eq" | "ne" | "lt" | "lte" | "gt" | "gte"` |

GET

/admin/list-users

Notes

All properties are optional to configure. By default, 100 rows are returned, you can configure this by the `limit` property.

```
const users = await auth.api.listUsers({
    query: {
        query: {
            searchValue: "some name",
            searchField: "name",
            searchOperator: "contains",
            limit: 100,
            offset: 100,
            sortBy: "name",
            sortDirection: "desc",
            filterField: "email",
            filterValue: "hello@example.com",
            filterOperator: "eq",
        },
    },
    // This endpoint requires session cookies.
    headers: await headers(),
});
```

| Prop | Description | Type |
| --- | --- | --- |
| `query?` | Query parameters for filtering, searching, and pagination. | `Object` |
| `query.searchValue?` | The value to search for. | `string` |
| `query.searchField?` | The field to search in, defaults to email. Can be `email` or `name`. | `"email" | "name"` |
| `query.searchOperator?` | The operator to use for the search. Can be `contains`, `starts_with` or `ends_with`. | `"contains" | "starts_with" | "ends_with"` |
| `query.limit?` | The number of users to return. Defaults to 100. | `string | number` |
| `query.offset?` | The offset to start from. | `string | number` |
| `query.sortBy?` | The field to sort by. | `string` |
| `query.sortDirection?` | The direction to sort by. | `"asc" | "desc"` |
| `query.filterField?` | The field to filter by. | `string` |
| `query.filterValue?` | The value to filter by. | `string | number | boolean` |
| `query.filterOperator?` | The operator to use for the filter. | `"eq" | "ne" | "lt" | "lte" | "gt" | "gte"` |

#### [Query Filtering](https://www.better-auth.com/docs/plugins/admin\#query-filtering)

The `listUsers` function supports various filter operators including `eq`, `contains`, `starts_with`, and `ends_with`.

#### [Pagination](https://www.better-auth.com/docs/plugins/admin\#pagination)

The `listUsers` function supports pagination by returning metadata alongside the user list. The response includes the following fields:

```
{
  users: User[],   // Array of returned users
  total: number,   // Total number of users after filters and search queries
  limit: number | undefined,   // The limit provided in the query
  offset: number | undefined   // The offset provided in the query
}
```

##### [How to Implement Pagination](https://www.better-auth.com/docs/plugins/admin\#how-to-implement-pagination)

To paginate results, use the `total`, `limit`, and `offset` values to calculate:

- **Total pages:** `Math.ceil(total / limit)`
- **Current page:** `(offset / limit) + 1`
- **Next page offset:** `Math.min(offset + limit, (total - 1))` – The value to use as `offset` for the next page, ensuring it does not exceed the total number of pages.
- **Previous page offset:** `Math.max(0, offset - limit)` – The value to use as `offset` for the previous page (ensuring it doesn’t go below zero).

##### [Example Usage](https://www.better-auth.com/docs/plugins/admin\#example-usage)

Fetching the second page with 10 users per page:

admin.ts

```
const pageSize = 10;
const currentPage = 2;

const users = await authClient.admin.listUsers({
    query: {
        limit: pageSize,
        offset: (currentPage - 1) * pageSize
    }
});

const totalUsers = users.total;
const totalPages = Math.ceil(totalUsers / pageSize)
```

### [Set User Role](https://www.better-auth.com/docs/plugins/admin\#set-user-role)

Changes the role of a user.

ClientServer

POST

/admin/set-role

```
const { data, error } = await authClient.admin.setRole({
    userId: "user-id",
    role: "admin", // required
});
```

| Prop | Description | Type |
| --- | --- | --- |
| `userId?` | The user id which you want to set the role for. | `string` |
| `role` | The role to set, this can be a string or an array of strings. | `string | string[]` |

POST

/admin/set-role

```
const data = await auth.api.setRole({
    body: {
        userId: "user-id",
        role: "admin", // required
    },
    // This endpoint requires session cookies.
    headers: await headers(),
});
```

| Prop | Description | Type |
| --- | --- | --- |
| `userId?` | The user id which you want to set the role for. | `string` |
| `role` | The role to set, this can be a string or an array of strings. | `string | string[]` |

### [Set User Password](https://www.better-auth.com/docs/plugins/admin\#set-user-password)

Changes the password of a user.

ClientServer

POST

/admin/set-user-password

```
const { data, error } = await authClient.admin.setUserPassword({
    newPassword: 'new-password', // required
    userId: 'user-id', // required
});
```

| Prop | Description | Type |
| --- | --- | --- |
| `newPassword` | The new password. | `string` |
| `userId` | The user id which you want to set the password for. | `string` |

POST

/admin/set-user-password

```
const data = await auth.api.setUserPassword({
    body: {
        newPassword: 'new-password', // required
        userId: 'user-id', // required
    },
    // This endpoint requires session cookies.
    headers: await headers(),
});
```

| Prop | Description | Type |
| --- | --- | --- |
| `newPassword` | The new password. | `string` |
| `userId` | The user id which you want to set the password for. | `string` |

### [Ban User](https://www.better-auth.com/docs/plugins/admin\#ban-user)

Bans a user, preventing them from signing in and revokes all of their existing sessions.

ClientServer

POST

/admin/ban-user

```
await authClient.admin.banUser({
    userId: "user-id", // required
    banReason: "Spamming",
    banExpiresIn: 60 * 60 * 24 * 7,
});
```

| Prop | Description | Type |
| --- | --- | --- |
| `userId` | The user id which you want to ban. | `string` |
| `banReason?` | The reason for the ban. | `string` |
| `banExpiresIn?` | The number of seconds until the ban expires. If not provided, the ban will never expire. | `number` |

POST

/admin/ban-user

```
await auth.api.banUser({
    body: {
        userId: "user-id", // required
        banReason: "Spamming",
        banExpiresIn: 60 * 60 * 24 * 7,
    },
    // This endpoint requires session cookies.
    headers: await headers(),
});
```

| Prop | Description | Type |
| --- | --- | --- |
| `userId` | The user id which you want to ban. | `string` |
| `banReason?` | The reason for the ban. | `string` |
| `banExpiresIn?` | The number of seconds until the ban expires. If not provided, the ban will never expire. | `number` |

### [Unban User](https://www.better-auth.com/docs/plugins/admin\#unban-user)

Removes the ban from a user, allowing them to sign in again.

ClientServer

POST

/admin/unban-user

```
await authClient.admin.unbanUser({
    userId: "user-id", // required
});
```

| Prop | Description | Type |
| --- | --- | --- |
| `userId` | The user id which you want to unban. | `string` |

POST

/admin/unban-user

```
await auth.api.unbanUser({
    body: {
        userId: "user-id", // required
    },
    // This endpoint requires session cookies.
    headers: await headers(),
});
```

| Prop | Description | Type |
| --- | --- | --- |
| `userId` | The user id which you want to unban. | `string` |

### [List User Sessions](https://www.better-auth.com/docs/plugins/admin\#list-user-sessions)

Lists all sessions for a user.

ClientServer

POST

/admin/list-user-sessions

```
const { data, error } = await authClient.admin.listUserSessions({
    userId: "user-id", // required
});
```

| Prop | Description | Type |
| --- | --- | --- |
| `userId` | The user id. | `string` |

POST

/admin/list-user-sessions

```
const data = await auth.api.listUserSessions({
    body: {
        userId: "user-id", // required
    },
    // This endpoint requires session cookies.
    headers: await headers(),
});
```

| Prop | Description | Type |
| --- | --- | --- |
| `userId` | The user id. | `string` |

### [Revoke User Session](https://www.better-auth.com/docs/plugins/admin\#revoke-user-session)

Revokes a specific session for a user.

ClientServer

POST

/admin/revoke-user-session

```
const { data, error } = await authClient.admin.revokeUserSession({
    sessionToken: "session_token_here", // required
});
```

| Prop | Description | Type |
| --- | --- | --- |
| `sessionToken` | The session token which you want to revoke. | `string` |

POST

/admin/revoke-user-session

```
const data = await auth.api.revokeUserSession({
    body: {
        sessionToken: "session_token_here", // required
    },
    // This endpoint requires session cookies.
    headers: await headers(),
});
```

| Prop | Description | Type |
| --- | --- | --- |
| `sessionToken` | The session token which you want to revoke. | `string` |

### [Revoke All Sessions for a User](https://www.better-auth.com/docs/plugins/admin\#revoke-all-sessions-for-a-user)

Revokes all sessions for a user.

ClientServer

POST

/admin/revoke-user-sessions

```
const { data, error } = await authClient.admin.revokeUserSessions({
    userId: "user-id", // required
});
```

| Prop | Description | Type |
| --- | --- | --- |
| `userId` | The user id which you want to revoke all sessions for. | `string` |

POST

/admin/revoke-user-sessions

```
const data = await auth.api.revokeUserSessions({
    body: {
        userId: "user-id", // required
    },
    // This endpoint requires session cookies.
    headers: await headers(),
});
```

| Prop | Description | Type |
| --- | --- | --- |
| `userId` | The user id which you want to revoke all sessions for. | `string` |

### [Impersonate User](https://www.better-auth.com/docs/plugins/admin\#impersonate-user)

This feature allows an admin to create a session that mimics the specified user. The session will remain active until either the browser session ends or it reaches 1 hour. You can change this duration by setting the `impersonationSessionDuration` option.

ClientServer

POST

/admin/impersonate-user

```
const { data, error } = await authClient.admin.impersonateUser({
    userId: "user-id", // required
});
```

| Prop | Description | Type |
| --- | --- | --- |
| `userId` | The user id which you want to impersonate. | `string` |

POST

/admin/impersonate-user

```
const data = await auth.api.impersonateUser({
    body: {
        userId: "user-id", // required
    },
    // This endpoint requires session cookies.
    headers: await headers(),
});
```

| Prop | Description | Type |
| --- | --- | --- |
| `userId` | The user id which you want to impersonate. | `string` |

### [Stop Impersonating User](https://www.better-auth.com/docs/plugins/admin\#stop-impersonating-user)

To stop impersonating a user and continue with the admin account, you can use `stopImpersonating`

ClientServer

POST

/admin/stop-impersonating

```
await authClient.admin.stopImpersonating();
```

POST

/admin/stop-impersonating

```
await auth.api.stopImpersonating({
    // This endpoint requires session cookies.
    headers: await headers(),
});
```

### [Remove User](https://www.better-auth.com/docs/plugins/admin\#remove-user)

Hard deletes a user from the database.

ClientServer

POST

/admin/remove-user

```
const { data: deletedUser, error } = await authClient.admin.removeUser({
    userId: "user-id", // required
});
```

| Prop | Description | Type |
| --- | --- | --- |
| `userId` | The user id which you want to remove. | `string` |

POST

/admin/remove-user

```
const deletedUser = await auth.api.removeUser({
    body: {
        userId: "user-id", // required
    },
    // This endpoint requires session cookies.
    headers: await headers(),
});
```

| Prop | Description | Type |
| --- | --- | --- |
| `userId` | The user id which you want to remove. | `string` |

## [Access Control](https://www.better-auth.com/docs/plugins/admin\#access-control)

The admin plugin offers a highly flexible access control system, allowing you to manage user permissions based on their role. You can define custom permission sets to fit your needs.

### [Roles](https://www.better-auth.com/docs/plugins/admin\#roles)

By default, there are two roles:

`admin`: Users with the admin role have full control over other users.

`user`: Users with the user role have no control over other users.

A user can have multiple roles. Multiple roles are stored as string separated by comma (",").

### [Permissions](https://www.better-auth.com/docs/plugins/admin\#permissions)

By default, there are two resources with up to six permissions.

**user**:
`create` `list` `set-role` `ban` `impersonate` `delete` `set-password`

**session**:
`list` `revoke` `delete`

Users with the admin role have full control over all the resources and actions. Users with the user role have no control over any of those actions.

### [Custom Permissions](https://www.better-auth.com/docs/plugins/admin\#custom-permissions)

The plugin provides an easy way to define your own set of permissions for each role.

#### [Create Access Control](https://www.better-auth.com/docs/plugins/admin\#create-access-control)

You first need to create an access controller by calling the `createAccessControl` function and passing the statement object. The statement object should have the resource name as the key and the array of actions as the value.

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

#### [Create Roles](https://www.better-auth.com/docs/plugins/admin\#create-roles)

Once you have created the access controller you can create roles with the permissions you have defined.

permissions.ts

```
import { createAccessControl } from "better-auth/plugins/access";

export const statement = {
    project: ["create", "share", "update", "delete"], // <-- Permissions available for created roles
} as const;

const ac = createAccessControl(statement);

export const user = ac.newRole({
    project: ["create"],
});

export const admin = ac.newRole({
    project: ["create", "update"],
});

export const myCustomRole = ac.newRole({
    project: ["create", "update", "delete"],
    user: ["ban"],
});
```

When you create custom roles for existing roles, the predefined permissions for those roles will be overridden. To add the existing permissions to the custom role, you need to import `defaultStatements` and merge it with your new statement, plus merge the roles' permissions set with the default roles.

permissions.ts

```
import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements, adminAc } from "better-auth/plugins/admin/access";

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

#### [Pass Roles to the Plugin](https://www.better-auth.com/docs/plugins/admin\#pass-roles-to-the-plugin)

Once you have created the roles you can pass them to the admin plugin both on the client and the server.

auth.ts

```
import { betterAuth } from "better-auth"
import { admin as adminPlugin } from "better-auth/plugins"
import { ac, admin, user } from "@/auth/permissions"

export const auth = betterAuth({
    plugins: [\
        adminPlugin({\
            ac,\
            roles: {\
                admin,\
                user,\
                myCustomRole\
            }\
        }),\
    ],
});
```

You also need to pass the access controller and the roles to the client plugin.

auth-client.ts

```
import { createAuthClient } from "better-auth/client"
import { adminClient } from "better-auth/client/plugins"
import { ac, admin, user, myCustomRole } from "@/auth/permissions"

export const client = createAuthClient({
    plugins: [\
        adminClient({\
            ac,\
            roles: {\
                admin,\
                user,\
                myCustomRole\
            }\
        })\
    ]
})
```

### [Access Control Usage](https://www.better-auth.com/docs/plugins/admin\#access-control-usage)

**Has Permission**:

To check a user's permissions, you can use the `hasPermission` function provided by the client.

ClientServer

POST

/admin/has-permission

```
const { data, error } = await authClient.admin.hasPermission({
    userId: "user-id",
    permission: { "project": ["create", "update"] } /* Must use this, or permissions */,
    permissions,
});
```

| Prop | Description | Type |
| --- | --- | --- |
| `userId?` | The user id which you want to check the permissions for. | `string` |
| `permission?` | Optionally check if a single permission is granted. Must use this, or permissions. | `Record<string, string[]>` |
| `permissions?` | Optionally check if multiple permissions are granted. Must use this, or permission. | `Record<string, string[]>` |

POST

/admin/has-permission

```
const data = await auth.api.userHasPermission({
    body: {
        userId: "user-id",
        role: "admin", // server-only
        permission: { "project": ["create", "update"] } /* Must use this, or permissions */,
        permissions,
    },
});
```

| Prop | Description | Type |
| --- | --- | --- |
| `userId?` | The user id which you want to check the permissions for. | `string` |
| `role?`(server-only) | Check role permissions. | `string` |
| `permission?` | Optionally check if a single permission is granted. Must use this, or permissions. | `Record<string, string[]>` |
| `permissions?` | Optionally check if multiple permissions are granted. Must use this, or permission. | `Record<string, string[]>` |

Example usage:

auth-client.ts

```
const canCreateProject = await authClient.admin.hasPermission({
  permissions: {
    project: ["create"],
  },
});

// You can also check multiple resource permissions at the same time
const canCreateProjectAndCreateSale = await authClient.admin.hasPermission({
  permissions: {
    project: ["create"],
    sale: ["create"]
  },
});
```

If you want to check a user's permissions server-side, you can use the `userHasPermission` action provided by the `api` to check the user's permissions.

api.ts

```
import { auth } from "@/auth";

await auth.api.userHasPermission({
  body: {
    userId: 'id', //the user id
    permissions: {
      project: ["create"], // This must match the structure in your access control
    },
  },
});

// You can also just pass the role directly
await auth.api.userHasPermission({
  body: {
   role: "admin",
    permissions: {
      project: ["create"], // This must match the structure in your access control
    },
  },
});

// You can also check multiple resource permissions at the same time
await auth.api.userHasPermission({
  body: {
   role: "admin",
    permissions: {
      project: ["create"], // This must match the structure in your access control
      sale: ["create"]
    },
  },
});
```

**Check Role Permission**:

Use the `checkRolePermission` function on the client side to verify whether a given **role** has a specific **permission**. This is helpful after defining roles and their permissions, as it allows you to perform permission checks without needing to contact the server.

Note that this function does **not** check the permissions of the currently logged-in user directly. Instead, it checks what permissions are assigned to a specified role. The function is synchronous, so you don't need to use `await` when calling it.

auth-client.ts

```
const canCreateProject = authClient.admin.checkRolePermission({
  permissions: {
    user: ["delete"],
  },
  role: "admin",
});

// You can also check multiple resource permissions at the same time
const canDeleteUserAndRevokeSession = authClient.admin.checkRolePermission({
  permissions: {
    user: ["delete"],
    session: ["revoke"]
  },
  role: "admin",
});
```

## [Schema](https://www.better-auth.com/docs/plugins/admin\#schema)

This plugin adds the following fields to the `user` table:

| Field Name | Type | Key | Description |
| --- | --- | --- | --- |
| role | string | ? | The user's role. Defaults to \`user\`. Admins will have the \`admin\` role. |
| banned | boolean | ? | Indicates whether the user is banned. |
| banReason | string | ? | The reason for the user's ban. |
| banExpires | date | ? | The date when the user's ban will expire. |

And adds one field in the `session` table:

| Field Name | Type | Key | Description |
| --- | --- | --- | --- |
| impersonatedBy | string | ? | The ID of the admin that is impersonating this session. |

## [Options](https://www.better-auth.com/docs/plugins/admin\#options)

### [Default Role](https://www.better-auth.com/docs/plugins/admin\#default-role)

The default role for a user. Defaults to `user`.

auth.ts

```
admin({
  defaultRole: "regular",
});
```

### [Admin Roles](https://www.better-auth.com/docs/plugins/admin\#admin-roles)

The roles that are considered admin roles. Defaults to `["admin"]`.

auth.ts

```
admin({
  adminRoles: ["admin", "superadmin"],
});
```

Any role that isn't in the `adminRoles` list, even if they have the permission,
will not be considered an admin.

### [Admin userIds](https://www.better-auth.com/docs/plugins/admin\#admin-userids)

You can pass an array of userIds that should be considered as admin. Default to `[]`

auth.ts

```
admin({
    adminUserIds: ["user_id_1", "user_id_2"]
})
```

If a user is in the `adminUserIds` list, they will be able to perform any admin operation.

### [impersonationSessionDuration](https://www.better-auth.com/docs/plugins/admin\#impersonationsessionduration)

The duration of the impersonation session in seconds. Defaults to 1 hour.

auth.ts

```
admin({
  impersonationSessionDuration: 60 * 60 * 24, // 1 day
});
```

### [Default Ban Reason](https://www.better-auth.com/docs/plugins/admin\#default-ban-reason)

The default ban reason for a user created by the admin. Defaults to `No reason`.

auth.ts

```
admin({
  defaultBanReason: "Spamming",
});
```

### [Default Ban Expires In](https://www.better-auth.com/docs/plugins/admin\#default-ban-expires-in)

The default ban expires in for a user created by the admin in seconds. Defaults to `undefined` (meaning the ban never expires).

auth.ts

```
admin({
  defaultBanExpiresIn: 60 * 60 * 24, // 1 day
});
```

### [bannedUserMessage](https://www.better-auth.com/docs/plugins/admin\#bannedusermessage)

The message to show when a banned user tries to sign in. Defaults to "You have been banned from this application. Please contact support if you believe this is an error."

auth.ts

```
admin({
  bannedUserMessage: "Custom banned user message",
});
```

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/plugins/admin.mdx)

[Previous Page\\
\\
Authorization](https://www.better-auth.com/docs/plugins/admin) [Next Page\\
\\
API Key](https://www.better-auth.com/docs/plugins/api-key)

### On this page

[Installation](https://www.better-auth.com/docs/plugins/admin#installation) [Add the plugin to your auth config](https://www.better-auth.com/docs/plugins/admin#add-the-plugin-to-your-auth-config) [Migrate the database](https://www.better-auth.com/docs/plugins/admin#migrate-the-database) [Add the client plugin](https://www.better-auth.com/docs/plugins/admin#add-the-client-plugin) [Usage](https://www.better-auth.com/docs/plugins/admin#usage) [Create User](https://www.better-auth.com/docs/plugins/admin#create-user) [List Users](https://www.better-auth.com/docs/plugins/admin#list-users) [Query Filtering](https://www.better-auth.com/docs/plugins/admin#query-filtering) [Pagination](https://www.better-auth.com/docs/plugins/admin#pagination) [How to Implement Pagination](https://www.better-auth.com/docs/plugins/admin#how-to-implement-pagination) [Example Usage](https://www.better-auth.com/docs/plugins/admin#example-usage) [Set User Role](https://www.better-auth.com/docs/plugins/admin#set-user-role) [Set User Password](https://www.better-auth.com/docs/plugins/admin#set-user-password) [Ban User](https://www.better-auth.com/docs/plugins/admin#ban-user) [Unban User](https://www.better-auth.com/docs/plugins/admin#unban-user) [List User Sessions](https://www.better-auth.com/docs/plugins/admin#list-user-sessions) [Revoke User Session](https://www.better-auth.com/docs/plugins/admin#revoke-user-session) [Revoke All Sessions for a User](https://www.better-auth.com/docs/plugins/admin#revoke-all-sessions-for-a-user) [Impersonate User](https://www.better-auth.com/docs/plugins/admin#impersonate-user) [Stop Impersonating User](https://www.better-auth.com/docs/plugins/admin#stop-impersonating-user) [Remove User](https://www.better-auth.com/docs/plugins/admin#remove-user) [Access Control](https://www.better-auth.com/docs/plugins/admin#access-control) [Roles](https://www.better-auth.com/docs/plugins/admin#roles) [Permissions](https://www.better-auth.com/docs/plugins/admin#permissions) [Custom Permissions](https://www.better-auth.com/docs/plugins/admin#custom-permissions) [Create Access Control](https://www.better-auth.com/docs/plugins/admin#create-access-control) [Create Roles](https://www.better-auth.com/docs/plugins/admin#create-roles) [Pass Roles to the Plugin](https://www.better-auth.com/docs/plugins/admin#pass-roles-to-the-plugin) [Access Control Usage](https://www.better-auth.com/docs/plugins/admin#access-control-usage) [Schema](https://www.better-auth.com/docs/plugins/admin#schema) [Options](https://www.better-auth.com/docs/plugins/admin#options) [Default Role](https://www.better-auth.com/docs/plugins/admin#default-role) [Admin Roles](https://www.better-auth.com/docs/plugins/admin#admin-roles) [Admin userIds](https://www.better-auth.com/docs/plugins/admin#admin-userids) [impersonationSessionDuration](https://www.better-auth.com/docs/plugins/admin#impersonationsessionduration) [Default Ban Reason](https://www.better-auth.com/docs/plugins/admin#default-ban-reason) [Default Ban Expires In](https://www.better-auth.com/docs/plugins/admin#default-ban-expires-in) [bannedUserMessage](https://www.better-auth.com/docs/plugins/admin#bannedusermessage)