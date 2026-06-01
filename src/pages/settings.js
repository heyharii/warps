import { useState, useEffect } from 'react';
import Head from 'next/head';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';

export default function Settings() {
  const { user } = useAuth();
  const [tab, setTab] = useState('profile');
  const [name, setName] = useState(user?.name || '');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setMessage('Profile updated');
  };

  return (
    <>
      <Head>
        <title>Settings - Traffic Source</title>
      </Head>
      <DashboardLayout>
        <h2 className="page-title">Account Settings</h2>
        <div style={{ maxWidth: 720 }}>
          <div className="panel" style={{ marginBottom: 24 }}>
            <div className="panel-header">
              <div className="panel-tabs">
                <button className={`panel-tab ${tab === 'profile' ? 'active' : ''}`} onClick={() => setTab('profile')}>Profile</button>
                <button className={`panel-tab ${tab === 'integrations' ? 'active' : ''}`} onClick={() => setTab('integrations')}>Integrations</button>
                <button className={`panel-tab ${tab === 'backups' ? 'active' : ''}`} onClick={() => setTab('backups')}>Backups</button>
              </div>
            </div>
            <div className="panel-body" style={{ padding: 20 }}>
              {tab === 'profile' && (
                <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {message && (
                    <div style={{ background: 'var(--success-light)', color: 'var(--success)', padding: '10px 14px', borderRadius: 'var(--radius)', fontSize: 13 }}>
                      {message}
                    </div>
                  )}
                  {error && <div className="auth-error">{error}</div>}
                  <div className="form-group">
                    <label>Email</label>
                    <input type="email" value={user?.email || ''} disabled style={{ opacity: 0.6 }} />
                  </div>
                  <div className="form-group">
                    <label>Name</label>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
                    Save Changes
                  </button>
                </form>
              )}
              {tab === 'integrations' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                  <GscIntegration />
                  <hr style={{ border: 'none', borderTop: '1px solid var(--border)' }} />
                  <LinkedInIntegration />
                  <hr style={{ border: 'none', borderTop: '1px solid var(--border)' }} />
                  <GoogleAdsIntegration />
                  <hr style={{ border: 'none', borderTop: '1px solid var(--border)' }} />
                  <InstagramIntegration />
                  <hr style={{ border: 'none', borderTop: '1px solid var(--border)' }} />
                  <TiktokIntegration />
                </div>
              )}
              {tab === 'backups' && <BackupSettings />}
            </div>
          </div>
        </div>
      </DashboardLayout>
    </>
  );
}

function SetupGuide() {
  const steps = [
    {
      n: 1,
      title: 'Create a Google Cloud project',
      body: <>Open <a href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noreferrer">Google Cloud → New Project</a>. Give it any name (e.g. <em>Traffic Source</em>) and click <strong>Create</strong>. Wait a few seconds, then make sure the new project is selected in the top bar.</>,
    },
    {
      n: 2,
      title: 'Enable the Search Console API',
      body: <>Open <a href="https://console.cloud.google.com/apis/library/searchconsole.googleapis.com" target="_blank" rel="noreferrer">Search Console API</a> and click <strong>Enable</strong>. This lets your app read keyword data.</>,
    },
    {
      n: 3,
      title: 'Configure the OAuth consent screen',
      body: (
        <>
          Open <a href="https://console.cloud.google.com/apis/credentials/consent" target="_blank" rel="noreferrer">OAuth consent screen</a>.
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            <li>User type: <strong>External</strong> → Create</li>
            <li>App name: anything (e.g. <em>Traffic Source</em>)</li>
            <li>User support email + Developer contact: your email</li>
            <li>Save and continue → on the <strong>Scopes</strong> step, click <em>Add or remove scopes</em> and add <code>.../auth/webmasters.readonly</code></li>
            <li>On <strong>Test users</strong>, add the Google account(s) that own your Search Console properties</li>
            <li>Save (you do <em>not</em> need to publish the app — Testing mode works fine)</li>
          </ul>
        </>
      ),
    },
    {
      n: 4,
      title: 'Create the OAuth client',
      body: (
        <>
          Open <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer">Credentials</a> → <strong>+ Create credentials</strong> → <strong>OAuth client ID</strong>.
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            <li>Application type: <strong>Web application</strong></li>
            <li>Name: anything</li>
            <li>Under <strong>Authorized redirect URIs</strong>, click <em>Add URI</em> and paste the redirect URI shown above</li>
            <li>Click <strong>Create</strong></li>
          </ul>
        </>
      ),
    },
    {
      n: 5,
      title: 'Copy your credentials',
      body: <>A dialog will show your <strong>Client ID</strong> and <strong>Client secret</strong>. Copy both and paste them into the form below. You can re-open them anytime from the Credentials page.</>,
    },
  ];

  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>How to get OAuth credentials</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {steps.map((s) => (
          <div key={s.n} style={{ display: 'flex', gap: 12 }}>
            <div style={{
              flexShrink: 0, width: 24, height: 24, borderRadius: '50%',
              background: 'var(--primary, #4f46e5)', color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700,
            }}>{s.n}</div>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text)' }}>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>{s.title}</div>
              <div style={{ color: 'var(--text-muted)' }}>{s.body}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 14, fontSize: 12, color: 'var(--text-muted)' }}>
        💡 Tip: Once configured, every site in your account can connect to Search Console with one click — you only do this setup once.
      </div>
    </div>
  );
}

