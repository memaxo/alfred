AI SDK ErrorsAI_InvalidDataContentError

Copy markdown

# AI_InvalidDataContentError

This error occurs when the data content provided in a multi-modal message part is invalid. Check out the prompt examples for multi-modal messages .

## Properties

- `content`: The invalid content value
- `message`: The error message describing the expected and received content types

## Checking for this Error

You can check if an error is an instance of `AI_InvalidDataContentError` using:

    import { InvalidDataContentError } from 'ai';




    if (InvalidDataContentError.isInstance(error)) {

      // Handle the error

    }

Previous

AI_InvalidArgumentError

Next

AI_InvalidDataContent
