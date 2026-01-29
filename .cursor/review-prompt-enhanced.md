# Enhanced Prompt: Review ALFRED Mobile App for React Native Best Practices

## Task Overview

Conduct a comprehensive review of the ALFRED React Native mobile app (`apps/native/`) against React Native and Expo best practices, focusing on performance-critical areas, animation patterns, navigation, UI components, and code quality.

## Relevant Context

**App Structure:**

- Expo Router-based navigation with native stack (`expo-router` ~6.0.0)
- React Native 0.81.4, React 19.1.0
- Uses NativeWind for styling (Tailwind CSS)
- Extensive use of `react-native-reanimated` (~4.1.0) for animations
- Uses `@shopify/flash-list` (v2.2.0) in some screens, `FlatList` in others
- Uses `expo-image` for image handling
- Zustand for state management

**Key Files to Review:**

**List Components (CRITICAL - Priority 1):**

- `apps/native/components/chat/chat-list.tsx` - Uses FlatList, has memoization
- `apps/native/app/(drawer)/(tabs)/library/notes.tsx` - Uses FlashList
- `apps/native/app/(drawer)/(tabs)/library/reminders.tsx` - Uses FlashList
- `apps/native/app/(drawer)/(tabs)/library/bookmarks.tsx` - Uses FlatList
- `apps/native/app/(drawer)/(tabs)/library/timers.tsx` - Uses FlatList
- `apps/native/components/review/ReviewQueue.tsx` - Uses FlatList
- `apps/native/components/genui/List.tsx` - Uses FlatList
- `apps/native/components/genui/Grid.tsx` - Uses FlatList
- `apps/native/components/genui/Select.tsx` - Uses FlatList

**Animation Components (HIGH - Priority 2):**

- `apps/native/components/form/Choice.tsx` - Uses Reanimated with scale/opacity
- `apps/native/components/form/Checkbox.tsx` - Uses Reanimated
- `apps/native/components/orb/orb.tsx` - Complex Reanimated animations
- `apps/native/components/voice/Waveform.tsx` - Animated heights
- `apps/native/components/review/ReviewCard.tsx` - Gesture-based animations
- All components in `apps/native/components/genui/` - Various animations

**UI Components (HIGH - Priority 4):**

- All files using `TouchableOpacity` (should be `Pressable`)
- Image usage patterns (should use `expo-image`)
- Safe area handling in ScrollViews
- Modal implementations

**Navigation (HIGH - Priority 3):**

- `apps/native/app/_layout.tsx` - Root layout with Stack navigator
- `apps/native/app/(drawer)/(tabs)/_layout.tsx` - Tab navigator
- Check for native stack vs JS stack usage

## Technical Requirements

**React Native Skills Rules to Check:**

### 1. List Performance (CRITICAL)

- ✅ `list-performance-virtualize` - All lists should use FlashList (not FlatList) for large datasets
- ✅ `list-performance-item-memo` - List items must be memoized with React.memo
- ✅ `list-performance-callbacks` - keyExtractor, renderItem must use useCallback
- ✅ `list-performance-inline-objects` - No inline style objects in renderItem
- ✅ `list-performance-function-references` - Functions must be extracted outside render
- ✅ `list-performance-images` - Images in lists must be optimized
- ✅ `list-performance-item-expensive` - Expensive work must be outside items
- ✅ `list-performance-item-types` - Heterogeneous lists need getItemType

**Current State:**

- `chat-list.tsx`: Uses FlatList (should be FlashList), has memoization ✅, callbacks ✅
- `notes.tsx`: Uses FlashList ✅
- `reminders.tsx`: Uses FlashList ✅
- `bookmarks.tsx`: Uses FlatList (should be FlashList)
- `timers.tsx`: Uses FlatList (should be FlashList)
- `ReviewQueue.tsx`: Uses FlatList (should be FlashList)

### 2. Animation (HIGH)

- ✅ `animation-gpu-properties` - Only animate transform and opacity
- ✅ `animation-derived-value` - Use useDerivedValue for computed animations
- ✅ `animation-gesture-detector-press` - Use Gesture.Tap instead of Pressable where appropriate

**Current State:**

- Extensive Reanimated usage - need to verify only transform/opacity are animated
- Check for non-GPU properties being animated (width, height, backgroundColor)

### 3. Navigation (HIGH)

- ✅ `navigation-native-navigators` - Must use native stack and native tabs

**Current State:**

- Uses Expo Router with native stack ✅
- Uses native tabs ✅

### 4. UI Patterns (HIGH)

