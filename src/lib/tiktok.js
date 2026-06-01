import { getDb } from './db';
import { encrypt, decrypt } from './crypto';

function addSeconds(seconds) {
  return new Date(Date.now() + seconds * 1000).toISOString();
}
function minutesLeft(isoDate) {
  return Math.floor((new Date(isoDate).getTime() - Date.now()) / 60000);
}

const TT_AUTH  = 'https://www.tiktok.com/v2/auth/authorize/';
const TT_TOKEN = 'https://open.tiktokapis.com/v2/oauth/token/';
const TT_API   = 'https://open.tiktokapis.com/v2';

const SCOPES = [
  'user.info.basic',
  'user.info.profile',
  'user.info.stats',
  'video.list',
].join(',');

// ───── App credentials (stored encrypted in app_settings) ─────

export function getTiktokCredentials() {
  const db = getDb();
  const rows = db.prepare(
    "SELECT key, value FROM app_settings WHERE key IN ('tt_client_id','tt_client_secret')"
  ).all();
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    clientId:     map.tt_client_id     ? decrypt(map.tt_client_id)     : null,
    clientSecret: map.tt_client_secret ? decrypt(map.tt_client_secret) : null,
  };
}

export function saveTiktokCredentials({ clientId, clientSecret }) {
  const db = getDb();
  const up = db.prepare(`
    INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `);
  up.run('tt_client_id',     encrypt(clientId));
  up.run('tt_client_secret', encrypt(clientSecret));
}

export function clearTiktokCredentials() {
  const db = getDb();
  db.prepare("DELETE FROM app_settings WHERE key IN ('tt_client_id','tt_client_secret')").run();
}

export function isTiktokConfigured() {
  const { clientId, clientSecret } = getTiktokCredentials();
  return !!(clientId && clientSecret);
}

// ───── OAuth ─────

export function getTiktokRedirectUri(req) {
  const proto = (req.headers['x-forwarded-proto'] || (req.socket?.encrypted ? 'https' : 'http')).split(',')[0].trim();
  const host  = (req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000').split(',')[0].trim();
  return `${proto}://${host}/api/auth/tiktok/callback`;
}

export function buildTiktokAuthUrl({ clientId, redirectUri, state }) {
  return (
    TT_AUTH +
    `?client_key=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${state}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(SCOPES)}`
  );
}

export async function exchangeTiktokCode({ code, redirectUri }) {
  const { clientId, clientSecret } = getTiktokCredentials();
  const res = await fetch(TT_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key:    clientId,
      client_secret: clientSecret,
      code,
      grant_type:    'authorization_code',
      redirect_uri:  redirectUri,
    }).toString(),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(data.message || data.error_description || 'Token exchange failed');
  return data;
}

