TroubleshootingJest: cannot find module '@ai-sdk/rsc'

Copy markdown

# Jest: cannot find module '@ai-sdk/rsc'

## Issue

I am using AI SDK RSC and am writing tests for my RSC components with Jest.

I am getting the following error: `Cannot find module '@ai-sdk/rsc'`.

## Solution

Configure the module resolution via `jest config update` in `moduleNameMapper`:

jest.config.js

    "moduleNameMapper": {

      "^@ai-sdk/rsc$": "/node_modules/@ai-sdk/rsc/dist"

    }

Previous

React error "Maximum update depth exceeded"
