import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useDateRange } from '@/contexts/DateRangeContext';
import CountryFlag from '@/components/ui/CountryFlag';
import { getCountryName } from '@/lib/formatters';

const BklitChoropleth = dynamic(() => import('@/components/charts/BklitChoropleth'), { ssr: false });
const CombinedChart = dynamic(() => import('@/components/charts/CombinedChart'), { ssr: false });
const BklitGauge = dynamic(() => import('@/components/charts/BklitGauge'), { ssr: false });
const BklitRing = dynamic(() => import('@/components/charts/BklitRing'), { ssr: false });

const DEVICE_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#e1306c', '#0ea5e9'];

function fmt(n) {
  if (n == null) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return n.toLocaleString();
}

function duration(s) {
  if (!s) return '0s';
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return m > 0 ? `${m}m ${r}s` : `${r}s`;
}

function ChangeChip({ change }) {
  if (change == null) return null;
  const up = change > 0;
  const flat = change === 0;
  const color = flat ? 'var(--text-muted)' : up ? 'var(--success)' : 'var(--danger)';
  return <span style={{ fontSize: 11, fontWeight: 600, color, marginLeft: 6 }}>{flat ? '0%' : `${up ? '+' : ''}${change}%`}</span>;
}

function Kpi({ label, value, change }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 16px' }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1 }}>{value}</div>
      <div style={{ marginTop: 6 }}><ChangeChip change={change} /></div>
    </div>
  );
}