function GscIntegration() {
  const [state, setState] = useState(null);
  const [conn, setConn] = useState(null);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    const [r1, r2] = await Promise.all([
      fetch('/api/settings/integrations/gsc/credentials'),
      fetch('/api/settings/integrations/gsc/status'),
    ]);
    if (r1.ok) setState(await r1.json());
    if (r2.ok) setConn(await r2.json());
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('error')) setErr(decodeURIComponent(params.get('error')));
    if (params.get('connected')) setMsg('Google account connected.');
  }, []);

  const startConnect = async () => {
    setErr('');
    const r = await fetch('/api/settings/integrations/gsc/connect');
    const d = await r.json();
    if (!r.ok) { setErr(d.error); return; }
    window.location.href = d.url;
  };

  const disconnectGoogle = async () => {
    if (!confirm('Disconnect your Google account? All sites linked to Search Console will stop syncing and their keyword data will be deleted.')) return;
    await fetch('/api/settings/integrations/gsc/disconnect', { method: 'POST' });
    load();
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true); setErr(''); setMsg('');
    const r = await fetch('/api/settings/integrations/gsc/credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, clientSecret }),
    });
    setSaving(false);
    if (r.ok) {
      setMsg('Credentials saved. Now click "Connect Google Search Console" in Step 3 below.');
      setClientId(''); setClientSecret('');
      load();
    } else {
      const d = await r.json().catch(() => ({}));
      setErr(d.error || 'Failed to save');
    }
  };

  const remove = async () => {
    if (!confirm('Remove Google Search Console credentials? Existing site connections will stop syncing.')) return;
    await fetch('/api/settings/integrations/gsc/credentials', { method: 'DELETE' });
    load();
  };

  const copyRedirect = () => {
    if (!state?.redirectUri) return;
    navigator.clipboard.writeText(state.redirectUri);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!state) return <div className="loading-inline"><div className="loading-spinner" /></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h3 style={{ margin: 0, fontSize: 16 }}>Google Search Console</h3>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
          Connect once with your Google Cloud OAuth credentials. Then any site can be linked to Search Console with a single click.
        </p>
      </div>

      {msg && <div style={{ background: 'var(--success-light)', color: 'var(--success)', padding: '10px 14px', borderRadius: 'var(--radius)', fontSize: 13 }}>{msg}</div>}
      {err && <div className="auth-error">{err}</div>}

      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
          Step 1 — Copy this Redirect URI
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <code style={{ flex: 1, padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, overflow: 'auto', color: 'var(--text)' }}>
            {state.redirectUri}
          </code>
          <button type="button" className="btn btn-secondary btn-sm" onClick={copyRedirect}>
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
          Paste this into <strong>Authorized redirect URIs</strong> in your Google Cloud OAuth client. <button type="button" onClick={() => setShowHelp(!showHelp)} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: 0, fontSize: 12 }}>How to get OAuth credentials? {showHelp ? '▲' : '▼'}</button>
        </div>
        {showHelp && <SetupGuide />}
      </div>

      {state.configured && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: 'var(--success-light)', borderRadius: 'var(--radius)', fontSize: 13 }}>
          <span style={{ color: 'var(--success)', fontWeight: 600 }}>✓ Credentials saved</span>
          <span style={{ color: 'var(--text-muted)' }}>Client ID: {state.clientIdMasked}</span>
          <button type="button" className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }} onClick={remove}>Remove</button>
        </div>
      )}

      <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Step 2 — Paste your OAuth credentials
        </div>
        <div className="form-group">
          <label>Client ID</label>
          <input type="text" value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="123456789-abc.apps.googleusercontent.com" />
        </div>
        <div className="form-group">
          <label>Client Secret</label>
          <input type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} placeholder="GOCSPX-..." />
        </div>
        <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }} disabled={saving || !clientId || !clientSecret}>
          {saving ? 'Saving…' : state.configured ? 'Update Credentials' : 'Save Credentials'}
        </button>
      </form>

      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
          Step 3 — Connect your Google account
        </div>
        {!state.configured && (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>Save your OAuth credentials above first.</p>
        )}
        {state.configured && conn?.connected && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
            <span style={{ color: 'var(--success)', fontWeight: 600 }}>✓ Connected</span>
            <span style={{ color: 'var(--text-muted)' }}>{conn.email}</span>
            <button type="button" className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }} onClick={disconnectGoogle}>Disconnect</button>
          </div>
        )}
        {state.configured && !conn?.connected && (
          <button type="button" className="btn btn-primary" onClick={startConnect}>
            Connect Google Search Console
          </button>
        )}
      </div>
    </div>
  );
}

