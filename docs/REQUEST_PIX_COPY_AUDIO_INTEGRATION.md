To implement sending audio on Telegram when the user clicks "Copiar chave Pix", please add the following existing files (with their exact full paths from your repository) to this chat so I can modify them:

Frontend:
- The component/page that renders the "Copiar chave Pix" button and handles its onClick (often near navigator.clipboard.writeText). This is the place where we will call an API to notify the backend that Pix was copied.
- The component/page that implements the "Verificar pagamento" action, including any existing API call it makes. I will mirror that request for the Pix flow.

Backend:
- The HTTP route/handler that processes the "Verificar pagamento" click (e.g., POST /api/bots/:id/payment/verify or similar). I will add a sibling handler for the Pix-copied event.
- The controller/service that sends the Telegram audio for "Verificar pagamento" (the function that calls sendVoice/sendAudio). I will reuse this for Pix, gated by isCopyPixAudioEnabled and using copyPixAudios.
- The Telegram bot API client/utility used to send messages/audio (so we can call the same function consistently).

Notes:
- I will follow the existing verify-payment logic:
  - If isCopyPixAudioEnabled is true and copyPixAudios has items, select an audio (same selection method as verify) and send it to the user's chat.
  - If disabled or empty, no audio will be sent.
- If there is any middleware/auth or context extractor (e.g., to resolve botId, userId/session/chatId) used in the verify flow, please add that file as well so I can hook into it for the Pix flow.

If you are unsure which files to add, please search your project for:
- "Copiar chave Pix", "Copiar Pix", or navigator.clipboard.writeText for the frontend button component.
- "Verificar pagamento" or the verify-payment API path for the frontend and backend references.
- "sendVoice", "sendAudio", or your Telegram send helper for the backend service.

Once you add these files here, I will implement the end-to-end bridge.
