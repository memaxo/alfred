AI SDK RSCSaving and Restoring States

Copy markdown

# Saving and Restoring States

AI SDK RSC is currently experimental. We recommend using AI SDK UI for production. For guidance on migrating from RSC to UI, see our migration guide.

AI SDK RSC provides convenient methods for saving and restoring AI and UI state. This is useful for saving the state of your application after every model generation, and restoring it when the user revisits the generations.

## AI State

### Saving AI state

The AI state can be saved using the `onSetAIState` callback, which gets called whenever the AI state is updated. In the following example, you save the chat history to a database whenever the generation is marked as done.

app/ai.ts

    export const AI = createAI({

      actions: {

        continueConversation,

      },

      onSetAIState: async ({ state, done }) => {

        'use server';




        if (done) {

          saveChatToDB(state);

        }

      },

    });

### Restoring AI state

The AI state can be restored using the `initialAIState` prop passed to the context provider created by the `createAI` function. In the following example, you restore the chat history from a database when the component is mounted.

    import { ReactNode } from 'react';

    import { AI } from './ai';




    export default async function RootLayout({

      children,

    }: Readonly) {

      const chat = await loadChatFromDB();




      return (





            {children}





      );

    }

## UI State

### Saving UI state

The UI state cannot be saved directly, since the contents aren't yet serializable. Instead, you can use the AI state as proxy to store details about the UI state and use it to restore the UI state when needed.

### Restoring UI state

The UI state can be restored using the AI state as a proxy. In the following example, you restore the chat history from the AI state when the component is mounted. You use the `onGetUIState` callback to listen for SSR events and restore the UI state.

app/ai.ts

    export const AI = createAI({

      actions: {

        continueConversation,

      },

      onGetUIState: async () => {

        'use server';




        const historyFromDB: ServerMessage[] = await loadChatFromDB();

        const historyFromApp: ServerMessage[] = getAIState();




        // If the history from the database is different from the

        // history in the app, they're not in sync so return the UIState

        // based on the history from the database




        if (historyFromDB.length !== historyFromApp.length) {

          return historyFromDB.map(({ role, content }) => ({

            id: generateId(),

            role,

            display:

              role === 'function' ? (



              ) : (

                content

              ),

          }));

        }

      },

    });

To learn more, check out this example that persists and restores states in your Next.js application.

---

Next, you will learn how you can use `@ai-sdk/rsc` functions like `useActions` and `useUIState` to create interactive, multistep interfaces.

Previous

Managing Generative UI State

Next

Multistep Interfaces
