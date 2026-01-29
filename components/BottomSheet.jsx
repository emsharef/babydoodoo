'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * BottomSheet - Redesigned with dramatic animations and better visuals
 */
export default function BottomSheet({ open, onClose, children, autoHideMs = 5000, eventType, eventColor }) {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const timerRef = useRef(null);
  const interactedRef = useRef(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      requestAnimationFrame(() => setVisible(true));
    } else if (mounted) {
      setVisible(false);
      const t = setTimeout(() => setMounted(false), 400);
      return () => clearTimeout(t);
    }
  }, [open, mounted]);

  useEffect(() => {
    if (!open) return;
    if (!autoHideMs || autoHideMs <= 0) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (!interactedRef.current) {
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
    setVisible(false);
    setTimeout(() => {
      onClose?.();
      interactedRef.current = false;
    }, 400);
  }

  if (!mounted) return null;

  const bgColor = eventColor?.bg || '#f8fafc';
  const borderColor = eventColor?.bd || '#e2e8f0';

  return (
    <>
      <style jsx global>{`
        @keyframes sheetSlideUp {
          0% { transform: translateY(100%); opacity: 0.8; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes sheetSlideDown {
          0% { transform: translateY(0); opacity: 1; }
          100% { transform: translateY(100%); opacity: 0.8; }
        }
        @keyframes backdropFadeIn {
          0% { opacity: 0; backdrop-filter: blur(0px); }
          100% { opacity: 1; backdrop-filter: blur(8px); }
        }
        @keyframes backdropFadeOut {
          0% { opacity: 1; backdrop-filter: blur(8px); }
          100% { opacity: 0; backdrop-filter: blur(0px); }
        }
      `}</style>
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
          background: 'rgba(15, 23, 42, 0.4)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          animation: visible ? 'backdropFadeIn 0.3s ease-out forwards' : 'backdropFadeOut 0.3s ease-out forwards',
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) handleClose();
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          style={{
            width: '100%',
            maxHeight: '85vh',
            overflowY: 'auto',
            background: '#ffffff',
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            boxShadow: '0 -12px 48px rgba(15, 23, 42, 0.2), 0 -4px 16px rgba(15, 23, 42, 0.1)',
            animation: visible ? 'sheetSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards' : 'sheetSlideDown 0.35s cubic-bezier(0.4, 0, 1, 1) forwards',
            willChange: 'transform, opacity',
          }}
        >
          {/* Header with gradient based on event type */}
          <div
            style={{
              background: `linear-gradient(135deg, ${bgColor} 0%, ${bgColor}90 100%)`,
              borderBottom: `1px solid ${borderColor}`,
              padding: '16px 20px 14px',
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              position: 'sticky',
              top: 0,
              zIndex: 1,
            }}
          >
            {/* Drag handle */}
            <div
              onClick={handleClose}
              style={{
                display: 'flex',
                justifyContent: 'center',
                marginBottom: 12,
                cursor: 'grab',
              }}
            >
              <div style={{
                width: 40,
                height: 4,
                borderRadius: 999,
                background: borderColor,
                opacity: 0.8,
              }} />
            </div>

            {/* Event type indicator */}
            {eventType && eventColor && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}>
                <span style={{
                  fontSize: 28,
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))',
                }}>{eventColor.emoji}</span>
                <span style={{
                  fontSize: 18,
                  fontWeight: 700,
                  fontFamily: 'Nunito, Inter, sans-serif',
                  color: '#1e293b',
                }}>{eventType}</span>
              </div>
            )}
          </div>

          {/* Content */}
          <div style={{ padding: '20px 20px 32px' }}>
            {children}
          </div>
        </div>
      </div>
    </>
  );
}
