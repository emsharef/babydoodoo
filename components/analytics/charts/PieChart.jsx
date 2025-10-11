'use client';

import { categorical, colorAt } from './palette';
import { useChartTooltip } from './useTooltip';

const SIZE = 280;

export default function PieChart({ data = [], colors = categorical, height = SIZE, showLegend = true }) {
  const total = data.reduce((sum, item) => sum + (item.value || 0), 0);
  if (!total) {
    return <Placeholder height={height} />;
  }

  const { containerRef, showTooltip, hideTooltip, tooltipElement } = useChartTooltip();
  let currentAngle = 0;
  const center = SIZE / 2;
  const radius = SIZE / 2 - 10;
  const slices = data.map((item, idx) => {
    const fraction = item.value / total;
    const startAngle = currentAngle;
    const endAngle = currentAngle + fraction * Math.PI * 2;
    currentAngle = endAngle;
    return {
      item,
      idx,
      path: describeArc(center, center, radius, startAngle, endAngle),
      color: colorAt(idx, colors),
    };
  });

  return (
    <div ref={containerRef} style={{ display: 'flex', gap: 16, alignItems: 'center', height, position: 'relative' }} onMouseLeave={hideTooltip}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ width: '60%', maxWidth: SIZE, height: '100%' }} role="img">
        {slices.map(slice => {
          const percent = ((slice.item.value || 0) / total) * 100;
          const lines = [`${slice.item.label || slice.item.id}: ${slice.item.value}`, `${percent.toFixed(1)}%`];
          return (
            <path
              key={slice.idx}
              d={slice.path}
              fill={slice.color}
              stroke="#fff"
              strokeWidth={2}
              onMouseEnter={event => showTooltip(event, { title: slice.item.label || slice.item.id, lines })}
              onMouseMove={event => showTooltip(event, { title: slice.item.label || slice.item.id, lines })}
              onMouseLeave={hideTooltip}
            />
          );
        })}
      </svg>
      {showLegend ? (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
          {slices.map(slice => (
            <li key={slice.item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <span style={{ width: 12, height: 12, borderRadius: 4, background: slice.color }} />
              <span>{slice.item.label || slice.item.id} · {slice.item.value}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {tooltipElement}
    </div>
  );
}

function describeArc(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= Math.PI ? 0 : 1;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`;
}

function polarToCartesian(cx, cy, r, angle) {
  return {
    x: cx + r * Math.cos(angle - Math.PI / 2),
    y: cy + r * Math.sin(angle - Math.PI / 2),
  };
}

function Placeholder({ height }) {
  return (
    <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed #d9dae4', borderRadius: 12, color: '#999', width: '100%' }}>
      No data
    </div>
  );
}
