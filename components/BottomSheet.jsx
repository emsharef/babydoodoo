'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * BottomSheet v4 (with animation + proper interaction gating)
 */
export default function BottomSheet({ open, onClose, children, autoHideMs = 5000, onBecomeSticky }) {
  const ANIM_MS = 500;

  const [mounted, setMounted] = useState(open);
  const [animOpen, setAnimOpen] = useState(false);
  const stickyRef = useRef(false);
  const autoTimerRef = useRef(null);
  const closeTimerRef = useRef(null);
  const rootRef = useRef(null);
  const openedAtRef = useRef(0);
  const drag = useRef({ startY: 0, dy: 0, dragging: false });

  const startAutoTimer = () => {
    clearAutoTimer();
    autoTimerRef.current = setTimeout(() => {
      if (!stickyRef.current) onClose?.();
    }, autoHideMs);
  };
  const clearAutoTimer = () => { if (autoTimerRef.current) { clearTimeout(autoTimerRef.current); autoTimerRef.current = null; } };
  const clearCloseTimer = () => { if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; } };

  useEffect(() => {
    if (open) {
      setMounted(true);
      stickyRef.current = false;
      openedAtRef.current = Date.now();
      startAutoTimer();
      requestAnimationFrame(() => setAnimOpen(true));
    } else {
      clearAutoTimer();
      setAnimOpen(false);
      clearCloseTimer();
      closeTimerRef.current = setTimeout(() => setMounted(false), ANIM_MS);
    }
    return () => {};
  }, [open, autoHideMs, onClose]);

  useEffect(() => () => { clearAutoTimer(); clearCloseTimer(); }, []);

  const makeSticky = () => {
    if (Date.now() - openedAtRef.current < 120) return;
    if (!stickyRef.current) {
      stickyRef.current = true;
      clearAutoTimer();
      onBecomeSticky?.();
    }
  };

  useEffect(() => {
    if (!mounted) return;
    const el = rootRef.current;
    if (!el) return;
    el.addEventListener('click', makeSticky);
    el.addEventListener('input', makeSticky);
    el.addEventListener('change', makeSticky);
    el.addEventListener('keydown', makeSticky);
    return () => {
      el.removeEventListener('click', makeSticky);
      el.removeEventListener('input', makeSticky);
      el.removeEventListener('change', makeSticky);
      el.removeEventListener('keydown', makeSticky);
    };
  }, [mounted]);

  const dismiss = () => {
    clearAutoTimer();
    setAnimOpen(false);
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setMounted(false);
      onClose?.();
    }, ANIM_MS);
  };

  function onHandlePointerDown(e) {
    const y = (e.touches && e.touches[0]?.clientY) ?? e.clientY ?? 0;
    drag.current = { startY: y, dy: 0, dragging: true };
  }
  function onHandlePointerMove(e) {
    if (!drag.current.dragging) return;
    const y = (e.touches && e.touches[0]?.clientY) ?? e.clientY ?? 0;
    drag.current.dy = y - drag.current.startY;
  }
  function onHandlePointerUp() {
    const { dy, dragging } = drag.current;
    drag.current.dragging = false;
    if (!dragging || dy > 20 || Math.abs(dy) < 4) {
      dismiss();
    }
  }
  function onHandleClick(e) {
    e.stopPropagation();
    dismiss();
  }

  if (!mounted) return null;
  return (
    <div style={wrapStyle} aria-hidden={!open}>
      <div ref={rootRef} style={sheetStyle(animOpen)}>
        <div
          role="button"
          aria-label="Dismiss"
          onMouseDown={onHandlePointerDown}
          onMouseMove={onHandlePointerMove}
          onMouseUp={onHandlePointerUp}
          onTouchStart={onHandlePointerDown}
          onTouchMove={onHandlePointerMove}
          onTouchEnd={onHandlePointerUp}
          onClick={onHandleClick}
          style={handleStyle}
        />
        {children}
      </div>
    </div>
  );
}

const wrapStyle = {
  position: 'fixed', left: 0, right: 0, bottom: 0, top: 0,
  display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
  background: 'transparent', pointerEvents: 'none', zIndex: 50
};
const sheetStyle = (animOpen) => ({
  pointerEvents: 'auto',
  width: '100%', maxWidth: 960, margin: '0 auto',
  background: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16,
  boxShadow: '0 -8px 30px rgba(0,0,0,.12)',
  padding: 12,
  transform: `translateY(${animOpen ? '0%' : '100%'})`,
  transition: 'transform .5s ease',
  border: '1px solid #eee'
});
const handleStyle = { width: 64, height: 8, borderRadius: 4, background: '#d8d8d8', margin: '6px auto 12px', cursor: 'grab' };
