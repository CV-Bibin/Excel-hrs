import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, arrayRemove } from 'firebase/firestore';
import { db } from '../firebase';

export default function TeamAssignments() {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [directoryFilter, setDirectoryFilter] = useState('all'); 

  useEffect(() => {
    setIsLoading(true);
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const fetched = [];
      snapshot.forEach(doc => fetched.push(doc.data()));
      setUsers(fetched);
      setIsLoading(false);
    }, (err) => {
      setError('Failed to live-sync users from the database.');
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const allManagers = users.filter(u => u && (u.role === 'leader' || u.role === 'co-admin'));
  const assignableAccounts = users.filter(u => u && u.sheetId && u.sheetId.length > 5 && u.sheetId !== 'MASTER_ADMIN');

  const coAdmins = allManagers.filter(m => m.role === 'co-admin');
  const leaders = allManagers.filter(m => m.role === 'leader');

  const checkAutoPin = (account, manager) => {
    if (account.email === manager.email) return true;
    if (manager.role === 'co-admin') {
      const matchClient = manager.clientName && (account.clientName === manager.clientName || account.coAdminName === manager.clientName);
      const matchCoAdmin = manager.coAdminName && (account.clientName === manager.coAdminName || account.coAdminName === manager.coAdminName);
      if (matchClient || matchCoAdmin) return true;
    }
    if (manager.role === 'leader') {
      const matchLeader = manager.leaderName && account.leaderName === manager.leaderName;
      if (matchLeader) return true;
    }
    return false;
  };

  const handleDragStart = (e, accountEmail) => {
    e.dataTransfer.setData('text/plain', accountEmail);
    e.target.style.opacity = '0.5'; 
  };
  const handleDragEnd = (e) => { e.target.style.opacity = '1'; };
  const handleDragOver = (e) => { e.preventDefault(); e.currentTarget.style.backgroundColor = '#f1f8e9'; };
  const handleDragLeave = (e) => { e.currentTarget.style.backgroundColor = '#fff'; };

  const handleDrop = async (e, targetManager) => {
    e.preventDefault();
    e.currentTarget.style.backgroundColor = '#fff'; 

    const accountEmail = e.dataTransfer.getData('text/plain');
    if (!accountEmail) return;

    const account = assignableAccounts.find(a => a.email === accountEmail);
    if (!account) return;

    if (checkAutoPin(account, targetManager)) return;

    if (targetManager.role === 'leader' && (account.role === 'co-admin' || account.role === 'leader')) {
      alert(`⚠️ Action Blocked:\nYou cannot assign a ${account.role.toUpperCase()} account to a Leader.`);
      return;
    }

    const currentManagers = Array.isArray(account.managers) ? account.managers : [];
    let newManagers = [...currentManagers];

    if (targetManager.role === 'leader') {
      const otherLeaders = allManagers.filter(m => m.role === 'leader' && m.email !== targetManager.email).map(m => m.email);
      newManagers = newManagers.filter(m => !otherLeaders.includes(m));
    }

    if (!newManagers.includes(targetManager.email)) {
      newManagers.push(targetManager.email);
      try {
        await updateDoc(doc(db, 'users', accountEmail), { managers: newManagers });
      } catch (err) { alert("Failed to assign account."); }
    }
  };

  const handleRemoveAssignment = async (accountEmail, managerEmail) => {
    try { await updateDoc(doc(db, 'users', accountEmail), { managers: arrayRemove(managerEmail) }); } 
    catch (err) { alert("Failed to remove assignment."); }
  };

  const directoryAccounts = assignableAccounts.filter(acc => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const emailMatch = acc.email.toLowerCase().includes(term);
      const clientMatch = (acc.clientName || '').toLowerCase().includes(term);
      if (!emailMatch && !clientMatch) return false;
    }
    
    if (directoryFilter === 'unassigned') {
      const isAssigned = Array.isArray(acc.managers) && acc.managers.length > 0;
      const isSelfAssigned = acc.role === 'leader' || acc.role === 'co-admin';
      if (isAssigned || isSelfAssigned) return false;
    }
    return true;
  });

  const renderManagerRow = (managerList, title, icon, colorHex) => {
    if (managerList.length === 0) return null;
    return (
      <div style={{ marginBottom: '20px', backgroundColor: '#fafafa', padding: '15px', borderRadius: '8px', border: `1px solid ${colorHex}33` }}>
        <h3 style={{ margin: '0 0 15px 0', color: colorHex, fontSize: '18px', borderBottom: `2px solid ${colorHex}33`, paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {icon} {title} <span style={{ fontSize: '13px', color: '#888', fontWeight: 'normal' }}>({managerList.length} total)</span>
        </h3>
        
        <div style={{ display: 'flex', gap: '20px', overflowX: 'auto', paddingBottom: '10px' }}>
          {managerList.map(manager => {
            const myAccounts = assignableAccounts.filter(acc => {
              const mArray = Array.isArray(acc.managers) ? acc.managers : [];
              return mArray.includes(manager.email) || checkAutoPin(acc, manager);
            });

            const displayName = manager.role === 'co-admin' ? (manager.coAdminName || 'Co-Admin') : (manager.leaderName || 'Leader');

            return (
              <div 
                key={manager.email} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={(e) => handleDrop(e, manager)}
                style={{ minWidth: '320px', maxWidth: '320px', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #ddd', display: 'flex', flexDirection: 'column', transition: 'background-color 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderTop: `4px solid ${colorHex}` }}
              >
                <div style={{ padding: '15px', borderBottom: '1px solid #eee' }}>
                  <h3 style={{ margin: '0 0 5px 0', fontSize: '18px', color: '#333' }}>{displayName}</h3>
                  <div style={{ fontSize: '11px', color: '#888', wordBreak: 'break-all', marginBottom: '10px' }}>{manager.email}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold', color: colorHex, backgroundColor: `${colorHex}15`, padding: '3px 6px', borderRadius: '12px' }}>{manager.role}</span>
                    <span style={{ fontSize: '12px', color: '#666', fontWeight: 'bold' }}>{myAccounts.length} Accounts</span>
                  </div>
                </div>

                <div style={{ height: '350px', overflowY: 'auto', padding: '10px', backgroundColor: 'transparent' }}>
                  {myAccounts.length === 0 ? <div style={{ textAlign: 'center', color: '#aaa', padding: '20px', border: '2px dashed #eee', borderRadius: '6px', fontSize: '13px' }}>Drag accounts here</div> : null}

                  {myAccounts.map(account => {
                    const isAutoPinned = checkAutoPin(account, manager);
                    return (
                      <div key={`assigned-${account.email}`} style={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: '6px', padding: '10px', marginBottom: '8px', position: 'relative', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                        {!isAutoPinned && (
                          <button onClick={() => handleRemoveAssignment(account.email, manager.email)} style={{ position: 'absolute', top: '8px', right: '8px', background: 'transparent', border: 'none', color: '#d32f2f', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', padding: '4px' }}>✕</button>
                        )}
                        <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#333', wordBreak: 'break-all', paddingRight: '20px' }}>{account.email}</div>
                        
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                          {account.role !== 'rater' && <span style={{ backgroundColor: '#e0e0e0', padding: '2px 4px', borderRadius: '3px', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase' }}>{account.role}</span>}
                          {account.clientName && <span style={{ fontSize: '10px', color: '#1a73e8' }}><strong>C:</strong> {account.clientName}</span>}
                          {/* CO-ADMIN & LEADER LABELS REMOVED HERE */}
                        </div>
                        {isAutoPinned && <div style={{ fontSize: '10px', color: '#4caf50', marginTop: '8px', fontWeight: 'bold', backgroundColor: '#e8f5e9', display: 'inline-block', padding: '2px 6px', borderRadius: '4px' }}>✓ Auto-Pinned</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (isLoading) return <div style={{ padding: '40px', textAlign: 'center', fontSize: '18px' }}>Loading live teams...</div>;
  if (error) return <div style={{ padding: '40px', color: 'red', textAlign: 'center' }}>{error}</div>;

  return (
    <div style={{ padding: '30px', maxWidth: '1600px', margin: '0 auto', height: '90vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ color: '#1a73e8', margin: '0 0 10px 0' }}>Interactive Team Assignments</h2>
        <p style={{ color: '#666', margin: 0 }}>Drag accounts from the Directory on the left and drop them into the specific Manager Boards on the right.</p>
      </div>

      {allManagers.length === 0 ? (
        <div style={{ backgroundColor: '#fff', padding: '30px', borderRadius: '8px', textAlign: 'center', color: '#666' }}><h3>No Managers Found</h3><p>Create a Leader or Co-Admin in the Accounts tab first.</p></div>
      ) : (
        <div style={{ display: 'flex', gap: '20px', flex: 1, overflow: 'hidden' }}>
          
          {/* LEFT DIRECTORY */}
          <div style={{ width: '350px', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #ddd', display: 'flex', flexDirection: 'column', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <div style={{ padding: '15px', borderBottom: '1px solid #ddd', backgroundColor: '#f8f9fa', borderRadius: '8px 8px 0 0' }}>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#333' }}>🗂️ Account Directory</h3>
              <input type="text" placeholder="Search email, client..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', marginBottom: '10px', boxSizing: 'border-box' }}/>
              <select value={directoryFilter} onChange={e => setDirectoryFilter(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box', fontSize: '13px' }}>
                <option value="all">Show All Accounts ({assignableAccounts.length})</option>
                <option value="unassigned">Show Unassigned Only</option>
              </select>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '10px', backgroundColor: '#f4f6f8' }}>
              {directoryAccounts.length === 0 ? <div style={{ textAlign: 'center', color: '#888', marginTop: '20px', fontSize: '13px' }}>No accounts found.</div> : null}
              {directoryAccounts.map(account => {
                const mArray = Array.isArray(account.managers) ? account.managers : [];
                const isRater = account.role === 'rater' || !account.role;
                const assignedLeaderEmails = mArray.filter(mEmail => leaders.some(l => l.email === mEmail));
                const hasLeader = assignedLeaderEmails.length > 0;

                let cardBorder = '#ccc';
                let statusBadge = null;

                if (isRater && !hasLeader) {
                  cardBorder = '#e53935'; 
                  statusBadge = <div style={{ fontSize: '10px', color: '#e53935', marginTop: '6px', fontWeight: 'bold' }}>⚠️ Needs Leader</div>;
                } else if (isRater && hasLeader) {
                  cardBorder = '#4caf50'; 
                  statusBadge = <div style={{ fontSize: '10px', color: '#4caf50', marginTop: '6px', fontWeight: 'bold' }}>✓ Has Leader</div>;
                } else {
                  cardBorder = '#ff9800'; 
                  statusBadge = <div style={{ fontSize: '10px', color: '#ff9800', marginTop: '6px', fontWeight: 'bold' }}>✓ Auto-Managed</div>;
                }

                return (
                  <div key={`dir-${account.email}`} draggable onDragStart={(e) => handleDragStart(e, account.email)} onDragEnd={handleDragEnd} style={{ backgroundColor: '#fff', padding: '10px', marginBottom: '8px', borderRadius: '6px', border: '1px solid #ccc', cursor: 'grab', borderLeft: `4px solid ${cardBorder}`, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                    <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#333', wordBreak: 'break-all' }}>{account.email}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                      {account.role !== 'rater' && <span style={{ backgroundColor: '#e0e0e0', padding: '2px 4px', borderRadius: '3px', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase' }}>{account.role}</span>}
                      {account.clientName && <span style={{ fontSize: '10px', color: '#1a73e8' }}><strong>C:</strong> {account.clientName}</span>}
                      {/* CO-ADMIN & LEADER LABELS REMOVED HERE TOO */}
                    </div>
                    {statusBadge}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', paddingRight: '10px' }}>
            {renderManagerRow(coAdmins, 'Co-Admins Board', '👑', '#7b1fa2')}
            {renderManagerRow(leaders, 'Leaders Board', '👔', '#1a73e8')}
          </div>
        </div>
      )}
    </div>
  );
}