AI SDK ErrorsAI_EmptyResponseBodyError

Copy markdown

# AI_EmptyResponseBodyError

This error occurs when the server returns an empty response body.

## Properties

- `message`: The error message

## Checking for this Error

You can check if an error is an instance of `AI_EmptyResponseBodyError` using:

    import { EmptyResponseBodyError } from 'ai';




    if (EmptyResponseBodyError.isInstance(error)) {

      // Handle the error

    }

Previous

AI_DownloadError

Next

AI_InvalidArgumentError