function BreakdownPanel({ title, rows, keyField, valueField = 'visitors', renderKey }) {
  const total = rows.reduce((a, r) => a + (r[valueField] || 0), 0) || 1;
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600 }}>{title}</div>
      <div style={{ padding: 8 }}>
        {rows.length === 0 && <div style={{ padding: 16, fontSize: 12, color: 'var(--text-muted)' }}>No data</div>}
        {rows.slice(0, 8).map((r) => {
          const pct = ((r[valueField] || 0) / total) * 100;
          return (
            <div key={r[keyField]} style={{ position: 'relative', padding: '6px 10px' }}>
              <div style={{ position: 'absolute', inset: 0, background: 'var(--accent)', opacity: 0.08, width: `${pct}%`, borderRadius: 4 }} />
              <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                <span>{renderKey ? renderKey(r[keyField]) : r[keyField]}</span>
                <span style={{ color: 'var(--text-muted)' }}>{fmt(r[valueField])}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PropertyPicker({ siteId, onLinked }) {
  const [loading, setLoading] = useState(true);
  const [props, setProps] = useState([]);
  const [err, setErr] = useState(null);
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    let dead = false;
    fetch(`/api/sites/${siteId}/ga4/properties`).then(async (r) => {
      if (dead) return;
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setErr(d.error || 'Failed to load properties');
        setLoading(false);
        return;
      }
      const d = await r.json();
      setProps(d.properties || []);
      setLoading(false);
    });
    return () => { dead = true; };
  }, [siteId]);

  const link = async (p) => {
    setLinking(true);
    const r = await fetch(`/api/sites/${siteId}/ga4/link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ propertyId: p.propertyId, propertyName: p.propertyName, accountName: p.accountName }),
    });
    setLinking(false);
    if (r.ok) onLinked();
  };

  if (loading) return <div className="loading-inline"><div className="loading-spinner" /></div>;
  if (err) return <div className="auth-error" style={{ marginTop: 0 }}>{err}</div>;
  if (props.length === 0) return <div style={{ padding: 16, fontSize: 13, color: 'var(--text-muted)' }}>No GA4 properties accessible by your Google account.</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Pick a GA4 property to link to this site:</div>
      {props.map((p) => (
        <div key={p.propertyId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{p.propertyName}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.accountName} · ID {p.propertyId}</div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => link(p)} disabled={linking}>Link</button>
        </div>
      ))}
    </div>
  );
}

export default function Ga4Analytics({ siteId }) {
  const { period, setPeriod, getParams } = useDateRange();
  const [link, setLink] = useState(undefined); // undefined = loading, null = no link
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const checkLink = useCallback(async () => {
    const r = await fetch(`/api/sites/${siteId}/ga4/link`);
    if (!r.ok) { setLink(null); return; }
    const d = await r.json();
    setLink(d.link || null);
  }, [siteId]);

  useEffect(() => { if (siteId) checkLink(); }, [siteId, checkLink]);

  const load = useCallback(async () => {
    if (!link) return;
    setLoading(true);
    setErr(null);
    const params = new URLSearchParams(getParams());
    const r = await fetch(`/api/sites/${siteId}/ga4/overview?${params}`);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setErr(d.error || 'Failed to load GA4 data');
      setLoading(false);
      return;
    }
    setData(await r.json());
    setLoading(false);
  }, [siteId, link, getParams]);

  useEffect(() => { if (link) load(); }, [link, period, load]);

  const disconnect = async () => {
    if (!confirm('Unlink this site from its GA4 property?')) return;
    await fetch(`/api/sites/${siteId}/ga4/disconnect`, { method: 'POST' });
    setLink(null);
    setData(null);
  };

  if (link === undefined) return <div className="loading-inline"><div className="loading-spinner" /></div>;

  if (link === null) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Connect Google Analytics 4</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
            Your Analytics page will be powered by GA4 instead of the built-in tracker. Pick a property below — uses the Google account you connected for Search Console.
          </div>
          <PropertyPicker siteId={siteId} onLinked={checkLink} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, padding: '3px 8px', borderRadius: 10, background: 'rgba(245,158,11,.12)', color: '#fbbf24' }}>GA4</span>
          <div style={{ fontSize: 13 }}><strong>{link.property_name}</strong> <span style={{ color: 'var(--text-muted)' }}>· {link.account_name} · ID {link.property_id}</span></div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['1d', '7d', '30d', '90d', '12m'].map((p) => (
            <button key={p} onClick={() => setPeriod(p)} className="btn btn-sm" style={{
              background: period === p ? 'var(--bg-card)' : 'transparent',
              border: '1px solid var(--border)', color: 'var(--text)', fontWeight: period === p ? 600 : 500,
            }}>{p.toUpperCase()}</button>
          ))}
          <button className="btn btn-secondary btn-sm" onClick={disconnect}>Unlink</button>
        </div>
      </div>

      {err && <div className="auth-error">{err}</div>}
      {loading && !data && <div className="loading-inline"><div className="loading-spinner" /></div>}

      {data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            <Kpi label="Visitors" value={fmt(data.current.visitors)} change={data.changes.visitors} />
            <Kpi label="Sessions" value={fmt(data.current.sessions)} change={data.changes.sessions} />
            <Kpi label="Pageviews" value={fmt(data.current.pageViews)} change={data.changes.pageViews} />
            <Kpi label="Bounce rate" value={`${data.current.bounceRate}%`} change={data.changes.bounceRate} />
            <Kpi label="Session time" value={duration(data.current.avgDuration)} change={data.changes.avgDuration} />
          </div>

          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16 }}>
            <CombinedChart trafficData={data.timeSeries} revenueData={[]} />
          </div>

          {/* Engagement gauge + device-share ring — bklit charts */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600 }}>Engagement</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '8px 12px 14px', justifyItems: 'center' }}>
                <div style={{ width: '100%', maxWidth: 230 }}>
                  <BklitGauge value={Math.max(0, 100 - (data.current.bounceRate || 0))} centerValue={Math.max(0, 100 - (data.current.bounceRate || 0))} label="Engaged" suffix="%" activeGradient={['#bef264', '#22c55e']} />
                </div>
                <div style={{ width: '100%', maxWidth: 230 }}>
                  <BklitGauge value={data.current.bounceRate || 0} centerValue={data.current.bounceRate || 0} label="Bounce Rate" suffix="%" activeGradient={['#fca5a5', '#ef4444']} />
                </div>
              </div>
            </div>
            {data.devices?.length > 0 && (
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600 }}>Device Mix</div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: 14 }}>
                  <div style={{ width: '100%', maxWidth: 230 }}>
                    <BklitRing
                      rings={data.devices.slice(0, 5).map((d, i) => ({
                        label: d.device || 'Unknown',
                        value: d.visitors || 0,
                        maxValue: Math.max(data.devices.reduce((a, x) => a + (x.visitors || 0), 0), 1),
                        color: DEVICE_COLORS[i % DEVICE_COLORS.length],
                      }))}
                      centerLabel="Visitors"
                    />
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
                    {data.devices.slice(0, 5).map((d, i) => (
                      <span key={d.device} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: DEVICE_COLORS[i % DEVICE_COLORS.length], display: 'inline-block' }} />
                        {d.device}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            <BreakdownPanel title="Channels" rows={data.sources} keyField="channel" />
            <BreakdownPanel title="Pages" rows={data.pages} keyField="page" valueField="pageViews" />
            <BreakdownPanel title="Countries" rows={data.countries.map((r) => ({ ...r, label: r.country || getCountryName(r.countryId) || r.countryId }))} keyField="label"
              renderKey={(label) => {
                const row = data.countries.find((c) => (c.country || getCountryName(c.countryId) || c.countryId) === label);
                return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><CountryFlag code={row?.countryId} size="s" /> {label}</span>;
              }} />
            <BreakdownPanel title="Devices" rows={data.devices} keyField="device" />
            <BreakdownPanel title="Browsers" rows={data.browsers} keyField="browser" />
            <BreakdownPanel title="OS" rows={data.oses} keyField="os" />
          </div>

          {/* ── World traffic map — bklit choropleth-chart ── */}
          {data.countries?.length > 0 && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Visitor Traffic by Country</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Shading = visitor volume · hover to inspect</div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {data.countries.length} countries
                </div>
              </div>
              <div style={{ padding: 12 }}>
                <BklitChoropleth countries={data.countries} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
