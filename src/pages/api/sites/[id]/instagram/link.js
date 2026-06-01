import { withAuth } from '@/lib/withAuth';
import { getDb } from '@/lib/db';
import {
  getInstagramUserConn,
  refreshInstagramTokenIfNeeded,
  getPageAccessToken,
  linkInstagramSite,
  unlinkInstagramSite,
} from '@/lib/instagram';

export default withAuth(async function handler(req, res) {
  const { id: siteId } = req.query;
  const db = getDb();
  const site = db.prepare('SELECT id FROM sites WHERE id = ? AND user_id = ?').get(siteId, req.user.userId);
  if (!site) return res.status(404).json({ error: 'Site not found' });

  if (req.method === 'POST') {
    const { igUserId, igUsername, igName, pageId } = req.body || {};
    if (!igUserId || !pageId) return res.status(400).json({ error: 'igUserId and pageId required' });

    const conn = getInstagramUserConn(req.user.userId);
    if (!conn) return res.status(400).json({ error: 'Instagram not connected' });

    try {
      const fbToken = await refreshInstagramTokenIfNeeded(req.user.userId);
      const pageToken = await getPageAccessToken(pageId, fbToken);
      linkInstagramSite(siteId, { igUserId, igUsername, igName, pageId, pageAccessToken: pageToken });
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'DELETE') {
    unlinkInstagramSite(siteId);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
});
