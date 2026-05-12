const XLSX = require('xlsx');

const workbook = XLSX.readFile('i:\\APLICACIONES\\SINDICATO\\CREDENCIALES\\RECURSOS\\BASE DE DATOS SINDICATO JUAREZ, N.L.2026.xlsx');
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(sheet, { range: 0 }); // Assuming headers are in row 1

console.log("Master DB Headers:", Object.keys(data[0]));
console.log("Sample Master DB Row:", data[0]);
