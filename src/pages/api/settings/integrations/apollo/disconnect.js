import { withAuth } from '@/lib/withAuth';
import { getDb } from '@/lib/db';
import { deleteApolloConnection } from '@/lib/apollo';

export default withAuth(function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { siteId } = req.body || {};
  if (!siteId) return res.status(400).json({ error: 'siteId required' });

  const db = getDb();
  const site = db.prepare('SELECT id FROM sites WHERE id = ?').get(siteId);
  if (!site) return res.status(403).json({ error: 'Not your site' });

  deleteApolloConnection(siteId);
  return res.status(200).json({ ok: true });
});
