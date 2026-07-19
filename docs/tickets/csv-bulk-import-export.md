# CSV Bulk Import/Export — Button Presets, Message Flow & Remarketing

**Status:** Backlog  
**Package:** `@botflix/frontend`  
**Estimated effort:** 3–4 days

---

## Goal

Replace the current rudimentary pipe-based bulk import in remarketing with a professional CSV-based
import/export system, and extend it to cover button presets and message flows — enabling users to
manage bot configurations in bulk via familiar spreadsheet tools (Excel, Google Sheets) without
manually clicking through the UI for every button and message.

---

## Background

**Current state:**
- The **only** bulk operation in the entire app is a plain `<textarea>` in
  `RemarketingEditor.tsx:198-231` that accepts `URL | Caption` lines split by the pipe character.
  There is no validation, no CSV parsing, and no export functionality anywhere.
- **No button preset system exists** — buttons are created ad-hoc inside message flow steps via
  `InlineButtonEditor.tsx` with no way to save, reuse, or bulk-manage them.
- **Message flow** (`messageFlow` JSON on the `Bot` model) is edited exclusively via the drag-and-drop
  GUI (`MessageFlowEditor.tsx` + `MessageStepCard.tsx`). No import/export exists.
- **No CSV library** is in the project's dependencies.

**Packages affected:** `@botflix/frontend` (primary)

**Data shapes** relevant to CSV:

```typescript
// server/src/bot/messageFlow.ts, frontend/src/lib/api.ts
type MessageStep = {
  id: string
  title: string
  type: "TEXT" | "AUDIO" | "VIDEO"
  text?: string
  mediaUrls: string[]
  delayMs: number
  buttons: MessageButton[]
}

type MessageButton = {
  id: string
  label: string
  color: "BLUE" | "GREEN" | "RED"
  action: "OPEN_URL" | "LIVEPIX_PAYMENT"
  url?: string
}
```

---

## Scope

### In scope

1. Add a lightweight CSV library (recommended: `papaparse` for parsing; CSV generation can be done
   without a library or with the same tool).
2. **Button presets management** (new feature):
   - "Button Presets" section/page for naming and saving button templates (label, action, color, url).
   - CSV export of presets.
   - CSV import to create/update presets in bulk.
   - When editing message flow buttons, allow selecting from saved presets.
3. **Message flow CSV import/export**:
   - Export the entire `messageFlow` array as a CSV file (browser download).
   - Import a CSV file to replace/append message flow steps with a preview/validation step before
     applying.
   - Handle array fields (`buttons[]`, `mediaUrls[]`) with a sensible strategy (see CSV schema below).
4. **Replace remarketing pipe bulk with CSV**:
   - Keep the existing textarea as a fallback, but add CSV file import/export as the primary method.
   - Export remarketing messages as CSV.
5. **Shared UI patterns**:
   - Reusable `CsvImportButton` and `CsvExportButton` components.
   - Parse error handling surfaced via toast/snackbar notifications (existing `sonner`).
6. **Handoff documentation**: CSV column schemas documented in-code (TSDoc) and in
   `docs/tickets/csv-bulk-import-export.md` (this file).

### Out of scope

- Server-side CSV generation or parsing (fully client-side).
- Database schema changes (button presets live in `localStorage`).
- Changing the server-side `normalizeMessageFlow` validation (`server/src/bot/messageFlow.ts`).
- Backward compatibility with the old pipe format (it can coexist or be deprecated — implementer's
  call).

---

## Deliverables

### 1. Dependency

Install `papaparse` + its type definitions:

```bash
corepack pnpm --filter @botflix/frontend add papaparse
corepack pnpm --filter @botflix/frontend add -D @types/papaparse
```

### 2. Shared CSV utilities

**`frontend/src/lib/csv.ts`** — Reusable helpers:

- `generateCsv(headers: string[], rows: string[][]): string` — builds a CSV string.
- `parseCsvFile(file: File): Promise<Papa.ParseResult<string[]>>` — parses an uploaded file.
- `downloadCsv(filename: string, content: string): void` — triggers a browser download.
- Column header constants for each schema (e.g. `BUTTON_PRESET_HEADERS`, `MESSAGE_FLOW_HEADERS`).

