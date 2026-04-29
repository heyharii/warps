import { withAuth } from '@/lib/withAuth';
import { getDb } from '@/lib/db';
import { linkGoogleAdsSite, unlinkGoogleAdsSite } from '@/lib/google-ads';

export default withAuth(function handler(req, res) {
  const { id: siteId } = req.query;
  const db = getDb();
  const site = db.prepare('SELECT id FROM sites WHERE id = ? AND user_id = ?').get(siteId, req.user.userId);
  if (!site) return res.status(404).json({ error: 'Site not found' });

  if (req.method === 'POST') {
    const { customerId, accountName } = req.body || {};
    if (!customerId) return res.status(400).json({ error: 'customerId required' });
    linkGoogleAdsSite(siteId, { customerId, accountName });
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'DELETE') {
    unlinkGoogleAdsSite(siteId);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
});
