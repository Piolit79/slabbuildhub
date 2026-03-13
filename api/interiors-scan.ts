import type { VercelRequest, VercelResponse } from '@vercel/node';
import { inflateSync, inflateRawSync } from 'zlib';

export const maxDuration = 60;

// ── PDF text extractor with zlib decompression ────────────────────────────────
// InDesign PDFs use FlateDecode (zlib) on content streams — must decompress first

function decodePdfString(s: string): string {
  return s
    .replace(/\\n/g, ' ').replace(/\\r/g, ' ').replace(/\\t/g, ' ')
    .replace(/\\\\/g, '\\')
    .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
    .replace(/\\(.)/g, '$1');
}

function extractTextOps(content: string): string[] {
  const texts: string[] = [];
  const btEt = /BT([\s\S]{1,10000}?)ET/g;
  let btMatch;
  while ((btMatch = btEt.exec(content)) !== null) {
    const block = btMatch[1];
    // (text)Tj
    const tj = /\(([^)\\]*(?:\\[\s\S][^)\\]*)*)\)\s*Tj/g;
    let m;
    while ((m = tj.exec(block)) !== null) {
      const t = decodePdfString(m[1]).trim();
      if (t.length > 1) texts.push(t);
    }
    // [(text)...]TJ
    const tjArr = /\[([^\]]*)\]\s*TJ/g;
    let ma;
    while ((ma = tjArr.exec(block)) !== null) {
      const sp = /\(([^)\\]*(?:\\[\s\S][^)\\]*)*)\)/g;
      let ms;
      while ((ms = sp.exec(ma[1])) !== null) {
        const t = decodePdfString(ms[1]).trim();
        if (t.length > 1) texts.push(t);
      }
    }
  }
  return texts;
}

// ── PDF image extractor ───────────────────────────────────────────────────────
// Extracts JPEG (DCTDecode) and PNG-like (FlateDecode) image XObjects from PDF

function extractImagesFromPdf(buffer: Buffer): string[] {
  const raw = buffer.toString('binary');
  const images: string[] = [];

  let pos = 0;
  while (pos < raw.length) {
    const streamStart = raw.indexOf('stream', pos);
    if (streamStart === -1) break;

    const nl = raw[streamStart + 6] === '\r' ? 8 : 7;
    const dataStart = streamStart + nl;
    const streamEnd = raw.indexOf('endstream', dataStart);
    if (streamEnd === -1) break;

    const preStream = raw.slice(Math.max(0, streamStart - 800), streamStart);
    const isImage = /\/Subtype\s*\/Image/.test(preStream);

    if (isImage) {
      const streamData = Buffer.from(raw.slice(dataStart, streamEnd), 'binary');

      // JPEG images stored with DCTDecode — extract directly as JPEG
      if (/\/Filter\s*\/DCTDecode|\/DCTDecode/.test(preStream)) {
        // Verify it looks like a JPEG (starts with FFD8)
        if (streamData[0] === 0xff && streamData[1] === 0xd8) {
          images.push(`data:image/jpeg;base64,${streamData.toString('base64')}`);
        }
      }
      // FlateDecode images — decompress and try to use as-is or detect format
      else if (/\/Filter\s*\/FlateDecode|\/FlateDecode/.test(preStream)) {
        try {
          const decompressed = inflateSync(streamData);
          // Check if decompressed data is actually a JPEG or PNG
          if (decompressed[0] === 0xff && decompressed[1] === 0xd8) {
            images.push(`data:image/jpeg;base64,${decompressed.toString('base64')}`);
          } else if (decompressed[0] === 0x89 && decompressed[1] === 0x50) {
            images.push(`data:image/png;base64,${decompressed.toString('base64')}`);
          }
        } catch { /* skip undecompressable streams */ }
      }
    }

    pos = streamEnd + 9;
  }

  // Filter out very small images (icons, bullets, etc.) — keep only reasonably sized ones
  return images.filter(img => {
    const b64 = img.split(',')[1];
    return b64 && b64.length > 2000; // ~1.5KB minimum
  });
}

function tryDecompress(data: Buffer): string | null {
  try { return inflateSync(data).toString('latin1'); } catch { /* try raw */ }
  try { return inflateRawSync(data).toString('latin1'); } catch { /* not compressed */ }
  return null;
}

