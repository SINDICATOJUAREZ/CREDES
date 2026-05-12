const XLSX = require('xlsx');
const path = require('path');

const filePath = 'J:\\SINDICATO\\BASES DE DATOS\\BASE DE DATOS SINDICATO JUAREZ, N.L.2026.xlsx';

try {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  
  console.log('--- COLUMNS ---');
  console.log(data[0]); // Header row
  
  console.log('\n--- SAMPLE ROW ---');
  console.log(data[1]); // First data row
  
  console.log('\n--- DATA TYPES ---');
  const sample = data[1];
  data[0].forEach((col, i) => {
    console.log(`${col}: ${typeof sample[i]} (${sample[i]})`);
  });

} catch (error) {
  console.error('Error reading excel:', error.message);
}
