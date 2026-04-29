require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library'); 

const ratersMap = require('./raters.json'); 

const app = express();
app.use(cors());
app.use(express.json());

const getAuth = () => new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const getColumnIndex = (day, monthIndex, year) => {
    const dow = new Date(year, monthIndex, day).getDay(); 
    const firstDayOfMonth = new Date(year, monthIndex, 1).getDay();
    const weekIndex = Math.floor((day - 1 + firstDayOfMonth) / 7);
    return 2 + (weekIndex * 15) + (dow * 2);
};

// AUTO-BUILDER
async function autoBuildNewMonth(sheetId, monthKey, accountName) {
  const doc = new GoogleSpreadsheet(sheetId, getAuth());
  await doc.loadInfo();
  
  let sheet = doc.sheetsByTitle[monthKey]; 
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
  const monthIndex = monthNames.indexOf(monthName);
  const year = parseInt(yearStr, 10);
  
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, monthIndex, 1).getDay();
  const totalWeeksNeeded = Math.ceil((firstDayOfWeek + lastDay) / 7);

  await sheet.loadCells('A1:CQ30'); 
  sheet.getCell(3, 1).value = 'Account Name'; 
  sheet.getCell(4, 1).value = accountName;    

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

// GET DATA
app.get('/api/get-hrs', async (req, res) => {
  try {
    const { accountName, monthKey } = req.query;
    const sheetId = ratersMap[accountName];
    if (!sheetId) return res.status(404).json({ error: 'Rater not found.' });

    const { sheet } = await autoBuildNewMonth(sheetId, monthKey, accountName);
    await sheet.loadCells('A1:CQ30'); 

    const [monthName, yearStr] = monthKey.split(' ');
    const monthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
    const monthIndex = monthNames.indexOf(monthName);
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
              // We pass 'row: r' to React so React knows exactly which row to edit/delete!
              entries.push({ mints: m || 0, scnds: s || 0, row: r });
              totalMints += (m || 0); 
              totalScnds += (s || 0); 
          }
      }
      
      gridData.push({ date: dateStr, entries: entries, totalMints: totalMints, totalScnds: totalScnds });
    }
    res.status(200).json({ spreadsheetId: sheetId, gridData: gridData });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

// ADD NEW ENTRY
app.post('/api/update-hrs', async (req, res) => {
  try {
    const { accountName, monthKey, date, mints, scnds } = req.body;
    const sheetId = ratersMap[accountName];
    const doc = new GoogleSpreadsheet(sheetId, getAuth());
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle[monthKey];
    
    await sheet.loadCells('A1:CQ30');
    
    const [day, month, year] = date.split('/');
    const targetCol = getColumnIndex(parseInt(day), parseInt(month)-1, parseInt(year));

    let targetRow = -1;
    for(let r = 4; r <= 23; r++) {
        const mCell = sheet.getCell(r, targetCol).value;
        const sCell = sheet.getCell(r, targetCol + 1).value;
        if((mCell === null || mCell === '') && (sCell === null || sCell === '')) { 
            targetRow = r; break; 
        }
    }

    if (targetRow === -1) return res.status(400).json({ error: 'Maximum 20 entries reached!' });

    sheet.getCell(targetRow, targetCol).value = mints !== '' ? Number(mints) : null;
    sheet.getCell(targetRow, targetCol + 1).value = scnds !== '' ? Number(scnds) : null;
    
    await sheet.saveUpdatedCells();
    res.status(200).json({ message: 'Added!' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save row' });
  }
});

// 💡 NEW: EDIT OR DELETE AN EXACT ROW
app.post('/api/modify-hr', async (req, res) => {
  try {
    const { accountName, monthKey, date, rowIndex, action, mints, scnds } = req.body;
    const sheetId = ratersMap[accountName];
    const doc = new GoogleSpreadsheet(sheetId, getAuth());
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle[monthKey];
    
    await sheet.loadCells('A1:CQ30');
    
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
    res.status(500).json({ error: 'Failed to modify row' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));