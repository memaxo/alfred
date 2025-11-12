TroubleshootingGetting Timeouts When Deploying on Vercel

Copy markdown

# Getting Timeouts When Deploying on Vercel

## Issue

Streaming with the AI SDK works in my local development environment. However, when I'm deploying to Vercel, longer responses get chopped off in the UI and I'm seeing timeouts in the Vercel logs or I'm seeing the error: `Uncaught (in promise) Error: Connection closed`.

## Solution

With Vercel's Fluid Compute, the default function duration is now **5 minutes (300 seconds)** across all plans. This should be sufficient for most streaming applications.

If you need to extend the timeout for longer-running processes, you can increase the `maxDuration` setting:

### Next.js (App Router)

Add the following to your route file or the page you are calling your Server Action from:
    
    
    export const maxDuration = 600;

Setting `maxDuration` above 300 seconds requires a Pro or Enterprise plan.

### Other Frameworks

For other frameworks, you can set timeouts in your `vercel.json` file:
    
    
    {
    
      "functions": {
    
        "api/chat/route.ts": {
    
          "maxDuration": 600
    
        }
    
      }
    
    }

Setting `maxDuration` above 300 seconds requires a Pro or Enterprise plan.

### Maximum Duration Limits

The maximum duration you can set depends on your Vercel plan:

  * **Hobby** : Up to 300 seconds (5 minutes)
  * **Pro** : Up to 800 seconds (~13 minutes)
  * **Enterprise** : Up to 800 seconds (~13 minutes)

## Learn more

  * Fluid Compute Default Settings
  * Configuring Maximum Duration for Vercel Functions

Previous

Streaming Not Working When Proxied

Next

Unclosed Streams