---
title: Create a Database Adapter | Better Auth
url: 
description: Learn how to create a custom database adapter for Better-Auth
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

# Create a Database Adapter

Copy MarkdownOpen in

Learn how to create a custom database adapter for Better-Auth using `createAdapter`.

Our `createAdapter` function is designed to be very flexible, and we've done our best to make it easy to understand and use.
Our hope is to allow you to focus on writing database logic, and not have to worry about how the adapter is working with Better-Auth.

Anything from custom schema configurations, custom ID generation, safe JSON parsing, and more is handled by the `createAdapter` function.
All you need to do is provide the database logic, and the `createAdapter` function will handle the rest.

## [Quick Start](https://www.better-auth.com/docs/guides/create-a-db-adapter\#quick-start)

### [Get things ready](https://www.better-auth.com/docs/guides/create-a-db-adapter\#get-things-ready)

1. Import `createAdapter`.
2. Create `CustomAdapterConfig` interface that represents your adapter config options.
3. Create the adapter!

```
import { createAdapter, type AdapterDebugLogs } from "better-auth/adapters";

// Your custom adapter config options
interface CustomAdapterConfig {
  /**
   * Helps you debug issues with the adapter.
   */
  debugLogs?: AdapterDebugLogs;
  /**
   * If the table names in the schema are plural.
   */
  usePlural?: boolean;
}

export const myAdapter = (config: CustomAdapterConfig = {}) =>
  createAdapter({
    // ...
  });
```

### [Configure the adapter](https://www.better-auth.com/docs/guides/create-a-db-adapter\#configure-the-adapter)

The `config` object is mostly used to provide information about the adapter to Better-Auth.
We try to minimize the amount of code you need to write in your adapter functions, and these `config` options are used to help us do that.

```
// ...
export const myAdapter = (config: CustomAdapterConfig = {}) =>
  createAdapter({
    config: {
      adapterId: "custom-adapter", // A unique identifier for the adapter.
      adapterName: "Custom Adapter", // The name of the adapter.
      usePlural: config.usePlural ?? false, // Whether the table names in the schema are plural.
      debugLogs: config.debugLogs ?? false, // Whether to enable debug logs.
      supportsJSON: false, // Whether the database supports JSON. (Default: false)
      supportsDates: true, // Whether the database supports dates. (Default: true)
      supportsBooleans: true, // Whether the database supports booleans. (Default: true)
      supportsNumericIds: true, // Whether the database supports auto-incrementing numeric IDs. (Default: true)
    },
    // ...
  });
```

### [Create the adapter](https://www.better-auth.com/docs/guides/create-a-db-adapter\#create-the-adapter)

The `adapter` function is where you write the code that interacts with your database.

```
// ...
export const myAdapter = (config: CustomAdapterConfig = {}) =>
  createAdapter({
    config: {
      // ...
    },
    adapter: ({}) => {
      return {
        create: async ({ data, model, select }) => {
          // ...
        },
        update: async ({ data, model, select }) => {
          // ...
        },
        updateMany: async ({ data, model, select }) => {
          // ...
        },
        delete: async ({ data, model, select }) => {
          // ...
        },
        // ...
      };
    },
  });
```