function LinkedInIntegration() {
  const [status, setStatus] = useState(null);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = async () => {
    const [r1, r2] = await Promise.all([
      fetch('/api/settings/integrations/linkedin/credentials'),
      fetch('/api/settings/integrations/linkedin/status'),
    ]);
    if (r1.ok) setStatus({ ...(await r1.json()), ...(r2.ok ? await r2.json() : {}) });
  };
  useEffect(() => {
    load();
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      if (p.get('li_connected')) setMsg('LinkedIn account connected!');
      if (p.get('li_error')) setErr(decodeURIComponent(p.get('li_error')));
    }
  }, []);

  const saveCredentials = async (e) => {
    e.preventDefault();
    setSaving(true); setMsg(''); setErr('');
    const r = await fetch('/api/settings/integrations/linkedin/credentials', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, clientSecret }),
    });
    setSaving(false);
    if (r.ok) { setMsg('LinkedIn credentials saved.'); setClientId(''); setClientSecret(''); load(); }
    else { const d = await r.json().catch(() => ({})); setErr(d.error || 'Failed'); }
  };

  const connect = async () => {
    setErr('');
    const r = await fetch('/api/settings/integrations/linkedin/connect');
    const d = await r.json();
    if (!r.ok) { setErr(d.error); return; }
    window.location.href = d.url;
  };

  const disconnect = async () => {
    if (!confirm('Disconnect LinkedIn account? All linked sites will stop syncing.')) return;
    await fetch('/api/settings/integrations/linkedin/disconnect', { method: 'POST' });
    load();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h3 style={{ margin: 0, fontSize: 16 }}>LinkedIn Organic</h3>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
          Track organic impressions, engagement, clicks, and CTR from your LinkedIn Company Pages.
          Create a LinkedIn app at <a href="https://www.linkedin.com/developers/apps" target="_blank" rel="noreferrer">LinkedIn Developer Portal</a> with scopes <code>r_organization_social</code> and <code>r_ads_reporting</code>.
        </p>
      </div>
      {msg && <div style={{ background: 'var(--success-light)', color: 'var(--success)', padding: '10px 14px', borderRadius: 'var(--radius)', fontSize: 13 }}>{msg}</div>}
      {err && <div className="auth-error">{err}</div>}
      {status?.configured && (
        <div style={{ fontSize: 13, padding: 10, background: 'var(--success-light)', borderRadius: 8, color: 'var(--success)' }}>
          ✓ App credentials saved · Client ID: {status.clientIdMasked}
        </div>
      )}
      <form onSubmit={saveCredentials} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Step 1 — LinkedIn App Credentials
        </div>
        <div className="form-group">
          <label>Client ID</label>
          <input type="text" value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="86xxxxxxxx" />
        </div>
        <div className="form-group">
          <label>Client Secret</label>
          <input type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} placeholder="xxxxxxxxxxxxxxxx" />
        </div>
        <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }} disabled={saving || !clientId || !clientSecret}>
          {saving ? 'Saving…' : status?.configured ? 'Update Credentials' : 'Save Credentials'}
        </button>
      </form>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
          Step 2 — Connect your LinkedIn account
        </div>
        {!status?.configured && <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>Save credentials first.</p>}
        {status?.configured && status?.connected && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
            <span style={{ color: 'var(--success)', fontWeight: 600 }}>✓ Connected</span>
            {status.linkedinName && <span style={{ color: 'var(--text-muted)' }}>{status.linkedinName}</span>}
            <button type="button" className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }} onClick={disconnect}>Disconnect</button>
          </div>
        )}
        {status?.configured && !status?.connected && (
          <button type="button" className="btn btn-primary" onClick={connect}>Connect LinkedIn Account</button>
        )}
      </div>
    </div>
  );
}

