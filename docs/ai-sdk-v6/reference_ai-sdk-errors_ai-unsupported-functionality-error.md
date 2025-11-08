AI SDK ErrorsAI_UnsupportedFunctionalityError

Copy markdown

# AI_UnsupportedFunctionalityError

This error occurs when functionality is not unsupported.

## Properties

  * `functionality`: The name of the unsupported functionality
  * `message`: The error message

## Checking for this Error

You can check if an error is an instance of `AI_UnsupportedFunctionalityError` using:
    
    
    import { UnsupportedFunctionalityError } from 'ai';
    
    
    
    
    if (UnsupportedFunctionalityError.isInstance(error)) {
    
      // Handle the error
    
    }

Previous

AI_TypeValidationError

Next

Migration Guides