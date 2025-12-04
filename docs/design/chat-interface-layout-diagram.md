# ALFRED Chat Interface: Pixel-Perfect Layout Diagram

## Desktop Layout (1920x1080px)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ HEADER (1920x80px)                                                           │
│ ┌─────────────────────────────────────┐ ┌─────────────────────────────────┐ │
│ │ LEFT SECTION (600px)                 │ │ RIGHT SECTION (600px)            │ │
│ │                                     │ │                                 │ │
│ │ [●] Connected  [assistant ▼] Clear│ │              [Context] [Actions] │ │
│ │ 24px                                │ │                         24px    │ │
│ └─────────────────────────────────────┘ └─────────────────────────────────┘ │
│                                                                               │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│ ┌──────────────────────────────────────┐ ┌──────────────────────────────┐ │
│ │ CHAT AREA (1280x920px)               │ │ ACTIONS PANEL (640x920px)    │ │
│ │                                      │ │ [conditional, right side]     │ │
│ │ ┌──────────────────────────────────┐ │ │                              │ │
│ │ │ MESSAGE LIST (1280x800px)        │ │ │ ┌──────────────────────────┐ │ │
│ │ │                                  │ │ │ │ Active Actions           │ │ │
│ │ │ 24px padding                     │ │ │ │ [counter badge]          │ │ │
│ │ │                                  │ │ │ └──────────────────────────┘ │ │
│ │ │  [User Message]       600px max │ │ │                              │ │
│ │ │  Right-aligned                   │ │ │ ┌──────────────────────────┐ │ │
│ │ │  Blue glow                       │ │ │ │ Action Item 1            │ │ │
│ │ │                                  │ │ │ │ [icon] Tool Name         │ │ │
│ │ │                                  │ │ │ │         Description      │ │ │
│ │ │  [AI Message]         600px max │ │ │ └──────────────────────────┘ │ │
│ │ │  Left-aligned                    │ │ │                              │ │
│ │ │  Cyan glow                      │ │ │ ┌──────────────────────────┐ │ │
│ │ │                                  │ │ │ │ Action Item 2            │ │ │
│ │ │  [Code Block]                   │ │ │ └──────────────────────────┘ │ │
│ │ │  Extruded on hover              │ │ │                              │ │
│ │ │                                  │ │ │ ...scrollable...            │ │
│ │ │  [Tool Call]                    │ │ │                              │ │
│ │ │  Morphing shape                 │ │ │                              │ │
│ │ │                                  │ │ │                              │ │
│ │ │  ...scrollable...               │ │ │                              │ │
│ │ │                                  │ │ │                              │ │
│ │ └──────────────────────────────────┘ │ │                              │ │
│ │                                      │ │                              │ │
│ │ ┌──────────────────────────────────┐ │ │                              │ │
│ │ │ INPUT AREA (1280x120px)          │ │ │                              │ │
│ │ │                                  │ │ │                              │ │
│ │ │ [🎤] [Text Input Area    ] [→]  │ │ │                              │ │
│ │ │ 16px   flex-1, 88px height  16px│ │ │                              │ │
│ │ │                                  │ │ │                              │ │
│ │ └──────────────────────────────────┘ │ │                              │ │
│ │                                      │ │                              │ │
│ └──────────────────────────────────────┘ └──────────────────────────────┘ │
│                                                                               │
├───────────────────────────────────────────────────────────────────────────────┤
│ ERROR BAR (1920x60px) [conditional, fixed bottom]                            │
│ [⚠] Error message here...                                          [×]      │
└───────────────────────────────────────────────────────────────────────────────┘
```

## Message Bubble Detailed Layout

### User Message (Right-aligned)
```
┌─────────────────────────────────────────────────────────────┐
│ Container: 600px max width, right-aligned                   │
│                                                              │
│                    ┌──────────────────────────────┐         │
│                    │ Message Bubble              │         │
│                    │ Width: 600px max            │         │
│                    │ Padding: 16px all sides     │         │
│                    │ Border-radius: 16px         │         │
│                    │                              │         │
│                    │ Background: rgba(74,158,255,0.15)    │
│                    │ Border: 1px rgba(74,158,255,0.3)     │
│                    │                              │         │
│                    │ ┌────────────────────────┐ │         │
│                    │ │ Message Header         │ │         │
│                    │ │ [Avatar 32x32] Timestamp│ │         │
│                    │ └────────────────────────┘ │         │
│                    │                              │         │
│                    │ ┌────────────────────────┐ │         │
│                    │ │ Message Content        │ │         │
│                    │ │ Line 1                │ │         │
│                    │ │ Line 2                │ │         │
│                    │ │ ...                   │ │         │
│                    │ └────────────────────────┘ │         │
│                    │                              │         │
│                    │ ┌────────────────────────┐ │         │
│                    │ │ Actions (on hover)     │ │         │
│                    │ │ [👍] [👎]             │ │         │
│                    │ └────────────────────────┘ │         │
│                    │                              │         │
│                    └──────────────────────────────┘         │
│                    24px from right edge                      │
└──────────────────────────────────────────────────────────────┘
```

### Assistant Message (Left-aligned)
```
┌─────────────────────────────────────────────────────────────┐
│ Container: 600px max width, left-aligned                    │
│                                                              │
│ ┌──────────────────────────────┐                            │
│ │ Message Bubble              │                            │
│ │ Width: 600px max            │                            │
│ │ Padding: 16px all sides    │                            │
│ │ Border-radius: 16px        │                            │
│ │                              │                            │
│ │ Background: rgba(0,255,136,0.1)                         │
│ │ Border: 1px rgba(0,255,136,0.3)                       │
│ │ Glow: box-shadow 0 0 20px rgba(0,255,136,0.2)         │
│ │                              │                            │
│ │ ┌────────────────────────┐ │                            │
│ │ │ Message Header         │ │                            │
│ │ │ [Avatar 32x32] Timestamp│ │                            │
│ │ └────────────────────────┘ │                            │
│ │                              │                            │
│ │ ┌────────────────────────┐ │                            │
│ │ │ Message Content        │ │                            │
│ │ │ Line 1                │ │                            │
│ │ │ Line 2                │ │                            │
│ │ │ ...                   │ │                            │
│ │ └────────────────────────┘ │                            │
│ │                              │                            │
│ │ ┌────────────────────────┐ │                            │
│ │ │ Code Block (optional)   │ │                            │
│ │ │ ┌────────────────────┐ │ │                            │
│ │ │ │ Header: lang [copy]│ │ │                            │
│ │ │ ├────────────────────┤ │ │                            │
│ │ │ │ Code content       │ │ │                            │
│ │ │ │ with syntax        │ │ │                            │
│ │ │ │ highlighting       │ │ │                            │
│ │ │ └────────────────────┘ │ │                            │
│ │ └────────────────────────┘ │                            │
│ │                              │                            │
│ │ ┌────────────────────────┐ │                            │
│ │ │ Tool Call (optional)   │ │                            │
│ │ │ ┌────────────────────┐ │ │                            │
│ │ │ │ [icon] Tool Name   │ │ │                            │
│ │ │ │ Status: Running    │ │ │                            │
│ │ │ ├────────────────────┤ │ │                            │
│ │ │ │ Input: {...}       │ │ │                            │
│ │ │ ├────────────────────┤ │ │                            │
│ │ │ │ Output: {...}      │ │ │                            │
│ │ │ └────────────────────┘ │ │                            │
│ │ └────────────────────────┘ │                            │
│ │                              │                            │
│ │ ┌────────────────────────┐ │                            │
│ │ │ Actions (on hover)     │ │                            │
│ │ │ [👍] [👎]             │ │                            │
│ │ └────────────────────────┘ │                            │
│ │                              │                            │
│ └──────────────────────────────┘                            │
│ 24px from left edge                                           │
└──────────────────────────────────────────────────────────────┘
```

## Input Area Detailed Layout

```
┌─────────────────────────────────────────────────────────────┐
│ INPUT AREA (1280x120px)                                      │
│ Fixed bottom of chat area                                   │
│ Background: rgba(0,0,0,0.4)                                 │
│ Border-top: 1px rgba(255,255,255,0.1)                       │
│ Padding: 16px all sides                                      │
│                                                              │
│ ┌──────┐ ┌──────────────────────────────────────┐ ┌──────┐  │
│ │ Voice│ │ Text Input                           │ │ Send│  │
│ │      │ │                                      │ │      │  │
│ │ 40x40│ │ Height: 88px (3 lines)              │ │64x40 │  │
│ │      │ │ Max-height: 200px (scrollable)      │ │      │  │
│ │      │ │ Padding: 12px                       │ │      │  │
│ │      │ │ Border-radius: 12px                 │ │      │  │
│ │      │ │ Background: rgba(255,255,255,0.05)    │ │      │  │
│ │      │ │ Border: 1px rgba(255,255,255,0.1)    │ │      │  │
│ │      │ │                                      │ │      │  │
│ │      │ │ Placeholder: "Ask Alfred..."         │ │      │  │
│ │      │ │                                      │ │      │  │
│ └──────┘ └──────────────────────────────────────┘ └──────┘  │
│ 16px     flex-1, min-width 0                              16px│
└──────────────────────────────────────────────────────────────┘
```

## Actions Panel Detailed Layout

```
┌─────────────────────────────────────────┐
│ ACTIONS PANEL (640x920px)                │
│ Fixed right side                         │
│ Background: rgba(0,0,0,0.3)              │
│ Border-left: 1px rgba(255,255,255,0.1)   │
│ Padding: 24px                             │
│                                          │
│ ┌─────────────────────────────────────┐ │
│ │ Header (48px height)                │ │
│ │                                      │ │
│ │ Active Actions          [badge: 3]  │ │
│ │                                      │ │
│ └─────────────────────────────────────┘ │
│                                          │
│ ┌─────────────────────────────────────┐ │
│ │ Action Item 1 (80px min height)      │ │
│ │ ┌────┐ ┌──────────────────┐ ┌────┐ │ │
│ │ │icon│ │ Tool Name        │ │time│ │ │
│ │ │32x │ │ Description      │ │    │ │ │
│ │ │32px│ │                  │ │    │ │ │
│ │ └────┘ └──────────────────┘ └────┘ │ │
│ │ 48px    flex-1              80px    │ │
│ └─────────────────────────────────────┘ │
│                                          │
│ ┌─────────────────────────────────────┐ │
│ │ Action Item 2                        │ │
│ └─────────────────────────────────────┘ │
│                                          │
│ ...scrollable...                         │
│                                          │
│                                          │
└──────────────────────────────────────────┘
```

## Mobile Layout (375x812px)

```
┌─────────────────────────────┐
│ HEADER (375x64px)            │
│ ┌─────────────────────────┐ │
│ │ [●] [agent ▼] [Clear]  │ │
│ │                         │ │
│ │ [Context] [Actions]     │ │
│ └─────────────────────────┘ │
├─────────────────────────────┤
│                             │
│ ┌─────────────────────────┐ │
│ │ CHAT AREA (375x600px)   │ │
│ │                         │ │
│ │ ┌─────────────────────┐ │ │
│ │ │ MESSAGE LIST        │ │ │
│ │ │ (375x480px)         │ │ │
│ │ │                     │ │ │
│ │ │ [User Message]      │ │ │
│ │ │ 320px max width     │ │ │
│ │ │                     │ │ │
│ │ │ [AI Message]        │ │ │
│ │ │ 320px max width     │ │ │
│ │ │                     │ │ │
│ │ │ ...scrollable...    │ │ │
│ │ └─────────────────────┘ │ │
│ │                         │ │
│ │ ┌─────────────────────┐ │ │
│ │ │ INPUT AREA         │ │ │
│ │ │ (375x100px)        │ │ │
│ │ │                     │ │ │
│ │ │ [🎤] [Input] [→]   │ │ │
│ │ │ 36px  flex-1  56px │ │ │
│ │ └─────────────────────┘ │ │
│ │                         │ │
│ └─────────────────────────┘ │
│                             │
├─────────────────────────────┤
│ ERROR BAR (375x60px)         │
│ [⚠] Error...         [×]    │
└─────────────────────────────┘
```

## Spacing Reference Grid (8px base)

```
┌─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┐
│ │ │ │ │ │ │ │ │ │ │ │ │ │ │ │ │ 8px units
├─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┤
│ │ │ │ │ │ │ │ │ │ │ │ │ │ │ │ │ │
├─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┤
│ │ │ │ │ │ │ │ │ │ │ │ │ │ │ │ │ │
└─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┘

