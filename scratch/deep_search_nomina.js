const XLSX = require('xlsx');

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

async function deepSearchNomina() {
    const MASTER_DB_PATH = 'i:\\APLICACIONES\\SINDICATO\\CREDENCIALES\\RECURSOS\\BASE DE DATOS SINDICATO JUAREZ, N.L.2026.xlsx';
    const INPUT_PATH = 'i:\\APLICACIONES\\SINDICATO\\CREDENCIALES\\ASISTENCIAS\\ASISTENCIAS_UNIFICADO.xlsx'; // Or _v2 if exists

    console.log("Loading ALL sheets from Master DB (this may take a while)...");
    const masterWorkbook = XLSX.readFile(MASTER_DB_PATH);
    const masterByName = new Map();
    const masterByNomina = new Map();

    const nominaAliases = ['# EMPLEADO', 'NOMINA', 'EMPLEADO', '# SOCIO', 'NUMERO', 'NO. NOMINA'];
    const nameAliases = ['NOMBRE COMPLETO', 'NOMBRE', 'NOMBRE COMPLETO (SOLO PARA REFERENCIA)', 'AGREMIADO'];

    masterWorkbook.SheetNames.forEach(sheetName => {
        console.log(`  Processing sheet: ${sheetName}`);
        const data = XLSX.utils.sheet_to_json(masterWorkbook.Sheets[sheetName]);
        if (data.length === 0) return;

        // Detect column names for this sheet
        const firstRow = data[0];
        let nominaCol = nominaAliases.find(a => firstRow.hasOwnProperty(a));
        let nameCol = nameAliases.find(a => firstRow.hasOwnProperty(a));

        if (!nameCol) {
            // Try to find any column that looks like a name (string, contains multiple words)
            for (let key in firstRow) {
                if (key.toUpperCase().includes('NOMBRE') || key.toUpperCase().includes('AGREMIADO')) {
                    nameCol = key;
                    break;
                }
            }
        }

        if (nameCol) {
            data.forEach(row => {
                const nameStr = row[nameCol];
                if (!nameStr) return;
                const normName = normalizeName(nameStr);
                const nomina = row[nominaCol];
                const status = row['STATUS'] || row['ESTATUS'] || sheetName; // Use sheet name as fallback status context

                if (normName) {
                    if (!masterByName.has(normName) || (status === 'ACTIVO')) {
                        masterByName.set(normName, { nomina, name: nameStr, status, source: sheetName });
                    }
                }
                if (nomina) {
                    const nominaStr = nomina.toString().trim();
                    if (!masterByNomina.has(nominaStr) || (status === 'ACTIVO')) {
                        masterByNomina.set(nominaStr, { nomina, name: nameStr, status, source: sheetName });
                    }
                }
            });
        }
    });

    console.log(`Built map with ${masterByName.size} unique names and ${masterByNomina.size} unique nominums.`);

    console.log("Loading Attendance Data...");
    const attendanceWorkbook = XLSX.readFile(INPUT_PATH);
    const attendanceSheet = attendanceWorkbook.Sheets[attendanceWorkbook.SheetNames[0]];
    const attendanceData = XLSX.utils.sheet_to_json(attendanceSheet);

    console.log("Searching for missing nominums...");
    let fixedCount = 0;
    const finalData = attendanceData.map(row => {
        let nomina = (row['Nomina'] || "").toString().trim();
        let name = row['Nombre'] || "";
        let status = row['Estatus'] || "NO REGISTRADO";

        if (!nomina || status === "NO REGISTRADO" || status.includes("Sheet") || status === "") {
            const normName = normalizeName(name);
            const match = masterByName.get(normName);
            if (match && match.nomina) {
                console.log(`[FOUND] ${name} -> Nomina: ${match.nomina} (Source: ${match.source}, Status: ${match.status})`);
                nomina = match.nomina.toString();
                status = match.status || status;
                fixedCount++;
            } else {
                // Try fuzzy/partial match if no exact match
                for (let [mNorm, mInfo] of masterByName) {
                    if (mNorm.includes(normName) || normName.includes(mNorm)) {
                        const words1 = normName.split(' ');
                        const words2 = mNorm.split(' ');
                        const common = words1.filter(w => words2.includes(w));
                        if (common.length >= 2 && Math.abs(words1.length - words2.length) <= 2) {
                            console.log(`[FUZZY FOUND] ${name} -> ${mInfo.name} | Nomina: ${mInfo.nomina} (${mInfo.source})`);
                            nomina = mInfo.nomina.toString();
                            status = mInfo.status || status;
                            fixedCount++;
                            break;
                        }
                    }
                }
            }
        }
        
        return { ...row, Nomina: nomina, Estatus: status };
    });

    console.log(`Saving result... Fixed ${fixedCount} records.`);
    const newSheet = XLSX.utils.json_to_sheet(finalData);
    const newWorkbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(newWorkbook, newSheet, "Asistencias");
    
    const OUTPUT_PATH = 'i:\\APLICACIONES\\SINDICATO\\CREDENCIALES\\ASISTENCIAS\\ASISTENCIAS_UNIFICADO_v3.xlsx';
    XLSX.writeFile(newWorkbook, OUTPUT_PATH);
    console.log(`Done! Saved to ${OUTPUT_PATH}`);
}

deepSearchNomina().catch(console.error);
