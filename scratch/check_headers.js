const XLSX = require('xlsx');
const excelPath = 'i:\\APLICACIONES\\SINDICATO\\CREDENCIALES\\ASISTENCIAS\\ASISTENCIAS_UNIFICADO.xlsx';
const workbook = XLSX.readFile(excelPath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
console.log(rawData[0].slice(0, 10));
