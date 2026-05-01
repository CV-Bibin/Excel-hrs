import React from 'react';

export default function CustomAlert({ 
  isOpen, 
  title, 
  message, 
  type = 'info', // 'info', 'warning', 'error', 'success', 'confirm'
  onConfirm, 
  onCancel, 
  confirmText = 'OK', 
  cancelText = 'Cancel' 
}) {
  if (!isOpen) return null;

  // Determine icon and colors based on the alert type
  let icon = '💬';
  let colorTheme = '#333';
  let buttonColor = '#1a73e8';

  if (type === 'success') { icon = '✅'; colorTheme = '#2e7d32'; buttonColor = '#34a853'; }
  if (type === 'error' || type === 'warning') { icon = '🚨'; colorTheme = '#c62828'; buttonColor = '#d32f2f'; }
  if (type === 'confirm') { icon = '🤔'; colorTheme = '#1a73e8'; buttonColor = '#1a73e8'; }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.3)',
      backdropFilter: 'blur(3px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999,
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <div style={{
        backgroundColor: '#fdfdfd',
        padding: '25px 30px',
        borderRadius: '12px',
        width: '100%', maxWidth: '400px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
        textAlign: 'center',
        border: '1px solid #eee'
      }}>
        
        <div style={{ fontSize: '32px', marginBottom: '10px' }}>{icon}</div>
        
        <h3 style={{ margin: '0 0 10px 0', color: colorTheme, fontSize: '20px', fontWeight: '600' }}>
          {title}
        </h3>
        
        <p style={{ margin: '0 0 25px 0', color: '#666', fontSize: '14px', lineHeight: '1.5' }}>
          {message}
        </p>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          {type === 'confirm' && (
            <button 
              onClick={onCancel}
              style={{ flex: 1, padding: '10px', backgroundColor: '#fff', color: '#555', border: '1px solid #ccc', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', transition: '0.2s' }}
            >
              {cancelText}
            </button>
          )}
          
          <button 
            onClick={onConfirm}
            style={{ flex: 1, padding: '10px', backgroundColor: buttonColor, color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', transition: '0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
          >
            {confirmText}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}