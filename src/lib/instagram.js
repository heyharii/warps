import { getDb } from './db';
import { encrypt, decrypt } from './crypto';

function addSeconds(seconds) {
  return new Date(Date.now() + seconds * 1000).toISOString();
}
function daysFromNow(n) {
  return new Date(Date.now() + n * 86400 * 1000).toISOString();
}
function daysLeft(isoDate) {
  return Math.floor((new Date(isoDate).getTime() - Date.now()) / 86400000);
}
function toUnixSeconds(dateStr) {
  return Math.floor(new Date(dateStr).getTime() / 1000);
}
function fmtDate(d) { return new Date(d).toISOString().slice(0, 10); }

const GRAPH = 'https://graph.facebook.com/v20.0';
const SCOPES = [
  'instagram_basic',
  'pages_show_list',
  'pages_read_engagement',
  'business_management',
  'instagram_manage_insights',
].join(',');

// ───── App credentials (stored encrypted in app_settings) ─────

export function getInstagramCredentials() {
  const db = getDb();
  const rows = db.prepare(
    "SELECT key, value FROM app_settings WHERE key IN ('ig_app_id','ig_app_secret')"
  ).all();
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    appId: map.ig_app_id ? decrypt(map.ig_app_id) : null,
    appSecret: map.ig_app_secret ? decrypt(map.ig_app_secret) : null,
  };
}

export function saveInstagramCredentials({ appId, appSecret }) {
  const db = getDb();
  const up = db.prepare(`
    INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `);
  up.run('ig_app_id', encrypt(appId));
  up.run('ig_app_secret', encrypt(appSecret));
}

export function clearInstagramCredentials() {
  const db = getDb();
  db.prepare("DELETE FROM app_settings WHERE key IN ('ig_app_id','ig_app_secret')").run();
}

export function isInstagramConfigured() {
  const { appId, appSecret } = getInstagramCredentials();
  return !!(appId && appSecret);
}

// ───── OAuth ─────

