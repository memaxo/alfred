TroubleshootingTypeScript error "Cannot find namespace 'JSX'"

Copy markdown

# TypeScript error "Cannot find namespace 'JSX'"

## Issue

I am using the AI SDK in a project without React, e.g. an Hono server, and I get the following error: `error TS2503: Cannot find namespace 'JSX'.`

## Background

The AI SDK has a dependency on `@types/react` which defines the `JSX` namespace. It will be removed in the next major version of the AI SDK.

## Solution

You can install the `@types/react` package as a dependency to fix the error.
    
    
    npm install @types/react

Previous

Model is not assignable to type "LanguageModelV1"

Next

React error "Maximum update depth exceeded"