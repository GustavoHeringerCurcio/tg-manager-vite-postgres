/*
  Lightweight script to poll Telegram getUpdates, log any received video or audio file_id,
  and reply back to the sender with the discovered info.

  Supported media types:
    - video          (msg.video)
    - animation      (msg.animation / GIF-like videos)
    - video_note     (msg.video_note / round videos)
    - audio          (msg.audio)
    - voice          (msg.voice / voice notes)
    - photo          (msg.photo[]; picks the largest size)
    - document       (msg.document for any mime type; logs mime and file_id)

  Usage:
    - Ensure BOT_TOKEN is set in your environment (e.g. export BOT_TOKEN=123:ABC)
    - Run: node scripts/capture_video_file_id.js
    - Send a video or audio to your bot (from your Telegram client). The script will print the file_id,
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
console.log('Starting media file_id capture. Send a video or audio to your bot now.');

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
      const fileName = (msg.document && msg.document.file_name) || (msg.audio && msg.audio.file_name) || (msg.video && msg.video.file_name) || (msg.voice && msg.voice.file_name) || (msg.video_note && msg.video_note.file_name) || null;

      if (msg.video) {
        const v = msg.video;
        const fileId = v.file_id;
        const fileUniqueId = v.file_unique_id;
        const fileSize = v.file_size;
        const duration = v.duration;
        console.log('Found video message: update_id=%d chat_id=%s file_id=%s', upd.update_id, String(chatId), fileId);

        const textLines = [
          '🎬 Found video message',
          `update_id: ${upd.update_id}`,
          `chat_id: ${String(chatId)}`,
          `file_id: ${fileId}`,
          `file_unique_id: ${fileUniqueId}`,
          fileName ? `file_name: ${fileName}` : null,
          fileSize ? `file_size: ${fileSize}` : null,
          duration ? `duration: ${duration}s` : null,
        ].filter(Boolean);

        await sendInfoToChat(chatId, textLines.join('\n'));
      }

      if (msg.animation) {
        const an = msg.animation;
        const fileId = an.file_id;
        const fileUniqueId = an.file_unique_id;
        const fileSize = an.file_size;
        const duration = an.duration;
        const aName = an.file_name || fileName || null;
        console.log('Found animation: update_id=%d chat_id=%s file_id=%s', upd.update_id, String(chatId), fileId);

        const textLines = [
          '🎞️ Found animation (GIF-like)',
          `update_id: ${upd.update_id}`,
          `chat_id: ${String(chatId)}`,
          `file_id: ${fileId}`,
          `file_unique_id: ${fileUniqueId}`,
          aName ? `file_name: ${aName}` : null,
          fileSize ? `file_size: ${fileSize}` : null,
          duration ? `duration: ${duration}s` : null,
        ].filter(Boolean);

        await sendInfoToChat(chatId, textLines.join('\n'));
      }

      if (msg.video_note) {
        const vn = msg.video_note;
        const fileId = vn.file_id;
        const fileUniqueId = vn.file_unique_id;
        const fileSize = vn.file_size;
        const duration = vn.duration;
        console.log('Found video note: update_id=%d chat_id=%s file_id=%s', upd.update_id, String(chatId), fileId);

        const textLines = [
          '🔵 Found video note (round video)',
          `update_id: ${upd.update_id}`,
          `chat_id: ${String(chatId)}`,
          `file_id: ${fileId}`,
          `file_unique_id: ${fileUniqueId}`,
          fileName ? `file_name: ${fileName}` : null,
          fileSize ? `file_size: ${fileSize}` : null,
          duration ? `duration: ${duration}s` : null,
        ].filter(Boolean);

        await sendInfoToChat(chatId, textLines.join('\n'));
      }

      if (msg.audio) {
        const a = msg.audio;
        const fileId = a.file_id;
        const fileUniqueId = a.file_unique_id;
        const fileSize = a.file_size;
        const duration = a.duration;
        const performer = a.performer;
        const title = a.title;
        console.log('Found audio message: update_id=%d chat_id=%s file_id=%s', upd.update_id, String(chatId), fileId);

        const textLines = [
          '🎵 Found audio file (sendAudio, NOT used by bot)',
          `update_id: ${upd.update_id}`,
          `chat_id: ${String(chatId)}`,
          `file_id: ${fileId}`,
          `file_unique_id: ${fileUniqueId}`,
          fileName ? `file_name: ${fileName}` : null,
          performer ? `performer: ${performer}` : null,
          title ? `title: ${title}` : null,
          fileSize ? `file_size: ${fileSize}` : null,
          duration ? `duration: ${duration}s` : null,
        ].filter(Boolean);

        await sendInfoToChat(chatId, textLines.join('\n'));
      }

      if (msg.voice) {
        const vc = msg.voice;
        const fileId = vc.file_id;
        const fileUniqueId = vc.file_unique_id;
        const fileSize = vc.file_size;
        const duration = vc.duration;
        const mimeType = vc.mime_type;
        console.log('Found voice message: update_id=%d chat_id=%s file_id=%s', upd.update_id, String(chatId), fileId);

        const textLines = [
          '🎤 Found voice message (use this file_id for bot voice notes)',
          `update_id: ${upd.update_id}`,
          `chat_id: ${String(chatId)}`,
          `file_id: ${fileId}`,
          `file_unique_id: ${fileUniqueId}`,
          fileName ? `file_name: ${fileName}` : null,
          mimeType ? `mime_type: ${mimeType}` : null,
          fileSize ? `file_size: ${fileSize}` : null,
          duration ? `duration: ${duration}s` : null,
        ].filter(Boolean);

        await sendInfoToChat(chatId, textLines.join('\n'));
      }

      if (msg.photo) {
        const photos = msg.photo;
        const best = Array.isArray(photos) && photos.length > 0 ? photos[photos.length - 1] : null;
        if (best) {
          const fileId = best.file_id;
          const fileUniqueId = best.file_unique_id;
          const width = best.width;
          const height = best.height;
          const fileSize = best.file_size;
          console.log('Found photo: update_id=%d chat_id=%s file_id=%s (%dx%d)', upd.update_id, String(chatId), fileId, width, height);

          const textLines = [
            '🖼️ Found photo',
            `update_id: ${upd.update_id}`,
            `chat_id: ${String(chatId)}`,
            `file_id: ${fileId}`,
            `file_unique_id: ${fileUniqueId}`,
            (width && height) ? `size: ${width}x${height}` : null,
            fileSize ? `file_size: ${fileSize}` : null,
          ].filter(Boolean);

          await sendInfoToChat(chatId, textLines.join('\n'));
        }
      }

      if (msg.document) {
        const d = msg.document;
        const mime = d.mime_type || 'application/octet-stream';

        const fileId = d.file_id;
        const fileUniqueId = d.file_unique_id;
        const fileName = d.file_name || '<unknown>';
        const fileSize = d.file_size;

        let kind = 'file';
        let emoji = '📎';
        if (mime.includes('image')) { kind = 'image'; emoji = '🖼️'; }
        else if (mime.includes('video')) { kind = 'video'; emoji = '📄'; }
        else if (mime.includes('audio')) { kind = 'audio'; emoji = '📁'; }

        console.log('Found %s document: update_id=%d chat_id=%s file_id=%s', kind, upd.update_id, String(chatId), fileId);

        const textLines = [
          `${emoji} Found ${kind} document`,
          `update_id: ${upd.update_id}`,
          `chat_id: ${String(chatId)}`,
          `file_id: ${fileId}`,
          `file_unique_id: ${fileUniqueId}`,
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
