// Choropleth-style world map: visitor traffic by country as proportional bubbles.
// Uses react-leaflet (already installed). Must be loaded client-side only (ssr: false).
import { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// ISO-2 → [lat, lng] centroids for ~120 common countries
const CENTROIDS = {
  US:[37.09,-95.71], GB:[55.38,-3.44], CA:[56.13,-106.35], AU:[-25.27,133.78],
  DE:[51.17,10.45],  FR:[46.23,2.21],  NL:[52.13,5.29],   IN:[20.59,78.96],
  JP:[36.20,138.25], BR:[-14.24,-51.93],MX:[23.63,-102.55],ES:[40.46,-3.75],
  IT:[41.87,12.57],  SE:[60.13,18.64], SG:[1.35,103.82],  PL:[51.92,19.15],
  AR:[-38.42,-63.62],KR:[35.91,127.77],RU:[61.52,105.32], ZA:[-30.56,22.94],
  NG:[9.08,8.67],    EG:[26.82,30.80], ID:[-0.79,113.92], TR:[38.96,35.24],
  PH:[12.88,121.77], TH:[15.87,100.99],MY:[4.21,108.01],  VN:[14.06,108.28],
  CL:[-35.68,-71.54],CO:[4.57,-74.30], PT:[39.40,-8.22],  NO:[60.47,8.47],
  DK:[56.26,9.50],   FI:[61.92,25.75], CH:[46.82,8.23],   AT:[47.52,14.55],
  BE:[50.50,4.47],   CZ:[49.82,15.47], HU:[47.16,19.50],  RO:[45.94,24.97],
  UA:[48.38,31.17],  IL:[31.05,34.85], SA:[23.89,45.08],  AE:[23.42,53.85],
  NZ:[-40.90,174.89],PK:[30.38,69.35], BD:[23.68,90.36],  KE:[-0.02,37.91],
  GH:[7.95,-1.02],   TZ:[-6.37,34.89], MA:[31.79,-7.09],  DZ:[28.03,1.66],
  GR:[39.07,21.82],  HK:[22.40,114.11],TW:[23.70,121.00], SK:[48.67,19.70],
  HR:[45.10,15.20],  BG:[42.73,25.49], LT:[55.17,23.88],  LV:[56.88,24.60],
  EE:[58.60,25.01],  IE:[53.41,-8.24], LU:[49.82,6.13],   IS:[64.96,-19.02],
  LK:[7.87,80.77],   MM:[19.15,96.96], KH:[12.57,104.99], NP:[28.39,84.12],
  PE:[-9.19,-75.02], EC:[-1.83,-78.18],UY:[-32.52,-55.77],BO:[-16.29,-63.59],
  CR:[9.75,-83.75],  GT:[15.78,-90.23],DO:[18.74,-70.16],  JM:[18.11,-77.30],
  RS:[44.02,21.01],  SI:[46.15,14.99], MT:[35.94,14.38],  CY:[35.13,33.43],
  TN:[33.89,9.54],   ET:[9.15,40.49],  ZW:[-19.02,29.15], VE:[6.42,-66.59],
  PY:[-23.44,-58.44],MK:[41.61,21.75], AL:[41.15,20.17],  BA:[43.92,17.68],
  MD:[47.41,28.37],  BY:[53.71,27.95], GE:[42.32,43.36],  AM:[40.07,45.04],
  AZ:[40.14,47.58],  KZ:[48.02,66.92], UZ:[41.38,64.59],  MN:[46.86,103.85],
  KW:[29.31,47.48],  QA:[25.35,51.18], OM:[21.51,55.92],  BH:[26.03,50.55],
  JO:[30.59,36.24],  LB:[33.85,35.86], IQ:[33.22,43.68],  YE:[15.55,48.52],
  LY:[26.34,17.23],  SD:[12.86,30.22], CM:[3.87,11.52],   CI:[7.54,-5.55],
  SN:[14.50,-14.45], ML:[17.57,-3.99], BF:[12.36,-1.56],  NE:[17.61,8.08],
  TG:[8.62,0.82],    BJ:[9.31,2.32],   MW:[13.25,34.30],  ZM:[13.13,27.85],
  MG:[-18.77,46.87], MZ:[-18.67,35.53],AO:[-11.20,17.87], CD:[-4.04,21.76],
  RW:[-1.94,29.87],  UG:[1.37,32.29],  SS:[7.86,31.31],   CF:[6.61,20.94],
};

function fmt(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
  return String(n);
}

export default function WorldBubbleMap({ countries = [], accentColor = '#6366f1' }) {
  // countries: [{ countryId, country, visitors }]
  const mapped = countries
    .map(c => {
      const code = (c.countryId || '').toUpperCase();
      const ll = CENTROIDS[code];
      if (!ll) return null;
      return { code, name: c.country || code, visitors: c.visitors || 0, ll };
    })
    .filter(Boolean)
    .sort((a, b) => b.visitors - a.visitors);

  const maxV = mapped[0]?.visitors || 1;

  // Scale radius 4–36 logarithmically
  const radius = (v) => {
    const pct = Math.log1p(v) / Math.log1p(maxV);
    return 4 + pct * 32;
  };

  if (!mapped.length) {
    return (
      <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        No geographic data
      </div>
    );
  }

  return (
    <MapContainer
      center={[20, 10]}
      zoom={2}
      style={{ height: 320, width: '100%', borderRadius: 8, background: '#0f172a' }}
      scrollWheelZoom={false}
      zoomControl={false}
      attributionControl={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
        maxZoom={6}
        minZoom={1}
      />
      {mapped.map(c => (
        <CircleMarker
          key={c.code}
          center={c.ll}
          radius={radius(c.visitors)}
          pathOptions={{
            color: accentColor,
            fillColor: accentColor,
            fillOpacity: 0.55,
            weight: 1,
            opacity: 0.9,
          }}
        >
          <Tooltip sticky>
            <strong>{c.name}</strong>
            <br />{fmt(c.visitors)} visitors
          </Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
