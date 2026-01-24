AI SDK ErrorsAI_RetryError

Copy markdown

# AI_RetryError

This error occurs when a retry operation fails.

## Properties

- `reason`: The reason for the retry failure
- `lastError`: The most recent error that occurred during retries
- `errors`: Array of all errors that occurred during retry attempts
- `message`: The error message

## Checking for this Error

You can check if an error is an instance of `AI_RetryError` using:

    import { RetryError } from 'ai';




    if (RetryError.isInstance(error)) {

      // Handle the error

    }

Previous

AI_NoTranscriptGeneratedError

Next

AI_TooManyEmbeddingValuesForCallError
