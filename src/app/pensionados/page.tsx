'use client';

import { PensionersDialog } from '@/components/reports/PensionersDialog';

export default function PensionadosPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-4 md:p-8">
      <div className="w-full max-w-7xl flex-1">
        <PensionersDialog inline={true} />
      </div>
    </div>
  );
}
