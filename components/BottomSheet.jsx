'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * BottomSheet v4
 * - 500ms slide up/down animation
 * - Auto-hide after 5000ms unless the user interacts (click, input, change, keydown)
 * - Clicking OR dragging the handle dismisses (drag threshold 20px)
 * - Ignores interactions for the first 120ms to avoid the initial tap that opened it
 * - Properly animates both open and close (doesn't just appear/pop)
 */
export default function BottomSheet({ open, onClose, children, autoHideMs = 5000, onBecomeSticky }) {
  const ANIM_MS = 500;

  const [mounted, setMounted] = useState(open);   // controls presence in DOM
  const [animOpen, setAnimOpen] = useState(false); // controls slide transform
  const stickyRef = useRef(false);
  const autoTimerRef = useRef(null);
  const closeTimerRef = useRef(null);
  const rootRef = useRef(null);
  const openedAtRef = useRef(0);
  const drag = useRef({ startY: 0, dy: 0, dragging: false });

  // Helper: start auto-hide timer
  const startAutoTimer = () => {
    clearAutoTimer();
    autoTimerRef.current = setTimeout(() => {
      if (!stickyRef.current) {
        // Ask parent to close; parent sets open=false, which triggers close animation here.
        onClose?.();
      }
    }, autoHideMs);
  };
  const clearAutoTimer = () => { if (autoTimerRef.current) { clearTimeout(autoTimerRef.current); autoTimerRef.current = null; } };
  const clearCloseTimer = () => { if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; } };

  // Respond to `open` prop
  useEffect(() => {
    if (open) {
      // mount, then animate in
      setMounted(true);
      stickyRef.current = false;
      openedAtRef.current = Date.now();
      // schedule auto-hide
      startAutoTimer();
      // next frame: slide up
      requestAnimationFrame(() => setAnimOpen(true));
    } else {
      // animate out, then unmount
      clearAutoTimer();
      setAnimOpen(false);
      clearCloseTimer();
      closeTimerRef.current = setTimeout(() => setMounted(false), ANIM_MS);
    }
    return () => { /* no-op */ };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, autoHideMs]);

  useEffect(() => () => { clearAutoTimer(); clearCloseTimer(); }, []);

  // Make sticky (cancel auto-hide) on any *real* interaction inside the sheet
  const makeSticky = (e) => {
    // ignore interactions in the first bit after opening to avoid the initial tap
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
    // Broad set of events; "click" (not pointerdown) avoids capturing the initial tap used to open.
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
  }, [mounted]); // eslint-disable-line react-hooks/exhaustive-deps

  // Programmatic dismiss (used by handle/tap)
  const dismiss = () => {
    clearAutoTimer();
    setAnimOpen(false);
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setMounted(false);
      onClose?.();
    }, ANIM_MS);
  };

  // Handle interactions on the grab handle to dismiss
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
    // If dragged down > 20px or it's a quick tap (|dy| < 4), dismiss
    if (!dragging || dy > 20 || Math.abs(dy) < 4) {
      dismiss();
    }
  }
  function onHandleClick(e) {
    e.stopPropagation(); // prevent root 'click' from making sticky
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
  width: '100%', maxWidth: 860, margin: '0 auto',
  background: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16,
  boxShadow: '0 -8px 30px rgba(0,0,0,.12)',
  padding: 12,
  transform: `translateY(${animOpen ? '0%' : '100%'})`,
  transition: 'transform .5s ease', // 500ms slide animation
  border: '1px solid #eee'
});

const handleStyle = {
  width: 60, height: 8, borderRadius: 4, background: '#d8d8d8',
  margin: '6px auto 12px', cursor: 'grab'
};
