const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const baseDbPath = 'I:\\APLICACIONES\\SINDICATO\\CREDENCIALES\\RECURSOS\\BASE DE DATOS SINDICATO JUAREZ, N.L.2026.xlsx';
const dir = 'I:\\APLICACIONES\\SINDICATO\\CREDENCIALES\\ASISTENCIAS';
const outputPath = path.join(dir, 'ASISTENCIAS_UNIFICADO.xlsx');

function normalizeName(name) {
  if (!name) return '';
  return name.toString().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ' ').trim();
}

console.log('1. Cargando Base DB...');
const baseWb = xlsx.readFile(baseDbPath);
const baseWs = baseWb.Sheets[baseWb.SheetNames[0]];
const baseData = xlsx.utils.sheet_to_json(baseWs);

const baseByNomina = new Map();
const baseByName = new Map();

baseData.forEach(row => {
  const nomina = row['# EMPLEADO'];
  const name = row['NOMBRE COMPLETO'];
  const status = row['STATUS'] || '';
  
  if (nomina && name) {
    const entry = { nomina: Number(nomina), name: String(name).trim(), status: String(status).trim() };
    baseByNomina.set(Number(nomina), entry);
    baseByName.set(normalizeName(name), entry);
  }
});

console.log('2. Leyendo archivos de asistencias...');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.xlsx') && !f.startsWith('~') && f !== 'ASISTENCIAS_UNIFICADO.xlsx');

const rawRecords = []; // { nomina, nombre, events: { [colName]: '*' } }
const allEventNames = new Set();
const STANDARD_COLS = ['#', 'nomina', 'nombre', 'status', 'activo/etapa', 'nomina.1', 'activo/lista espera', 'fecha'];

files.forEach(f => {
  const wb = xlsx.readFile(path.join(dir, f));
  wb.SheetNames.forEach(sn => {
    const ws = wb.Sheets[sn];
    const data = xlsx.utils.sheet_to_json(ws, { header: 1 });
    if (data.length === 0) return;

    // Determinar prefijo
    let prefix = '';
    const fUpper = f.toUpperCase();
    const snUpper = sn.toUpperCase();

    if (fUpper.includes('SUTSMBJ_MASTER')) {
      if (snUpper.includes('2025') && snUpper.includes('PARTICIPACION')) prefix = 'PARTICIPACION 2025 - ';
      else if (snUpper.includes('2026') && snUpper.includes('PARTICIPACION')) prefix = 'PARTICIPACION 2026 - ';
      else if (snUpper.includes('TORNEO_2024')) prefix = 'TORNEO 2024 - ';
      else if (snUpper.includes('ANGELA')) prefix = 'TORNEO ANGELA 2025 - ';
      else if (snUpper.includes('JUNIO')) prefix = 'TORNEO JUNIO 2025 - ';
    } else {
      if (fUpper.includes('TORNEO 2024')) prefix = 'TORNEO 2024 - ';
      else if (fUpper.includes('ANGELA')) prefix = 'TORNEO ANGELA 2025 - ';
      else if (fUpper.includes('JUNIO')) prefix = 'TORNEO JUNIO 2025 - ';
      else if (fUpper.includes('2026')) prefix = 'TORNEO 2026 - ';
    }

    const headers = data[0].map(h => h ? String(h).trim() : '');
    let nominaIdx = headers.findIndex(h => h.toLowerCase() === 'nomina');
    let nombreIdx = headers.findIndex(h => h.toLowerCase() === 'nombre');

    if (nominaIdx === -1 || nombreIdx === -1) return;

    const eventColumns = [];
    headers.forEach((h, idx) => {
      if (!h) return;
      const hl = h.toLowerCase();
      if (!STANDARD_COLS.includes(hl) && idx !== nominaIdx && idx !== nombreIdx && !hl.startsWith('__empty')) {
        let colName = h.toUpperCase();
        if (prefix && !colName.includes(prefix.trim())) {
          colName = prefix + colName;
        }
        eventColumns.push({ index: idx, name: colName });
        allEventNames.add(colName);
      }
    });

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;
      
      const nomina = row[nominaIdx] ? Number(row[nominaIdx]) : null;
      const nombre = row[nombreIdx] ? String(row[nombreIdx]).trim() : '';
      
      if (!nomina && !nombre) continue;

      const events = {};
      eventColumns.forEach(ec => {
        const val = row[ec.index];
        if (val && String(val).trim() !== '') {
          events[ec.name] = '*';
        }
      });

      if (Object.keys(events).length > 0) {
        rawRecords.push({ nomina, nombre, events });
      }
    }
  });
});

console.log('3. Consolidando y resolviendo duplicados...');
// Agruparemos todo usando una clave unificada:
// Si hay nomina válida, agrupar por Nómina real resuelta en Base DB.
// Si no, intentar resolver por Nombre.
const consolidated = new Map(); // key -> { nomina, nombre, status, events }

let unidentifiedCount = 0;

rawRecords.forEach(record => {
  let finalNomina = record.nomina;
  let finalName = record.nombre;
  let finalStatus = '';
  
  let baseMatch = null;
  
  if (record.nomina && baseByNomina.has(record.nomina)) {
    baseMatch = baseByNomina.get(record.nomina);
  } else if (record.nombre && baseByName.has(normalizeName(record.nombre))) {
    baseMatch = baseByName.get(normalizeName(record.nombre));
  }
  
  if (baseMatch) {
    finalNomina = baseMatch.nomina;
    finalName = baseMatch.name;
    finalStatus = baseMatch.status;
  } else {
    // No match found in Base DB. We keep whatever we have, but status is "NO REGISTRADO"
    finalStatus = 'NO REGISTRADO';
  }
  
  // Use Final Nomina if available, otherwise fallback to normalized name.
  // If no Nomina and no Name, this is invalid, skip.
  if (!finalNomina && !normalizeName(finalName)) return;
  
  const key = finalNomina ? `N_${finalNomina}` : `NAME_${normalizeName(finalName)}`;
  
  if (!consolidated.has(key)) {
    consolidated.set(key, {
      nomina: finalNomina || '',
      nombre: finalName || '',
      status: finalStatus,
      events: new Set()
    });
  }
  
  const agg = consolidated.get(key);
  Object.keys(record.events).forEach(e => agg.events.add(e));
});

console.log('4. Generando Excel final...');
const sortedEvents = Array.from(allEventNames).sort();

const exportData = [];
consolidated.forEach(agg => {
  const row = {
    NOMINA: agg.nomina,
    NOMBRE: agg.nombre,
    STATUS: agg.status
  };
  sortedEvents.forEach(e => {
    row[e] = agg.events.has(e) ? '*' : '';
  });
  exportData.push(row);
});

exportData.sort((a, b) => String(a.NOMBRE).localeCompare(String(b.NOMBRE)));

const newWb = xlsx.utils.book_new();
const newWs = xlsx.utils.json_to_sheet(exportData);

const colWidths = [
  { wch: 10 },
  { wch: 40 },
  { wch: 20 },
  ...sortedEvents.map(() => ({ wch: 25 }))
];
newWs['!cols'] = colWidths;

xlsx.utils.book_append_sheet(newWb, newWs, 'Asistencias_Unificadas');
xlsx.writeFile(newWb, outputPath);

console.log(`Listo! Total registros finales: ${exportData.length}`);
console.log('Nombres de eventos ahora incluyen el contexto/prefijo.');
