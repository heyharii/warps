import { getDb } from './db';
import { encrypt } from './crypto';
import {
  getInstagramSiteLink,
  getInstagramUserConn,
  getInstagramDecryptedPageToken,
  refreshInstagramTokenIfNeeded,
  getPageAccessToken,
  fetchInstagramInsights,
  isInstagramConfigured,
} from './instagram';

function fmtDate(d) { return d.toISOString().slice(0, 10); }
function daysAgo(n) { const d = new Date(); d.setUTCDate(d.getUTCDate() - n); return d; }

export async function syncInstagramSite(siteId, { backfill = false } = {}) {
  const db = getDb();
  const link = getInstagramSiteLink(siteId);
  if (!link) return { skipped: true };

  const site = db.prepare('SELECT user_id FROM sites WHERE id = ?').get(siteId);
  if (!site) return { skipped: true };

  const userConn = getInstagramUserConn(site.user_id);
  if (!userConn) {
    db.prepare("UPDATE instagram_site_links SET status='error', last_error=? WHERE site_id=?")
      .run('User Instagram not connected', siteId);
    return { error: 'no user connection' };
  }

  // Refresh user FB token if needed and get a fresh page access token
  let pageToken;
  try {
    const freshFbToken = await refreshInstagramTokenIfNeeded(site.user_id);
    pageToken = await getPageAccessToken(link.page_id, freshFbToken);
    // Persist the refreshed page token
    db.prepare(
      "UPDATE instagram_site_links SET page_access_token=? WHERE site_id=?"
    ).run(encrypt(pageToken), siteId);
  } catch (err) {
    // Fall back to stored page token
    pageToken = getInstagramDecryptedPageToken(link);
    if (!pageToken) {
      db.prepare("UPDATE instagram_site_links SET status='error', last_error=? WHERE site_id=?")
        .run(err.message, siteId);
      return { error: err.message };
    }
  }

  const endDate   = fmtDate(daysAgo(1));
  const startDate = backfill ? fmtDate(daysAgo(90)) : fmtDate(daysAgo(7));

  let rows;
  try {
    rows = await fetchInstagramInsights({ igUserId: link.ig_user_id, pageAccessToken: pageToken, startDate, endDate });
  } catch (err) {
    db.prepare("UPDATE instagram_site_links SET status='error', last_error=? WHERE site_id=?")
      .run(err.message, siteId);
    return { error: err.message };
  }

  const upsert = db.prepare(`
    INSERT INTO instagram_daily (site_id, date, followers, reach, impressions, likes, comments, shares, saves)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(site_id, date) DO UPDATE SET
      followers   = excluded.followers,
      reach       = excluded.reach,
      impressions = excluded.impressions,
      likes       = excluded.likes,
      comments    = excluded.comments,
      shares      = excluded.shares,
      saves       = excluded.saves
  `);

  const tx = db.transaction(() => {
    for (const r of rows) {
      upsert.run(siteId, r.date, r.followers, r.reach, r.impressions, r.likes, r.comments, r.shares, r.saves);
    }
  });
  tx();

  db.prepare("DELETE FROM instagram_daily WHERE site_id = ? AND date < date('now','-90 days')").run(siteId);
  db.prepare("UPDATE instagram_site_links SET status='active', last_sync_at=datetime('now'), last_error=NULL WHERE site_id=?").run(siteId);
  return { rows: rows.length };
}

export async function syncAllInstagram() {
  if (!isInstagramConfigured()) return { skipped: 'not configured' };
  const db = getDb();
  const links = db.prepare('SELECT site_id, last_sync_at FROM instagram_site_links').all();
  const results = [];
  for (const c of links) {
    if (c.last_sync_at) {
      const last = new Date(c.last_sync_at + 'Z').getTime();
      if (Date.now() - last < 12 * 60 * 60 * 1000) continue;
    }
    try {
      const r = await syncInstagramSite(c.site_id, { backfill: !c.last_sync_at });
      results.push({ siteId: c.site_id, ...r });
    } catch (err) {
      results.push({ siteId: c.site_id, error: err.message });
    }
  }
  return { synced: results.length, results };
}
