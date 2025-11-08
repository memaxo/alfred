AI SDK ErrorsAI_MessageConversionError

Copy markdown

# AI_MessageConversionError

This error occurs when message conversion fails.

## Properties

  * `originalMessage`: The original message that failed conversion
  * `message`: The error message

## Checking for this Error

You can check if an error is an instance of `AI_MessageConversionError` using:
    
    
    import { MessageConversionError } from 'ai';
    
    
    
    
    if (MessageConversionError.isInstance(error)) {
    
      // Handle the error
    
    }

Previous

AI_LoadSettingError

Next

AI_NoContentGeneratedError