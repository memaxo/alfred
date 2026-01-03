# Common React Native Pitfalls

Rules to avoid common bugs in the native app codebase.

## Hook Patterns

1. **tRPC mutation hooks with callbacks.** Pass options object to hook, not after:
   ```tsx
   // ✅ Correct
   const mutation = useNoteCreate({
     onSuccess: (data) => router.push(`/notes/${data.id}`),
   });
   
   // ❌ Wrong - causes syntax errors
   const mutation = useNoteCreate();
     onSuccess: (data) => { ... },
   });
   ```

2. **Query hooks with enabled option.** Pass as second argument:
   ```tsx
   const query = useNoteGet({ id }, { enabled: !!id });
   ```

3. **Import all React hooks used.** If using `useEffect`, `useMemo`, `useCallback`, ensure they're imported:
   ```tsx
   import { useCallback, useEffect, useMemo, useState } from "react";
   ```

## JSX Syntax

4. **No type assertions in JSX tags.** Extract to variable first:
   ```tsx
   // ✅ Correct
   const TrpcProvider = (trpc as any).Provider;
   return <TrpcProvider client={client}>{children}</TrpcProvider>;
   
   // ❌ Wrong - invalid JSX syntax
   return <(trpc as any).Provider>{children}</(trpc as any).Provider>;
   ```

5. **JSX requires .tsx extension.** Files containing JSX must use `.tsx`, not `.ts`.

## Accessibility

6. **Valid accessibilityRole values.** React Native has specific valid roles:
   - Use `"search"` not `"searchbox"`
   - `"listitem"` is NOT valid in React Native (just remove it)
   - Valid roles: `"none"`, `"button"`, `"link"`, `"search"`, `"image"`, `"header"`, `"text"`, etc.

## Optional Dependencies

7. **Metro bundles all imports.** Even dynamic imports inside conditionals are bundled:
   ```tsx
   // ❌ Still causes error if package not installed
   if (process.env.SOME_KEY) {
     const pkg = require("optional-package");
   }
   
   // ✅ Use no-op stubs for truly optional features
   let optionalFeature: any = null;
   // Initialize only if package is installed as dependency
   ```

8. **Stub optional analytics.** If analytics provider not installed, use no-op implementation that logs in dev mode.

## iOS Builds

9. **Simulator builds skip code signing.** Use these xcodebuild flags:
   ```bash
   CODE_SIGN_IDENTITY="" CODE_SIGNING_REQUIRED=NO CODE_SIGNING_ALLOWED=NO
   ```

10. **Patch node_modules systematically.** Use `scripts/apply-patches.sh` for reproducible fixes to third-party packages.

11. **Match SDK and simulator runtime versions.** iOS SDK version must match installed simulator runtime (e.g., SDK 26.2 needs iOS 26.2 simulator).
