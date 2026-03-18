import type { VercelRequest, VercelResponse } from '@vercel/node';
import { qbQuery } from './_qb-utils';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const data = await qbQuery('SELECT * FROM Customer WHERE IsProject = true MAXRESULTS 1000');
    const projects = (data.QueryResponse?.Customer || []).map((c: any) => ({
      id: c.Id,
      name: c.FullyQualifiedName || c.DisplayName,
    }));
    res.json({ projects });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}
