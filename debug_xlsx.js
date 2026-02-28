import XLSX from 'xlsx';
import fs from 'fs';

try {
    const filePath = 'e:/HackFusion/2026/codebase/product data.xlsx';
    if (!fs.existsSync(filePath)) {
        console.error('File does not exist:', filePath);
        process.exit(1);
    }
    const fileBuffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (data.length > 0) {
        console.log('Headers:', JSON.stringify(data[0]));
        console.log('Sample Row 1:', JSON.stringify(data[1]));
        console.log('Sample Row 2:', JSON.stringify(data[2]));
        console.log('Sample Row 3:', JSON.stringify(data[3]));
    } else {
        console.log('No data found in the spreadsheet.');
    }
} catch (err) {
    console.error('Error reading excel file:', err.message);
}
