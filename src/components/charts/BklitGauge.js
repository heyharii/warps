// Thin wrapper around the bklit Gauge (registry: @bklit/gauge-chart).
// Renders a single rate/KPI dial. `value` is the 0–100 fill; `centerValue` is
// the number shown in the middle (defaults to value). Theming comes from the
// --chart-* tokens defined in globals.scss.
import { Gauge } from './gauge';

const clamp = (n) => Math.max(0, Math.min(100, Number.isFinite(n) ? n : 0));

export default function BklitGauge({
  value,
  centerValue,
  label = 'Total',
  suffix,
  prefix,
  format,
  minWidth = 200,
  activeGradient,
  totalNotches = 40,
  // dim track so the active (value) notches stand out — otherwise bklit defaults
  // the inactive gradient to the active one and the gauge always looks "full".
  inactiveFill = 'var(--chart-background)',
  ...rest
}) {
  return (
    <Gauge
      value={clamp(value)}
      centerValue={centerValue != null ? centerValue : value}
      defaultLabel={label}
      suffix={suffix}
      prefix={prefix}
      formatOptions={format || { maximumFractionDigits: 1 }}
      useGradient
      activeGradient={activeGradient}
      inactiveFill={inactiveFill}
      inactiveFillOpacity={1}
      totalNotches={totalNotches}
      minWidth={minWidth}
      {...rest}
    />
  );
}
