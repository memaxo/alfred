# React Native Performance Patterns

## FlashList Migration Pattern

**When:** Migrating from `FlatList` to `FlashList` for lists with >10 items.

**Pattern:**

```typescript
// Before
import { FlatList } from "react-native";
<FlatList
  data={items}
  renderItem={renderItem}
  keyExtractor={keyExtractor}
/>

// After
import { FlashList } from "@shopify/flash-list";
<FlashList
  data={items}
  renderItem={renderItem}
  keyExtractor={keyExtractor}
  estimatedItemSize={80}  // Required - estimate typical item height
/>
```

**Key Changes:**

- Replace import: `FlatList` → `FlashList`
- Add `estimatedItemSize` prop (required)
- Update ref types: `useRef<FlashList<T>>(null)`
- Remove FlatList-specific props that don't exist in FlashList
- Keep all other props (keyExtractor, renderItem, refreshControl, etc.)

**Estimated Item Sizes:**

- Chat messages: 80px
- Bookmarks: 100px
- Timers: 90px
- Reviews: 120px
- List items: 60px
- Grid rows: 50px
- Select options: 50px

## List Item Memoization Pattern

**When:** Creating list item components that render in FlashList/FlatList.

**Pattern:**

```typescript
// Item component
function BookmarkItem({ item, onPress, onDelete }: BookmarkItemProps) {
  return <View>...</View>;
}

// Memoized wrapper with custom comparison
const MemoizedBookmarkItem = memo(
  BookmarkItem,
  (prev, next) =>
    prev.item.id === next.item.id &&
    prev.item === next.item &&
    prev.onPress === next.onPress &&
    prev.onDelete === next.onDelete
);

// Use in renderItem
const renderItem = useCallback(
  ({ item }: { item: BookmarkItem }) => (
    <MemoizedBookmarkItem
      item={item}
      onPress={handlePress}
      onDelete={handleDelete}
    />
  ),
  [handlePress, handleDelete]
);
```

**Key Points:**

- Compare all props that affect rendering (item, callbacks)
- Use reference equality (`===`) for objects and functions
- Use id equality for items when item reference might change
- Place memoized component outside the main component function

## List Callback Pattern

**When:** Creating renderItem or keyExtractor functions for lists.

**Pattern:**

```typescript
// ✅ Good - useCallback with stable dependencies
const keyExtractor = useCallback(
  (item: ItemType, index: number) => item.id ?? `item-${index}`,
  []
);

const renderItem = useCallback(
  ({ item }: { item: ItemType }) => (
    <MemoizedItemComponent item={item} onPress={handlePress} />
  ),
  [handlePress]
);

// ❌ Bad - inline function creates new reference on every render
<FlashList
  renderItem={({ item }) => <ItemComponent item={item} />}
/>
```

**Key Points:**

- Always use `useCallback` for renderItem and keyExtractor
- Include all dependencies in dependency array
- Extract inline renderItem functions to useCallback

## Pressable Migration Pattern

**When:** Migrating from `TouchableOpacity` to `Pressable`.

**Pattern:**

```typescript
// Before
<TouchableOpacity
  onPress={handlePress}
  activeOpacity={0.7}
>
  <Text>Button</Text>
</TouchableOpacity>

// After - Simple case
<Pressable
  onPress={handlePress}
  style={({ pressed }) => [
    styles.button,
    pressed && { opacity: 0.7 },
  ]}
>
  <Text>Button</Text>
</Pressable>

// After - With NativeWind classes
<Pressable
  className="rounded-lg border p-4"
  onPress={handlePress}
  style={({ pressed }) => [
    pressed && { opacity: 0.7 },
  ]}
>
  <Text>Content</Text>
</Pressable>
```

**Key Points:**

- Remove `activeOpacity` prop
- Use `style` prop with pressed state handler
- For complex pressed states, use `useAnimatedStyle` (see FluidButton pattern)
- Test accessibility (screen readers, touch targets)

## Animation Optimization Pattern

**When:** Animating dimensions (height, width) or non-GPU properties.

**Pattern:**

```typescript
// ❌ Bad - Animating height (not GPU-accelerated)
const animatedStyle = useAnimatedStyle(() => ({
  height: animatedHeight.value,
}));

// ✅ Good - Use scaleY transform (GPU-accelerated)
const baseHeight = 4;
const animatedScale = useSharedValue(1);

useEffect(() => {
  const targetHeight = calculateHeight();
  const scaleY = targetHeight / baseHeight;
  animatedScale.value = withTiming(scaleY, { duration: 100 });
}, [dependencies]);

const animatedStyle = useAnimatedStyle(() => ({
  transform: [{ scaleY: animatedScale.value }],
}));

<Animated.View
  style={[
    { height: baseHeight },  // Set base height via style
    animatedStyle,
  ]}
/>
```

**Key Points:**

- Only animate `transform` and `opacity` properties
- Use `scaleY`/`scaleX` for height/width animations
- Set base dimensions via style prop
- Calculate scale factor: `targetValue / baseValue`

## Inline Style Object Removal Pattern

**When:** Removing inline style objects from list props or renderItem.

**Pattern:**

```typescript
// ❌ Bad - Inline style object
<FlashList
  contentContainerStyle={{ padding: 16 }}
  renderItem={({ item }) => (
    <View style={[styles.item, isActive && { backgroundColor: color }]} />
  )}
/>

// ✅ Good - StyleSheet.create
const styles = StyleSheet.create({
  contentContainer: { padding: 16 },
  itemActive: { backgroundColor: theme.colors.glass.active },
});

<FlashList
  contentContainerStyle={styles.contentContainer}
  renderItem={({ item }) => (
    <View style={[styles.item, isActive && styles.itemActive]} />
  )}
/>

// For dynamic theme colors, use conditional inline (acceptable for small objects)
style={[
  styles.item,
  isActive && { backgroundColor: theme.colors.glass.active },
]}
```

**Key Points:**

- Move static objects to StyleSheet.create
- For conditional styles, create separate style entries or use conditional inline (acceptable for small objects)
- Avoid creating large objects inline in renderItem

## Common Pitfalls

1. **Missing estimatedItemSize** - FlashList requires this prop for optimal performance
2. **Unstable callbacks** - Not using useCallback causes unnecessary re-renders
3. **Missing memoization** - List items re-render on every list update
4. **Animating non-GPU properties** - Causes janky animations and layout thrashing
5. **Inline style objects** - Creates new objects on every render, causing memory pressure
