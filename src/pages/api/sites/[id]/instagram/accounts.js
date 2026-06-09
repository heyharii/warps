import { withAuth } from '@/lib/withAuth';
import { getDb } from '@/lib/db';
import { getInstagramUserConn, getInstagramDecryptedToken, refreshInstagramTokenIfNeeded, listInstagramAccounts } from '@/lib/instagram';

export default withAuth(async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const { id: siteId } = req.query;
  const db = getDb();
  const site = db.prepare('SELECT id FROM sites WHERE id = ?').get(siteId);
  if (!site) return res.status(404).json({ error: 'Site not found' });

  const conn = getInstagramUserConn(req.user.userId);
  if (!conn) return res.status(400).json({ error: 'Instagram not connected' });

  try {
    const token = await refreshInstagramTokenIfNeeded(req.user.userId);
    const accounts = await listInstagramAccounts(token);
    return res.status(200).json({ accounts });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
