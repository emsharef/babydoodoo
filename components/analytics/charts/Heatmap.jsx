'use client';

import { Fragment } from 'react';
import { useChartTooltip } from './useTooltip';

const timeBuckets = ['Night', 'Morning', 'Afternoon', 'Evening'];

export default function Heatmap({ data = [], height = 320, min = -2, max = 3 }) {
  if (!data.length) {
    return <Placeholder height={height} />;
  }

  const { containerRef, showTooltip, hideTooltip, tooltipElement } = useChartTooltip();

  return (
    <div
      ref={containerRef}
      style={{
        display: 'grid',
        gridTemplateColumns: `80px repeat(${timeBuckets.length}, 1fr)`,
        rowGap: 6,
        columnGap: 6,
        height,
        overflowY: 'auto',
        position: 'relative',
        paddingRight: 6,
      }}
      onMouseLeave={hideTooltip}
    >
      <div />
      {timeBuckets.map(bucket => <HeaderCell key={bucket}>{bucket}</HeaderCell>)}
      {data.map(row => (
        <Fragment key={row.day}>
          <RowHeader>{row.day}</RowHeader>
          {timeBuckets.map(bucket => {
            const value = row[bucket] ?? 0;
            const intensity = (value - min) / (max - min);
            const background = colorScale(intensity);
            return (
              <div
                key={`${row.day}-${bucket}`}
                style={{
                  minHeight: 46,
                  borderRadius: 10,
                  background,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: Math.abs(intensity - 0.5) > 0.25 ? '#fff' : '#333',
                  fontSize: 12,
                  fontWeight: 600,
                }}
                onMouseEnter={event => showTooltip(event, {
                  title: `${row.day} · ${bucket}`,
                  lines: [`Score: ${value.toFixed(1)}`],
                })}
                onMouseMove={event => showTooltip(event, {
                  title: `${row.day} · ${bucket}`,
                  lines: [`Score: ${value.toFixed(1)}`],
                })}
                onMouseLeave={hideTooltip}
              >
                {value ? value.toFixed(1) : '—'}
              </div>
            );
          })}
        </Fragment>
      ))}
      {tooltipElement}
    </div>
  );
}

function colorScale(intensity) {
  const clamp = Math.max(0, Math.min(1, Number.isFinite(intensity) ? intensity : 0));
  const neutral = [248, 249, 253];
  const cool = [132, 197, 166];
  const warm = [235, 120, 120];
  const ratio = clamp < 0.5 ? clamp * 2 : (clamp - 0.5) * 2;
  const target = clamp < 0.5 ? cool : warm;
  const r = Math.round(neutral[0] + (target[0] - neutral[0]) * ratio);
  const g = Math.round(neutral[1] + (target[1] - neutral[1]) * ratio);
  const b = Math.round(neutral[2] + (target[2] - neutral[2]) * ratio);
  return `rgb(${r}, ${g}, ${b})`;
}

function HeaderCell({ children }) {
  return <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#555' }}>{children}</div>;
}

function RowHeader({ children }) {
  return <div style={{ fontSize: 12, fontWeight: 600, color: '#333', alignSelf: 'center', textAlign: 'right' }}>{children}</div>;
}

function Placeholder({ height }) {
  return (
    <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed #d9dae4', borderRadius: 12, color: '#999' }}>
      No data
    </div>
  );
}
