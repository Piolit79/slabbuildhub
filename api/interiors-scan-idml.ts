import type { VercelRequest, VercelResponse } from '@vercel/node';
import JSZip from 'jszip';

export const maxDuration = 60;

// ── IDML parser ───────────────────────────────────────────────────────────────
// IDML is a ZIP archive containing XML files.
// Stories/*.xml  → clean UTF-8 text (exactly what was typed in InDesign)
// Spreads/*.xml  → image link filenames (LinkResourceURI attributes)

function unescapeXml(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"');
}

async function parseIdml(buffer: Buffer): Promise<{ text: string; imageFilenames: string[] }> {
  const zip = new JSZip();
  await zip.loadAsync(buffer);

  const storyTexts: string[] = [];
  const imageFilenames: string[] = [];

  // ── Text extraction from Stories ─────────────────────────────────────────
  for (const [path, file] of Object.entries(zip.files)) {
    if (!path.startsWith('Stories/') || !path.endsWith('.xml') || file.dir) continue;
    const xml = await file.async('string');
    const re = /<Content>([^<]*)<\/Content>/g;
    let m;
    while ((m = re.exec(xml)) !== null) {
      const t = unescapeXml(m[1]).trim();
      if (t.length > 1) storyTexts.push(t);
    }
  }

  // ── Image filename extraction from Spreads (and BackingStory) ────────────
  for (const [path, file] of Object.entries(zip.files)) {
    const isSpread = path.startsWith('Spreads/') && path.endsWith('.xml');
    const isBacking = path === 'BackingStory.xml';
    if ((!isSpread && !isBacking) || file.dir) continue;
    const xml = await file.async('string');
    const re = /LinkResourceURI="([^"]+)"/g;
    let m;
    while ((m = re.exec(xml)) !== null) {
      const uri = m[1].replace(/\\/g, '/');
      const parts = uri.split('/');
      const fname = decodeURIComponent(parts[parts.length - 1]);
      if (fname && /\.(jpe?g|png|gif|webp|tiff?|psd|eps|ai|svg)$/i.test(fname)) {
        imageFilenames.push(fname);
      }
    }
  }

  return {
    text: storyTexts.join('\n'),
    imageFilenames: [...new Set(imageFilenames)],
  };
}

// ── Handler ────────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY not set' });

  try {
    const { idmlUrl } = req.body;
    if (!idmlUrl) return res.status(400).json({ error: 'idmlUrl required' });

    // Fetch the IDML from Supabase Storage
    const idmlResp = await fetch(idmlUrl);
    if (!idmlResp.ok) throw new Error(`Failed to fetch IDML: ${idmlResp.status}`);
    const arrayBuffer = await idmlResp.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { text, imageFilenames } = await parseIdml(buffer);

    if (!text || text.trim().length < 10) {
      return res.status(400).json({
        error: 'Could not extract text from this IDML file.',
        hint: `Story text length: ${text?.length ?? 0}`,
      });
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
