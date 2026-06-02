import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import ProtectedRoute from '../ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { useDateRange } from '@/contexts/DateRangeContext';
import { useTheme } from '@/contexts/ThemeContext';

const periods = [
  { value: '24h', label: '1D' },
  { value: '7d', label: '7D' },
  { value: '30d', label: '1M' },
  { value: '90d', label: '3M' },
  { value: '12m', label: '1Y' },
];

function NavLink({ href, active, children, accent }) {
  return (
    <Link
      href={href}
      className={`sidebar-link ${active ? 'active' : ''}`}
      style={accent ? { fontWeight: active ? 700 : 600, color: active ? 'var(--accent)' : undefined } : undefined}
    >
      {children}
    </Link>
  );
}

export default function DashboardLayout({ children, siteId, siteName, siteDomain }) {
  const { period, setPeriod, setCustomRange } = useDateRange();
  const { logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const path = router.asPath;

  const channelsActive = ['/gsc', '/linkedin', '/google-ads', '/apollo', '/instagram', '/tiktok'].some((s) => path.includes(s));
  const [channelsOpen, setChannelsOpen] = useState(channelsActive);
  useEffect(() => { if (channelsActive) setChannelsOpen(true); }, [channelsActive]);

  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <ProtectedRoute>
      <div className="app-shell">
        <aside className={`app-sidebar ${mobileOpen ? 'open' : ''}`}>
          <Link href="/sites" className="sidebar-logo" onClick={() => setMobileOpen(false)}>
            <svg width="22" height="22" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
              <path fill="currentColor" d="M49.501 8.249L38.251 20.75h-5l-11.25 12.499H17l-11.25 12.5V2H2v60h60V8.249H49.501M27.626 56.375h-9.688V35.124h9.688v21.251m16.25 0h-9.688v-33.75h9.688v33.75m16.249 0h-9.687V10.124h9.687v46.251" />
            </svg>
            Traffic Source
          </Link>

          <nav className="sidebar-nav" onClick={() => setMobileOpen(false)}>
            <NavLink href="/sites" active={path === '/sites'}>Sites</NavLink>

            {siteId && (
              <>
                <div className="sidebar-divider" />
                <NavLink href={`/analytics/${siteId}`} active={path === `/analytics/${siteId}`}>Analytics</NavLink>
                <NavLink href={`/analytics/${siteId}/blended`} active={path.includes('/blended')} accent>⚡ Blended</NavLink>
                <NavLink href={`/analytics/${siteId}/conversions`} active={path.includes('/conversions')}>Conversions</NavLink>
                <NavLink href={`/analytics/${siteId}/leads`} active={path.includes('/leads')}>Leads</NavLink>

                <button
                  type="button"
                  className={`sidebar-link sidebar-group-toggle ${channelsActive ? 'active' : ''}`}
                  onClick={(e) => { e.stopPropagation(); setChannelsOpen((v) => !v); }}
                >
                  Channels
                  <span style={{ marginLeft: 'auto', fontSize: 10, opacity: 0.6 }}>{channelsOpen ? '▾' : '▸'}</span>
                </button>
                {channelsOpen && (
                  <div className="sidebar-subnav">
                    <NavLink href={`/analytics/${siteId}/gsc`}        active={path.includes('/gsc')}>Search Console</NavLink>
                    <NavLink href={`/analytics/${siteId}/linkedin`}   active={path.includes('/linkedin')}>LinkedIn</NavLink>
                    <NavLink href={`/analytics/${siteId}/google-ads`} active={path.includes('/google-ads')}>Google Ads</NavLink>
                    <NavLink href={`/analytics/${siteId}/apollo`}     active={path.includes('/apollo')}>Apollo Email</NavLink>
                    <NavLink href={`/analytics/${siteId}/instagram`}  active={path.includes('/instagram')}>Instagram</NavLink>
                    <NavLink href={`/analytics/${siteId}/tiktok`}     active={path.includes('/tiktok')}>TikTok</NavLink>
                  </div>
                )}

                <div className="sidebar-divider" />
                <NavLink href={`/analytics/${siteId}/settings`} active={path.includes('/settings') && path.includes('/analytics/')}>Site Settings</NavLink>
              </>
            )}
          </nav>

          <div className="sidebar-footer">
            <Link href="/settings" className={`sidebar-link ${path === '/settings' ? 'active' : ''}`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8 }}>
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              Settings
            </Link>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="sidebar-icon-btn" onClick={toggleTheme} title={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
                {theme === 'dark' ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5" />
                    <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                    <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                  </svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                )}
              </button>
              <button className="sidebar-icon-btn" onClick={logout} title="Sign out">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </div>
          </div>
        </aside>

        {mobileOpen && <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} />}

        <main className="app-main">
          <header className="app-topbar">
            <button className="sidebar-toggle" onClick={() => setMobileOpen((v) => !v)} aria-label="Toggle nav">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            {(siteName || siteDomain) ? (
              <div className="topbar-site">
                {siteDomain && (
                  <img
                    src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(siteDomain)}&sz=32`}
                    alt=""
                    width={22}
                    height={22}
                    className="topbar-favicon"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                )}
                <div>
                  <div className="topbar-site-name">{siteName || siteDomain}</div>
                  {siteName && siteDomain && <div className="topbar-site-domain">{siteDomain}</div>}
                </div>
              </div>
            ) : <div style={{ flex: 1 }} />}
            <div className="date-picker">
              {periods.map((p) => (
                <button
                  key={p.value}
                  className={period === p.value ? 'active' : ''}
                  onClick={() => { setCustomRange(null); setPeriod(p.value); }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </header>

          <div className="app-content">
            {children}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
