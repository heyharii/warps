import { withAuth } from '@/lib/withAuth';
import { getUserConnection } from '@/lib/gsc';

// GA4 uses the same Google OAuth as GSC. If the user has a Google connection
// AND the analytics.readonly scope was granted (always true for new connects
// after Migration 14), GA4 is usable.
export default withAuth(function handler(req, res) {
  const conn = getUserConnection(req.user.userId);
  if (!conn) return res.status(200).json({ connected: false });
  return res.status(200).json({
    connected: true,
    email: conn.google_email,
    connectedAt: conn.connected_at,
    lastError: conn.last_error,
    note: 'GA4 reuses your Google connection from GSC. If GA4 access fails, reconnect Google to grant the analytics scope.',
  });
});
