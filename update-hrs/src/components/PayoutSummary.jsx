import React from 'react';

export default function PayoutSummary({ payoutSummaryData, grandTotalPayout }) {
  const formatCurrency = (amount) => `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;

  // If there is no data to show, don't render the box at all
  if (!payoutSummaryData || !Array.isArray(payoutSummaryData) || payoutSummaryData.length === 0) return null;

  return (
    <div style={{ marginTop: '50px', backgroundColor: '#fff', padding: '30px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', border: '1px solid #e0e0e0' }}>
      <h3 style={{ margin: '0 0 25px 0', color: '#1a73e8', fontSize: '22px', borderBottom: '2px solid #f1f3f4', paddingBottom: '12px' }}>
        💰 Final Payout Summary
      </h3>

      {payoutSummaryData.map((categoryGroup, idx) => (
        <div key={idx} style={{ marginBottom: '40px' }}>
          
          {/* Level 1: Category Header (My Own Accounts / External Accounts) */}
          <h4 style={{ backgroundColor: '#e8eaed', padding: '12px 18px', margin: '0 0 15px 0', color: '#1a73e8', textTransform: 'uppercase', fontSize: '15px', borderRadius: '6px', fontWeight: 'bold' }}>
            📂 {categoryGroup.category || 'Account Group'}
          </h4>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', marginBottom: '10px' }}>
            <thead>
              <tr>
                <th style={{ padding: '12px 15px', backgroundColor: '#f8f9fa', color: '#555', borderBottom: '2px solid #ddd', width: '40%' }}>Account Details</th>
                <th style={{ padding: '12px 15px', backgroundColor: '#f8f9fa', color: '#555', borderBottom: '2px solid #ddd', textAlign: 'center', width: '20%' }}>Monthly Hrs</th>
                <th style={{ padding: '12px 15px', backgroundColor: '#f8f9fa', color: '#555', borderBottom: '2px solid #ddd', textAlign: 'center', width: '20%' }}>Pay Rate</th>
                <th style={{ padding: '12px 15px', backgroundColor: '#f8f9fa', color: '#555', borderBottom: '2px solid #ddd', textAlign: 'right', width: '20%' }}>Total Payable</th>
              </tr>
            </thead>
            <tbody>
              {/* SAFETY CHECK: Added ? before .map to prevent crashes */}
              {categoryGroup.payees?.map((payee, pIdx) => (
                <React.Fragment key={pIdx}>
                  
                  {/* Level 2: Payee Header (Leader or Direct Rater) */}
                  <tr style={{ backgroundColor: '#f1f3f5' }}>
                    <td colSpan="3" style={{ padding: '14px 15px', fontWeight: 'bold', color: '#333', borderBottom: '1px solid #ddd' }}>
                      <span style={{ 
                        backgroundColor: payee.role === 'Leader' ? '#bbdefb' : '#ffe0b2', 
                        color: payee.role === 'Leader' ? '#1565c0' : '#e65100', 
                        padding: '4px 8px', 
                        borderRadius: '4px', 
                        fontSize: '11px', 
                        marginRight: '12px',
                        textTransform: 'uppercase',
                        fontWeight: 'bold'
                      }}>
                        {payee.role}
                      </span>
                      <span style={{ fontSize: '15px' }}>{payee.name}</span>
                    </td>
                    <td style={{ padding: '14px 15px', textAlign: 'right', fontWeight: 'bold', color: '#1b5e20', borderBottom: '1px solid #ddd', fontSize: '16px' }}>
                      {formatCurrency(payee.totalPay)}
                    </td>
                  </tr>

                  {/* Level 3: Detailed Individual Accounts */}
                  {/* SAFETY CHECK: Added ? before .map to prevent crashes */}
                  {payee.accounts?.map((acc, aIdx) => (
                    <tr key={aIdx} style={{ borderBottom: '1px solid #eee', backgroundColor: '#fff' }}>
                      <td style={{ padding: '12px 15px 12px 35px', color: '#555', fontSize: '14px' }}>
                        <span style={{ color: '#aaa', marginRight: '8px' }}>↳</span>
                        {acc.accName}
                      </td>
                      <td style={{ padding: '12px 15px', textAlign: 'center', color: '#555', fontSize: '14px', fontWeight: 'bold' }}>
                        {acc.hrs.toFixed(2)}
                      </td>
                      <td style={{ padding: '12px 15px', textAlign: 'center', color: '#777', fontSize: '14px' }}>
                        ₹{acc.rate}
                      </td>
                      <td style={{ padding: '12px 15px', textAlign: 'right', color: '#333', fontWeight: 'bold', fontSize: '14px' }}>
                        {formatCurrency(acc.pay)}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {/* Global Grand Total */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '25px', borderTop: '2px solid #ddd', paddingTop: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#e8f5e9', padding: '15px 30px', borderRadius: '8px', border: '1px solid #c8e6c9' }}>
          <span style={{ fontWeight: 'bold', fontSize: '16px', color: '#333', marginRight: '15px' }}>Grand Total Distribution:</span>
          <span style={{ fontWeight: 'bold', fontSize: '22px', color: '#2e7d32' }}>{formatCurrency(grandTotalPayout)}</span>
        </div>
      </div>
    </div>
  );
}