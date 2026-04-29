import React from 'react';

const HOURLY_PAY_RATE = 160; 
const weekColors = ['#fff3e0', '#e8f5e9', '#e3f2fd', '#f3e5f5', '#e0f7fa', '#fff9c4'];
const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']; 

export default function Dashboard({ gridData, isLoading, accountName, spreadsheetId }) {
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

  const weeks = [];
  for (let i = 0; i < totalWeeksNeeded; i++) {
    weeks.push(calendarDays.slice(i * 7, i * 7 + 7));
  }

  let monthSumMints = 0;
  let monthSumScnds = 0;
  gridData.forEach(day => {
    monthSumMints += day.totalMints || 0;
    monthSumScnds += day.totalScnds || 0;
  });
  
  const monthlyTotalStr = formatTime(monthSumMints, monthSumScnds);
  const totalPayment = (calculateDecimalHours(monthSumMints, monthSumScnds) * HOURLY_PAY_RATE).toFixed(2);

  const getWeekTotal = (week) => {
    let wMints = 0; let wScnds = 0;
    week.forEach(day => {
      if (day) {
        wMints += day.totalMints || 0;
        wScnds += day.totalScnds || 0;
      }
    });
    return formatTime(wMints, wScnds);
  };

  const tableStyle = { width: '100%', borderCollapse: 'collapse', textAlign: 'center', whiteSpace: 'nowrap', margin: '0', fontFamily: 'Arial, sans-serif' };
  const cellStyle = { border: '1px solid #b3e5fc', padding: '8px' };
  const valueStyle = { padding: '10px 2px', fontSize: '15px', color: '#1a73e8', fontWeight: 'bold' };

  return (
    <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #eee' }}>
        <h3 style={{ margin: 0, color: '#333', fontSize: '20px' }}>Excel Report View</h3>
        
        {spreadsheetId && (
          <button onClick={() => window.open(`https://docs.google.com/spreadsheets/d/${spreadsheetId}`, '_blank')} style={{ padding: '8px 20px', cursor: 'pointer', border: 'none', borderRadius: '4px', backgroundColor: '#34a853', color: 'white', fontWeight: 'bold', fontSize: '15px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            📊 Open Google Sheet
          </button>
        )}
      </div>

      <div style={{ overflowX: 'auto' }}>
        
        {weeks.map((week, wIndex) => {
          const activeColor = weekColors[wIndex % weekColors.length];
          
          return (
            <div key={`week-${wIndex}`} style={{ marginBottom: '40px' }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={{ ...cellStyle, border: 'none', minWidth: '120px' }}></th>
                    {week.map((day, dIndex) => (
                      <th key={`date-${wIndex}-${dIndex}`} colSpan="2" style={{ ...cellStyle, backgroundColor: activeColor, minWidth: '80px', padding: '10px 4px' }}>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', color: day ? '#555' : '#aaa', letterSpacing: '1px', marginBottom: '4px' }}>{dayNames[dIndex]}</div>
                        <div style={{ fontSize: '14px', color: '#333' }}>{day ? day.date : '-'}</div>
                      </th>
                    ))}
                    <th rowSpan="2" style={{ ...cellStyle, backgroundColor: '#c8e6c9', fontSize: '14px', fontWeight: 'bold' }}>Week {wIndex + 1} Hrs</th>
                  </tr>
                  <tr>
                    {/* 💡 THE FIX: Only show Account Name header on Week 1. Hide the box completely on other weeks. */}
                    <th style={{ 
                      ...cellStyle, 
                      backgroundColor: wIndex === 0 ? '#ffca28' : 'transparent', 
                      padding: '12px', 
                      fontSize: '14px',
                      border: wIndex === 0 ? '1px solid #b3e5fc' : 'none' 
                    }}>
                      {wIndex === 0 ? 'Account Name' : ''}
                    </th>
                    {week.map((day, dIndex) => (
                      <React.Fragment key={`subhead-${wIndex}-${dIndex}`}>
                        <th style={{ ...cellStyle, backgroundColor: '#fff', fontSize: '13px', fontWeight: 'bold', color: '#666' }}>mints</th>
                        <th style={{ ...cellStyle, backgroundColor: '#fff', fontSize: '13px', fontWeight: 'bold', color: '#666' }}>Scnds</th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                
                <tbody>
                  <tr>
                    {/* 💡 THE FIX: Only show the email address on Week 1. Hide the box completely on other weeks. */}
                    <td style={{ 
                      ...cellStyle, 
                      fontSize: '14px', 
                      fontWeight: 'bold', 
                      color: '#333',
                      border: wIndex === 0 ? '1px solid #b3e5fc' : 'none'
                    }}>
                      {wIndex === 0 ? accountName : ''}
                    </td>
                    {week.map((day, dIndex) => (
                      <React.Fragment key={`input-${wIndex}-${dIndex}`}>
                        <td style={{ ...cellStyle, padding: 0, backgroundColor: day ? '#fff' : '#f5f5f5' }}>
                          {day && <div style={valueStyle}>{day.totalMints || ''}</div>}
                        </td>
                        <td style={{ ...cellStyle, padding: 0, backgroundColor: day ? '#fff' : '#f5f5f5' }}>
                          {day && <div style={valueStyle}>{day.totalScnds || ''}</div>}
                        </td>
                      </React.Fragment>
                    ))}
                    <td style={{ ...cellStyle, backgroundColor: '#ffe0b2', fontWeight: 'bold', fontSize: '14px', color: '#d84315' }}>
                      {getWeekTotal(week)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          );
        })}

        <div style={{ marginTop: '10px', padding: '20px', backgroundColor: '#fafafa', borderRadius: '8px', border: '2px solid #eee', display: 'inline-block' }}>
          <h4 style={{ margin: '0 0 15px 0', color: '#555', borderBottom: '1px solid #ddd', paddingBottom: '10px' }}>Monthly Totals</h4>
          <table style={{ borderCollapse: 'collapse', textAlign: 'left' }}>
            <tbody>
              <tr>
                <td style={{ padding: '8px 20px 8px 0', color: '#4caf50', fontStyle: 'italic', fontSize: '15px' }}>this month payment</td>
                <td style={{ padding: '8px 0', color: '#9c27b0', fontSize: '20px', fontWeight: 'bold' }}>₹{totalPayment}</td>
              </tr>
              <tr>
                <td style={{ padding: '8px 20px 8px 0', color: '#9c27b0', fontStyle: 'italic', fontSize: '15px' }}>monthly hrs</td>
                <td style={{ padding: '8px 0', color: '#d32f2f', fontStyle: 'italic', fontSize: '18px', fontWeight: 'bold' }}>{monthlyTotalStr}</td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}