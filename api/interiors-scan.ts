import type { VercelRequest, VercelResponse } from '@vercel/node';

export const maxDuration = 60;

// ── Lightweight PDF text extractor (no external deps) ─────────────────────────
// Works for InDesign-exported PDFs where text is stored as standard PDF text ops

function decodePdfString(s: string): string {
  return s
    .replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t')
    .replace(/\\\\/g, '\\')
    .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
    .replace(/\\(.)/g, '$1');
}

function extractTextFromPdf(buffer: Buffer): string {
  const content = buffer.toString('latin1');
  const texts: string[] = [];

  // Match BT...ET text blocks
  const btEt = /BT([\s\S]{1,8000}?)ET/g;
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
      const inner = ma[1];
      const sp = /\(([^)\\]*(?:\\[\s\S][^)\\]*)*)\)/g;
      let ms;
      while ((ms = sp.exec(inner)) !== null) {
        const t = decodePdfString(ms[1]).trim();
        if (t.length > 1) texts.push(t);
      }
    }
  }

  return texts.join(' ').replace(/\s+/g, ' ').trim();
}

// ── Handler ────────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY not set' });

  try {
    const { pdfBase64 } = req.body;
    if (!pdfBase64) return res.status(400).json({ error: 'pdfBase64 required' });

    const buffer = Buffer.from(pdfBase64, 'base64');
    const text = extractTextFromPdf(buffer);

    if (!text || text.trim().length < 10) {
      return res.status(400).json({
        error: 'Could not extract text from this PDF. Make sure it is an InDesign-exported PDF, not a scanned/image-only file.',
      });
    }

    const prompt = `You are analyzing text extracted from an interior design board PDF.
The text contains furniture and lighting items, typically in formats like:
"VENDOR - PRODUCT NAME, FINISH"
"VENDOR - MODEL NAME"

Here is the extracted text:
---
${text.slice(0, 4000)}
---

Extract every distinct furniture and lighting item. For each item return:
- vendor: brand name (e.g. "RH Modern", "A.Rudin", "Lumens", "Visual Comfort")
- item: item type (e.g. "Sofa", "Lounge Chair", "Floor Lamp", "Rug", "Side Table", "Pendant", "Sconce", "Sectional")
- description: full product name as written
- finish_color: any finish, color, or material mentioned (or empty string)
- image_hint: 1-2 keywords from the product name for filename matching (e.g. "sectional", "quill", "comtesse")

Also detect the room name if present (e.g. "LIVING ROOM", "PRIMARY BEDROOM 105").

Return ONLY valid JSON, no other text:
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
    return res.status(200).json(parsed);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
}
