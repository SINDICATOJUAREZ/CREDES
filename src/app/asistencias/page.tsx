'use client';

import { AttendanceReportsDialog } from '@/components/reports/AttendanceReportsDialog';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function AsistenciasPage() {
  const router = useRouter();
  
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center">
      <div className="w-full bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-20 shadow-sm">
        <Link href="/">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <h1 className="text-xl font-black text-blue-900">Control de Asistencias</h1>
        <div className="w-10"></div> {/* Spacer for centering */}
      </div>
      <div className="w-full max-w-7xl flex-1 mt-6">
        {/* We mount the dialog content directly or open it by default */}
        <AttendanceReportsDialog isOpen={true} onClose={() => router.push('/')} />
      </div>
    </div>
  );
}
