const XLSX = require('xlsx');
const UNIFICADO_PATH = 'i:\\APLICACIONES\\SINDICATO\\CREDENCIALES\\ASISTENCIAS\\ASISTENCIAS_UNIFICADO.xlsx';
const workbook = XLSX.readFile(UNIFICADO_PATH);
const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

const noRegistrados = data.filter(r => r.Estatus === 'NO REGISTRADO');
console.log(`Total NO REGISTRADO remaining: ${noRegistrados.length}`);
if (noRegistrados.length > 0) {
    console.log("Sample NO REGISTRADO:");
    console.log(JSON.stringify(noRegistrados.slice(0, 10).map(r => ({ Nomina: r.Nomina, Nombre: r.Nombre })), null, 2));
}
