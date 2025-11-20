# Tremor Blocks Setup Guide

This document confirms that Tremor Blocks is properly configured for the ALFRED web application.

## ✅ Setup Status

### Dependencies Installed

All required dependencies are installed:

- ✅ **@tremor/react** (`^3.18.7`) - Tremor component library
- ✅ **React** (`19.1.0`) - Meets requirement (v18.2.0+)
- ✅ **Tailwind CSS** (`^4.1.17`) - Using Tailwind v4 (Tremor docs specify v3.4.0+, but v4 is compatible)
- ✅ **@tailwindcss/forms** (`^0.5.10`) - Forms plugin
- ✅ **@remixicon/react** (`^4.7.0`) - Icon library (v4.6.0+)

### Radix UI Primitives

All required Radix UI primitives are installed:

- ✅ `@radix-ui/react-accordion`
- ✅ `@radix-ui/react-checkbox`
- ✅ `@radix-ui/react-dialog`
- ✅ `@radix-ui/react-dropdown-menu`
- ✅ `@radix-ui/react-hover-card`
- ✅ `@radix-ui/react-label`
- ✅ `@radix-ui/react-navigation-menu`
- ✅ `@radix-ui/react-popover`
- ✅ `@radix-ui/react-radio-group`
- ✅ `@radix-ui/react-select`
- ✅ `@radix-ui/react-slider`
- ✅ `@radix-ui/react-slot`
- ✅ `@radix-ui/react-switch`
- ✅ `@radix-ui/react-tabs`
- ✅ `@radix-ui/react-toast`
- ✅ `@radix-ui/react-tooltip`

### Additional Dependencies

- ✅ `@internationalized/date` - Date picker support
- ✅ `date-fns` (`3.6.0`) - Date utilities
- ✅ `react-day-picker` (`8.10.1`) - Date picker component
- ✅ `recharts` (`^3.4.1`) - Chart library
- ✅ `@react-aria/datepicker` - Date picker accessibility
- ✅ `@react-stately/datepicker` - Date picker state management

## Configuration

### Tailwind CSS v4 Setup

The project uses Tailwind CSS v4 with the new `@theme` syntax:

**File:** `apps/web/src/index.css`

```css
@import "tailwindcss";
@import "tw-animate-css";
@plugin "@tailwindcss/forms";
```

### Tremor Keyframes & Animations

All Tremor-specific animations are configured:

- `hide` - Fade out animation
- `slide-down-and-fade` - Slide down with fade
- `slide-left-and-fade` - Slide left with fade
- `slide-up-and-fade` - Slide up with fade
- `slide-right-and-fade` - Slide right with fade
- `accordion-open` - Accordion expand animation
- `accordion-close` - Accordion collapse animation
- `dialog-overlay-show` - Dialog overlay fade in
- `dialog-content-show` - Dialog content scale + fade

### Utilities

Tremor utilities are available in `apps/web/src/lib/utils.ts`:

- ✅ `cx()` - Class name utility (Tremor's version)
- ✅ `focusInput` - Focus styles for inputs
- ✅ `focusRing` - Focus ring styles
- ✅ `hasErrorInput` - Error state styles

### Chart Utilities

Chart utilities are available in `apps/web/src/lib/chartUtils.ts`:

- ✅ `chartColors` - Color palette for charts
- ✅ `constructCategoryColors` - Category color mapping
- ✅ `getColorClassName` - Color class name helper
- ✅ `getYAxisDomain` - Y-axis domain calculation
- ✅ `hasOnlyOneValueForKey` - Data validation helper

## HTML Configuration

The root HTML element includes Tremor-recommended classes:

```tsx
<html className="dark antialiased" lang="en">
```

- `dark` - Dark mode enabled
- `antialiased` - Font smoothing (Tremor recommendation)

## Usage

### Importing Tremor Components

```tsx
import { Card, Metric, Text } from "@tremor/react";
```

### Using Chart Components

```tsx
import { AreaChart, Area } from "@tremor/react";
import { chartColors, getColorClassName } from "@/lib/chartUtils";
```

### Using Utilities

```tsx
import { cx, focusInput, focusRing } from "@/lib/utils";
```

## Notes

### Tailwind v4 Compatibility

Tremor Blocks documentation specifies Tailwind v3.4.0+, but the project uses Tailwind v4. This is compatible because:

1. Tailwind v4 maintains backward compatibility with v3 utilities
2. Tremor components use standard Tailwind classes
3. The new `@theme` syntax supports all required animations

### React Native (Native App)

**Important:** Tremor Blocks are designed for web React and **will not work** in the React Native app (`apps/native/`). The native app uses NativeWind, which has different constraints.

For native app charts and visualizations, consider:
- React Native chart libraries (e.g., `react-native-chart-kit`)
- Custom components using NativeWind styling
- Shared data visualization logic (not UI components)

## Verification

To verify Tremor is working:

1. Import a Tremor component:
   ```tsx
   import { Card } from "@tremor/react";
   ```

2. Use it in a component:
   ```tsx
   <Card>
     <Text>Hello Tremor</Text>
   </Card>
   ```

3. Check that animations work (accordions, dialogs, etc.)

## Resources

- [Tremor Blocks Documentation](https://blocks.tremor.so/getting-started)
- [Tremor Component Library](https://www.tremor.so/)
- [Tremor Blocks Examples](https://blocks.tremor.so/)
- **[Complete Components & Blocks Reference](../reference/tremor/components-and-blocks.md)** - Full list of all Tremor components and 300+ blocks

