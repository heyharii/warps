import { withAuth } from '@/lib/withAuth';
import { getDb } from '@/lib/db';
import { getApolloConnection, getDecryptedApiKey, getApolloDailyTotals, getApolloSummary } from '@/lib/apollo';
import { syncApolloSite } from '@/lib/apollo-sync';

function dateRange(period) {
  const now = new Date();
  const end = now.toISOString().slice(0, 10);
  const map = { '24h': 1, '7d': 7, '30d': 30, '90d': 90, '12m': 365 };
  const days = map[period] || 30;
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - days);
  return { startDate: start.toISOString().slice(0, 10), endDate: end };
}

export default withAuth(async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const { id: siteId } = req.query;
  const { period = '30d' } = req.query;

  const db = getDb();
  const site = db.prepare('SELECT * FROM sites WHERE id = ?').get(siteId);
  if (!site) return res.status(404).json({ error: 'Site not found' });

  const conn = getApolloConnection(siteId);
  if (!conn) return res.status(200).json({ connected: false });

  // Trigger a sync if stale (> 1h for Apollo since email activity changes frequently)
  const ONE_HOUR = 60 * 60 * 1000;
  if (!conn.last_sync_at || Date.now() - new Date(conn.last_sync_at + 'Z').getTime() > ONE_HOUR) {
    try {
      await syncApolloSite(siteId, { backfill: !conn.last_sync_at });
    } catch (err) {
      console.error(`[Apollo Sync] Failed for site ${siteId}:`, err.message);
      // Don't fail the request — return cached data
    }
  }

  const { startDate, endDate } = dateRange(period);
  const daily   = getApolloDailyTotals(siteId, { startDate, endDate });
  const summary = getApolloSummary(siteId, { startDate, endDate });

  return res.status(200).json({
    connected: true,
    maskedKey: '••••' + getDecryptedApiKey(conn)?.slice(-4),
    summary,
    daily,
  });
});
