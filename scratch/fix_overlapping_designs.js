const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.cwd(), 'database.sqlite');
const db = new Database(dbPath);

try {
    // For any design that has a background URL, we probably want to hide the template by default
    // unless the user specifically wants both.
    const result = db.prepare("UPDATE credential_designs SET show_template = 0 WHERE background_url IS NOT NULL AND background_url != ''").run();
    console.log(`Updated ${result.changes} designs to hide template by default (where background exists).`);
} catch (err) {
    console.error("Error updating designs:", err.message);
} finally {
    db.close();
}
