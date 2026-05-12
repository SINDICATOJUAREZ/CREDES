const xlsx = require('xlsx');

const baseDbPath = 'I:\\APLICACIONES\\SINDICATO\\CREDENCIALES\\RECURSOS\\BASE DE DATOS SINDICATO JUAREZ, N.L.2026.xlsx';
const unifiedPath = 'I:\\APLICACIONES\\SINDICATO\\CREDENCIALES\\ASISTENCIAS\\ASISTENCIAS_UNIFICADO.xlsx';

console.log('Cargando Base DB...');
const baseWb = xlsx.readFile(baseDbPath);
const baseWs = baseWb.Sheets[baseWb.SheetNames[0]];
const baseData = xlsx.utils.sheet_to_json(baseWs);

const baseMap = new Map();
baseData.forEach(row => {
  const nomina = row['# EMPLEADO'];
  const name = row['NOMBRE COMPLETO'];
  if (nomina && name) { // ONLY SET IF NAME EXISTS
    baseMap.set(Number(nomina), {
      name: name,
      status: row['STATUS']
    });
  }
});

console.log('Cargando Unificado...');
const unifiedWb = xlsx.readFile(unifiedPath);
const unifiedWs = unifiedWb.Sheets[unifiedWb.SheetNames[0]];
const unifiedData = xlsx.utils.sheet_to_json(unifiedWs, { defval: '' }); // Load all columns even if empty

let updated = 0;
unifiedData.forEach(row => {
  if (!row.NOMBRE || String(row.NOMBRE).trim() === '' || String(row.NOMBRE) === 'undefined') {
    const nomina = Number(row.NOMINA);
    if (baseMap.has(nomina)) {
      const dbEntry = baseMap.get(nomina);
      row.NOMBRE = dbEntry.name;
      row.STATUS = dbEntry.status || '';
      updated++;
      console.log(`Actualizado Nómina ${nomina} -> ${row.NOMBRE}`);
    }
  }
});

if (updated > 0) {
  // Sort by name just in case
  unifiedData.sort((a, b) => String(a.NOMBRE || '').localeCompare(String(b.NOMBRE || '')));

  const newWb = xlsx.utils.book_new();
  const newWs = xlsx.utils.json_to_sheet(unifiedData);
  
  // Set col widths
  const keys = Object.keys(unifiedData[0] || {});
  const colWidths = keys.map(k => {
    if (k === 'NOMINA') return { wch: 10 };
    if (k === 'NOMBRE') return { wch: 40 };
    if (k === 'STATUS') return { wch: 20 };
    return { wch: 15 };
  });
  newWs['!cols'] = colWidths;

  xlsx.utils.book_append_sheet(newWb, newWs, 'Asistencias_Corregidas');
  xlsx.writeFile(newWb, unifiedPath);
  console.log(`Guardado exitosamente. Se actualizaron ${updated} registros.`);
} else {
  console.log('No se encontraron registros sin nombre para actualizar.');
}