export function getInstagramRedirectUri(req) {
  const proto = (req.headers['x-forwarded-proto'] || (req.socket?.encrypted ? 'https' : 'http')).split(',')[0].trim();
  const host  = (req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000').split(',')[0].trim();
  return `${proto}://${host}/api/auth/instagram/callback`;
}

export function buildInstagramAuthUrl({ appId, redirectUri, state }) {
  return (
    `https://www.facebook.com/v20.0/dialog/oauth` +
    `?client_id=${appId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${state}` +
    `&scope=${encodeURIComponent(SCOPES)}`
  );
}

export async function exchangeInstagramCode({ code, redirectUri }) {
  const { appId, appSecret } = getInstagramCredentials();

  // Step 1: short-lived token
  const shortRes = await fetch(
    `${GRAPH}/oauth/access_token` +
    `?client_id=${appId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&client_secret=${appSecret}` +
    `&code=${code}`
  );
  const short = await shortRes.json();
  if (!short.access_token) throw new Error(short.error?.message || 'Token exchange failed');

  // Step 2: long-lived token (60 days)
  const longRes = await fetch(
    `${GRAPH}/oauth/access_token` +
    `?grant_type=fb_exchange_token` +
    `&client_id=${appId}` +
    `&client_secret=${appSecret}` +
    `&fb_exchange_token=${short.access_token}`
  );
  const long = await longRes.json();
  if (!long.access_token) throw new Error(long.error?.message || 'Long-lived token exchange failed');

  return { access_token: long.access_token, expires_in: long.expires_in || 5184000 };
}

export async function fetchFbUserInfo(accessToken) {
  const res = await fetch(`${GRAPH}/me?fields=id,name&access_token=${accessToken}`);
  return res.json();
}

// Extend a long-lived token before it expires
export async function extendFbToken(accessToken) {
  const { appId, appSecret } = getInstagramCredentials();
  const res = await fetch(
    `${GRAPH}/oauth/access_token` +
    `?grant_type=fb_exchange_token` +
    `&client_id=${appId}` +
    `&client_secret=${appSecret}` +
    `&fb_exchange_token=${accessToken}`
  );
  const data = await res.json();
  if (!data.access_token) throw new Error(data.error?.message || 'Token extension failed');
  return data;
}

// ───── User connection (DB) ─────

export function getInstagramUserConn(userId) {
  const db = getDb();
  return db.prepare('SELECT * FROM instagram_connections WHERE user_id = ?').get(userId);
}

export function saveInstagramUserConn({ userId, fbUserId, fbAccessToken, fbName, expiresIn }) {
  const db = getDb();
  const expiresAt = addSeconds(expiresIn);
  db.prepare(`
    INSERT INTO instagram_connections (user_id, fb_user_id, fb_access_token, fb_name, token_expires_at, connected_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      fb_user_id = excluded.fb_user_id,
      fb_access_token = excluded.fb_access_token,
      fb_name = excluded.fb_name,
      token_expires_at = excluded.token_expires_at
  `).run(userId, fbUserId, encrypt(fbAccessToken), fbName, expiresAt);
}

export function deleteInstagramUserConn(userId) {
  const db = getDb();
  const siteIds = db.prepare('SELECT id FROM sites WHERE user_id = ?').all(userId).map((r) => r.id);
  const tx = db.transaction(() => {
    for (const sid of siteIds) {
      db.prepare('DELETE FROM instagram_site_links WHERE site_id = ?').run(sid);
      db.prepare('DELETE FROM instagram_daily WHERE site_id = ?').run(sid);
    }
    db.prepare('DELETE FROM instagram_connections WHERE user_id = ?').run(userId);
  });
  tx();
}

export function getInstagramDecryptedToken(conn) {
  return conn?.fb_access_token ? decrypt(conn.fb_access_token) : null;
}

// Refresh the stored token if it's within 15 days of expiry
export async function refreshInstagramTokenIfNeeded(userId) {
  const conn = getInstagramUserConn(userId);
  if (!conn) throw new Error('Instagram not connected');

  const remaining = conn.token_expires_at ? daysLeft(conn.token_expires_at) : 0;

  const token = getInstagramDecryptedToken(conn);
  if (!token) throw new Error('No Instagram token stored');

  if (!conn.token_expires_at || remaining < 15) {
    const data = await extendFbToken(token);
    saveInstagramUserConn({
      userId,
      fbUserId: conn.fb_user_id,
      fbAccessToken: data.access_token,
      fbName: conn.fb_name,
      expiresIn: data.expires_in || 5184000,
    });
    return data.access_token;
  }

  return token;
}

// ───── Facebook pages + Instagram accounts ─────

export async function listInstagramAccounts(fbAccessToken) {
  const res = await fetch(
    `${GRAPH}/me/accounts` +
    `?fields=id,name,instagram_business_account,picture.type(large)` +
    `&limit=100` +
    `&access_token=${fbAccessToken}`
  );
  const data = await res.json();
  if (!data.data) throw new Error(data.error?.message || 'Could not fetch Facebook pages');

  const accounts = [];
  for (const page of data.data) {
    if (!page.instagram_business_account) continue;
    const igId = page.instagram_business_account.id;
    const igRes = await fetch(
      `${GRAPH}/${igId}?fields=username,name,profile_picture_url&access_token=${fbAccessToken}`
    );
    const ig = await igRes.json();
    accounts.push({
      igUserId:   igId,
      igUsername: ig.username || '',
      igName:     ig.name || page.name,
      igPicture:  ig.profile_picture_url || '',
      pageId:     page.id,
      pageName:   page.name,
    });
  }
  return accounts;
}

export async function getPageAccessToken(pageId, fbAccessToken) {
  const res = await fetch(`${GRAPH}/${pageId}?fields=access_token&access_token=${fbAccessToken}`);
  const data = await res.json();
  if (!data.access_token) throw new Error(data.error?.message || 'Could not get page access token');
  return data.access_token;
}

// ───── Site link (DB) ─────

export function getInstagramSiteLink(siteId) {
  const db = getDb();
  return db.prepare('SELECT * FROM instagram_site_links WHERE site_id = ?').get(siteId);
}

export function linkInstagramSite(siteId, { igUserId, igUsername, igName, pageId, pageAccessToken }) {
  const db = getDb();
  db.prepare(`
    INSERT INTO instagram_site_links
      (site_id, ig_user_id, ig_username, ig_name, page_id, page_access_token, status, linked_at, last_error)
    VALUES (?, ?, ?, ?, ?, ?, 'active', datetime('now'), NULL)
    ON CONFLICT(site_id) DO UPDATE SET
      ig_user_id = excluded.ig_user_id,
      ig_username = excluded.ig_username,
      ig_name = excluded.ig_name,
      page_id = excluded.page_id,
      page_access_token = excluded.page_access_token,
      status = 'active',
      linked_at = datetime('now'),
      last_error = NULL
  `).run(siteId, igUserId, igUsername, igName, pageId, encrypt(pageAccessToken));
}

export function unlinkInstagramSite(siteId) {
  const db = getDb();
  db.prepare('DELETE FROM instagram_site_links WHERE site_id = ?').run(siteId);
  db.prepare('DELETE FROM instagram_daily WHERE site_id = ?').run(siteId);
}

export function getInstagramDecryptedPageToken(link) {
  return link?.page_access_token ? decrypt(link.page_access_token) : null;
}

// ───── Analytics fetch ─────

export async function fetchInstagramInsights({ igUserId, pageAccessToken, startDate, endDate }) {
  // Daily follower count + reach
  const since = toUnixSeconds(startDate);
  const until = toUnixSeconds(fmtDate(new Date(new Date(endDate).getTime() + 86400000)));

  const dailyRes = await fetch(
    `${GRAPH}/${igUserId}/insights` +
    `?metric=follower_count,reach,impressions` +
    `&period=day` +
    `&since=${since}` +
    `&until=${until}` +
    `&access_token=${pageAccessToken}`
  );
  const dailyData = await dailyRes.json();

  // Aggregate lifetime metrics snapshot
  const lifetimeRes = await fetch(
    `${GRAPH.replace('v20.0', 'v21.0')}/${igUserId}/insights` +
    `?metric_type=total_value` +
    `&metric=likes,comments,shares,saves` +
    `&period=day` +
    `&since=${since}` +
    `&until=${until}` +
    `&access_token=${pageAccessToken}`
  );
  const lifetimeData = await lifetimeRes.json();

  // Build per-date map
  const byDate = {};

  if (dailyData.data) {
    for (const metric of dailyData.data) {
      for (const point of (metric.values || [])) {
        const date = fmtDate(new Date(new Date(point.end_time).getTime() - 86400000));
        if (!byDate[date]) byDate[date] = { date, followers: 0, reach: 0, impressions: 0, likes: 0, comments: 0, shares: 0, saves: 0 };
        if (metric.name === 'follower_count') byDate[date].followers = point.value || 0;
        if (metric.name === 'reach')          byDate[date].reach     = point.value || 0;
        if (metric.name === 'impressions')    byDate[date].impressions = point.value || 0;
      }
    }
  }

  // Lifetime metrics: attach to today's date
  if (lifetimeData.data) {
    const today = new Date().toISOString().slice(0, 10);
    if (!byDate[today]) byDate[today] = { date: today, followers: 0, reach: 0, impressions: 0, likes: 0, comments: 0, shares: 0, saves: 0 };
    for (const metric of lifetimeData.data) {
      const v = metric.total_value?.value || 0;
      if (metric.name === 'likes')    byDate[today].likes    = v;
      if (metric.name === 'comments') byDate[today].comments = v;
      if (metric.name === 'shares')   byDate[today].shares   = v;
      if (metric.name === 'saves')    byDate[today].saves    = v;
    }
  }

  return Object.values(byDate).filter((r) => r.date >= startDate && r.date <= endDate);
}

// ───── DB reads ─────

export function getInstagramDailyRows(siteId, { startDate, endDate }) {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM instagram_daily WHERE site_id = ? AND date >= ? AND date <= ? ORDER BY date ASC'
  ).all(siteId, startDate, endDate);
}

export function getInstagramSummary(siteId, { startDate, endDate }) {
  const db = getDb();
  return db.prepare(`
    SELECT
      SUM(reach)       AS total_reach,
      SUM(impressions) AS total_impressions,
      SUM(likes)       AS total_likes,
      SUM(comments)    AS total_comments,
      SUM(shares)      AS total_shares,
      SUM(saves)       AS total_saves,
      MAX(followers)   AS latest_followers
    FROM instagram_daily
    WHERE site_id = ? AND date >= ? AND date <= ?
  `).get(siteId, startDate, endDate);
}
