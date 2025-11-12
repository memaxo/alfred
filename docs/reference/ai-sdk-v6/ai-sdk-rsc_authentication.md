AI SDK RSCHandling Authentication

Copy markdown

# Authentication

AI SDK RSC is currently experimental. We recommend using AI SDK UI for production. For guidance on migrating from RSC to UI, see our migration guide.

The RSC API makes extensive use of `Server Actions` to power streaming values and UI from the server.

Server Actions are exposed as public, unprotected endpoints. As a result, you should treat Server Actions as you would public-facing API endpoints and ensure that the user is authorized to perform the action before returning any data.

app/actions.tsx
    
    
    'use server';
    
    
    
    
    import { cookies } from 'next/headers';
    
    import { createStremableUI } from '@ai-sdk/rsc';
    
    import { validateToken } from '../utils/auth';
    
    
    
    
    export const getWeather = async () => {
    
      const token = cookies().get('token');
    
    
    
    
      if (!token || !validateToken(token)) {
    
        return {
    
          error: 'This action requires authentication',
    
        };
    
      }
    
      const streamableDisplay = createStreamableUI(null);
    
    
    
    
      streamableDisplay.update();
    
      streamableDisplay.done();
    
    
    
    
      return {
    
        display: streamableDisplay.value,
    
      };
    
    };

Previous

Error Handling

Next

Migrating from RSC to UI