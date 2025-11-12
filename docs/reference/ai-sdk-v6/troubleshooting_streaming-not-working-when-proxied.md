TroubleshootingStreaming Not Working When Proxied

Copy markdown

# Streaming Not Working When Proxied

## Issue

Streaming with the AI SDK doesn't work in local development environment, or deployed in some proxy environments. Instead of streaming, only the full response is returned after a while.

## Cause

The causes of this issue are caused by the proxy middleware.

If the middleware is configured to compress the response, it will cause the streaming to fail.

## Solution

You can try the following, the solution only affects the streaming API:

  * add `'Content-Encoding': 'none'` headers
        
        return result.toUIMessageStreamResponse({
        
          headers: {
        
            'Content-Encoding': 'none',
        
          },
        
        });

Previous

Streaming Not Working When Deployed

Next

Getting Timeouts When Deploying on Vercel