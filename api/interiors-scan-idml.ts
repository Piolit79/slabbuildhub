import type { VercelRequest, VercelResponse } from '@vercel/node';

export const maxDuration = 60;

// ── Handler ────────────────────────────────────────────────────────────────────
// Receives pre-parsed text + imageFilenames from the client-side IDML parser.
// The client uses JSZip to parse the IDML in the browser (no file upload needed).

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY not set' });

  try {
    const { text, imageFilenames } = req.body as { text: string; imageFilenames: string[] };
    if (!text || text.trim().length < 10) {
      return res.status(400).json({ error: 'text is required and must not be empty' });
    }

    // Provide GPT the full text and the exact image filenames so it can match them
    const filenameBlock = imageFilenames.length > 0
      ? `\nImage files linked in this document (assign the best matching filename to each item):\n${imageFilenames.join('\n')}`
      : '';

    const prompt = `You are analyzing text extracted from an InDesign furniture schedule or design board (IDML format).

IMPORTANT: Only extract items that actually appear in the text below. Do NOT invent or guess items.

The text contains furniture/lighting items, often in formats like:
- "VENDOR - PRODUCT NAME"
- "VENDOR - PRODUCT NAME, FINISH/COLOR"
- Room headers like "LIVING ROOM", "DINING ROOM", "FOYER", "PRIMARY BEDROOM"

There may be 10–60 items across multiple rooms. Extract ALL of them.
${filenameBlock}

Extracted text:
---
${text.slice(0, 25000)}
---

For EACH item found, return:
- vendor: the brand/vendor name exactly as written
- item: the item category (Sofa, Chair, Rug, Table, Pendant, Lamp, Sconce, Ottoman, Bed, Nightstand, Dresser, Mirror, Console, Bench, Bookcase, etc.)
- description: the full product name as written in the text
- finish_color: finish/color/material if mentioned, otherwise empty string
- image_filename: the filename from the list above that best matches this item (exact filename, or empty string if no match)

Also return the room name if present (first room header found).

Return ONLY a JSON object, no markdown, no explanation:
{"room":"","items":[{"vendor":"","item":"","description":"","finish_color":"","image_filename":""}]}`;

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

    return res.status(200).json({ ...parsed, imageFilenames });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
}
