'use client';
import { useState } from 'react';

export default function IconButton({ emoji, label, color='#fff3b0', border='#f0d264', onClick, animationDelay = 0 }) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);

  // Create a lighter version of the color for gradient
  const lighterColor = adjustColor(color, 20);
  const darkerBorder = adjustColor(border, -15);

  const style = {
    padding: '14px 12px',
    borderRadius: 16,
    background: isPressed
      ? color
      : `linear-gradient(145deg, ${lighterColor} 0%, ${color} 100%)`,
    border: `2px solid ${darkerBorder}`,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    boxShadow: isPressed
      ? `inset 0 2px 4px rgba(0,0,0,0.1)`
      : isHovered
        ? `0 6px 20px ${hexToRgba(border, 0.4)}, 0 2px 6px rgba(0,0,0,0.08)`
        : `0 4px 12px ${hexToRgba(border, 0.25)}, 0 2px 4px rgba(0,0,0,0.05)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
    width: '100%',
    transform: isPressed ? 'scale(0.97)' : isHovered ? 'translateY(-2px)' : 'translateY(0)',
    transition: 'all 0.15s ease-out',
    position: 'relative',
    overflow: 'hidden',
    animation: `fadeSlideIn 0.4s ease-out ${animationDelay}ms both`,
  };

  return (
    <button
      onClick={onClick}
      style={style}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { setIsHovered(false); setIsPressed(false); }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onTouchStart={() => setIsPressed(true)}
      onTouchEnd={() => setIsPressed(false)}
    >
      <span style={{
        fontSize: 24,
        marginRight: 10,
        filter: isHovered ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' : 'none',
        transform: isHovered ? 'scale(1.1)' : 'scale(1)',
        transition: 'all 0.15s ease-out',
      }}>{emoji}</span>
      <span style={{
        fontWeight: 700,
        letterSpacing: '0.3px',
        textShadow: '0 1px 0 rgba(255,255,255,0.5)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        minWidth: 0,
      }}>{label}</span>
    </button>
  );
}

// Helper to adjust color brightness
function adjustColor(hex, amount) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
  const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
  return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`;
}

// Helper to convert hex to rgba
function hexToRgba(hex, alpha) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = num >> 16;
  const g = (num >> 8) & 0x00FF;
  const b = num & 0x0000FF;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
