import { withAuth } from '@/lib/withAuth';
import { getLinkedinUserConn, isLinkedinConfigured } from '@/lib/linkedin-organic';

export default withAuth(function handler(req, res) {
  const conn = getLinkedinUserConn(req.user.userId);
  return res.status(200).json({
    configured: isLinkedinConfigured(),
    connected: !!conn,
    linkedinName: conn?.linkedin_name || null,
    connectedAt: conn?.connected_at || null,
  });
});
