Deployment preflight: Unpaid Voice Audio Reply Feature

1) TypeScript/Build Errors
- server/src/bot/paymentFlow.ts: PaymentFlow includes unpaidAudioFileIds: string[]. normalizePaymentFlow and defaultPaymentFlow both set it (array of strings), so JSON shape is consistent.
- server/src/bot/manager.ts: Imports normalizePaymentFlow and PaymentFlow correctly. Callback_query handler:
  - Calls ctx.answerCbQuery() immediately inside a try/catch.
  - LivePix check wrapped in try/catch.
  - Telegram sendMessage/sendVoice wrapped in try/catch.
  - Uses this.paymentFlow.unpaidAudioFileIds with proper existence checks. No unused variables detected.
- server/src/routes/api.ts: Uses normalizePaymentFlow consistently when reading/writing paymentFlow; no type mismatches with frontend PaymentFlow.
- frontend/src/lib/api.ts: PaymentFlow interface includes unpaidAudioFileIds. API methods getBot and updatePaymentFlow are defined and used by the page.
- frontend/src/pages/BotPaymentAudioPage.tsx: Uses api.getBot and api.updatePaymentFlow (typed). All React hooks and UI imports are present and used; no unused variables detected. Saves unpaidAudioFileIds inside PaymentFlow JSON as required.

Conclusion: No TypeScript type mismatches or missing imports found that would fail a strict build based on the provided files.

2) Hardcoded URLs
- All network calls on the new page use the shared api module (relative paths to /api). No hardcoded localhost or absolute URLs introduced.

3) Missing Dependencies
- No new libraries were introduced by the added/modified code. Existing imports (e.g., QRCode) were already present. package.json does not need changes.

Result: Clear to build.
