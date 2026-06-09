import { withAuth } from '@/lib/withAuth';
import { getDb } from '@/lib/db';
import { getGoogleAdsUserConn, getGoogleAdsDecryptedToken, refreshGoogleAdsToken, listGoogleAdsAccounts, getGoogleAdsDeveloperToken } from '@/lib/google-ads';

export default withAuth(async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const { id: siteId } = req.query;
  const db = getDb();
  const site = db.prepare('SELECT id FROM sites WHERE id = ?').get(siteId);
  if (!site) return res.status(404).json({ error: 'Site not found' });

  const conn = getGoogleAdsUserConn(req.user.userId);
  if (!conn) return res.status(400).json({ error: 'Google Ads not connected' });

  const developerToken = getGoogleAdsDeveloperToken();
  if (!developerToken) return res.status(400).json({ error: 'Developer token not configured' });

  try {
    const accessToken = await refreshGoogleAdsToken(getGoogleAdsDecryptedToken(conn));
    const accounts = await listGoogleAdsAccounts({ accessToken, developerToken });
    return res.status(200).json({ accounts });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
