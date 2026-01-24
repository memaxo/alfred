AI SDK RSCError Handling

Copy markdown

# Error Handling

AI SDK RSC is currently experimental. We recommend using AI SDK UI for production. For guidance on migrating from RSC to UI, see our migration guide.

Two categories of errors can occur when working with the RSC API: errors while streaming user interfaces and errors while streaming other values.

## Handling UI Errors

To handle errors while generating UI, the `streamableUI` object exposes an `error()` method.

app/actions.tsx

    'use server';




    import { createStreamableUI } from '@ai-sdk/rsc';




    export async function getStreamedUI() {

      const ui = createStreamableUI();




      (async () => {

        ui.update(loading);

        const data = await fetchData();

        ui.done({data});

      })().catch(e => {

        ui.error(Error: {e.message});

      });




      return ui.value;

    }

With this method, you can catch any error with the stream, and return relevant UI. On the client, you can also use a React Error Boundary to wrap the streamed component and catch any additional errors.

app/page.tsx

    import { getStreamedUI } from '@/actions';

    import { useState } from 'react';

    import { ErrorBoundary } from './ErrorBoundary';




    export default function Page() {

      const [streamedUI, setStreamedUI] = useState(null);




      return (



           {

              const newUI = await getStreamedUI();

              setStreamedUI(newUI);

            }}

          >

            What does the new UI look like?



          {streamedUI}



      );

    }

## Handling Other Errors

To handle other errors while streaming, you can return an error object that the receiver can use to determine why the failure occurred.

app/actions.tsx

    'use server';




    import { createStreamableValue } from '@ai-sdk/rsc';

    import { fetchData, emptyData } from '../utils/data';




    export const getStreamedData = async () => {

      const streamableData = createStreamableValue(emptyData);




      try {

        (() => {

          const data1 = await fetchData();

          streamableData.update(data1);




          const data2 = await fetchData();

          streamableData.update(data2);




          const data3 = await fetchData();

          streamableData.done(data3);

        })();




        return { data: streamableData.value };

      } catch (e) {

        return { error: e.message };

      }

    };

Previous

Handling Loading State

Next

Handling Authentication
