import { withAuth } from '@/lib/withAuth';
import { getDb } from '@/lib/db';
import { getUserConnection } from '@/lib/gsc';
import { setGa4SiteLink, getGa4SiteLink } from '@/lib/ga4';

export default withAuth(async function handler(req, res) {
  const { id } = req.query;
  const db = getDb();
  const site = db.prepare('SELECT id FROM sites WHERE id = ?').get(id);
  if (!site) return res.status(404).json({ error: 'Site not found' });

  if (req.method === 'GET') {
    const link = getGa4SiteLink(parseInt(id, 10));
    return res.status(200).json({ link: link || null });
  }

  if (req.method !== 'POST') return res.status(405).end();

  const { propertyId, propertyName, accountName } = req.body || {};
  if (!propertyId) return res.status(400).json({ error: 'propertyId required' });

  if (!getUserConnection(req.user.userId)) {
    return res.status(400).json({ error: 'Google account not connected.' });
  }

  setGa4SiteLink({ siteId: parseInt(id, 10), propertyId, propertyName, accountName });
  return res.status(200).json({ ok: true });
});
