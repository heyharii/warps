import { withAuth } from '@/lib/withAuth';
import { deleteGoogleAdsUserConn } from '@/lib/google-ads';

export default withAuth(function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  deleteGoogleAdsUserConn(req.user.userId);
  return res.status(200).json({ ok: true });
});