### 3. Button Presets

#### 3a. Preset type & storage

**`frontend/src/hooks/useButtonPresets.ts`** — CRUD hook backed by `localStorage` key
`"botflix_button_presets"`:

```typescript
type ButtonPreset = {
  id: string          // crypto.randomUUID()
  name: string        // user-given label for the preset (e.g. "PIX azul")
  label: string
  action: "OPEN_URL" | "LIVEPIX_PAYMENT"
  color: "BLUE" | "GREEN" | "RED"
  url?: string
}
```

#### 3b. Preset manager UI

**`frontend/src/components/forms/ButtonPresetsManager.tsx`**:

- Table listing all saved presets with inline edit/delete actions.
- "Import CSV" button → file picker → parse → show preview → confirm.
- "Export CSV" button → downloads current presets as `button_presets.csv`.
- "New preset" form row at the top.

#### 3c. Integration into message flow editing

**Modify `frontend/src/components/forms/InlineButtonEditor.tsx`**:

- Add a "From preset" dropdown/combobox that lists saved presets.
- Selecting a preset fills the label, action, color, and url fields.

### 4. Message Flow CSV import/export

**`frontend/src/components/forms/MessageFlowCsv.tsx`** (or integrate directly into
`MessageFlowEditor.tsx`):

- **Export** button → builds CSV rows from `messageFlow` steps → downloads
  `message_flow_<botName>.csv`.
- **Import** button → file picker → parse CSV → validation → diff/preview table (step title, type,
  text snippet, button count) → "Replace all" / "Append" / "Cancel".
- Validation: missing required fields (`step_id`, `title`, `type`) flagged in preview with red
  highlighting; invalid `type` or `color`/`action` values shown as warnings.
- Use `useUndo` hook entry so import can be undone with Ctrl+Z.

### 5. Remarketing CSV import/export

**Modify `frontend/src/components/forms/RemarketingEditor.tsx`**:

- Add "Import CSV" and "Export CSV" buttons alongside the existing textarea.
- Reuse the same `MessageFlowCsv` component/logic (remarketing messages are the same `MessageStep[]`
  type).
- Export filename: `remarketing_flow_<botName>.csv`.

### 6. Update existing components

| File | Changes |
|------|---------|
| `frontend/src/components/forms/BotForm.tsx` | Wire up presets manager (accessible from a "Presets" button near the message flow section). |
| `frontend/src/components/forms/MessageFlowEditor.tsx` | Add Import/Export CSV buttons in the toolbar area. |
| `frontend/src/components/forms/RemarketingEditor.tsx` | Add CSV import/export; keep old textarea available. |
| `frontend/src/components/forms/InlineButtonEditor.tsx` | Add "From preset" selector. |

---

## CSV Column Schemas

Row index `i` is zero-based within the section of rows that share the same `step_id`.

### Button Presets CSV

| Column | Type | Required | Description |
|--------|------|----------|-------------|
| `name` | String | Yes | Human-readable preset name |
| `label` | String | Yes | Button text shown to users |
| `action` | `OPEN_URL` / `LIVEPIX_PAYMENT` | Yes | Button behavior |
| `url` | String | Only if `action` = `OPEN_URL` | Destination URL |
| `color` | `BLUE` / `GREEN` / `RED` | Yes | Button color |

### Message Flow + Remarketing CSV

Multiple buttons per step use separate rows with the same parent columns repeated. The first row for
a `step_id` is the "step row"; subsequent rows for the same `step_id` are "button rows" where only
the button columns are meaningful (parent columns are ignored or should match the first row).

