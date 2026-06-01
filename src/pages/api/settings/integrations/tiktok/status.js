import { withAuth } from '@/lib/withAuth';
import { getTiktokUserConn, isTiktokConfigured } from '@/lib/tiktok';

export default withAuth(function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const conn = getTiktokUserConn(req.user.userId);
  return res.status(200).json({
    configured:     isTiktokConfigured(),
    connected:      !!conn,
    tiktokName:     conn?.tiktok_name     || null,
    tiktokUsername: conn?.tiktok_username || null,
  });
});
