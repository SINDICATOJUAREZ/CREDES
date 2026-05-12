const XLSX = require('xlsx');
const path = require('path');

// Normalization function
function normalizeName(name) {
    if (!name) return "";
    return name.toString()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove accents
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, " ") // Keep only letters and numbers
        .replace(/\s+/g, " ") // Collapse spaces
        .trim();
}

async function fixAsistencias() {
    const MASTER_DB_PATH = 'i:\\APLICACIONES\\SINDICATO\\CREDENCIALES\\RECURSOS\\BASE DE DATOS SINDICATO JUAREZ, N.L.2026.xlsx';
    const UNIFICADO_PATH = 'i:\\APLICACIONES\\SINDICATO\\CREDENCIALES\\ASISTENCIAS\\ASISTENCIAS_UNIFICADO.xlsx';

    console.log("Loading Master DB...");
    const masterWorkbook = XLSX.readFile(MASTER_DB_PATH);
    const masterData = XLSX.utils.sheet_to_json(masterWorkbook.Sheets[masterWorkbook.SheetNames[0]]);

    const masterByName = new Map();
    const masterByNomina = new Map();

    masterData.forEach(row => {
        const nomina = row['# EMPLEADO'];
        const name = normalizeName(row['NOMBRE COMPLETO']);
        const status = row['STATUS'];
        
        if (nomina) {
            masterByNomina.set(nomina.toString(), { nomina, name: row['NOMBRE COMPLETO'], status });
        }
        if (name) {
            if (!masterByName.has(name) || status === 'ACTIVO') {
                masterByName.set(name, { nomina, name: row['NOMBRE COMPLETO'], status });
            }
        }
    });

    console.log("Loading Attendance Data...");
    const attendanceWorkbook = XLSX.readFile(UNIFICADO_PATH);
    const attendanceSheet = attendanceWorkbook.Sheets[attendanceWorkbook.SheetNames[0]];
    const attendanceData = XLSX.utils.sheet_to_json(attendanceSheet);

    console.log("Processing and fixing...");

    // Manual fixes mentioned by user
    const manualFixes = {
        "8617": "8611", // Cinddy Valeria
        "9787": "9781", // Eulalio
    };

    const merged = new Map();
    const noNominaRecords = [];

    // First pass: Resolve Nominas and apply manual fixes
    attendanceData.forEach(row => {
        let nomina = (row['Nomina'] || row['NOMINA'] || "").toString().trim();
        let name = row['Nombre'] || row['NOMBRE'] || "";
        let status = row['Estatus'] || row['ESTATUS'] || "NO REGISTRADO";

        // Apply manual fixes
        if (manualFixes[nomina]) {
            console.log(`[MANUAL] Correcting Nomina: ${nomina} -> ${manualFixes[nomina]} (${name})`);
            nomina = manualFixes[nomina];
        }

        const normName = normalizeName(name);

        // Try to resolve Nomina from Master DB if missing or NO REGISTRADO
        if (!nomina || status === "NO REGISTRADO") {
            // Try exact normalized name match
            let masterMatch = masterByName.get(normName);
            
            // If no exact match, try some "fuzzy" variants for known cases
            if (!masterMatch) {
                // Check if "FAUSTO JESUS ELIZONDO" matches "FAUSTO JESUS ELIZONDO GONZALEZ"
                // We'll search for names that start with the normName or normName starts with them
                for (let [mNormName, mInfo] of masterByName) {
                    if (mNormName.startsWith(normName) || normName.startsWith(mNormName)) {
                        // If the difference is just one word or length is similar
                        const words1 = normName.split(' ');
                        const words2 = mNormName.split(' ');
                        const common = words1.filter(w => words2.includes(w));
                        if (common.length >= 2) {
                            masterMatch = mInfo;
                            console.log(`[FUZZY] Matching ${name} to Master DB: ${mInfo.name} (${mInfo.nomina})`);
                            break;
                        }
                    }
                }
            }

            if (masterMatch) {
                console.log(`[RESOLVED] ${name} -> Nomina ${masterMatch.nomina} (${masterMatch.status})`);
                nomina = masterMatch.nomina.toString();
                status = masterMatch.status;
                // Update name to the one in Master DB if it's longer/more complete
                if (masterMatch.name.length > name.length) {
                    name = masterMatch.name;
                }
            }
        } else {
            // Update status and name from Master DB if nomina exists
            const masterMatch = masterByNomina.get(nomina);
            if (masterMatch) {
                status = masterMatch.status;
                if (masterMatch.name.length > name.length) {
                    name = masterMatch.name;
                }
            }
        }

        const finalRow = { ...row, Nomina: nomina, Nombre: name, Estatus: status };
        // Clean up old header variations
        delete finalRow['NOMINA']; delete finalRow['NOMBRE']; delete finalRow['ESTATUS'];

        if (nomina) {
            if (merged.has(nomina)) {
                const existing = merged.get(nomina);
                // Merge attendance columns
                Object.keys(finalRow).forEach(col => {
                    if (!['Nomina', 'Nombre', 'Estatus'].includes(col)) {
                        if (finalRow[col] && !existing[col]) {
                            existing[col] = finalRow[col];
                        }
                    }
                });
                // Keep the best status (ACTIVO > PENDIENTE > BAJA > NO REGISTRADO)
                const statusPriority = { "ACTIVO": 4, "PENDIENTE": 3, "BAJA": 2, "NO REGISTRADO": 1 };
                if ((statusPriority[finalRow.Estatus] || 0) > (statusPriority[existing.Estatus] || 0)) {
                    existing.Estatus = finalRow.Estatus;
                }
                // Keep longer name
                if (finalRow.Nombre.length > existing.Nombre.length) {
                    existing.Nombre = finalRow.Nombre;
                }
            } else {
                merged.set(nomina, finalRow);
            }
        } else {
            noNominaRecords.push(finalRow);
        }
    });

    // Special case for Cesar Saldivar (if still split)
    // CESAR SALDIVAR and CESAR SALDIVAR SANTOS
    // Let's see if we can merge them by name if they still have no nomina
    const secondPassNoNomina = [];
    const nameMerged = new Map();

    noNominaRecords.forEach(row => {
        const normName = normalizeName(row.Nombre);
        // Find if there's a base name match (e.g. "CESAR SALDIVAR" in "CESAR SALDIVAR SANTOS")
        let found = false;
        for (let [existingNorm, existingRow] of nameMerged) {
            if (existingNorm.startsWith(normName) || normName.startsWith(existingNorm)) {
                console.log(`[NAME MERGE] Merging ${row.Nombre} into ${existingRow.Nombre}`);
                // Merge data
                Object.keys(row).forEach(col => {
                    if (!['Nomina', 'Nombre', 'Estatus'].includes(col)) {
                        if (row[col] && !existingRow[col]) {
                            existingRow[col] = row[col];
                        }
                    }
                });
                if (row.Nombre.length > existingRow.Nombre.length) existingRow.Nombre = row.Nombre;
                found = true;
                break;
            }
        }
        if (!found) {
            nameMerged.set(normName, row);
        }
    });

    const finalData = [...merged.values(), ...nameMerged.values()];

    // Sort by Name for convenience
    finalData.sort((a, b) => (a.Nombre || "").localeCompare(b.Nombre || ""));

    console.log("Saving result...");
    const newSheet = XLSX.utils.json_to_sheet(finalData);
    const newWorkbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(newWorkbook, newSheet, "Asistencias");
    XLSX.writeFile(newWorkbook, UNIFICADO_PATH);

    console.log(`Done! Total records after cleanup: ${finalData.length}`);
}

fixAsistencias().catch(err => {
    console.error(err);
    process.exit(1);
});