function GoogleAdsIntegration() {
  const [status, setStatus] = useState(null);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [developerToken, setDeveloperToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = async () => {
    const [r1, r2] = await Promise.all([
      fetch('/api/settings/integrations/google-ads/credentials'),
      fetch('/api/settings/integrations/google-ads/status'),
    ]);
    if (r1.ok) setStatus({ ...(await r1.json()), ...(r2.ok ? await r2.json() : {}) });
  };
  useEffect(() => {
    load();
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      if (p.get('gads_connected')) setMsg('Google Ads account connected!');
      if (p.get('gads_error')) setErr(decodeURIComponent(p.get('gads_error')));
    }
  }, []);

  const saveCredentials = async (e) => {
    e.preventDefault();
    setSaving(true); setMsg(''); setErr('');
    const body = {};
    if (clientId && clientSecret) { body.clientId = clientId; body.clientSecret = clientSecret; }
    if (developerToken) body.developerToken = developerToken;
    const r = await fetch('/api/settings/integrations/google-ads/credentials', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    setSaving(false);
    if (r.ok) { setMsg('Google Ads credentials saved.'); setClientId(''); setClientSecret(''); setDeveloperToken(''); load(); }
    else { const d = await r.json().catch(() => ({})); setErr(d.error || 'Failed'); }
  };

  const connect = async () => {
    setErr('');
    const r = await fetch('/api/settings/integrations/google-ads/connect');
    const d = await r.json();
    if (!r.ok) { setErr(d.error); return; }
    window.location.href = d.url;
  };

  const disconnect = async () => {
    if (!confirm('Disconnect Google Ads account? All linked sites will stop syncing.')) return;
    await fetch('/api/settings/integrations/google-ads/disconnect', { method: 'POST' });
    load();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h3 style={{ margin: 0, fontSize: 16 }}>Google Ads</h3>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
          Track ad performance: impressions, clicks, CTR, conversions, CVR, and spend.
          You need a <a href="https://developers.google.com/google-ads/api/docs/first-call/dev-token" target="_blank" rel="noreferrer">Google Ads Developer Token</a> plus OAuth credentials (same Google Cloud project, add the <code>Google Ads API</code> and scope <code>adwords</code>).
        </p>
      </div>
      {msg && <div style={{ background: 'var(--success-light)', color: 'var(--success)', padding: '10px 14px', borderRadius: 'var(--radius)', fontSize: 13 }}>{msg}</div>}
      {err && <div className="auth-error">{err}</div>}
      {status?.configured && (
        <div style={{ fontSize: 13, padding: 10, background: 'var(--success-light)', borderRadius: 8, color: 'var(--success)' }}>
          ✓ OAuth credentials saved · {status.developerTokenSet ? '✓ Developer token set' : '⚠ Developer token missing'}
        </div>
      )}
      <form onSubmit={saveCredentials} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Credentials
        </div>
        <div className="form-group">
          <label>Client ID (Google Cloud)</label>
          <input type="text" value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="123456789-abc.apps.googleusercontent.com" />
        </div>
        <div className="form-group">
          <label>Client Secret</label>
          <input type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} placeholder="GOCSPX-..." />
        </div>
        <div className="form-group">
          <label>Developer Token</label>
          <input type="password" value={developerToken} onChange={(e) => setDeveloperToken(e.target.value)} placeholder="xxxxxxxxxxxxxxxx" />
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Found in Google Ads → Tools → API Center</span>
        </div>
        <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }} disabled={saving || (!clientId && !developerToken)}>
          {saving ? 'Saving…' : 'Save Credentials'}
        </button>
      </form>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
          Connect your Google Ads account
        </div>
        {!status?.configured && <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>Save OAuth credentials and developer token first.</p>}
        {status?.configured && status?.connected && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
            <span style={{ color: 'var(--success)', fontWeight: 600 }}>✓ Connected</span>
            {status.googleEmail && <span style={{ color: 'var(--text-muted)' }}>{status.googleEmail}</span>}
            <button type="button" className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }} onClick={disconnect}>Disconnect</button>
          </div>
        )}
        {status?.configured && !status?.connected && (
          <button type="button" className="btn btn-primary" onClick={connect}>Connect Google Ads Account</button>
        )}
      </div>
    </div>
  );
}

