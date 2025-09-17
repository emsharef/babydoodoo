'use client';
import { useEffect, useState } from 'react';

export default function Toast({ open, message, actionText, onAction, autoCloseMs = 3000, onClose }) {
  const [visible, setVisible] = useState(open);
  useEffect(() => {
    setVisible(open);
    if (open) {
      const t = setTimeout(() => { setVisible(false); onClose?.(); }, autoCloseMs);
      return () => clearTimeout(t);
    }
  }, [open, autoCloseMs, onClose]);
  if (!visible) return null;
  return (
    <div style={wrapStyle}>
      <div style={toastStyle}>
        <span>{message}</span>
        {actionText && <button onClick={onAction} style={btnStyle}>{actionText}</button>}
      </div>
    </div>
  );
}
const wrapStyle = { position:'fixed', left:0, right:0, bottom:16, display:'flex', justifyContent:'center', pointerEvents:'none', zIndex:60 };
const toastStyle = { pointerEvents:'auto', display:'flex', gap:12, alignItems:'center', background:'#222', color:'#fff', padding:'10px 14px', borderRadius:12, boxShadow:'0 4px 14px rgba(0,0,0,.2)' };
const btnStyle = { marginLeft:8, padding:'6px 10px', borderRadius:8, border:'1px solid #555', background:'#444', color:'#fff', cursor:'pointer' };
