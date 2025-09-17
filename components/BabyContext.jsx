'use client';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

const KEY = 'bd_selected_baby';
const BabyCtx = createContext(null);

export function useBaby() {
  const ctx = useContext(BabyCtx);
  if (!ctx) throw new Error('useBaby must be used within BabyProvider');
  return ctx;
}

export default function BabyProvider({ children }) {
  const [user, setUser] = useState(null);
  const [babies, setBabies] = useState([]);
  const [selectedBabyId, setSelectedBabyId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!mounted) return;
      setUser(user);
      if (user) await refreshBabies();
      else { setBabies([]); setSelectedBabyId(''); setLoading(false); }
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      if (session?.user) refreshBabies();
      else { setBabies([]); setSelectedBabyId(''); }
    });
    init();
    return () => subscription.unsubscribe();
  }, []);

  async function refreshBabies() {
    setLoading(true);
    const { data, error } = await supabase.from('babies').select('*').order('created_at', { ascending:false });
    if (!error) {
      setBabies(data||[]);
      let saved = ''; try { saved = localStorage.getItem(KEY) || ''; } catch {}
      const current = saved && (data||[]).some(b => b.id===saved) ? saved : (data&&data[0]?.id) || '';
      setSelectedBabyId(current);
    }
    setLoading(false);
  }

  function selectBaby(id) {
    setSelectedBabyId(id || '');
    try { localStorage.setItem(KEY, id || ''); } catch {}
  }

  const value = useMemo(() => ({ user, babies, selectedBabyId, selectBaby, refreshBabies, loading }), [user, babies, selectedBabyId, loading]);

  return <BabyCtx.Provider value={value}>{children}</BabyCtx.Provider>;
}
