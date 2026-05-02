import React from "react";

const formatHMS = (m, s) =>
  m === 0 && s === 0
    ? "0 h 0 m 0 s"
    : `${Math.floor(m / 60)} h ${m % 60} m ${s} s`;
const formatCurrency = (amount) =>
  `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
const formatUSD = (amount) =>
  `$${amount.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;

const cellStyle = {
  padding: "8px",
  border: "1px solid #ccc",
  fontSize: "13px",
  textAlign: "center",
  whiteSpace: "nowrap",
};
const headerStyle = { ...cellStyle, fontWeight: "bold" };
const headerGreen = {
  ...headerStyle,
  backgroundColor: "#a5d6a7",
  color: "#111",
};
const headerYellow = {
  ...headerStyle,
  backgroundColor: "#ffe082",
  color: "#111",
};
const headerOrange = {
  ...headerStyle,
  backgroundColor: "#ffcc80",
  color: "#111",
};
const headerPinkText = {
  ...headerStyle,
  color: "#c2185b",
  backgroundColor: "#fff",
};
const headerGreyText = {
  ...headerStyle,
  color: "#777",
  backgroundColor: "#fff",
  fontSize: "12px",
};

const getWeekColor = (mints, scnds, isNonProfit) => {
  const hrs = mints / 60 + scnds / 3600;
  if (hrs === 0) return isNonProfit ? "#e57373" : "#d32f2f"; 
  if (hrs > 20) return isNonProfit ? "#64b5f6" : "#1976d2";  
  return isNonProfit ? "#aaa" : "#333";                      
};

const getMonthColor = (decimalHours, isNonProfit) => {
  if (decimalHours < 5) return isNonProfit ? "#e57373" : "#d32f2f";  
  if (decimalHours > 40) return isNonProfit ? "#81c784" : "#2e7d32"; 
  if (decimalHours > 20) return isNonProfit ? "#64b5f6" : "#1976d2"; 
  return isNonProfit ? "#aaa" : "#333";                              
};

export default function PayrollTable({
  isCoAdmin,
  groupedTeamData,
  grandTotals,
  coAdminGroups,
  handleCoAdminGroupChange,
  selfRatedMap,
  handleSelfRatedChange,
  showClientPay,
  showLeaderPay,
  showRaterPay,
  showLeaderProfit,
  calcTotals,
  handleCreateNewSheet, 
}) {
  const coreGroups = {};
  let nonProfitRows = [];
  Object.entries(groupedTeamData).forEach(([key, rows]) => {
    if (key === "Non-Profit Accounts") {
      nonProfitRows = rows;
    } else {
      coreGroups[key] = rows;
    }
  });

  const renderCoAdminRow = (row, isNonProfit) => {
    const isManuallySelfRated = selfRatedMap[row.email] && !row.isOwnCoAdminAccount;
    const rowBgColor = row.isDisabled 
      ? "#eeeeee" 
      : (row.needsNewSheet || row.excelMissing
        ? "#ffebee"
        : isNonProfit
          ? "#fafafa"
          : isManuallySelfRated
            ? "#fffde7"
            : "#fff");
            
    const textColor = isNonProfit ? "#888" : "#333";
    const monthColor = getMonthColor(row.decimalHours, isNonProfit);

    return (
      <tr
        key={row.email}
        style={{ backgroundColor: rowBgColor, opacity: row.isDisabled ? 0.6 : (isNonProfit ? 0.85 : 1) }}
      >
        <td style={cellStyle}>
          <a
            href={`https://docs.google.com/spreadsheets/d/${row.sheetId}`}
            target="_blank"
            rel="noreferrer"
            style={{ color: isNonProfit ? "#9e9e9e" : "#1155cc" }}
          >
            Open
          </a>
        </td>
        <td style={{ ...cellStyle, textAlign: "left" }}>
          <strong style={{ fontSize: "13px", color: textColor, textDecoration: row.isDisabled ? "line-through" : "none" }}>
            {row.name}
          </strong>
          
          {/* 💡 DISABLED BADGE */}
          {row.isDisabled && (
            <span style={{ marginLeft: "6px", fontSize: "9px", color: "#d32f2f", fontWeight: "bold", backgroundColor: "#fce8e6", padding: "2px 4px", borderRadius: "3px", border: "1px solid #ef9a9a" }}>
              🚫 DISABLED
            </span>
          )}

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "4px",
              marginTop: "4px",
              marginBottom: "4px",
            }}
          >
            {row.role !== "rater" && row.role !== "leader" && (
              <span
                style={{
                  backgroundColor: "#e0e0e0",
                  padding: "1px 4px",
                  borderRadius: "3px",
                  fontSize: "9px",
                  fontWeight: "bold",
                  textTransform: "uppercase",
                }}
              >
                {row.role}
              </span>
            )}
            {row.clientName && (
              <span
                style={{
                  fontSize: "9px",
                  color: isNonProfit ? "#999" : "#1a73e8",
                }}
              >
                <strong>C:</strong> {row.clientName}
              </span>
            )}
            {row.coAdminName && (
              <span
                style={{
                  fontSize: "9px",
                  color: isNonProfit ? "#999" : "#e65100",
                }}
              >
                <strong>CA:</strong> {row.coAdminName}
              </span>
            )}
            {row.displayLeaderName && (
              <span
                style={{
                  fontSize: "9px",
                  color: isNonProfit ? "#999" : "#7b1fa2",
                }}
              >
                <strong>L:</strong> {row.displayLeaderName}
              </span>
            )}
          </div>

          {row.needsNewSheet ? (
            <div
              style={{
                marginTop: "6px",
                padding: "6px",
                backgroundColor: "#ffebee",
                border: "1px solid #ef9a9a",
                borderRadius: "4px",
              }}
            >
              <div
                style={{
                  fontSize: "10px",
                  color: "#c62828",
                  fontWeight: "bold",
                  marginBottom: "6px",
                  textAlign: "center",
                }}
              >
                🚨 FILE MISSING OR DELETED
              </div>
              <div style={{ display: "flex", gap: "4px" }}>
                <button
                  onClick={() =>
                    handleCreateNewSheet(row.email, row.sheetId, false)
                  }
                  style={{
                    flex: 1,
                    fontSize: "9px",
                    padding: "4px",
                    backgroundColor: "#fff",
                    color: "#d32f2f",
                    border: "1px solid #d32f2f",
                    borderRadius: "3px",
                    cursor: "pointer",
                    fontWeight: "bold",
                  }}
                >
                  Create Blank
                </button>
                <button
                  onClick={() =>
                    handleCreateNewSheet(row.email, row.sheetId, true)
                  }
                  style={{
                    flex: 1,
                    fontSize: "9px",
                    padding: "4px",
                    backgroundColor: "#d32f2f",
                    color: "#fff",
                    border: "none",
                    borderRadius: "3px",
                    cursor: "pointer",
                    fontWeight: "bold",
                  }}
                >
                  Restore Backup
                </button>
              </div>
            </div>
          ) : (
            row.excelMissing && (
              <div
                style={{
                  marginTop: "4px",
                  fontSize: "10px",
                  color: "#c62828",
                  fontWeight: "bold",
                  backgroundColor: "#ffcdd2",
                  display: "inline-block",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  border: "1px solid #e53935",
                }}
              >
                🚨 Offline - Showing Saved Data
              </div>
            )
          )}
          {row.isAutoOwned ? (
            <div
              style={{
                marginTop: "4px",
                fontSize: "10px",
                color: "#2e7d32",
                fontWeight: "bold",
                backgroundColor: "#e8f5e9",
                display: "inline-block",
                padding: "2px 6px",
                borderRadius: "4px",
              }}
            >
              ✓ Personal Account
            </div>
          ) : (
            <select
              value={coAdminGroups[row.email] || "Non-Profit Accounts"}
              onChange={(e) =>
                handleCoAdminGroupChange(row.email, e.target.value)
              }
              style={{
                display: "block",
                marginTop: "4px",
                fontSize: "10px",
                padding: "2px",
                width: "100%",
                border: "1px solid #ddd",
                borderRadius: "4px",
                backgroundColor: "#fff",
                color: "#555",
              }}
            >
              <option value="My Own Accounts">My Own Accounts</option>
              <option value="External Accounts">External Accounts</option>
              <option value="Non-Profit Accounts">Non-Profit Accounts</option>
            </select>
          )}

          {isManuallySelfRated && (
            <div
              style={{
                fontSize: "10px",
                color: "#f57f17",
                backgroundColor: "#fff8e1",
                padding: "2px 6px",
                borderRadius: "4px",
                display: "inline-block",
                marginTop: "6px",
                fontWeight: "bold",
                border: "1px solid #ffe082",
              }}
            >
              ⭐ Rated By Me
            </div>
          )}

          {!isNonProfit &&
            row.role !== "leader" &&
            !row.isOwnCoAdminAccount &&
            !row.hasLeader && (
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  marginTop: "6px",
                  fontSize: "10px",
                  color: isNonProfit ? "#999" : "#c2185b",
                  cursor: "pointer",
                  backgroundColor: isNonProfit ? "#eee" : "#fce4ec",
                  padding: "3px 5px",
                  borderRadius: "4px",
                  border: `1px solid ${isNonProfit ? "#ddd" : "#f8bbd0"}`,
                  width: "fit-content",
                  fontWeight: "bold",
                }}
              >
                <input
                  type="checkbox"
                  checked={selfRatedMap[row.email] || false}
                  onChange={(e) =>
                    handleSelfRatedChange(row.email, e.target.checked)
                  }
                  style={{
                    width: "11px",
                    height: "11px",
                    cursor: "pointer",
                    margin: 0,
                  }}
                />
                Rate
              </label>
            )}
        </td>
        <td style={{ ...cellStyle, color: getWeekColor(row.weeklyTotals[0].mints, row.weeklyTotals[0].scnds, isNonProfit) }}>
          {formatHMS(row.weeklyTotals[0].mints, row.weeklyTotals[0].scnds)}
        </td>
        <td style={{ ...cellStyle, color: getWeekColor(row.weeklyTotals[1].mints, row.weeklyTotals[1].scnds, isNonProfit) }}>
          {formatHMS(row.weeklyTotals[1].mints, row.weeklyTotals[1].scnds)}
        </td>
        <td style={{ ...cellStyle, color: getWeekColor(row.weeklyTotals[2].mints, row.weeklyTotals[2].scnds, isNonProfit) }}>
          {formatHMS(row.weeklyTotals[2].mints, row.weeklyTotals[2].scnds)}
        </td>
        <td style={{ ...cellStyle, color: getWeekColor(row.weeklyTotals[3].mints, row.weeklyTotals[3].scnds, isNonProfit) }}>
          {formatHMS(row.weeklyTotals[3].mints, row.weeklyTotals[3].scnds)}
        </td>
        <td style={{ ...cellStyle, color: getWeekColor(row.weeklyTotals[4].mints, row.weeklyTotals[4].scnds, isNonProfit) }}>
          {formatHMS(row.weeklyTotals[4].mints, row.weeklyTotals[4].scnds)}
        </td>
        <td style={{ ...cellStyle, color: getWeekColor(row.weeklyTotals[5].mints, row.weeklyTotals[5].scnds, isNonProfit) }}>
          {formatHMS(row.weeklyTotals[5].mints, row.weeklyTotals[5].scnds)}
        </td>
        <td
          style={{
            ...cellStyle,
            backgroundColor: isNonProfit ? "#f0f8ff" : "#e3f2fd",
            color: monthColor,
            fontWeight: "bold"
          }}
        >
          {formatHMS(row.monthMints, row.monthScnds)}
        </td>
        <td style={{ ...cellStyle, color: monthColor, fontWeight: "bold" }}>
          {row.decimalHours.toFixed(2)}
        </td>
        <td style={{ ...cellStyle, color: textColor }}>
          {formatUSD(row.clientPaymentUSD)}
        </td>
        <td style={{ ...cellStyle, color: textColor }}>
          {formatCurrency(row.clientPaymentINR)}
        </td>

        <td
          style={{
            ...cellStyle,
            color: isNonProfit ? "#aaa" : "#333",
            fontWeight: "bold",
            backgroundColor: isNonProfit
              ? "#f1f3f4"
              : isManuallySelfRated || row.isOwnCoAdminAccount
                ? "#fff3e0"
                : "transparent",
          }}
        >
          {formatCurrency(row.coAdminProfit)}
        </td>

        <td style={{ ...cellStyle, color: isNonProfit ? "#999" : "#9e9e9e" }}>
          {row.finalLeaderRate}
        </td>
        <td style={{ ...cellStyle, color: textColor }}>
          {formatCurrency(row.leaderPayment)}
        </td>
      </tr>
    );
  };

  const renderCoAdminTable = () => (
    <table
      style={{
        borderCollapse: "collapse",
        backgroundColor: "#fff",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        width: "100%",
        marginBottom: "30px",
      }}
    >
      <thead>
        <tr>
          <th style={headerStyle}>Sheet</th>
          <th style={headerGreen}>Account name</th>
          <th style={headerStyle}>week 1 hrs</th>
          <th style={headerStyle}>week 2 hrs</th>
          <th style={headerStyle}>week 3 hrs</th>
          <th style={headerStyle}>week 4 hrs</th>
          <th style={headerStyle}>week 5 hrs</th>
          <th style={headerStyle}>week 6 hrs</th>
          <th style={headerYellow}>Monthly Hrs</th>
          <th style={headerGreyText}>decimal hrs</th>
          <th style={headerGreyText}>Total money</th>
          <th style={headerGreyText}>in INR</th>
          <th style={headerOrange}>my money</th>
          <th style={headerGreyText}>raters payra</th>
          <th style={headerGreen}>raters payment</th>
        </tr>
      </thead>
      <tbody>
        {Object.entries(coreGroups).map(([groupName, rows]) => {
          if (rows.length === 0) return null;
          const groupTotals = calcTotals(rows);
          const isExternal = groupName.startsWith("External Accounts");

          return (
            <React.Fragment key={groupName}>
              <tr>
                <td
                  colSpan="100%"
                  style={{
                    backgroundColor: "#e8eaed",
                    fontWeight: "bold",
                    textAlign: "left",
                    padding: "10px 15px",
                    color: "#1a73e8",
                    textTransform: "uppercase",
                    fontSize: "12px",
                  }}
                >
                  📂 {groupName}{" "}
                  <span
                    style={{
                      color: "#888",
                      fontWeight: "normal",
                      textTransform: "none",
                    }}
                  >
                    ({rows.length} accounts)
                  </span>
                  {isExternal && (
                    <span
                      style={{
                        marginLeft: "10px",
                        color: "#e65100",
                        fontSize: "11px",
                        fontWeight: "bold",
                        backgroundColor: "#ffe0b2",
                        padding: "2px 8px",
                        borderRadius: "12px",
                        border: "1px solid #ffcc80",
                      }}
                    >
                      ✂️ 50% Profit Split
                    </span>
                  )}
                </td>
              </tr>

              {rows.map((row) => renderCoAdminRow(row, false))}

              <tr style={{ backgroundColor: "#f5f5f5" }}>
                <td
                  colSpan="9"
                  style={{
                    ...cellStyle,
                    border: "none",
                    textAlign: "right",
                    fontStyle: "italic",
                    color: "#666",
                  }}
                >
                  Subtotal:
                </td>
                <td style={{ ...cellStyle, color: "#333", fontWeight: "bold" }}>
                  {groupTotals.decHrs.toFixed(2)}
                </td>
                <td style={{ ...cellStyle, color: "#333", fontWeight: "bold" }}>
                  {formatUSD(groupTotals.clientUSD)}
                </td>
                <td style={{ ...cellStyle, color: "#333", fontWeight: "bold" }}>
                  {formatCurrency(groupTotals.clientINR)}
                </td>
                <td
                  style={{ ...cellStyle, color: "#ff9800", fontWeight: "bold" }}
                >
                  {formatCurrency(groupTotals.coAdminProfit)}
                </td>
                <td style={{ border: "none" }}></td>
                <td
                  style={{ ...cellStyle, color: "#388e3c", fontWeight: "bold" }}
                >
                  {formatCurrency(groupTotals.ldrPay)}
                </td>
              </tr>
            </React.Fragment>
          );
        })}

        <tr style={{ borderTop: "4px solid #333" }}>
          <td
            colSpan="9"
            style={{
              ...cellStyle,
              border: "none",
              textAlign: "right",
              fontWeight: "bold",
              color: "#111",
              fontSize: "14px",
            }}
          >
            ACTIVE GRAND TOTAL:
          </td>
          <td
            style={{
              ...cellStyle,
              backgroundColor: "#ffcc80",
              fontWeight: "bold",
              fontSize: "15px",
            }}
          >
            {grandTotals.decHrs.toFixed(2)}
          </td>
          <td
            style={{
              ...cellStyle,
              color: "#333",
              fontWeight: "bold",
              fontSize: "15px",
            }}
          >
            {formatUSD(grandTotals.clientUSD)}
          </td>
          <td
            style={{
              ...cellStyle,
              color: "#333",
              fontWeight: "bold",
              fontSize: "15px",
            }}
          >
            {formatCurrency(grandTotals.clientINR)}
          </td>
          <td
            style={{
              ...cellStyle,
              backgroundColor: "#ff9800",
              color: "#fff",
              fontWeight: "bold",
              fontSize: "15px",
            }}
          >
            {formatCurrency(grandTotals.coAdminProfit)}
          </td>
          <td style={{ border: "none" }}></td>
          <td
            style={{
              ...cellStyle,
              backgroundColor: "#388e3c",
              color: "#fff",
              fontWeight: "bold",
              fontSize: "15px",
            }}
          >
            {formatCurrency(grandTotals.ldrPay)}
          </td>
        </tr>

        {nonProfitRows.length > 0 && (
          <>
            <tr
              style={{
                height: "40px",
                border: "none",
                backgroundColor: "#f8f9fa",
              }}
            >
              <td colSpan="100%"></td>
            </tr>
            <tr>
              <td
                colSpan="100%"
                style={{
                  backgroundColor: "#e0e0e0",
                  fontWeight: "bold",
                  textAlign: "left",
                  padding: "12px 15px",
                  color: "#555",
                  textTransform: "uppercase",
                  fontSize: "12px",
                  borderTop: "2px dashed #999",
                  borderBottom: "2px solid #ccc",
                }}
              >
                🚫 Non-Profit Accounts{" "}
                <span
                  style={{
                    color: "#777",
                    fontWeight: "normal",
                    textTransform: "none",
                  }}
                >
                  ({nonProfitRows.length} accounts)
                </span>
                <span
                  style={{
                    marginLeft: "15px",
                    color: "#d32f2f",
                    fontSize: "11px",
                    textTransform: "none",
                    backgroundColor: "#ffcdd2",
                    padding: "2px 8px",
                    borderRadius: "12px",
                  }}
                >
                  *Excluded from Grand Totals
                </span>
              </td>
            </tr>

            {nonProfitRows.map((row) => renderCoAdminRow(row, true))}

            <tr style={{ backgroundColor: "#eeeeee" }}>
              <td
                colSpan="9"
                style={{
                  ...cellStyle,
                  border: "none",
                  textAlign: "right",
                  fontStyle: "italic",
                  color: "#888",
                }}
              >
                Non-Profit Tracking Subtotal:
              </td>
              <td style={{ ...cellStyle, color: "#777", fontWeight: "bold" }}>
                {calcTotals(nonProfitRows).decHrs.toFixed(2)}
              </td>
              <td style={{ ...cellStyle, color: "#777", fontWeight: "bold" }}>
                {formatUSD(calcTotals(nonProfitRows).clientUSD)}
              </td>
              <td style={{ ...cellStyle, color: "#777", fontWeight: "bold" }}>
                {formatCurrency(calcTotals(nonProfitRows).clientINR)}
              </td>
              <td style={{ ...cellStyle, color: "#aaa", fontWeight: "bold" }}>
                ₹0.00
              </td>
              <td style={{ border: "none" }}></td>
              <td style={{ ...cellStyle, color: "#777", fontWeight: "bold" }}>
                {formatCurrency(calcTotals(nonProfitRows).ldrPay)}
              </td>
            </tr>
          </>
        )}
      </tbody>
    </table>
  );

  const renderLeaderTable = () => (
    <table
      style={{
        borderCollapse: "collapse",
        backgroundColor: "#fff",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        width: "100%",
      }}
    >
      <thead>
  <tr>
    <th style={headerStyle}>Sheet</th>
    <th style={{ ...headerGreen, textAlign: "left" }}>Account Details</th>
    <th style={headerStyle}>week 1 hrs</th>
    <th style={headerStyle}>week 2 hrs</th>
    <th style={headerStyle}>week 3 hrs</th>
    <th style={headerStyle}>week 4 hrs</th>
    <th style={headerStyle}>week 5 hrs</th>
    <th style={headerStyle}>week 6 hrs</th>
    <th style={headerYellow}>Monthly Hrs</th>
    <th style={headerGreyText}>decimal hrs</th>
    {showClientPay && (
      <>
        <th style={headerGreyText}>Client Rate (₹)</th>
        <th style={{ ...headerStyle, backgroundColor: "#bbdefb" }}>Client Total</th>
      </>
    )}
    {showLeaderPay && (
      <>
        <th style={headerGreyText}>Leader Rate</th>
        <th style={{ ...headerStyle, backgroundColor: "#e1bee7" }}>Leader Total</th>
      </>
    )}
    {showRaterPay && (
      <>
        <th style={headerGreyText}>Rater Rate</th>
        <th style={headerOrange}>Rater Total</th>
      </>
    )}
    {showLeaderProfit && (
      <th style={{ ...headerStyle, backgroundColor: "#e6f4ea" }}>Profit Margin</th>
    )}
  </tr>
</thead>
      <tbody>
        {Object.entries(coreGroups).map(([groupName, rows]) => {
          if (rows.length === 0) return null;
          const groupTotals = calcTotals(rows);

          return (
            <React.Fragment key={groupName}>
              <tr>
                <td
                  colSpan="100%"
                  style={{
                    backgroundColor: "#e8eaed",
                    fontWeight: "bold",
                    textAlign: "left",
                    padding: "10px 15px",
                    color: "#1a73e8",
                    textTransform: "uppercase",
                    fontSize: "12px",
                  }}
                >
                  📂 {groupName}{" "}
                  <span
                    style={{
                      color: "#888",
                      fontWeight: "normal",
                      textTransform: "none",
                    }}
                  >
                    ({rows.length} accounts)
                  </span>
                </td>
              </tr>
              {rows.map((row) => {
                const monthColor = getMonthColor(row.decimalHours, false);
                return (
                  <tr
                    key={row.email}
                    style={{
                      backgroundColor: row.isDisabled ? "#eeeeee" : (row.needsNewSheet || row.excelMissing ? "#ffebee" : "#fff"),
                      opacity: row.isDisabled ? 0.6 : 1
                    }}
                  >
                    <td style={cellStyle}>
                      <a
                        href={`https://docs.google.com/spreadsheets/d/${row.sheetId}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "#1155cc" }}
                      >
                        Open
                      </a>
                    </td>
                    <td style={{ ...cellStyle, textAlign: "left" }}>
                      <strong style={{ fontSize: "14px", color: "#333", textDecoration: row.isDisabled ? "line-through" : "none" }}>
                        {row.name}
                      </strong>
                      
                      {/* 💡 DISABLED BADGE */}
                      {row.isDisabled && (
                        <span style={{ marginLeft: "6px", fontSize: "9px", color: "#d32f2f", fontWeight: "bold", backgroundColor: "#fce8e6", padding: "2px 4px", borderRadius: "3px", border: "1px solid #ef9a9a" }}>
                          🚫 DISABLED
                        </span>
                      )}

                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "4px",
                          marginTop: "4px",
                        }}
                      >
                        {row.role !== "rater" && row.role !== "leader" && (
                          <span
                            style={{
                              backgroundColor: "#e0e0e0",
                              padding: "1px 4px",
                              borderRadius: "3px",
                              fontSize: "9px",
                              fontWeight: "bold",
                              textTransform: "uppercase",
                            }}
                          >
                            {row.role}
                          </span>
                        )}
                        {row.clientName && (
                          <span style={{ fontSize: "9px", color: "#1a73e8" }}>
                            <strong>C:</strong> {row.clientName}
                          </span>
                        )}
                        {row.displayLeaderName && (
                          <span style={{ fontSize: "9px", color: "#7b1fa2" }}>
                            <strong>L:</strong> {row.displayLeaderName}
                          </span>
                        )}
                      </div>

                      {row.needsNewSheet ? (
                        <div
                          style={{
                            marginTop: "6px",
                            padding: "6px",
                            backgroundColor: "#ffebee",
                            border: "1px solid #ef9a9a",
                            borderRadius: "4px",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "10px",
                              color: "#c62828",
                              fontWeight: "bold",
                              marginBottom: "6px",
                              textAlign: "center",
                            }}
                          >
                            🚨 FILE MISSING OR DELETED
                          </div>
                          <div style={{ display: "flex", gap: "4px" }}>
                            <button
                              onClick={() =>
                                handleCreateNewSheet(row.email, row.sheetId, false)
                              }
                              style={{
                                flex: 1,
                                fontSize: "9px",
                                padding: "4px",
                                backgroundColor: "#fff",
                                color: "#d32f2f",
                                border: "1px solid #d32f2f",
                                borderRadius: "3px",
                                cursor: "pointer",
                                fontWeight: "bold",
                              }}
                            >
                              Create Blank
                            </button>
                            <button
                              onClick={() =>
                                handleCreateNewSheet(row.email, row.sheetId, true)
                              }
                              style={{
                                flex: 1,
                                fontSize: "9px",
                                padding: "4px",
                                backgroundColor: "#d32f2f",
                                color: "#fff",
                                border: "none",
                                borderRadius: "3px",
                                cursor: "pointer",
                                fontWeight: "bold",
                              }}
                            >
                              Restore Backup
                            </button>
                          </div>
                        </div>
                      ) : (
                        row.excelMissing && (
                          <div
                            style={{
                              marginTop: "4px",
                              fontSize: "10px",
                              color: "#c62828",
                              fontWeight: "bold",
                              backgroundColor: "#ffcdd2",
                              display: "inline-block",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              border: "1px solid #e53935",
                            }}
                          >
                            🚨 Offline - Showing Saved Data
                          </div>
                        )
                      )}

                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          marginTop: "6px",
                          fontSize: "10px",
                          color: "#1a73e8",
                          cursor:
                            row.role === "leader" ? "not-allowed" : "pointer",
                          backgroundColor: "#e8f0fe",
                          padding: "3px 5px",
                          borderRadius: "4px",
                          border: "1px solid #bbdefb",
                          width: "fit-content",
                          fontWeight: "bold",
                          opacity: row.role === "leader" ? 0.7 : 1,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={
                            selfRatedMap[row.email] || row.role === "leader"
                          }
                          onChange={(e) => {
                            if (row.role !== "leader")
                              handleSelfRatedChange(row.email, e.target.checked);
                          }}
                          disabled={row.role === "leader"}
                          style={{
                            width: "11px",
                            height: "11px",
                            cursor:
                              row.role === "leader" ? "not-allowed" : "pointer",
                            margin: 0,
                          }}
                        />
                        ⭐ Rated by Me
                      </label>
                    </td>
                    {row.weeklyTotals.map((w, i) => (
                      <td
                        key={i}
                        style={{
                          ...cellStyle,
                          backgroundColor:
                            i % 2 === 0 ? "#f8f9fa" : "transparent",
                          color: getWeekColor(w.mints, w.scnds, false)
                        }}
                      >
                        {formatHMS(w.mints, w.scnds)}
                      </td>
                    ))}
                   <td style={{ ...cellStyle, backgroundColor: '#fff9c4', color: monthColor, fontWeight: 'bold' }}>
  {formatHMS(row.monthMints, row.monthScnds)}
</td>
                    <td
                      style={{
                        ...cellStyle,
                        color: monthColor,
                        fontWeight: "bold",
                        fontSize: "14px",
                      }}
                    >
                      {row.decimalHours.toFixed(2)}
                    </td>
                    {showClientPay && (
                      <>
                        <td style={cellStyle}>
                          {formatCurrency(row.clientRateINR)}
                        </td>
                        <td
                          style={{
                            ...cellStyle,
                            backgroundColor: "#e3f2fd",
                            fontWeight: "bold",
                          }}
                        >
                          {formatCurrency(row.clientPaymentINR)}
                        </td>
                      </>
                    )}
                    {showLeaderPay && (
                      <>
                        <td
                          style={{
                            ...cellStyle,
                            color: row.hitTarget ? "#7b1fa2" : "#333",
                            fontWeight: row.hitTarget ? "bold" : "normal",
                          }}
                        >
                          ₹{row.finalLeaderRate} {row.hitTarget && "⭐"}
                        </td>
                        <td
                          style={{
                            ...cellStyle,
                            backgroundColor: "#f3e5f5",
                            fontWeight: "bold",
                          }}
                        >
                          {formatCurrency(row.leaderPayment)}
                        </td>
                      </>
                    )}
                    {showRaterPay && (
                      <>
                        <td
                          style={{
                            ...cellStyle,
                            color: row.hitTarget ? "#e65100" : "#333",
                            fontWeight: row.hitTarget ? "bold" : "normal",
                          }}
                        >
                          ₹{row.finalRaterRate} {row.hitTarget && "⭐"}
                        </td>
                        <td
                          style={{
                            ...cellStyle,
                            backgroundColor:
                              selfRatedMap[row.email] || row.role === "leader"
                                ? "#f5f5f5"
                                : "#fff8e1",
                            color:
                              selfRatedMap[row.email] || row.role === "leader"
                                ? "#aaa"
                                : "#333",
                            fontWeight: "bold",
                          }}
                        >
                          {formatCurrency(row.raterPayment)}
                        </td>
                      </>
                    )}
                    {showLeaderProfit && (
                      <td
                        style={{
                          ...cellStyle,
                          backgroundColor:
                            selfRatedMap[row.email] || row.role === "leader"
                              ? "#c8e6c9"
                              : "#e6f4ea",
                          color: "#1e8e3e",
                          fontWeight: "bold",
                        }}
                      >
                        {formatCurrency(row.leaderMarginTotal)}
                      </td>
                    )}
                  </tr>
                );
              })}
              <tr style={{ backgroundColor: "#f5f5f5" }}>
                <td
                  colSpan="9"
                  style={{
                    ...cellStyle,
                    border: "none",
                    textAlign: "right",
                    fontStyle: "italic",
                    color: "#666",
                  }}
                >
                  Subtotal:
                </td>
                <td style={{ ...cellStyle, color: "#333", fontWeight: "bold" }}>
                  {groupTotals.decHrs.toFixed(2)}
                </td>
                {showClientPay && (
                  <>
                    <td style={{ border: "none" }}></td>
                    <td
                      style={{
                        ...cellStyle,
                        color: "#1976d2",
                        fontWeight: "bold",
                      }}
                    >
                      {formatCurrency(groupTotals.clientINR)}
                    </td>
                  </>
                )}
                {showLeaderPay && (
                  <>
                    <td style={{ border: "none" }}></td>
                    <td
                      style={{
                        ...cellStyle,
                        color: "#7b1fa2",
                        fontWeight: "bold",
                      }}
                    >
                      {formatCurrency(groupTotals.ldrPay)}
                    </td>
                  </>
                )}
                {showRaterPay && (
                  <>
                    <td style={{ border: "none" }}></td>
                    <td
                      style={{
                        ...cellStyle,
                        color: "#e65100",
                        fontWeight: "bold",
                      }}
                    >
                      {formatCurrency(groupTotals.rtrPay)}
                    </td>
                  </>
                )}
                {showLeaderProfit && (
                  <td
                    style={{
                      ...cellStyle,
                      color: "#1e8e3e",
                      fontWeight: "bold",
                    }}
                  >
                    {formatCurrency(groupTotals.ldrMargin)}
                  </td>
                )}
              </tr>
            </React.Fragment>
          );
        })}
        <tr style={{ borderTop: "4px solid #333" }}>
          <td
            colSpan="9"
            style={{
              ...cellStyle,
              border: "none",
              textAlign: "right",
              fontWeight: "bold",
              fontSize: "14px",
            }}
          >
            GRAND TOTAL:
          </td>
          <td
            style={{
              ...cellStyle,
              backgroundColor: "#fce8b2",
              fontWeight: "bold",
              fontSize: "15px",
            }}
          >
            {grandTotals.decHrs.toFixed(2)}
          </td>
          {showClientPay && (
            <>
              <td style={{ border: "none" }}></td>
              <td
                style={{
                  ...cellStyle,
                  backgroundColor: "#1976d2",
                  color: "#fff",
                  fontWeight: "bold",
                }}
              >
                {formatCurrency(grandTotals.clientINR)}
              </td>
            </>
          )}
          {showLeaderPay && (
            <>
              <td style={{ border: "none" }}></td>
              <td
                style={{
                  ...cellStyle,
                  backgroundColor: "#7b1fa2",
                  color: "#fff",
                  fontWeight: "bold",
                }}
              >
                {formatCurrency(grandTotals.ldrPay)}
              </td>
            </>
          )}
          {showRaterPay && (
            <>
              <td style={{ border: "none" }}></td>
              <td
                style={{
                  ...cellStyle,
                  backgroundColor: "#e65100",
                  color: "#fff",
                  fontWeight: "bold",
                }}
              >
                {formatCurrency(grandTotals.rtrPay)}
              </td>
            </>
          )}
          {showLeaderProfit && (
            <td
              style={{
                ...cellStyle,
                backgroundColor: "#1e8e3e",
                color: "#fff",
                fontWeight: "bold",
              }}
            >
              {formatCurrency(grandTotals.ldrMargin)}
            </td>
          )}
        </tr>
      </tbody>
    </table>
  );

  return isCoAdmin ? renderCoAdminTable() : renderLeaderTable();
}