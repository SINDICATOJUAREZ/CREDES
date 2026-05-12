const xlsx = require('xlsx');

const baseDbPath = 'I:\\APLICACIONES\\SINDICATO\\CREDENCIALES\\RECURSOS\\BASE DE DATOS SINDICATO JUAREZ, N.L.2026.xlsx';
const unifiedPath = 'I:\\APLICACIONES\\SINDICATO\\CREDENCIALES\\ASISTENCIAS\\ASISTENCIAS_UNIFICADO.xlsx';

function normalizeName(name) {
  if (!name) return '';
  return name.toString().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ' ').trim();
}

console.log('Cargando Base DB...');
const baseWb = xlsx.readFile(baseDbPath);
const baseWs = baseWb.Sheets[baseWb.SheetNames[0]];
const baseData = xlsx.utils.sheet_to_json(baseWs);

const baseByName = new Map();
baseData.forEach(row => {
  const name = row['NOMBRE COMPLETO'];
  if (name) {
    baseByName.set(normalizeName(name), {
      nomina: row['# EMPLEADO'],
      status: row['STATUS']
    });
  }
});

console.log('Cargando Unificado...');
const unifiedWb = xlsx.readFile(unifiedPath);
const unifiedWs = unifiedWb.Sheets[unifiedWb.SheetNames[0]];
const unifiedData = xlsx.utils.sheet_to_json(unifiedWs, { defval: '' });

let updatedStatus = 0;
const stillEmpty = [];

unifiedData.forEach(row => {
  if (!row.STATUS || String(row.STATUS).trim() === '') {
    const normName = normalizeName(row.NOMBRE);
    if (baseByName.has(normName)) {
      const dbEntry = baseByName.get(normName);
      row.STATUS = dbEntry.status;
      if (dbEntry.nomina && String(row.NOMINA) !== String(dbEntry.nomina)) {
        console.log(`Corrigiendo Nómina de ${row.NOMBRE}: ${row.NOMINA} -> ${dbEntry.nomina}`);
        row.NOMINA = dbEntry.nomina;
      }
      updatedStatus++;
      console.log(`Actualizado Status de ${row.NOMBRE} -> ${row.STATUS}`);
    } else {
      stillEmpty.push(row.NOMBRE);
    }
  }
});

// Remove column VIVIENDA BIENESTAR? The user didn't say to remove, just that they have no dates.
// If the user wants to rename columns, we can do it here. But we don't know the dates!

if (updatedStatus > 0) {
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
  console.log(`Guardado exitosamente. Se actualizaron ${updatedStatus} registros vacíos.`);
} else {
  console.log('No se encontraron coincidencias por nombre para los estatus vacíos.');
}

console.log(`Registros que aún no se encuentran en la Base DB (${stillEmpty.length}):`);
console.log(stillEmpty.slice(0, 10).join(', '));
