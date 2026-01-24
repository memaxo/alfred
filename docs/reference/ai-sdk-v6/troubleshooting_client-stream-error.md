TroubleshootingServer Action Plain Objects Error

Copy markdown

# "Only plain objects can be passed from client components" Server Action Error

## Issue

I am using `streamText` or `streamObject` with Server Actions, and I am getting a `"only plain objects and a few built ins can be passed from client components"` error.

## Background

This error occurs when you're trying to return a non-serializable object from a Server Action to a Client Component. The streamText function likely returns an object with methods or complex structures that can't be directly serialized and passed to the client.

## Solution

To fix this issue, you need to ensure that you're only returning serializable data from your Server Action. Here's how you can modify your approach:

1. Instead of returning the entire result object from streamText, extract only the necessary serializable data.
2. Use the `createStreamableValue` function to create a streamable value that can be safely passed to the client.

Here's an example that demonstrates how to implement this solution: Streaming Text Generation.

This approach ensures that only serializable data (the text) is passed to the client, avoiding the "only plain objects" error.

Previous

useChat Failed to Parse Stream

Next

useChat No Response
