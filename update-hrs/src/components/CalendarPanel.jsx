import React, { useState, useEffect } from 'react';

const monthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function CalendarPanel({ 
  accountName, sheetId, currentDate, changeMonth, gridData, fetchData, isLoading, setStatus,
  isDisabled = false, 
  excelMissing = false 
}) {
  const [selectedDayObj, setSelectedDayObj] = useState(null);
  const [inputMints, setInputMints] = useState('');
  const [inputScnds, setInputScnds] = useState('');
  const [editingRowIndex, setEditingRowIndex] = useState(null);

  const isLocked = isDisabled || excelMissing;

  useEffect(() => {
    setSelectedDayObj(null);
    setEditingRowIndex(null);
  }, [accountName, currentDate]);

  const getMonthKey = (dateObj) => `${monthNames[dateObj.getMonth()]} ${dateObj.getFullYear()}`;

  // 💡 NEW: Formats "2/4/2026" into "2 April 2026"
  const formatHeaderDate = (dateStr) => {
    const [d, m, y] = dateStr.split('/');
    const monthIndex = parseInt(m, 10) - 1;
    const monthName = monthNames[monthIndex];
    const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
    return `${d} ${capitalizedMonth} ${y}`;
  };

  const formatEntryTime = (mints, scnds) => {
    let totalMints = Number(mints) || 0;
    let totalScnds = Number(scnds) || 0;
    totalMints += Math.floor(totalScnds / 60);
    const finalScnds = totalScnds % 60;
    const hours = Math.floor(totalMints / 60);
    const minutes = totalMints % 60;
    if (hours > 0) return `${hours}h ${minutes}m ${finalScnds}s`;
    return `${minutes}m ${finalScnds}s`;
  };

  const formatCompactTime = (mints, scnds) => {
    let totalMints = Number(mints) || 0;
    let totalScnds = Number(scnds) || 0;
    totalMints += Math.floor(totalScnds / 60);
    const finalScnds = totalScnds % 60;
    const hours = Math.floor(totalMints / 60);
    const minutes = totalMints % 60;
    
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${finalScnds > 0 ? finalScnds+'s' : ''}`.trim();
    return `${finalScnds}s`;
  };

  // 💡 NEW: Strict date tracking for Future Blocks and Today Highlights
  const realToday = new Date();
  const todayAtMidnight = new Date(realToday.getFullYear(), realToday.getMonth(), realToday.getDate());

  const isCurrentOrFutureMonth = currentDate.getFullYear() > realToday.getFullYear() || 
                                 (currentDate.getFullYear() === realToday.getFullYear() && currentDate.getMonth() >= realToday.getMonth());

  const handleSubmitTime = async (e) => {
    e.preventDefault();
    if (!selectedDayObj || isLocked) return; 

    if (inputMints === '' && inputScnds === '') {
      setStatus({ type: 'error', message: 'Please enter minutes or seconds.' });
      return;
    }

    const isEdit = editingRowIndex !== null;
    const url = isEdit ? `${API_BASE_URL}/api/modify-hr` : `${API_BASE_URL}/api/update-hrs`;
    
    setStatus({ type: 'info', message: isEdit ? 'Updating entry...' : 'Adding entry...' });

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountName, 
          sheetId, 
          monthKey: getMonthKey(currentDate), 
          date: selectedDayObj.date,
          mints: inputMints === '' ? '0' : inputMints, 
          scnds: inputScnds === '' ? '0' : inputScnds,
          action: isEdit ? 'edit' : undefined, 
          rowIndex: isEdit ? editingRowIndex : undefined
        }),
      });
      
      const responseData = await response.json(); 

      if (response.ok) {
        setStatus({ type: 'success', message: isEdit ? 'Updated Successfully!' : 'Added Successfully!' });
        setInputMints(''); setInputScnds(''); setEditingRowIndex(null);
        await fetchData(); 
        setTimeout(() => setStatus({type: '', message: ''}), 2000); 
      } else {
        setStatus({ type: 'error', message: responseData.error || 'Failed to save data.' });
      }
    } catch (error) {
      setStatus({ type: 'error', message: `Network error: Failed to save data.` });
    }
  };

  const handleDelete = async (rowIndex) => {
    if (isLocked) return; 
    if(!window.confirm("Are you sure you want to delete this entry?")) return;
    
    setStatus({ type: 'info', message: 'Deleting entry...' });
    try {
      const response = await fetch(`${API_BASE_URL}/api/modify-hr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountName, 
          sheetId, 
          monthKey: getMonthKey(currentDate), 
          date: selectedDayObj.date, 
          action: 'delete', 
          rowIndex
        }),
      });
      
      const responseData = await response.json();

      if (response.ok) {
        setStatus({ type: 'success', message: 'Deleted Successfully!' });
        await fetchData(); 
        setTimeout(() => setStatus({type: '', message: ''}), 2000); 
      } else {
        setStatus({ type: 'error', message: responseData.error || 'Failed to delete data.' });
      }
    } catch (error) {
      setStatus({ type: 'error', message: `Network error: Failed to delete data.` });
    }
  };

  const startEditing = (entry) => {
    if (isLocked) return; 
    setEditingRowIndex(entry.row);
    setInputMints(entry.mints === 0 ? '' : entry.mints);
    setInputScnds(entry.scnds === 0 ? '' : entry.scnds);
  };

  const firstDayOfWeek = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const blanks = Array(firstDayOfWeek).fill(null);
  const days = Array.from({length: lastDayOfMonth}, (_, i) => i + 1);
  const activeDayData = selectedDayObj ? gridData.find(d => d.date === selectedDayObj.date) : null;
  const hasReachedLimit = activeDayData ? activeDayData.entries.length >= 20 : false;

  return (
    <div style={{ width: '450px', backgroundColor: '#fff', borderRight: '1px solid #ddd', padding: '25px', overflowY: 'auto', boxSizing: 'border-box' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <button onClick={() => changeMonth(-1)} style={{ cursor: 'pointer', border: '1px solid #dcdcdc', background: '#fff', padding: '8px 14px', borderRadius: '6px', fontWeight: 'bold', color: '#555', transition: '0.2s' }}>&larr; Prev</button>
        <h3 style={{ margin: 0, textTransform: 'uppercase', fontSize: '16px', color: '#333', letterSpacing: '1px' }}>{getMonthKey(currentDate)}</h3>
        <button onClick={() => changeMonth(1)} disabled={isCurrentOrFutureMonth} style={{ cursor: isCurrentOrFutureMonth ? 'not-allowed' : 'pointer', border: '1px solid #dcdcdc', background: isCurrentOrFutureMonth ? '#f5f5f5' : '#fff', padding: '8px 14px', borderRadius: '6px', fontWeight: 'bold', color: isCurrentOrFutureMonth ? '#aaa' : '#555', transition: '0.2s' }}>Next &rarr;</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', textAlign: 'center', marginBottom: '30px' }}>
        {dayLabels.map(day => <div key={day} style={{ fontSize: '11px', fontWeight: 'bold', color: '#888', textTransform: 'uppercase', paddingBottom: '5px' }}>{day}</div>)}
        {blanks.map((_, i) => <div key={`blank-${i}`} />)}
        
        {days.map(day => {
          const dateStr = `${day}/${currentDate.getMonth() + 1}/${currentDate.getFullYear()}`;
          const isSelected = selectedDayObj && selectedDayObj.date === dateStr;
          
          const dayData = gridData.find(d => d.date === dateStr);
          const hasEntries = dayData && dayData.entries && dayData.entries.length > 0;

          // 💡 NEW: Check if this cell is Today or in the Future
          const thisCellDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
          const isFuture = thisCellDate > todayAtMidnight;
          const isToday = thisCellDate.getTime() === todayAtMidnight.getTime();

          // Dynamic background logic
          let bgCol = '#fff';
          if (isFuture) bgCol = '#f9f9f9'; // Grey out future
          else if (isSelected) bgCol = '#1a73e8';
          else if (hasEntries) bgCol = '#e8f5e9';
          else if (isToday) bgCol = '#e3f2fd'; // Light blue for today

          // Dynamic border logic
          let borderCol = '#eee';
          if (isSelected) borderCol = '#1a73e8';
          else if (isToday) borderCol = '#2196f3'; // Stronger border for today
          else if (hasEntries) borderCol = '#c8e6c9';

          return (
            <button 
              key={day} 
              disabled={isFuture} // 💡 NEW: Completely block clicking future dates
              onClick={() => { setSelectedDayObj({ date: dateStr }); setEditingRowIndex(null); setInputMints(''); setInputScnds(''); }} 
              style={{ 
                minHeight: '60px', 
                border: `1px solid ${borderCol}`, 
                borderRadius: '8px', 
                cursor: isFuture ? 'not-allowed' : 'pointer', 
                backgroundColor: bgCol, 
                color: isFuture ? '#ccc' : (isSelected ? '#fff' : '#333'), 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'flex-start',
                paddingTop: '8px',
                boxShadow: isSelected ? '0 4px 8px rgba(26,115,232,0.3)' : 'none',
                transition: 'all 0.1s ease-in-out',
                opacity: isFuture ? 0.6 : 1
              }}
            >
              {/* 💡 NEW: Tiny TODAY indicator */}
              {isToday && !isSelected && <div style={{ fontSize: '8px', color: '#1a73e8', fontWeight: 'bold', marginTop: '-4px', marginBottom: '2px' }}>TODAY</div>}
              {isToday && isSelected && <div style={{ fontSize: '8px', color: '#fff', opacity: 0.8, fontWeight: 'bold', marginTop: '-4px', marginBottom: '2px' }}>TODAY</div>}

              <div style={{ fontSize: '15px', fontWeight: isSelected || hasEntries || isToday ? 'bold' : 'normal' }}>{day}</div>
              
              {hasEntries && !isFuture && (
                <div style={{ 
                  marginTop: '4px', 
                  fontSize: '10px', 
                  fontWeight: 'bold', 
                  color: isSelected ? '#e3f2fd' : '#2e7d32',
                  backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : 'transparent',
                  padding: '2px 4px',
                  borderRadius: '4px'
                }}>
                  {formatCompactTime(dayData.totalMints, dayData.totalScnds)}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {selectedDayObj ? (
        <div style={{ backgroundColor: '#f8f9fa', padding: '20px', borderRadius: '12px', border: '1px solid #e0e0e0', opacity: isLocked ? 0.8 : 1 }}>
          
          {/* 💡 NEW: Human Readable Date Format in Header */}
          <h4 style={{ margin: '0 0 20px 0', color: '#1a73e8', fontSize: '16px', borderBottom: '1px solid #ddd', paddingBottom: '10px' }}>
            {editingRowIndex ? `Editing: ${formatHeaderDate(selectedDayObj.date)}` : `Log Time: ${formatHeaderDate(selectedDayObj.date)}`}
          </h4>
          
          {isDisabled && (
            <div style={{ padding: '12px', backgroundColor: '#fdecea', color: '#d32f2f', borderRadius: '6px', marginBottom: '20px', fontSize: '13px', textAlign: 'center', fontWeight: 'bold', border: '1px solid #ef9a9a' }}>
              🚫 ACCOUNT DISABLED - Cannot Log Time
            </div>
          )}
          {!isDisabled && excelMissing && (
            <div style={{ padding: '12px', backgroundColor: '#ffebee', color: '#c62828', borderRadius: '6px', marginBottom: '20px', fontSize: '13px', textAlign: 'center', fontWeight: 'bold', border: '1px solid #ef9a9a' }}>
              🚨 FILE MISSING OR DELETED - Contact your manager.
            </div>
          )}

          {hasReachedLimit && !editingRowIndex && !isLocked ? (
             <div style={{ padding: '12px', backgroundColor: '#fdecea', color: '#d32f2f', borderRadius: '6px', marginBottom: '20px', fontSize: '13px', textAlign: 'center', fontWeight: 'bold' }}>Maximum 20 entries reached for this day!</div>
          ) : (
            
            <form onSubmit={handleSubmitTime} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '25px', width: '100%', boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', gap: '15px', width: '100%', boxSizing: 'border-box' }}>
                
                {/* 💡 NEW: flex: 1 and minWidth: 0 prevents input overflow */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '12px', color: '#666', fontWeight: 'bold', marginBottom: '6px' }}>Minutes</label>
                  <input 
                    type="number" 
                    placeholder="0" 
                    disabled={isLocked || isLoading} 
                    value={inputMints} 
                    onChange={e => setInputMints(e.target.value)} 
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px', border: '1px solid #ccc', borderRadius: '6px', backgroundColor: isLocked ? '#eee' : '#fff', fontSize: '14px' }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '12px', color: '#666', fontWeight: 'bold', marginBottom: '6px' }}>Seconds</label>
                  <input 
                    type="number" 
                    placeholder="0" 
                    disabled={isLocked || isLoading} 
                    value={inputScnds} 
                    onChange={e => setInputScnds(e.target.value)} 
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px', border: '1px solid #ccc', borderRadius: '6px', backgroundColor: isLocked ? '#eee' : '#fff', fontSize: '14px' }}
                  />
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '10px', width: '100%', boxSizing: 'border-box' }}>
                <button type="submit" disabled={isLocked || isLoading} style={{ flex: 1, padding: '12px', backgroundColor: isLocked ? '#aaa' : (editingRowIndex ? '#fbbc04' : '#34a853'), color: editingRowIndex ? '#000' : 'white', fontWeight: 'bold', fontSize: '15px', border: 'none', borderRadius: '6px', cursor: isLocked || isLoading ? 'not-allowed' : 'pointer', transition: '0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', boxSizing: 'border-box' }}>
                  {editingRowIndex ? 'Save Changes' : 'Submit Time'}
                </button>
                {editingRowIndex && (
                  <button type="button" onClick={() => {setEditingRowIndex(null); setInputMints(''); setInputScnds('');}} style={{ flex: '0 0 100px', padding: '12px', backgroundColor: '#e0e0e0', color: '#333', fontWeight: 'bold', border: 'none', borderRadius: '6px', cursor: 'pointer', boxSizing: 'border-box' }}>Cancel</button>
                )}
              </div>
            </form>
          )}

          <h5 style={{ margin: '0 0 12px 0', color: '#555', fontSize: '14px' }}>Recorded Entries:</h5>
          {activeDayData && activeDayData.entries.length > 0 ? (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {activeDayData.entries.map((entry, i) => (
                <li key={i} style={{ backgroundColor: '#fff', padding: '12px', marginBottom: '8px', borderRadius: '6px', border: '1px solid #e0e0e0', fontSize: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                  <div>
                     <span style={{ color: '#aaa', marginRight: '12px', fontSize: '12px', fontWeight: 'bold' }}>#{i+1}</span>
                     <strong style={{ color: '#333' }}>{formatEntryTime(entry.mints, entry.scnds)}</strong>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                     <button type="button" disabled={isLocked} onClick={() => startEditing(entry)} style={{ padding: '6px 12px', fontSize: '12px', fontWeight: 'bold', cursor: isLocked ? 'not-allowed' : 'pointer', background: isLocked ? '#f5f5f5' : '#e8f0fe', border: 'none', borderRadius: '4px', color: isLocked ? '#aaa' : '#1a73e8' }}>Edit</button>
                     <button type="button" disabled={isLocked} onClick={() => handleDelete(entry.row)} style={{ padding: '6px 12px', fontSize: '12px', fontWeight: 'bold', cursor: isLocked ? 'not-allowed' : 'pointer', background: isLocked ? '#f5f5f5' : '#fce8e6', border: 'none', borderRadius: '4px', color: isLocked ? '#aaa' : '#c5221f' }}>Del</button>
                  </div>
                </li>
              ))}
              <li style={{ backgroundColor: '#e8f5e9', padding: '15px', marginTop: '15px', borderRadius: '8px', fontSize: '16px', display: 'flex', justifyContent: 'space-between', border: '1px solid #c8e6c9' }}>
                <span style={{ color: '#2e7d32', fontWeight: 'bold' }}>Daily Total:</span>
                <strong style={{ color: '#1b5e20' }}>{formatEntryTime(activeDayData.totalMints, activeDayData.totalScnds)}</strong>
              </li>
            </ul>
          ) : (
            <div style={{ padding: '20px', textAlign: 'center', fontSize: '14px', color: '#999', backgroundColor: '#fff', border: '1px dashed #ccc', borderRadius: '6px' }}>
              No time logged for this date.
            </div>
          )}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '50px 20px', color: '#777', fontSize: '15px', border: '2px dashed #eee', borderRadius: '12px', backgroundColor: '#fcfcfc' }}>
          <div style={{ fontSize: '30px', marginBottom: '10px' }}>📅</div>
          Select a date from the calendar above to log your time.
        </div>
      )}
    </div>
  );
}