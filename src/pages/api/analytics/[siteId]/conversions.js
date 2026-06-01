import { getDb } from '@/lib/db';
import { withAuth } from '@/lib/withAuth';
import { parseDateRange, verifySiteOwnership } from '@/lib/analytics';

export default withAuth(function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { siteId, search, page = '1', limit = '25' } = req.query;
  const site = verifySiteOwnership(siteId, req.user.userId);
  if (!site) return res.status(404).json({ error: 'Site not found' });

  const db = getDb();
  const range = parseDateRange(req.query);
  const dateEnd = range.to + ' 23:59:59';
  const pageNum = Math.max(1, parseInt(page));
  const pageSize = Math.min(100, Math.max(1, parseInt(limit)));
  const offset = (pageNum - 1) * pageSize;

  // Build WHERE clause for optional search filter
  let searchClause = '';
  const baseParams = [siteId, range.from, dateEnd];
  const searchParams = [];

  if (search) {
    searchClause = `AND (
      c.stripe_customer_email LIKE ?
      OR c.visitor_id LIKE ?
      OR c.referrer_domain LIKE ?
      OR c.utm_source LIKE ?
    )`;
    const pattern = `%${search}%`;
    searchParams.push(pattern, pattern, pattern, pattern);
  }

  // Total count for pagination
  const totalRow = db
    .prepare(
      `SELECT COUNT(*) as total
       FROM conversions c
       WHERE c.site_id = ? AND c.status = 'completed'
       AND datetime(c.created_at) BETWEEN ? AND ?
       ${searchClause}`
    )
    .get(...baseParams, ...searchParams);

  // Main query: conversions joined with session data
  const conversions = db
    .prepare(
      `SELECT
        c.id,
        c.visitor_id,
        c.session_id,
        c.stripe_customer_email,
        c.amount,
        c.currency,
        c.status,
        c.utm_source,
        c.utm_medium,
        c.utm_campaign,
        c.referrer_domain,
        c.created_at,
        s.country,
        s.city,
        s.browser,
        s.os,
        s.device_type,
        s.entry_page,
        s.exit_page,
        s.page_count,
        s.duration as session_duration
       FROM conversions c
       LEFT JOIN sessions s ON c.session_id = s.id
       WHERE c.site_id = ? AND c.status = 'completed'
       AND datetime(c.created_at) BETWEEN ? AND ?
       ${searchClause}
       ORDER BY c.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(...baseParams, ...searchParams, pageSize, offset);

  // Prepare statements for enrichment
  const firstSessionStmt = db.prepare(
    `SELECT started_at FROM sessions
     WHERE site_id = ? AND visitor_id = ?
     ORDER BY started_at ASC LIMIT 1`
  );

  const pageJourneyStmt = db.prepare(
    `SELECT pathname, timestamp FROM page_views
     WHERE site_id = ? AND visitor_id = ?
     ORDER BY timestamp ASC
     LIMIT 20`
  );

  // Fallback: find session data by visitor_id when session_id JOIN returned nulls
  const visitorSessionStmt = db.prepare(
    `SELECT country, city, browser, os, device_type, entry_page, exit_page, page_count, duration
     FROM sessions
     WHERE site_id = ? AND visitor_id = ?
     ORDER BY started_at DESC LIMIT 1`
  );

  // Enrich each conversion with time-to-complete and page journey
  const enriched = conversions.map((conv) => {
    let timeToComplete = null;
    let journey = [];

    // If LEFT JOIN returned no session data, try finding by visitor_id
    if (!conv.country && !conv.browser && conv.visitor_id) {
      const fallbackSession = visitorSessionStmt.get(siteId, conv.visitor_id);
      if (fallbackSession) {
        conv = { ...conv, ...fallbackSession, session_duration: fallbackSession.duration };
      }
    }

    if (conv.visitor_id) {
      const firstSession = firstSessionStmt.get(siteId, conv.visitor_id);
      if (firstSession) {
        timeToComplete = Math.round(
          (new Date(conv.created_at).getTime() -
            new Date(firstSession.started_at).getTime()) /
            1000
        );
      }

      journey = pageJourneyStmt.all(siteId, conv.visitor_id);
    }

    return { ...conv, timeToComplete, journey };
  });

  // ── Summary KPIs across the full date range (not just current page) ──
  const summaryRow = db.prepare(
    `SELECT
       COUNT(*) AS total_conversions,
       COALESCE(SUM(amount), 0) AS total_revenue,
       COALESCE(AVG(amount), 0) AS avg_order_value
     FROM conversions
     WHERE site_id = ? AND status = 'completed'
     AND datetime(created_at) BETWEEN ? AND ?`
  ).get(siteId, range.from, dateEnd);

  const refundRow = db.prepare(
    `SELECT
       COUNT(*) AS refunds,
       COALESCE(SUM(amount), 0) AS refund_revenue
     FROM conversions
     WHERE site_id = ? AND status = 'refunded'
     AND datetime(created_at) BETWEEN ? AND ?`
  ).get(siteId, range.from, dateEnd);

  const sessionsRow = db.prepare(
    `SELECT COUNT(*) AS total_sessions
     FROM sessions
     WHERE site_id = ? AND datetime(started_at) BETWEEN ? AND ?`
  ).get(siteId, range.from, dateEnd);

  // Average time-to-complete: convertedAt - firstSession.startedAt for each converted visitor
  const avgTimeRow = db.prepare(
    `SELECT AVG(
       (julianday(c.created_at) - julianday(
         (SELECT MIN(s.started_at) FROM sessions s
          WHERE s.site_id = c.site_id AND s.visitor_id = c.visitor_id)
       )) * 86400
     ) AS avg_seconds
     FROM conversions c
     WHERE c.site_id = ? AND c.status = 'completed'
     AND c.visitor_id IS NOT NULL
     AND datetime(c.created_at) BETWEEN ? AND ?`
  ).get(siteId, range.from, dateEnd);

  // Daily time-series of conversions and revenue
  const daily = db.prepare(
    `SELECT
       date(created_at) AS date,
       COUNT(*) AS conversions,
       COALESCE(SUM(amount), 0) AS revenue
     FROM conversions
     WHERE site_id = ? AND status = 'completed'
     AND datetime(created_at) BETWEEN ? AND ?
     GROUP BY date(created_at)
     ORDER BY date ASC`
  ).all(siteId, range.from, dateEnd);

  // Top sources by revenue
  const topSources = db.prepare(
    `SELECT
       COALESCE(NULLIF(utm_source, ''), NULLIF(referrer_domain, ''), 'Direct') AS source,
       COUNT(*) AS conversions,
       COALESCE(SUM(amount), 0) AS revenue
     FROM conversions
     WHERE site_id = ? AND status = 'completed'
     AND datetime(created_at) BETWEEN ? AND ?
     GROUP BY source
     ORDER BY revenue DESC
     LIMIT 8`
  ).all(siteId, range.from, dateEnd);

  const totalConversions = summaryRow.total_conversions || 0;
  const totalSessions = sessionsRow.total_sessions || 0;

  res.status(200).json({
    site: { id: site.id, name: site.name, domain: site.domain },
    summary: {
      totalConversions,
      totalRevenue: summaryRow.total_revenue || 0,
      avgOrderValue: summaryRow.avg_order_value || 0,
      refunds: refundRow.refunds || 0,
      refundRevenue: refundRow.refund_revenue || 0,
      totalSessions,
      conversionRate: totalSessions > 0 ? totalConversions / totalSessions : 0,
      avgTimeToComplete: Math.round(avgTimeRow?.avg_seconds || 0),
    },
    daily,
    topSources,
    conversions: enriched,
    pagination: {
      page: pageNum,
      limit: pageSize,
      total: totalRow.total,
      totalPages: Math.ceil(totalRow.total / pageSize),
    },
  });
});
