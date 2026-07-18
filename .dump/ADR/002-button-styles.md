# ADR-002: Button Color Styles for InlineKeyboardButton

## Status
Active

## Context
Telegram Bot API 9.4+ introduced a `style` field on `InlineKeyboardButton`
with three predefined values: `"primary"` (blue), `"success"` (green), and
`"danger"` (red). The project needed to differentiate subscription tiers
visually — vitalício buttons in green, mensal/amostra buttons in blue.

## Decision
- Add a `style` property to each plan object in `config/plans.js`.
- In `index.js`, pass `style` directly as a field in the inline keyboard
button object literal instead of using `Markup.button.callback()`, because
Telegraf v4.16.3's `callback(text, data, hide)` treats the 3rd parameter as
the `hide` boolean, not an options bag.

## Implementation notes
- Valid values are `"primary"`, `"success"`, `"danger"` (not `bg_*` prefixed).
- Raw button objects `{ text, callback_data, style }` work with
  `Markup.inlineKeyboard()` since it only filters out `hide: true` entries.
- The `style` is set on each plan variant (HOTFLIX and DUDA), propagating
  through `config/index.js` to the button builders.

## Key files
- `config/plans.js` — `style` property added to all 6 plan objects
- `index.js:97-103` — initial plan selection buttons
- `index.js:149-155` — remarketing video buttons
