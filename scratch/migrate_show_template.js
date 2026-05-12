const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.cwd(), 'database.sqlite');
const db = new Database(dbPath);

try {
    db.prepare("ALTER TABLE credential_designs ADD COLUMN show_template INTEGER DEFAULT 1").run();
    console.log("Column show_template added successfully.");
} catch (err) {
    if (err.message.includes("duplicate column name")) {
        console.log("Column show_template already exists.");
    } else {
        console.error("Error adding column:", err.message);
    }
} finally {
    db.close();
}
