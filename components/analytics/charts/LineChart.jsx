
'use client';

import { categorical, colorAt } from './palette';
import { useChartTooltip } from './useTooltip';
import { formatDateLabel, formatFullDate } from './utils';

const WIDTH = 820;
const HEIGHT = 320;
const PADDING = 48;

export default function LineChart({ series = [], height = HEIGHT, colors = categorical, yLabelFormatter = v => v }) {
  const lines = Array.isArray(series) ? series.filter(s => s?.data?.length) : [];
  if (!lines.length) {
    return <Placeholder height={height} />;
  }

  const { containerRef, showTooltip, hideTooltip, tooltipElement } = useChartTooltip();
  const xValues = collectXValues(lines);
  const maxY = computeMaxY(lines);
  const perPointWidth = Math.min(42, Math.max(20, 840 / Math.max(xValues.length - 1, 1)));
  const innerWidth = Math.max(WIDTH, PADDING * 2 + Math.max(0, (xValues.length - 1) * perPointWidth));
  const plotWidth = innerWidth - PADDING * 2;
  const plotHeight = height - PADDING * 2;
  const getX = scaleX(xValues, plotWidth);
  const getY = scaleY(maxY, plotHeight);
  const skip = Math.max(1, Math.ceil(xValues.length / 8));

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
      <svg
        viewBox={`0 0 ${innerWidth} ${height}`}
        width={innerWidth}
        height={height}
        style={{ width: innerWidth, height: '100%' }}
        role="img"
        onMouseLeave={hideTooltip}
      >
        <rect x={PADDING} y={PADDING} width={plotWidth} height={plotHeight} fill="#fafafe" stroke="#e6e7f1" />
        {drawHorizontalGrid(plotWidth, plotHeight, maxY)}
        {lines.map((line, idx) => {
          const path = buildPath(line.data, getX, getY, xValues);
          return <path key={line.id || idx} d={path} fill="none" stroke={colorAt(idx, colors)} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />;
        })}
        {lines.map((line, idx) => (
          <g key={`points-${line.id || idx}`}>
            {line.data.map(point => {
              const cx = getX(point.x);
              const cy = getY(point.y || 0);
              const linesForTooltip = [`${line.id || 'Value'}: ${point.y}`];
              return (
                <circle
                  key={`${line.id}-${point.x}-${point.y}`}
                  cx={cx}
                  cy={cy}
                  r={4}
                  fill={colorAt(idx, colors)}
                  stroke="#fff"
                  strokeWidth={1.5}
                  onMouseEnter={event => showTooltip(event, { title: formatFullDate(point.x), lines: linesForTooltip })}
                  onMouseMove={event => showTooltip(event, { title: formatFullDate(point.x), lines: linesForTooltip })}
                  onMouseLeave={hideTooltip}
                />
              );
            })}
          </g>
        ))}
        {drawXAxis(xValues, getX, plotWidth, plotHeight, skip)}
        {drawYAxis(maxY, plotHeight, yLabelFormatter)}
      </svg>
      {tooltipElement}
    </div>
  );
}

function collectXValues(lines) {
  const set = new Set();
  lines.forEach(line => line.data.forEach(point => set.add(point.x)));
  return Array.from(set).sort((a, b) => (String(a) > String(b) ? 1 : -1));
}

function computeMaxY(lines) {
  return Math.max(
    1,
    ...lines.map(line => Math.max(...line.data.map(point => point.y || 0)))
  );
}

function scaleX(xValues, plotWidth) {
  const step = xValues.length > 1 ? plotWidth / (xValues.length - 1) : 0;
  return value => {
    const index = Math.max(0, xValues.indexOf(value));
    return PADDING + index * step;
  };
}

function scaleY(maxY, plotHeight) {
  return value => PADDING + plotHeight - (value / maxY) * plotHeight;
}

function buildPath(points, getX, getY, xValues) {
  return points
    .slice()
    .sort((a, b) => xValues.indexOf(a.x) - xValues.indexOf(b.x))
    .map((point, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(point.x)} ${getY(point.y || 0)}`)
    .join(' ');
}

function drawXAxis(xValues, getX, plotWidth, plotHeight, skip) {
  const y = PADDING + plotHeight;
  return (
    <g>
      <line x1={PADDING} y1={y} x2={PADDING + plotWidth} y2={y} stroke="#cfd2e6" />
      {xValues.map((value, idx) => (
        <g key={value} transform={`translate(${getX(value)}, ${y})`}>
          <line y2={6} stroke="#cfd2e6" />
          {idx % skip === 0 ? (
            <text dy={18} fontSize={11} fill="#555" textAnchor="middle">{formatDateLabel(String(value))}</text>
          ) : null}
        </g>
      ))}
    </g>
  );
}

function drawYAxis(maxY, plotHeight, formatter) {
  const ticks = 4;
  const step = maxY / ticks;
  return (
    <g>
      {Array.from({ length: ticks + 1 }).map((_, idx) => {
        const value = idx * step;
        const y = PADDING + plotHeight - (value / maxY) * plotHeight;
        return (
          <g key={idx} transform={`translate(${PADDING}, ${y})`}>
            <line x1={-6} x2={0} stroke="#cfd2e6" />
            <text x={-10} dy={4} fontSize={11} fill="#555" textAnchor="end">{formatter(Math.round(value))}</text>
          </g>
        );
      })}
    </g>
  );
}

function drawHorizontalGrid(plotWidth, plotHeight, maxY) {
  const ticks = 4;
  return Array.from({ length: ticks }).map((_, idx) => {
    const value = ((idx + 1) / (ticks + 1));
    const y = PADDING + plotHeight - value * plotHeight;
    return <line key={idx} x1={PADDING} x2={PADDING + plotWidth} y1={y} y2={y} stroke="#ebeef9" strokeDasharray="4 6" />;
  });
}

function Placeholder({ height }) {
  return (
    <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed #d9dae4', borderRadius: 12, color: '#999' }}>
      No data
    </div>
  );
}
