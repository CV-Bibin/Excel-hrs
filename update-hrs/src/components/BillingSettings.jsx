import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export default function BillingSettings() {
  const [accounts, setAccounts] = useState([]);
  const [editingEmail, setEditingEmail] = useState(null);
  
  // Client Database State
  const [clientList, setClientList] = useState([]);
  const [newClientInput, setNewClientInput] = useState('');

  // 💡 NEW: Global Exchange Rate State
  const [exchangeRate, setExchangeRate] = useState(90);

  const [editBilling, setEditBilling] = useState({
    company: 'Telus',       // 💡 NEW: Default company
    clientName: '',
    clientRateUSD: 0,       // 💡 NEW: Storing in USD
    hasBonus: false,        // 💡 NEW: Bonus Toggle
    bonusTargetHours: 0, 
    leaderPayRate: 0,    
    leaderBonusRate: 0,  
    raterRate: 0,        
    raterBonusRate: 0    
  });

  const fetchData = async () => {
    try {
      // Fetch Clients
      const clientDoc = await getDoc(doc(db, 'settings', 'clients'));
      if (clientDoc.exists()) setClientList(clientDoc.data().names || []);

      // Fetch Global Exchange Rate
      const generalDoc = await getDoc(doc(db, 'settings', 'general'));
      if (generalDoc.exists() && generalDoc.data().usdToInr) {
        setExchangeRate(generalDoc.data().usdToInr);
      }

      // Fetch Accounts
      const querySnapshot = await getDocs(collection(db, 'users'));
      const fetched = [];
      querySnapshot.forEach(doc => {
        const data = doc.data();
        if (data.sheetId && data.sheetId.length > 5 && data.sheetId !== 'MASTER_ADMIN') {
          fetched.push(data);
        }
      });
      fetched.sort((a, b) => a.email.localeCompare(b.email));
      setAccounts(fetched);
    } catch (error) { console.error(error); }
  };

  useEffect(() => { fetchData(); }, []);

  // --- CLIENT MANAGEMENT FUNCTIONS ---
  const handleAddNewClient = async () => {
    if (!newClientInput.trim()) return;
    const updatedList = [...clientList, newClientInput.trim()];
    try {
      await setDoc(doc(db, 'settings', 'clients'), { names: updatedList }, { merge: true });
      setClientList(updatedList);
      setNewClientInput('');
    } catch (error) { alert("Failed to add client."); }
  };

  const handleDeleteClient = async (clientToDelete) => {
    if (!window.confirm(`Are you sure you want to delete ${clientToDelete}?`)) return;
    const updatedList = clientList.filter(c => c !== clientToDelete);
    try {
      await setDoc(doc(db, 'settings', 'clients'), { names: updatedList }, { merge: true });
      setClientList(updatedList);
    } catch (error) { alert("Failed to delete client."); }
  };

  const handleEditClient = async (oldName) => {
    const newName = window.prompt("Edit client name:", oldName);
    if (!newName || newName.trim() === "" || newName === oldName) return;
    const updatedList = clientList.map(c => c === oldName ? newName.trim() : c);
    try {
      await setDoc(doc(db, 'settings', 'clients'), { names: updatedList }, { merge: true });
      setClientList(updatedList);
    } catch (error) { alert("Failed to update client."); }
  };

  // --- EXCHANGE RATE FUNCTION ---
  const handleSaveExchangeRate = async () => {
    try {
      await setDoc(doc(db, 'settings', 'general'), { usdToInr: Number(exchangeRate) }, { merge: true });
      alert("Exchange rate updated successfully!");
    } catch (error) { alert("Failed to save exchange rate."); }
  };

  // --- ACCOUNT BILLING FUNCTIONS ---
  const startEditing = (user) => {
    setEditingEmail(user.email);
    const b = user.billing || {};
    setEditBilling({
      company: b.company || 'Telus',
      clientName: b.clientName || '',
      clientRateUSD: b.clientRateUSD || 0,
      hasBonus: b.hasBonus || false,
      bonusTargetHours: b.bonusTargetHours || 0,
      leaderPayRate: b.leaderPayRate || 200, 
      leaderBonusRate: b.leaderBonusRate || 0,
      raterRate: b.raterRate || 160,
      raterBonusRate: b.raterBonusRate || 0
    });
  };

  const handleSaveBilling = async () => {
    try {
      await updateDoc(doc(db, 'users', editingEmail), {
        billing: {
          company: editBilling.company,
          clientName: editBilling.clientName,
          clientRateUSD: Number(editBilling.clientRateUSD),
          hasBonus: editBilling.hasBonus,
          bonusTargetHours: Number(editBilling.bonusTargetHours), 
          leaderPayRate: Number(editBilling.leaderPayRate), 
          leaderBonusRate: Number(editBilling.leaderBonusRate),
          raterRate: Number(editBilling.raterRate),
          raterBonusRate: Number(editBilling.raterBonusRate)
        }
      });
      setEditingEmail(null);
      fetchData(); 
    } catch (error) { alert('Failed to save billing settings.'); }
  };

  const cellStyle = { padding: '12px', borderBottom: '1px solid #eee', fontSize: '13px', verticalAlign: 'top' };
  const inputStyle = { width: '60px', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' };

  return (
    <div style={{ padding: '40px', maxWidth: '1400px', margin: '0 auto' }}>
      <h2 style={{ color: '#1a73e8', borderBottom: '2px solid #eee', paddingBottom: '10px' }}>Billing & Pay Rates</h2>
      
      {/* 💡 TOP CONTROLS: Client DB & Exchange Rate */}
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '30px' }}>
        
        {/* Client Manager */}
        <div style={{ flex: 2, display: 'flex', gap: '15px', alignItems: 'center', backgroundColor: '#fff', padding: '15px 20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <div style={{ fontWeight: 'bold', color: '#555' }}>Clients:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', flex: 1 }}>
            {clientList.length === 0 && <span style={{ color: '#aaa', fontStyle: 'italic', fontSize: '13px' }}>No clients...</span>}
            {clientList.map(c => (
              <div key={c} style={{ display: 'flex', alignItems: 'center', backgroundColor: '#e8f0fe', borderRadius: '15px', overflow: 'hidden', border: '1px solid #d2e3fc' }}>
                <span style={{ color: '#1a73e8', padding: '4px 10px', fontSize: '12px', fontWeight: 'bold' }}>{c}</span>
                <button onClick={() => handleEditClient(c)} style={{ border: 'none', background: '#d2e3fc', cursor: 'pointer', padding: '4px 6px', fontSize: '10px' }} title="Edit">✏️</button>
                <button onClick={() => handleDeleteClient(c)} style={{ border: 'none', background: '#fce8e6', cursor: 'pointer', padding: '4px 6px', fontSize: '10px' }} title="Delete">❌</button>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input type="text" placeholder="New Client" value={newClientInput} onChange={e => setNewClientInput(e.target.value)} style={{ padding: '6px', border: '1px solid #ccc', borderRadius: '4px', width: '120px' }} />
            <button onClick={handleAddNewClient} style={{ backgroundColor: '#34a853', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Add</button>
          </div>
        </div>

        {/* Exchange Rate Tool */}
        <div style={{ flex: 1, display: 'flex', gap: '10px', alignItems: 'center', backgroundColor: '#fff', padding: '15px 20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <div style={{ fontWeight: 'bold', color: '#555' }}>$1 USD = ₹</div>
          <input type="number" value={exchangeRate} onChange={e => setExchangeRate(e.target.value)} style={{ padding: '6px', border: '1px solid #ccc', borderRadius: '4px', width: '70px', fontWeight: 'bold', color: '#1a73e8' }} />
          <button onClick={handleSaveExchangeRate} style={{ backgroundColor: '#1a73e8', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Update</button>
        </div>
      </div>

      {/* 💡 MAIN TABLE */}
      <div style={{ backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#f1f3f4', color: '#555', fontSize: '12px' }}>
              <th style={{ padding: '12px' }}>Account & Company</th>
              <th style={{ padding: '12px', backgroundColor: '#e8f0fe' }}>Client & USD Rate</th>
              <th style={{ padding: '12px', backgroundColor: '#e6f4ea', textAlign: 'center' }}>Bonus Settings</th>
              <th style={{ padding: '12px', backgroundColor: '#f3e5f5' }}>Leader Pay</th>
              <th style={{ padding: '12px', backgroundColor: '#fff3e0' }}>Rater Pay</th>
              <th style={{ padding: '12px', width: '90px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map(account => {
              const isEditing = editingEmail === account.email;
              const b = account.billing || { company: 'Telus', clientName: '', clientRateUSD: 0, hasBonus: false, bonusTargetHours: 0, leaderPayRate: 0, leaderBonusRate: 0, raterRate: 0, raterBonusRate: 0 };
              
              // Calc converted value
              const convertedINR = (b.clientRateUSD * exchangeRate).toFixed(2);

              return (
                <tr key={account.email} style={{ backgroundColor: isEditing ? '#f8f9fa' : '#fff' }}>
                  
                  {/* Col 1: Email & Company */}
                  <td style={{ ...cellStyle, fontWeight: 'bold' }}>
                    {account.email} 
                    <span style={{ fontSize: '10px', color: '#aaa', display: 'block', textTransform: 'uppercase', marginTop: '4px' }}>{account.role}</span>
                    
                    {isEditing ? (
                      <select value={editBilling.company} onChange={e => setEditBilling({...editBilling, company: e.target.value})} style={{ marginTop: '8px', padding: '4px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '11px', width: '100%' }}>
                        <option value="Telus">Telus</option>
                        <option value="Peroptyx">Peroptyx</option>
                        <option value="OneForma">OneForma</option>
                      </select>
                    ) : (
                      <span style={{ display: 'inline-block', marginTop: '6px', padding: '3px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold', backgroundColor: b.company === 'Peroptyx' ? '#e0f2f1' : b.company === 'OneForma' ? '#fbe9e7' : '#e8eaf6', color: '#333' }}>
                        {b.company}
                      </span>
                    )}
                  </td>
                  
                  {isEditing ? (
                    <>
                      {/* Col 2: Client */}
                      <td style={{ ...cellStyle, backgroundColor: '#f8fbff' }}>
                        <select value={editBilling.clientName} onChange={e => setEditBilling({...editBilling, clientName: e.target.value})} style={{ padding: '6px', width: '100%', border: '1px solid #ccc', borderRadius: '4px', marginBottom: '8px' }}>
                          <option value="">- Select Client -</option>
                          {clientList.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <span style={{ fontSize: '11px', color: '#666' }}>Client Rate (USD $)</span><br/>
                        <input type="number" step="0.01" value={editBilling.clientRateUSD} onChange={e => setEditBilling({...editBilling, clientRateUSD: e.target.value})} style={inputStyle} />
                      </td>
                      
                      {/* Col 3: Bonus Toggle & Target */}
                      <td style={{ ...cellStyle, backgroundColor: '#f9fdfa', textAlign: 'center' }}>
                        <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#1e8e3e', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                          <input type="checkbox" checked={editBilling.hasBonus} onChange={e => setEditBilling({...editBilling, hasBonus: e.target.checked})} style={{ cursor: 'pointer' }}/>
                          Enable Bonus
                        </label>
                        
                        {editBilling.hasBonus && (
                          <div style={{ marginTop: '10px' }}>
                            <span style={{ fontSize: '10px', color: '#666' }}>Target Hrs</span><br/>
                            <input type="number" value={editBilling.bonusTargetHours} onChange={e => setEditBilling({...editBilling, bonusTargetHours: e.target.value})} style={{...inputStyle, width: '50px'}} />
                          </div>
                        )}
                      </td>

                      {/* Col 4: Leader Pay */}
                      <td style={{ ...cellStyle, backgroundColor: '#fbf3fc' }}>
                        <div style={{ marginBottom: editBilling.hasBonus ? '8px' : '0' }}>
                          <span style={{ fontSize: '11px', color: '#7b1fa2' }}>Base Rate (₹)</span><br/>
                          <input type="number" value={editBilling.leaderPayRate} onChange={e => setEditBilling({...editBilling, leaderPayRate: e.target.value})} style={inputStyle} />
                        </div>
                        {editBilling.hasBonus && (
                          <div>
                            <span style={{ fontSize: '11px', color: '#7b1fa2', fontWeight: 'bold' }}>Bonus Rate (₹)</span><br/>
                            <input type="number" value={editBilling.leaderBonusRate} onChange={e => setEditBilling({...editBilling, leaderBonusRate: e.target.value})} style={{...inputStyle, border: '1px solid #7b1fa2', backgroundColor: '#f3e5f5'}} />
                          </div>
                        )}
                      </td>
                      
                      {/* Col 5: Rater Pay */}
                      <td style={{ ...cellStyle, backgroundColor: '#fffdf9' }}>
                        <div style={{ marginBottom: editBilling.hasBonus ? '8px' : '0' }}>
                          <span style={{ fontSize: '11px', color: '#e65100' }}>Base Rate (₹)</span><br/>
                          <input type="number" value={editBilling.raterRate} onChange={e => setEditBilling({...editBilling, raterRate: e.target.value})} style={inputStyle} />
                        </div>
                        {editBilling.hasBonus && (
                          <div>
                            <span style={{ fontSize: '11px', color: '#e65100', fontWeight: 'bold' }}>Bonus Rate (₹)</span><br/>
                            <input type="number" value={editBilling.raterBonusRate} onChange={e => setEditBilling({...editBilling, raterBonusRate: e.target.value})} style={{...inputStyle, border: '1px solid #e65100', backgroundColor: '#fff3e0'}} />
                          </div>
                        )}
                      </td>

                      <td style={cellStyle}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <button onClick={handleSaveBilling} style={{ background: '#34a853', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Save</button>
                          <button onClick={() => setEditingEmail(null)} style={{ background: '#ccc', color: '#333', border: 'none', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      {/* VIEW MODE */}
                      <td style={{ ...cellStyle, backgroundColor: '#f8fbff' }}>
                        <strong style={{ color: '#1a73e8', display: 'block', fontSize: '14px' }}>{b.clientName || 'Not Assigned'}</strong>
                        <span style={{ color: '#555', fontSize: '12px' }}>
                          Bills: <strong>${b.clientRateUSD}</strong>/hr <br/>
                          <span style={{ fontSize: '10px', color: '#888' }}>(≈ ₹{convertedINR})</span>
                        </span>
                      </td>
                      
                      <td style={{ ...cellStyle, backgroundColor: '#f9fdfa', textAlign: 'center', verticalAlign: 'middle' }}>
                        {b.hasBonus && b.bonusTargetHours > 0 ? (
                           <div style={{ padding: '6px', border: '1px dashed #1e8e3e', borderRadius: '4px', color: '#1e8e3e', fontWeight: 'bold', fontSize: '12px' }}>
                             Target: {b.bonusTargetHours}h
                           </div>
                        ) : <span style={{ color: '#ccc', fontSize: '12px' }}>No Bonus</span>}
                      </td>

                      <td style={{ ...cellStyle, backgroundColor: '#fbf3fc' }}>
                        Base: <strong>₹{b.leaderPayRate}</strong>/hr<br/>
                        {b.hasBonus && b.bonusTargetHours > 0 ? (
                           <span style={{ color: '#7b1fa2', marginTop: '4px', display: 'block', fontSize: '12px' }}>Bonus: <strong>₹{b.leaderBonusRate}</strong>/hr</span>
                        ) : null}
                      </td>
                      
                      <td style={{ ...cellStyle, backgroundColor: '#fffdf9' }}>
                        Base: <strong>₹{b.raterRate}</strong>/hr<br/>
                        {b.hasBonus && b.bonusTargetHours > 0 ? (
                           <span style={{ color: '#e65100', marginTop: '4px', display: 'block', fontSize: '12px' }}>Bonus: <strong>₹{b.raterBonusRate}</strong>/hr</span>
                        ) : null}
                      </td>
                      
                      <td style={cellStyle}>
                        <button onClick={() => startEditing(account)} style={{ background: '#e8eaed', color: '#333', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', width: '100%' }}>Edit</button>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}