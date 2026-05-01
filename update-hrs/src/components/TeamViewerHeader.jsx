import React from 'react';

export default function TeamViewerHeader({ 
  isAdmin, selectedManager, setSelectedManager, managersList, 
  showClientPay, exchangeRate, isSyncingSheets, isInitialLoad, 
  changeMonth, getMonthKey, currentDate, triggerManualSync 
}) {
  return (
    <div style={{ backgroundColor: '#fff', padding: '15px 30px', borderBottom: '1px solid #ddd', display: 'flex', gap: '20px', alignItems: 'center' }}>
      {isAdmin && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontWeight: 'bold', color: '#555' }}>Manager's Payroll:</span>
          <select value={selectedManager} onChange={e => setSelectedManager(e.target.value)} style={{ padding: '6px', borderRadius: '4px' }}>
            <option value="">-- Select Leader --</option>
            {managersList.map(m => <option key={m.email} value={m.email}>{m.email}</option>)}
          </select>
        </div>
      )}
      
      {showClientPay && (
        <div style={{ marginLeft: '20px', fontSize: '13px', color: '#1a73e8', backgroundColor: '#e8f0fe', padding: '6px 12px', borderRadius: '15px', fontWeight: 'bold' }}>
          Using $1 = ₹{exchangeRate}
        </div>
      )}

      {/* Manual Sync Button & Live Indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '20px' }}>
        <button 
          onClick={triggerManualSync} 
          disabled={isSyncingSheets || !selectedManager}
          style={{ padding: '6px 12px', backgroundColor: '#e8f5e9', color: '#2e7d32', border: '1px solid #a5d6a7', borderRadius: '4px', cursor: (isSyncingSheets || !selectedManager) ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '12px', transition: '0.2s' }}
        >
          {isSyncingSheets ? '🔄 Syncing...' : '🔄 Sync Sheets Now'}
        </button>

        {isSyncingSheets && !isInitialLoad && (
          <div style={{ fontSize: '12px', color: '#e65100', backgroundColor: '#fff3e0', padding: '6px 12px', borderRadius: '15px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="sync-spinner">↻</span> Live checking Excel...
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: 'auto' }}>
        <button onClick={() => changeMonth(-1)} style={{ padding: '6px 12px', cursor: 'pointer' }}>&larr;</button>
        <strong style={{ textTransform: 'uppercase', minWidth: '100px', textAlign: 'center', color: '#d32f2f' }}>{getMonthKey(currentDate)}</strong>
        <button onClick={() => changeMonth(1)} style={{ padding: '6px 12px', cursor: 'pointer' }}>&rarr;</button>
      </div>

      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .sync-spinner { display: inline-block; animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}