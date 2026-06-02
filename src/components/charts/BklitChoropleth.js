'use client';
// True bklit choropleth (visx-geo) for "Visitor Traffic by Country".
// Client-only (dynamic ssr:false) — imports world-atlas TopoJSON and joins
// visitor counts onto features via ISO numeric ids.
import { useEffect, useMemo, useState } from 'react';
import { feature } from 'topojson-client';
import topology from 'world-atlas/countries-110m.json';
import {
  ChoroplethChart,
  ChoroplethFeatureComponent,
  ChoroplethGraticule,
  ChoroplethTooltip,
} from './choropleth';
import { alpha2ToNumeric } from '@/lib/iso-countries';

// TopoJSON → GeoJSON FeatureCollection, computed once at module load.
const WORLD = feature(topology, topology.objects.countries);

const DEFAULT_ACCENT = '#6366f1';

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex || '').trim());
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null;
}

export default function BklitChoropleth({ countries = [], accentHex }) {
  // Resolve the live --accent CSS var (theme-aware) on the client; fall back to the prop/default.
  const [accent, setAccent] = useState(accentHex || DEFAULT_ACCENT);
  useEffect(() => {
    if (accentHex) {
      setAccent(accentHex);
      return;
    }
    try {
      const v = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
      if (hexToRgb(v)) setAccent(v);
    } catch {
      /* keep default */
    }
  }, [accentHex]);

  const accentRgb = hexToRgb(accent) || hexToRgb(DEFAULT_ACCENT);

  // Sum visitor counts keyed by ISO numeric id (matches world-atlas feature.id).
  const { valueByNumeric, maxLog } = useMemo(() => {
    const map = {};
    for (const c of countries) {
      const num = alpha2ToNumeric(c.countryId);
      if (num == null) continue;
      map[num] = (map[num] || 0) + (c.visitors || 0);
    }
    const max = Object.values(map).reduce((a, b) => Math.max(a, b), 0);
    return { valueByNumeric: map, maxLog: Math.log(1 + max) || 1 };
  }, [countries]);

  const valueOf = (f) => valueByNumeric[parseInt(f.id, 10)];

  // Graduated accent fill (log-scaled alpha ramp); faint neutral for no-data countries.
  const getFeatureColor = (f) => {
    const v = valueOf(f);
    if (!v) return 'rgba(148,163,184,0.10)';
    const t = Math.log(1 + v) / maxLog;
    const alpha = 0.18 + 0.82 * t;
    const [r, g, b] = accentRgb;
    return `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
  };

  return (
    <ChoroplethChart data={WORLD} aspectRatio="2 / 1" zoomEnabled zoomMin={1} zoomMax={8}>
      <ChoroplethGraticule stroke="var(--chart-grid)" strokeWidth={0.4} />
      <ChoroplethFeatureComponent
        getFeatureColor={getFeatureColor}
        stroke="var(--bg-card)"
        strokeWidth={0.4}
      />
      <ChoroplethTooltip
        valueLabel="Visitors"
        getFeatureValue={valueOf}
        formatValue={(n) => n.toLocaleString()}
      />
    </ChoroplethChart>
  );
}
