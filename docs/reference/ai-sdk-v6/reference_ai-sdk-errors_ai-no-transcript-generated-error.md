AI SDK ErrorsAI_NoTranscriptGeneratedError

Copy markdown

# AI_NoTranscriptGeneratedError

This error occurs when no transcript could be generated from the input.

## Properties

- `responses`: Array of responses
- `message`: The error message

## Checking for this Error

You can check if an error is an instance of `AI_NoTranscriptGeneratedError` using:

    import { NoTranscriptGeneratedError } from 'ai';




    if (NoTranscriptGeneratedError.isInstance(error)) {

      // Handle the error

    }

Previous

AI_NoSuchToolError

Next

AI_RetryError
