AI SDK ErrorsAI_InvalidToolInputError

Copy markdown

# AI_InvalidToolInputError

This error occurs when invalid tool input was provided.

## Properties

- `toolName`: The name of the tool with invalid inputs
- `toolInput`: The invalid tool inputs
- `message`: The error message
- `cause`: The cause of the error

## Checking for this Error

You can check if an error is an instance of `AI_InvalidToolInputError` using:

    import { InvalidToolInputError } from 'ai';




    if (InvalidToolInputError.isInstance(error)) {

      // Handle the error

    }

Previous

AI_InvalidResponseDataError

Next

AI_JSONParseError
