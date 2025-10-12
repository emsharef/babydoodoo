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
  const { babies, selectedBabyId, selectBaby } = useBaby();
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user || null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => subscription.unsubscribe();
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
      <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
        <IconLink href="/" Icon={IconNotebook} />
        <IconLink href="/analytics" Icon={IconChartBar} />
        <IconLink href="/share" Icon={IconUsersGroup} />
        <IconLink href="/settings" Icon={IconSettings} />
      </div>
      <div style={{ marginLeft: 'auto', display:'flex', gap:8, alignItems:'center' }}>
        <select id="babySelectTop" value={selectedBabyId} onChange={(e)=>selectBaby(e.target.value)} style={{ padding:'8px 10px', borderRadius:10, border:'1px solid #ccc', minWidth: 120 }}>
          <option value="" disabled>Select...</option>
          {babies.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>
      <div style={{ position: 'relative', marginLeft: 12 }} ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen(prev => !prev)}
          style={{
            width: 40,
            height: 40,
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
          <IconUserCircle size={22} stroke={1.8} color="#1f2933" />
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

function IconLink({ href, Icon }) {
  return (
    <Link
      href={href}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4px',
        borderRadius: 8,
        border: '1px solid #e5e5e5',
        background: '#fafafa',
        textDecoration: 'none',
        color: '#222',
        width: 30,
        height: 30,
        fontWeight: 600,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <Icon size={24} stroke={1.8} />
    </Link>
  );
}
