import { withAuth } from '@/lib/withAuth';
import { getDb } from '@/lib/db';
import { linkLinkedinSite, unlinkLinkedinSite } from '@/lib/linkedin-organic';

export default withAuth(function handler(req, res) {
  const { id: siteId } = req.query;
  const db = getDb();
  const site = db.prepare('SELECT id FROM sites WHERE id = ? AND user_id = ?').get(siteId, req.user.userId);
  if (!site) return res.status(404).json({ error: 'Site not found' });

  if (req.method === 'POST') {
    const { orgUrn, orgName } = req.body || {};
    if (!orgUrn) return res.status(400).json({ error: 'orgUrn required' });
    linkLinkedinSite(siteId, { orgUrn, orgName });
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'DELETE') {
    unlinkLinkedinSite(siteId);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
});