Learn more about the `adapter` here [here](https://www.better-auth.com/docs/concepts/database#adapters).

## [Adapter](https://www.better-auth.com/docs/guides/create-a-db-adapter\#adapter)

The `adapter` function is where you write the code that interacts with your database.

If you haven't already, check out the `options` object in the [config section](https://www.better-auth.com/docs/guides/create-a-db-adapter#config), as it can be useful for your adapter.

Before we get into the adapter function, let's go over the parameters that are available to you.

- `options`: The Better Auth options.
- `schema`: The schema from the user's Better Auth instance.
- `debugLog`: The debug log function.
- `getField`: The get field function.
- `getDefaultModelName`: The get default model name function.
- `getDefaultFieldName`: The get default field name function.
- `getFieldAttributes`: The get field attributes function.

Example

```
adapter: ({
  options,
  schema,
  debugLog,
  getField,
  getDefaultModelName,
  getDefaultFieldName,
}) => {
  return {
    // ...
  };
};
```

### [Adapter Methods](https://www.better-auth.com/docs/guides/create-a-db-adapter\#adapter-methods)

- All `model` values are already transformed into the correct model name for the database based on the end-user's schema configuration.
  - This also means that if you need access to the `schema` version of a given model, you can't use this exact `model` value, you'll need to use the `getDefaultModelName` function provided in the options to convert the `model` to the `schema` version.
- We will automatically fill in any missing fields you return based on the user's `schema` configuration.
- Any method that includes a `select` parameter, is only for the purpose of getting data from your database more efficiently. You do not need to worry about only returning what the `select` parameter states, as we will handle that for you.

### [`create` method](https://www.better-auth.com/docs/guides/create-a-db-adapter\#create-method)

The `create` method is used to create a new record in the database.

Note:
If the user has enabled the `useNumberId` option, or if `generateId` is `false` in the user's Better Auth config,
then it's expected that the `id` is provided in the `data` object. Otherwise, the `id` will be automatically generated.

Additionally, it's possible to pass `forceAllowId` as a parameter to the `create` method, which allows `id` to be provided in the `data` object.
We handle `forceAllowId` internally, so you don't need to worry about it.

parameters:

- `model`: The model/table name that new data will be inserted into.
- `data`: The data to insert into the database.
- `select`: An array of fields to return from the database.

Make sure to return the data that is inserted into the database.

Example

```
create: async ({ model, data, select }) => {
  // Example of inserting data into the database.
  return await db.insert(model).values(data);
};
```

### [`update` method](https://www.better-auth.com/docs/guides/create-a-db-adapter\#update-method)

The `update` method is used to update a record in the database.

parameters:

- `model`: The model/table name that the record will be updated in.
- `where`: The `where` clause to update the record by.
- `update`: The data to update the record with.

Make sure to return the data in the row which is updated. This includes any
fields that were not updated.

Example

```
update: async ({ model, where, update }) => {
  // Example of updating data in the database.
  return await db.update(model).set(update).where(where);
};
```

### [`updateMany` method](https://www.better-auth.com/docs/guides/create-a-db-adapter\#updatemany-method)

The `updateMany` method is used to update multiple records in the database.

parameters:

- `model`: The model/table name that the records will be updated in.
- `where`: The `where` clause to update the records by.
- `update`: The data to update the records with.

Make sure to return the number of records that were updated.

Example

```
updateMany: async ({ model, where, update }) => {
  // Example of updating multiple records in the database.
  return await db.update(model).set(update).where(where);
};
```

### [`delete` method](https://www.better-auth.com/docs/guides/create-a-db-adapter\#delete-method)

The `delete` method is used to delete a record from the database.

parameters:

- `model`: The model/table name that the record will be deleted from.
- `where`: The `where` clause to delete the record by.

Example

```
delete: async ({ model, where }) => {
  // Example of deleting a record from the database.
  await db.delete(model).where(where);
}
```

### [`deleteMany` method](https://www.better-auth.com/docs/guides/create-a-db-adapter\#deletemany-method)

The `deleteMany` method is used to delete multiple records from the database.

parameters:

- `model`: The model/table name that the records will be deleted from.
- `where`: The `where` clause to delete the records by.

Make sure to return the number of records that were deleted.

Example

```
deleteMany: async ({ model, where }) => {
  // Example of deleting multiple records from the database.
  return await db.delete(model).where(where);
};
```

### [`findOne` method](https://www.better-auth.com/docs/guides/create-a-db-adapter\#findone-method)

The `findOne` method is used to find a single record in the database.

parameters:

- `model`: The model/table name that the record will be found in.
- `where`: The `where` clause to find the record by.
- `select`: The `select` clause to return.

Make sure to return the data that is found in the database.

Example

```
findOne: async ({ model, where, select }) => {
  // Example of finding a single record in the database.
  return await db.select().from(model).where(where).limit(1);
};
```

### [`findMany` method](https://www.better-auth.com/docs/guides/create-a-db-adapter\#findmany-method)

The `findMany` method is used to find multiple records in the database.

parameters:

- `model`: The model/table name that the records will be found in.
- `where`: The `where` clause to find the records by.
- `limit`: The limit of records to return.
- `sortBy`: The `sortBy` clause to sort the records by.
- `offset`: The offset of records to return.

Make sure to return the array of data that is found in the database.

Example

```
findMany: async ({ model, where, limit, sortBy, offset }) => {
  // Example of finding multiple records in the database.
  return await db
    .select()
    .from(model)
    .where(where)
    .limit(limit)
    .offset(offset)
    .orderBy(sortBy);
};
```

### [`count` method](https://www.better-auth.com/docs/guides/create-a-db-adapter\#count-method)

The `count` method is used to count the number of records in the database.

parameters:

- `model`: The model/table name that the records will be counted in.
- `where`: The `where` clause to count the records by.

Make sure to return the number of records that were counted.

Example

```
count: async ({ model, where }) => {
  // Example of counting the number of records in the database.
  return await db.select().from(model).where(where).count();
};
```

### [`options` (optional)](https://www.better-auth.com/docs/guides/create-a-db-adapter\#options-optional)

The `options` object is for any potential config that you got from your custom adapter options.

Example

```
const myAdapter = (config: CustomAdapterConfig) =>
  createAdapter({
    config: {
      // ...
    },
    adapter: ({ options }) => {
      return {
        options: config,
      };
    },
  });
```

### [`createSchema` (optional)](https://www.better-auth.com/docs/guides/create-a-db-adapter\#createschema-optional)

The `createSchema` method allows the [Better Auth CLI](https://www.better-auth.com/docs/concepts/cli) to [generate](https://www.better-auth.com/docs/concepts/cli#generate) a schema for the database.

parameters:

- `tables`: The tables from the user's Better-Auth instance schema; which is expected to be generated into the schema file.
- `file`: The file the user may have passed in to the `generate` command as the expected schema file output path.

Example

```
createSchema: async ({ file, tables }) => {
  // ... Custom logic to create a schema for the database.
};
```

## [Test your adapter](https://www.better-auth.com/docs/guides/create-a-db-adapter\#test-your-adapter)

We've provided a test suite that you can use to test your adapter. It requires you to use `vitest`.

my-adapter.test.ts

```
import { expect, test, describe } from "vitest";
import { runAdapterTest } from "better-auth/adapters/test";
import { myAdapter } from "./my-adapter";

describe("My Adapter Tests", async () => {
  afterAll(async () => {
    // Run DB cleanup here...
  });
  const adapter = myAdapter({
    debugLogs: {
      // If your adapter config allows passing in debug logs, then pass this here.
      isRunningAdapterTests: true, // This is our super secret flag to let us know to only log debug logs if a test fails.
    },
  });

  await runAdapterTest({
    getAdapter: async (betterAuthOptions = {}) => {
      return adapter(betterAuthOptions);
    },
  });
});
```

### [Numeric ID tests](https://www.better-auth.com/docs/guides/create-a-db-adapter\#numeric-id-tests)

If your database supports numeric IDs, then you should run this test as well:

my-adapter.number-id.test.ts

```
import { expect, test, describe } from "vitest";
import { runNumberIdAdapterTest } from "better-auth/adapters/test";
import { myAdapter } from "./my-adapter";

describe("My Adapter Numeric ID Tests", async () => {
  afterAll(async () => {
    // Run DB cleanup here...
  });
  const adapter = myAdapter({
    debugLogs: {
      // If your adapter config allows passing in debug logs, then pass this here.
      isRunningAdapterTests: true, // This is our super secret flag to let us know to only log debug logs if a test fails.
    },
  });

  await runNumberIdAdapterTest({
    getAdapter: async (betterAuthOptions = {}) => {
      return adapter(betterAuthOptions);
    },
  });
});
```

## [Config](https://www.better-auth.com/docs/guides/create-a-db-adapter\#config)

The `config` object is used to provide information about the adapter to Better-Auth.

We **highly recommend** going through and reading each provided option below, as it will help you understand how to properly configure your adapter.

### [Required Config](https://www.better-auth.com/docs/guides/create-a-db-adapter\#required-config)

### [`adapterId`](https://www.better-auth.com/docs/guides/create-a-db-adapter\#adapterid)

A unique identifier for the adapter.

### [`adapterName`](https://www.better-auth.com/docs/guides/create-a-db-adapter\#adaptername)

The name of the adapter.

### [Optional Config](https://www.better-auth.com/docs/guides/create-a-db-adapter\#optional-config)

### [`supportsNumericIds`](https://www.better-auth.com/docs/guides/create-a-db-adapter\#supportsnumericids)

Whether the database supports numeric IDs. If this is set to `false` and the user's config has enabled `useNumberId`, then we will throw an error.

### [`supportsJSON`](https://www.better-auth.com/docs/guides/create-a-db-adapter\#supportsjson)

Whether the database supports JSON. If the database doesn't support JSON, we will use a `string` to save the JSON data.And when we retrieve the data, we will safely parse the `string` back into a JSON object.

### [`supportsDates`](https://www.better-auth.com/docs/guides/create-a-db-adapter\#supportsdates)

Whether the database supports dates. If the database doesn't support dates, we will use a `string` to save the date. (ISO string) When we retrieve the data, we will safely parse the `string` back into a `Date` object.

### [`supportsBooleans`](https://www.better-auth.com/docs/guides/create-a-db-adapter\#supportsbooleans)

Whether the database supports booleans. If the database doesn't support booleans, we will use a `0` or `1` to save the boolean value. When we retrieve the data, we will safely parse the `0` or `1` back into a boolean value.

### [`usePlural`](https://www.better-auth.com/docs/guides/create-a-db-adapter\#useplural)

Whether the table names in the schema are plural. This is often defined by the user, and passed down through your custom adapter options. If you do not intend to allow the user to customize the table names, you can ignore this option, or set this to `false`.

Example

```
const adapter = myAdapter({
  // This value then gets passed into the `usePlural`
  // option in the createAdapter `config` object.
  usePlural: true,
});
```

### [`transaction`](https://www.better-auth.com/docs/guides/create-a-db-adapter\#transaction)

Whether the adapter supports transactions. If `false`, operations run sequentially; otherwise provide a function that executes a callback with a `TransactionAdapter`.

If your database does not support transactions, the error handling and rollback
will not be as robust. We recommend using a database that supports transactions
for better data integrity.

### [`debugLogs`](https://www.better-auth.com/docs/guides/create-a-db-adapter\#debuglogs)

Used to enable debug logs for the adapter. You can pass in a boolean, or an object with the following keys: `create`, `update`, `updateMany`, `findOne`, `findMany`, `delete`, `deleteMany`, `count`.
If any of the keys are `true`, the debug logs will be enabled for that method.

Example

```
// Will log debug logs for all methods.
const adapter = myAdapter({
  debugLogs: true,
});
```

Example

```
// Will only log debug logs for the `create` and `update` methods.
const adapter = myAdapter({
  debugLogs: {
    create: true,
    update: true,
  },
});
```

### [`disableIdGeneration`](https://www.better-auth.com/docs/guides/create-a-db-adapter\#disableidgeneration)

Whether to disable ID generation. If this is set to `true`, then the user's `generateId` option will be ignored.

### [`customIdGenerator`](https://www.better-auth.com/docs/guides/create-a-db-adapter\#customidgenerator)

If your database only supports a specific custom ID generation, then you can use this option to generate your own IDs.

### [`mapKeysTransformInput`](https://www.better-auth.com/docs/guides/create-a-db-adapter\#mapkeystransforminput)

If your database uses a different key name for a given situation, you can use this option to map the keys. This is useful for databases that expect a different key name for a given situation.
For example, MongoDB uses `_id` while in Better-Auth we use `id`.

Each key in the returned object represents the old key to replace.
The value represents the new key.

This can be a partial object that only transforms some keys.

Example

```
mapKeysTransformInput: () => {
  return {
    id: "_id", // We want to replace `id` to `_id` to save into MongoDB
  };
},
```

### [`mapKeysTransformOutput`](https://www.better-auth.com/docs/guides/create-a-db-adapter\#mapkeystransformoutput)

If your database uses a different key name for a given situation, you can use this option to map the keys. This is useful for databases that use a different key name for a given situation.
For example, MongoDB uses `_id` while in Better-Auth we use `id`.

Each key in the returned object represents the old key to replace.
The value represents the new key.

This can be a partial object that only transforms some keys.

Example

```
mapKeysTransformOutput: () => {
  return {
    _id: "id", // We want to replace `_id` (from MongoDB) to `id` (for Better-Auth)
  };
},
```

### [`customTransformInput`](https://www.better-auth.com/docs/guides/create-a-db-adapter\#customtransforminput)

If you need to transform the input data before it is saved to the database, you can use this option to transform the data.

If you're using `supportsJSON`, `supportsDates`, or `supportsBooleans`, then
the transformations will be applied before your `customTransformInput`
function is called.

The `customTransformInput` function receives the following arguments:

- `data`: The data to transform.
- `field`: The field that is being transformed.
- `fieldAttributes`: The field attributes of the field that is being transformed.
- `select`: The `select` values which the query expects to return.
- `model`: The model that is being transformed.
- `schema`: The schema that is being transformed.
- `options`: Better Auth options.

The `customTransformInput` function runs at every key in the data object of a given action.

Example

```
customTransformInput: ({ field, data }) => {
  if (field === "id") {
    return "123"; // Force the ID to be "123"
  }

  return data;
};
```

### [`customTransformOutput`](https://www.better-auth.com/docs/guides/create-a-db-adapter\#customtransformoutput)

If you need to transform the output data before it is returned to the user, you can use this option to transform the data. The `customTransformOutput` function is used to transform the output data.
Similar to the `customTransformInput` function, it runs at every key in the data object of a given action, but it runs after the data is retrieved from the database.

Example

```
customTransformOutput: ({ field, data }) => {
  if (field === "name") {
    return "Bob"; // Force the name to be "Bob"
  }

  return data;
};
```

```
const some_data = await adapter.create({
  model: "user",
  data: {
    name: "John",
  },
});

// The name will be "Bob"
console.log(some_data.name);
```

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/guides/create-a-db-adapter.mdx)

[Previous Page\\
\\
Create Your First Plugin](https://www.better-auth.com/docs/guides/your-first-plugin) [Next Page\\
\\
Browser Extension Guide](https://www.better-auth.com/docs/guides/browser-extension-guide)

### On this page

[Quick Start](https://www.better-auth.com/docs/guides/create-a-db-adapter#quick-start) [Get things ready](https://www.better-auth.com/docs/guides/create-a-db-adapter#get-things-ready) [Configure the adapter](https://www.better-auth.com/docs/guides/create-a-db-adapter#configure-the-adapter) [Create the adapter](https://www.better-auth.com/docs/guides/create-a-db-adapter#create-the-adapter) [Adapter](https://www.better-auth.com/docs/guides/create-a-db-adapter#adapter) [Adapter Methods](https://www.better-auth.com/docs/guides/create-a-db-adapter#adapter-methods) [`create` method](https://www.better-auth.com/docs/guides/create-a-db-adapter#create-method) [`update` method](https://www.better-auth.com/docs/guides/create-a-db-adapter#update-method) [`updateMany` method](https://www.better-auth.com/docs/guides/create-a-db-adapter#updatemany-method) [`delete` method](https://www.better-auth.com/docs/guides/create-a-db-adapter#delete-method) [`deleteMany` method](https://www.better-auth.com/docs/guides/create-a-db-adapter#deletemany-method) [`findOne` method](https://www.better-auth.com/docs/guides/create-a-db-adapter#findone-method) [`findMany` method](https://www.better-auth.com/docs/guides/create-a-db-adapter#findmany-method) [`count` method](https://www.better-auth.com/docs/guides/create-a-db-adapter#count-method) [`options` (optional)](https://www.better-auth.com/docs/guides/create-a-db-adapter#options-optional) [`createSchema` (optional)](https://www.better-auth.com/docs/guides/create-a-db-adapter#createschema-optional) [Test your adapter](https://www.better-auth.com/docs/guides/create-a-db-adapter#test-your-adapter) [Numeric ID tests](https://www.better-auth.com/docs/guides/create-a-db-adapter#numeric-id-tests) [Config](https://www.better-auth.com/docs/guides/create-a-db-adapter#config) [Required Config](https://www.better-auth.com/docs/guides/create-a-db-adapter#required-config) [`adapterId`](https://www.better-auth.com/docs/guides/create-a-db-adapter#adapterid) [`adapterName`](https://www.better-auth.com/docs/guides/create-a-db-adapter#adaptername) [Optional Config](https://www.better-auth.com/docs/guides/create-a-db-adapter#optional-config) [`supportsNumericIds`](https://www.better-auth.com/docs/guides/create-a-db-adapter#supportsnumericids) [`supportsJSON`](https://www.better-auth.com/docs/guides/create-a-db-adapter#supportsjson) [`supportsDates`](https://www.better-auth.com/docs/guides/create-a-db-adapter#supportsdates) [`supportsBooleans`](https://www.better-auth.com/docs/guides/create-a-db-adapter#supportsbooleans) [`usePlural`](https://www.better-auth.com/docs/guides/create-a-db-adapter#useplural) [`transaction`](https://www.better-auth.com/docs/guides/create-a-db-adapter#transaction) [`debugLogs`](https://www.better-auth.com/docs/guides/create-a-db-adapter#debuglogs) [`disableIdGeneration`](https://www.better-auth.com/docs/guides/create-a-db-adapter#disableidgeneration) [`customIdGenerator`](https://www.better-auth.com/docs/guides/create-a-db-adapter#customidgenerator) [`mapKeysTransformInput`](https://www.better-auth.com/docs/guides/create-a-db-adapter#mapkeystransforminput) [`mapKeysTransformOutput`](https://www.better-auth.com/docs/guides/create-a-db-adapter#mapkeystransformoutput) [`customTransformInput`](https://www.better-auth.com/docs/guides/create-a-db-adapter#customtransforminput) [`customTransformOutput`](https://www.better-auth.com/docs/guides/create-a-db-adapter#customtransformoutput)