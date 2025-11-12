AI SDK ErrorsAI_LoadSettingError

Copy markdown

# AI_LoadSettingError

This error occurs when a setting is not loaded successfully.

## Properties

  * `message`: The error message

## Checking for this Error

You can check if an error is an instance of `AI_LoadSettingError` using:
    
    
    import { LoadSettingError } from 'ai';
    
    
    
    
    if (LoadSettingError.isInstance(error)) {
    
      // Handle the error
    
    }

Previous

AI_LoadAPIKeyError

Next

AI_MessageConversionError