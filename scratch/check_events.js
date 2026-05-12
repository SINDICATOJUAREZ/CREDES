const Database = require('better-sqlite3');
const path = require('path');
const db = new Database('database.sqlite');

console.log('--- TABLE SCHEMA: events ---');
const schema = db.prepare("PRAGMA table_info(events)").all();
console.log(schema);

console.log('--- STATS ---');
const stats = db.prepare("SELECT COUNT(*) as total, SUM(CASE WHEN date IS NULL THEN 1 ELSE 0 END) as null_dates FROM events").get();
console.log(stats);

console.log('\n--- EVENTS WITH DATE ---');
const withDate = db.prepare("SELECT * FROM events WHERE date IS NOT NULL ORDER BY date DESC LIMIT 5").all();
console.log(withDate);

console.log('\n--- EVENTS WITHOUT DATE (LAST 5) ---');
const withoutDate = db.prepare("SELECT * FROM events WHERE date IS NULL ORDER BY name DESC LIMIT 5").all();
console.log(withoutDate);

db.close();
