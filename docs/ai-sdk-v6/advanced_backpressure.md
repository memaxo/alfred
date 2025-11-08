AdvancedBackpressure

Copy markdown

# Stream Back-pressure and Cancellation

This page focuses on understanding back-pressure and cancellation when working with streams. You do not need to know this information to use the AI SDK, but for those interested, it offers a deeper dive on why and how the SDK optimally streams responses.

In the following sections, we'll explore back-pressure and cancellation in the context of a simple example program. We'll discuss the issues that can arise from an eager approach and demonstrate how a lazy approach can resolve them.

## Back-pressure and Cancellation with Streams

Let's begin by setting up a simple example program:
    
    
    // A generator that will yield positive integers
    
    async function* integers() {
    
      let i = 1;
    
      while (true) {
    
        console.log(`yielding ${i}`);
    
        yield i++;
    
    
    
    
        await sleep(100);
    
      }
    
    }
    
    function sleep(ms) {
    
      return new Promise(resolve => setTimeout(resolve, ms));
    
    }
    
    
    
    
    // Wraps a generator into a ReadableStream
    
    function createStream(iterator) {
    
      return new ReadableStream({
    
        async start(controller) {
    
          for await (const v of iterator) {
    
            controller.enqueue(v);
    
          }
    
          controller.close();
    
        },
    
      });
    
    }
    
    
    
    
    // Collect data from stream
    
    async function run() {
    
      // Set up a stream of integers
    
      const stream = createStream(integers());
    
    
    
    
      // Read values from our stream
    
      const reader = stream.getReader();
    
      for (let i = 0; i  setTimeout(resolve, ms));
    
    }
    
    
    
    
    // Wraps a generator into a ReadableStream
    
    function createStream(iterator) {
    
      return new ReadableStream({
    
        async start(controller) {
    
          for await (const v of iterator) {
    
            controller.enqueue(v);
    
          }
    
          controller.close();
    
        },
    
      });
    
    }
    
    // Collect data from stream
    
    async function run() {
    
      // Set up a stream that of integers
    
      const stream = createStream(integers());
    
    
    
    
      // Read values from our stream
    
      const reader = stream.getReader();
    
      // We're only reading 3 items this time:
    
      for (let i = 0; i < 3; i++) {
    
        // we know our stream is infinite, so there's no need to check `done`.
    
        const { value } = await reader.read();
    
        console.log(`read ${value}`);
    
    
    
    
        await sleep(1000);
    
      }
    
    }
    
    run();

We're back to yielding 10x the number of values read. But notice now, after we've read 3 values, we're continuing to yield new values. We know that our reader will never read another value, but our stream doesn't! The eager `for await (…)` will continue forever, loudly enqueuing new values into our stream's buffer and increasing our memory usage until it consumes all available program memory.

The fix to this is exactly the same: use `pull` and manual iteration. By producing values _**lazily**_ , we tie the lifetime of our integer generator to the lifetime of the reader. Once the reads stop, the yields will stop too:
    
    
    // Wraps a generator into a ReadableStream
    
    function createStream(iterator) {
    
      return new ReadableStream({
    
        async pull(controller) {
    
          const { value, done } = await iterator.next();
    
    
    
    
          if (done) {
    
            controller.close();
    
          } else {
    
            controller.enqueue(value);
    
          }
    
        },
    
      });
    
    }

Since the solution is the same as implementing back-pressure, it shows that they're just 2 facets of the same problem: Pushing values into a stream should be done **lazily** , and doing it eagerly results in expected problems.

## Tying Stream Laziness to AI Responses

Now let's imagine you're integrating AIBot service into your product. Users will be able to prompt "count from 1 to infinity", the browser will fetch your AI API endpoint, and your servers connect to AIBot to get a response. But "infinity" is, well, infinite. The response will never end!

After a few seconds, the user gets bored and navigates away. Or maybe you're doing local development and a hot-module reload refreshes your page. The browser will have ended its connection to the API endpoint, but will your server end its connection with AIBot?

If you used the eager `for await (...)` approach, then the connection is still running and your server is asking for more and more data from AIBot. Our server spawned a "thread" and there's no signal when we can end the eager pulls. Eventually, the server is going to run out of memory (remember, there's no active fetch connection to read the buffering responses and free them).

With the lazy approach, this is taken care of for you. Because the stream will only request new data from AIBot when the consumer requests it, navigating away from the page naturally frees all resources. The fetch connection aborts and the server can clean up the response. The `ReadableStream` tied to that response can now be garbage collected. When that happens, the connection it holds to AIBot can then be freed.

Previous

Stopping Streams

Next

Caching