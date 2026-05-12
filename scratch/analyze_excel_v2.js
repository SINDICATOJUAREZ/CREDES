const XLSX = require('xlsx');
const path = require('path');

const filePath = 'i:\\APLICACIONES\\SINDICATO\\CREDENCIALES\\RECURSOS\\BASE DE DATOS SINDICATO JUAREZ, N.L.2026.xlsx';

try {
    const workbook = XLSX.readFile(filePath);
    
    console.log('Sheets:', workbook.SheetNames);
    
    // Analyze "BASE DE DATOS"
    const dbSheet = workbook.Sheets['BASE DE DATOS'];
    if (dbSheet) {
        const dbData = XLSX.utils.sheet_to_json(dbSheet, { header: 1 });
        const columns = dbData[0];
        console.log('\n--- BASE DE DATOS Columns ---');
        console.log(columns);
    } else {
        console.log('\nSheet "BASE DE DATOS" not found.');
    }
    
    // Analyze "ETAPA 16"
    const waitingSheet = workbook.Sheets['ETAPA 16'];
    if (waitingSheet) {
        const waitingData = XLSX.utils.sheet_to_json(waitingSheet, { header: 1 });
        const columns = waitingData[0];
        console.log('\n--- ETAPA 16 Columns ---');
        console.log(columns);
        
        // Check for "baja" status in some rows
        console.log('\nSample rows from ETAPA 16:');
        console.log(waitingData.slice(1, 10));
    } else {
        console.log('\nSheet "ETAPA 16" not found.');
    }

} catch (error) {
    console.error('Error reading excel:', error.message);
}
