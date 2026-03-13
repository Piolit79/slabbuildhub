import type { VercelRequest, VercelResponse } from '@vercel/node';
import { inflateSync, inflateRawSync } from 'zlib';

export const maxDuration = 60;

// ── ASCII85 decoder ───────────────────────────────────────────────────────────
// InDesign PDFs commonly use [/ASCII85Decode /FlateDecode] filter chains.
// ASCII85 encodes 4 bytes as 5 printable chars (33–117). 'z' = 4 zero bytes.

function decodeAscii85(buf: Buffer): Buffer | null {
  try {
    let s = buf.toString('binary').replace(/\s/g, '');
    const end = s.indexOf('~>');
    if (end !== -1) s = s.slice(0, end);
    if (s.length === 0) return null;

    const out: number[] = [];
    let i = 0;
    while (i < s.length) {
      if (s[i] === 'z') { out.push(0, 0, 0, 0); i++; continue; }
      const chunk = s.slice(i, i + 5);
      i += 5;
      if (chunk.length === 0) break;
      let val = 0;
      for (let j = 0; j < 5; j++) {
        val = val * 85 + ((j < chunk.length ? chunk.charCodeAt(j) : 84) - 33);
      }
      out.push((val >>> 24) & 0xff);
      if (chunk.length > 1) out.push((val >>> 16) & 0xff);
      if (chunk.length > 2) out.push((val >>> 8) & 0xff);
      if (chunk.length > 3) out.push(val & 0xff);
    }
    return Buffer.from(out);
  } catch { return null; }
}

// ── PDF string decoder ────────────────────────────────────────────────────────

function decodePdfString(s: string): string {
  return s
    .replace(/\\n/g, ' ').replace(/\\r/g, ' ').replace(/\\t/g, ' ')
    .replace(/\\\\/g, '\\')
    .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
    .replace(/\\(.)/g, '$1');
}

// ── PDF text op extractor (BT/ET blocks) ──────────────────────────────────────