xs: 4px  (0.5 unit) ──┐
sm: 8px  (1 unit)   ──┤
md: 16px (2 units)  ──┤
lg: 24px (3 units)  ──┤
xl: 32px (4 units)  ──┤
2xl: 48px (6 units) ──┤
3xl: 64px (8 units) ──┘
```

## Component Positioning Reference

### Header Elements (80px height)
- **Connection Status**: x=24, y=20, 40x40px
- **Agent Selector**: x=80, y=20, 120x40px
- **Clear Button**: x=216, y=20, 80x40px
- **Context Lens**: x=1096 (right-aligned), y=20, 200x40px
- **Actions Counter**: x=1312 (right-aligned), y=20, 120x40px

### Message List (800px height, 24px padding)
- **User messages**: Right edge - 24px, max-width 600px
- **AI messages**: Left edge + 24px, max-width 600px
- **Message spacing**: 16px bottom margin
- **First message**: 24px top padding
- **Last message**: 24px bottom padding

### Input Area (120px height)
- **Voice button**: x=16, y=16, 40x40px
- **Text input**: x=72, y=16, width=calc(100% - 160px), height=88px
- **Send button**: x=calc(100% - 80px), y=40, 64x40px

### Actions Panel (640px width, 920px height)
- **Header**: x=24, y=24, width=592px, height=48px
- **Action items**: x=24, spacing=12px vertical
- **Item padding**: 16px all sides
- **Item min-height**: 80px

## Breakpoint Calculations

### Desktop (≥1280px)
- Chat area: `calc(100vw - 640px)` when actions panel visible
- Chat area: `calc(100vw - 48px)` when actions panel hidden
- Max chat width: 1280px

### Tablet (768px - 1279px)
- Chat area: `calc(100vw - 48px)`
- Actions panel: Hidden (modal/drawer)

### Mobile (≤767px)
- Chat area: `calc(100vw - 32px)` (16px padding each side)
- Header height: 64px (reduced)
- Input height: 100px (reduced)

## Exact Pixel Measurements Summary

### Containers
- Viewport: 1920x1080px
- Header: 1920x80px
- Chat area: 1280x920px
- Message list: 1280x800px
- Input area: 1280x120px
- Actions panel: 640x920px
- Error bar: 1920x60px

### Components
- Connection indicator: 40x40px
- Agent selector: 120x40px
- Clear button: 80x40px
- Context lens: 200x40px
- Actions counter: 120x40px
- Message bubble (max): 600px width
- Voice button: 40x40px
- Text input: flex-1, 88px height
- Send button: 64x40px
- Action item: flex width, 80px min-height

### Spacing
- Container padding: 24px
- Message padding: 16px
- Message margin: 16px bottom
- Input padding: 16px
- Button spacing: 8px between elements
