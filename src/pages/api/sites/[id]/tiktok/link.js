import { withAuth } from '@/lib/withAuth';
import { getDb } from '@/lib/db';
import { getTiktokUserConn, linkTiktokSite, unlinkTiktokSite } from '@/lib/tiktok';

export default withAuth(function handler(req, res) {
  const { id: siteId } = req.query;
  const db = getDb();
  const site = db.prepare('SELECT id FROM sites WHERE id = ?').get(siteId);
  if (!site) return res.status(404).json({ error: 'Site not found' });

  if (req.method === 'POST') {
    const conn = getTiktokUserConn(req.user.userId);
    if (!conn) return res.status(400).json({ error: 'TikTok not connected' });
    linkTiktokSite(siteId, {
      openId:         conn.open_id,
      tiktokUsername: conn.tiktok_username,
      tiktokName:     conn.tiktok_name,
    });
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'DELETE') {
    unlinkTiktokSite(siteId);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
});
