import { withAuth } from '@/lib/withAuth';
import { getDb } from '@/lib/db';
import { getUserConnection, getDecryptedRefreshToken, refreshAccessToken } from '@/lib/gsc';
import { listGa4Properties } from '@/lib/ga4';

export default withAuth(async function handler(req, res) {
  const { id } = req.query;
  const db = getDb();
  const site = db.prepare('SELECT id, domain FROM sites WHERE id = ? AND user_id = ?').get(id, req.user.userId);
  if (!site) return res.status(404).json({ error: 'Site not found' });

  const conn = getUserConnection(req.user.userId);
  if (!conn) return res.status(400).json({ error: 'Google account not connected. Connect it in Settings → Integrations.' });

  try {
    const accessToken = await refreshAccessToken(getDecryptedRefreshToken(conn));
    const properties = await listGa4Properties(accessToken);
    return res.status(200).json({ properties, siteDomain: site.domain });
  } catch (err) {
    const msg = err.message || String(err);
    const needsReauth = /insufficient|scope|invalid_grant|403/i.test(msg);
    return res.status(500).json({
      error: msg,
      needsReauth,
      hint: needsReauth ? 'Reconnect Google in Settings → Integrations to grant the analytics.readonly scope.' : undefined,
    });
  }
});
