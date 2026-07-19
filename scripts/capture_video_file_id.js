/*
  Lightweight script to poll Telegram getUpdates, log any received video file_id,
  and reply back to the sender with the discovered info.

  Usage:
    - Ensure BOT_TOKEN is set in your environment (e.g. export BOT_TOKEN=123:ABC)
    - Run: node scripts/capture_video_file_id.js
    - Send a video to your bot (from your Telegram client). The script will print the file_id,
      chat id, and will also reply in the chat with that information.

  Notes:
    - If your bot is configured with webhooks, getUpdates may not return updates. Disable webhook first or run this on a bot not using webhooks.
    - This script consumes updates (marks them as read) using offset so you won't see the same updates again.
*/

const https = require('https');

const TOKEN = process.env.BOT_TOKEN;
if (!TOKEN) {
  console.error('Missing BOT_TOKEN in environment. Set BOT_TOKEN and re-run.');
  process.exit(1);
}

const API_HOST = 'api.telegram.org';
const BASE_PATH = `/bot${TOKEN}`;

function apiGet(path) {
  const opts = {
    hostname: API_HOST,
    path: `${BASE_PATH}${path}`,
    method: 'GET',
  };

  return new Promise((resolve, reject) => {
    const req = https.request(opts, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve(json);
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function apiPost(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const opts = {
      hostname: API_HOST,
      path: `${BASE_PATH}${path}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    };

    const req = https.request(opts, (res) => {
      let responseData = '';
      res.on('data', (chunk) => (responseData += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve(parsed);
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

let lastOffset = 0;
console.log('Starting video file_id capture. Send a video to your bot now.');

async function sendInfoToChat(chatId, text) {
  if (!chatId) return;
  try {
    await apiPost('/sendMessage', { chat_id: chatId, text });
    console.log('Replied to chat', chatId);
  } catch (err) {
    console.error('Failed to send message to chat', chatId, ':', err && err.message ? err.message : err);
  }
}

async function pollOnce() {
  try {
    const q = `?offset=${lastOffset}&limit=100&timeout=0`;
    const res = await apiGet(`/getUpdates${q}`);
    if (!res || !res.result) return;

    for (const upd of res.result) {
      // advance offset to consume this update
      if (typeof upd.update_id === 'number') {
        lastOffset = Math.max(lastOffset, upd.update_id + 1);
      }

      const msg = upd.message || upd.channel_post || null;
      if (!msg) continue;

      const chatId = msg.chat && msg.chat.id;

      if (msg.video) {
        const v = msg.video;
        const fileId = v.file_id;
        const fileUniqueId = v.file_unique_id;
        const fileSize = v.file_size;
        const duration = v.duration;
        console.log('Found video message: update_id=%d chat_id=%s file_id=%s', upd.update_id, String(chatId), fileId);
        console.log('You can put this value in .env as WELCOME_VIDEO_FILE_ID');

        const textLines = [
          '🎬 Found video message',
          `update_id: ${upd.update_id}`,
          `chat_id: ${String(chatId)}`,
          `file_id: ${fileId}`,
          `file_unique_id: ${fileUniqueId}`,
          fileSize ? `file_size: ${fileSize}` : null,
          duration ? `duration: ${duration}s` : null,
        ].filter(Boolean);

        await sendInfoToChat(chatId, textLines.join('\n'));
      }

      // also check for document subtype (some clients send mp4 as document)
      if (msg.document && msg.document.mime_type && msg.document.mime_type.includes('video')) {
        const d = msg.document;
        const fileId = d.file_id;
        const fileName = d.file_name || '<unknown>';
        const mime = d.mime_type;
        const fileSize = d.file_size;
        console.log('Found video document: update_id=%d chat_id=%s file_id=%s', upd.update_id, String(chatId), fileId);
        console.log('You can put this value in .env as WELCOME_VIDEO_FILE_ID');

        const textLines = [
          '📄 Found video document',
          `update_id: ${upd.update_id}`,
          `chat_id: ${String(chatId)}`,
          `file_id: ${fileId}`,
          `file_name: ${fileName}`,
          `mime_type: ${mime}`,
          fileSize ? `file_size: ${fileSize}` : null,
        ].filter(Boolean);

        await sendInfoToChat(chatId, textLines.join('\n'));
      }
    }
  } catch (err) {
    console.error('Error while polling getUpdates:', err && err.message ? err.message : err);
  }
}

(async function run() {
  // initial quick poll to pick up any recent updates
  await pollOnce();
  // then poll every 2s
  setInterval(pollOnce, 2000);
})();
