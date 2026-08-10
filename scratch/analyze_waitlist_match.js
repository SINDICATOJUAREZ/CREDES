const xlsx = require('xlsx');
const Database = require('better-sqlite3');
const path = require('path');

const excelPath = 'I:\\APLICACIONES\\SINDICATO\\BASE DE DATOS SINDICATO JUAREZ, N.L.2026.xlsx';
const dbPath = 'I:\\APLICACIONES\\SINDICATO\\CREDENCIALES\\database.sqlite';

const workbook = xlsx.readFile(excelPath);
const db = new Database(dbPath);

const dbMembers = db.prepare('SELECT * FROM members').all();
console.log('--- DB SYSTEM MEMBERS ---');
console.log('Total miembros en DB:', dbMembers.length);

// Mapa de miembros en DB por employee_id (como string trim) y por nombre normalizado
const dbByEmpId = new Map();
const dbByName = new Map();
const dbByCurp = new Map();

function normalizeName(name) {
  if (!name) return '';
  return String(name)
    .toUpperCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // quitar acentos
    .replace(/[^A-Z0-9\s]/g, "")
    .replace(/\s+/g, ' ')
    .trim();
}

dbMembers.forEach(m => {
  if (m.employee_id) dbByEmpId.set(String(m.employee_id).trim(), m);
  if (m.curp) dbByCurp.set(String(m.curp).trim().toUpperCase(), m);
  const norm = normalizeName(m.full_name);
  if (norm) dbByName.set(norm, m);
});

// 1. Pestaña BASE DE DATOS (ALTA SINDICATO == PENDIENTE)
const bdSheet = workbook.Sheets['BASE DE DATOS'];
const bdRows = xlsx.utils.sheet_to_json(bdSheet, { defval: '' });
const altaCol = Object.keys(bdRows[0] || {}).find(k => k.trim().toUpperCase().includes('ALTA') && k.trim().toUpperCase().includes('SINDICATO')) || 'ALTA SINDICATO';

const bdPendientes = bdRows.filter(r => {
  const val = String(r[altaCol] || '').trim().toUpperCase();
  return val === 'PENDIENTE';
});

console.log('\n--- 1. PENDIENTES EN BASE DE DATOS ---');
console.log('Total PENDIENTES en BASE DE DATOS:', bdPendientes.length);

// 2. Pestaña ETAPA 16 EN ESPERA
const e16Sheet = workbook.Sheets['ETAPA 16 EN ESPERA'];
const e16Rows = xlsx.utils.sheet_to_json(e16Sheet, { defval: '' });

// Filtrar filas válidas en ETAPA 16 EN ESPERA
const e16Lista = e16Rows.filter(r => {
  const empId = String(r['# EMPLEADO'] || '').trim();
  const name = String(r['NOMBRE COMPLETO'] || '').trim();
  return empId !== '' || name !== '';
});

console.log('\n--- 2. ETAPA 16 EN ESPERA ---');
console.log('Total filas en ETAPA 16 EN ESPERA:', e16Lista.length);

// 3. Evaluar solapamientos entre ambas pestañas del Excel
const excelWaitlistMap = new Map(); // key = employee_id o nombre normalizado

let countFromBD = 0;
let countFromE16 = 0;
let overlapBetweenSheets = 0;

// Procesar BD Pendientes
bdPendientes.forEach(r => {
  const empId = String(r['# EMPLEADO'] || '').trim();
  const name = String(r['NOMBRE COMPLETO'] || '').trim();
  const curp = String(r['CURP'] || '').trim().toUpperCase();
  const key = empId ? `EMP:${empId}` : (curp ? `CURP:${curp}` : `NAME:${normalizeName(name)}`);
  
  excelWaitlistMap.set(key, {
    source: 'BASE DE DATOS (PENDIENTE)',
    row: r
  });
  countFromBD++;
});

// Procesar Etapa 16
e16Lista.forEach(r => {
  const empId = String(r['# EMPLEADO'] || '').trim();
  const name = String(r['NOMBRE COMPLETO'] || '').trim();
  const key = empId ? `EMP:${empId}` : `NAME:${normalizeName(name)}`;
  
  if (excelWaitlistMap.has(key)) {
    overlapBetweenSheets++;
  } else {
    excelWaitlistMap.set(key, {
      source: 'ETAPA 16 EN ESPERA',
      row: r
    });
    countFromE16++;
  }
});

console.log('\n--- RESUMEN DE DUPLICADOS EN EL EXCEL ---');
console.log('Registros de BASE DE DATOS (PENDIENTE):', countFromBD);
console.log('Nuevos registros de ETAPA 16 EN ESPERA:', countFromE16);
console.log('Solapamiento entre ambas pestañas:', overlapBetweenSheets);
console.log('Total de registros únicos en Lista de Espera del Excel:', excelWaitlistMap.size);

// 4. Comparar contra la Base de Datos del Sistema (SQLite)
let existingInDbCount = 0;
let newToInsertCount = 0;
let matchByEmpId = 0;
let matchByName = 0;
let matchByCurp = 0;

excelWaitlistMap.forEach((val, key) => {
  const r = val.row;
  const empId = String(r['# EMPLEADO'] || '').trim();
  const name = String(r['NOMBRE COMPLETO'] || '').trim();
  const curp = String(r['CURP'] || '').trim().toUpperCase();
  
  let match = null;
  if (empId && dbByEmpId.has(empId)) {
    match = dbByEmpId.get(empId);
    matchByEmpId++;
  } else if (curp && dbByCurp.has(curp)) {
    match = dbByCurp.get(curp);
    matchByCurp++;
  } else if (name && dbByName.has(normalizeName(name))) {
    match = dbByName.get(normalizeName(name));
    matchByName++;
  }

  if (match) {
    existingInDbCount++;
  } else {
    newToInsertCount++;
  }
});

console.log('\n--- RESUMEN DE COINCIDENCIAS CON LA BASE DE DATOS DEL SISTEMA ---');
console.log('Registros que YA EXISTEN en la DB del sistema:', existingInDbCount);
console.log('  - Coincidencias por # EMPLEADO:', matchByEmpId);
console.log('  - Coincidencias por CURP:', matchByCurp);
console.log('  - Coincidencias por NOMBRE:', matchByName);
console.log('Registros NUEVOS a insertar en la DB del sistema:', newToInsertCount);

db.close();
