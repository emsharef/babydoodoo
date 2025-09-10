'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('Finishing sign-in...');

  useEffect(() => {
    const next = searchParams.get('next') || '/';

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setStatus('Signed in! Redirecting...');
        router.replace(next);
      }
    });

    // In case the session is already set by detectSessionInUrl:
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setStatus('Signed in! Redirecting...');
        router.replace(next);
      } else {
        setStatus('Waiting for session...');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router, searchParams]);

  return (
    <div style={{ padding: 24 }}>
      <h1>Auth Callback</h1>
      <p>{status}</p>
      <p style={{ fontSize: 12, opacity: 0.7 }}>You will be redirected automatically.</p>
    </div>
  );
}
