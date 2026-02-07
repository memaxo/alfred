Migration GuidesMigrate AI SDK 3.1 to 3.2

Copy markdown

# Migrate AI SDK 3.1 to 3.2

Check out the AI SDK 3.2 release blog post for more information about the release.

This guide will help you upgrade to AI SDK 3.2:

- Experimental `StreamingReactResponse` functionality has been removed
- Several features have been deprecated
- UI framework integrations have moved to their own Node modules

## Upgrading

### AI SDK

To update to AI SDK version 3.2, run the following command using your preferred package manager:

    bun add ai@latest

## Removed Functionality

The experimental `StreamingReactResponse` has been removed. You can use AI SDK RSC to build streaming UIs.

## Deprecated Functionality

The `nanoid` export has been deprecated. Please use `generateId` instead.

## UI Package Separation

AI SDK UI supports several frameworks: React, Svelte, Vue.js, and SolidJS.

The integrations (other than React and RSC) have moved to separate Node modules. You need to update the import and require statements as follows:

- Change `ai/svelte` to `@ai-sdk/svelte`
- Change `ai/vue` to `@ai-sdk/vue`
- Change `ai/solid` to `@ai-sdk/solid`

The old exports are still available but will be removed in a future release.

Previous

Migrate AI SDK 3.2 to 3.3

Next

Migrate AI SDK 3.0 to 3.1
