import { withAuth } from '@/lib/withAuth';
import { deleteLinkedinUserConn } from '@/lib/linkedin-organic';

export default withAuth(function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  deleteLinkedinUserConn(req.user.userId);
  return res.status(200).json({ ok: true });
});
