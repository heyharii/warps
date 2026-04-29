import { withAuth } from '@/lib/withAuth';
import { getDb } from '@/lib/db';
import { saveApolloConnection, getApolloConnection, getDecryptedApiKey } from '@/lib/apollo';

export default withAuth(function handler(req, res) {
  if (req.method === 'GET') {
    // Return status (masked key) for all user's sites
    const db = getDb();
    const sites = db.prepare('SELECT id FROM sites WHERE user_id = ?').all(req.user.userId);
    const result = {};
    for (const s of sites) {
      const conn = getApolloConnection(s.id);
      result[s.id] = conn ? { connected: true, maskedKey: '••••' + getDecryptedApiKey(conn)?.slice(-4) } : { connected: false };
    }
    return res.status(200).json(result);
  }

  if (req.method === 'POST') {
    const { siteId, apiKey } = req.body || {};
    if (!siteId || !apiKey) return res.status(400).json({ error: 'siteId and apiKey required' });

    // Verify site belongs to user
    const db = getDb();
    const site = db.prepare('SELECT id FROM sites WHERE id = ? AND user_id = ?').get(siteId, req.user.userId);
    if (!site) return res.status(403).json({ error: 'Not your site' });

    saveApolloConnection(siteId, apiKey);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
});
