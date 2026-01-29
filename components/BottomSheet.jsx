'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * BottomSheet
 * - Smooth 500ms slide in/out
 * - Auto-hide after autoHideMs (if provided), cancelled on any interaction inside
 * - Clicking the handle or backdrop closes with slide-down animation
 */
export default function BottomSheet({ open, onClose, children, autoHideMs = 5000 }) {
  const [visible, setVisible] = useState(false);    // controls CSS class
  const [mounted, setMounted] = useState(false);    // keep in DOM for exit anim
  const timerRef = useRef(null);
  const interactedRef = useRef(false);

  // Mount/unmount handling
  useEffect(() => {
    if (open) {
      setMounted(true);
      // Next tick to allow transition
      requestAnimationFrame(() => setVisible(true));
    } else if (mounted) {
      setVisible(false);
      // After animation, unmount
      const t = setTimeout(() => setMounted(false), 500);
      return () => clearTimeout(t);
    }
  }, [open, mounted]);

  // Auto hide if provided and no interaction
  useEffect(() => {
    if (!open) return;
    if (!autoHideMs || autoHideMs <= 0) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (!interactedRef.current) {
        // trigger close path
        handleClose();
      }
    }, autoHideMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [open, autoHideMs]);

  function handleInteraction() {
    interactedRef.current = true;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function handleClose() {
    // slide down, then onClose after 500ms
    setVisible(false);
    setTimeout(() => {
      onClose?.();
      interactedRef.current = false;
    }, 500);
  }

  if (!mounted) return null;

  return (
    <div
      aria-hidden={!visible}
      onMouseDown={handleInteraction}
      onKeyDown={handleInteraction}
      onTouchStart={handleInteraction}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        alignItems: 'flex-end',
        background: visible ? 'rgba(15, 23, 42, 0.3)' : 'rgba(15, 23, 42, 0)',
        backdropFilter: visible ? 'blur(4px)' : 'blur(0px)',
        WebkitBackdropFilter: visible ? 'blur(4px)' : 'blur(0px)',
        transition: 'all 500ms ease'
      }}
      onClick={(e) => {
        // click on backdrop closes
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        style={{
          width: '100%',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,1) 100%)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          boxShadow: '0 -8px 40px rgba(15, 23, 42, 0.15), 0 -2px 12px rgba(15, 23, 42, 0.08)',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 500ms cubic-bezier(0.32, 0.72, 0, 1)',
          willChange: 'transform'
        }}
      >
        <div
          onClick={handleClose}
          onMouseDown={handleInteraction}
          onTouchStart={handleInteraction}
          style={{
            display: 'flex',
            justifyContent: 'center',
            paddingTop: 14,
            paddingBottom: 8,
            cursor: 'grab'
          }}
        >
          <div style={{
            width: 48,
            height: 5,
            borderRadius: 999,
            background: 'linear-gradient(90deg, #cbd5e1 0%, #94a3b8 50%, #cbd5e1 100%)',
          }} />
        </div>
        <div style={{ padding: '8px 20px 24px' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