function InstagramIntegration() {
  const [status, setStatus] = useState(null);
  const [appId, setAppId] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = async () => {
    const [r1, r2] = await Promise.all([
      fetch('/api/settings/integrations/instagram/credentials'),
      fetch('/api/settings/integrations/instagram/status'),
    ]);
    if (r1.ok) setStatus({ ...(await r1.json()), ...(r2.ok ? await r2.json() : {}) });
  };
  useEffect(() => {
    load();
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      if (p.get('ig_connected')) setMsg('Instagram (Facebook) account connected!');
      if (p.get('ig_error')) setErr(decodeURIComponent(p.get('ig_error')));
    }
  }, []);

  const saveCredentials = async (e) => {
    e.preventDefault();
    setSaving(true); setMsg(''); setErr('');
    const r = await fetch('/api/settings/integrations/instagram/credentials', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appId, appSecret }),
    });
    setSaving(false);
    if (r.ok) { setMsg('Instagram credentials saved.'); setAppId(''); setAppSecret(''); load(); }
    else { const d = await r.json().catch(() => ({})); setErr(d.error || 'Failed'); }
  };

  const connect = async () => {
    setErr('');
    const r = await fetch('/api/settings/integrations/instagram/connect');
    const d = await r.json();
    if (!r.ok) { setErr(d.error); return; }
    window.location.href = d.url;
  };

  const disconnect = async () => {
    if (!confirm('Disconnect Instagram account? All linked sites will stop syncing.')) return;
    await fetch('/api/settings/integrations/instagram/disconnect', { method: 'POST' });
    load();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h3 style={{ margin: 0, fontSize: 16 }}>Instagram</h3>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
          Track reach, impressions, followers, and engagement from your Instagram Business accounts.
          Requires a <a href="https://developers.facebook.com/apps/" target="_blank" rel="noreferrer">Facebook App</a> with <code>instagram_manage_insights</code> and <code>instagram_basic</code> permissions.
          Your Instagram account must be a Business account linked to a Facebook Page.
        </p>
      </div>
      {msg && <div style={{ background: 'var(--success-light)', color: 'var(--success)', padding: '10px 14px', borderRadius: 'var(--radius)', fontSize: 13 }}>{msg}</div>}
      {err && <div className="auth-error">{err}</div>}
      {status?.configured && (
        <div style={{ fontSize: 13, padding: 10, background: 'var(--success-light)', borderRadius: 8, color: 'var(--success)' }}>
          ✓ App credentials saved · App ID: {status.appIdMasked}
        </div>
      )}
      <form onSubmit={saveCredentials} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Step 1 — Facebook App Credentials
        </div>
        <div className="form-group">
          <label>App ID</label>
          <input type="text" value={appId} onChange={(e) => setAppId(e.target.value)} placeholder="123456789012345" />
        </div>
        <div className="form-group">
          <label>App Secret</label>
          <input type="password" value={appSecret} onChange={(e) => setAppSecret(e.target.value)} placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
        </div>
        <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }} disabled={saving || !appId || !appSecret}>
          {saving ? 'Saving…' : status?.configured ? 'Update Credentials' : 'Save Credentials'}
        </button>
      </form>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
          Step 2 — Connect your Facebook account
        </div>
        {!status?.configured && <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>Save credentials first.</p>}
        {status?.configured && status?.connected && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
            <span style={{ color: 'var(--success)', fontWeight: 600 }}>✓ Connected</span>
            {status.fbName && <span style={{ color: 'var(--text-muted)' }}>{status.fbName}</span>}
            <button type="button" className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }} onClick={disconnect}>Disconnect</button>
          </div>
        )}
        {status?.configured && !status?.connected && (
          <button type="button" className="btn btn-primary" onClick={connect}>Connect Facebook / Instagram Account</button>
        )}
      </div>
    </div>
  );
}

