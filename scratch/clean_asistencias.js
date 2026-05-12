const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const baseDbPath = 'I:\\APLICACIONES\\SINDICATO\\CREDENCIALES\\RECURSOS\\BASE DE DATOS SINDICATO JUAREZ, N.L.2026.xlsx';
const unifiedPath = 'I:\\APLICACIONES\\SINDICATO\\CREDENCIALES\\ASISTENCIAS\\ASISTENCIAS_UNIFICADO.xlsx';

function normalizeName(name) {
  if (!name) return '';
  return name.toString().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ' ').trim();
}

console.log('Leyendo base de datos maestra...');
const baseWb = xlsx.readFile(baseDbPath);
const baseWs = baseWb.Sheets[baseWb.SheetNames[0]];
const baseData = xlsx.utils.sheet_to_json(baseWs);

const baseByNomina = new Map();
const baseByName = new Map();

baseData.forEach(row => {
  const nomina = row['# EMPLEADO'];
  const name = row['NOMBRE COMPLETO'];
  const status = row['STATUS'];
  
  if (nomina) {
    baseByNomina.set(String(nomina).trim(), { nomina, name, status });
  }
  if (name) {
    baseByName.set(normalizeName(name), { nomina, name, status });
  }
});

console.log('Leyendo archivo unificado...');
const unifiedWb = xlsx.readFile(unifiedPath);
const unifiedWs = unifiedWb.Sheets[unifiedWb.SheetNames[0]];
const unifiedData = xlsx.utils.sheet_to_json(unifiedWs);

// 1. Group by Normalized Name to catch duplicates within the unified file
const groupsByName = new Map();

unifiedData.forEach(row => {
  const normName = normalizeName(row.NOMBRE);
  if (!groupsByName.has(normName)) {
    groupsByName.set(normName, []);
  }
  groupsByName.get(normName).push(row);
});

console.log(`Detectados ${groupsByName.size} agremiados únicos (por nombre).`);

const finalData = [];
const eventColsSet = new Set();

groupsByName.forEach((rows, normName) => {
  // We have 1 or more rows for this person
  // We need to determine the TRUE Nomina, Name, and Status.
  let trueNomina = null;
  let trueName = null;
  let trueStatus = null;
  
  // A) Check if any of the given Nominas exist in the Base DB
  for (const row of rows) {
    const n = String(row.NOMINA).trim();
    if (baseByNomina.has(n)) {
      const baseEntry = baseByNomina.get(n);
      trueNomina = baseEntry.nomina;
      trueName = baseEntry.name;
      trueStatus = baseEntry.status;
      break;
    }
  }
  
  // B) If not found by Nomina, try by Name
  if (!trueNomina && baseByName.has(normName)) {
    const baseEntry = baseByName.get(normName);
    trueNomina = baseEntry.nomina;
    trueName = baseEntry.name;
    trueStatus = baseEntry.status;
  }
  
  // C) If still not found, we just use the first row's data but we keep it
  if (!trueNomina) {
    trueNomina = rows[0].NOMINA;
    trueName = rows[0].NOMBRE;
    trueStatus = rows[0].STATUS;
  }
  
  // Merge all events
  const mergedEvents = new Set();
  rows.forEach(row => {
    Object.keys(row).forEach(k => {
      if (k !== 'NOMINA' && k !== 'NOMBRE' && k !== 'STATUS') {
        if (row[k] === '*') {
          mergedEvents.add(k);
          eventColsSet.add(k);
        }
      }
    });
  });
  
  const finalRow = {
    NOMINA: trueNomina,
    NOMBRE: trueName,
    STATUS: trueStatus
  };
  
  // Populate events
  mergedEvents.forEach(e => {
    finalRow[e] = '*';
  });
  
  finalData.push(finalRow);
  
  if (rows.length > 1) {
    console.log(`=> Resuelto duplicado: ${normName}`);
    console.log(`   Nóminas involucradas: ${rows.map(r => r.NOMINA).join(', ')}`);
    console.log(`   Nómina elegida: ${trueNomina}`);
  }
});

const sortedEvents = Array.from(eventColsSet).sort();

// Normalize output format
const exportData = finalData.map(row => {
  const r = { NOMINA: row.NOMINA, NOMBRE: row.NOMBRE, STATUS: row.STATUS };
  sortedEvents.forEach(e => {
    r[e] = row[e] === '*' ? '*' : '';
  });
  return r;
});

// Sort by name
exportData.sort((a, b) => (a.NOMBRE || '').localeCompare(b.NOMBRE || ''));

const newWb = xlsx.utils.book_new();
const newWs = xlsx.utils.json_to_sheet(exportData);

// Set col widths
const colWidths = [
  { wch: 10 },
  { wch: 40 },
  { wch: 20 },
  ...sortedEvents.map(() => ({ wch: 15 }))
];
newWs['!cols'] = colWidths;

xlsx.utils.book_append_sheet(newWb, newWs, 'Asistencias_Corregidas');
xlsx.writeFile(newWb, unifiedPath);

console.log('----------------------------------------------------');
console.log('Limpieza y deduplicación completada.');
console.log(`Total registros finales: ${exportData.length}`);
console.log('Archivo actualizado:', unifiedPath);
