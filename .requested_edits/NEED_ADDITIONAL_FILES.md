I updated types and server-side normalization to carry an isActive flag for payment message steps and added a helper to filter active steps.

To complete the full-stack feature you requested (UI toggle, API persistence, and bot execution filtering) I need the following files added to the chat so I can produce exact edits:

- frontend/src/pages/manager/[botId]/payment-settings/gateways/livepix.tsx
  (the page or component that renders the LivePix payment gateway settings for a bot; I need to add the toggle in the UI near the "duplicate step" button and wire change handlers)

- frontend/src/components/manager/PaymentStepItem.tsx
  (or wherever each payment step is rendered; add the Toggle/Switch component next to the duplicate button and propagate isActive into the form state)

- server/src/routes/api/bots.ts
  (or the backend route/controller that handles creating/updating a bot or its paymentFlow; I need to accept and persist the isActive field.)

- server/src/bot/<executor-or-manager-file>.ts
  (the bot execution logic that loads and sends message steps to users when they trigger a payment flow; I need to add filtering to skip steps where isActive === false)

If your project uses different paths for any of the above, add those files instead and tell me which file corresponds to each responsibility.

Once you add those files I'll provide precise SEARCH/REPLACE edits to:
1) Add the UI toggle and wire it to local/form state and the save request.
2) Ensure api.ts sends the isActive field (types were already updated).
3) Persist isActive in the backend route.
4) Ensure the bot execution logic filters out inactive steps.
