// ==========================================
// 1. SERVER SETUP & IMPORTS
// ==========================================
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library'); 

const app = express();
app.use(cors());
app.use(express.json());

// ==========================================
// 2. GOOGLE SHEETS AUTHENTICATION
// ==========================================
const getAuth = () => new JWT({
  email: process.env.VITE_FIREBASE_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: (process.env.VITE_FIREBASE_PRIVATE_KEY || process.env.GOOGLE_PRIVATE_KEY).replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const getColumnIndex = (day, monthIndex, year) => {
    const dow = new Date(year, monthIndex, day).getDay(); 
    const firstDayOfMonth = new Date(year, monthIndex, 1).getDay();
    const weekIndex = Math.floor((day - 1 + firstDayOfMonth) / 7);
    return 2 + (weekIndex * 15) + (dow * 2);
};

// ==========================================
// 3. FETCH BILLING DATA FROM FIRESTORE (UPDATED)
// ==========================================
async function getBillingData(accountEmail) {
  try {
    const projectId = process.env.VITE_FIREBASE_PROJECT_ID || "excel-hrs"; 
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${accountEmail}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data && data.fields && data.fields.billing && data.fields.billing.mapValue && data.fields.billing.mapValue.fields) {
      const b = data.fields.billing.mapValue.fields;
      return {
        // 💡 NOW USING THE NEW DATABASE VARIABLES
        hasBonus: b.hasBonus ? b.hasBonus.booleanValue : false,
        bonusTargetHours: b.bonusTargetHours ? Number(b.bonusTargetHours.integerValue || b.bonusTargetHours.doubleValue || 0) : 0,
        raterRate: b.raterRate ? Number(b.raterRate.integerValue || b.raterRate.doubleValue || 0) : 0,
        raterBonusRate: b.raterBonusRate ? Number(b.raterBonusRate.integerValue || b.raterBonusRate.doubleValue || 0) : 0
      };
    }
  } catch (err) {
    console.error("Error fetching billing info from Firestore:", err);
  }
  return {};
}

// ==========================================
// 4. AUTO-BUILDER FUNCTION
// ==========================================
async function autoBuildNewMonth(sheetId, monthKey, accountName) {
  const doc = new GoogleSpreadsheet(sheetId, getAuth());
  await doc.loadInfo();
  
  let sheet = Object.values(doc.sheetsByTitle).find(s => s.title.toLowerCase() === monthKey.toLowerCase());
  if (sheet) return { sheet, doc }; 

  console.log(`Auto-building perfectly aligned grid for ${monthKey}...`);
  const masterDoc = new GoogleSpreadsheet(process.env.MASTER_FILE_ID, getAuth());
  await masterDoc.loadInfo();
  const masterTemplate = masterDoc.sheetsByTitle['SMART_TEMPLATE'];
  if (!masterTemplate) throw new Error("SMART_TEMPLATE missing!");

  const copiedData = await masterTemplate.copyToSpreadsheet(sheetId);
  await doc.loadInfo(); 
  sheet = doc.sheetsById[copiedData.sheetId];
  await sheet.updateProperties({ title: monthKey });

  const [monthName, yearStr] = monthKey.split(' ');
  const monthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
  const monthIndex = monthNames.indexOf(monthName.toLowerCase());
  const year = parseInt(yearStr, 10);
  
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, monthIndex, 1).getDay();
  const totalWeeksNeeded = Math.ceil((firstDayOfWeek + lastDay) / 7);

  await sheet.loadCells('A1:CQ30'); 
  sheet.getCell(3, 1).value = 'Account Name'; 
  sheet.getCell(4, 1).value = accountName;    

  // ----------------------------------------------------
  // 💡 INJECT DYNAMIC PAYROLL LOGIC INTO CELL CQ5
  // ----------------------------------------------------
  const billing = await getBillingData(accountName);
  const hasBonus = billing.hasBonus || false;
  const targetHrs = billing.bonusTargetHours || 0;
  const baseRate = billing.raterRate || 0;
  const bonusRate = billing.raterBonusRate || 0;

  const cq5Cell = sheet.getCellByA1('CQ5');

  if (hasBonus && targetHrs > 0 && bonusRate > 0) {
      // Scenario A: Bonus is toggled ON and targets exist!
      const dynamicFormula = `=ARRAYFORMULA(LET(weeks, {Q5, AF5, AU5, BJ5, BY5, CN5}, secs, MAP(weeks, LAMBDA(w, IF(OR(w="", w="0 h 0 m 0 s"), 0, LET(t, SUBSTITUTE(w, " ", ""), h, IFERROR(VALUE(LEFT(t, FIND("h", t)-1)), 0), m, IFERROR(VALUE(MID(t, FIND("h", t)+1, FIND("m", t)-FIND("h", t)-1)), 0), s, IFERROR(VALUE(MID(t, FIND("m", t)+1, FIND("s", t)-FIND("m", t)-1)), 0), h*3600 + m*60 + s)))), total_secs, SUM(secs), decimal_hours, total_secs / 3600, payrate, IF(decimal_hours >= ${targetHrs}, ${bonusRate}, ${baseRate}), payrate))`;
      cq5Cell.formula = dynamicFormula;
  } else if (baseRate > 0) {
      // Scenario B: Fixed rate only. No bonus tracking needed.
      cq5Cell.value = baseRate;
  } else {
      // Scenario C: Unpaid or undefined
      cq5Cell.value = "N/A";
  }
  // ----------------------------------------------------

  let dayCounter = 1;
  for (let w = 0; w < 6; w++) {
      const weekStartCol = 2 + (w * 15);
      const isWeekNeeded = w < totalWeeksNeeded;

      for (let d = 0; d < 7; d++) {
          const col = weekStartCol + (d * 2);
          const isPadDayBefore = (w === 0 && d < firstDayOfWeek);
          const isPadDayAfter = (dayCounter > lastDay);

          if (isWeekNeeded && !isPadDayBefore && !isPadDayAfter) {
              sheet.getCell(2, col).value = `${dayCounter}/${monthIndex + 1}/${year}`;
              dayCounter++;
          } else {
              sheet.getCell(2, col).value = null;    
              sheet.getCell(3, col).value = null;    
              sheet.getCell(3, col + 1).value = null; 
              sheet.getCell(24, col).value = null; 
              sheet.getCell(24, col + 1).value = null;
          }
      }
  }
  await sheet.saveUpdatedCells();
  return { sheet, doc };
}

