import { withAuth } from '@/lib/withAuth';
import { getDb } from '@/lib/db';
import { deleteGa4SiteLink } from '@/lib/ga4';

export default withAuth(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { id } = req.query;
  const db = getDb();
  const site = db.prepare('SELECT id FROM sites WHERE id = ? AND user_id = ?').get(id, req.user.userId);
  if (!site) return res.status(404).json({ error: 'Site not found' });

  deleteGa4SiteLink(parseInt(id, 10));
  return res.status(200).json({ ok: true });
});
