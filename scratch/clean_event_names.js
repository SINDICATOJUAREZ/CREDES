const Database = require('better-sqlite3');
const path = require('path');
const db = new Database('database.sqlite');

console.log('--- BUSCANDO EVENTOS CON AÑO DUPLICADO ---');
const events = db.prepare("SELECT id, name FROM events").all();

let count = 0;
for (const ev of events) {
  // Check if name ends with a space and a 4-digit year (e.g. " 2026")
  // AND if that year already appears earlier in the name
  const match = ev.name.match(/\s(\d{4})$/);
  if (match) {
    const year = match[1];
    const prefix = ev.name.substring(0, ev.name.length - year.length - 1);
    if (prefix.includes(year)) {
      console.log(`Original: "${ev.name}" -> Nuevo: "${prefix}"`);
      db.prepare("UPDATE events SET name = ? WHERE id = ?").run(prefix, ev.id);
      count++;
    }
  }
}

console.log(`\nTotal de eventos corregidos: ${count}`);
db.close();
