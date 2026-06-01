import { getDb } from './db';
import {
  getTiktokSiteLink,
  getTiktokUserConn,
  getValidTiktokToken,
  fetchTiktokAnalytics,
  isTiktokConfigured,
} from './tiktok';

function today() { return new Date().toISOString().slice(0, 10); }

export async function syncTiktokSite(siteId, { backfill = false } = {}) {
  const db = getDb();
  const link = getTiktokSiteLink(siteId);
  if (!link) return { skipped: true };

  const site = db.prepare('SELECT user_id FROM sites WHERE id = ?').get(siteId);
  if (!site) return { skipped: true };

  const userConn = getTiktokUserConn(site.user_id);
  if (!userConn) {
    db.prepare("UPDATE tiktok_site_links SET status='error', last_error=? WHERE site_id=?")
      .run('User TikTok not connected', siteId);
    return { error: 'no user connection' };
  }

  let accessToken;
  try {
    accessToken = await getValidTiktokToken(site.user_id);
  } catch (err) {
    db.prepare("UPDATE tiktok_site_links SET status='error', last_error=? WHERE site_id=?")
      .run(err.message, siteId);
    return { error: err.message };
  }

  let stats;
  try {
    stats = await fetchTiktokAnalytics(accessToken);
  } catch (err) {
    db.prepare("UPDATE tiktok_site_links SET status='error', last_error=? WHERE site_id=?")
      .run(err.message, siteId);
    return { error: err.message };
  }

  const date = today();
  db.prepare(`
    INSERT INTO tiktok_daily
      (site_id, date, followers, following, total_likes, video_count, views, video_likes, video_comments, video_shares)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(site_id, date) DO UPDATE SET
      followers      = excluded.followers,
      following      = excluded.following,
      total_likes    = excluded.total_likes,
      video_count    = excluded.video_count,
      views          = excluded.views,
      video_likes    = excluded.video_likes,
      video_comments = excluded.video_comments,
      video_shares   = excluded.video_shares
  `).run(
    siteId, date,
    stats.followers, stats.following, stats.total_likes, stats.video_count,
    stats.views, stats.video_likes, stats.video_comments, stats.video_shares,
  );

  db.prepare("DELETE FROM tiktok_daily WHERE site_id = ? AND date < date('now','-90 days')").run(siteId);
  db.prepare("UPDATE tiktok_site_links SET status='active', last_sync_at=datetime('now'), last_error=NULL WHERE site_id=?").run(siteId);
  return { rows: 1 };
}

export async function syncAllTiktok() {
  if (!isTiktokConfigured()) return { skipped: 'not configured' };
  const db = getDb();
  const links = db.prepare('SELECT site_id, last_sync_at FROM tiktok_site_links').all();
  const results = [];
  for (const c of links) {
    if (c.last_sync_at) {
      const last = new Date(c.last_sync_at + 'Z').getTime();
      if (Date.now() - last < 12 * 60 * 60 * 1000) continue;
    }
    try {
      const r = await syncTiktokSite(c.site_id, { backfill: !c.last_sync_at });
      results.push({ siteId: c.site_id, ...r });
    } catch (err) {
      results.push({ siteId: c.site_id, error: err.message });
    }
  }
  return { synced: results.length, results };
}
