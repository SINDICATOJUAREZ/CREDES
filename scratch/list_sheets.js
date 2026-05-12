const XLSX = require('xlsx');

const MASTER_DB_PATH = 'i:\\APLICACIONES\\SINDICATO\\CREDENCIALES\\RECURSOS\\BASE DE DATOS SINDICATO JUAREZ, N.L.2026.xlsx';
const workbook = XLSX.readFile(MASTER_DB_PATH);

console.log("Sheets in Master DB:", workbook.SheetNames);
