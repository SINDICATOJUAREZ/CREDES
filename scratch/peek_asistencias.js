const XLSX = require('xlsx');

const workbook = XLSX.readFile('i:\\APLICACIONES\\SINDICATO\\CREDENCIALES\\ASISTENCIAS\\ASISTENCIAS_UNIFICADO.xlsx');
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(sheet);

const cases = ['CINDDY', 'CINNDY', 'EULALIO', 'FAUSTO', 'CESAR SALDIVAR'];
const matches = data.filter(row => {
    const name = (row['Nombre'] || row['NOMBRE'] || '').toUpperCase();
    return cases.some(c => name.includes(c));
});

console.log(JSON.stringify(matches.map(r => ({
    Nomina: r['Nomina'] || r['NOMINA'],
    Nombre: r['Nombre'] || r['NOMBRE'],
    Estatus: r['Estatus'] || r['ESTATUS']
})), null, 2));
