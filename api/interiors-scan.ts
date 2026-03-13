import type { VercelRequest, VercelResponse } from '@vercel/node';
// Import from lib path to avoid pdf-parse trying to load test files in serverless
import pdfParse from 'pdf-parse/lib/pdf-parse.js';

export const maxDuration = 60;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY not set' });

  try {
    const { pdfBase64 } = req.body;
    if (!pdfBase64) return res.status(400).json({ error: 'pdfBase64 required' });

    // Extract text from PDF
    const buffer = Buffer.from(pdfBase64, 'base64');
    const pdfData = await pdfParse(buffer);
    const text = pdfData.text;

    if (!text || text.trim().length < 10) {
      return res.status(400).json({ error: 'Could not extract text from PDF. Make sure the PDF is an InDesign-exported file, not a scanned image.' });
    }

    const prompt = `You are analyzing text extracted from an interior design board PDF. The text contains furniture and lighting items in the format "VENDOR - PRODUCT NAME" or similar.

Here is the extracted text:
---
${text}
---

Extract every furniture and lighting item. For each item return:
- vendor: the brand/vendor name (e.g. "RH Modern", "A.Rudin", "Lumens", "Visual Comfort")
- item: the item type (e.g. "Sofa", "Lounge Chair", "Floor Lamp", "Rug", "Side Table", "Pendant", "Sconce")
- description: the full product name/model as written (e.g. "Custom 2735 Sectional, COM")
- finish_color: any finish, color, material, or fabric mentioned (e.g. "COM", "Bronze", "Walnut", "Performance Linen Weave, Fog")
- image_hint: one or two short keywords from the product name useful for matching a filename (e.g. "sectional", "quill drink", "comtesse")

Also identify the room name if it appears (e.g. "LIVING ROOM", "PRIMARY BEDROOM").

Return ONLY valid JSON in this exact format, no other text:
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
    if (!match) return res.status(500).json({ error: 'Could not parse AI response', raw: content });

    const parsed = JSON.parse(match[0]);
    return res.status(200).json(parsed);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
}
