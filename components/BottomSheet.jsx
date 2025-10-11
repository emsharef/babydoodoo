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
        position:'fixed', inset:0, zIndex:60,
        display:'flex', alignItems:'flex-end',
        background: visible ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0)',
        transition:'background 500ms ease'
      }}
      onClick={(e)=>{
        // click on backdrop closes
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        style={{
          width:'100%',
          background:'#fff',
          borderTopLeftRadius:16,
          borderTopRightRadius:16,
          boxShadow:'0 -6px 24px rgba(0,0,0,0.12)',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition:'transform 500ms ease',
          willChange:'transform'
        }}
      >
        <div
          onClick={handleClose}
          onMouseDown={handleInteraction}
          onTouchStart={handleInteraction}
          style={{ display:'flex', justifyContent:'center', paddingTop:10, paddingBottom:6, cursor:'grab' }}
        >
          <div style={{ width:48, height:6, borderRadius:999, background:'#ddd' }} />
        </div>
        <div style={{ padding:12 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
