import { useCallback } from 'react';
import { Member } from '@/types/member';

export const useQR = () => {
  const generateQRValue = useCallback((member: Member) => {
    // Format: NAME, PHONE, ADDRESS, LOCATION LINK, LOCATION (lat/long)
    const lines = [
      `NOMBRE: ${member.fullName}`,
      `NÓMINA: ${member.employeeId}`,
      `PUESTO: ${member.position}`
    ];
    return lines.join('\n');
  }, []);

  return { generateQRValue };
};
