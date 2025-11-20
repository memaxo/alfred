# Tremor Components & Blocks Reference

Complete reference of all components and blocks available from Tremor React library and Tremor Blocks.

**Source:** [Tremor Blocks](https://blocks.tremor.so/blocks) | [Tremor Documentation](https://www.tremor.so/)

## Core Components (`@tremor/react`)

These are the base components exported from the `@tremor/react` package:

### Layout Components
- `Card` - Container component with header, content, footer
- `Divider` - Horizontal divider line
- `Grid` - Grid layout system
- `Flex` - Flexbox layout component

### Typography Components
- `Text` - Text component with size variants
- `Title` - Heading component
- `Subtitle` - Subheading component

### Metric Components
- `Metric` - KPI/metric display component
- `Badge` - Status badge component
- `BadgeDelta` - Badge with delta indicator (up/down)

### Chart Components
- `AreaChart` - Area chart component
- `BarChart` - Bar chart component
- `LineChart` - Line chart component
- `DonutChart` - Donut/pie chart component
- `SparkChart` - Sparkline chart component
- `ChartContainer` - Chart wrapper with styling
- `ChartTooltip` - Custom tooltip for charts
- `ChartLegend` - Legend component for charts

### Table Components
- `Table` - Table component
- `TableBody` - Table body wrapper
- `TableHead` - Table header wrapper
- `TableHeaderCell` - Header cell component
- `TableRow` - Table row component
- `TableCell` - Table cell component

### Form Components
- `TextInput` - Text input component
- `NumberInput` - Number input component
- `SearchSelect` - Searchable select dropdown
- `Select` - Select dropdown component
- `SelectItem` - Select option component
- `Button` - Button component
- `Switch` - Toggle switch component
- `Checkbox` - Checkbox component
- `DatePicker` - Date picker component
- `DateRangePicker` - Date range picker component

### Navigation Components
- `Tab` - Tab component
- `TabGroup` - Tab group container
- `TabList` - Tab list container
- `TabPanels` - Tab panels container
- `TabPanel` - Individual tab panel

### Feedback Components
- `ProgressBar` - Progress bar component
- `ProgressCircle` - Circular progress indicator
- `Callout` - Callout/alert component
- `Toast` - Toast notification component

### Other Components
- `Icon` - Icon wrapper component
- `Avatar` - Avatar component
- `List` - List component
- `ListItem` - List item component

---

## Tremor Blocks Categories

Tremor Blocks provides **300+ pre-designed blocks** organized into categories. Each category contains multiple block variations.

### Charts & Helpers

#### Area Charts (16 blocks)
- Basic area charts
- Stacked area charts
- Multi-series area charts
- Area charts with tooltips
- Area charts with legends
- Responsive area charts

#### Line Charts (12 blocks)
- Basic line charts
- Multi-line charts
- Line charts with markers
- Line charts with gradients
- Animated line charts
- Time series line charts

#### Bar Charts (12 blocks)
- Vertical bar charts
- Horizontal bar charts
- Stacked bar charts
- Grouped bar charts
- Bar charts with labels
- Responsive bar charts

#### Donut Charts (7 blocks)
- Basic donut charts
- Donut charts with labels
- Donut charts with legends
- Animated donut charts
- Multi-series donut charts

#### Chart Tooltips (21 blocks)
- Custom tooltip designs
- Interactive tooltips
- Multi-series tooltips
- Time-based tooltips
- Metric tooltips

### Advanced Visualizations

#### Bar Lists (7 blocks)
- Horizontal bar lists
- Vertical bar lists
- Bar lists with icons
- Bar lists with badges
- Animated bar lists

#### Status Monitoring (10 blocks)
- System status dashboards
- Health check displays
- Service status cards
- Uptime monitors
- Alert displays

#### Spark Charts (6 blocks)
- Inline spark charts
- Spark charts in tables
- Mini trend indicators
- Micro visualizations

#### KPI Cards (29 blocks)
- Single metric cards
- Multi-metric cards
- KPI cards with trends
- KPI cards with comparisons
- KPI cards with icons
- KPI cards with badges
- Responsive KPI layouts

#### Chart Compositions (15 blocks)
- Combined chart types
- Multi-chart dashboards
- Chart grids
- Chart with metrics
- Chart with filters

### Inputs & Forms

#### Standard Forms (6 blocks)
- Login forms
- Registration forms
- Contact forms
- Settings forms
- Multi-step forms
- Form layouts

#### File Upload (7 blocks)
- Single file upload
- Multiple file upload
- Drag-and-drop upload
- Image upload with preview
- File upload with progress
- File upload with validation

### Tables

#### Standard Tables (11 blocks)
- Basic data tables
- Sortable tables
- Filterable tables
- Responsive tables
- Tables with pagination
- Tables with search

#### Table Actions (11 blocks)
- Tables with row actions
- Bulk actions
- Inline editing
- Row selection
- Export functionality

#### Table Pagination (8 blocks)
- Numbered pagination
- Infinite scroll
- Load more pagination
- Cursor-based pagination
- Responsive pagination

### Layout & Forms

#### Page Shells (6 blocks)
- Dashboard layouts
- Settings page layouts
- Detail page layouts
- List page layouts
- Full-width layouts
- Sidebar layouts

#### Filterbar (16 blocks)
- Basic filter bars
- Advanced filters
- Date range filters
- Multi-select filters
- Search filters
- Filter combinations

#### Empty States (10 blocks)
- No data states
- Error states
- Loading states
- Empty search results
- Empty list states
- Onboarding empty states

#### Dialogs (9 blocks)
- Confirmation dialogs
- Form dialogs
- Info dialogs
- Alert dialogs
- Modal dialogs
- Drawer dialogs

#### Grid Lists (15 blocks)
- Card grids
- Product grids
- Image grids
- Responsive grids
- Masonry layouts
- Grid with filters

#### Banners (5 blocks)
- Info banners
- Warning banners
- Success banners
- Error banners
- Promotional banners

#### Badges (13 blocks)
- Status badges
- Count badges
- Icon badges
- Colored badges
- Animated badges
- Badge groups

### Marketing

#### Pricing Sections (8 blocks)
- Pricing tables
- Feature comparisons
- Tiered pricing
- Subscription plans
- Pricing cards

#### Logins (10 blocks)
- Email/password login
- Social login
- Two-factor auth
- Password reset
- Sign up flows

#### Account and User Management (15 blocks)
- User profiles
- Account settings
- User lists
- Role management
- Permission management
- User activity

#### Onboarding & Feed (16 blocks)
- Welcome screens
- Feature tours
- Step-by-step guides
- Progress indicators
- Feed layouts
- Activity feeds

#### Billing & Usage (10 blocks)
- Invoice displays
- Payment methods
- Usage meters
- Billing history
- Subscription management
- Payment forms

---

## Component Import Examples

### Basic Components
```tsx
import {
  Card,
  Text,
  Title,
  Metric,
  Badge,
  Button,
} from "@tremor/react";
```

### Chart Components
```tsx
import {
  AreaChart,
  BarChart,
  LineChart,
  DonutChart,
  SparkChart,
  ChartContainer,
  ChartTooltip,
} from "@tremor/react";
```

### Table Components
```tsx
import {
  Table,
  TableBody,
  TableHead,
  TableHeaderCell,
  TableRow,
  TableCell,
} from "@tremor/react";
```

### Form Components
```tsx
import {
  TextInput,
  NumberInput,
  SearchSelect,
  Select,
  SelectItem,
  DatePicker,
  DateRangePicker,
  Switch,
  Checkbox,
} from "@tremor/react";
```

### Navigation Components
```tsx
import {
  Tab,
  TabGroup,
  TabList,
  TabPanels,
  TabPanel,
} from "@tremor/react";
```

---

## Usage with ALFRED Design System

When using Tremor components with ALFRED's "Signal in the Void" design system:

1. **Override Colors**: Use ALFRED's bioluminescent color palette
   ```tsx
   <Card className="bg-void-surface/40 border border-white/10">
     <Text className="text-biolum">Content</Text>
   </Card>
   ```

2. **Chart Colors**: Use `chartColors` from `@/lib/chartUtils`
   ```tsx
   import { chartColors, getColorClassName } from "@/lib/chartUtils";
   ```

3. **Typography**: Apply ALFRED's tight tracking
   ```tsx
   <Title className="tracking-tighter text-biolum">Title</Title>
   ```

4. **Radius**: Use ALFRED's radius tokens
   ```tsx
   <Card className="rounded-3xl">...</Card>
   ```

---

## Resources

- **Tremor Blocks**: https://blocks.tremor.so/blocks
- **Tremor Documentation**: https://www.tremor.so/docs
- **Tremor GitHub**: https://github.com/tremorlabs/tremor
- **Tremor Setup Guide**: [`docs/guides/tremor-setup.md`](../../guides/tremor-setup.md)

---

## Notes

- **Total Blocks**: 300+ pre-designed blocks
- **Component Library**: `@tremor/react` provides base components
- **Blocks**: Pre-composed UI patterns using base components
- **Customization**: All components are fully customizable
- **TypeScript**: Full TypeScript support
- **Accessibility**: Built on Radix UI primitives

---

**Last Updated**: 2025-01-27  
**Tremor Version**: 3.18.7

