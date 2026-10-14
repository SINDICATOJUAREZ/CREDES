import { useCallback } from 'react';
import { Member } from '@/types/member';

export const useQR = () => {
  const generateQRValue = useCallback((member: Member) => {
    const lines = [
      `NOMBRE: ${member.fullName}`,
      `NÓMINA: ${member.employeeId}`,
      `PUESTO: ${member.position || ''}`
    ];
    return lines.join('\n');
  }, []);

  return { generateQRValue };
};
