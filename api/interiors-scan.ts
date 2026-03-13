import type { VercelRequest, VercelResponse } from '@vercel/node';

export const maxDuration = 60;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY not set' });

  try {
    const { boardImageBase64 } = req.body;
    if (!boardImageBase64) return res.status(400).json({ error: 'boardImageBase64 required' });

    const prompt = `You are analyzing an interior design board. Extract every furniture and lighting item shown.

For each item, return:
- vendor: the brand/vendor name (e.g. "RH Modern", "A.Rudin", "Lumens")
- item: the item type (e.g. "Sofa", "Lounge Chair", "Floor Lamp", "Rug", "Side Table")
- description: the full product name/model (e.g. "Custom 2735 Sectional", "Quill Drink Table")
- finish_color: any finish, color, or material mentioned (e.g. "COM", "Bronze", "Walnut")
- image_hint: a short keyword from the label that could help match a filename (e.g. "sectional", "quill", "comtesse")

Return ONLY valid JSON in this exact format:
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
}

If a room name appears on the board, include it in the "room" field. Otherwise use empty string.
Extract ALL items visible on the board. Do not skip any.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: `data:image/png;base64,${boardImageBase64}`, detail: 'high' },
              },
              { type: 'text', text: prompt },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ error: `OpenAI error: ${err}` });
    }

    const json = await response.json();
    const content = json.choices?.[0]?.message?.content || '';

    // Extract JSON from the response
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return res.status(500).json({ error: 'Could not parse AI response', raw: content });

    const parsed = JSON.parse(match[0]);
    return res.status(200).json(parsed);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
}
