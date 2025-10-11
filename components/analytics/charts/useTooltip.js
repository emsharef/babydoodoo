'use client';

import { useRef, useState } from 'react';

export function useChartTooltip() {
  const containerRef = useRef(null);
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, title: '', lines: [] });

  const showTooltip = (event, payload = {}) => {
    const e = event?.nativeEvent ?? event;
    if (!containerRef.current || !e) return;
    const rect = containerRef.current.getBoundingClientRect();
    const point = getPoint(e);
    if (!point) return;
    const localX = point.x - rect.left;
    const localY = point.y - rect.top;
    const baseTop = localY - 36;
    const baseLeft = localX + 14;
    const clampedTop = Math.max(0, Math.min(rect.height - 80, baseTop));
    const clampedLeft = Math.max(0, Math.min(rect.width - 220, baseLeft));
    setTooltip({
      visible: true,
      x: clampedLeft,
      y: clampedTop,
      title: payload.title || '',
      lines: payload.lines || [],
    });
  };

  const hideTooltip = () => {
    setTooltip(prev => (prev.visible ? { ...prev, visible: false } : prev));
  };

  const tooltipElement = tooltip.visible ? (
    <div
      style={{
        position: 'absolute',
        left: tooltip.x,
        top: tooltip.y,
        zIndex: 5,
        pointerEvents: 'none',
        background: '#222',
        color: '#fff',
        padding: '8px 10px',
        borderRadius: 8,
        fontSize: 12,
        boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
        maxWidth: 220,
      }}
    >
      {tooltip.title ? <div style={{ fontWeight: 600, marginBottom: tooltip.lines.length ? 4 : 0 }}>{tooltip.title}</div> : null}
      {tooltip.lines.map((line, idx) => (
        <div key={idx} style={{ opacity: 0.85 }}>{line}</div>
      ))}
    </div>
  ) : null;

  return { containerRef, showTooltip, hideTooltip, tooltipElement };
}

function getPoint(event) {
  if ('clientX' in event && 'clientY' in event) {
    return { x: event.clientX, y: event.clientY };
  }
  if (event.touches?.length) {
    return { x: event.touches[0].clientX, y: event.touches[0].clientY };
  }
  return null;
}