function TiktokIntegration() {
  const [status, setStatus] = useState(null);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = async () => {
    const [r1, r2] = await Promise.all([
      fetch('/api/settings/integrations/tiktok/credentials'),
      fetch('/api/settings/integrations/tiktok/status'),
    ]);
    if (r1.ok) setStatus({ ...(await r1.json()), ...(r2.ok ? await r2.json() : {}) });
  };
  useEffect(() => {
    load();
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      if (p.get('tt_connected')) setMsg('TikTok account connected!');
      if (p.get('tt_error')) setErr(decodeURIComponent(p.get('tt_error')));
    }
  }, []);

  const saveCredentials = async (e) => {
    e.preventDefault();
    setSaving(true); setMsg(''); setErr('');
    const r = await fetch('/api/settings/integrations/tiktok/credentials', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, clientSecret }),
    });
    setSaving(false);
    if (r.ok) { setMsg('TikTok credentials saved.'); setClientId(''); setClientSecret(''); load(); }
    else { const d = await r.json().catch(() => ({})); setErr(d.error || 'Failed'); }
  };

  const connect = async () => {
    setErr('');
    const r = await fetch('/api/settings/integrations/tiktok/connect');
    const d = await r.json();
    if (!r.ok) { setErr(d.error); return; }
    window.location.href = d.url;
  };

  const disconnect = async () => {
    if (!confirm('Disconnect TikTok account? All linked sites will stop syncing.')) return;
    await fetch('/api/settings/integrations/tiktok/disconnect', { method: 'POST' });
    load();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h3 style={{ margin: 0, fontSize: 16 }}>TikTok</h3>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
          Track followers, video views, likes, comments, and shares from your TikTok account.
          Register an app at <a href="https://developers.tiktok.com/" target="_blank" rel="noreferrer">TikTok for Developers</a> and enable scopes <code>user.info.stats</code> and <code>video.list</code>.
        </p>
      </div>
      {msg && <div style={{ background: 'var(--success-light)', color: 'var(--success)', padding: '10px 14px', borderRadius: 'var(--radius)', fontSize: 13 }}>{msg}</div>}
      {err && <div className="auth-error">{err}</div>}
      {status?.configured && (
        <div style={{ fontSize: 13, padding: 10, background: 'var(--success-light)', borderRadius: 8, color: 'var(--success)' }}>
          ✓ App credentials saved · Client Key: {status.clientIdMasked}
        </div>
      )}
      <form onSubmit={saveCredentials} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Step 1 — TikTok App Credentials
        </div>
        <div className="form-group">
          <label>Client Key</label>
          <input type="text" value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="xxxxxxxxxxxxxxxxxxxxxxxx" />
        </div>
        <div className="form-group">
          <label>Client Secret</label>
          <input type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} placeholder="xxxxxxxxxxxxxxxxxxxxxxxx" />
        </div>
        <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }} disabled={saving || !clientId || !clientSecret}>
          {saving ? 'Saving…' : status?.configured ? 'Update Credentials' : 'Save Credentials'}
        </button>
      </form>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
          Step 2 — Connect your TikTok account
        </div>
        {!status?.configured && <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>Save credentials first.</p>}
        {status?.configured && status?.connected && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
            <span style={{ color: 'var(--success)', fontWeight: 600 }}>✓ Connected</span>
            {status.tiktokName && <span style={{ color: 'var(--text-muted)' }}>{status.tiktokName}{status.tiktokUsername ? ` (@${status.tiktokUsername})` : ''}</span>}
            <button type="button" className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }} onClick={disconnect}>Disconnect</button>
          </div>
        )}
        {status?.configured && !status?.connected && (
          <button type="button" className="btn btn-primary" onClick={connect}>Connect TikTok Account</button>
        )}
      </div>
    </div>
  );
}

const PROVIDERS = [
  { value: 'aws', label: 'AWS S3', endpoint: 'https://s3.{region}.amazonaws.com', region: 'us-east-1' },
  { value: 'digitalocean', label: 'DigitalOcean Spaces', endpoint: 'https://{region}.digitaloceanspaces.com', region: 'nyc3' },
  { value: 'cloudflare', label: 'Cloudflare R2', endpoint: 'https://{account_id}.r2.cloudflarestorage.com', region: 'auto' },
  { value: 'backblaze', label: 'Backblaze B2', endpoint: 'https://s3.{region}.backblazeb2.com', region: 'us-west-004' },
  { value: 'wasabi', label: 'Wasabi', endpoint: 'https://s3.{region}.wasabisys.com', region: 'us-east-1' },
  { value: 'minio', label: 'MinIO (Self-hosted)', endpoint: 'http://localhost:9000', region: 'us-east-1' },
  { value: 'custom', label: 'Custom S3-compatible', endpoint: '', region: '' },
];

