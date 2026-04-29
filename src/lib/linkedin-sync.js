import { getDb } from './db';
import {
  getLinkedinSiteLink, getLinkedinUserConn, getLinkedinDecryptedToken,
  refreshLinkedinToken, fetchLinkedinShareStats, fetchLinkedinPageViews,
  isLinkedinConfigured,
} from './linkedin-organic';

function fmtDate(d) { return d.toISOString().slice(0, 10); }
function daysAgo(n) { const d = new Date(); d.setUTCDate(d.getUTCDate() - n); return d; }

export async function syncLinkedinSite(siteId, { backfill = false } = {}) {
  const db = getDb();
  const link = getLinkedinSiteLink(siteId);
  if (!link) return { skipped: true };

  const site = db.prepare('SELECT user_id FROM sites WHERE id = ?').get(siteId);
  if (!site) return { skipped: true };

  const userConn = getLinkedinUserConn(site.user_id);
  if (!userConn) {
    db.prepare("UPDATE linkedin_site_links SET status='error', last_error=? WHERE site_id=?").run('User LinkedIn not connected', siteId);
    return { error: 'no user connection' };
  }

  let accessToken;
  try {
    accessToken = await refreshLinkedinToken(getLinkedinDecryptedToken(userConn));
  } catch (err) {
    db.prepare("UPDATE linkedin_site_links SET status='error', last_error=? WHERE site_id=?").run(err.message, siteId);
    return { error: err.message };
  }

  const endDate   = fmtDate(daysAgo(1));
  const startDate = backfill ? fmtDate(daysAgo(90)) : fmtDate(daysAgo(7));

  let shareRows = [], pageRows = [];
  try {
    [shareRows, pageRows] = await Promise.all([
      fetchLinkedinShareStats({ accessToken, orgUrn: link.org_urn, startDate, endDate }),
      fetchLinkedinPageViews({ accessToken, orgUrn: link.org_urn, startDate, endDate }),
    ]);
  } catch (err) {
    db.prepare("UPDATE linkedin_site_links SET status='error', last_error=? WHERE site_id=?").run(err.message, siteId);
    return { error: err.message };
  }

  // Merge by date
  const byDate = {};
  for (const r of shareRows) {
    byDate[r.date] = { date: r.date, impressions: r.impressions, clicks: r.clicks, ctr: r.ctr, likes: r.likes, comments: r.comments, shares: r.shares, page_views: 0 };
  }
  for (const r of pageRows) {
    if (byDate[r.date]) byDate[r.date].page_views = r.page_views;
    else byDate[r.date] = { date: r.date, impressions: 0, clicks: 0, ctr: 0, likes: 0, comments: 0, shares: 0, page_views: r.page_views };
  }

  const upsert = db.prepare(`
    INSERT INTO linkedin_daily (site_id, date, impressions, clicks, ctr, likes, comments, shares, page_views)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(site_id, date) DO UPDATE SET
      impressions = excluded.impressions, clicks = excluded.clicks, ctr = excluded.ctr,
      likes = excluded.likes, comments = excluded.comments, shares = excluded.shares,
      page_views = excluded.page_views
  `);

  const tx = db.transaction(() => {
    for (const r of Object.values(byDate)) {
      upsert.run(siteId, r.date, r.impressions, r.clicks, r.ctr, r.likes, r.comments, r.shares, r.page_views);
    }
  });
  tx();

  db.prepare("DELETE FROM linkedin_daily WHERE site_id = ? AND date < date('now','-90 days')").run(siteId);
  db.prepare("UPDATE linkedin_site_links SET status='active', last_sync_at=datetime('now'), last_error=NULL WHERE site_id=?").run(siteId);
  return { rows: Object.keys(byDate).length };
}

export async function syncAllLinkedin() {
  if (!isLinkedinConfigured()) return { skipped: 'not configured' };
  const db = getDb();
  const links = db.prepare('SELECT site_id, last_sync_at FROM linkedin_site_links').all();
  const results = [];
  for (const c of links) {
    if (c.last_sync_at) {
      const last = new Date(c.last_sync_at + 'Z').getTime();
      if (Date.now() - last < 12 * 60 * 60 * 1000) continue;
    }
    try {
      const r = await syncLinkedinSite(c.site_id, { backfill: !c.last_sync_at });
      results.push({ siteId: c.site_id, ...r });
    } catch (err) {
      results.push({ siteId: c.site_id, error: err.message });
    }
  }
  return { synced: results.length, results };
}
