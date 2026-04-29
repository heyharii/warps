import { withAuth } from '@/lib/withAuth';
import { getGoogleAdsUserConn, isGoogleAdsConfigured, getGoogleAdsDeveloperToken } from '@/lib/google-ads';

export default withAuth(function handler(req, res) {
  const conn = getGoogleAdsUserConn(req.user.userId);
  return res.status(200).json({
    configured: isGoogleAdsConfigured(),
    developerTokenSet: !!getGoogleAdsDeveloperToken(),
    connected: !!conn,
    googleEmail: conn?.google_email || null,
    connectedAt: conn?.connected_at || null,
  });
});
