AI SDK UIOverview

Copy markdown

# AI SDK UI

AI SDK UI is designed to help you build interactive chat, completion, and assistant applications with ease. It is a **framework-agnostic toolkit** , streamlining the integration of advanced AI functionalities into your applications.

AI SDK UI provides robust abstractions that simplify the complex tasks of managing chat streams and UI updates on the frontend, enabling you to develop dynamic AI-driven interfaces more efficiently. With three main hooks — **`useChat`** , **`useCompletion`** , and **`useObject`** — you can incorporate real-time chat capabilities, text completions, streamed JSON, and interactive assistant features into your app.

- **`useChat`** offers real-time streaming of chat messages, abstracting state management for inputs, messages, loading, and errors, allowing for seamless integration into any UI design.
- **`useCompletion`** enables you to handle text completions in your applications, managing the prompt input and automatically updating the UI as new completions are streamed.
- **`useObject`** is a hook that allows you to consume streamed JSON objects, providing a simple way to handle and display structured data in your application.

These hooks are designed to reduce the complexity and time required to implement AI interactions, letting you focus on creating exceptional user experiences.

## UI Framework Support

AI SDK UI supports the following frameworks: React, Svelte, Vue.js, and Angular. Here is a comparison of the supported functions across these frameworks:

| Function      | React | Svelte           | Vue.js | Angular          |
| ------------- | ----- | ---------------- | ------ | ---------------- |
| useChat       |       | Chat             |        | Chat             |
| useCompletion |       | Completion       |        | Completion       |
| useObject     |       | StructuredObject |        | StructuredObject |

Contributions are welcome to implement missing features for non-React frameworks.

## Framework Examples

Explore these example implementations for different frameworks:

- **Next.js**
- **Nuxt**
- **SvelteKit**
- **Angular**

## API Reference

Please check out the AI SDK UI API Reference for more details on each function.

Previous

AI SDK UI

Next

Chatbot
