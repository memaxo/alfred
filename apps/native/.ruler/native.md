# Native App (Expo) Standards

1. **Platform Parity.** Maintain feature parity with the web app while using native-first components (e.g., `FlashList`).

2. **Auth Sync.** Use the Better Auth Expo plugin for secure session persistence across native reloads.

3. **List Performance.** All lists with >10 items must use `FlashList` from `@shopify/flash-list` with `estimatedItemSize` prop. Never use `FlatList` for scrollable lists.

4. **List Memoization.** All list item components must be memoized with `React.memo` and custom comparison function comparing item id, item reference, and callback props.

5. **List Callbacks.** `renderItem` and `keyExtractor` must use `useCallback` with proper dependencies to ensure stable references.

6. **List Styles.** No inline style objects in `renderItem` functions or list props like `contentContainerStyle`. Move all styles to `StyleSheet.create`.

7. **Touch Targets.** Use `Pressable` instead of `TouchableOpacity` for better accessibility and control. Use `style={({ pressed }) => [pressed && { opacity: 0.7 }]}` for pressed states.

8. **Animation Properties.** Only animate `transform` and `opacity` properties (GPU-accelerated). Never animate `height`, `width`, or `backgroundColor` directly. Use `scaleY`/`scaleX` transforms instead of height/width animations.
