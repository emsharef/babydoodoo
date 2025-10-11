import { categorical, colorAt } from './palette';
import { useChartTooltip } from './useTooltip';
import { formatDateLabel, formatFullDate } from './utils';

function chartMetrics(count) {
  if (count <= 14) return { mode: 'spread', gap: 16, minHeightPct: 18 };
  if (count <= 30) return { mode: 'dense', width: 28, gap: 10, minHeightPct: 10 };
  return { mode: 'dense', width: 22, gap: 8, minHeightPct: 8 };
}

export default function StackedBarChart({ data, keys, xKey, height = 260, colors = categorical }) {
  if (!Array.isArray(data) || data.length === 0) {
    return <Placeholder height={height} message="No data" />;
  }

  const { containerRef, showTooltip, hideTooltip, tooltipElement } = useChartTooltip();
  const totals = data.map(row => keys.reduce((sum, key) => sum + (row[key] || 0), 0));
  const maxTotal = Math.max(...totals, 1);
  const metrics = chartMetrics(data.length);
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
          const ratio = total ? total / maxTotal : 0;
          const boosted = ratio ? Math.pow(ratio, 0.75) * 100 : 0;
          const heightPercent = ratio ? Math.max(metrics.minHeightPct, boosted) : 0;
          const dayLabel = row[xKey];
          return (
            <div
              key={`${dayLabel}-${idx}`}
              style={{
                width: metrics.mode === 'dense' ? metrics.width : undefined,
                minWidth: metrics.mode === 'dense' ? metrics.width : 0,
                display: 'grid',
                gap: 8,
                flex: metrics.mode === 'dense' ? `0 0 ${metrics.width}px` : '1 1 0',
              }}
            >
              <div
                style={{
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column-reverse',
                  justifyContent: 'flex-start',
                  height: `${heightPercent}%`,
                  borderRadius: 8,
                  overflow: 'hidden',
                  transition: 'height .25s ease',
                  background: total === 0 ? '#f1f1f6' : 'transparent',
                  border: total === 0 ? '1px dashed #d9dae4' : '1px solid rgba(0,0,0,0.08)'
                }}
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
                      style={{
                        height: `${pct}%`,
                        background: colorAt(keyIdx, colors),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontSize: 10,
                        fontWeight: 600,
                      }}
                      onMouseEnter={event => showTooltip(event, { title: formatFullDate(dayLabel), lines })}
                      onMouseMove={event => showTooltip(event, { title: formatFullDate(dayLabel), lines })}
                      onFocus={event => showTooltip(event, { title: formatFullDate(dayLabel), lines })}
                    >
                      {pct > 15 ? value : ''}
                    </div>
                  );
                })}
              </div>
              <div style={{ textAlign: 'center', fontSize: 12, color: '#555' }}>{formatDateLabel(dayLabel)}</div>
            </div>
          );
        })}
      </div>
      {tooltipElement}
    </div>
  );
}

function Placeholder({ height, message }) {
  return (
    <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed #d9dae4', borderRadius: 12, color: '#999' }}>
      {message}
    </div>
  );
}