- ✅ `ui-expo-image` - All images must use expo-image
- ✅ `ui-pressable` - Use Pressable over TouchableOpacity
- ✅ `ui-safe-area-scroll` - Handle safe areas in ScrollViews
- ✅ `ui-scrollview-content-inset` - Use contentInset for headers
- ✅ `ui-measure-views` - Use onLayout, not measure()
- ✅ `ui-styling` - Use StyleSheet.create or Nativewind

**Current State:**

- Many TouchableOpacity usages found (should be Pressable)
- Uses expo-image ✅
- Uses NativeWind ✅

### 5. State Management (MEDIUM)

- ✅ `react-state-minimize` - Minimize state subscriptions
- ✅ `react-state-dispatcher` - Use dispatcher pattern for callbacks
- ✅ `react-state-fallback` - Show fallback on first render

### 6. Rendering (MEDIUM)

- ✅ `rendering-text-in-text-component` - Wrap text in Text components
- ✅ `rendering-no-falsy-and` - Avoid falsy && for conditional rendering

## Implementation Guidelines

**Review Process:**

1. **List Performance Audit:**
   - Identify all FlatList usages and mark for FlashList migration
   - Verify memoization on all list item components
   - Check callback stability (useCallback usage)
   - Verify no inline style objects in renderItem
   - Check for expensive operations inside renderItem
   - Verify getItemType for heterogeneous lists

2. **Animation Audit:**
   - Scan all Reanimated usage for non-GPU properties
   - Verify useDerivedValue usage for computed values
   - Check gesture handlers vs Pressable usage

3. **UI Component Audit:**
   - Find all TouchableOpacity → Pressable migrations needed
   - Verify all Image → expo-image migrations
   - Check safe area handling
   - Verify onLayout vs measure() usage

4. **Code Quality:**
   - Check for inline style objects
   - Verify StyleSheet.create usage
   - Check for proper Text component wrapping
   - Verify conditional rendering patterns

**Specific Files to Check:**

**High Priority:**

- `apps/native/components/chat/chat-list.tsx` - Migrate to FlashList
- `apps/native/app/(drawer)/(tabs)/library/bookmarks.tsx` - Migrate to FlashList
- `apps/native/app/(drawer)/(tabs)/library/timers.tsx` - Migrate to FlashList
- `apps/native/components/review/ReviewQueue.tsx` - Migrate to FlashList
- All TouchableOpacity → Pressable migrations

**Medium Priority:**

- Animation property checks (transform/opacity only)
- Safe area handling verification
- Image optimization checks

## Success Criteria

**Must Have:**

1. ✅ All lists with >10 items use FlashList (not FlatList)
2. ✅ All list items are memoized with React.memo
3. ✅ All list callbacks (keyExtractor, renderItem) use useCallback
4. ✅ No inline style objects in renderItem functions
5. ✅ All TouchableOpacity replaced with Pressable (where appropriate)
6. ✅ All animations only use transform and opacity properties
7. ✅ All images use expo-image component

**Should Have:**

1. ✅ Safe area handling in all ScrollViews
2. ✅ Proper useDerivedValue for computed animations
3. ✅ No expensive operations in renderItem
4. ✅ Proper Text component wrapping

**Nice to Have:**

1. ✅ getItemType for heterogeneous lists
2. ✅ Optimized image loading in lists
3. ✅ Proper contentInset usage for headers

## Output Format

Provide a structured report with:

1. **Executive Summary** - Overall compliance score and critical issues
2. **List Performance Review** - Detailed findings for each list component
3. **Animation Review** - Reanimated usage analysis
4. **UI Component Review** - TouchableOpacity, Image, Safe Area findings
5. **Action Items** - Prioritized list of fixes needed
6. **Code Examples** - Before/after examples for key fixes

## Additional Considerations

- **Performance Impact:** List performance issues can cause janky scrolling
- **Accessibility:** Pressable provides better accessibility than TouchableOpacity
- **Bundle Size:** FlashList is more performant but slightly larger bundle
- **Migration Effort:** FlatList → FlashList is mostly drop-in replacement
- **Breaking Changes:** Some FlatList props differ in FlashList (check docs)

## Reference Documentation

- React Native Skills: `/Users/jackmazac/.claude/skills/vercel-react-native-skills/SKILL.md`
- FlashList Docs: https://shopify.github.io/flash-list/
- Expo Image Docs: https://docs.expo.dev/versions/latest/sdk/image/
- React Native Reanimated: https://docs.swmansion.com/react-native-reanimated/