export async function refreshTiktokToken(refreshToken) {
  const { clientId, clientSecret } = getTiktokCredentials();
  const res = await fetch(TT_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key:    clientId,
      client_secret: clientSecret,
      grant_type:    'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(data.message || data.error_description || 'Token refresh failed');
  return data;
}

export async function fetchTiktokUserInfo(accessToken) {
  const res = await fetch(
    `${TT_API}/user/info/?fields=open_id,display_name,avatar_url,union_id,username`,
    { method: 'GET', headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await res.json();
  if (!data.data?.user) throw new Error(data.message || 'Could not fetch TikTok user info');
  return data.data.user;
}

// ───── User connection (DB) ─────

export function getTiktokUserConn(userId) {
  const db = getDb();
  return db.prepare('SELECT * FROM tiktok_connections WHERE user_id = ?').get(userId);
}

export function saveTiktokUserConn({ userId, openId, accessToken, refreshToken, tiktokName, tiktokUsername, expiresIn }) {
  const db = getDb();
  const expiresAt = addSeconds(expiresIn || 86400);
  db.prepare(`
    INSERT INTO tiktok_connections
      (user_id, open_id, access_token, refresh_token, token_expires_at, tiktok_name, tiktok_username, connected_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      open_id          = excluded.open_id,
      access_token     = excluded.access_token,
      refresh_token    = excluded.refresh_token,
      token_expires_at = excluded.token_expires_at,
      tiktok_name      = excluded.tiktok_name,
      tiktok_username  = excluded.tiktok_username
  `).run(userId, openId, encrypt(accessToken), encrypt(refreshToken), expiresAt, tiktokName, tiktokUsername);
}

export function deleteTiktokUserConn(userId) {
  const db = getDb();
  const siteIds = db.prepare('SELECT id FROM sites WHERE user_id = ?').all(userId).map((r) => r.id);
  const tx = db.transaction(() => {
    for (const sid of siteIds) {
      db.prepare('DELETE FROM tiktok_site_links WHERE site_id = ?').run(sid);
      db.prepare('DELETE FROM tiktok_daily WHERE site_id = ?').run(sid);
    }
    db.prepare('DELETE FROM tiktok_connections WHERE user_id = ?').run(userId);
  });
  tx();
}

export function getTiktokDecryptedTokens(conn) {
  return {
    accessToken:  conn?.access_token  ? decrypt(conn.access_token)  : null,
    refreshToken: conn?.refresh_token ? decrypt(conn.refresh_token) : null,
  };
}

// Returns a valid access token, refreshing if expired
export async function getValidTiktokToken(userId) {
  const conn = getTiktokUserConn(userId);
  if (!conn) throw new Error('TikTok not connected');

  const { accessToken, refreshToken } = getTiktokDecryptedTokens(conn);
  if (!accessToken || !refreshToken) throw new Error('No TikTok tokens stored');

  const isExpired = !conn.token_expires_at || minutesLeft(conn.token_expires_at) < 5;

  if (isExpired) {
    const data = await refreshTiktokToken(refreshToken);
    saveTiktokUserConn({
      userId,
      openId:         conn.open_id,
      accessToken:    data.access_token,
      refreshToken:   data.refresh_token || refreshToken,
      tiktokName:     conn.tiktok_name,
      tiktokUsername: conn.tiktok_username,
      expiresIn:      data.expires_in || 86400,
    });
    return data.access_token;
  }

  return accessToken;
}

// ───── Site link (DB) ─────

export function getTiktokSiteLink(siteId) {
  const db = getDb();
  return db.prepare('SELECT * FROM tiktok_site_links WHERE site_id = ?').get(siteId);
}

export function linkTiktokSite(siteId, { openId, tiktokUsername, tiktokName }) {
  const db = getDb();
  db.prepare(`
    INSERT INTO tiktok_site_links (site_id, open_id, tiktok_username, tiktok_name, status, linked_at, last_error)
    VALUES (?, ?, ?, ?, 'active', datetime('now'), NULL)
    ON CONFLICT(site_id) DO UPDATE SET
      open_id         = excluded.open_id,
      tiktok_username = excluded.tiktok_username,
      tiktok_name     = excluded.tiktok_name,
      status          = 'active',
      linked_at       = datetime('now'),
      last_error      = NULL
  `).run(siteId, openId, tiktokUsername, tiktokName);
}

export function unlinkTiktokSite(siteId) {
  const db = getDb();
  db.prepare('DELETE FROM tiktok_site_links WHERE site_id = ?').run(siteId);
  db.prepare('DELETE FROM tiktok_daily WHERE site_id = ?').run(siteId);
}

// ───── Analytics fetch ─────

export async function fetchTiktokAnalytics(accessToken) {
  // User stats (snapshot)
  const userRes = await fetch(
    `${TT_API}/user/info/?fields=follower_count,following_count,likes_count,video_count`,
    { method: 'GET', headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const userData = await userRes.json();
  const userStats = userData?.data?.user || {};

  // Recent video engagement
  let views = 0, videoLikes = 0, videoComments = 0, videoShares = 0;
  try {
    const listRes = await fetch(`${TT_API}/video/list/?fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ max_count: 20 }),
    });
    const listData = await listRes.json();
    const videos = listData?.data?.videos || [];

    if (videos.length > 0) {
      const videoIds = videos.map((v) => v.id);
      const queryRes = await fetch(
        `${TT_API}/video/query/?fields=id,like_count,comment_count,share_count,view_count`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ filters: { video_ids: videoIds } }),
        }
      );
      const queryData = await queryRes.json();
      for (const v of (queryData?.data?.videos || [])) {
        views         += v.view_count    || 0;
        videoLikes    += v.like_count    || 0;
        videoComments += v.comment_count || 0;
        videoShares   += v.share_count   || 0;
      }
    }
  } catch {
    // Video query is best-effort
  }

  return {
    followers:     userStats.follower_count  || 0,
    following:     userStats.following_count || 0,
    total_likes:   userStats.likes_count     || 0,
    video_count:   userStats.video_count     || 0,
    views,
    video_likes:    videoLikes,
    video_comments: videoComments,
    video_shares:   videoShares,
  };
}

// ───── DB reads ─────

export function getTiktokDailyRows(siteId, { startDate, endDate }) {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM tiktok_daily WHERE site_id = ? AND date >= ? AND date <= ? ORDER BY date ASC'
  ).all(siteId, startDate, endDate);
}

export function getTiktokSummary(siteId, { startDate, endDate }) {
  const db = getDb();
  return db.prepare(`
    SELECT
      MAX(followers)      AS latest_followers,
      MAX(total_likes)    AS latest_total_likes,
      MAX(video_count)    AS latest_video_count,
      SUM(views)          AS total_views,
      SUM(video_likes)    AS total_video_likes,
      SUM(video_comments) AS total_video_comments,
      SUM(video_shares)   AS total_video_shares
    FROM tiktok_daily
    WHERE site_id = ? AND date >= ? AND date <= ?
  `).get(siteId, startDate, endDate);
}
