'use client';
export default function IconButton({ emoji, label, color='#fff3b0', border='#f0d264', onClick }) {
  return (
    <button onClick={onClick} style={btn(color, border)}>
      <span style={{ fontSize: 22, marginRight: 8 }}>{emoji}</span>
      <span style={{ fontWeight: 700 }}>{label}</span>
    </button>
  );
}
const btn = (bg, bd) => ({
  padding:'14px 16px', borderRadius:14, background:bg, border:`2px solid ${bd}`,
  cursor:'pointer', fontSize:16, fontWeight:600, boxShadow:'0 2px 0 rgba(0,0,0,.05)',
  display:'flex', alignItems:'center', justifyContent:'center', minWidth:120
});
