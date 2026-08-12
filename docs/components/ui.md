# @ui/* Components

Pre-built UI primitives based on Radix UI and styled with Tailwind. Use these in JSON pages or custom components for consistent, accessible interfaces.

## Components

| Component | Purpose |
|-----------|---------|
| Button | Clickable actions with variants and sizes |
| Card | Content containers with header/footer |
| Input | Text input fields |
| Textarea | Multi-line text input |
| Select | Dropdown selections |
| Checkbox | Toggle options |
| Switch | On/off toggle |
| Label | Form field labels |
| Alert | Contextual messages |
| Badge | Small status indicators |
| Dialog | Modal overlays |
| Sheet | Slide-out panels |
| Popover | Floating content |
| Progress | Progress indicators |

---

## Button

Clickable actions with different styles and sizes.

```json
{
  "component": "@ui/Button",
  "attributes": {
    "variant": "default",
    "size": "md"
  },
  "innerHTML": "Click Me"
}
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| variant | string | "default" | Style: `default`, `destructive`, `outline`, `secondary`, `ghost`, `link` |
| size | string | "default" | Size: `default`, `sm`, `lg`, `icon` |
| asChild | boolean | false | Render as child element (uses Radix Slot) |
| disabled | boolean | false | Disable interaction |
| className | string | - | Additional CSS classes |

### Usage in JSX

```jsx
import { Button } from '@ui/button';

<Button variant="outline" size="lg" onClick={handleClick}>
  Submit
</Button>
```

---

## Card

Container for grouping related content with optional header and footer.

```json
{
  "component": "@ui/Card",
  "components": [
    {
      "component": "@ui/CardHeader",
      "components": [
        {
          "component": "@ui/CardTitle",
          "innerHTML": "Featured Product"
        },
        {
          "component": "@ui/CardDescription",
          "innerHTML": "Best seller this month"
        }
      ]
    },
    {
      "component": "@ui/CardContent",
      "innerHTML": "Product details here..."
    },
    {
      "component": "@ui/CardFooter",
      "innerHTML": "Footer content"
    }
  ]
}
```

### Sub-components

| Component | Purpose |
|-----------|---------|
| Card | Main container |
| CardHeader | Top section for titles |
| CardTitle | Bold heading |
| CardDescription | Secondary text |
| CardContent | Main content area |
| CardFooter | Bottom section for actions |

### Props

All card components accept `className` for custom styling.

---

## Input

Single-line text input field.

```json
{
  "component": "@ui/Input",
  "attributes": {
    "type": "email",
    "placeholder": "Enter your email"
  }
}
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| type | string | "text" | Input type: `text`, `email`, `password`, `number`, etc. |
| placeholder | string | - | Placeholder text |
| disabled | boolean | false | Disable input |
| className | string | - | Additional CSS classes |

---

## Textarea

Multi-line text input.

```json
{
  "component": "@ui/Textarea",
  "attributes": {
    "placeholder": "Enter description...",
    "rows": 4
  }
}
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| placeholder | string | - | Placeholder text |
| rows | number | 3 | Number of visible rows |
| disabled | boolean | false | Disable textarea |
| className | string | - | Additional CSS classes |

---

## Select

Dropdown selection with accessible keyboard navigation.

```json
{
  "component": "@ui/Select",
  "components": [
    {
      "component": "@ui/SelectTrigger",
      "components": [
        {
          "component": "@ui/SelectValue",
          "attributes": {
            "placeholder": "Select option"
          }
        }
      ]
    },
    {
      "component": "@ui/SelectContent",
      "components": [
        {
          "component": "@ui/SelectItem",
          "attributes": { "value": "option1" },
          "innerHTML": "Option 1"
        },
        {
          "component": "@ui/SelectItem",
          "attributes": { "value": "option2" },
          "innerHTML": "Option 2"
        }
      ]
    }
  ]
}
```

### Sub-components

| Component | Purpose |
|-----------|---------|
| Select | Root container |
| SelectTrigger | Clickable button |
| SelectValue | Shows selected value |
| SelectContent | Dropdown panel |
| SelectItem | Individual option |
| SelectGroup | Group related options |
| SelectLabel | Group label |
| SelectSeparator | Visual divider |

### Usage in JSX

```jsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ui/select';

<Select onValueChange={(value) => console.log(value)}>
  <SelectTrigger>
    <SelectValue placeholder="Choose..." />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="a">Option A</SelectItem>
    <SelectItem value="b">Option B</SelectItem>
  </SelectContent>
</Select>
```

---

## Checkbox

Toggle for binary choices.

```json
{
  "component": "@ui/Checkbox",
  "attributes": {
    "id": "terms",
    "checked": false
  }
}
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| checked | boolean | false | Checked state |
| disabled | boolean | false | Disable interaction |
| className | string | - | Additional CSS classes |

---

## Switch

Toggle switch for on/off states.

```json
{
  "component": "@ui/Switch",
  "attributes": {
    "checked": true
  }
}
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| checked | boolean | false | Switch state |
| disabled | boolean | false | Disable interaction |
| className | string | - | Additional CSS classes |

---

## Label

Accessible label for form fields.

```json
{
  "component": "@ui/Label",
  "attributes": {
    "htmlFor": "email"
  },
  "innerHTML": "Email Address"
}
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| htmlFor | string | - | ID of associated input |
| className | string | - | Additional CSS classes |

