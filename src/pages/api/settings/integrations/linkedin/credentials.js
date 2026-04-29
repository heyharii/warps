import { withAuth } from '@/lib/withAuth';
import { getLinkedinCredentials, saveLinkedinCredentials, isLinkedinConfigured } from '@/lib/linkedin-organic';

export default withAuth(function handler(req, res) {
  if (req.method === 'GET') {
    const { clientId } = getLinkedinCredentials();
    return res.status(200).json({ configured: isLinkedinConfigured(), clientIdMasked: clientId ? clientId.slice(0, 4) + '••••' : null });
  }

  if (req.method === 'POST') {
    const { clientId, clientSecret } = req.body || {};
    if (!clientId || !clientSecret) return res.status(400).json({ error: 'clientId and clientSecret required' });
    saveLinkedinCredentials({ clientId, clientSecret });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
});
