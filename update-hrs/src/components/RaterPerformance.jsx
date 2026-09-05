import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const monthNames = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december'
];

const QUARTER_TARGET_HOURS = 20;

const getCurrentQuarterMonths = () => {
  const now = new Date();
  const year = now.getFullYear();
  const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;

  return [0, 1, 2].map((offset) => {
    const monthIndex = quarterStartMonth + offset;
    return {
      key: `${monthNames[monthIndex]} ${year}`,
      label: `${monthNames[monthIndex].slice(0, 3).toUpperCase()} ${year}`
    };
  });
};

const calculateGridHours = (gridData = []) => {
  let totalMints = 0;
  let totalScnds = 0;

  gridData.forEach((day) => {
    totalMints += Number(day.totalMints) || 0;
    totalScnds += Number(day.totalScnds) || 0;
  });

  return totalMints / 60 + totalScnds / 3600;
};

const formatHours = (hours) => `${Number(hours || 0).toFixed(2)} h`;

const getPerformanceLevel = (hours) => {
  if (hours >= QUARTER_TARGET_HOURS) {
    return { key: 'safe', label: 'SAFE', color: '#137333', bg: '#e6f4ea', rowBg: '#fbfffc', border: '#81c995' };
  }

  if (hours >= 10) {
    return { key: 'warning', label: 'WARNING', color: '#b06000', bg: '#fff4e5', rowBg: '#fffaf2', border: '#fbbc04' };
  }

  return { key: 'danger', label: 'DANGER', color: '#c5221f', bg: '#fce8e6', rowBg: '#fff7f7', border: '#f28b82' };
};

const buildMonthlyTimeData = (gridData) => {
  let monthMints = 0;
  let monthScnds = 0;
  const weeklyTotals = Array.from({ length: 6 }, () => ({ mints: 0, scnds: 0 }));

  if (!gridData || gridData.length === 0) {
    return {
      gridData: [],
      weeklyTotals,
      monthMints: 0,
      monthScnds: 0,
      decimalHours: 0,
      lastSynced: new Date().toISOString()
    };
  }

  const [firstDay, firstMonth, firstYear] = gridData[0].date.split('/');
  const firstDayOfMonth = new Date(Number(firstYear), Number(firstMonth) - 1, 1).getDay();

  gridData.forEach((dayData) => {
    const day = parseInt(dayData.date.split('/')[0], 10);
    const weekIndex = Math.floor((day - 1 + firstDayOfMonth) / 7);

    if (weekIndex >= 0 && weekIndex < 6) {
      weeklyTotals[weekIndex].mints += Number(dayData.totalMints) || 0;
      weeklyTotals[weekIndex].scnds += Number(dayData.totalScnds) || 0;
    }

    monthMints += Number(dayData.totalMints) || 0;
    monthScnds += Number(dayData.totalScnds) || 0;
  });

  monthMints += Math.floor(monthScnds / 60);
  monthScnds = monthScnds % 60;

  const normalizedWeeklyTotals = weeklyTotals.map((week) => ({
    mints: week.mints + Math.floor(week.scnds / 60),
    scnds: week.scnds % 60
  }));

  return {
    gridData,
    weeklyTotals: normalizedWeeklyTotals,
    monthMints,
    monthScnds,
    decimalHours: monthMints / 60 + monthScnds / 3600,
    excelMissing: false,
    lastSynced: new Date().toISOString()
  };
};

export default function RaterPerformance({ currentUserEmail, userRole }) {
  const [allUsers, setAllUsers] = useState([]);
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedClient, setSelectedClient] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [lastRefreshText, setLastRefreshText] = useState('');

  const quarterMonths = useMemo(() => getCurrentQuarterMonths(), []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      setAllUsers(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
    });

    return () => unsubscribe();
  }, []);

  const currentUserProfile = useMemo(() => {
  return allUsers.find((user) => user.email === currentUserEmail);
}, [allUsers, currentUserEmail]);

