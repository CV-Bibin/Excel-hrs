import React, { useState, useEffect } from 'react';

const monthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const dayLabels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

// 💡 FIX 1: Added `sheetId` to the incoming props!
export default function CalendarPanel({ 
  accountName, sheetId, currentDate, changeMonth, gridData, fetchData, isLoading, setStatus 
}) {
  const [selectedDayObj, setSelectedDayObj] = useState(null);
  const [inputMints, setInputMints] = useState('');
  const [inputScnds, setInputScnds] = useState('');
  const [editingRowIndex, setEditingRowIndex] = useState(null);

  useEffect(() => {
    setSelectedDayObj(null);
    setEditingRowIndex(null);
  }, [accountName, currentDate]);

  const getMonthKey = (dateObj) => `${monthNames[dateObj.getMonth()]} ${dateObj.getFullYear()}`;

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

  const realToday = new Date();
  const isCurrentOrFutureMonth = currentDate.getFullYear() > realToday.getFullYear() || 
                                 (currentDate.getFullYear() === realToday.getFullYear() && currentDate.getMonth() >= realToday.getMonth());

  const handleSubmitTime = async (e) => {
    e.preventDefault();
    if (!selectedDayObj) return;

    const isEdit = editingRowIndex !== null;
    const url = isEdit ? 'http://localhost:5000/api/modify-hr' : 'http://localhost:5000/api/update-hrs';
    
    setStatus({ type: 'info', message: isEdit ? 'Updating entry...' : 'Adding entry...' });

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountName, 
          sheetId, // 💡 FIX 2: Now we actually send the ID to the backend!
          monthKey: getMonthKey(currentDate), 
          date: selectedDayObj.date,
          mints: inputMints, 
          scnds: inputScnds,
          action: isEdit ? 'edit' : undefined, 
          rowIndex: isEdit ? editingRowIndex : undefined
        }),
      });
      
      const responseData = await response.json(); // Grab backend messages

      if (response.ok) {
        setStatus({ type: 'success', message: isEdit ? 'Updated Successfully!' : 'Added Successfully!' });
        setInputMints(''); setInputScnds(''); setEditingRowIndex(null);
        await fetchData(); 
        setTimeout(() => setStatus({type: '', message: ''}), 2000); 
      } else {
        // 💡 FIX 3: Stop the infinite loading and show the actual error on screen!
        setStatus({ type: 'error', message: responseData.error || 'Failed to save data.' });
      }
    } catch (error) {
      setStatus({ type: 'error', message: `Network error: Failed to save data.` });
    }
  };

  const handleDelete = async (rowIndex) => {
    if(!window.confirm("Are you sure you want to delete this entry?")) return;
    setStatus({ type: 'info', message: 'Deleting entry...' });
    try {
      const response = await fetch('http://localhost:5000/api/modify-hr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountName, 
          sheetId, // 💡 Send ID here too!
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
        // 💡 Stop the infinite loading on delete failures
        setStatus({ type: 'error', message: responseData.error || 'Failed to delete data.' });
      }
    } catch (error) {
      setStatus({ type: 'error', message: `Network error: Failed to delete data.` });
    }
  };

  const startEditing = (entry) => {
    setEditingRowIndex(entry.row);
    setInputMints(entry.mints);
    setInputScnds(entry.scnds);
  };

  const firstDayOfWeek = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const blanks = Array(firstDayOfWeek).fill(null);
  const days = Array.from({length: lastDayOfMonth}, (_, i) => i + 1);
  const activeDayData = selectedDayObj ? gridData.find(d => d.date === selectedDayObj.date) : null;
  const hasReachedLimit = activeDayData ? activeDayData.entries.length >= 20 : false;

  return (
    <div style={{ width: '420px', backgroundColor: '#fff', borderRight: '1px solid #ddd', padding: '20px', overflowY: 'auto' }}>
      
      {/* Month Navigator */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <button onClick={() => changeMonth(-1)} style={{ cursor: 'pointer', border: '1px solid #ccc', background: '#fff', padding: '6px 12px', borderRadius: '4px' }}>&larr; Prev</button>
        <h3 style={{ margin: 0, textTransform: 'uppercase', fontSize: '15px' }}>{getMonthKey(currentDate)}</h3>
        <button onClick={() => changeMonth(1)} disabled={isCurrentOrFutureMonth} style={{ cursor: isCurrentOrFutureMonth ? 'not-allowed' : 'pointer', border: '1px solid #ccc', background: isCurrentOrFutureMonth ? '#eee' : '#fff', padding: '6px 12px', borderRadius: '4px' }}>Next &rarr;</button>
      </div>

      {/* Calendar Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '5px', textAlign: 'center', marginBottom: '20px' }}>
        {dayLabels.map(day => <div key={day} style={{ fontSize: '12px', fontWeight: 'bold', color: '#666' }}>{day}</div>)}
        {blanks.map((_, i) => <div key={`blank-${i}`} />)}
        {days.map(day => {
          const dateStr = `${day}/${currentDate.getMonth() + 1}/${currentDate.getFullYear()}`;
          const isSelected = selectedDayObj && selectedDayObj.date === dateStr;
          return (
            <button key={day} onClick={() => { setSelectedDayObj({ date: dateStr }); setEditingRowIndex(null); setInputMints(''); setInputScnds(''); }} style={{ padding: '10px 0', border: '1px solid #eee', borderRadius: '4px', cursor: 'pointer', backgroundColor: isSelected ? '#1a73e8' : '#f8f9fa', color: isSelected ? '#fff' : '#333', fontWeight: isSelected ? 'bold' : 'normal' }}>
              {day}
            </button>
          )
        })}
      </div>

      {/* Entry Form & List */}
      {selectedDayObj ? (
        <div style={{ backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
          <h4 style={{ margin: '0 0 15px 0', color: '#1a73e8' }}>
            {editingRowIndex ? `Edit Entry on ${selectedDayObj.date}` : `Log Time: ${selectedDayObj.date}`}
          </h4>
          
          {hasReachedLimit && !editingRowIndex ? (
             <div style={{ padding: '10px', backgroundColor: '#fdecea', color: '#d32f2f', borderRadius: '4px', marginBottom: '15px', fontSize: '13px', textAlign: 'center' }}>Maximum 20 entries reached for this day!</div>
          ) : (
            <form onSubmit={handleSubmitTime} style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
              <input type="number" placeholder="Mins" required value={inputMints} onChange={e => setInputMints(e.target.value)} style={{ flex: 1, padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}/>
              <input type="number" placeholder="Secs" required value={inputScnds} onChange={e => setInputScnds(e.target.value)} style={{ flex: 1, padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}/>
              <button type="submit" disabled={isLoading} style={{ padding: '8px 15px', backgroundColor: editingRowIndex ? '#fbbc04' : '#34a853', color: editingRowIndex ? '#000' : 'white', fontWeight: 'bold', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                {editingRowIndex ? 'Save' : 'Submit'}
              </button>
              {editingRowIndex && <button type="button" onClick={() => {setEditingRowIndex(null); setInputMints(''); setInputScnds('');}} style={{ padding: '8px', backgroundColor: '#ccc', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>}
            </form>
          )}

          <h5 style={{ margin: '0 0 10px 0', color: '#555' }}>Entries for {selectedDayObj.date}:</h5>
          {activeDayData && activeDayData.entries.length > 0 ? (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {activeDayData.entries.map((entry, i) => (
                <li key={i} style={{ backgroundColor: '#fff', padding: '10px', marginBottom: '5px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                     <span style={{ color: '#888', marginRight: '10px', fontSize: '12px' }}>#{i+1}</span>
                     <strong>{formatEntryTime(entry.mints, entry.scnds)}</strong>
                  </div>
                  <div style={{ display: 'flex', gap: '5px' }}>
                     <button type="button" onClick={() => startEditing(entry)} style={{ padding: '4px 8px', fontSize: '12px', cursor: 'pointer', background: '#e3f2fd', border: '1px solid #90caf9', borderRadius: '4px', color: '#1565c0' }}>Edit</button>
                     <button type="button" onClick={() => handleDelete(entry.row)} style={{ padding: '4px 8px', fontSize: '12px', cursor: 'pointer', background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: '4px', color: '#c62828' }}>Del</button>
                  </div>
                </li>
              ))}
              <li style={{ backgroundColor: '#e8f5e9', padding: '12px', marginTop: '10px', borderRadius: '4px', fontSize: '15px', textAlign: 'right', border: '1px solid #c8e6c9' }}>
                Daily Total: <strong style={{ color: '#2e7d32' }}>{formatEntryTime(activeDayData.totalMints, activeDayData.totalScnds)}</strong>
              </li>
            </ul>
          ) : (
            <div style={{ fontSize: '13px', color: '#999', fontStyle: 'italic' }}>No entries for this date.</div>
          )}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '30px', color: '#999', fontSize: '14px' }}>Select a date from the calendar to log time.</div>
      )}
    </div>
  );
}