I will implement the frontend UI toggle and the API persistence for the isActive flag, but I need the exact contents of two files to produce precise edits:

Please add the following files (full paths) to the chat:

1) frontend/src/components/manager/PaymentStepItem.tsx
   - This is the component that renders each draggable payment/message step row.
   - I will add a Switch/Toggle immediately to the left of the existing "duplicate" and "delete" icons and dim the row when isActive is false.
   - I will also ensure toggling updates the form state and that the save action includes isActive in the payload.

2) server/src/routes/api/bots.ts
   - This is the backend route/controller that handles updating a Bot (PUT/POST) and persists bot.paymentFlow.
   - I will update the update handler so it accepts and persists the isActive boolean inside the paymentFlow JSON stored in Bot.paymentFlow.

Notes:
- I implemented skipping inactive steps in server/src/bot/handlers.ts (already provided in separate edits above) by importing and using filterActiveSteps from paymentFlow.ts.
- We are keeping storage as JSON inside Bot.paymentFlow (no DB schema changes required).
- After you add the two files above, I will provide exact SEARCH/REPLACE edits to:
  - add the Switch UI and dimming in PaymentStepItem.tsx,
  - update the API route to accept/persist isActive in the paymentFlow JSON,
  - and wire the frontend save handler to include each step's isActive flag.

Reply after adding the two files and I will produce the remaining SEARCH/REPLACE blocks.
