# Adding a New Manifest Component

This guide ensures that new UI primitives follow ALFRED's "Integrated" contract and maintain design system consistency.

## Step 1: Implementation

1. Create the component implementation. If it's a primitive, place it in `apps/web/src/components/ui/`.
2. Ensure it follows the **"Signal in the Void"** design rules (separation transparency, biolum colors, no drop shadows).
3. Use `useReducedMotion()` for any animations.

## Step 2: Canonical Wrapper

Every component needs a single-word root wrapper in `apps/web/src/components/`.

```tsx
// apps/web/src/components/mycomponent.tsx
export { MyComponent } from "./ui/mycomponent";
export type { MyComponentProps } from "./ui/mycomponent";
```

## Step 3: Manifest Registration

Add the component to `apps/web/src/components/manifest.ts`.

```ts
export const componentRegistry = {
  // ...
  mycomponent: "source.url/docs/components/mycomponent",
};

export const componentStatus = {
  // ...
  mycomponent: "integrated",
};
```

## Step 4: Demo Gallery

Add a demo entry to `apps/web/src/components/demo.tsx`.

```tsx
case "mycomponent":
  return <MyComponent sampleProp="value" />;
```

## Step 5: Verification

1. Add a usage entry to `componentUsage` in `manifest.ts`.
2. Run the automated manifest tests:
   ```bash
   bun test apps/web/src/components/__tests__/manifest.test.ts
   ```
3. Verify it renders in the **Components** desktop app.
