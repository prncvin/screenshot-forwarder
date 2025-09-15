// api/upload-screenshot.js  (Vercel serverless)
import FormData from 'form-data';

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  // 🔑 CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end(); // respond to preflight
  }

  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    const Busboy = require('busboy');
    const bb = Busboy({ headers: req.headers });
    const parts = {};
    let fileBuffer = null;
    let filename = 'screenshot.png';

    await new Promise((resolve, reject) => {
      bb.on('file', (name, file, info) => {
        const chunks = [];
        filename = info.filename || filename;
        file.on('data', (d) => chunks.push(d));
        file.on('end', () => { fileBuffer = Buffer.concat(chunks); });
      });
      bb.on('field', (name, val) => { parts[name] = val; });
      bb.on('close', resolve);
      bb.on('error', reject);
      req.pipe(bb);
    });

    if (!fileBuffer) return res.status(400).send('No file uploaded');

    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) return res.status(500).send('Webhook URL not configured');

    const form = new FormData();
    form.append('file', fileBuffer, { filename });

    const contentParts = [];
    if (parts.url) contentParts.push(`Page: ${parts.url}`);
    if (parts.userAgent) contentParts.push(`UA: ${parts.userAgent}`);
    if (contentParts.length) form.append('content', contentParts.join(' | '));

    const fetch = (await import('node-fetch')).default;
    const fetchRes = await fetch(webhookUrl, {
      method: 'POST',
      body: form,
      headers: form.getHeaders ? form.getHeaders() : {}
    });

    if (!fetchRes.ok) {
      const t = await fetchRes.text();
      console.error('Discord error', t);
      return res.status(502).send('Discord error: ' + t);
    }

    res.status(200).send('OK');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
}
