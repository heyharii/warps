import { withAuth } from '@/lib/withAuth';
import { getInstagramUserConn, isInstagramConfigured } from '@/lib/instagram';

export default withAuth(function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const conn = getInstagramUserConn(req.user.userId);
  return res.status(200).json({
    configured: isInstagramConfigured(),
    connected:  !!conn,
    fbName:     conn?.fb_name || null,
  });
});
