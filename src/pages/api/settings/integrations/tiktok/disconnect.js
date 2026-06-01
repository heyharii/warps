import { withAuth } from '@/lib/withAuth';
import { deleteTiktokUserConn } from '@/lib/tiktok';

export default withAuth(function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  deleteTiktokUserConn(req.user.userId);
  return res.status(200).json({ ok: true });
});
