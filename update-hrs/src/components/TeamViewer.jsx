import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { collection, onSnapshot, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import TeamViewerHeader from './TeamViewerHeader';
import PayrollTable from './PayrollTable';
import CustomAlert from './CustomAlert'; // 💡 Custom Alert Imported

export default function TeamViewer({ currentUserEmail, userRole, currentDate, changeMonth, getMonthKey }) {
  const [allUsers, setAllUsers] = useState([]);
  const [selectedManager, setSelectedManager] = useState(userRole === 'admin' ? '' : currentUserEmail);
  const [teamData, setTeamData] = useState([]);
  
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isSyncingSheets, setIsSyncingSheets] = useState(false);
  const [syncTrigger, setSyncTrigger] = useState(0);
  const [exchangeRate, setExchangeRate] = useState(90);

  // Tracks which accounts need a new sheet created
  const [missingSheets, setMissingSheets] = useState({});

  const isFetchingRef = useRef(false);

  // 💡 NEW: Custom Alert State
  const [alertConfig, setAlertConfig] = useState({
    isOpen: false, title: '', message: '', type: 'info', onConfirm: null, onCancel: null
  });

  const [coAdminGroups, setCoAdminGroups] = useState(() => {
    const saved = localStorage.getItem('coAdminGroups');
    return saved ? JSON.parse(saved) : {};
  });

  const [selfRatedMap, setSelfRatedMap] = useState(() => {
    const saved = localStorage.getItem('selfRatedMap');
    return saved ? JSON.parse(saved) : {};
  });

  const isCoAdmin = userRole === 'co-admin';
  const isAdmin = userRole === 'admin';
  
  const showClientPay = isAdmin || isCoAdmin;
  const showLeaderPay = true; 
  const showRaterPay = isAdmin || userRole === 'leader';
  const showLeaderProfit = isAdmin; 

  // 💡 NEW: Custom Alert Helpers
  const closeAlert = () => setAlertConfig(prev => ({ ...prev, isOpen: false }));

  const showAlert = (title, message, type = 'info') => {
    setAlertConfig({ isOpen: true, title, message, type, onConfirm: closeAlert });
  };

  const showConfirm = (title, message, onConfirmAction) => {
    setAlertConfig({
      isOpen: true, title, message, type: 'confirm',
      onCancel: closeAlert,
      onConfirm: () => {
        closeAlert();
        onConfirmAction();
      }
    });
  };

  useEffect(() => {
    const unsubSettings = onSnapshot(doc(db, 'settings', 'general'), (docSnap) => {
      if (docSnap.exists() && docSnap.data().usdToInr) setExchangeRate(docSnap.data().usdToInr);
    });
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const fetched = [];
      snapshot.forEach(doc => fetched.push(doc.data()));
      setAllUsers(fetched);
    });
    return () => { unsubSettings(); unsubUsers(); };
  }, []);

  const managersList = useMemo(() => allUsers.filter(u => u.role === 'leader' || u.role === 'co-admin'), [allUsers]);
  const managerProfile = useMemo(() => allUsers.find(u => u.email === selectedManager), [allUsers, selectedManager]);
  
  const teamAccounts = useMemo(() => {
    return allUsers.filter(account => {
      if (!account.sheetId || account.sheetId.length <= 5 || account.sheetId === 'MASTER_ADMIN') return false;
      const mArray = Array.isArray(account.managers) ? account.managers : [];
      if (mArray.includes(selectedManager) || account.manager === selectedManager) return true;

      if (managerProfile) {
        if (account.email === managerProfile.email) return true;
        if (managerProfile.role === 'co-admin') {
          const matchClient = managerProfile.clientName && (account.clientName === managerProfile.clientName || account.coAdminName === managerProfile.clientName);
          const matchCoAdmin = managerProfile.coAdminName && (account.clientName === managerProfile.coAdminName || account.coAdminName === managerProfile.coAdminName);
          if (matchClient || matchCoAdmin) return true;
        }
        if (managerProfile.role === 'leader') {
          const matchLeader = managerProfile.leaderName && account.leaderName === managerProfile.leaderName;
          if (matchLeader) return true;
        }
      }
      return false;
    });
  }, [allUsers, selectedManager, managerProfile]);

  const currentMonthKey = getMonthKey(currentDate);

  useEffect(() => {
    const interval = setInterval(() => setSyncTrigger(prev => prev + 1), 45000);
    return () => clearInterval(interval);
  }, []);

  const triggerManualSync = () => { if (!isSyncingSheets && !isFetchingRef.current) setSyncTrigger(prev => prev + 1); };

  const buildRowData = useCallback((account, timeData, excelMissing = false) => {
    const { weeklyTotals = Array.from({length: 6}, () => ({ mints: 0, scnds: 0 })), monthMints = 0, monthScnds = 0, decimalHours = 0 } = timeData || {};

    const b = account.billing || {};
    const hitTarget = b.hasBonus && b.bonusTargetHours > 0 && decimalHours >= b.bonusTargetHours;
    const clientRateUSD = b.clientRateUSD || 0;
    const clientPaymentUSD = decimalHours * clientRateUSD;
    const clientRateINR = clientRateUSD * exchangeRate;
    const clientPaymentINR = decimalHours * clientRateINR;
    
    const finalLeaderRate = hitTarget ? (b.leaderBonusRate || b.leaderPayRate || 0) : (b.leaderPayRate || 0);
    const leaderPayment = decimalHours * finalLeaderRate;
    const finalRaterRate = hitTarget ? (b.raterBonusRate || b.raterRate || 0) : (b.raterRate || 0);
    const raterPayment = decimalHours * finalRaterRate;

    const leadersList = allUsers.filter(u => u.role === 'leader');
    const assignedLeaderEmail = (Array.isArray(account.managers) ? account.managers : []).find(email => leadersList.some(l => l.email === email));
    const assignedLeaderProfile = leadersList.find(l => l.email === assignedLeaderEmail);
    const hasLeader = !!assignedLeaderEmail || !!account.leaderName;
    const displayLeaderName = assignedLeaderProfile ? (assignedLeaderProfile.leaderName || assignedLeaderProfile.email.split('@')[0]) : (account.leaderName || '');

    return {
      email: account.email, name: account.email.split('@')[0], sheetId: account.sheetId, company: b.company || 'Unknown',
      role: account.role, clientName: account.clientName || '', coAdminName: account.coAdminName || '', 
      leaderName: account.leaderName || '', hasLeader, displayLeaderName, excelMissing,
      
      isDisabled: account.isDisabled || false, // 💡 ADD THIS LINE

      weeklyTotals, monthMints, monthScnds, decimalHours, hitTarget, clientRateUSD, clientPaymentUSD, clientRateINR, clientPaymentINR, 
      finalLeaderRate, leaderPayment, finalRaterRate, raterPayment, leaderMarginTotal: leaderPayment - raterPayment, coAdminProfit: clientPaymentINR - leaderPayment 
    };
  }, [allUsers, exchangeRate]);

  // INSTANT LOAD FROM DB (MERGE MODE)
  const loadFromDatabase = useCallback(async () => {
    if (!selectedManager || teamAccounts.length === 0) return;
    
    const dbPromises = teamAccounts.map(async (account) => {
      const docId = `${account.email}_${currentMonthKey}`;
      const snap = await getDoc(doc(db, 'monthly_timesheets', docId));
      if (snap.exists()) {
        return buildRowData(account, snap.data(), snap.data().excelMissing);
      } else {
        return buildRowData(account, null, false);
      }
    });

    const instantRows = await Promise.all(dbPromises);
    
    // 💡 THE FIX: Safely merge newly discovered accounts onto the screen instantly
    setTeamData(prevData => {
      const newArray = [...prevData];
      instantRows.forEach(row => {
        const exists = newArray.some(r => r.email === row.email);
        if (!exists) newArray.push(row);
      });
      return newArray;
    });

    setIsInitialLoad(false);
  }, [selectedManager, currentMonthKey, teamAccounts, buildRowData]);
  // BACKGROUND SYNC (Catches the 404 Error from Backend)
  // BACKGROUND SYNC (Catches the 404 Error from Backend)
  const syncWithExcel = useCallback(async () => {
    if (!selectedManager || teamAccounts.length === 0 || isFetchingRef.current) return;
    
    isFetchingRef.current = true; 
    setIsSyncingSheets(true);

    const [mName, yString] = currentMonthKey.split(" ");
    const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    const mIndex = monthNames.indexOf(mName);
    const year = parseInt(yString, 10);
    const firstDayOfMonth = new Date(year, mIndex, 1).getDay();

    const batchSize = 5; 
    const newMissingSheets = { ...missingSheets };

    try {
      for (let i = 0; i < teamAccounts.length; i += batchSize) {
        const batch = teamAccounts.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (account) => {
          const docId = `${account.email}_${currentMonthKey}`;
          const docRef = doc(db, 'monthly_timesheets', docId);

          // 💡 THE NEW FIX: If the account is disabled in Firebase, skip Excel completely!
          // We just load whatever is currently saved in the database and freeze it.
          if (account.isDisabled) {
             const snap = await getDoc(docRef);
             if (snap.exists()) {
                return buildRowData(account, snap.data(), false);
             } else {
                return buildRowData(account, null, false);
             }
          }

          try {
            const response = await fetch(`http://localhost:5000/api/get-hrs?accountName=${account.email}&monthKey=${currentMonthKey}&sheetId=${account.sheetId}`);
            
            let data;
            try { data = await response.json(); } catch (e) { throw new Error("API Parse Error"); }

            // Check for the new Disabled lock from the backend
            if (response.status === 403 || data.error === 'DISABLED') {
               throw new Error("DISABLED");
            }

            if (response.status === 404 || data.error === 'SHEET_MISSING') {
              throw new Error("SHEET_MISSING");
            }

            if (!response.ok || !data.gridData) {
              throw new Error("General API Error");
            }
            
            if (newMissingSheets[account.email]) {
               delete newMissingSheets[account.email];
               setMissingSheets({...newMissingSheets});
            }

            let weeklyTotals = Array.from({length: 6}, () => ({ mints: 0, scnds: 0 }));
            let monthMints = 0; let monthScnds = 0;

            data.gridData.forEach(dayData => {
              const day = parseInt(dayData.date.split('/')[0], 10);
              const weekIndex = Math.floor((day - 1 + firstDayOfMonth) / 7);
              if(weekIndex >= 0 && weekIndex < 6) {
                 weeklyTotals[weekIndex].mints += dayData.totalMints;
                 weeklyTotals[weekIndex].scnds += dayData.totalScnds;
              }
              monthMints += dayData.totalMints; monthScnds += dayData.totalScnds;
            });

            monthMints += Math.floor(monthScnds / 60);
            monthScnds = monthScnds % 60;
            const fetchedDecimalHours = monthMints / 60 + monthScnds / 3600;

            weeklyTotals = weeklyTotals.map(w => ({ mints: w.mints + Math.floor(w.scnds / 60), scnds: w.scnds % 60 }));
            const timeData = { gridData: data.gridData, weeklyTotals, monthMints, monthScnds, decimalHours: fetchedDecimalHours, excelMissing: false, lastSynced: new Date().toISOString() };            
            await setDoc(docRef, timeData, { merge: true });
            return buildRowData(account, timeData, false);

          } catch (error) {
            
            if (error.message === "SHEET_MISSING") {
               setMissingSheets(prev => ({ ...prev, [account.email]: true }));
            }

            // Fallback to DB safely
            const snap = await getDoc(docRef);
            if (snap.exists() && snap.data().weeklyTotals) {
               if (error.message === "SHEET_MISSING") {
                  try { await setDoc(docRef, { excelMissing: true }, { merge: true }); } catch(e){}
               }
               return buildRowData(account, snap.data(), error.message === "SHEET_MISSING");
            } else {
               return buildRowData(account, null, error.message === "SHEET_MISSING");
            }
          }
        });

        const batchResults = await Promise.all(batchPromises);
        
        setTeamData(prevData => {
          const newArray = [...prevData];
          batchResults.forEach(syncedRow => {
            const index = newArray.findIndex(r => r.email === syncedRow.email);
            if (index >= 0) newArray[index] = syncedRow;
            else newArray.push(syncedRow);
          });
          return newArray;
        });
      }
    } finally {
      setIsSyncingSheets(false);
      isFetchingRef.current = false;
    }
  // eslint-disable-next-line
  }, [selectedManager, currentMonthKey, teamAccounts, buildRowData]);

 useEffect(() => {
    if (allUsers.length === 0) return;

    if (!selectedManager || teamAccounts.length === 0) {
      setTeamData([]);
      setIsInitialLoad(false);
      return;
    }

    const runSequence = async () => {
      // 💡 THE FIX: Always run the DB loader when the team changes to catch missing accounts!
      await loadFromDatabase(); 
      syncWithExcel(); 
    };

    runSequence();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedManager, currentMonthKey, syncTrigger, teamAccounts.length, allUsers.length]);

  // 💡 NEW: Custom Alert Restore Function
  const handleCreateNewSheet = (accountEmail, sheetId, restoreBackup = false) => {
    const actionText = restoreBackup ? "RESTORE from backup" : "create a BLANK sheet";
    
    showConfirm(
      "Confirm Sheet Action",
      `Are you sure you want to ${actionText} for ${accountEmail} for ${currentMonthKey}?`,
      async () => {
        let backupData = null;

        if (restoreBackup) {
          const docRef = doc(db, 'monthly_timesheets', `${accountEmail}_${currentMonthKey}`);
          const snap = await getDoc(docRef);
          if (snap.exists() && snap.data().gridData) {
            backupData = snap.data().gridData;
          } else {
            showAlert("No Backup Found", "⚠️ No detailed backup data found in Firebase! Creating a blank sheet instead.", "warning");
          }
        }

        try {
          const res = await fetch('http://localhost:5000/api/create-sheet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accountName: accountEmail, sheetId, monthKey: currentMonthKey, backupData })
          });

          if (res.ok) {
             showAlert("Success!", `Sheet ${restoreBackup ? 'restored' : 'created'} successfully! Syncing now...`, "success");
             const newMissing = { ...missingSheets };
             delete newMissing[accountEmail];
             setMissingSheets(newMissing);
             triggerManualSync();
          } else {
             showAlert("Error", "Failed to create sheet. Check backend logs.", "error");
          }
        } catch (err) {
          showAlert("Network Error", "Network error trying to create sheet.", "error");
        }
      }
    );
  };

  const handleCoAdminGroupChange = (email, newGroup) => {
    const updated = { ...coAdminGroups, [email]: newGroup };
    setCoAdminGroups(updated);
    localStorage.setItem('coAdminGroups', JSON.stringify(updated));
  };

  const handleSelfRatedChange = (email, isChecked) => {
    const updated = { ...selfRatedMap, [email]: isChecked };
    setSelfRatedMap(updated);
    localStorage.setItem('selfRatedMap', JSON.stringify(updated));
  };

  const getGroupedData = () => {
    const groups = {};

    if (isCoAdmin) {
      groups['My Own Accounts'] = []; 
      groups['Non-Profit Accounts'] = [];
      const managerProf = managerProfile || {};
      
      teamData.forEach(row => {
        const adjustedRow = { ...row };
        adjustedRow.isOwnCoAdminAccount = row.email === managerProf.email;
        
        // Pass missing state down to the table
        adjustedRow.needsNewSheet = !!missingSheets[row.email];

        const canCoAdminSelfRate = row.role !== 'leader' && !row.hasLeader;
        const isRatedByCoAdmin = canCoAdminSelfRate && (selfRatedMap[row.email] || adjustedRow.isOwnCoAdminAccount);

        if (isRatedByCoAdmin) {
            adjustedRow.coAdminProfit = adjustedRow.clientPaymentINR;
            adjustedRow.leaderPayment = 0;
            adjustedRow.finalLeaderRate = 0;
            adjustedRow.raterPayment = 0;
        }

        const isOfficiallyOwned = (managerProf.coAdminName && row.coAdminName === managerProf.coAdminName) || (managerProf.clientName && row.clientName === managerProf.clientName) || adjustedRow.isOwnCoAdminAccount;
        const manualGroup = coAdminGroups[row.email] || 'Non-Profit Accounts';

        if (isOfficiallyOwned || manualGroup === 'My Own Accounts') {
          groups['My Own Accounts'].push({ ...adjustedRow, isAutoOwned: isOfficiallyOwned });
        } 
        else if (manualGroup === 'Non-Profit Accounts') {
          adjustedRow.coAdminProfit = 0; 
          groups['Non-Profit Accounts'].push({ ...adjustedRow, isAutoOwned: false });
        } 
        else if (manualGroup === 'External Accounts') {
          const baseCoAdminProfit = adjustedRow.coAdminProfit;
          const halfProfit = baseCoAdminProfit / 2;

          if (isRatedByCoAdmin) {
            adjustedRow.coAdminProfit = halfProfit + adjustedRow.leaderPayment;
            adjustedRow.leaderPayment = 0; 
            adjustedRow.finalLeaderRate = 0;
            adjustedRow.raterPayment = 0;
          } else {
            adjustedRow.coAdminProfit = halfProfit;
          }

          const extGroupKey = adjustedRow.clientName ? `External Accounts: ${adjustedRow.clientName}` : 'External Accounts: Unassigned Client';
          if (!groups[extGroupKey]) groups[extGroupKey] = [];
          groups[extGroupKey].push({ ...adjustedRow, isAutoOwned: false });
        }
      });
    } else {
      teamData.forEach(row => {
        const adjustedRow = { ...row };
        adjustedRow.needsNewSheet = !!missingSheets[row.email];
        const isRatedByLeader = selfRatedMap[row.email] || row.role === 'leader';
        if (isRatedByLeader) {
            adjustedRow.raterPayment = 0;
            adjustedRow.finalRaterRate = 0;
            adjustedRow.leaderMarginTotal = adjustedRow.leaderPayment;
        }
        const groupName = row.clientName || 'Unassigned Client';
        if (!groups[groupName]) groups[groupName] = [];
        groups[groupName].push(adjustedRow);
      });
    }
    return groups;
  };

  const groupedTeamData = getGroupedData();
  
  const profitGeneratingData = Object.entries(groupedTeamData)
    .filter(([key]) => key !== 'Non-Profit Accounts')
    .flatMap(([_, rows]) => rows);

  const calcTotals = (rows) => ({
    decHrs: rows.reduce((sum, r) => sum + r.decimalHours, 0),
    clientUSD: rows.reduce((sum, r) => sum + r.clientPaymentUSD, 0),
    clientINR: rows.reduce((sum, r) => sum + r.clientPaymentINR, 0),
    ldrPay: rows.reduce((sum, r) => sum + r.leaderPayment, 0),
    rtrPay: rows.reduce((sum, r) => sum + r.raterPayment, 0),
    ldrMargin: rows.reduce((sum, r) => sum + r.leaderMarginTotal, 0),
    coAdminProfit: rows.reduce((sum, r) => sum + r.coAdminProfit, 0)
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#f8f9fa' }}>
      <TeamViewerHeader 
        isAdmin={isAdmin} selectedManager={selectedManager} setSelectedManager={setSelectedManager} 
        managersList={managersList} showClientPay={showClientPay} exchangeRate={exchangeRate} 
        isSyncingSheets={isSyncingSheets} isInitialLoad={isInitialLoad} changeMonth={changeMonth} 
        getMonthKey={getMonthKey} currentDate={currentDate} triggerManualSync={triggerManualSync}
      />

      <div style={{ flex: 1, padding: '20px', overflow: 'auto' }}>
        {!selectedManager ? (
          <div style={{ textAlign: 'center', marginTop: '100px', color: '#888' }}>Please select a Manager to view their team's payroll.</div>
        ) : isInitialLoad && !teamData.length ? (
          <div style={{ textAlign: 'center', marginTop: '100px', color: '#1a73e8', fontWeight: 'bold' }}>Loading Database Snapshots...</div>
        ) : teamData.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: '100px', color: '#888' }}>No assigned accounts found.</div>
        ) : (
          <PayrollTable 
            isCoAdmin={isCoAdmin} 
            groupedTeamData={groupedTeamData} 
            grandTotals={calcTotals(profitGeneratingData)} 
            coAdminGroups={coAdminGroups} 
            handleCoAdminGroupChange={handleCoAdminGroupChange} 
            selfRatedMap={selfRatedMap} 
            handleSelfRatedChange={handleSelfRatedChange}
            showClientPay={showClientPay} showLeaderPay={showLeaderPay} showRaterPay={showRaterPay} 
            showLeaderProfit={showLeaderProfit} calcTotals={calcTotals} 
            handleCreateNewSheet={handleCreateNewSheet} 
          />
        )}
      </div>

      {/* 💡 NEW: Custom Alert Rendered Here */}
      <CustomAlert 
        isOpen={alertConfig.isOpen}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onConfirm={alertConfig.onConfirm}
        onCancel={alertConfig.onCancel}
        confirmText={alertConfig.type === 'confirm' ? 'Yes, Proceed' : 'OK'}
      />
    </div>
  );
}