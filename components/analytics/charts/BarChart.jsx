'use client';

import { categorical, colorAt } from './palette';
import { useChartTooltip } from './useTooltip';
import { formatDateLabel, formatFullDate } from './utils';

function barMetrics(count) {
  if (count <= 14) return { mode: 'spread', gap: 16, minHeightPct: 18 };
  if (count <= 30) return { mode: 'dense', width: 30, gap: 10, minHeightPct: 10 };
  return { mode: 'dense', width: 24, gap: 8, minHeightPct: 8 };
}

export default function BarChart({ data = [], keys = ['value'], xKey = 'label', stacked = false, height = 280, colors = categorical }) {
  if (!data.length) {
    return <Placeholder height={height} />;
  }

  const { containerRef, showTooltip, hideTooltip, tooltipElement } = useChartTooltip();
  const totals = data.map(row => (stacked ? keys.reduce((sum, key) => sum + (row[key] || 0), 0) : Math.max(...keys.map(key => row[key] || 0))));
  const max = Math.max(...totals, 1);
  const metrics = barMetrics(data.length);
  const innerWidth = metrics.mode === 'dense'
    ? Math.max(360, data.length * metrics.width + Math.max(0, data.length - 1) * metrics.gap)
    : '100%';

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', overflowX: metrics.mode === 'dense' ? 'auto' : 'visible' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: metrics.gap,
          height,
          minWidth: innerWidth,
          padding: '0 4px',
        }}
        onMouseLeave={hideTooltip}
      >
        {data.map((row, idx) => {
          const total = totals[idx] || 0;
          const ratio = total ? total / max : 0;
          const boosted = ratio ? Math.pow(ratio, 0.75) * 100 : 0;
          const heightPct = ratio ? Math.max(metrics.minHeightPct, boosted) : 0;
          const labelValue = row[xKey];
          const formattedTitle = formatFullDate(labelValue);
          return (
            <div
              key={labelValue ?? idx}
              style={{
                width: metrics.mode === 'dense' ? metrics.width : undefined,
                minWidth: metrics.mode === 'dense' ? metrics.width : 0,
                display: 'grid',
                gap: 6,
                flex: metrics.mode === 'dense' ? `0 0 ${metrics.width}px` : '1 1 0',
              }}
            >
              <div style={{ height: `${heightPct}%`, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                {stacked ? (
                  <StackedColumn
                    row={row}
                    keys={keys}
                    colors={colors}
                    total={total}
                    showTooltip={(event, payload) => showTooltip(event, { title: formattedTitle, lines: payload })}
                    hideTooltip={hideTooltip}
                  />
                ) : (
                  <GroupedColumn
                    row={row}
                    keys={keys}
                    colors={colors}
                    max={max}
                    showTooltip={(event, payload) => showTooltip(event, { title: formattedTitle, lines: payload })}
                    hideTooltip={hideTooltip}
                  />
                )}
              </div>
              <div style={{ textAlign: 'center', fontSize: 12, color: '#555' }}>{formatDateLabel(labelValue)}</div>
            </div>
          );
        })}
      </div>
      {tooltipElement}
    </div>
  );
}

function StackedColumn({ row, keys, colors, total, showTooltip, hideTooltip }) {
  return (
    <div
      style={{ display: 'flex', flexDirection: 'column-reverse', height: '100%', width: '70%', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.08)' }}
      onMouseLeave={hideTooltip}
    >
      {keys.map((key, keyIdx) => {
        const value = row[key] || 0;
        if (!value) return null;
        const pct = total ? (value / total) * 100 : 0;
        const lines = [`${key}: ${value}`];
        return (
          <div
            key={key}
            style={{ height: `${pct}%`, background: colorAt(keyIdx, colors) }}
            onMouseEnter={event => showTooltip(event, lines)}
            onMouseMove={event => showTooltip(event, lines)}
          />
        );
      })}
    </div>
  );
}

function GroupedColumn({ row, keys, colors, max, showTooltip, hideTooltip }) {
  const activeKeys = keys.filter(k => row[k]);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: '100%' }} onMouseLeave={hideTooltip}>
      {keys.map((key, keyIdx) => {
        const value = row[key] || 0;
        if (!value) return null;
        const pct = (value / max) * 100;
        const barWidth = activeKeys.length === 1 ? 32 : 16;
        const lines = [`${key}: ${value}`];
        return (
          <div
            key={key}
            style={{
              width: barWidth,
              borderRadius: 6,
              background: colorAt(keyIdx, colors),
              height: `${pct}%`,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 10,
              fontWeight: 600,
            }}
            onMouseEnter={event => showTooltip(event, lines)}
            onMouseMove={event => showTooltip(event, lines)}
          >
            {pct > 40 ? value : ''}
          </div>
        );
      })}
    </div>
  );
}

function Placeholder({ height }) {
  return (
    <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed #d9dae4', borderRadius: 12, color: '#999', width: '100%' }}>
      No data
    </div>
  );
}
