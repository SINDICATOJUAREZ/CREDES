import { useState } from 'react';
import * as XLSX from 'xlsx';
import { Member } from '@/types/member';

export const useExcel = () => {
  const [data, setData] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);

  const parseExcel = async (file: File) => {
    return new Promise<Member[]>((resolve, reject) => {
      setLoading(true);
      try {
        const reader = new FileReader();
        reader.onload = (e) => {
          const bstr = e.target?.result;
          const workbook = XLSX.read(bstr, { type: 'binary' });
          const wsname = workbook.SheetNames[0];
          const ws = workbook.Sheets[wsname];
          const jsonData = XLSX.utils.sheet_to_json(ws);
          
          const members: Member[] = jsonData.map((item: any) => ({
            id: crypto.randomUUID(),
            fullName: item['NOMBRE COMPLETO'] || '',
            position: item['PUESTO'] || '',
            department: item['DEPARTAMENTO'] || '',
            secretariat: item['SECRETARIA'] || '',
            employeeId: String(item['NUMERO DE EMPLEADO'] || ''),
            socioId: String(item['N SOCIO'] || ''),
            curp: item['CURP'] || '',
            rfc: item['RFC'] || '',
            birthDate: item['FECHA NAC.'] || '',
            birthPlace: item['LUGAR NAC.'] || '',
            phone: item['TELEFONO'] || '',
            address: item['DIRECCION'] || '',
            colonia: item['COLONIA'] || '',
            municipio: item['MPIO'] || '',
            cp: String(item['C.P.'] || ''),
            memberType: (item['TIPO'] || 'ACTIVO') as Member['memberType'],
            status: item['ESTATUS'] || 'ACTIVO',
            profilePicture: '',
            family: []
          })).filter(m => m.fullName);
          
          setData(members);
          setLoading(false);
          resolve(members);
        };
        reader.onerror = (err) => {
          setLoading(false);
          reject(err);
        };
        reader.readAsBinaryString(file);
      } catch (error) {
        setLoading(false);
        reject(error);
      }
    });
  };

  const exportToExcel = (members: Member[]) => {
    const ws = XLSX.utils.json_to_sheet(members.map(m => ({
      '# EMPLEADO': m.employeeId,
      '# SOCIO': m.socioId,
      'NOMBRE COMPLETO': m.fullName,
      'STATUS': m.status,
      'PUESTO': m.position,
      'DIRECCION': m.department,
      'SECRETARIA': m.secretariat,
      'CURP': m.curp,
      'RFC': m.rfc,
      'CELULAR': m.phone,
      'DOMICILIO': m.address,
      'COLONIA': m.colonia,
      'MUNICIPIO': m.municipio,
      'C.P.': m.cp,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Agremiados');
    XLSX.writeFile(wb, 'Base_Datos_Sindicato_Export.xlsx');
  };

  return { data, setData, loading, parseExcel, exportToExcel };
};
