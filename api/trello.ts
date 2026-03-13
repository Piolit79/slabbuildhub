import type { VercelRequest, VercelResponse } from '@vercel/node';

const TRELLO_BASE = 'https://api.trello.com/1';

function auth() {
  const key = process.env.TRELLO_API_KEY;
  const token = process.env.TRELLO_TOKEN;
  if (!key || !token) throw new Error('TRELLO_API_KEY or TRELLO_TOKEN not set');
  return `key=${key}&token=${token}`;
}

async function trelloJson(r: Response) {
  const text = await r.text();
  try { return JSON.parse(text); }
  catch { throw new Error(text || `Trello error ${r.status}`); }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const a = auth();
    const { action } = req.query;

    // GET boards
    if (req.method === 'GET' && action === 'boards') {
      const r = await fetch(`${TRELLO_BASE}/members/me/boards?fields=id,name,url,closed&filter=open&${a}`);
      return res.status(r.status).json(await trelloJson(r));
    }

    // GET board — lists, cards (with members+labels), board members, board labels, board name
    if (req.method === 'GET' && action === 'board') {
      const { boardId } = req.query;
      if (!boardId) return res.status(400).json({ error: 'boardId required' });
      const [boardR, listsR, cardsR, membersR, labelsR] = await Promise.all([
        fetch(`${TRELLO_BASE}/boards/${boardId}?fields=id,name,url&${a}`),
        fetch(`${TRELLO_BASE}/boards/${boardId}/lists?fields=id,name,pos&filter=open&${a}`),
        fetch(`${TRELLO_BASE}/boards/${boardId}/cards?fields=id,name,desc,idList,pos,due,url,idMembers,idLabels&filter=open&${a}`),
        fetch(`${TRELLO_BASE}/boards/${boardId}/members?fields=id,fullName,username,avatarHash&${a}`),
        fetch(`${TRELLO_BASE}/boards/${boardId}/labels?fields=id,name,color&${a}`),
      ]);
      const [board, lists, cards, members, labels] = await Promise.all([
        trelloJson(boardR), trelloJson(listsR), trelloJson(cardsR), trelloJson(membersR), trelloJson(labelsR),
      ]);
      return res.status(200).json({ board, lists, cards, members, labels });
    }

    // POST card
    if (req.method === 'POST' && action === 'card') {
      const { name, idList, desc } = req.body;
      if (!name || !idList) return res.status(400).json({ error: 'name and idList required' });
      const r = await fetch(`${TRELLO_BASE}/cards?${a}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, idList, desc: desc || '', pos: 'bottom' }),
      });
      return res.status(r.status).json(await trelloJson(r));
    }

    // PUT card
    if (req.method === 'PUT' && action === 'card') {
      const { cardId } = req.query;
      if (!cardId) return res.status(400).json({ error: 'cardId required' });
      const { idList, name, desc } = req.body;
      const body: any = {};
      if (idList) body.idList = idList;
      if (name !== undefined) body.name = name;
      if (desc !== undefined) body.desc = desc;
      const r = await fetch(`${TRELLO_BASE}/cards/${cardId}?${a}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      return res.status(r.status).json(await trelloJson(r));
    }

    // DELETE card
    if (req.method === 'DELETE' && action === 'card') {
      const { cardId } = req.query;
      if (!cardId) return res.status(400).json({ error: 'cardId required' });
      const r = await fetch(`${TRELLO_BASE}/cards/${cardId}?${a}`, { method: 'DELETE' });
      return res.status(r.status).json({ ok: true });
    }

    // POST list
    if (req.method === 'POST' && action === 'list') {
      const { name, idBoard } = req.body;
      if (!name || !idBoard) return res.status(400).json({ error: 'name and idBoard required' });
      const r = await fetch(`${TRELLO_BASE}/lists?${a}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, idBoard, pos: 'bottom' }),
      });
      return res.status(r.status).json(await trelloJson(r));
    }

    // POST card/member — add member to card
    if (req.method === 'POST' && action === 'card/member') {
      const { cardId } = req.query;
      const { memberId } = req.body;
      if (!cardId || !memberId) return res.status(400).json({ error: 'cardId and memberId required' });
      const r = await fetch(`${TRELLO_BASE}/cards/${cardId}/idMembers?${a}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: memberId }),
      });
      return res.status(r.status).json(await trelloJson(r));
    }

    // DELETE card/member
    if (req.method === 'DELETE' && action === 'card/member') {
      const { cardId, memberId } = req.query;
      if (!cardId || !memberId) return res.status(400).json({ error: 'cardId and memberId required' });
      const r = await fetch(`${TRELLO_BASE}/cards/${cardId}/idMembers/${memberId}?${a}`, { method: 'DELETE' });
      return res.status(r.status).json({ ok: true });
    }

    // POST card/label — add label to card
    if (req.method === 'POST' && action === 'card/label') {
      const { cardId } = req.query;
      const { labelId } = req.body;
      if (!cardId || !labelId) return res.status(400).json({ error: 'cardId and labelId required' });
      const r = await fetch(`${TRELLO_BASE}/cards/${cardId}/idLabels?${a}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: labelId }),
      });
      return res.status(r.status).json(await trelloJson(r));
    }

    // DELETE card/label
    if (req.method === 'DELETE' && action === 'card/label') {
      const { cardId, labelId } = req.query;
      if (!cardId || !labelId) return res.status(400).json({ error: 'cardId and labelId required' });
      const r = await fetch(`${TRELLO_BASE}/cards/${cardId}/idLabels/${labelId}?${a}`, { method: 'DELETE' });
      return res.status(r.status).json({ ok: true });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (e: any) {
    console.error('trello error:', e);
    return res.status(500).json({ error: e.message || 'Internal error' });
  }
}
