const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const dir = 'I:\\APLICACIONES\\SINDICATO\\CREDENCIALES\\ASISTENCIAS';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.xlsx') && !f.startsWith('~') && f !== 'ASISTENCIAS_UNIFICADO.xlsx');

const members = new Map();
const allEvents = new Set();

const STANDARD_COLS = ['#', 'nomina', 'nombre', 'status', 'activo/etapa', 'nomina.1', 'activo/lista espera', 'fecha'];

files.forEach(f => {
  const wb = xlsx.readFile(path.join(dir, f));
  wb.SheetNames.forEach(sn => {
    const ws = wb.Sheets[sn];
    const data = xlsx.utils.sheet_to_json(ws, { header: 1 });
    if (data.length === 0) return;

    const headers = data[0].map(h => h ? String(h).trim() : '');
    
    // Identificar columnas base y columnas de eventos
    let nominaIdx = headers.findIndex(h => h.toLowerCase() === 'nomina');
    let nombreIdx = headers.findIndex(h => h.toLowerCase() === 'nombre');
    let statusIdx = headers.findIndex(h => {
      const hl = h.toLowerCase();
      return hl === 'status' || hl === 'activo/etapa' || hl === 'nomina.1' || hl === 'activo/lista espera' || hl === 'nomina.2'; // A veces nominan doble
    });

    // Si 'nomina.1' es el status pero hay 'nomina', buscamos el último
    if (nominaIdx === -1 || nombreIdx === -1) return; // Saltamos hojas sin estructura

    const eventColumns = [];
    headers.forEach((h, idx) => {
      if (!h) return;
      const hl = h.toLowerCase();
      if (!STANDARD_COLS.includes(hl) && idx !== nominaIdx && idx !== nombreIdx && idx !== statusIdx) {
        eventColumns.push({ index: idx, name: h.toUpperCase() });
        allEvents.add(h.toUpperCase());
      }
    });

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;
      
      const nomina = row[nominaIdx];
      if (!nomina) continue;
      const nominaStr = String(nomina).trim();
      
      if (!members.has(nominaStr)) {
        members.set(nominaStr, {
          NOMINA: nominaStr,
          NOMBRE: row[nombreIdx] ? String(row[nombreIdx]).trim() : '',
          STATUS: statusIdx !== -1 && row[statusIdx] ? String(row[statusIdx]).trim() : '',
          events: new Set()
        });
      }
      
      const member = members.get(nominaStr);
      if (!member.STATUS && statusIdx !== -1 && row[statusIdx]) {
        member.STATUS = String(row[statusIdx]).trim();
      }

      eventColumns.forEach(ec => {
        const val = row[ec.index];
        if (val && String(val).trim() !== '') {
          member.events.add(ec.name);
        }
      });
    }
  });
});

const sortedEvents = Array.from(allEvents).sort();

const exportData = [];
members.forEach(member => {
  const row = {
    NOMINA: member.NOMINA,
    NOMBRE: member.NOMBRE,
    STATUS: member.STATUS
  };
  sortedEvents.forEach(e => {
    row[e] = member.events.has(e) ? '*' : '';
  });
  exportData.push(row);
});

// Ordenar alfabéticamente
exportData.sort((a, b) => a.NOMBRE.localeCompare(b.NOMBRE));

const newWb = xlsx.utils.book_new();
const newWs = xlsx.utils.json_to_sheet(exportData);

// Ajustar el ancho de las columnas
const colWidths = [
  { wch: 10 }, // NOMINA
  { wch: 40 }, // NOMBRE
  { wch: 20 }, // STATUS
  ...sortedEvents.map(() => ({ wch: 15 })) // Eventos
];
newWs['!cols'] = colWidths;

xlsx.utils.book_append_sheet(newWb, newWs, 'Asistencias_Unificadas');

const outputPath = path.join(dir, 'ASISTENCIAS_UNIFICADO.xlsx');
xlsx.writeFile(newWb, outputPath);

console.log('Unificación completada.');
console.log('Total registros únicos (Nóminas):', members.size);
console.log('Total eventos únicos detectados:', sortedEvents.length);
console.log('Archivo guardado en:', outputPath);
