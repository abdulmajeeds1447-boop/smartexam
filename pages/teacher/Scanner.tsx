import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Camera, ScanLine, X, AlertTriangle } from 'lucide-react';

interface ScannerProps {
  onScanSuccess: () => void;
}

export const Scanner: React.FC<ScannerProps> = ({ onScanSuccess }) => {
  const { exams, processCommitteeScan, currentUser } = useApp();
  const [cameraPermission, setCameraPermission] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Helper to extract unique committees that have exams TODAY
  const availableCommittees = Array.from<string>(new Set(
      exams.map(e => e.committeeNumber)
  )).sort();

  const handleSimulatedScan = async (committeeId: string) => {
    if (!currentUser) return;
    setErrorMsg(null);

    const result = await processCommitteeScan(committeeId, currentUser.id);
    
    if (result.success) {
        onScanSuccess();
    } else {
        setErrorMsg(result.message || 'خطأ في المسح');
        // Clear error after 3 seconds
        setTimeout(() => setErrorMsg(null), 3000);
    }
  };

  if (!cameraPermission) {
      return (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <div className="bg-red-100 p-4 rounded-full text-red-500 mb-4">
                  <Camera size={48} />
              </div>
              <h3 className="text-xl font-bold mb-2">الكاميرا غير مفعلة</h3>
              <p className="text-gray-500">يرجى السماح للتطبيق بالوصول للكاميرا لمسح رمز QR</p>
              <button onClick={() => setCameraPermission(true)} className="mt-4 text-primary-600 font-bold">المحاولة مرة أخرى</button>
          </div>
      )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] md:h-auto relative bg-black rounded-xl overflow-hidden">
      {/* Camera Viewfinder UI */}
      <div className="absolute inset-0 z-0">
        <img 
            src="https://images.unsplash.com/photo-1555529733-1b0728362699?auto=format&fit=crop&q=80&w=1000" 
            className="w-full h-full object-cover opacity-50" 
            alt="Camera Feed"
        />
        <div className="absolute inset-0 bg-black/40"></div>
      </div>

      <div className="relative z-10 flex flex-col h-full items-center justify-between p-8">
        <div className="text-white text-center">
            <h2 className="text-xl font-bold mb-1">مسح رمز اللجنة</h2>
            <p className="text-white/70 text-sm">أهلاً، أستاذ {currentUser?.name}</p>
            <p className="text-white/70 text-xs mt-1">وجّه الكاميرا نحو رمز QR الملصق على باب اللجنة أو المظروف</p>
        </div>

        <div className="relative">
            <div className="w-64 h-64 border-2 border-white/50 rounded-3xl relative overflow-hidden">
                <div className="absolute inset-0 border-2 border-primary-500 rounded-3xl animate-pulse"></div>
                <div className="absolute top-0 left-0 w-full h-1 bg-primary-500 shadow-[0_0_15px_rgba(14,165,233,0.8)] animate-scan"></div>
            </div>
            
            {errorMsg ? (
                 <div className="absolute -bottom-16 left-1/2 transform -translate-x-1/2 w-64">
                    <div className="bg-red-500 text-white px-4 py-2 rounded-lg text-xs flex items-center gap-2 justify-center shadow-lg animate-fade-in">
                        <AlertTriangle size={16} />
                        <span>{errorMsg}</span>
                    </div>
                </div>
            ) : (
                <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2">
                    <div className="bg-white/20 backdrop-blur-md px-4 py-2 rounded-full text-white text-xs flex items-center gap-2">
                        <ScanLine size={14} />
                        <span>جاري البحث عن لجنة...</span>
                    </div>
                </div>
            )}
        </div>

        {/* Simulation Controls */}
        <div className="w-full max-w-md bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20 max-h-48 overflow-y-auto no-scrollbar">
            <p className="text-white/60 text-xs text-center mb-3 uppercase tracking-wider">
                محاكاة مسح (اختر رقم اللجنة)
            </p>
            <div className="grid grid-cols-2 gap-2">
                {availableCommittees.length === 0 && (
                    <div className="col-span-2 text-white/50 text-center text-xs">لا توجد لجان متاحة في النظام حالياً</div>
                )}
                {availableCommittees.map(committeeNum => (
                    <button
                        key={committeeNum}
                        onClick={() => handleSimulatedScan(committeeNum)}
                        className="bg-white/90 text-gray-900 py-2 rounded-lg text-sm font-bold hover:bg-white transition-colors flex items-center justify-center gap-2"
                    >
                        <span>لجنة {committeeNum}</span>
                        <ScanLine size={14} className="opacity-50" />
                    </button>
                ))}
            </div>
        </div>
      </div>
    </div>
  );
};