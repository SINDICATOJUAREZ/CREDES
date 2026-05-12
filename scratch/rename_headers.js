const XLSX = require('xlsx');

function renameHeader(header) {
    if (!header) return header;
    
    let newHeader = header.toString().trim();

    // Remove PARTICIPACION / PARTICIPACIÓN (case insensitive, with or without accent)
    // Pattern: PARTICIPACION 2025 - DIA DE LA MUJER
    const participacionRegex = /PARTICIPACI[OÓ]N\s+(\d{4})\s*-\s*(.*)/i;
    const match = newHeader.match(participacionRegex);
    if (match) {
        return `${match[2].trim()} ${match[1]}`;
    }

    // Pattern: PARTICIPACION - EVENTO (no year)
    const simpleParticipacionRegex = /PARTICIPACI[OÓ]N\s*-\s*(.*)/i;
    const matchSimple = newHeader.match(simpleParticipacionRegex);
    if (matchSimple) {
        return matchSimple[1].trim();
    }

    // Handle other prefixes like TORNEO if they follow the same pattern
    const generalRegex = /([A-Z\s]+)\s+(\d{4})\s*-\s*(.*)/i;
    const matchGen = newHeader.match(generalRegex);
    if (matchGen) {
        const prefix = matchGen[1].trim();
        const year = matchGen[2].trim();
        const event = matchGen[3].trim();
        // If it's not Nomina, Nombre, Estatus
        if (!['NOMINA', 'NOMBRE', 'ESTATUS', 'STATUS'].includes(header.toUpperCase())) {
            return `${event} ${prefix} ${year}`;
        }
    }

    return newHeader;
}

async function run() {
    const filePath = 'i:\\APLICACIONES\\SINDICATO\\CREDENCIALES\\ASISTENCIAS\\ASISTENCIAS_UNIFICADO.xlsx';
    console.log("Reading file...");
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // Get headers
    const range = XLSX.utils.decode_range(sheet['!ref']);
    const headers = [];
    for (let C = range.s.c; C <= range.e.c; ++C) {
        const cell = sheet[XLSX.utils.encode_cell({ r: range.s.r, c: C })];
        headers.push(cell ? cell.v : null);
    }

    console.log("Original headers sample:", headers.slice(0, 10));

    const newHeaders = headers.map(h => renameHeader(h));
    console.log("New headers sample:", newHeaders.slice(0, 10));

    // Update sheet headers
    for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellRef = XLSX.utils.encode_cell({ r: range.s.r, c: C });
        if (newHeaders[C] !== null) {
            sheet[cellRef] = { t: 's', v: newHeaders[C] };
        }
    }

    console.log("Saving file as ASISTENCIAS_UNIFICADO_v2.xlsx...");
    XLSX.writeFile(workbook, filePath.replace('.xlsx', '_v2.xlsx'));
    console.log("Done!");
}

run().catch(console.error);