function extractTextOps(content: string): string[] {
  const texts: string[] = [];
  const btEt = /BT([\s\S]{1,20000}?)ET/g;
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

// ── Stream decompressor — tries all known filter combos ───────────────────────

function decompressStream(data: Buffer): string[] {
  const results: string[] = [];

  // 1. Raw zlib inflate (standard FlateDecode)
  try {
    const txt = inflateSync(data).toString('latin1');
    results.push(txt);
  } catch { /* try next */ }

  // 2. Raw deflate (no zlib header)
  try {
    const txt = inflateRawSync(data).toString('latin1');
    results.push(txt);
  } catch { /* try next */ }

  // 3. ASCII85 then zlib inflate (InDesign's typical filter chain)
  const a85 = decodeAscii85(data);
  if (a85) {
    try {
      const txt = inflateSync(a85).toString('latin1');
      results.push(txt);
    } catch { /* try raw inflate */ }
    try {
      const txt = inflateRawSync(a85).toString('latin1');
      results.push(txt);
    } catch { /* not compressed after a85 */ }
    // Also read ASCII85-decoded as-is (some streams aren't further compressed)
    results.push(a85.toString('latin1'));
  }

  // 4. Always try raw bytes as a last-ditch read
  results.push(data.toString('latin1'));

  return results;
}

// ── Main PDF text extractor ───────────────────────────────────────────────────
// Iterates every stream in the PDF, tries all decompression methods, extracts
// BT/ET text ops. Deduplicates at the end.

function extractTextFromPdf(buffer: Buffer): string {
  const raw = buffer.toString('binary');
  const seen = new Set<string>();
  const allTexts: string[] = [];

  const add = (items: string[]) => {
    for (const t of items) {
      if (!seen.has(t)) { seen.add(t); allTexts.push(t); }
    }
  };

  let pos = 0;
  while (pos < raw.length) {
    const streamStart = raw.indexOf('stream', pos);
    if (streamStart === -1) break;

    const nl = raw[streamStart + 6] === '\r' ? 8 : 7;
    const dataStart = streamStart + nl;
    const streamEnd = raw.indexOf('endstream', dataStart);
    if (streamEnd === -1) break;

    const streamData = Buffer.from(raw.slice(dataStart, streamEnd), 'binary');

    // Use 1500-char window to safely cover longer object dictionaries
    const preStream = raw.slice(Math.max(0, streamStart - 1500), streamStart);

    // Skip image XObjects (raw pixel data — not text)
    const isImage = /\/Subtype\s*\/Image/.test(preStream);

    if (!isImage && streamData.length > 0) {
      for (const decoded of decompressStream(streamData)) {
        add(extractTextOps(decoded));
      }
    }

    pos = streamEnd + 9;
  }

  // Fallback: scan the raw PDF file itself for uncompressed BT/ET blocks
  if (allTexts.length < 5) {
    add(extractTextOps(raw));
  }

  return allTexts.join(' ').replace(/\s+/g, ' ').trim();
}

// ── PDF image extractor ───────────────────────────────────────────────────────
// Extracts JPEG images (DCTDecode) from image XObjects.

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

    const preStream = raw.slice(Math.max(0, streamStart - 1500), streamStart);
    const isImage = /\/Subtype\s*\/Image/.test(preStream);

    if (isImage) {
      const streamData = Buffer.from(raw.slice(dataStart, streamEnd), 'binary');

      // JPEG: DCTDecode — extract directly
      if (/DCTDecode/.test(preStream)) {
        if (streamData[0] === 0xff && streamData[1] === 0xd8) {
          images.push(`data:image/jpeg;base64,${streamData.toString('base64')}`);
        }
      }
      // FlateDecode image — decompress and check format
      else if (/FlateDecode/.test(preStream)) {
        try {
          const d = inflateSync(streamData);
          if (d[0] === 0xff && d[1] === 0xd8) {
            images.push(`data:image/jpeg;base64,${d.toString('base64')}`);
          } else if (d[0] === 0x89 && d[1] === 0x50) {
            images.push(`data:image/png;base64,${d.toString('base64')}`);
          }
        } catch { /* skip */ }
      }
    }

    pos = streamEnd + 9;
  }

  // Keep only images large enough to be actual product photos (~1.5 KB+)
  return images.filter(img => {
    const b64 = img.split(',')[1];
    return b64 && b64.length > 2000;
  });
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
        hint: `Raw byte count: ${buffer.length}, extracted text length: ${text?.length ?? 0}`,
      });
    }

    // Up to 20,000 chars — enough for large multi-room, 50+ item schedules
    const truncatedText = text.slice(0, 20000);

    const prompt = `You are analyzing raw text extracted from an interior design board or furniture schedule PDF.

IMPORTANT: Only extract items that actually appear in the text below. Do NOT invent, guess, or use example items. Every vendor name and product name must appear verbatim in the extracted text.

The text contains furniture/lighting items, often in formats like:
- "VENDOR - PRODUCT NAME"
- "VENDOR - PRODUCT NAME, FINISH/COLOR"
- Room headers like "LIVING ROOM", "DINING ROOM", "FOYER", "PRIMARY BEDROOM 105"

There may be 10–60 items across multiple rooms. Extract ALL of them — do not stop early.

Extracted text:
---
${truncatedText}
---

For EACH item found, return:
- vendor: the brand/vendor name exactly as written
- item: the item category (Sofa, Chair, Rug, Table, Pendant, Lamp, Sconce, Ottoman, Bed, Nightstand, Dresser, Mirror, Console, Bench, Bookcase, etc.)
- description: the full product name as written in the text
- finish_color: finish/color/material if mentioned, otherwise empty string
- image_hint: 1-2 keywords from the product name useful for image filename matching

Also return the room name if present (first room section header found).

Return ONLY a JSON object, no markdown, no explanation:
{"room":"","items":[{"vendor":"","item":"","description":"","finish_color":"","image_hint":""}]}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 4096,
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
