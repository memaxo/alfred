AI SDK ErrorsAI_TypeValidationError

Copy markdown

# AI_TypeValidationError

This error occurs when type validation fails.

## Properties

  * `value`: The value that failed validation
  * `message`: The error message including validation details

## Checking for this Error

You can check if an error is an instance of `AI_TypeValidationError` using:
    
    
    import { TypeValidationError } from 'ai';
    
    
    
    
    if (TypeValidationError.isInstance(error)) {
    
      // Handle the error
    
    }

Previous

ToolCallRepairError

Next

AI_UnsupportedFunctionalityError