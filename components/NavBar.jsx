'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { IconNotebook, IconChartBar, IconUsersGroup, IconSettings, IconUserCircle, IconTools } from '@tabler/icons-react';
import { supabase } from '@/lib/supabaseClient';
import { useBaby } from './BabyContext';
import { useLanguage } from './LanguageContext';

export default function NavBar() {
  const [user, setUser] = useState(null);
  const [signingOut, setSigningOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const [isNarrow, setIsNarrow] = useState(false);
  const { babies, selectedBabyId, selectBaby, role } = useBaby();
  const { language, setLanguage, t } = useLanguage();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user || null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    // Adjust icon sizes on narrow screens without changing appearance via CSS
    function update() {
      try {
        setIsNarrow((typeof window !== 'undefined') ? window.innerWidth <= 600 : false);
      } catch { }
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
    <nav style={{
      display: 'flex',
      gap: isNarrow ? 4 : 8,
      padding: isNarrow ? '8px 8px' : '12px 12px',
      background: 'rgba(255, 255, 255, 0.7)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      border: '1px solid rgba(255, 255, 255, 0.8)',
      borderRadius: 16,
      alignItems: 'center',
      boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)',
      maxWidth: '100%',
      boxSizing: 'border-box',
      overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', gap: isNarrow ? 4 : 8, alignItems: 'center', flexWrap: 'nowrap', minWidth: 0, flexShrink: 1 }}>
        <IconLink href="/" Icon={IconNotebook} isNarrow={isNarrow} />
        <IconLink href="/analytics" Icon={IconChartBar} isNarrow={isNarrow} />
        {role !== 'viewer' && (
          <>
            <IconLink href="/tools" Icon={IconTools} isNarrow={isNarrow} />
            <IconLink href="/share" Icon={IconUsersGroup} isNarrow={isNarrow} />
            <IconLink href="/settings" Icon={IconSettings} isNarrow={isNarrow} />
          </>
        )}
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: isNarrow ? 4 : 8, alignItems: 'center', flexShrink: 1, minWidth: 0 }}>
        <select
          id="babySelectTop"
          value={selectedBabyId}
          onChange={(e) => selectBaby(e.target.value)}
          style={{
            padding: isNarrow ? '6px 8px' : '10px 14px',
            borderRadius: 12,
            border: '1px solid rgba(0, 0, 0, 0.08)',
            background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
            minWidth: 0,
            maxWidth: isNarrow ? 80 : 130,
            fontSize: isNarrow ? 13 : 14,
            fontWeight: 500,
            color: '#334155',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
            cursor: 'pointer',
            flexShrink: 1,
          }}
        >
          <option value="" disabled>{t('nav.select_baby')}</option>
          {babies.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>
      <div style={{ position: 'relative', marginLeft: isNarrow ? 4 : 8, flexShrink: 0 }} ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen(prev => !prev)}
          style={{
            width: isNarrow ? 32 : 42,
            height: isNarrow ? 32 : 42,
            borderRadius: '50%',
            border: '2px solid rgba(139, 92, 246, 0.2)',
            background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(139, 92, 246, 0.15)',
            transition: 'all 0.2s ease',
          }}
          title="Account"
        >
          <IconUserCircle size={isNarrow ? 18 : 24} stroke={1.8} color="#7c3aed" />
        </button>
        {menuOpen && (
          <div
            style={{
              position: 'absolute',
              right: 0,
              marginTop: 8,
              width: 240,
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.8)',
              borderRadius: 16,
              boxShadow: '0 12px 40px rgba(15, 23, 42, 0.15), 0 4px 12px rgba(15, 23, 42, 0.05)',
              padding: '16px',
              display: 'grid',
              gap: 12,
              zIndex: 40,
            }}
          >
            <div style={{
              fontSize: 13,
              color: '#64748b',
              wordBreak: 'break-all',
              padding: '8px 12px',
              background: '#f8fafc',
              borderRadius: 10,
            }}>{user.email || t('nav.signed_in')}</div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, padding: '0 4px' }}>
              <span style={{ color: '#475569', fontWeight: 500 }}>{t('nav.language')}</span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  onClick={() => setLanguage('en')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: language === 'en' ? '2px solid #8b5cf6' : '1px solid #e2e8f0',
                    background: language === 'en' ? 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)' : '#fff',
                    color: language === 'en' ? '#7c3aed' : '#64748b',
                    cursor: 'pointer',
                    fontWeight: 600,
                    transition: 'all 0.15s ease',
                  }}
                >
                  EN
                </button>
                <button
                  onClick={() => setLanguage('zh')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: language === 'zh' ? '2px solid #8b5cf6' : '1px solid #e2e8f0',
                    background: language === 'zh' ? 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)' : '#fff',
                    color: language === 'zh' ? '#7c3aed' : '#64748b',
                    cursor: 'pointer',
                    fontWeight: 600,
                    transition: 'all 0.15s ease',
                  }}
                >
                  中文
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              style={{
                padding: '12px 14px',
                borderRadius: 12,
                border: '1px solid #fecaca',
                background: signingOut
                  ? '#fee2e2'
                  : 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
                color: '#dc2626',
                fontWeight: 600,
                cursor: signingOut ? 'wait' : 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {signingOut ? t('nav.signing_out') : t('nav.sign_out')}
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}

function IconLink({ href, Icon, isNarrow }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Link
      href={href}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isNarrow ? '5px' : '8px',
        borderRadius: 10,
        border: isHovered ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid rgba(0, 0, 0, 0.06)',
        background: isHovered
          ? 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)'
          : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
        textDecoration: 'none',
        color: isHovered ? '#7c3aed' : '#475569',
        width: isNarrow ? 30 : 38,
        height: isNarrow ? 30 : 38,
        flexShrink: 0,
        fontWeight: 600,
        fontFamily: 'Inter, system-ui, sans-serif',
        boxShadow: isHovered
          ? '0 4px 12px rgba(139, 92, 246, 0.15)'
          : '0 2px 6px rgba(0, 0, 0, 0.04)',
        transform: isHovered ? 'translateY(-1px)' : 'translateY(0)',
        transition: 'all 0.15s ease-out',
      }}
    >
      <Icon size={isNarrow ? 18 : 22} stroke={1.8} />
    </Link>
  );
}
