import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, getDocs, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, firebaseConfig } from '../firebase'; 

export default function AdminPanel() {
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [role, setRole] = useState('rater');
  const [sheetInput, setSheetInput] = useState(''); 
  
  // Assignment States
  const [selectedClient, setSelectedClient] = useState('');
  const [selectedCoAdmin, setSelectedCoAdmin] = useState('');
  const [selectedLeader, setSelectedLeader] = useState('');

  const [status, setStatus] = useState({ type: '', message: '' });
  const [isLoading, setIsLoading] = useState(false);

  const [usersList, setUsersList] = useState([]);
  const [editingEmail, setEditingEmail] = useState(null); 
  const [editRole, setEditRole] = useState('');
  const [editSheetId, setEditSheetId] = useState('');
  
  // Edit States
  const [editClient, setEditClient] = useState('');
  const [editCoAdmin, setEditCoAdmin] = useState('');
  const [editLeader, setEditLeader] = useState('');

  // Global List State
  const [clientList, setClientList] = useState([]);
  const [newClientInput, setNewClientInput] = useState('');
  const [leaderList, setLeaderList] = useState([]);
  const [newLeaderInput, setNewLeaderInput] = useState('');

  const fetchData = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const fetchedUsers = [];
      querySnapshot.forEach((doc) => fetchedUsers.push(doc.data()));
      fetchedUsers.sort((a, b) => a.email.localeCompare(b.email));
      setUsersList(fetchedUsers);

      const cDoc = await getDoc(doc(db, 'settings', 'clients'));
      if (cDoc.exists()) setClientList(cDoc.data().names || []);

      const lDoc = await getDoc(doc(db, 'settings', 'leaders'));
      if (lDoc.exists()) setLeaderList(lDoc.data().names || []);

    } catch (error) {
      console.error("Error fetching data: ", error);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleAddClient = async () => {
    if (!newClientInput.trim()) return;
    const updated = [...clientList, newClientInput.trim()];
    await setDoc(doc(db, 'settings', 'clients'), { names: updated }, { merge: true });
    setClientList(updated);
    setNewClientInput('');
  };

  const handleDeleteClient = async (name) => {
    if (!window.confirm(`Delete ${name} from Client list?`)) return;
    const updated = clientList.filter(n => n !== name);
    await setDoc(doc(db, 'settings', 'clients'), { names: updated }, { merge: true });
    setClientList(updated);
  };

  const handleAddLeader = async () => {
    if (!newLeaderInput.trim()) return;
    const updated = [...leaderList, newLeaderInput.trim()];
    await setDoc(doc(db, 'settings', 'leaders'), { names: updated }, { merge: true });
    setLeaderList(updated);
    setNewLeaderInput('');
  };

  const handleDeleteLeader = async (name) => {
    if (!window.confirm(`Delete ${name} from Leader list?`)) return;
    const updated = leaderList.filter(n => n !== name);
    await setDoc(doc(db, 'settings', 'leaders'), { names: updated }, { merge: true });
    setLeaderList(updated);
  };

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setStatus({ type: 'info', message: 'Creating account...' });

    try {
      let finalSheetId = '';
      if (sheetInput) {
        finalSheetId = sheetInput;
        if (sheetInput.includes('/d/')) {
          finalSheetId = sheetInput.split('/d/')[1].split('/')[0];
        }
        if (finalSheetId.length < 20) throw new Error('Invalid Google Sheet URL.');
      } else if (role === 'rater') {
        throw new Error('Google Sheet URL is mandatory for Raters.');
      }

      const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
      const secondaryAuth = getAuth(secondaryApp);
      await createUserWithEmailAndPassword(secondaryAuth, newEmail, newPassword);
      await signOut(secondaryAuth);

      await setDoc(doc(db, 'users', newEmail), {
        email: newEmail,
        role: role,
        sheetId: finalSheetId,
        clientName: selectedClient,
        // 💡 ONLY save Co-Admin or Leader names if the account actually has that role!
        coAdminName: role === 'co-admin' ? selectedCoAdmin : '',
        leaderName: role === 'leader' ? selectedLeader : '', 
        managers: [], 
        createdAt: new Date().toISOString()
      });

      setStatus({ type: 'success', message: `Success! Account created for ${newEmail}` });
      setNewEmail(''); setNewPassword(''); setSheetInput(''); setRole('rater');
      setSelectedClient(''); setSelectedCoAdmin(''); setSelectedLeader('');
      fetchData(); 
    } catch (error) {
      const errorMessage = error.message.includes('email-already-in-use') ? 'That email is already registered.' : error.message;
      setStatus({ type: 'error', message: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  const startEditing = (user) => {
    setEditingEmail(user.email);
    setEditRole(user.role);
    setEditSheetId(user.sheetId || '');
    setEditClient(user.clientName || '');
    setEditCoAdmin(user.coAdminName || '');
    setEditLeader(user.leaderName || '');
  };

  const handleUpdateUser = async () => {
    if (!window.confirm(`Are you sure you want to update ${editingEmail}?`)) return;
    try {
      let finalSheetId = editSheetId;
      if (editSheetId && editSheetId.includes('/d/')) {
        finalSheetId = editSheetId.split('/d/')[1].split('/')[0];
      }
      await updateDoc(doc(db, 'users', editingEmail), { 
        role: editRole, 
        sheetId: finalSheetId,
        clientName: editClient,
        // 💡 ONLY save Co-Admin or Leader names if the account actually has that role!
        coAdminName: editRole === 'co-admin' ? editCoAdmin : '',
        leaderName: editRole === 'leader' ? editLeader : '' 
      });
      setEditingEmail(null);
      fetchData(); 
    } catch (error) {
      alert('Failed to update user.');
    }
  };

  const handleDeleteUser = async (email) => {
    if (!window.confirm(`CRITICAL WARNING: Are you sure you want to delete ${email}'s access?`)) return;
    try {
      await deleteDoc(doc(db, 'users', email));
      fetchData(); 
    } catch (error) {
      alert('Failed to delete user.');
    }
  };

  const tableHeaderStyle = { padding: '12px', textAlign: 'left', backgroundColor: '#f1f3f4', borderBottom: '2px solid #ddd', color: '#555', fontWeight: 'bold', fontSize: '13px' };
  const tableCellStyle = { padding: '12px', borderBottom: '1px solid #eee', color: '#333', fontSize: '13px' };

  return (
    <div style={{ padding: '40px', maxWidth: '1350px', margin: '0 auto' }}>
      <h2 style={{ color: '#1a73e8', borderBottom: '2px solid #eee', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        Admin Control Center
        <span style={{ fontSize: '14px', color: '#666', fontWeight: 'normal', backgroundColor: '#e8eaed', padding: '4px 10px', borderRadius: '15px' }}>
          Total Users: {usersList.length}
        </span>
      </h2>
      
      <div style={{ display: 'flex', gap: '30px', alignItems: 'flex-start' }}>
        
        {/* LEFT COLUMN: Forms */}
        <div style={{ flex: '0 0 350px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <h3 style={{ marginTop: 0 }}>Onboard New User</h3>
            
            {status.message && (
              <div style={{ padding: '10px', marginBottom: '15px', borderRadius: '4px', backgroundColor: status.type === 'error' ? '#fdecea' : status.type === 'success' ? '#e8f5e9' : '#e3f2fd', color: status.type === 'error' ? '#d32f2f' : '#333', fontSize: '13px' }}>
                {status.message}
              </div>
            )}

            <form onSubmit={handleCreateAccount} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input type="email" placeholder="New User Email" required value={newEmail} onChange={e => setNewEmail(e.target.value)} style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}/>
              <input type="text" placeholder="Temporary Password (min 6)" required minLength="6" value={newPassword} onChange={e => setNewPassword(e.target.value)} style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}/>
              
              <select value={role} onChange={e => setRole(e.target.value)} style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '4px', fontWeight: 'bold' }}>
                <option value="rater">Rater</option>
                <option value="leader">Leader</option>
                <option value="co-admin">Co-Admin</option>
                <option value="admin">Admin</option>
              </select>

              {/* 💡 CONDITIONAL DROPDOWNS: Only show what is needed for the selected role */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: '#f8f9fa', padding: '10px', borderRadius: '4px', border: '1px solid #eee' }}>
                <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#666' }}>Assignments:</div>
                
                {/* Client Dropdown (Always Visible) */}
                <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)} style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px' }}>
                  <option value="">- Select Client -</option>
                  {clientList.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                
                {/* Co-Admin Dropdown (Only for Co-Admins) */}
                {role === 'co-admin' && (
                  <select value={selectedCoAdmin} onChange={e => setSelectedCoAdmin(e.target.value)} style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px' }}>
                    <option value="">- Tag Co-Admin Name -</option>
                    {clientList.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                )}

                {/* Leader Dropdown (Only for Leaders) */}
                {role === 'leader' && (
                  <select value={selectedLeader} onChange={e => setSelectedLeader(e.target.value)} style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px' }}>
                    <option value="">- Tag Leader Name -</option>
                    {leaderList.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                )}
              </div>

              <input type="text" placeholder={role === 'rater' ? "Paste Sheet URL (Required)" : "Paste Sheet URL (Optional)"} required={role === 'rater'} value={sheetInput} onChange={e => setSheetInput(e.target.value)} style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '4px', backgroundColor: '#f8f9fa' }}/>
              <button type="submit" disabled={isLoading} style={{ padding: '12px', backgroundColor: '#34a853', color: '#fff', fontWeight: 'bold', border: 'none', borderRadius: '4px', cursor: isLoading ? 'not-allowed' : 'pointer' }}>
                {isLoading ? 'Processing...' : 'Create Account'}
              </button>
            </form>
          </div>

          {/* List Management Box */}
          <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <h3 style={{ marginTop: 0, fontSize: '16px', color: '#1a73e8' }}>Manage Dropdown Lists</h3>
            
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#555', marginBottom: '8px' }}>Client List (Used for Clients & Co-Admins)</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                {clientList.map(c => (
                   <div key={c} style={{ fontSize: '11px', backgroundColor: '#e8f0fe', color: '#1a73e8', padding: '4px 8px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                     {c} <button onClick={() => handleDeleteClient(c)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#d32f2f', fontSize: '10px', padding: 0 }}>✖</button>
                   </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input type="text" placeholder="Add Name..." value={newClientInput} onChange={e => setNewClientInput(e.target.value)} style={{ flex: 1, padding: '6px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px' }} />
                <button onClick={handleAddClient} style={{ padding: '6px 12px', backgroundColor: '#1a73e8', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>Add</button>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#555', marginBottom: '8px' }}>Leader List</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                {leaderList.map(l => (
                   <div key={l} style={{ fontSize: '11px', backgroundColor: '#f3e5f5', color: '#7b1fa2', padding: '4px 8px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                     {l} <button onClick={() => handleDeleteLeader(l)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#d32f2f', fontSize: '10px', padding: 0 }}>✖</button>
                   </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input type="text" placeholder="Add Leader..." value={newLeaderInput} onChange={e => setNewLeaderInput(e.target.value)} style={{ flex: 1, padding: '6px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px' }} />
                <button onClick={handleAddLeader} style={{ padding: '6px 12px', backgroundColor: '#7b1fa2', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>Add</button>
              </div>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Table */}
        <div style={{ flex: 1, backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', overflowX: 'auto' }}>
          <h3 style={{ marginTop: 0, marginBottom: '20px' }}>Manage Team</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr>
                <th style={tableHeaderStyle}>Email & Role</th>
                <th style={tableHeaderStyle}>Assignments</th>
                <th style={tableHeaderStyle}>Sheet Link</th>
                <th style={tableHeaderStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {usersList.map((user) => {
                const isEditing = editingEmail === user.email;
                return (
                  <tr key={user.email} style={{ backgroundColor: isEditing ? '#f8f9fa' : 'transparent' }}>
                    
                    {/* COL 1: Email & Role */}
                    <td style={tableCellStyle}>
                      <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>{user.email}</div>
                      {isEditing ? (
                        <select value={editRole} onChange={(e) => setEditRole(e.target.value)} style={{ padding: '4px', borderRadius: '4px', fontSize: '12px' }}>
                          <option value="rater">Rater</option>
                          <option value="leader">Leader</option>
                          <option value="co-admin">Co-Admin</option>
                          <option value="admin">Admin</option>
                        </select>
                      ) : (
                        <span style={{ backgroundColor: user.role === 'admin' ? '#fce8e6' : user.role === 'co-admin' ? '#f3e5f5' : user.role === 'leader' ? '#e3f2fd' : '#e8f5e9', color: user.role === 'admin' ? '#c5221f' : user.role === 'co-admin' ? '#7b1fa2' : user.role === 'leader' ? '#1565c0' : '#1e8e3e', padding: '4px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                          {user.role}
                        </span>
                      )}
                    </td>

                    {/* 💡 COL 2: CONDITIONAL ASSIGNMENTS DISPLAY */}
                    <td style={tableCellStyle}>
                      {isEditing ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <select value={editClient} onChange={e => setEditClient(e.target.value)} style={{ padding: '4px', borderRadius: '4px', fontSize: '12px', border: '1px solid #ccc' }}>
                            <option value="">- Client -</option>
                            {clientList.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                          
                          {/* Only show Co-Admin Edit if the role is Co-Admin */}
                          {editRole === 'co-admin' && (
                            <select value={editCoAdmin} onChange={e => setEditCoAdmin(e.target.value)} style={{ padding: '4px', borderRadius: '4px', fontSize: '12px', border: '1px solid #ccc' }}>
                              <option value="">- Tag Co-Admin Name -</option>
                              {clientList.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          )}
                          
                          {/* Only show Leader Edit if the role is Leader */}
                          {editRole === 'leader' && (
                            <select value={editLeader} onChange={e => setEditLeader(e.target.value)} style={{ padding: '4px', borderRadius: '4px', fontSize: '12px', border: '1px solid #ccc' }}>
                              <option value="">- Tag Leader Name -</option>
                              {leaderList.map(l => <option key={l} value={l}>{l}</option>)}
                            </select>
                          )}
                        </div>
                      ) : (
                        <div style={{ fontSize: '12px', color: '#555', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div><strong style={{color: '#1a73e8'}}>Client:</strong> {user.clientName || <span style={{color:'#ccc'}}>None</span>}</div>
                          
                          {/* Only show Co-Admin label if the user is actually a Co-Admin */}
                          {user.role === 'co-admin' && (
                            <div><strong style={{color: '#e65100'}}>Co-Admin Name:</strong> {user.coAdminName || <span style={{color:'#ccc'}}>None</span>}</div>
                          )}
                          
                          {/* Only show Leader label if the user is actually a Leader */}
                          {user.role === 'leader' && (
                            <div><strong style={{color: '#7b1fa2'}}>Leader Name:</strong> {user.leaderName || <span style={{color:'#ccc'}}>None</span>}</div>
                          )}
                        </div>
                      )}
                    </td>

                    {/* COL 3: Sheet */}
                    <td style={tableCellStyle}>
                      {isEditing ? (
                        <input type="text" value={editSheetId} onChange={(e) => setEditSheetId(e.target.value)} placeholder="Paste new URL" style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '12px' }} />
                      ) : (
                        user.sheetId && user.sheetId.length > 5 ? (
                          <a href={`https://docs.google.com/spreadsheets/d/${user.sheetId}`} target="_blank" rel="noreferrer" style={{ color: '#1a73e8', textDecoration: 'none', fontSize: '12px', fontWeight: 'bold' }}>Open Sheet &#8599;</a>
                        ) : <span style={{ color: '#aaa', fontSize: '11px' }}>N/A</span>
                      )}
                    </td>

                    {/* COL 4: Actions */}
                    <td style={{ ...tableCellStyle, whiteSpace: 'nowrap' }}>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: '6px', flexDirection: 'column' }}>
                          <button onClick={handleUpdateUser} style={{ padding: '6px', backgroundColor: '#34a853', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>Save Changes</button>
                          <button onClick={() => setEditingEmail(null)} style={{ padding: '6px', backgroundColor: '#ccc', color: '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>Cancel</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => startEditing(user)} style={{ padding: '6px 12px', backgroundColor: '#e8eaed', color: '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>Edit</button>
                          {user.email !== 'admin@telus.com' && (
                            <button onClick={() => handleDeleteUser(user.email)} style={{ padding: '6px 12px', backgroundColor: '#fce8e6', color: '#c5221f', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>Delete</button>
                          )}
                        </div>
                      )}
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}