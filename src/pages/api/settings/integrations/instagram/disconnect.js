import { withAuth } from '@/lib/withAuth';
import { deleteInstagramUserConn } from '@/lib/instagram';

export default withAuth(function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  deleteInstagramUserConn(req.user.userId);
  return res.status(200).json({ ok: true });
});
