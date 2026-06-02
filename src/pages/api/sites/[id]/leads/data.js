import { withAuth } from '@/lib/withAuth';
import { getDb } from '@/lib/db';
import { getLeadsData, getWebsiteSupabase, isWebsiteSite, websiteDomainConfigured } from '@/lib/website-supabase';

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

  if (!getWebsiteSupabase()) return res.status(200).json({ connected: false });

  // Leads are first-party to the marketing website — only surface them on that site.
  if (websiteDomainConfigured() && !isWebsiteSite(site.domain)) {
    return res.status(200).json({ connected: false, reason: 'not_website_site', websiteDomain: process.env.WEBSITE_SUPABASE_SITE_DOMAIN });
  }

  const { startDate, endDate } = dateRange(period);
  try {
    const data = await getLeadsData({ startDate, endDate });
    return res.status(200).json(data);
  } catch (err) {
    console.error('[Leads] fetch failed:', err.message);
    return res.status(200).json({
      connected: true,
      error: err.message,
      summary: null,
      daily: [],
      funnel: [],
      byType: [],
      bySource: [],
      recent: [],
    });
  }
});