const ratersWithSheets = useMemo(() => {
  return allUsers.filter((account) => {
    if (!account.sheetId || account.sheetId.length <= 5) return false;
    if (account.sheetId === 'MASTER_ADMIN') return false;

    const managers = Array.isArray(account.managers) ? account.managers : [];

    if (userRole === 'admin') return true;

    if (userRole === 'co-admin') {
      if (managers.includes(currentUserEmail)) return true;
      if (account.manager === currentUserEmail) return true;

      const matchClient =
        currentUserProfile?.clientName &&
        (account.clientName === currentUserProfile.clientName ||
          account.coAdminName === currentUserProfile.clientName);

      const matchCoAdmin =
        currentUserProfile?.coAdminName &&
        (account.clientName === currentUserProfile.coAdminName ||
          account.coAdminName === currentUserProfile.coAdminName);

      if (matchClient || matchCoAdmin) return true;
    }

    if (userRole === 'leader') {
      if (managers.includes(currentUserEmail)) return true;
      if (account.manager === currentUserEmail) return true;

      if (
        currentUserProfile?.leaderName &&
        account.leaderName === currentUserProfile.leaderName
      ) {
        return true;
      }
    }

    return false;
  });
}, [allUsers, currentUserEmail, userRole, currentUserProfile]);

  const loadFromDatabase = async () => {
    if (!currentUserEmail || ratersWithSheets.length === 0) {
      setRows([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const reportRows = await Promise.all(
      ratersWithSheets.map(async (rater) => {
        const monthHours = {};
        const monthSource = {};
        let newestSync = '';

        await Promise.all(
          quarterMonths.map(async (month) => {
            const docId = `${rater.email}_${month.key}`;
            const snap = await getDoc(doc(db, 'monthly_timesheets', docId));

            if (snap.exists()) {
              const data = snap.data();
              const hours = Number(data.decimalHours ?? calculateGridHours(data.gridData || [])) || 0;
              monthHours[month.key] = hours;
              monthSource[month.key] = data.excelMissing ? 'Missing Excel' : 'Saved DB';

              if (data.lastSynced && data.lastSynced > newestSync) {
                newestSync = data.lastSynced;
              }
            } else {
              monthHours[month.key] = 0;
              monthSource[month.key] = 'No DB Data';
            }
          })
        );

        const quarterTotal = quarterMonths.reduce((sum, month) => sum + (monthHours[month.key] || 0), 0);
        const level = getPerformanceLevel(quarterTotal);

        return {
          email: rater.email,
          clientName: rater.clientName || 'Unassigned',
          isDisabled: rater.isDisabled || false,
          sheetId: rater.sheetId,
          monthHours,
          monthSource,
          quarterTotal,
          shortage: Math.max(QUARTER_TARGET_HOURS - quarterTotal, 0),
          level,
          newestSync
        };
      })
    );

    reportRows.sort((a, b) => {
      if (a.isDisabled !== b.isDisabled) return a.isDisabled ? 1 : -1;
      return a.quarterTotal - b.quarterTotal;
    });

    setRows(reportRows);
    setIsLoading(false);
  };

  useEffect(() => {
    loadFromDatabase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ratersWithSheets.length, currentUserEmail, userRole]);

  const refreshFromExcel = async () => {
    if (ratersWithSheets.length === 0 || isRefreshing) return;

    const ok = window.confirm('Fetch live data from Excel and update the saved database report?');
    if (!ok) return;

    setIsRefreshing(true);

    for (const rater of ratersWithSheets) {
      if (rater.isDisabled) continue;

      for (const month of quarterMonths) {
        const docId = `${rater.email}_${month.key}`;
        const docRef = doc(db, 'monthly_timesheets', docId);

        try {
          const response = await fetch(
            `${API_BASE_URL}/api/get-hrs?accountName=${encodeURIComponent(rater.email)}&monthKey=${encodeURIComponent(month.key)}&sheetId=${encodeURIComponent(rater.sheetId)}`
          );

          const data = await response.json();

          if (!response.ok || !data.gridData) {
            await setDoc(docRef, {
              excelMissing: data.error === 'SHEET_MISSING',
              lastSyncError: data.error || 'API_ERROR',
              lastSynced: new Date().toISOString()
            }, { merge: true });
            continue;
          }

          const timeData = buildMonthlyTimeData(data.gridData);
          await setDoc(docRef, timeData, { merge: true });
        } catch (error) {
          await setDoc(docRef, {
            lastSyncError: error.message,
            lastSynced: new Date().toISOString()
          }, { merge: true });
        }
      }
    }

    setLastRefreshText(new Date().toLocaleString());
    setIsRefreshing(false);
    loadFromDatabase();
  };

  const clients = useMemo(() => {
    return ['all', ...Array.from(new Set(rows.map((row) => row.clientName))).sort()];
  }, [rows]);

  const filteredRows = rows.filter((row) => {
    const matchesClient = selectedClient === 'all' || row.clientName === selectedClient;
    const matchesStatus = selectedStatus === 'all' || row.level.key === selectedStatus || (selectedStatus === 'disabled' && row.isDisabled);
    const matchesSearch = row.email.toLowerCase().includes(searchText.toLowerCase());

    return matchesClient && matchesStatus && matchesSearch;
  });

  const safeCount = rows.filter((row) => row.level.key === 'safe' && !row.isDisabled).length;
  const warningCount = rows.filter((row) => row.level.key === 'warning' && !row.isDisabled).length;
  const dangerCount = rows.filter((row) => row.level.key === 'danger' && !row.isDisabled).length;
  const disabledCount = rows.filter((row) => row.isDisabled).length;

  const thStyle = {
    padding: '13px 12px',
    textAlign: 'left',
    backgroundColor: '#f1f3f4',
    borderBottom: '2px solid #dadce0',
    color: '#3c4043',
    fontWeight: 'bold',
    fontSize: '12px',
    textTransform: 'uppercase'
  };

  const tdStyle = {
    padding: '13px 12px',
    borderBottom: '1px solid #eceff1',
    color: '#202124',
    fontSize: '13px'
  };

  const filterStyle = {
    padding: '10px 12px',
    border: '1px solid #dadce0',
    borderRadius: '8px',
    backgroundColor: '#fff',
    fontSize: '13px',
    outline: 'none'
  };

  const summaryCard = (title, value, bg, color) => (
    <div style={{
      backgroundColor: bg,
      color,
      padding: '16px 18px',
      borderRadius: '8px',
      border: `1px solid ${color}33`,
      minWidth: '150px'
    }}>
      <div style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '6px' }}>{title}</div>
      <div style={{ fontSize: '26px', fontWeight: 'bold' }}>{value}</div>
    </div>
  );

  return (
    <div style={{ padding: '32px', maxWidth: '1500px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start', marginBottom: '22px' }}>
        <div>
          <h2 style={{ margin: 0, color: '#1a73e8', fontSize: '26px' }}>
            Quarter Rater Performance
          </h2>
          <div style={{ color: '#5f6368', fontSize: '14px', marginTop: '6px' }}>
            Showing saved database data for {quarterMonths.map((month) => month.label).join(' - ')}
          </div>
          {lastRefreshText && (
            <div style={{ color: '#137333', fontSize: '12px', marginTop: '5px', fontWeight: 'bold' }}>
              Last live refresh: {lastRefreshText}
            </div>
          )}
        </div>

        <button
          onClick={refreshFromExcel}
          disabled={isRefreshing}
          style={{
            padding: '11px 18px',
            border: 'none',
            borderRadius: '8px',
            cursor: isRefreshing ? 'not-allowed' : 'pointer',
            backgroundColor: isRefreshing ? '#c9d7f8' : '#1a73e8',
            color: '#fff',
            fontWeight: 'bold'
          }}
        >
          {isRefreshing ? 'Refreshing From Excel...' : 'Refresh From Excel'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: '20px' }}>
       {summaryCard('Total Accounts', rows.length, '#ffffff', '#202124')}
        {summaryCard('Safe', safeCount, '#e6f4ea', '#137333')}
        {summaryCard('Warning', warningCount, '#fff4e5', '#b06000')}
        {summaryCard('Danger', dangerCount, '#fce8e6', '#c5221f')}
        {summaryCard('Disabled', disabledCount, '#f1f3f4', '#5f6368')}
      </div>

      <div style={{
        backgroundColor: '#fff',
        padding: '16px',
        borderRadius: '8px',
        border: '1px solid #e0e0e0',
        marginBottom: '18px',
        display: 'flex',
        gap: '12px',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        <input
          type="text"
          placeholder="Search rater email..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ ...filterStyle, minWidth: '240px' }}
        />

        <select value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)} style={filterStyle}>
          {clients.map((client) => (
            <option key={client} value={client}>{client === 'all' ? 'All Clients' : client}</option>
          ))}
        </select>

        <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} style={filterStyle}>
          <option value="all">All Status</option>
          <option value="safe">Safe Accounts</option>
          <option value="warning">Warning Accounts</option>
          <option value="danger">Danger Accounts</option>
          <option value="disabled">Disabled Accounts</option>
        </select>

        <div style={{ color: '#5f6368', fontSize: '13px', marginLeft: 'auto' }}>
          Showing <strong>{filteredRows.length}</strong> of <strong>{rows.length}</strong>
        </div>
      </div>

      <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(60,64,67,0.12)' }}>
        {isLoading ? (
          <div style={{ padding: '36px', textAlign: 'center', color: '#5f6368', fontWeight: 'bold' }}>
            Loading saved database report...
          </div>
        ) : filteredRows.length === 0 ? (
          <div style={{ padding: '36px', textAlign: 'center', color: '#888' }}>
            No matching rater accounts found.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Account</th>
                  <th style={thStyle}>Client</th>
                  {quarterMonths.map((month) => <th key={month.key} style={thStyle}>{month.label}</th>)}
                  <th style={thStyle}>Progress</th>
                  <th style={thStyle}>Quarter Total</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Shortage</th>
                </tr>
              </thead>

              <tbody>
                {filteredRows.map((row) => {
                  const progress = Math.min((row.quarterTotal / QUARTER_TARGET_HOURS) * 100, 100);
                  const rowOpacity = row.isDisabled ? 0.48 : 1;
                  const rowDecoration = row.isDisabled ? 'line-through' : 'none';

                  return (
                    <tr key={row.email} style={{ backgroundColor: row.isDisabled ? '#f1f3f4' : row.level.rowBg, opacity: rowOpacity }}>
                      <td style={{ ...tdStyle, borderLeft: `5px solid ${row.isDisabled ? '#9aa0a6' : row.level.border}` }}>
                        <strong style={{ textDecoration: rowDecoration }}>{row.email}</strong>
                        {row.isDisabled && (
                          <div style={{ color: '#5f6368', fontSize: '11px', marginTop: '4px', fontWeight: 'bold', textDecoration: 'none' }}>
                            DISABLED ACCOUNT
                          </div>
                        )}
                      </td>

                      <td style={tdStyle}>
                        <span style={{
                          backgroundColor: row.isDisabled ? '#e0e0e0' : '#eef3fe',
                          color: row.isDisabled ? '#5f6368' : '#1967d2',
                          padding: '5px 9px',
                          borderRadius: '999px',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          textDecoration: rowDecoration
                        }}>
                          {row.clientName}
                        </span>
                      </td>

                      {quarterMonths.map((month) => (
                        <td key={month.key} style={{ ...tdStyle, textDecoration: rowDecoration }}>
                          {formatHours(row.monthHours[month.key])}
                          <div style={{ fontSize: '10px', color: '#888', marginTop: '3px', textDecoration: 'none' }}>
                            {row.monthSource[month.key]}
                          </div>
                        </td>
                      ))}

                      <td style={{ ...tdStyle, minWidth: '180px' }}>
                        <div style={{ height: '9px', backgroundColor: '#edf0f2', borderRadius: '999px', overflow: 'hidden' }}>
                          <div style={{
                            width: `${progress}%`,
                            height: '100%',
                            backgroundColor: row.isDisabled ? '#9aa0a6' : row.level.color,
                            borderRadius: '999px'
                          }} />
                        </div>
                        <div style={{ fontSize: '11px', color: '#5f6368', marginTop: '5px' }}>
                          {Math.round(progress)}% of 20h
                        </div>
                      </td>

                      <td style={{ ...tdStyle, fontWeight: 'bold', color: row.isDisabled ? '#5f6368' : row.level.color, textDecoration: rowDecoration }}>
                        {formatHours(row.quarterTotal)}
                      </td>

                      <td style={tdStyle}>
                        <span style={{
                          padding: '5px 10px',
                          borderRadius: '999px',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          backgroundColor: row.isDisabled ? '#e0e0e0' : row.level.bg,
                          color: row.isDisabled ? '#5f6368' : row.level.color
                        }}>
                          {row.isDisabled ? 'DISABLED' : row.level.label}
                        </span>
                      </td>

                      <td style={{ ...tdStyle, textDecoration: rowDecoration }}>
                        {row.shortage > 0 ? (
                          <strong style={{ color: row.isDisabled ? '#5f6368' : row.level.color }}>{formatHours(row.shortage)}</strong>
                        ) : (
                          <span style={{ color: '#137333', fontWeight: 'bold' }}>Covered</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
