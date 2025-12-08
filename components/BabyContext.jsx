'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
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
  const [role, setRole] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!mounted) return;
      setUser(user);
      if (user) await refreshBabies();
      else { setBabies([]); setSelectedBabyId(''); setLoading(false); setRole(null); }
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      if (session?.user) refreshBabies();
      else { setBabies([]); setSelectedBabyId(''); setRole(null); }
    });
    init();
    return () => subscription.unsubscribe();
  }, []);

  const [pendingInvites, setPendingInvites] = useState([]);

  const refreshBabies = useCallback(async () => {
    setLoading(true);
    // Fetch babies the user owns or is a member of
    const { data: babiesData, error: babiesError } = await supabase.from('babies').select('*').order('created_at', { ascending: false });

    if (!babiesError) {
      const babiesList = babiesData || [];
      setBabies(babiesList);

      // Now determine selection
      let saved = ''; try { saved = localStorage.getItem(KEY) || ''; } catch { }
      const current = saved && babiesList.some(b => b.id === saved) ? saved : (babiesList[0]?.id) || '';
      setSelectedBabyId(current);
    }

    // Fetch pending invites
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: invites } = await supabase.from('invites')
        .select('*, babies(name)')
        .eq('email', user.email)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      setPendingInvites(invites || []);
    } else {
      setPendingInvites([]);
    }

    setLoading(false);
  }, []);

  // Effect to update role when selectedBabyId or user changes
  useEffect(() => {
    async function fetchRole() {
      if (!selectedBabyId || !user) {
        setRole(null);
        return;
      }
      // Check if owner
      const baby = babies.find(b => b.id === selectedBabyId);
      if (baby && baby.user_id === user.id) {
        setRole('owner');
        return;
      }
      // Check membership
      const { data, error } = await supabase.from('memberships')
        .select('role')
        .eq('baby_id', selectedBabyId)
        .eq('user_id', user.id)
        .single();

      if (data) setRole(data.role);
      else setRole(null); // Should not happen if RLS works and we have the baby
    }
    fetchRole();
  }, [selectedBabyId, user, babies]);

  const selectBaby = useCallback((id) => {
    setSelectedBabyId(id || '');
    try { localStorage.setItem(KEY, id || ''); } catch { }
  }, []);

  const value = useMemo(() => ({ user, babies, selectedBabyId, role, selectBaby, refreshBabies, loading, pendingInvites }), [user, babies, selectedBabyId, role, selectBaby, refreshBabies, loading, pendingInvites]);

  return <BabyCtx.Provider value={value}>{children}</BabyCtx.Provider>;
}