// ==========================================
// 5. CORE DATA ROUTES (Raters)
// ==========================================
app.get('/api/get-hrs', async (req, res) => {
  try {
    const { accountName, monthKey, sheetId } = req.query; 
    if (!sheetId) return res.status(400).json({ error: 'No Spreadsheet ID provided.' });

    const doc = new GoogleSpreadsheet(sheetId, getAuth());
    
    try {
      await doc.loadInfo();
    } catch (err) {
      console.warn(`[GET-HRS] File deleted or missing for ${accountName}`);
      return res.status(404).json({ error: 'SHEET_MISSING', message: 'Spreadsheet file deleted.' });
    }

    // 💡 THE NEW FIX: Stop reading if the file has been renamed to [DISABLED]
    if (doc.title.startsWith('[DISABLED]')) {
        console.warn(`[GET-HRS] Blocked sync for disabled account ${accountName}`);
        return res.status(403).json({ error: 'DISABLED', message: 'Account is locked.' });
    }

    const sheet = Object.values(doc.sheetsByTitle).find(s => s.title.toLowerCase() === monthKey.toLowerCase());
    if (!sheet) {
      console.warn(`[GET-HRS] Month tab missing for ${accountName}`);
      return res.status(404).json({ error: 'SHEET_MISSING', message: 'Month tab is missing.' });
    }

    await sheet.loadCells('A1:CQ30'); 

    const [monthName, yearStr] = monthKey.split(' ');
    const monthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
    const monthIndex = monthNames.indexOf(monthName.toLowerCase());
    const year = parseInt(yearStr, 10);
    const lastDay = new Date(year, monthIndex + 1, 0).getDate();

    let gridData = [];
    for (let day = 1; day <= lastDay; day++) {
      const colIndex = getColumnIndex(day, monthIndex, year);
      const dateStr = `${day}/${monthIndex + 1}/${year}`;
      let entries = [];
      let totalMints = 0; let totalScnds = 0;

      for (let r = 4; r <= 23; r++) {
          const m = sheet.getCell(r, colIndex).value;
          const s = sheet.getCell(r, colIndex + 1).value;
          if (typeof m === 'number' || typeof s === 'number') { 
              entries.push({ mints: m || 0, scnds: s || 0, row: r });
              totalMints += (m || 0); totalScnds += (s || 0); 
          }
      }
      gridData.push({ date: dateStr, entries, totalMints, totalScnds });
    }
    res.status(200).json({ gridData });
  } catch (error) {
    console.error("GET-HRS CRITICAL ERROR:", error);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});


app.post('/api/create-sheet', async (req, res) => {
  try {
    const { accountName, monthKey, sheetId, backupData } = req.body;
    
    // 1. Create the new tab and set the formulas
    const { sheet } = await autoBuildNewMonth(sheetId, monthKey, accountName);
    
    // 2. 💡 IF BACKUP DATA EXISTS, RESTORE THE HOURS!
    if (backupData && backupData.length > 0) {
        console.log(`Restoring backup data for ${accountName}...`);
        await sheet.loadCells('A1:CQ30');
        
        const [monthName, yearStr] = monthKey.split(' ');
        const monthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
        const monthIndex = monthNames.indexOf(monthName.toLowerCase());
        const year = parseInt(yearStr, 10);

        // Loop through the Firebase backup and inject it into the cells
        backupData.forEach(dayData => {
            if (!dayData.entries || dayData.entries.length === 0) return;
            
            const day = parseInt(dayData.date.split('/')[0], 10);
            const colIndex = getColumnIndex(day, monthIndex, year);
            
            dayData.entries.forEach(entry => {
                if (entry.row && (entry.mints > 0 || entry.scnds > 0)) {
                    sheet.getCell(entry.row, colIndex).value = entry.mints;
                    sheet.getCell(entry.row, colIndex + 1).value = entry.scnds;
                }
            });
        });
        
        await sheet.saveUpdatedCells();
        console.log(`Backup successfully restored for ${accountName}!`);
    }

    res.status(200).json({ message: 'Sheet created and ready.' });
  } catch (error) {
    console.error("❌ CREATE/RESTORE SHEET FAILED:", error.message);
    res.status(500).json({ error: `Server failed: ${error.message}` });
  }
});

app.post('/api/update-hrs', async (req, res) => {
  try {
    const { accountName, monthKey, date, mints, scnds, sheetId } = req.body;
    
    const doc = new GoogleSpreadsheet(sheetId, getAuth());
    await doc.loadInfo();

    // 💡 THE LOCK: Reject the save if the file is disabled!
    if (doc.title.startsWith('[DISABLED]')) {
        return res.status(403).json({ error: 'This account is DISABLED. Data syncing is locked.' });
    }
    
    const sheet = Object.values(doc.sheetsByTitle).find(s => s.title.toLowerCase() === monthKey.toLowerCase());
    
    if (!sheet) return res.status(404).json({ error: `Could not find the sheet tab for ${monthKey}` });

    try {
        await sheet.loadCells('A1:CQ30');
    } catch (cellError) {
        return res.status(500).json({ error: 'Google Sheet template is too small. Please expand it to column CQ.' });
    }
    
    const [day, month, year] = date.split('/');
    const targetCol = getColumnIndex(parseInt(day), parseInt(month)-1, parseInt(year));

    let targetRow = -1;
    for(let r = 4; r <= 23; r++) {
        const mCell = sheet.getCell(r, targetCol).value;
        const sCell = sheet.getCell(r, targetCol + 1).value;
        if((mCell === null || mCell === '') && (sCell === null || sCell === '')) { targetRow = r; break; }
    }
    
    if (targetRow === -1) return res.status(400).json({ error: 'Maximum 20 entries reached for this day!' });

    sheet.getCell(targetRow, targetCol).value = mints !== '' ? Number(mints) : null;
    sheet.getCell(targetRow, targetCol + 1).value = scnds !== '' ? Number(scnds) : null;
    
    await sheet.saveUpdatedCells();
    res.status(200).json({ message: 'Added!' });

  } catch (error) {
    console.error("❌ UPDATE CRASHED:", error.message);
    res.status(500).json({ error: `Server failed: ${error.message}` });
  }
});

app.post('/api/modify-hr', async (req, res) => {
  try {
    const { monthKey, date, rowIndex, action, mints, scnds, sheetId } = req.body;
    const doc = new GoogleSpreadsheet(sheetId, getAuth());
    await doc.loadInfo();

    // 💡 THE LOCK: Reject the edit if the file is disabled!
    if (doc.title.startsWith('[DISABLED]')) {
        return res.status(403).json({ error: 'This account is DISABLED. Modifications are locked.' });
    }
    
    const sheet = Object.values(doc.sheetsByTitle).find(s => s.title.toLowerCase() === monthKey.toLowerCase());
    if (!sheet) return res.status(404).json({ error: `Could not find the sheet tab for ${monthKey}` });

    try {
        await sheet.loadCells('A1:CQ30');
    } catch (cellError) {
        return res.status(500).json({ error: 'Google Sheet template is too small.' });
    }
    
    const [day, month, year] = date.split('/');
    const targetCol = getColumnIndex(parseInt(day), parseInt(month)-1, parseInt(year));

    if (action === 'delete') {
        sheet.getCell(rowIndex, targetCol).value = null;
        sheet.getCell(rowIndex, targetCol + 1).value = null;
    } else if (action === 'edit') {
        sheet.getCell(rowIndex, targetCol).value = mints !== '' ? Number(mints) : null;
        sheet.getCell(rowIndex, targetCol + 1).value = scnds !== '' ? Number(scnds) : null;
    }
    await sheet.saveUpdatedCells();
    res.status(200).json({ message: 'Modified!' });
  } catch (error) {
    console.error("❌ MODIFY CRASHED:", error.message);
    res.status(500).json({ error: `Server failed: ${error.message}` });
  }
});

app.post('/api/modify-hr', async (req, res) => {
  try {
    const { monthKey, date, rowIndex, action, mints, scnds, sheetId } = req.body;
    const doc = new GoogleSpreadsheet(sheetId, getAuth());
    await doc.loadInfo();
    
    // 💡 FIX 4: Safety net added here too so editing/deleting doesn't crash!
    const sheet = Object.values(doc.sheetsByTitle).find(s => s.title.toLowerCase() === monthKey.toLowerCase());
    if (!sheet) return res.status(404).json({ error: `Could not find the sheet tab for ${monthKey}` });

    try {
        await sheet.loadCells('A1:CQ30');
    } catch (cellError) {
        return res.status(500).json({ error: 'Google Sheet template is too small.' });
    }
    
    const [day, month, year] = date.split('/');
    const targetCol = getColumnIndex(parseInt(day), parseInt(month)-1, parseInt(year));

    if (action === 'delete') {
        sheet.getCell(rowIndex, targetCol).value = null;
        sheet.getCell(rowIndex, targetCol + 1).value = null;
    } else if (action === 'edit') {
        sheet.getCell(rowIndex, targetCol).value = mints !== '' ? Number(mints) : null;
        sheet.getCell(rowIndex, targetCol + 1).value = scnds !== '' ? Number(scnds) : null;
    }
    await sheet.saveUpdatedCells();
    res.status(200).json({ message: 'Modified!' });
  } catch (error) {
    console.error("❌ MODIFY CRASHED:", error.message);
    res.status(500).json({ error: `Server failed: ${error.message}` });
  }
});

// ==========================================
// 6. ADMIN "GOD MODE" ROUTES
// ==========================================
app.post('/api/admin/create-sheet', async (req, res) => {
  try {
    const { newEmail } = req.body;

    const doc = new GoogleSpreadsheet('', getAuth());
    const newDoc = await doc.createNewSpreadsheetDocument({ title: `Telus Timesheet - ${newEmail}` });
    const newSheetId = newDoc.spreadsheetId;

    const masterDoc = new GoogleSpreadsheet(process.env.MASTER_FILE_ID, getAuth());
    await masterDoc.loadInfo();
    const masterTemplate = masterDoc.sheetsByTitle['SMART_TEMPLATE'];

    await masterTemplate.copyToSpreadsheet(newSheetId);

    res.status(200).json({ spreadsheetId: newSheetId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate new Google Sheet' });
  }
});

// ==========================================
// 7. START THE SERVER
// ==========================================
const PORT = process.env.PORT || 5000;

// ==========================================
// 8. AUTOMATED MONTHLY SHEET GENERATOR
// ==========================================
const cron = require('node-cron');

// 💡 Schedule: Run at 18:00 (06:00 PM) every single day in India time.
cron.schedule('0 18 * * *', async () => {
    
    // 💡 TIMEZONE FIX: Force the date calculation to use India Standard Time
    // This prevents bugs if your online server is hosted in the US or Europe (UTC)
    const istDateString = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    const today = new Date(istDateString);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    // Check if tomorrow is the 1st of the month (meaning today is the absolute last day)
    if (tomorrow.getDate() === 1) {
        console.log("⏰ [CRON] Last day of the month detected in IST! Starting Auto-Generation...");

        // Calculate the string for NEXT month (e.g., "June 2026")
        const nextMonthIndex = tomorrow.getMonth(); 
        const nextYear = tomorrow.getFullYear();
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const nextMonthKey = `${monthNames[nextMonthIndex]} ${nextYear}`;

        try {
            // 1. Fetch all users from Firestore
            const projectId = process.env.VITE_FIREBASE_PROJECT_ID || "excel-hrs"; 
            const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users`;
            
            const response = await fetch(url);
            const data = await response.json();

            if (!data.documents) {
                console.log("⚠️ [CRON] No users found in database.");
                return;
            }

            console.log(`🚀 [CRON] Found ${data.documents.length} accounts. Building sheets for ${nextMonthKey}...`);

            // 2. Loop through every user and auto-build their sheet
            for (const doc of data.documents) {
                // Extract the email from the end of the Firebase document path
                const accountEmail = doc.name.split('/').pop(); 
                const fields = doc.fields || {};
                
                // Get the sheetId (checking if it exists and is a valid string)
                const sheetId = fields.sheetId ? fields.sheetId.stringValue : null;

                // Only generate if they have a real Google Sheet assigned
                if (sheetId && sheetId.length > 5 && sheetId !== 'MASTER_ADMIN') {
                    try {
                        console.log(`⏳ Building for ${accountEmail}...`);
                        // Call your existing Auto-Builder function!
                        await autoBuildNewMonth(sheetId, nextMonthKey, accountEmail);
                        console.log(`✅ Success: ${accountEmail}`);
                    } catch (err) {
                        console.error(`❌ Failed for ${accountEmail}:`, err.message);
                    }
                    
                    // Add a tiny 2-second delay between creations so Google API doesn't rate-limit you
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
            console.log(`🎉 [CRON] Monthly Auto-Generation Complete for ${nextMonthKey}!`);

        } catch (error) {
            console.error("🔥 [CRON] CRITICAL ERROR during automated generation:", error);
        }
    } else {
        console.log(`[CRON] Today (${today.getDate()}) is not the last day of the month. Skipping generation.`);
    }
}, {
    scheduled: true,
    timezone: "Asia/Kolkata" 
});


app.post('/api/toggle-sheet-lock', async (req, res) => {
  try {
    const { sheetId, lock } = req.body;
    if (!sheetId) return res.status(400).json({ error: 'No sheet ID' });

    const doc = new GoogleSpreadsheet(sheetId, getAuth());
    await doc.loadInfo();

    // 💡 THE FIX: Rename the entire file in Google Drive to show it is disabled.
    // This is 100% supported by the library and won't break your TeamViewer month tabs!
    const currentTitle = doc.title;
    let newTitle = currentTitle;

    if (lock && !currentTitle.startsWith('[DISABLED]')) {
        newTitle = `[DISABLED] ${currentTitle}`;
    } else if (!lock && currentTitle.startsWith('[DISABLED]')) {
        newTitle = currentTitle.replace('[DISABLED] ', '');
    }

    // Only update if the title actually needs to change
    if (newTitle !== currentTitle) {
        await doc.updateProperties({ title: newTitle });
    }
    
    res.status(200).json({ message: `Sheet locked status: ${lock}` });
  } catch (error) {
    console.error("Failed to toggle sheet lock:", error.message);
    res.status(500).json({ error: 'Server error' });
  }
});



// ==========================================
// 9. START THE SERVER
// ==========================================
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));