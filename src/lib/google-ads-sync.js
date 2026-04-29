import { getDb } from './db';
import {
  getGoogleAdsSiteLink, getGoogleAdsUserConn, getGoogleAdsDecryptedToken,
  refreshGoogleAdsToken, fetchGoogleAdsDailyStats, getGoogleAdsDeveloperToken,
  isGoogleAdsConfigured,
} from './google-ads';

function fmtDate(d) { return d.toISOString().slice(0, 10); }
function daysAgo(n) { const d = new Date(); d.setUTCDate(d.getUTCDate() - n); return d; }

export async function syncGoogleAdsSite(siteId, { backfill = false } = {}) {
  const db = getDb();
  const link = getGoogleAdsSiteLink(siteId);
  if (!link) return { skipped: true };

  const site = db.prepare('SELECT user_id FROM sites WHERE id = ?').get(siteId);
  if (!site) return { skipped: true };

  const userConn = getGoogleAdsUserConn(site.user_id);
  if (!userConn) {
    db.prepare("UPDATE google_ads_site_links SET status='error', last_error=? WHERE site_id=?").run('User Google Ads not connected', siteId);
    return { error: 'no user connection' };
  }

  const developerToken = getGoogleAdsDeveloperToken();
  if (!developerToken) {
    db.prepare("UPDATE google_ads_site_links SET status='error', last_error=? WHERE site_id=?").run('Developer token not configured', siteId);
    return { error: 'no developer token' };
  }

  let accessToken;
  try {
    accessToken = await refreshGoogleAdsToken(getGoogleAdsDecryptedToken(userConn));
  } catch (err) {
    db.prepare("UPDATE google_ads_site_links SET status='error', last_error=? WHERE site_id=?").run(err.message, siteId);
    return { error: err.message };
  }

  const endDate   = fmtDate(daysAgo(1));
  const startDate = backfill ? fmtDate(daysAgo(90)) : fmtDate(daysAgo(7));

  let rows;
  try {
    rows = await fetchGoogleAdsDailyStats({ accessToken, developerToken, customerId: link.customer_id, startDate, endDate });
  } catch (err) {
    db.prepare("UPDATE google_ads_site_links SET status='error', last_error=? WHERE site_id=?").run(err.message, siteId);
    return { error: err.message };
  }

  const upsert = db.prepare(`
    INSERT INTO google_ads_daily (site_id, date, impressions, clicks, ctr, conversions, conversion_rate, cost_micros, page_views)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(site_id, date) DO UPDATE SET
      impressions = excluded.impressions, clicks = excluded.clicks, ctr = excluded.ctr,
      conversions = excluded.conversions, conversion_rate = excluded.conversion_rate,
      cost_micros = excluded.cost_micros, page_views = excluded.page_views
  `);

  const tx = db.transaction(() => {
    for (const r of rows) {
      upsert.run(siteId, r.date, r.impressions, r.clicks, r.ctr, r.conversions, r.conversion_rate, r.cost_micros, r.page_views);
    }
  });
  tx();

  db.prepare("DELETE FROM google_ads_daily WHERE site_id = ? AND date < date('now','-90 days')").run(siteId);
  db.prepare("UPDATE google_ads_site_links SET status='active', last_sync_at=datetime('now'), last_error=NULL WHERE site_id=?").run(siteId);
  return { rows: rows.length };
}

export async function syncAllGoogleAds() {
  if (!isGoogleAdsConfigured()) return { skipped: 'not configured' };
  const db = getDb();
  const links = db.prepare('SELECT site_id, last_sync_at FROM google_ads_site_links').all();
  const results = [];
  for (const c of links) {
    if (c.last_sync_at) {
      const last = new Date(c.last_sync_at + 'Z').getTime();
      if (Date.now() - last < 12 * 60 * 60 * 1000) continue;
    }
    try {
      const r = await syncGoogleAdsSite(c.site_id, { backfill: !c.last_sync_at });
      results.push({ siteId: c.site_id, ...r });
    } catch (err) {
      results.push({ siteId: c.site_id, error: err.message });
    }
  }
  return { synced: results.length, results };
}
