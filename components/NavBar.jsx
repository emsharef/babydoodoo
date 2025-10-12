'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { IconNotebook, IconChartBar, IconUsersGroup, IconSettings, IconUserCircle } from '@tabler/icons-react';
import { supabase } from '@/lib/supabaseClient';
import { useBaby } from './BabyContext';

export default function NavBar() {
  const [user, setUser] = useState(null);
  const [signingOut, setSigningOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const [isNarrow, setIsNarrow] = useState(false);
  const { babies, selectedBabyId, selectBaby } = useBaby();
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user || null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    // Adjust icon sizes on narrow screens without changing appearance via CSS
    function update() {
      try {
        setIsNarrow((typeof window !== 'undefined') ? window.innerWidth <= 480 : false);
      } catch {}
    }
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    function handleClickAway(event) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickAway);
      document.addEventListener('touchstart', handleClickAway);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickAway);
      document.removeEventListener('touchstart', handleClickAway);
    };
  }, [menuOpen]);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
    } finally {
      setSigningOut(false);
      setMenuOpen(false);
    }
  }

  if (!user) return null;
  return (
    <nav style={{ display: 'flex', gap: 8, padding: 8, background: '#fff', border: '1px solid #eee', borderRadius: 12, alignItems:'center' }}>
      <div style={{ display:'flex', gap:isNarrow ? 4 : 8, alignItems:'center', flexWrap:'nowrap', overflowX:'auto' }}>
        <IconLink href="/" Icon={IconNotebook} isNarrow={isNarrow} />
        <IconLink href="/analytics" Icon={IconChartBar} isNarrow={isNarrow} />
        <IconLink href="/share" Icon={IconUsersGroup} isNarrow={isNarrow} />
        <IconLink href="/settings" Icon={IconSettings} isNarrow={isNarrow} />
      </div>
      <div style={{ marginLeft: 'auto', display:'flex', gap:8, alignItems:'center' }}>
        <select id="babySelectTop" value={selectedBabyId} onChange={(e)=>selectBaby(e.target.value)} style={{ padding:isNarrow ? '6px 8px' : '8px 10px', borderRadius:10, border:'1px solid #ccc', minWidth: isNarrow ? 100 : 120 }}>
          <option value="" disabled>Select...</option>
          {babies.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>
      <div style={{ position: 'relative', marginLeft: 12 }} ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen(prev => !prev)}
          style={{
            width: isNarrow ? 32 : 40,
            height: isNarrow ? 32 : 40,
            borderRadius: '50%',
            border: '1px solid #e5e5e5',
            background: '#fafafa',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
          title="Account"
        >
          <IconUserCircle size={isNarrow ? 18 : 22} stroke={1.8} color="#1f2933" />
        </button>
        {menuOpen && (
          <div
            style={{
              position: 'absolute',
              right: 0,
              marginTop: 6,
              width: 220,
              background: '#fff',
              border: '1px solid #e5e5e5',
              borderRadius: 12,
              boxShadow: '0 6px 24px rgba(15, 23, 42, 0.12)',
              padding: '12px 14px',
              display: 'grid',
              gap: 10,
              zIndex: 40,
            }}
          >
            <div style={{ fontSize: 13, color: '#444', wordBreak: 'break-all' }}>{user.email || 'Signed in'}</div>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              style={{
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid #f0b3b3',
                background: signingOut ? '#fbe2e2' : '#ffe5e5',
                color: '#c0392b',
                fontWeight: 600,
                cursor: signingOut ? 'wait' : 'pointer',
              }}
            >
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
const linkStyle = { padding: '10px 12px', borderRadius: 10, border: '1px solid #e5e5e5', background: '#fafafa', textDecoration: 'none', color: '#222', fontWeight: 600, fontFamily: 'Inter, system-ui, sans-serif' };

function IconLink({ href, Icon, isNarrow }) {
  return (
    <Link
      href={href}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isNarrow ? '3px' : '4px',
        borderRadius: 8,
        border: '1px solid #e5e5e5',
        background: '#fafafa',
        textDecoration: 'none',
        color: '#222',
        width: isNarrow ? 26 : 30,
        height: isNarrow ? 26 : 30,
        fontWeight: 600,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <Icon size={isNarrow ? 20 : 24} stroke={1.8} />
    </Link>
  );
}