function BackupSettings() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState('aws');
  const [endpoint, setEndpoint] = useState('');
  const [region, setRegion] = useState('us-east-1');
  const [bucket, setBucket] = useState('');
  const [accessKeyId, setAccessKeyId] = useState('');
  const [secretAccessKey, setSecretAccessKey] = useState('');
  const [prefix, setPrefix] = useState('');
  const [schedule, setSchedule] = useState('daily');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [history, setHistory] = useState([]);
  const [remoteBackups, setRemoteBackups] = useState([]);
  const [loadingRemote, setLoadingRemote] = useState(false);
  const [restoring, setRestoring] = useState(null);
  const [showRestore, setShowRestore] = useState(false);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const [r1, r2] = await Promise.all([
        fetch('/api/settings/backup/config'),
        fetch('/api/settings/backup/history'),
      ]);
      if (r1.ok) {
        const data = await r1.json();
        setConfig(data.config);
        if (data.config.provider) setProvider(data.config.provider);
        if (data.config.endpoint) setEndpoint(data.config.endpoint);
        if (data.config.region) setRegion(data.config.region);
        if (data.config.bucket) setBucket(data.config.bucket);
        if (data.config.prefix) setPrefix(data.config.prefix);
        if (data.config.schedule) setSchedule(data.config.schedule);
      }
      if (r2.ok) {
        const data = await r2.json();
        setHistory(data.history || []);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadConfig(); }, []);

  const handleProviderChange = (val) => {
    setProvider(val);
    const p = PROVIDERS.find(pr => pr.value === val);
    if (p) {
      setEndpoint(p.endpoint);
      setRegion(p.region);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setErr('');
    setMsg('');
    try {
      const r = await fetch('/api/settings/backup/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint, region, bucket, access_key_id: accessKeyId, secret_access_key: secretAccessKey }),
      });
      const data = await r.json();
      if (r.ok) {
        setMsg('Connection successful!');
      } else {
        setErr(data.error || 'Connection failed');
      }
    } catch (e) {
      setErr('Connection failed: ' + e.message);
    }
    setTesting(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErr('');
    setMsg('');
    try {
      const r = await fetch('/api/settings/backup/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint, region, bucket, access_key_id: accessKeyId, secret_access_key: secretAccessKey, prefix, provider, schedule }),
      });
      if (r.ok) {
        setMsg('Backup configuration saved.');
        setAccessKeyId('');
        setSecretAccessKey('');
        loadConfig();
      } else {
        const data = await r.json();
        setErr(data.error || 'Failed to save');
      }
    } catch (e) {
      setErr(e.message);
    }
    setSaving(false);
  };

  const handleBackupNow = async () => {
    setBackingUp(true);
    setErr('');
    setMsg('');
    try {
      const r = await fetch('/api/settings/backup/run', { method: 'POST' });
      const data = await r.json();
      if (r.ok) {
        setMsg(`Backup completed: ${data.filename} (${formatBytes(data.sizeBytes)})`);
        loadConfig();
      } else {
        setErr(data.error || 'Backup failed');
      }
    } catch (e) {
      setErr('Backup failed: ' + e.message);
    }
    setBackingUp(false);
  };

  const handleRemove = async () => {
    if (!confirm('Remove backup configuration?')) return;
    await fetch('/api/settings/backup/config', { method: 'DELETE' });
    setConfig(null);
    setEndpoint('');
    setRegion('us-east-1');
    setBucket('');
    setAccessKeyId('');
    setSecretAccessKey('');
    setPrefix('');
    setProvider('aws');
    setMsg('Backup configuration removed.');
  };

  const handleLoadRemoteBackups = async () => {
    setLoadingRemote(true);
    setErr('');
    setShowRestore(true);
    try {
      const r = await fetch('/api/settings/backup/restore');
      const data = await r.json();
      if (r.ok) {
        setRemoteBackups(data.backups || []);
      } else {
        setErr(data.error || 'Failed to list backups');
      }
    } catch (e) {
      setErr('Failed to list backups: ' + e.message);
    }
    setLoadingRemote(false);
  };

  const handleRestore = async (key, filename) => {
    if (!confirm(`Restore database from "${filename}"?\n\nThis will replace your current database. A safety backup will be created automatically before restoring.`)) return;
    setRestoring(key);
    setErr('');
    setMsg('');
    try {
      const r = await fetch('/api/settings/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });
      const data = await r.json();
      if (r.ok) {
        setMsg(`Database restored from "${data.restored}". Safety backup saved as "${data.safetyBackup}". Reloading...`);
        setTimeout(() => window.location.reload(), 2000);
      } else {
        setErr(data.error || 'Restore failed');
      }
    } catch (e) {
      setErr('Restore failed: ' + e.message);
    }
    setRestoring(null);
  };

  if (loading) return <div className="loading-inline"><div className="loading-spinner" /></div>;

  const isConfigured = config && config.endpoint && config.bucket;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h3 style={{ margin: 0, fontSize: 16 }}>Database Backup</h3>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
          Back up your SQLite database to any S3-compatible storage — AWS S3, DigitalOcean Spaces, Cloudflare R2, Backblaze B2, and more.
        </p>
      </div>

      {msg && <div style={{ background: 'var(--success-light)', color: 'var(--success)', padding: '10px 14px', borderRadius: 'var(--radius)', fontSize: 13 }}>{msg}</div>}
      {err && <div className="auth-error">{err}</div>}

      {isConfigured && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: 'var(--success-light)', borderRadius: 'var(--radius)', fontSize: 13 }}>
          <span style={{ color: 'var(--success)', fontWeight: 600 }}>Configured</span>
          <span style={{ color: 'var(--text-muted)' }}>{config.bucket} &middot; {config.provider || 'custom'}</span>
          <button type="button" className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }} onClick={handleRemove}>Remove</button>
        </div>
      )}

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="form-group">
          <label>Provider</label>
          <select value={provider} onChange={(e) => handleProviderChange(e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}>
            {PROVIDERS.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Endpoint URL</label>
          <input type="text" value={endpoint} onChange={(e) => setEndpoint(e.target.value)} placeholder="https://s3.us-east-1.amazonaws.com" />
          {provider !== 'custom' && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              Replace placeholder values (e.g. {'{region}'}, {'{account_id}'}) with your actual values.
            </span>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label>Region</label>
            <input type="text" value={region} onChange={(e) => setRegion(e.target.value)} placeholder="us-east-1" />
          </div>
          <div className="form-group">
            <label>Bucket Name</label>
            <input type="text" value={bucket} onChange={(e) => setBucket(e.target.value)} placeholder="my-backups" />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label>Access Key ID</label>
            <input type="text" value={accessKeyId} onChange={(e) => setAccessKeyId(e.target.value)} placeholder={isConfigured ? config.access_key_id : 'AKIA...'} />
          </div>
          <div className="form-group">
            <label>Secret Access Key</label>
            <input type="password" value={secretAccessKey} onChange={(e) => setSecretAccessKey(e.target.value)} placeholder={isConfigured ? '****' : 'Your secret key'} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label>Path Prefix <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></label>
            <input type="text" value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="backups/trafficsource" />
          </div>
          <div className="form-group">
            <label>Auto Backup Schedule</label>
            <select value={schedule} onChange={(e) => setSchedule(e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}>
              <option value="12h">Every 12 hours</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" className="btn btn-primary" disabled={saving || !endpoint || !bucket || !accessKeyId || !secretAccessKey}>
            {saving ? 'Saving...' : isConfigured ? 'Update Configuration' : 'Save Configuration'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleTestConnection} disabled={testing || !endpoint || !bucket || !accessKeyId || !secretAccessKey}>
            {testing ? 'Testing...' : 'Test Connection'}
          </button>
        </div>
      </form>

      {isConfigured && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Manual Backup</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Create a snapshot and upload it now.</div>
            </div>
            <button type="button" className="btn btn-primary" onClick={handleBackupNow} disabled={backingUp}>
              {backingUp ? 'Backing up...' : 'Backup Now'}
            </button>
          </div>

          <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 12px', background: 'var(--bg)', borderRadius: 6, border: '1px solid var(--border)' }}>
            Auto backups run on the schedule you selected above. No external cron needed.
          </div>
        </div>
      )}

      {isConfigured && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Restore Database</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Rollback to a previous backup. A safety backup is created automatically before restoring.</div>
            </div>
            <button type="button" className="btn btn-secondary" onClick={handleLoadRemoteBackups} disabled={loadingRemote}>
              {loadingRemote ? 'Loading...' : showRestore ? 'Refresh List' : 'Show Backups'}
            </button>
          </div>

          {showRestore && (
            <>
              {remoteBackups.length === 0 && !loadingRemote && (
                <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: 12, textAlign: 'center' }}>No backups found in storage.</div>
              )}
              {remoteBackups.length > 0 && (
                <table className="journey-table">
                  <thead>
                    <tr>
                      <th>Filename</th>
                      <th>Size</th>
                      <th>Date</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {remoteBackups.map((b) => (
                      <tr key={b.key}>
                        <td><span style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}>{b.filename}</span></td>
                        <td>{formatBytes(b.size)}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(b.lastModified).toLocaleString()}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleRestore(b.key, b.filename)}
                            disabled={restoring !== null}
                            style={{ fontSize: 11 }}
                          >
                            {restoring === b.key ? 'Restoring...' : 'Restore'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      )}

      {history.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Backup History</div>
          <table className="journey-table">
            <thead>
              <tr>
                <th>Filename</th>
                <th>Size</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td><span style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}>{h.filename || '—'}</span></td>
                  <td>{h.size_bytes ? formatBytes(h.size_bytes) : '—'}</td>
                  <td>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: 4,
                      background: h.status === 'completed' ? 'var(--success-light)' : h.status === 'failed' ? 'rgba(239,68,68,0.1)' : 'rgba(234,179,8,0.1)',
                      color: h.status === 'completed' ? 'var(--success)' : h.status === 'failed' ? '#ef4444' : '#eab308',
                    }}>
                      {h.status}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{h.completed_at || h.started_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
