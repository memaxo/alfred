AI SDK ErrorsAI_DownloadError

Copy markdown

# AI_DownloadError

This error occurs when a download fails.

## Properties

  * `url`: The URL that failed to download
  * `statusCode`: The HTTP status code returned by the server
  * `statusText`: The HTTP status text returned by the server
  * `message`: The error message containing details about the download failure

## Checking for this Error

You can check if an error is an instance of `AI_DownloadError` using:
    
    
    import { DownloadError } from 'ai';
    
    
    
    
    if (DownloadError.isInstance(error)) {
    
      // Handle the error
    
    }

Previous

AI_APICallError

Next

AI_EmptyResponseBodyError