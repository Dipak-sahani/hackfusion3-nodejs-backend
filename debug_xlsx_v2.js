import XLSX from 'xlsx';
import fs from 'fs';

try {
    const filePath = 'e:/HackFusion/2026/codebase/product data.xlsx';
    const fileBuffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    fs.writeFileSync('e:/HackFusion/2026/codebase/core-node/headers_debug.json', JSON.stringify({
        headers: data[0],
        sample: data[1]
    }, null, 2));
} catch (err) {
    console.error(err);
}