---

## Alert

Contextual messages with optional title and description.

```json
{
  "component": "@ui/Alert",
  "attributes": {
    "variant": "default"
  },
  "components": [
    {
      "component": "@ui/AlertTitle",
      "innerHTML": "Heads up!"
    },
    {
      "component": "@ui/AlertDescription",
      "innerHTML": "You can add components to your app."
    }
  ]
}
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| variant | string | "default" | Style: `default`, `destructive` |
| className | string | - | Additional CSS classes |

### Sub-components

- **AlertTitle** - Bold heading
- **AlertDescription** - Message text

---

## Badge

Small labels for status, counts, or categories.

```json
{
  "component": "@ui/Badge",
  "attributes": {
    "variant": "default"
  },
  "innerHTML": "New"
}
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| variant | string | "default" | Style: `default`, `secondary`, `destructive`, `outline` |
| className | string | - | Additional CSS classes |

---

## Dialog

Modal overlay for focused interactions.

```json
{
  "component": "@ui/Dialog",
  "components": [
    {
      "component": "@ui/DialogTrigger",
      "components": [
        {
          "component": "@ui/Button",
          "innerHTML": "Open Dialog"
        }
      ]
    },
    {
      "component": "@ui/DialogContent",
      "components": [
        {
          "component": "@ui/DialogHeader",
          "components": [
            {
              "component": "@ui/DialogTitle",
              "innerHTML": "Confirm Action"
            },
            {
              "component": "@ui/DialogDescription",
              "innerHTML": "Are you sure you want to continue?"
            }
          ]
        },
        {
          "component": "@ui/DialogFooter",
          "components": [
            {
              "component": "@ui/Button",
              "attributes": { "variant": "outline" },
              "innerHTML": "Cancel"
            },
            {
              "component": "@ui/Button",
              "innerHTML": "Confirm"
            }
          ]
        }
      ]
    }
  ]
}
```

### Sub-components

| Component | Purpose |
|-----------|---------|
| Dialog | Root container |
| DialogTrigger | Opens the dialog |
| DialogContent | Modal content |
| DialogHeader | Top section |
| DialogTitle | Heading |
| DialogDescription | Explanatory text |
| DialogFooter | Bottom section for actions |
| DialogClose | Closes the dialog |

---

## Sheet

Slide-out panel from any screen edge.

```json
{
  "component": "@ui/Sheet",
  "components": [
    {
      "component": "@ui/SheetTrigger",
      "components": [
        {
          "component": "@ui/Button",
          "innerHTML": "Open Menu"
        }
      ]
    },
    {
      "component": "@ui/SheetContent",
      "attributes": {
        "side": "right"
      },
      "components": [
        {
          "component": "@ui/SheetHeader",
          "components": [
            {
              "component": "@ui/SheetTitle",
              "innerHTML": "Menu"
            },
            {
              "component": "@ui/SheetDescription",
              "innerHTML": "Navigate your app"
            }
          ]
        },
        {
          "component": "div",
          "innerHTML": "Menu items here..."
        }
      ]
    }
  ]
}
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| side | string | "right" | Position: `top`, `bottom`, `left`, `right` |
| className | string | - | Additional CSS classes |

### Sub-components

- **Sheet** - Root container
- **SheetTrigger** - Opens the sheet
- **SheetContent** - Panel content
- **SheetHeader** - Top section
- **SheetTitle** - Heading
- **SheetDescription** - Explanatory text
- **SheetFooter** - Bottom section

---

## Popover

Floating content anchored to an element.

```json
{
  "component": "@ui/Popover",
  "components": [
    {
      "component": "@ui/PopoverTrigger",
      "components": [
        {
          "component": "@ui/Button",
          "attributes": { "variant": "outline" },
          "innerHTML": "Open Popover"
        }
      ]
    },
    {
      "component": "@ui/PopoverContent",
      "innerHTML": "Popover content here..."
    }
  ]
}
```

### Sub-components

- **Popover** - Root container
- **PopoverTrigger** - Opens the popover
- **PopoverContent** - Floating content

---

## Progress

Visual progress indicator.

```json
{
  "component": "@ui/Progress",
  "attributes": {
    "value": 65
  }
}
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| value | number | 0 | Progress percentage (0-100) |
| className | string | - | Additional CSS classes |

---

## Using in Custom Components

All @ui components can be imported in JSX:

```jsx
import { Button } from '@ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@ui/card';
import { Input } from '@ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@ui/select';

const MyForm = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign Up</CardTitle>
      </CardHeader>
      <CardContent>
        <Input type="email" placeholder="Email" />
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Country" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="us">United States</SelectItem>
            <SelectItem value="uk">United Kingdom</SelectItem>
          </SelectContent>
        </Select>
        <Button>Submit</Button>
      </CardContent>
    </Card>
  );
};
```

> 💡 **Tip:** These components are built on Radix UI primitives, so they're fully accessible with keyboard navigation and ARIA attributes.

> 📖 **See also:** [components/index.md](./index.md) for component resolution and building custom components.
