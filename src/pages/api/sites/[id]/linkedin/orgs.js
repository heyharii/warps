import { withAuth } from '@/lib/withAuth';
import { getDb } from '@/lib/db';
import { getLinkedinUserConn, getLinkedinDecryptedToken, refreshLinkedinToken, listLinkedinOrgs } from '@/lib/linkedin-organic';

export default withAuth(async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const { id: siteId } = req.query;
  const db = getDb();
  const site = db.prepare('SELECT id FROM sites WHERE id = ? AND user_id = ?').get(siteId, req.user.userId);
  if (!site) return res.status(404).json({ error: 'Site not found' });

  const conn = getLinkedinUserConn(req.user.userId);
  if (!conn) return res.status(400).json({ error: 'LinkedIn not connected' });

  try {
    const accessToken = await refreshLinkedinToken(getLinkedinDecryptedToken(conn));
    const orgs = await listLinkedinOrgs(accessToken);
    return res.status(200).json({ orgs });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
