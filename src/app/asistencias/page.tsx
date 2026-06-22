'use client';

import { AttendanceReportsDialog } from '@/components/reports/AttendanceReportsDialog';

export default function AsistenciasPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-4 md:p-8">
      <div className="w-full max-w-7xl flex-1">
        <AttendanceReportsDialog inline={true} />
      </div>
    </div>
  );
}
