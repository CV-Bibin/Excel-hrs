import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase'; 

import Dashboard from './components/Dashboard';
import CalendarPanel from './components/CalendarPanel';
import Login from './components/Login'; 
import AdminPanel from './components/AdminPanel'; 
import TeamViewer from './components/TeamViewer'; 
import TeamAssignments from './components/TeamAssignments'; 
import BillingSettings from './components/BillingSettings';

const monthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

function App() {
  const [currentUser, setCurrentUser] = useState(null); 
  const [userRole, setUserRole] = useState(null);       
  const [userSheetId, setUserSheetId] = useState(null); 
  const [isCheckingAuth, setIsCheckingAuth] = useState(true); 

  // 💡 TABS: 'admin', 'assignments', 'team', or 'personal'
  const [activeTab, setActiveTab] = useState('personal'); 

  const [currentDate, setCurrentDate] = useState(new Date()); 
  const [gridData, setGridData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user.email);
        const userDoc = await getDoc(doc(db, 'users', user.email));
        if (userDoc.exists()) {
          const role = userDoc.data().role;
          setUserRole(role);
          setUserSheetId(userDoc.data().sheetId || null);
          
          // Smart default routing based on their role
          if (role === 'admin') setActiveTab('admin');
          else if (role === 'leader' || role === 'co-admin') setActiveTab('team');
          else setActiveTab('personal');
        }
      } else {
        setCurrentUser(null);
        setUserRole(null);
        setUserSheetId(null);
      }
      setIsCheckingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  const getMonthKey = (dateObj) => `${monthNames[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
  
  // Check if they have a valid sheet ID assigned to them
  const hasSheet = userSheetId && userSheetId.length > 5 && userSheetId !== 'MASTER_ADMIN';

  const fetchData = async () => {
    // Only fetch personal data if they are on their personal tab and have a sheet
    if (!currentUser || !hasSheet || activeTab !== 'personal') return; 
    
    setIsLoading(true);
    setStatus({ type: 'info', message: 'Syncing Data...' });
    try {
      const response = await fetch(`http://localhost:5000/api/get-hrs?accountName=${currentUser}&monthKey=${getMonthKey(currentDate)}&sheetId=${userSheetId}`);
      const data = await response.json();
      if (response.ok) {
        setGridData(data.gridData); 
        setStatus({ type: '', message: '' });
      } else {
        setStatus({ type: 'error', message: data.error });
      }
    } catch (error) {
      setStatus({ type: 'error', message: 'Server connection failed.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentUser, currentDate, userSheetId, activeTab]);

  const changeMonth = (offset) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + offset);
    setCurrentDate(newDate);
  };

  const handleLogout = async () => {
    await signOut(auth);
    setGridData([]);
  };

  if (isCheckingAuth) return <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>Loading...</div>;
  if (!currentUser) return <Login />;

  return (
    <div style={{ width: '100vw', maxWidth: '100%', height: '100vh', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', fontFamily: 'Arial, sans-serif', backgroundColor: '#f0f2f5', position: 'absolute', top: 0, left: 0 }}>
      
      {/* 💡 UNIFIED HEADER */}
      <div style={{ backgroundColor: '#fff', padding: '15px 30px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <h2 style={{ margin: 0, color: '#1a73e8' }}>Telus Rater Hub</h2>
          
          {/* TAB NAVIGATION */}
          <div style={{ display: 'flex', gap: '10px', marginLeft: '20px' }}>
          {/* Admin Only Tabs */}
            {userRole === 'admin' && (
              <>
                <button onClick={() => setActiveTab('admin')} style={{ padding: '8px 16px', border: 'none', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold', backgroundColor: activeTab === 'admin' ? '#1a73e8' : '#f1f3f4', color: activeTab === 'admin' ? 'white' : '#555' }}>Accounts</button>
                <button onClick={() => setActiveTab('assignments')} style={{ padding: '8px 16px', border: 'none', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold', backgroundColor: activeTab === 'assignments' ? '#1a73e8' : '#f1f3f4', color: activeTab === 'assignments' ? 'white' : '#555' }}>Assign Teams</button>
                {/* 💡 NEW TAB: */}
                <button onClick={() => setActiveTab('billing')} style={{ padding: '8px 16px', border: 'none', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold', backgroundColor: activeTab === 'billing' ? '#1a73e8' : '#f1f3f4', color: activeTab === 'billing' ? 'white' : '#555' }}>Billing & Rates</button>
              </>
            )}
            
            {/* Leader / Co-Admin / Admin Tab */}
            {(userRole === 'admin' || userRole === 'leader' || userRole === 'co-admin') && (
              <button onClick={() => setActiveTab('team')} style={{ padding: '8px 16px', border: 'none', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold', backgroundColor: activeTab === 'team' ? '#1a73e8' : '#f1f3f4', color: activeTab === 'team' ? 'white' : '#555' }}>Team Viewer</button>
            )}

            {/* Anyone with a Sheet Tab */}
            {hasSheet && (
              <button onClick={() => setActiveTab('personal')} style={{ padding: '8px 16px', border: 'none', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold', backgroundColor: activeTab === 'personal' ? '#1a73e8' : '#f1f3f4', color: activeTab === 'personal' ? 'white' : '#555' }}>My Data Entry</button>
            )}
          </div>
        </div>

        {/* LOGOUT AREA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 'bold', color: '#333' }}>{currentUser}</div>
            <div style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase' }}>{userRole}</div>
          </div>
          <button onClick={handleLogout} style={{ padding: '8px 15px', backgroundColor: '#fdecea', color: '#d32f2f', border: '1px solid #ef9a9a', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Logout</button>
        </div>
      </div>

      {status.message && activeTab === 'personal' && (
        <div style={{ textAlign: 'center', padding: '10px', backgroundColor: status.type === 'error' ? '#fdecea' : status.type === 'success' ? '#e8f5e9' : '#e3f2fd', color: status.type === 'error' ? '#d32f2f' : '#333' }}>
          {status.message}
        </div>
      )}

      {/* 💡 DYNAMIC CONTENT RENDERING */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        
        {activeTab === 'admin' && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <AdminPanel />
          </div>
        )}

        {/* 💡 YOU WERE MISSING THIS BLOCK RIGHT HERE! */}
        {activeTab === 'assignments' && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <TeamAssignments />
          </div>
        )}

       {activeTab === 'billing' && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <BillingSettings />
          </div>
        )}
        
        {activeTab === 'team' && (
          <TeamViewer 
            currentUserEmail={currentUser} 
            userRole={userRole} 
            currentDate={currentDate} 
            changeMonth={changeMonth} 
            getMonthKey={getMonthKey} 
          />
        )}

       {activeTab === 'personal' && (
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            <CalendarPanel 
              accountName={currentUser} 
              sheetId={userSheetId} /* 💡 FIX: Changed from spreadsheetId to userSheetId! */
              currentDate={currentDate}
              changeMonth={changeMonth}
              gridData={gridData}
              fetchData={fetchData}
              isLoading={isLoading}
              setStatus={setStatus}
            />
            <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
              <Dashboard gridData={gridData} isLoading={isLoading} accountName={currentUser} spreadsheetId={userSheetId} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;