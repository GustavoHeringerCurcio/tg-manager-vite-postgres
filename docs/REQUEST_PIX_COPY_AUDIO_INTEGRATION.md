To bridge the "Copiar Chave Pix" click to sending audio on Telegram, please add these actual files (with correct full paths from your repo) so I can implement precise changes:

Frontend (please add paths to the real files in your repo):
- The component/page that renders the "Copiar chave Pix" button and handles its onClick (the place currently calling navigator.clipboard.writeText or similar).
- The component/page that renders the "Verificar pagamento" action and triggers the backend (I will mirror its logic for Pix).

Backend (please add paths to the real files in your repo):
- The HTTP route/handler that processes the "Verificar pagamento" click (so I can replicate for Pix).
- The controller/service that sends the unpaid/verify audio on Telegram (e.g., a helper that calls Telegram API sendVoice or equivalent).
- If separate, the Telegram bot API utility/client used to send messages/audios.

After you add those specific files, I will:
1) Wire the frontend "Copiar chave Pix" click to call a new/parallel API route.
2) On the backend, mirror the verify-payment audio logic:
   - Read bot.paymentFlow, check isCopyPixAudioEnabled.
   - If true and copyPixAudios has values, pick one (same selection logic as verify) and send via Telegram API to the user's chat.
3) Keep the architecture and styling consistent with your existing verify-payment flow.
