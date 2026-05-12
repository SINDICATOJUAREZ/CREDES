const XLSX = require('xlsx');
const path = require('path');

function normalizeName(name) {
    if (!name) return "";
    return name.toString()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, " ")
        .replace(/\s+/g, " ")
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
        const fullName = row['NOMBRE COMPLETO'] || "";
        const normName = normalizeName(fullName);
        const status = row['STATUS'];
        
        if (nomina) {
            masterByNomina.set(nomina.toString(), { nomina, name: fullName, status });
        }
        if (normName) {
            if (!masterByName.has(normName) || status === 'ACTIVO') {
                masterByName.set(normName, { nomina, name: fullName, status });
            }
        }
    });

    console.log("Loading Attendance Data...");
    const attendanceWorkbook = XLSX.readFile(UNIFICADO_PATH);
    const attendanceSheet = attendanceWorkbook.Sheets[attendanceWorkbook.SheetNames[0]];
    const attendanceData = XLSX.utils.sheet_to_json(attendanceSheet);

    console.log("Processing and fixing...");

    const manualFixes = {
        "8617": "8611",
        "9787": "9781",
    };

    const merged = new Map();
    const noNominaRecords = [];

    attendanceData.forEach(row => {
        let nomina = (row['Nomina'] || row['NOMINA'] || "").toString().trim();
        let name = row['Nombre'] || row['NOMBRE'] || "";
        let status = row['Estatus'] || row['ESTATUS'] || "NO REGISTRADO";

        if (manualFixes[nomina]) {
            nomina = manualFixes[nomina];
        }

        const normName = normalizeName(name);
        let masterMatch = null;

        if (nomina) {
            masterMatch = masterByNomina.get(nomina);
        }
        
        if (!masterMatch && (!nomina || status === "NO REGISTRADO")) {
            masterMatch = masterByName.get(normName);
            if (!masterMatch) {
                // Fuzzy search
                for (let [mNormName, mInfo] of masterByName) {
                    if (mNormName.startsWith(normName) || normName.startsWith(mNormName)) {
                        const words1 = normName.split(' ');
                        const words2 = mNormName.split(' ');
                        const common = words1.filter(w => words2.includes(w));
                        if (common.length >= 2) {
                            masterMatch = mInfo;
                            break;
                        }
                    }
                }
            }
        }

        if (masterMatch) {
            nomina = masterMatch.nomina.toString();
            name = masterMatch.name; // Always use Master DB name
            status = masterMatch.status;
        }

        const finalRow = { ...row, Nomina: nomina, Nombre: name, Estatus: status };
        delete finalRow['NOMINA']; delete finalRow['NOMBRE']; delete finalRow['ESTATUS'];

        if (nomina) {
            if (merged.has(nomina)) {
                const existing = merged.get(nomina);
                Object.keys(finalRow).forEach(col => {
                    if (!['Nomina', 'Nombre', 'Estatus'].includes(col)) {
                        if (finalRow[col] && !existing[col]) {
                            existing[col] = finalRow[col];
                        }
                    }
                });
                const statusPriority = { "ACTIVO": 4, "PENDIENTE": 3, "BAJA": 2, "NO REGISTRADO": 1 };
                if ((statusPriority[finalRow.Estatus] || 0) > (statusPriority[existing.Estatus] || 0)) {
                    existing.Estatus = finalRow.Estatus;
                }
                // Keep the "best" name (master db one already used)
            } else {
                merged.set(nomina, finalRow);
            }
        } else {
            noNominaRecords.push(finalRow);
        }
    });

    // Special name-based merge for remaining no-nomina
    const nameMerged = new Map();
    noNominaRecords.forEach(row => {
        const normName = normalizeName(row.Nombre);
        let found = false;
        for (let [existingNorm, existingRow] of nameMerged) {
            if (existingNorm.startsWith(normName) || normName.startsWith(existingNorm)) {
                Object.keys(row).forEach(col => {
                    if (!['Nomina', 'Nombre', 'Estatus'].includes(col)) {
                        if (row[col] && !existingRow[col]) existingRow[col] = row[col];
                    }
                });
                if (row.Nombre.length > existingRow.Nombre.length) existingRow.Nombre = row.Nombre;
                found = true;
                break;
            }
        }
        if (!found) nameMerged.set(normName, row);
    });

    const finalData = [...merged.values(), ...nameMerged.values()];
    finalData.sort((a, b) => (a.Nombre || "").localeCompare(b.Nombre || ""));

    console.log("Saving result...");
    const newSheet = XLSX.utils.json_to_sheet(finalData);
    const newWorkbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(newWorkbook, newSheet, "Asistencias");
    XLSX.writeFile(newWorkbook, UNIFICADO_PATH);
    console.log(`Done! Total records: ${finalData.length}`);
}

fixAsistencias().catch(err => { console.error(err); process.exit(1); });
