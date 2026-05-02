import React from 'react';

const HOURLY_PAY_RATE = 160; 
const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']; 

const getWeekColor = (mints, scnds) => {
  const hrs = mints / 60 + scnds / 3600;
  if (hrs === 0) return "#d32f2f"; 
  if (hrs > 20) return "#1976d2";  
  return "#333";                   
};

const getMonthColor = (decimalHours) => {
  if (decimalHours < 5) return "#d32f2f";  
  if (decimalHours > 40) return "#2e7d32"; 
  if (decimalHours > 20) return "#1976d2"; 
  return "#333";                           
};

export default function Dashboard({ 
  gridData, isLoading, accountName, spreadsheetId,
  isDisabled = false, 
  excelMissing = false 
}) {
  if (isLoading || !gridData || gridData.length === 0) return null;

  const formatTime = (mints, scnds) => {
    let totalMints = Number(mints) || 0;
    let totalScnds = Number(scnds) || 0;
    totalMints += Math.floor(totalScnds / 60);
    const finalScnds = totalScnds % 60;
    const hours = Math.floor(totalMints / 60);
    const minutes = totalMints % 60;
    return `${hours} h ${minutes} m ${finalScnds} s`;
  };

  const calculateDecimalHours = (mints, scnds) => {
    const totalMints = (Number(mints) || 0) + ((Number(scnds) || 0) / 60);
    return totalMints / 60;
  };

  const [firstDay, firstMonth, firstYear] = gridData[0].date.split('/');
  const firstDayOfWeek = new Date(firstYear, firstMonth - 1, 1).getDay(); 
  const lastDayOfMonth = new Date(firstYear, firstMonth, 0).getDate();
  const totalWeeksNeeded = Math.ceil((firstDayOfWeek + lastDayOfMonth) / 7);

  const calendarDays = Array(totalWeeksNeeded * 7).fill(null);
  gridData.forEach((dayData) => {
    const [dayStr] = dayData.date.split('/');
    calendarDays[firstDayOfWeek + parseInt(dayStr) - 1] = dayData; 
  });

  let weeks = [];
  for (let i = 0; i < totalWeeksNeeded; i++) {
    weeks.push(calendarDays.slice(i * 7, i * 7 + 7));
  }

  // SMART WEEK FILTERING: Only keep weeks that have at least one valid date in them
  weeks = weeks.filter(week => week.some(day => day !== null));

  let monthSumMints = 0;
  let monthSumScnds = 0;
  gridData.forEach(day => {
    monthSumMints += day.totalMints || 0;
    monthSumScnds += day.totalScnds || 0;
  });
  
  const monthlyTotalStr = formatTime(monthSumMints, monthSumScnds);
  const monthlyDecimalHrs = calculateDecimalHours(monthSumMints, monthSumScnds);
  const totalPayment = (monthlyDecimalHrs * HOURLY_PAY_RATE).toFixed(2);

  const getWeekRawTime = (week) => {
    let wMints = 0; let wScnds = 0;
    week.forEach(day => {
      if (day) {
        wMints += day.totalMints || 0;
        wScnds += day.totalScnds || 0;
      }
    });
    return { mints: wMints, scnds: wScnds };
  };

  const getWeekTotal = (week) => {
    const { mints, scnds } = getWeekRawTime(week);
    return formatTime(mints, scnds);
  };

  const tableStyle = { width: '100%', borderCollapse: 'collapse', textAlign: 'center', whiteSpace: 'nowrap', margin: '0', fontFamily: 'Arial, sans-serif' };
  const cellStyle = { border: '1px solid #e0e0e0', padding: '10px 8px' }; 
  const valueStyle = { fontSize: '15px', color: '#1a73e8', fontWeight: 'bold' };

  return (
    <div style={{ backgroundColor: '#fff', padding: '30px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
      
      {/* 1. Header & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ margin: 0, color: '#333', fontSize: '22px' }}>Dashboard Overview</h3>
        {spreadsheetId && (
          <button onClick={() => window.open(`https://docs.google.com/spreadsheets/d/${spreadsheetId}`, '_blank')} style={{ padding: '10px 20px', cursor: 'pointer', border: 'none', borderRadius: '6px', backgroundColor: '#1a73e8', color: 'white', fontWeight: 'bold', fontSize: '14px', boxShadow: '0 2px 4px rgba(26,115,232,0.3)', transition: 'background-color 0.2s' }}>
            📊 Open Google Sheet
          </button>
        )}
      </div>

      {/* 2. Warning Banners */}
      {isDisabled && (
        <div style={{ padding: '15px', backgroundColor: '#fdecea', color: '#d32f2f', borderRadius: '8px', marginBottom: '20px', fontSize: '15px', textAlign: 'center', fontWeight: 'bold', border: '1px solid #ef9a9a' }}>
          🚫 ACCOUNT DISABLED - Data syncing is locked. You are viewing cached data.
        </div>
      )}
      {!isDisabled && excelMissing && (
        <div style={{ padding: '15px', backgroundColor: '#ffebee', color: '#c62828', borderRadius: '8px', marginBottom: '20px', fontSize: '15px', textAlign: 'center', fontWeight: 'bold', border: '1px solid #ef9a9a' }}>
          🚨 FILE MISSING OR DELETED - Data syncing is paused. You are viewing cached data.
        </div>
      )}

      {/* 3. TOP SUMMARY CARDS */}
      <div style={{ display: 'flex', gap: '20px', marginBottom: '40px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 250px', padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '10px', border: '1px solid #e0e0e0', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: '13px', color: '#666', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '8px' }}>Active Account</div>
          <div style={{ fontSize: '18px', color: '#333', fontWeight: 'bold', wordBreak: 'break-all' }}>{accountName}</div>
        </div>
        <div style={{ flex: '1 1 250px', padding: '20px', backgroundColor: '#fff9c4', borderRadius: '10px', border: '1px solid #ffe082', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: '13px', color: '#f57f17', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '8px' }}>Total Monthly Hours</div>
          <div style={{ fontSize: '24px', color: getMonthColor(monthlyDecimalHrs), fontWeight: 'bold' }}>{monthlyTotalStr}</div>
        </div>
        <div style={{ flex: '1 1 250px', padding: '20px', backgroundColor: '#f3e5f5', borderRadius: '10px', border: '1px solid #e1bee7', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: '13px', color: '#7b1fa2', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '8px' }}>Estimated Payment</div>
          <div style={{ fontSize: '24px', color: '#4a148c', fontWeight: 'bold' }}>₹{totalPayment}</div>
        </div>
      </div>

      {/* 4. Weekly Tables */}
      <div style={{ overflowX: 'auto', opacity: isDisabled || excelMissing ? 0.8 : 1 }}>
        <h4 style={{ margin: '0 0 15px 0', color: '#555', borderBottom: '2px solid #eee', paddingBottom: '10px', fontSize: '16px' }}>Weekly Breakdown</h4>
        
        {weeks.map((week, wIndex) => {
          const rawWeekTime = getWeekRawTime(week);
          const dynamicWeekColor = getWeekColor(rawWeekTime.mints, rawWeekTime.scnds);
          
          return (
            <div key={`week-${wIndex}`} style={{ marginBottom: '35px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e0e0e0', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
              <table style={tableStyle}>
                
                <thead>
                  <tr>
                    {week.map((day, dIndex) => {
                      // 💡 ALTERNATING LOGIC: Even columns are slightly darker to create a column effect
                      const headBg = dIndex % 2 === 0 ? '#f8f9fa' : '#f1f3f5';
                      return (
                        <th key={`date-${wIndex}-${dIndex}`} colSpan="2" style={{ ...cellStyle, backgroundColor: headBg, minWidth: '90px', padding: '12px 4px', borderBottom: '2px solid #e0e0e0' }}>
                          <div style={{ fontSize: '12px', textTransform: 'uppercase', color: day ? '#555' : '#aaa', letterSpacing: '1px', marginBottom: '4px' }}>{dayNames[dIndex]}</div>
                          <div style={{ fontSize: '15px', color: '#333' }}>{day ? day.date : '-'}</div>
                        </th>
                      );
                    })}
                    <th rowSpan="2" style={{ ...cellStyle, backgroundColor: '#e8f5e9', fontSize: '15px', fontWeight: 'bold', borderLeft: '2px solid #e0e0e0', color: '#2e7d32' }}>
                      Week {wIndex + 1} Total
                    </th>
                  </tr>
                  <tr>
                    {week.map((day, dIndex) => {
                      // 💡 ALTERNATING LOGIC for the subheaders
                      const subHeadBg = dIndex % 2 === 0 ? '#ffffff' : '#f8f9fa';
                      return (
                        <React.Fragment key={`subhead-${wIndex}-${dIndex}`}>
                          <th style={{ ...cellStyle, backgroundColor: subHeadBg, fontSize: '12px', fontWeight: 'bold', color: '#888', borderTop: 'none' }}>MINS</th>
                          <th style={{ ...cellStyle, backgroundColor: subHeadBg, fontSize: '12px', fontWeight: 'bold', color: '#888', borderTop: 'none' }}>SECS</th>
                        </React.Fragment>
                      );
                    })}
                  </tr>
                </thead>
                
                <tbody>
                  <tr>
                    {week.map((day, dIndex) => {
                      // 💡 ALTERNATING LOGIC for the actual data cells
                      const activeCellBg = dIndex % 2 === 0 ? '#ffffff' : '#f8f9fa';
                      const emptyCellBg = dIndex % 2 === 0 ? '#fcfcfc' : '#f1f3f5';
                      const cellBgColor = day ? activeCellBg : emptyCellBg;
                      
                      return (
                        <React.Fragment key={`input-${wIndex}-${dIndex}`}>
                          <td style={{ ...cellStyle, padding: '15px 0', backgroundColor: cellBgColor }}>
                            {day && <div style={valueStyle}>{day.totalMints > 0 ? day.totalMints : ''}</div>}
                          </td>
                          <td style={{ ...cellStyle, padding: '15px 0', backgroundColor: cellBgColor }}>
                            {day && <div style={valueStyle}>{day.totalScnds > 0 ? day.totalScnds : ''}</div>}
                          </td>
                        </React.Fragment>
                      );
                    })}
                    {/* Weekly Total Box */}
                    <td style={{ ...cellStyle, backgroundColor: '#f1f8e9', fontWeight: 'bold', fontSize: '15px', color: dynamicWeekColor, borderLeft: '2px solid #e0e0e0' }}>
                      {getWeekTotal(week)}
                    </td>
                  </tr>
                </tbody>

              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
}