'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * BottomSheet - Modern, polished design with smooth animations
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
  const emoji = eventColor?.emoji || '';

  return (
    <>
      <style jsx global>{`
        @keyframes sheetSlideUp {
          0% { transform: translateY(100%); }
          100% { transform: translateY(0); }
        }
        @keyframes sheetSlideDown {
          0% { transform: translateY(0); }
          100% { transform: translateY(100%); }
        }
        @keyframes backdropFadeIn {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes backdropFadeOut {
          0% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes emojiPop {
          0% { transform: scale(0.5); opacity: 0; }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
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
          background: 'rgba(15, 23, 42, 0.5)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          animation: visible ? 'backdropFadeIn 0.25s ease-out forwards' : 'backdropFadeOut 0.25s ease-out forwards',
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
            maxHeight: '90vh',
            overflowY: 'auto',
            background: '#ffffff',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            boxShadow: '0 -8px 32px rgba(15, 23, 42, 0.15)',
            animation: visible ? 'sheetSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards' : 'sheetSlideDown 0.3s cubic-bezier(0.4, 0, 1, 1) forwards',
          }}
        >
          {/* Drag handle */}
          <div
            onClick={handleClose}
            style={{
              display: 'flex',
              justifyContent: 'center',
              padding: '12px 0 8px',
              cursor: 'pointer',
            }}
          >
            <div style={{
              width: 36,
              height: 4,
              borderRadius: 999,
              background: '#d1d5db',
            }} />
          </div>

          {/* Header with event type */}
          {eventType && eventColor && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '8px 24px 20px',
                borderBottom: `1px solid ${borderColor}40`,
              }}
            >
              {/* Emoji circle */}
              <div style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: `linear-gradient(145deg, ${bgColor} 0%, ${bgColor}cc 100%)`,
                border: `2px solid ${borderColor}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: `0 4px 12px ${borderColor}40`,
                animation: 'emojiPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s both',
              }}>
                <span style={{
                  fontSize: 28,
                  lineHeight: 1,
                }}>{emoji}</span>
              </div>
              {/* Event name and subtitle */}
              <div>
                <div style={{
                  fontSize: 20,
                  fontWeight: 700,
                  fontFamily: 'Nunito, Inter, sans-serif',
                  color: '#1e293b',
                  lineHeight: 1.2,
                }}>{eventType}</div>
                <div style={{
                  fontSize: 13,
                  color: '#64748b',
                  marginTop: 2,
                }}>Tap to add details</div>
              </div>
            </div>
          )}

          {/* Content area */}
          <div style={{
            padding: '20px 24px 28px',
            background: '#fafbfc',
          }}>
            {children}
          </div>
        </div>
      </div>
    </>
  );
}