| Column | Type | Required | Description |
|--------|------|----------|-------------|
| `step_id` | String | Yes | Unique identifier within the flow (e.g. `step_1`, `welcome`) |
| `title` | String | Yes | Admin-facing label for the step |
| `type` | `TEXT` / `AUDIO` / `VIDEO` | Yes | Message type |
| `text` | String | Yes (for TEXT) | Message caption/text |
| `media_urls` | String | Yes (for AUDIO/VIDEO) | Comma-separated Telegram `file_id` or URLs |
| `delay_ms` | Number | Yes | Delay before sending in milliseconds |
| `button_label` | String | No | Button text (blank on step rows with no buttons) |
| `button_action` | `OPEN_URL` / `LIVEPIX_PAYMENT` | Only if `button_label` present | Button behavior |
| `button_url` | String | Only if `button_action` = `OPEN_URL` | Destination URL |
| `button_color` | `BLUE` / `GREEN` / `RED` | Only if `button_label` present | Button color |

**Example CSV:**

```csv
step_id,title,type,text,media_urls,delay_ms,button_label,button_action,button_url,button_color
welcome,Welcome,TEXT,"Olá! Bem-vindo ao bot.",,1000,Pagar agora,LIVEPIX_PAYMENT,,GREEN
welcome,,,,,,Abrir link,OPEN_URL,https://example.com,BLUE
video,Video Promo,VIDEO,"Assista este vídeo!","BAACAgE...1,BAACAgE...2",5000,Saber mais,OPEN_URL,https://site.com,BLUE
text-only,Info,TEXT,"Obrigado por participar!",,0,,,,
```

**Parsing rules:**
- Rows with the same `step_id` are grouped; the first row defines the step, extra rows add buttons
  (max 3 total per step).
- `media_urls` is split by comma and trimmed (empty string → `[]`).
- `delay_ms` defaults to `0` if missing or unparseable.
- Invalid enum values for `type`, `button_action`, `button_color` cause the row to be flagged as
  invalid in the preview (not silently dropped).
- Rows entirely blank or only whitespace are skipped.

---

## Acceptance Criteria

1. `pnpm typecheck` passes with zero errors in `@botflix/frontend`.
2. User can create, edit, delete, import, and export button presets from the bot form.
3. User can select a saved preset when editing a button in `InlineButtonEditor`.
4. User can export a bot's message flow and re-import it (round-trip: export → import → export again
   produces identical CSV).
5. User can export remarketing messages and re-import them.
6. Importing a malformed CSV shows a preview with highlighted errors and does not mutate state until
   confirmed.
7. Import can be undone via the existing Ctrl+Z undo stack.
8. The old pipe-based remarketing textarea still works (not broken).
9. CSV downloads open the browser's save dialog with sensible filenames.

---

## Reference Files

| File | Relevance |
|------|-----------|
| `frontend/src/components/forms/RemarketingEditor.tsx` | Existing pipe-based bulk import to be augmented |
| `frontend/src/components/forms/MessageFlowEditor.tsx` | Flow editor — add import/export buttons |
| `frontend/src/components/forms/MessageStepCard.tsx` | Step card — no changes expected |
| `frontend/src/components/forms/InlineButtonEditor.tsx` | Add "From preset" selector |
| `frontend/src/components/forms/BotForm.tsx` | Wire up presets manager |
| `frontend/src/lib/api.ts` | Type definitions for `MessageStep`, `MessageButton` |
| `frontend/src/lib/helpers.ts` | `newStep()`, `newButton()` — no changes expected |
| `frontend/src/hooks/useUndo.ts` | Undo stack — import should push an entry |
| `frontend/package.json` | Dependency manifest — add `papaparse` |

---

## Implementation Notes

- **No server changes required.** CSV generation and parsing happen entirely on the client. The
  resulting `MessageStep[]` is sent through the existing `PUT /api/bots/:id` endpoint.
- **`papaparse`** is the recommended CSV library — it's battle-tested, handles edge cases (quoted
  fields, newlines within cells, BOM), and the project already depends on other small utilities.
- **localStorage for presets** is intentional — no DB migration, no API endpoint, no auth concerns.
  A future iteration could persist them server-side if needed.
- **File input** for CSV import should use `<input type="file" accept=".csv" />` hidden behind a
  styled button (consistent with the existing UI patterns).
- **The preview/diff table** is the most complex UI piece. Use a simple HTML table within a modal or
  dialog (reuse existing modal patterns in the codebase, or use `@base-ui/react` Dialog).
