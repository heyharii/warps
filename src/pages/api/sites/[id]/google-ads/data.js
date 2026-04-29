import { withAuth } from '@/lib/withAuth';
import { getDb } from '@/lib/db';
import { getGoogleAdsUserConn, getGoogleAdsSiteLink, getGoogleAdsDailyRows, getGoogleAdsSummary } from '@/lib/google-ads';
import { syncGoogleAdsSite } from '@/lib/google-ads-sync';

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
  const { id: siteId, period = '30d' } = req.query;

  const db = getDb();
  const site = db.prepare('SELECT * FROM sites WHERE id = ? AND user_id = ?').get(siteId, req.user.userId);
  if (!site) return res.status(404).json({ error: 'Site not found' });

  const adsConnected = !!getGoogleAdsUserConn(req.user.userId);
  const link = getGoogleAdsSiteLink(siteId);

  if (!adsConnected) return res.status(200).json({ adsConnected: false, linked: false });
  if (!link) return res.status(200).json({ adsConnected: true, linked: false });

  // Trigger sync if stale
  if (!link.last_sync_at || Date.now() - new Date(link.last_sync_at + 'Z').getTime() > 6 * 60 * 60 * 1000) {
    await syncGoogleAdsSite(siteId, { backfill: !link.last_sync_at }).catch(() => {});
  }

  const { startDate, endDate } = dateRange(period);
  const daily    = getGoogleAdsDailyRows(siteId, { startDate, endDate });
  const summary  = getGoogleAdsSummary(siteId, { startDate, endDate });
  const freshLink = getGoogleAdsSiteLink(siteId);

  return res.status(200).json({
    adsConnected: true,
    linked: true,
    accountName: freshLink?.account_name,
    status: freshLink?.status,
    lastError: freshLink?.last_error,
    summary,
    daily,
  });
});