function extractTextFromPdf(buffer: Buffer): string {
  const raw = buffer.toString('binary');
  const allTexts: string[] = [];

  let pos = 0;
  while (pos < raw.length) {
    const streamStart = raw.indexOf('stream', pos);
    if (streamStart === -1) break;

    // Stream data starts after 'stream\r\n' or 'stream\n'
    const nl = raw[streamStart + 6] === '\r' ? 8 : 7;
    const dataStart = streamStart + nl;

    const streamEnd = raw.indexOf('endstream', dataStart);
    if (streamEnd === -1) break;

    const streamData = Buffer.from(raw.slice(dataStart, streamEnd), 'binary');

    // Check preceding 600 chars for FlateDecode filter
    const preStream = raw.slice(Math.max(0, streamStart - 600), streamStart);
    const hasFlate = /\/FlateDecode|\/Fl\b/.test(preStream);
    // Skip image/binary streams (XObject images, fonts, etc.)
    const isImage = /\/Subtype\s*\/Image/.test(preStream);

    if (!isImage) {
      let text: string | null = null;
      if (hasFlate) {
        text = tryDecompress(streamData);
      } else {
        // Try uncompressed stream (might still have readable text ops)
        text = streamData.toString('latin1');
      }
      if (text) {
        const extracted = extractTextOps(text);
        allTexts.push(...extracted);
      }
    }

    pos = streamEnd + 9;
  }

  // Also try raw (for uncompressed PDFs or as fallback)
  if (allTexts.length === 0) {
    const fallback = extractTextOps(raw);
    allTexts.push(...fallback);
  }

  return allTexts.join(' ').replace(/\s+/g, ' ').trim();
}

// ── Handler ────────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY not set' });

  try {
    const { pdfUrl } = req.body;
    if (!pdfUrl) return res.status(400).json({ error: 'pdfUrl required' });

    // Fetch the PDF from Supabase Storage
    const pdfResp = await fetch(pdfUrl);
    if (!pdfResp.ok) throw new Error(`Failed to fetch PDF: ${pdfResp.status}`);
    const arrayBuffer = await pdfResp.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const text = extractTextFromPdf(buffer);
    const pdfImages = extractImagesFromPdf(buffer);

    if (!text || text.trim().length < 10) {
      return res.status(400).json({
        error: 'Could not extract text from this PDF.',
        hint: 'Raw byte count: ' + buffer.length,
      });
    }

    const prompt = `You are analyzing text extracted from an interior design board PDF.
The text contains furniture and lighting items, typically in formats like:
"VENDOR - PRODUCT NAME, FINISH"  or  "VENDOR - MODEL NAME"

Extracted text:
---
${text.slice(0, 4000)}
---

Extract every distinct furniture and lighting item. For each return:
- vendor: brand name (e.g. "RH Modern", "A.Rudin", "Lumens", "Visual Comfort", "Urban Electric Co.")
- item: item type (e.g. "Sofa", "Sectional", "Lounge Chair", "Floor Lamp", "Rug", "Side Table", "Pendant", "Sconce", "Ottoman", "Drink Table")
- description: full product name/model as written
- finish_color: finish, color, or material if mentioned (empty string if not)
- image_hint: 1-2 short keywords from the product name for filename matching

Detect the room name if present (e.g. "LIVING ROOM", "PRIMARY BEDROOM").

Return ONLY valid JSON, nothing else:
{
  "room": "Living Room",
  "items": [
    {
      "vendor": "A.Rudin",
      "item": "Sectional",
      "description": "Custom 2735 Sectional, COM",
      "finish_color": "COM",
      "image_hint": "sectional"
    }
  ]
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ error: `OpenAI error: ${err}` });
    }

    const json = await response.json();
    const content = json.choices?.[0]?.message?.content || '';

    const match = content.match(/\{[\s\S]*\}/);
    if (!match) {
      return res.status(500).json({ error: 'Could not parse AI response', raw: content.slice(0, 500) });
    }

    const parsed = JSON.parse(match[0]);

    return res.status(200).json({ ...parsed, pdfImages });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
}
