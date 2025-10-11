'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

function CallbackContent() {
  const router = useRouter();
  const sp = useSearchParams();
  const [status, setStatus] = useState('Finishing sign-in...');

  useEffect(() => {
    const next = sp.get('next') || '/';
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) { setStatus('Signed in! Redirecting...'); router.replace(next); }
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) { setStatus('Signed in! Redirecting...'); router.replace(next); }
      else setStatus('Waiting for session...');
    });
    return () => { subscription.unsubscribe(); };
  }, [router, sp]);

  return (
    <div style={{ padding: 24 }}>
      <h1>Auth</h1>
      <p>{status}</p>
    </div>
  );
}

function CallbackFallback() {
  return (
    <div style={{ padding: 24 }}>
      <h1>Auth</h1>
      <p>Preparing redirect…</p>
    </div>
  );
}

export default function AuthCallback() {
  return (
    <Suspense fallback={<CallbackFallback />}>
      <CallbackContent />
    </Suspense>
  );
}
