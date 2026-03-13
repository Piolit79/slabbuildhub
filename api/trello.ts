import type { VercelRequest, VercelResponse } from '@vercel/node';

const TRELLO_BASE = 'https://api.trello.com/1';

function auth() {
  const key = process.env.TRELLO_API_KEY;
  const token = process.env.TRELLO_TOKEN;
  if (!key || !token) throw new Error('TRELLO_API_KEY or TRELLO_TOKEN not set');
  return `key=${key}&token=${token}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const a = auth();
    const { action } = req.query;

    // GET /api/trello?action=boards
    if (req.method === 'GET' && action === 'boards') {
      const r = await fetch(`${TRELLO_BASE}/members/me/boards?fields=id,name,url,closed&filter=open&${a}`);
      const data = await r.json();
      return res.status(r.status).json(data);
    }

    // GET /api/trello?action=board&boardId=xxx
    if (req.method === 'GET' && action === 'board') {
      const { boardId } = req.query;
      if (!boardId) return res.status(400).json({ error: 'boardId required' });
      const [listsR, cardsR] = await Promise.all([
        fetch(`${TRELLO_BASE}/boards/${boardId}/lists?fields=id,name,pos,closed&filter=open&${a}`),
        fetch(`${TRELLO_BASE}/boards/${boardId}/cards?fields=id,name,desc,idList,pos,due,url&filter=open&${a}`),
      ]);
      const [lists, cards] = await Promise.all([listsR.json(), cardsR.json()]);
      return res.status(200).json({ lists, cards });
    }

    // POST /api/trello?action=card  body: { name, idList, desc? }
    if (req.method === 'POST' && action === 'card') {
      const { name, idList, desc } = req.body;
      if (!name || !idList) return res.status(400).json({ error: 'name and idList required' });
      const r = await fetch(`${TRELLO_BASE}/cards?${a}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, idList, desc: desc || '', pos: 'bottom' }),
      });
      const data = await r.json();
      return res.status(r.status).json(data);
    }

    // PUT /api/trello?action=card&cardId=xxx  body: { idList? }
    if (req.method === 'PUT' && action === 'card') {
      const { cardId } = req.query;
      if (!cardId) return res.status(400).json({ error: 'cardId required' });
      const { idList, name, desc } = req.body;
      const body: any = {};
      if (idList) body.idList = idList;
      if (name !== undefined) body.name = name;
      if (desc !== undefined) body.desc = desc;
      const r = await fetch(`${TRELLO_BASE}/cards/${cardId}?${a}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      return res.status(r.status).json(data);
    }

    // DELETE /api/trello?action=card&cardId=xxx
    if (req.method === 'DELETE' && action === 'card') {
      const { cardId } = req.query;
      if (!cardId) return res.status(400).json({ error: 'cardId required' });
      const r = await fetch(`${TRELLO_BASE}/cards/${cardId}?${a}`, { method: 'DELETE' });
      return res.status(r.status).json({ ok: true });
    }

    // POST /api/trello?action=list  body: { name, idBoard }
    if (req.method === 'POST' && action === 'list') {
      const { name, idBoard } = req.body;
      if (!name || !idBoard) return res.status(400).json({ error: 'name and idBoard required' });
      const r = await fetch(`${TRELLO_BASE}/lists?${a}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, idBoard, pos: 'bottom' }),
      });
      const data = await r.json();
      return res.status(r.status).json(data);
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (e: any) {
    console.error('trello error:', e);
    return res.status(500).json({ error: e.message || 'Internal error' });
  }
}
