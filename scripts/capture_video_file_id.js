/*
  Lightweight script to poll Telegram getUpdates, log any received video or audio file_id,
  and reply back to the sender with the discovered info.

  Supported media types:
    - video          (msg.video)
    - animation      (msg.animation / GIF-like videos)
    - video_note     (msg.video_note / round videos)
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
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');

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
    req.setTimeout(8000, () => req.destroy(new Error('Request timed out')));
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

    req.setTimeout(8000, () => req.destroy(new Error('Request timed out')));
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function getFileInfo(fileId) {
  const res = await apiGet(`/getFile?file_id=${encodeURIComponent(fileId)}`);
  if (!res || !res.ok || !res.result || !res.result.file_path) {
    throw new Error(`getFile failed: ${JSON.stringify(res)}`);
  }
  return res.result;
}

function downloadFile(filePath) {
  return new Promise((resolve, reject) => {
    const url = `https://api.telegram.org/file/bot${TOKEN}/${filePath}`;
    const req = https.get(url, (res) => {
      if (res.statusCode !== 200) return reject(new Error(`Download failed: ${res.statusCode}`));
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.setTimeout(60000, () => req.destroy(new Error('Download timed out')));
    req.on('error', reject);
  });
}

function reencodeOpus(inputPath) {
  return new Promise((resolve, reject) => {
    const outputPath = inputPath.replace(/\.(ogg|oga|opus)$/i, '_opus.ogg');
    execFile('ffmpeg', [
      '-y', '-i', inputPath,
      '-c:a', 'libopus', '-b:a', '16k', '-vbr', 'off', '-ar', '48000', '-ac', '1',
      outputPath,
    ], (err) => {
      if (err) {
        reject(err.code === 'ENOENT'
          ? new Error('ffmpeg not found — install: winget install ffmpeg')
          : new Error(`ffmpeg: ${err.message}`));
      } else {
        resolve(outputPath);
      }
    });
  });
}

function uploadVoiceFile(chatId, filePath) {
  return new Promise((resolve, reject) => {
    const boundary = `----FormBoundary${Date.now()}${Math.random().toString(36).slice(2)}`;
    const fileName = path.basename(filePath);
    const fileBuffer = fs.readFileSync(filePath);
    const parts = [];
    parts.push(Buffer.from(`--${boundary}\r\n`));
    parts.push(Buffer.from('Content-Disposition: form-data; name="chat_id"\r\n\r\n'));
    parts.push(Buffer.from(`${chatId}\r\n`));
    parts.push(Buffer.from(`--${boundary}\r\n`));
    parts.push(Buffer.from(`Content-Disposition: form-data; name="voice"; filename="${fileName}"\r\n`));
    parts.push(Buffer.from('Content-Type: audio/ogg\r\n\r\n'));
    parts.push(fileBuffer);
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
    const body = Buffer.concat(parts);
    const req = https.request({
      hostname: API_HOST,
      path: `${BASE_PATH}/sendVoice`,
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
    });
    req.setTimeout(60000, () => req.destroy(new Error('Upload timed out')));
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function convertOggToVoice(chatId, fileId) {
  console.log('Downloading .ogg, re-encoding to OPUS...');
  await sendInfoToChat(chatId, 'Converting .ogg to OPUS voice format...');
  const { file_path: tgPath } = await getFileInfo(fileId);
  const buffer = await downloadFile(tgPath);
  const tmpDir = os.tmpdir();
  const inPath = path.join(tmpDir, `ogg_in_${Date.now()}.ogg`);
  fs.writeFileSync(inPath, buffer);
  console.log('Downloaded (%d bytes), re-encoding...', buffer.length);
  const opusPath = await reencodeOpus(inPath);
  console.log('Re-encoded: %s (%d bytes)', opusPath, fs.statSync(opusPath).size);
  const sendRes = await uploadVoiceFile(chatId, opusPath);
  if (sendRes && sendRes.ok && sendRes.result && sendRes.result.voice) {
    const v = sendRes.result.voice;
    console.log('Voice file_id:', v.file_id);
    await sendInfoToChat(chatId, [
      'Voice file_id ready for sendVoice:',
      `file_id: ${v.file_id}`,
      `file_unique_id: ${v.file_unique_id}`,
      v.mime_type ? `mime_type: ${v.mime_type}` : null,
      v.file_size ? `file_size: ${v.file_size}` : null,
      v.duration ? `duration: ${v.duration}s` : null,
    ].filter(Boolean).join('\n'));
  } else {
    console.error('Upload failed:', JSON.stringify(sendRes).slice(0, 300));
    await sendInfoToChat(chatId, 'Upload failed after re-encode. Check console.');
  }
  try { fs.unlinkSync(inPath); } catch {}
  try { fs.unlinkSync(opusPath); } catch {}
}

let lastOffset = 0;
let lastErrorLogAt = 0;
console.log('Starting media file_id capture. Send a video, voice message, or photo to your bot now.');

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
        const mime = a.mime_type || '';
        const audioFileName = a.file_name || fileName || '';
        console.log('Found audio: update_id=%d chat_id=%s file_id=%s mime=%s', upd.update_id, String(chatId), fileId, mime);

        const isOgg = mime.includes('ogg') || audioFileName.endsWith('.ogg') || audioFileName.endsWith('.oga');

        if (isOgg && chatId) {
          try {
            await convertOggToVoice(chatId, fileId);
          } catch (err) {
            console.error('OGG conversion failed:', err && err.message ? err.message : err);
            await sendInfoToChat(chatId, `OGG conversion failed: ${err && err.message ? err.message : err}`);
          }
        } else {
          await sendInfoToChat(chatId, [
            'Audio file detected (not .ogg — ignored)',
            `file_name: ${audioFileName || '<none>'}`,
            `mime_type: ${mime}`,
            `file_size: ${fileSize || '?'}`,
          ].join('\n'));
        }
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
          '🎤 Found voice message (✅ use this file_id for bot)',
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

        if (kind === 'audio' && (mime.includes('ogg') || mime.includes('oga')) && chatId) {
          try {
            await convertOggToVoice(chatId, fileId);
          } catch (err) {
            console.error('OGG document conversion failed:', err && err.message ? err.message : err);
          }
        }
      }
    }
  } catch (err) {
    const now = Date.now();
    if (now - lastErrorLogAt > 5000) {
      console.warn('Error while polling getUpdates:', err && err.message ? err.message : err);
      lastErrorLogAt = now;
    }
  }
}

(async function run() {
  // initial quick poll to pick up any recent updates
  await pollOnce();
  // then poll every 2s
  setInterval(pollOnce, 2000);
})();
