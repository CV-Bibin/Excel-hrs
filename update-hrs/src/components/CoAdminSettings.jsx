import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, doc, getDoc, setDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db, firebaseConfig } from '../firebase';

export default function CoAdminSettings({ currentUserEmail }) {
  // Global States
  const [allUsers, setAllUsers] = useState([]);
  const [myAccounts, setMyAccounts] = useState([]);
  const [coAdminProfile, setCoAdminProfile] = useState(null);
  const [clientList, setClientList] = useState([]);
  const [leaderList, setLeaderList] = useState([]);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [isLoading, setIsLoading] = useState(false);

  // Form States 
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [sheetInput, setSheetInput] = useState('');
  
  // Assignments & Billing
  const [selectedClient, setSelectedClient] = useState('');
  const [selectedLeader, setSelectedLeader] = useState('');
  const [newCompany, setNewCompany] = useState('Telus');
  const [newClientRate, setNewClientRate] = useState('');
  const [newLeaderRate, setNewLeaderRate] = useState('');
  const [newRaterRate, setNewRaterRate] = useState('');
  
  const [newHasBonus, setNewHasBonus] = useState(false);
  const [newBonusTarget, setNewBonusTarget] = useState('');
  const [newLeaderBonus, setNewLeaderBonus] = useState('');
  const [newRaterBonus, setNewRaterBonus] = useState('');

  // Edit States
  const [editingEmail, setEditingEmail] = useState(null); 
  const [editSheetId, setEditSheetId] = useState('');
  const [editClient, setEditClient] = useState('');
  const [editLeader, setEditLeader] = useState('');
  const [editBilling, setEditBilling] = useState({});

  // 1. Fetch Dropdowns & General Data
  useEffect(() => {
    const fetchInitialData = async () => {
      const snap = await getDoc(doc(db, 'users', currentUserEmail));
      if (snap.exists()) setCoAdminProfile(snap.data());

      const cDoc = await getDoc(doc(db, 'settings', 'clients'));
      if (cDoc.exists()) setClientList(cDoc.data().names || []);

      const lDoc = await getDoc(doc(db, 'settings', 'leaders'));
      if (lDoc.exists()) setLeaderList(lDoc.data().names || []);
    };
    fetchInitialData();
  }, [currentUserEmail]);

  // 2. Live Sync Users
  useEffect(() => {
    if (!coAdminProfile) return;

    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const fetchedAll = [];
      const fetchedMine = [];

      snapshot.forEach((doc) => {
        const acc = doc.data();
        fetchedAll.push(acc);

        const mArray = Array.isArray(acc.managers) ? acc.managers : [];
        const isMine = 
          mArray.includes(currentUserEmail) || 
          acc.manager === currentUserEmail || 
          (coAdminProfile.coAdminName && acc.coAdminName === coAdminProfile.coAdminName);

        if (isMine && acc.email !== currentUserEmail) {
          fetchedMine.push(acc);
        }
      });
      
      fetchedAll.sort((a, b) => a.email.localeCompare(b.email));
      fetchedMine.sort((a, b) => a.email.localeCompare(b.email));

      setAllUsers(fetchedAll);
      setMyAccounts(fetchedMine);
    });

    return () => unsubscribe();
  }, [currentUserEmail, coAdminProfile]);

  // Handle Bonus Auto-Fill Logic
  const handleBonusToggle = (e) => {
    const isChecked = e.target.checked;
    setNewHasBonus(isChecked);
    
    if (isChecked) {
      setNewBonusTarget(40);
      setNewLeaderBonus(220);
      setNewRaterBonus(180);
    } else {
      setNewBonusTarget('');
      setNewLeaderBonus('');
      setNewRaterBonus('');
    }
  };

  // 3. Create Detailed Account
  const handleCreateAccount = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setStatus({ type: 'info', message: 'Creating secure account & setting up billing...' });

    try {
      let finalSheetId = '';
      if (sheetInput) {
        finalSheetId = sheetInput;
        if (sheetInput.includes('/d/')) finalSheetId = sheetInput.split('/d/')[1].split('/')[0];
        if (finalSheetId.length < 20) throw new Error('Invalid Google Sheet URL.');
      } else {
        throw new Error('Google Sheet URL is mandatory.');
      }

      const accountEmail = newEmail.toLowerCase().trim();
      const newAccRef = doc(db, 'users', accountEmail);
      const snap = await getDoc(newAccRef);

      if (snap.exists()) throw new Error('An account with this email already exists!');

      // Firebase Auth Creation
      const secondaryApp = initializeApp(firebaseConfig, "SecondaryAppCoAdmin");
      const secondaryAuth = getAuth(secondaryApp);
      await createUserWithEmailAndPassword(secondaryAuth, accountEmail, newPassword);
      await signOut(secondaryAuth);

      // 💡 FIX: Find the Leader's Email to add to the managers array (Prevents unremovable Auto-Pins)
      const globalLeaders = allUsers.filter(u => u.role === 'leader');
      const selectedLeaderProf = globalLeaders.find(l => l.leaderName === selectedLeader);
      const newManagers = [currentUserEmail]; // Always lock to Co-Admin
      if (selectedLeaderProf) {
        newManagers.push(selectedLeaderProf.email); // Add leader email if selected
      }

      // Save Full Profile & Billing to Firestore
      await setDoc(newAccRef, {
        email: accountEmail,
        role: 'rater', 
        sheetId: finalSheetId,
        clientName: selectedClient,
        leaderName: '', // 💡 FIX: Keep empty for raters to prevent hard-locking
        managers: newManagers, 
        coAdminName: coAdminProfile?.coAdminName || '',
        isDisabled: false, 
        createdAt: new Date().toISOString(),
        billing: {
          company: newCompany,
          clientName: selectedClient, // 💡 FIX: Save client name inside Billing so BillingSettings sees it!
          clientRateUSD: Number(newClientRate) || 0,
          leaderPayRate: Number(newLeaderRate) || 0,
          raterRate: Number(newRaterRate) || 0,
          hasBonus: newHasBonus,
          bonusTargetHours: Number(newBonusTarget) || 0,
          leaderBonusRate: Number(newLeaderBonus) || 0,
          raterBonusRate: Number(newRaterBonus) || 0
        }
      });

      setStatus({ type: 'success', message: `Success! Account created for ${accountEmail}` });
      
      // Reset Form
      setNewEmail(''); setNewPassword(''); setSheetInput(''); 
      setSelectedClient(''); setSelectedLeader(''); setNewCompany('Telus'); 
      setNewClientRate(''); setNewLeaderRate(''); setNewRaterRate('');
      setNewHasBonus(false); setNewBonusTarget(''); setNewLeaderBonus(''); setNewRaterBonus('');
      
    } catch (error) {
      const errorMessage = error.message.includes('email-already-in-use') ? 'That email is already registered.' : error.message;
      setStatus({ type: 'error', message: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Edit Functionality
  const startEditing = (user) => {
    setEditingEmail(user.email);
    setEditSheetId(user.sheetId || '');
    setEditClient(user.clientName || '');
    
    // 💡 FIX: Find assigned leader safely from the managers array
    const globalLeaders = allUsers.filter(u => u.role === 'leader');
    const accManagers = Array.isArray(user.managers) ? user.managers : [];
    const assignedLeaderEmail = accManagers.find(mEmail => globalLeaders.some(l => l.email === mEmail));
    const assignedLeaderProf = globalLeaders.find(l => l.email === assignedLeaderEmail);
    setEditLeader(assignedLeaderProf ? (assignedLeaderProf.leaderName || '') : '');
    
    const b = user.billing || {};
    setEditBilling({
      company: b.company || 'Telus',
      clientRateUSD: b.clientRateUSD || 0,
      leaderPayRate: b.leaderPayRate || 0,
      raterRate: b.raterRate || 0,
      hasBonus: b.hasBonus || false,
      bonusTargetHours: b.bonusTargetHours || 0,
      leaderBonusRate: b.leaderBonusRate || 0,
      raterBonusRate: b.raterBonusRate || 0
    });
  };

  const handleEditBonusToggle = (e) => {
    const isChecked = e.target.checked;
    setEditBilling(prev => ({
      ...prev,
      hasBonus: isChecked,
      bonusTargetHours: isChecked && !prev.bonusTargetHours ? 40 : prev.bonusTargetHours,
      leaderBonusRate: isChecked && !prev.leaderBonusRate ? 220 : prev.leaderBonusRate,
      raterBonusRate: isChecked && !prev.raterBonusRate ? 180 : prev.raterBonusRate,
    }));
  };

  const handleUpdateUser = async () => {
    if (!window.confirm(`Save changes for ${editingEmail}?`)) return;
    try {
      let finalSheetId = editSheetId;
      if (editSheetId && editSheetId.includes('/d/')) {
        finalSheetId = editSheetId.split('/d/')[1].split('/')[0];
      }
      
      // 💡 FIX: Safely update the managers array with the new Leader
      const globalLeaders = allUsers.filter(u => u.role === 'leader');
      const newLeaderProf = globalLeaders.find(l => l.leaderName === editLeader);
      
      const accToUpdate = allUsers.find(u => u.email === editingEmail);
      let currentManagers = Array.isArray(accToUpdate?.managers) ? accToUpdate.managers : [currentUserEmail];
      
      // Strip out existing leaders, keep co-admins intact
      const globalLeaderEmails = globalLeaders.map(l => l.email);
      currentManagers = currentManagers.filter(m => !globalLeaderEmails.includes(m));
      
      if (newLeaderProf) {
        currentManagers.push(newLeaderProf.email);
      }

      await updateDoc(doc(db, 'users', editingEmail), { 
        sheetId: finalSheetId,
        clientName: editClient,
        leaderName: '', // Keep clean to prevent Auto-Pins
        managers: currentManagers,
        billing: {
          company: editBilling.company,
          clientName: editClient, // 💡 Sync with root
          clientRateUSD: Number(editBilling.clientRateUSD),
          leaderPayRate: Number(editBilling.leaderPayRate),
          raterRate: Number(editBilling.raterRate),
          hasBonus: editBilling.hasBonus,
          bonusTargetHours: Number(editBilling.bonusTargetHours),
          leaderBonusRate: Number(editBilling.leaderBonusRate),
          raterBonusRate: Number(editBilling.raterBonusRate)
        }
      });
      setEditingEmail(null);
    } catch (error) {
      alert('Failed to update user.');
    }
  };

  const handleToggleDisable = async (user) => {
    const newStatus = !user.isDisabled;
    if (!window.confirm(`Are you sure you want to ${newStatus ? 'DISABLE' : 'ENABLE'} ${user.email}?`)) return;
    try {
      await updateDoc(doc(db, 'users', user.email), { isDisabled: newStatus });
      if (user.sheetId && user.sheetId.length > 5) {
        try {
           await fetch('http://localhost:5000/api/toggle-sheet-lock', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ sheetId: user.sheetId, lock: newStatus })
           });
        } catch (serverErr) { console.warn(serverErr); }
      }
    } catch (error) { alert('Failed to update user access.'); }
  };

  if (!coAdminProfile) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading profile...</div>;

  const inputStyle = { width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px', boxSizing: 'border-box', backgroundColor: '#fff' };
  const labelStyle = { display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#555', marginBottom: '4px', textTransform: 'uppercase' };
  const tableHeaderStyle = { padding: '12px', textAlign: 'left', backgroundColor: '#f1f3f4', borderBottom: '2px solid #ddd', color: '#555', fontWeight: 'bold', fontSize: '13px' };
  const tableCellStyle = { padding: '12px', borderBottom: '1px solid #eee', color: '#333', fontSize: '13px', verticalAlign: 'top' };

  return (
    <div style={{ padding: '40px', maxWidth: '1400px', margin: '0 auto' }}>
      <h2 style={{ color: '#1a73e8', borderBottom: '2px solid #eee', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        ⚙️ My Assigned Accounts Management
        <span style={{ fontSize: '14px', color: '#666', fontWeight: 'normal', backgroundColor: '#e8eaed', padding: '4px 10px', borderRadius: '15px' }}>
          My Team: {myAccounts.length}
        </span>
      </h2>

      {status.message && (
        <div style={{ padding: '12px', marginBottom: '20px', borderRadius: '4px', textAlign: 'center', fontWeight: 'bold',
          backgroundColor: status.type === 'error' ? '#fdecea' : status.type === 'success' ? '#e8f5e9' : '#e3f2fd',
          color: status.type === 'error' ? '#d32f2f' : status.type === 'success' ? '#2e7d32' : '#1565c0'
        }}>
          {status.message}
        </div>
      )}

      {/* --- ADD NEW DETAILED ACCOUNT FORM --- */}
      <div style={{ backgroundColor: '#fff', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', marginBottom: '30px' }}>
        <h3 style={{ marginTop: 0, color: '#333' }}>➕ Onboard New User (Detailed Setup)</h3>
        
        <form onSubmit={handleCreateAccount} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ display: 'flex', gap: '15px' }}>
            <div style={{ flex: 1.5 }}><label style={labelStyle}>Email Address (Login) *</label><input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} style={inputStyle} required /></div>
            <div style={{ flex: 1.5 }}><label style={labelStyle}>Temp Password *</label><input type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength="6" style={inputStyle} required /></div>
            <div style={{ flex: 1 }}><label style={labelStyle}>Role</label>
              <select disabled style={{...inputStyle, fontWeight: 'bold', backgroundColor: '#f1f3f4'}}>
                <option value="rater">Rater</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '15px' }}>
            <div style={{ flex: 1 }}><label style={labelStyle}>Assign Client</label>
              <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)} style={inputStyle}>
                <option value="">- Select Client -</option>{clientList.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}><label style={labelStyle}>Assign Leader</label>
              <select value={selectedLeader} onChange={e => setSelectedLeader(e.target.value)} style={inputStyle}>
                <option value="">- Tag Leader Name -</option>{leaderList.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}><label style={labelStyle}>Company Platform</label>
              <select value={newCompany} onChange={e => setNewCompany(e.target.value)} style={inputStyle}>
                <option value="Telus">Telus</option><option value="Peroptyx">Peroptyx</option><option value="OneForma">OneForma</option>
              </select>
            </div>
            <div style={{ flex: 2 }}><label style={labelStyle}>Paste Sheet URL *</label><input type="text" value={sheetInput} onChange={e => setSheetInput(e.target.value)} style={inputStyle} required /></div>
          </div>

          <div style={{ backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '1px solid #e8eaed' }}>
            <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}><label style={labelStyle}>Client Rate ($)</label><input type="number" step="0.01" value={newClientRate} onChange={e => setNewClientRate(e.target.value)} style={inputStyle} /></div>
              <div style={{ flex: 1 }}><label style={labelStyle}>Leader Base (₹)</label><input type="number" step="0.01" value={newLeaderRate} onChange={e => setNewLeaderRate(e.target.value)} style={inputStyle} /></div>
              <div style={{ flex: 1 }}><label style={labelStyle}>Rater Base (₹)</label><input type="number" step="0.01" value={newRaterRate} onChange={e => setNewRaterRate(e.target.value)} style={inputStyle} /></div>
              
              <div style={{ flex: 1.5, borderLeft: '2px solid #ddd', paddingLeft: '15px' }}>
                <label style={{...labelStyle, color: '#1e8e3e', display: 'flex', alignItems: 'center', gap: '5px'}}>
                  <input type="checkbox" checked={newHasBonus} onChange={handleBonusToggle} style={{ cursor: 'pointer' }} /> Enable Bonus Tier
                </label>
                {newHasBonus && (
                  <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
                    <div><span style={{fontSize: '9px', color: '#666'}}>Target Hrs</span><input type="number" value={newBonusTarget} onChange={e => setNewBonusTarget(e.target.value)} style={inputStyle} /></div>
                    <div><span style={{fontSize: '9px', color: '#7b1fa2'}}>Ldr Bonus (₹)</span><input type="number" step="0.01" value={newLeaderBonus} onChange={e => setNewLeaderBonus(e.target.value)} style={{...inputStyle, backgroundColor: '#f3e5f5', border: '1px solid #7b1fa2'}} /></div>
                    <div><span style={{fontSize: '9px', color: '#e65100'}}>Rtr Bonus (₹)</span><input type="number" step="0.01" value={newRaterBonus} onChange={e => setNewRaterBonus(e.target.value)} style={{...inputStyle, backgroundColor: '#fff3e0', border: '1px solid #e65100'}} /></div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <button type="submit" disabled={isLoading} style={{ width: '100%', padding: '12px', backgroundColor: '#34a853', color: '#fff', border: 'none', borderRadius: '4px', cursor: isLoading ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '15px' }}>
            {isLoading ? 'Processing...' : 'Create Account & Assign'}
          </button>
        </form>
      </div>

      {/* --- MANAGE TEAM TABLE --- */}
      <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', overflowX: 'auto' }}>
        <h3 style={{ marginTop: 0, marginBottom: '20px' }}>Manage Team</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr>
              <th style={tableHeaderStyle}>Email & Role</th>
              <th style={tableHeaderStyle}>Assignments</th>
              <th style={tableHeaderStyle}>Billing & Rates</th>
              <th style={tableHeaderStyle}>Sheet Link</th>
              <th style={tableHeaderStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {myAccounts.length === 0 ? (
              <tr><td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: '#888' }}>No accounts assigned to you yet.</td></tr>
            ) : (
              myAccounts.map((user) => {
                const isEditing = editingEmail === user.email;
                const b = user.billing || {};

                // SMART LEADER DETECTION
                const globalLeaders = allUsers.filter(u => u.role === 'leader');
                const accManagers = Array.isArray(user.managers) ? user.managers : [];
                const assignedLeaderEmail = accManagers.find(mEmail => globalLeaders.some(l => l.email === mEmail));
                const assignedLeaderProf = globalLeaders.find(l => l.email === assignedLeaderEmail);
                
                const actualLeaderName = assignedLeaderProf 
                  ? (assignedLeaderProf.leaderName || assignedLeaderProf.email.split('@')[0]) 
                  : (user.leaderName || 'None');

                return (
                  <tr key={user.email} style={{ backgroundColor: isEditing ? '#f8f9fa' : 'transparent', opacity: user.isDisabled ? 0.6 : 1 }}>
                    
                    {/* EMAIL & ROLE */}
                    <td style={tableCellStyle}>
                      <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>{user.email}</div>
                      <span style={{ backgroundColor: user.role === 'leader' ? '#e3f2fd' : '#e8f5e9', color: user.role === 'leader' ? '#1565c0' : '#1e8e3e', padding: '4px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                        {user.role || 'rater'}
                      </span>
                      {user.isDisabled && <div style={{ marginTop: '8px', color: '#d32f2f', fontSize: '10px', fontWeight: 'bold' }}>🚫 DISABLED</div>}
                    </td>

                    {/* ASSIGNMENTS */}
                    <td style={tableCellStyle}>
                      {isEditing ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <select value={editClient} onChange={e => setEditClient(e.target.value)} style={{ padding: '4px', borderRadius: '4px', fontSize: '12px', border: '1px solid #ccc' }}>
                            <option value="">- Client -</option>{clientList.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                          <select value={editLeader} onChange={e => setEditLeader(e.target.value)} style={{ padding: '4px', borderRadius: '4px', fontSize: '12px', border: '1px solid #ccc' }}>
                            <option value="">- Tag Leader Name -</option>{leaderList.map(l => <option key={l} value={l}>{l}</option>)}
                          </select>
                        </div>
                      ) : (
                        <div style={{ fontSize: '13px', color: '#555', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div><strong style={{color: '#1a73e8'}}>Client:</strong> {user.clientName || <span style={{color:'#ccc'}}>None</span>}</div>
                          <div><strong style={{color: '#7b1fa2'}}>Leader Name:</strong> {actualLeaderName === 'None' ? <span style={{color:'#ccc'}}>None</span> : actualLeaderName}</div>
                        </div>
                      )}
                    </td>

                    {/* BILLING & RATES */}
                    <td style={tableCellStyle}>
                      {isEditing ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <select value={editBilling.company} onChange={e => setEditBilling({...editBilling, company: e.target.value})} style={{ padding: '4px', fontSize: '11px', border: '1px solid #ccc', borderRadius: '4px' }}>
                            <option value="Telus">Telus</option><option value="Peroptyx">Peroptyx</option><option value="OneForma">OneForma</option>
                          </select>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <input type="number" placeholder="Client $" value={editBilling.clientRateUSD} onChange={e => setEditBilling({...editBilling, clientRateUSD: e.target.value})} style={{ width: '50px', padding: '4px', fontSize: '10px' }} />
                            <input type="number" placeholder="Ldr ₹" value={editBilling.leaderPayRate} onChange={e => setEditBilling({...editBilling, leaderPayRate: e.target.value})} style={{ width: '50px', padding: '4px', fontSize: '10px' }} />
                            <input type="number" placeholder="Rtr ₹" value={editBilling.raterRate} onChange={e => setEditBilling({...editBilling, raterRate: e.target.value})} style={{ width: '50px', padding: '4px', fontSize: '10px' }} />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', marginTop: '4px' }}>
                            <input type="checkbox" checked={editBilling.hasBonus} onChange={handleEditBonusToggle} style={{ cursor: 'pointer' }} /> Bonus
                            {editBilling.hasBonus && (
                              <>
                                <input type="number" placeholder="Hrs" value={editBilling.bonusTargetHours} onChange={e => setEditBilling({...editBilling, bonusTargetHours: e.target.value})} style={{ width: '35px', padding: '2px', fontSize: '9px' }} />
                                <input type="number" placeholder="L-Bon" value={editBilling.leaderBonusRate} onChange={e => setEditBilling({...editBilling, leaderBonusRate: e.target.value})} style={{ width: '35px', padding: '2px', fontSize: '9px' }} />
                                <input type="number" placeholder="R-Bon" value={editBilling.raterBonusRate} onChange={e => setEditBilling({...editBilling, raterBonusRate: e.target.value})} style={{ width: '35px', padding: '2px', fontSize: '9px' }} />
                              </>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div style={{ fontSize: '12px', color: '#555' }}>
                          <div style={{ marginBottom: '4px' }}><span style={{ backgroundColor: '#f1f3f4', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', fontSize: '10px' }}>{b.company || 'Telus'}</span></div>
                          <div><strong>Client:</strong> ${b.clientRateUSD || 0}/hr</div>
                          <div><strong>Ldr/Rtr:</strong> ₹{b.leaderPayRate || 0} / ₹{b.raterRate || 0}</div>
                          {b.hasBonus && b.bonusTargetHours > 0 && (
                            <div style={{ color: '#1e8e3e', fontSize: '10px', marginTop: '2px' }}>
                              Bonus (+₹{b.leaderBonusRate}/+₹{b.raterBonusRate}) @ {b.bonusTargetHours}h
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    {/* SHEET LINK */}
                    <td style={tableCellStyle}>
                      {isEditing ? (
                        <input type="text" value={editSheetId} onChange={(e) => setEditSheetId(e.target.value)} placeholder="Paste new URL" style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '12px' }} />
                      ) : (
                        user.sheetId && user.sheetId.length > 5 ? (
                          <a href={`https://docs.google.com/spreadsheets/d/${user.sheetId}`} target="_blank" rel="noreferrer" style={{ color: '#1a73e8', textDecoration: 'none', fontSize: '13px', fontWeight: 'bold' }}>Open Sheet &#8599;</a>
                        ) : <span style={{ color: '#aaa', fontSize: '11px' }}>N/A</span>
                      )}
                    </td>

                    {/* ACTIONS */}
                    <td style={{ ...tableCellStyle, whiteSpace: 'nowrap' }}>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: '6px', flexDirection: 'column' }}>
                          <button onClick={handleUpdateUser} style={{ padding: '6px', backgroundColor: '#34a853', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>Save</button>
                          <button onClick={() => setEditingEmail(null)} style={{ padding: '6px', backgroundColor: '#ccc', color: '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>Cancel</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <button onClick={() => startEditing(user)} style={{ padding: '6px 12px', backgroundColor: '#e8eaed', color: '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>Edit</button>
                          
                          {user.email !== 'admin@telus.com' && (
                            <button onClick={() => handleToggleDisable(user)} style={{ padding: '6px 12px', backgroundColor: user.isDisabled ? '#34a853' : '#f57c00', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                              {user.isDisabled ? 'Enable' : 'Disable'}
                            </button>
                          )}
                        </div>
                      )}
                    </td>

                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}