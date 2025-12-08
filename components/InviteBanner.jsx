'use client';
import { useState } from 'react';
import { useBaby } from './BabyContext';
import { useLanguage } from './LanguageContext';
import { supabase } from '@/lib/supabaseClient';

export default function InviteBanner() {
    const { pendingInvites, refreshBabies, selectBaby } = useBaby();
    const { t } = useLanguage();
    const [accepting, setAccepting] = useState(null);

    if (!pendingInvites || pendingInvites.length === 0) return null;

    async function acceptInvite(invite) {
        setAccepting(invite.id);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) throw new Error('No session');

            const res = await fetch('/api/invites/accept', {
                method: 'POST',
                headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
                body: JSON.stringify({ invite_id: invite.id })
            });

            if (!res.ok) throw new Error('Failed to accept');

            const payload = await res.json();
            const babyId = payload?.baby_id || payload?.membership?.baby_id;

            await refreshBabies();
            if (babyId) selectBaby(babyId);
        } catch (err) {
            console.error('acceptInvite error', err);
            alert(t('share.failed_accept') || 'Failed to accept invite');
        } finally {
            setAccepting(null);
        }
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 16px', background: '#fff8e6', borderBottom: '1px solid #ffeeba' }}>
            {pendingInvites.map(invite => (
                <div key={invite.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 14 }}>
                    <span style={{ color: '#7a6000' }}>
                        {t('share.invite_received').replace('{name}', invite.babies?.name || 'a baby')} ({t(`share.role_${invite.role}`) || invite.role})
                    </span>
                    <button
                        onClick={() => acceptInvite(invite)}
                        disabled={accepting === invite.id}
                        style={{
                            padding: '6px 12px',
                            borderRadius: 8,
                            background: '#ffc107',
                            color: '#000',
                            border: 'none',
                            fontWeight: 600,
                            cursor: accepting ? 'not-allowed' : 'pointer',
                            opacity: accepting ? 0.7 : 1
                        }}
                    >
                        {accepting === invite.id ? (t('share.accepting') || 'Accepting...') : (t('share.accept') || 'Accept')}
                    </button>
                </div>
            ))}
        </div>
    );
}
