# Overriding shadcn/ui Component Styles

## Root Cause

shadcn/ui components bake semantic color classes (`bg-card`, `bg-background`, `text-card-foreground`, etc.) directly into their base `className`. When you pass a `className` prop, it gets merged via `cn()` which uses `twMerge` (tailwind-merge).

**`twMerge` resolves conflicts by CSS property, not by class name.** This means:

```tsx
// ❌ NO-OP — same CSS property, same value
<Card className="bg-card" />
// Card already has: cn("... bg-card ...", "bg-card")
// twMerge sees: bg-card vs bg-card → keeps one, same color

// ❌ NO-OP — same CSS property, same value (different class)
<Card className="bg-muted" />
// twMerge sees: bg-card vs bg-muted → KEEPS bg-muted (last wins) ✓
// BUT: the Card component might pass className BEFORE built-in classes, or AFTER
// Depends on cn() argument order
```

### The `cn()` argument order matters

```tsx
function Card({ className, ...props }) {
  return <div className={cn("bg-card text-card-foreground", className)} />
  //                             ^ built-ins first          ^ user's classes last
  // twMerge: user's bg-muted WINS over built-in bg-card ✓
}
```

When the user's `className` comes **last** in `cn()`, conflicting classes from the user win. This is the standard pattern in shadcn/ui.

The bug occurs when you pass the **same semantics** as the built-in:

| Built-in | You pass | Result | Why |
|----------|----------|--------|-----|
| `bg-card` | `bg-card` | No change | Same value, no conflict |
| `bg-card` | `bg-background` | Changes ✓ | Different property value |
| `bg-card` | `bg-muted dark:bg-black` | Changes ✓ | Different value, mode-aware |
| `text-card-foreground` | `text-foreground` | Changes ✓ | Different value |

---

## Color Token Reference

### Background / Surface Colors

| Class | Light mode | Dark mode |
|-------|-----------|-----------|
| `bg-background` | `hsl(0, 0%, 100%)` white | `hsl(0, 0%, 7%)` near-black |
| `bg-card` | `hsl(0, 0%, 100%)` white | `hsl(225, 10%, 12%)` dark navy |
| `bg-muted` | `hsl(240, 4.8%, 95.9%)` light gray | `hsl(228, 15%, 14%)` dark gray |
| `bg-secondary` | `hsl(240, 4.8%, 95.9%)` light gray | `hsl(228, 15%, 16%)` dark gray |
| `bg-accent` | `hsl(240, 4.8%, 95.9%)` light gray | `hsl(235, 25%, 18%)` dark blue-gray |
| `bg-popover` | `hsl(0, 0%, 100%)` white | `hsl(225, 12%, 14%)` dark navy |

### Foreground / Text Colors

| Class | Light mode | Dark mode |
|-------|-----------|-----------|
| `text-foreground` | `hsl(240, 10%, 3.9%)` near-black | `hsl(0, 0%, 98%)` white |
| `text-card-foreground` | `hsl(240, 10%, 3.9%)` near-black | `hsl(0, 0%, 98%)` white |
| `text-muted-foreground` | `hsl(240, 3.8%, 46.1%)` medium gray | `hsl(228, 8%, 65%)` light gray |
| `text-primary` | `hsl(235, 70%, 60%)` blue-purple | `hsl(235, 70%, 60%)` blue-purple |
| `text-primary-foreground` | `hsl(0, 0%, 100%)` white | `hsl(0, 0%, 100%)` white |

> Full values defined in `frontend/src/index.css` under `:root` (light) and `.dark` (dark).

---

## Real Example: MessageStepCard

### Before (broken)

```tsx
<Card className="bg-card">  // ← same as Card's built-in, no change
```

The Card component already renders: `<div className="... bg-card ...">`
Adding `bg-card` again via `className` is a no-op — the color never changes.

### After (fixed)

```tsx
<Card className="bg-muted dark:bg-black">
```

- **Light mode**: `bg-muted` → light gray, distinct from the white `bg-card` page
- **Dark mode**: `bg-black` → pure black, distinct from the navy `bg-card` background

The key: we passed a **different** semantic token that resolves to the colors we actually wanted.

---

## Checklist: Before Passing `className` to a shadcn/ui Component

1. **Read the component source** — check what classes are baked into its base `className`
2. **Check `cn()` argument order** — does the user's `className` come last? (It should)
3. **Don't repeat built-in classes** — `bg-card` on a Card is a no-op
4. **Use a different semantic token** — `bg-muted`, `bg-background`, `bg-black`, etc.
5. **Consider both themes** — test `dark:` prefix for dark-mode-specific overrides
