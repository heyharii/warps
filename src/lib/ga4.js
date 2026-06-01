import { getDb } from './db';
import { getUserConnection, getDecryptedRefreshToken, refreshAccessToken, isGscConfigured } from './gsc';

// GA4 reuses the user's Google OAuth from gsc_connections.
// The OAuth scope `analytics.readonly` is granted in gsc.js SCOPES.

const ADMIN_API = 'https://analyticsadmin.googleapis.com/v1beta';
const DATA_API  = 'https://analyticsdata.googleapis.com/v1beta';

export const isGa4Configured = isGscConfigured;

// ───── Admin API: list properties accessible to the user ─────

export async function listGa4Properties(accessToken) {
  const accountsRes = await fetch(`${ADMIN_API}/accountSummaries?pageSize=200`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!accountsRes.ok) throw new Error(`List GA4 accounts failed: ${await accountsRes.text()}`);
  const data = await accountsRes.json();
  const out = [];
  for (const acc of data.accountSummaries || []) {
    for (const prop of acc.propertySummaries || []) {
      out.push({
        propertyId: prop.property.replace('properties/', ''),
        propertyName: prop.displayName,
        accountName: acc.displayName,
      });
    }
  }
  return out;
}

// ───── Data API: runReport ─────

export async function runReport({ accessToken, propertyId, startDate, endDate, dimensions = [], metrics = [], limit = 100000, orderBys, dimensionFilter }) {
  const body = {
    dateRanges: [{ startDate, endDate }],
    dimensions: dimensions.map((name) => ({ name })),
    metrics: metrics.map((name) => ({ name })),
    limit: String(limit),
  };
  if (orderBys) body.orderBys = orderBys;
  if (dimensionFilter) body.dimensionFilter = dimensionFilter;

  const res = await fetch(`${DATA_API}/properties/${propertyId}:runReport`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`GA4 runReport failed: ${await res.text()}`);
  return res.json();
}

// Convert a runReport response into a list of {dim1, dim2, ..., metric1, metric2} objects.
export function rowsFromReport(report) {
  const dimHeaders = (report.dimensionHeaders || []).map((h) => h.name);
  const metHeaders = (report.metricHeaders || []).map((h) => h.name);
  return (report.rows || []).map((row) => {
    const obj = {};
    dimHeaders.forEach((name, i) => { obj[name] = row.dimensionValues?.[i]?.value ?? null; });
    metHeaders.forEach((name, i) => {
      const raw = row.metricValues?.[i]?.value;
      obj[name] = raw == null ? null : (isNaN(+raw) ? raw : +raw);
    });
    return obj;
  });
}

// ───── Per-site link helpers ─────

export function getGa4SiteLink(siteId) {
  return getDb().prepare('SELECT * FROM ga4_site_links WHERE site_id = ?').get(siteId);
}

export function setGa4SiteLink({ siteId, propertyId, propertyName, accountName }) {
  getDb().prepare(`
    INSERT INTO ga4_site_links (site_id, property_id, property_name, account_name, status, linked_at)
    VALUES (?, ?, ?, ?, 'active', datetime('now'))
    ON CONFLICT(site_id) DO UPDATE SET
      property_id = excluded.property_id,
      property_name = excluded.property_name,
      account_name = excluded.account_name,
      status = 'active',
      linked_at = excluded.linked_at,
      last_error = NULL
  `).run(siteId, propertyId, propertyName || null, accountName || null);
}

export function deleteGa4SiteLink(siteId) {
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM ga4_site_links WHERE site_id = ?').run(siteId);
    db.prepare('DELETE FROM ga4_daily WHERE site_id = ?').run(siteId);
  });
  tx();
}

// ───── Convenience: get a usable access token for a site ─────

export async function getGa4AccessTokenForSite(siteId) {
  const db = getDb();
  const site = db.prepare('SELECT user_id FROM sites WHERE id = ?').get(siteId);
  if (!site) throw new Error('Site not found');
  const conn = getUserConnection(site.user_id);
  if (!conn) throw new Error('User Google account not connected');
  return refreshAccessToken(getDecryptedRefreshToken(conn));
}
