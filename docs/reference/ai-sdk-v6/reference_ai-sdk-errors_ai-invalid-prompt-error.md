AI SDK ErrorsAI_InvalidPromptError

Copy markdown

# AI_InvalidPromptError

This error occurs when the prompt provided is invalid.

## Properties

- `prompt`: The invalid prompt value
- `message`: The error message
- `cause`: The cause of the error

## Checking for this Error

You can check if an error is an instance of `AI_InvalidPromptError` using:

    import { InvalidPromptError } from 'ai';




    if (InvalidPromptError.isInstance(error)) {

      // Handle the error

    }

Previous

AI_InvalidMessageRoleError

Next

AI_InvalidResponseDataError
