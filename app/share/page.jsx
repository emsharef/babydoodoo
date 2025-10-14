'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useBaby } from '@/components/BabyContext';

function Button({ children, onClick, style, type, disabled }) {
  return (
    <button
      type={type || 'button'}
      onClick={onClick}
      disabled={disabled}
      style={{
        padding:'12px 14px',
        borderRadius:12,
        background:'#e8f0ff',
        border:'1px solid #9db8ff',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        fontSize:15,
        fontWeight:600,
        ...style
      }}
    >
      {children}
    </button>
  );
}

export default function SharePage() {
  const router = useRouter();
  const { user, babies, selectedBabyId, selectBaby, refreshBabies } = useBaby();
  const [memberships, setMemberships] = useState([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('caregiver');
  const [babyInvites, setBabyInvites] = useState([]);
  const [myInvites, setMyInvites] = useState([]);
  const [newBabyName, setNewBabyName] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  useEffect(() => {
    if (!user) { router.replace('/'); return; }
    refreshBabies();
    refreshSharing(selectedBabyId);
    // Load my pending invites (visible via RLS)
    supabase.from('invites').select('*').eq('status','pending').order('created_at', { ascending:false }).then(({ data }) => {
      const me = (user.email||'').toLowerCase();
      setMyInvites((data||[]).filter(i => (i.email||'').toLowerCase()===me));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => { if (selectedBabyId) refreshSharing(selectedBabyId); }, [selectedBabyId]);

  async function refreshSharing(babyId) {
    if (!babyId) { setMemberships([]); setBabyInvites([]); return; }
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (token) {
      const res = await fetch(`/api/memberships?baby_id=${babyId}`, { headers: { authorization: `Bearer ${token}` } });
      if (res.ok) {
        const payload = await res.json();
        setMemberships(payload.memberships || []);
      } else setMemberships([]);
    }
    const { data: invitesData } = await supabase.from('invites').select('*').eq('baby_id', babyId).order('created_at', { ascending:false });
    setBabyInvites(invitesData||[]);
  }

  async function inviteUser() {
    if (!selectedBabyId) return alert('Select a baby first (top right).');
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token; if (!token) return alert('Missing session token.');
    const res = await fetch('/api/invites', { method:'POST', headers:{ 'content-type':'application/json', authorization:`Bearer ${token}` }, body: JSON.stringify({ baby_id: selectedBabyId, email: inviteEmail.trim(), role: inviteRole }) });
    if (!res.ok) { console.error('inviteUser error', await res.json().catch(()=>({}))); alert('Failed to invite.'); return; }
    setInviteEmail(''); refreshSharing(selectedBabyId);
  }

  async function revokeInvite(inviteId) {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token; if (!token) return alert('Missing session token.');
    const res = await fetch('/api/invites/revoke', { method:'POST', headers:{ 'content-type':'application/json', authorization:`Bearer ${token}` }, body: JSON.stringify({ invite_id: inviteId }) });
    if (!res.ok) { console.error('revokeInvite error', await res.json().catch(()=>({}))); alert('Failed to revoke invite.'); return; }
    refreshSharing(selectedBabyId);
  }

  async function acceptInvite(inviteId) {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token; if (!token) return alert('Missing session token.');
    const res = await fetch('/api/invites/accept', { method:'POST', headers:{ 'content-type':'application/json', authorization:`Bearer ${token}` }, body: JSON.stringify({ invite_id: inviteId }) });
    if (!res.ok) { console.error('acceptInvite error', await res.json().catch(()=>({}))); alert('Failed to accept invite.'); return; }
    const payload = await res.json();
    const babyId = payload?.baby_id || payload?.membership?.baby_id;
    await refreshBabies();
    if (babyId) { selectBaby(babyId); }
    await refreshSharing(babyId || selectedBabyId);
  }

  async function onCreateBaby(e) {
    e.preventDefault();
    if (!newBabyName.trim()) return;
    setCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { alert('Missing session token.'); return; }
      const res = await fetch('/api/babies', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: newBabyName.trim() }),
      });
      if (!res.ok) {
        console.error('createBaby error', await res.json().catch(()=>({})));
        alert('Failed to create baby.');
        return;
      }
      const { baby } = await res.json();
      setNewBabyName('');
      await refreshBabies();
      if (baby?.id) {
        selectBaby(baby.id);
        await refreshSharing(baby.id);
      }
    } catch (err) {
      console.error('createBaby exception', err);
      alert('Something went wrong creating the baby.');
    } finally {
      setCreating(false);
    }
  }

  async function onDeleteBaby() {
    if (!selectedBaby) return;
    if (!canDelete) {
      alert('Only parents can delete this baby.');
      return;
    }
    const confirmed = window.confirm(`Delete "${selectedBaby.name}"? All logs, invites, and analytics for this baby will be permanently removed.`);
    if (!confirmed) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('babies').delete().eq('id', selectedBaby.id);
      if (error) throw error;
      await refreshBabies();
      selectBaby('');
      setMemberships([]);
      setBabyInvites([]);
    } catch (err) {
      console.error('deleteBaby error', err);
      alert('Failed to delete baby. Please try again.');
    } finally {
      setDeleting(false);
    }
  }

  if (!user) return null;
  const selectedBaby = useMemo(() => babies.find(b => b.id === selectedBabyId) || null, [babies, selectedBabyId]);
  const myRole = useMemo(() => {
    if (!user || !selectedBaby) return null;
    if (selectedBaby.user_id === user.id) return 'owner';
    const ownMembership = memberships.find(m => m.user_id === user.id);
    return ownMembership?.role || null;
  }, [user, selectedBaby, memberships]);
  const canDelete = myRole === 'parent' || myRole === 'owner';

  useEffect(() => {
    setRenameValue(selectedBaby?.name || '');
  }, [selectedBaby?.id]);

  async function onRenameBaby(e) {
    e.preventDefault();
    if (!selectedBaby || !canDelete) return;
    const trimmed = renameValue.trim();
    if (!trimmed) return alert('Name cannot be empty.');
    if (trimmed === selectedBaby.name) return;
    setRenaming(true);
    try {
      const { error } = await supabase.from('babies').update({ name: trimmed }).eq('id', selectedBaby.id);
      if (error) throw error;
      await refreshBabies();
    } catch (err) {
      console.error('renameBaby error', err);
      alert('Failed to rename baby.');
    } finally {
      setRenaming(false);
    }
  }

  return (
    <div style={{ display:'grid', gap:16 }}>
      <section style={{ padding:16, border:'1px solid #eee', borderRadius:12, background:'#fff', display:'grid', gap:12 }}>
        <h2 style={{ marginTop:0 }}>Family</h2>

        <div style={{ padding:'14px 16px', border:'1px solid #ececf2', borderRadius:12, background:'#f9f9fd', display:'grid', gap:6 }}>
          <strong style={{ fontSize:15 }}>Current baby</strong>
          {selectedBaby ? (
            <>
              <div style={{ fontSize:16, fontWeight:600 }}>{selectedBaby.name}</div>
              <span style={{ fontSize:12, color:'#666' }}>Role: {myRole || 'viewer'}</span>
            </>
          ) : (
            <span style={{ fontSize:13, color:'#777' }}>Select a baby from the top navigation to manage family access.</span>
          )}
        </div>

        <div style={{ display:'grid', gap:8, marginTop: 8 }}>
          <h3 style={{ margin:'12px 0 4px' }}>Members</h3>
          {memberships.length === 0 ? (
            <p style={{ fontSize:13, color:'#666' }}>No members yet.</p>
          ) : (
            <ul style={{ listStyle:'none', padding:0, margin:0, display:'grid', gap:6 }}>
              {memberships.map(m => (
                <li
                  key={m.id}
                  style={{
                    padding:'10px 12px',
                    border:'1px solid #ececf2',
                    borderRadius:10,
                    background:'#f9f9fd',
                    fontSize:14,
                    display:'flex',
                    justifyContent:'space-between',
                    alignItems:'center'
                  }}
                >
                  <span><strong style={{ textTransform:'capitalize' }}>{m.role}</strong> — {m.email || m.user_id}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div style={{ display:'grid', gap:8, marginTop: 8 }}>
          <h3 style={{ margin:'12px 0 4px' }}>Invite someone</h3>
          <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
            <input value={inviteEmail} onChange={(e)=>setInviteEmail(e.target.value)} placeholder="Invitee email" style={{ padding:'10px 12px', borderRadius:10, border:'1px solid #ccc', minWidth:220 }} />
            <select value={inviteRole} onChange={(e)=>setInviteRole(e.target.value)} style={{ padding:'8px 10px', borderRadius:10, border:'1px solid #ccc' }}>
              <option value="caregiver">Caregiver</option>
              <option value="parent">Parent</option>
            </select>
            <Button onClick={inviteUser} style={{ background:'#c7f0d8', border:'1px solid #73c69c' }}>Invite</Button>
          </div>
        </div>

        <div style={{ display:'grid', gap:8, marginTop: 8 }}>
          <h3 style={{ margin:'12px 0 4px' }}>Invites for this baby</h3>
          {babyInvites.length === 0 ? (
            <p style={{ fontSize:13, color:'#666' }}>No invites.</p>
          ) : (
            <ul style={{ listStyle:'none', padding:0, margin:0, display:'grid', gap:6 }}>
              {babyInvites.map(inv => (
                <li
                  key={inv.id}
                  style={{
                    padding:'10px 12px',
                    border:'1px solid #f0e3e3',
                    borderRadius:10,
                    background:'#fffafa',
                    display:'flex',
                    justifyContent:'space-between',
                    alignItems:'center',
                    fontSize:14
                  }}
                >
                  <div><strong>{inv.role}</strong> — {inv.email} · <em>{inv.status}</em></div>
                  {inv.status === 'pending' && (
                    <button
                      onClick={()=>revokeInvite(inv.id)}
                      style={{ padding:'6px 10px', borderRadius:8, border:'1px solid #e5e5e5', background:'#fff' }}
                    >
                      Revoke
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div style={{ display:'grid', gap:8, marginTop: 8 }}>
          <h3 style={{ margin:'12px 0 4px' }}>Your pending invites</h3>
          {myInvites.length === 0 ? (
            <p style={{ fontSize:13, color:'#666' }}>None.</p>
          ) : (
            <ul style={{ listStyle:'none', padding:0, margin:0, display:'grid', gap:6 }}>
              {myInvites.map(inv => (
                <li
                  key={inv.id}
                  style={{
                    padding:'10px 12px',
                    border:'1px solid #ece3c5',
                    borderRadius:10,
                    background:'#fffaf0',
                    display:'flex',
                    justifyContent:'space-between',
                    alignItems:'center',
                    fontSize:14
                  }}
                >
                  <div><strong>{inv.role}</strong> — {inv.email} · <em>{inv.status}</em></div>
                  <Button onClick={()=>acceptInvite(inv.id)} style={{ background:'#fff3b0', border:'1px solid #f0d264' }}>Accept</Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {canDelete && selectedBaby ? (
          <div style={{ marginTop:12, padding:'14px 16px', border:'1px solid #e0e5ff', borderRadius:12, background:'#f5f6ff', display:'grid', gap:10 }}>
            <strong style={{ fontSize:15, color:'#1f2a6b' }}>Rename baby</strong>
            <form onSubmit={onRenameBaby} style={{ display:'flex', flexWrap:'wrap', gap:10, alignItems:'center' }}>
              <input
                value={renameValue}
                onChange={(e)=>setRenameValue(e.target.value)}
                placeholder="New name"
                style={{ padding:'10px 12px', borderRadius:10, border:'1px solid #ccd2ff', minWidth:220, flex:'1 1 200px', fontSize:14 }}
              />
              <Button type="submit" disabled={renaming} style={{ background:'#dfe4ff', border:'1px solid #a7b4ff', color:'#24307a', padding:'10px 16px' }}>
                {renaming ? 'Saving…' : 'Save name'}
              </Button>
            </form>
          </div>
        ) : null}

        {canDelete && selectedBaby ? (
          <div style={{ marginTop:12, padding:'14px 16px', border:'1px solid #f6c6c6', borderRadius:12, background:'#fff5f5', display:'grid', gap:10 }}>
            <strong style={{ fontSize:15, color:'#902020' }}>Delete baby</strong>
            <p style={{ margin:0, fontSize:13, color:'#7a4a4a' }}>
              Removing <strong>{selectedBaby.name}</strong> will permanently delete all events, invites, analytics, and sharing relationships for this baby.
            </p>
            <Button
              onClick={onDeleteBaby}
              disabled={deleting}
              style={{ background:'#ffd8d8', border:'1px solid #f0b3b3', color:'#9c1c1c', justifySelf:'flex-start', padding:'10px 16px' }}
            >
              {deleting ? 'Deleting…' : 'Delete baby'}
            </Button>
          </div>
        ) : null}

        <div style={{ marginTop:12, padding:'14px 16px', border:'1px solid #e1f2e1', borderRadius:12, background:'#f5fbf5', display:'grid', gap:10 }}>
          <strong style={{ fontSize:15, color:'#175c2f' }}>Add a new baby</strong>
          <form onSubmit={onCreateBaby} style={{ display:'flex', flexWrap:'wrap', gap:10, alignItems:'center' }}>
            <input
              value={newBabyName}
              onChange={(e)=>setNewBabyName(e.target.value)}
              placeholder="Baby name"
              style={{ padding:'10px 12px', borderRadius:10, border:'1px solid #c4ddc4', minWidth:220, flex:'1 1 200px', fontSize:14 }}
            />
            <Button type="submit" disabled={creating} style={{ background:'#cfeacb', border:'1px solid #9ed69b', color:'#145228', padding:'10px 16px' }}>
              {creating ? 'Creating…' : 'Add baby'}
            </Button>
          </form>
        </div>
      </section>
    </div>
  );
}
