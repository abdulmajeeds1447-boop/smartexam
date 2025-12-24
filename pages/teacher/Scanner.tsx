import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { Camera, ScanLine, AlertTriangle, ShieldAlert } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

interface ScannerProps {
  onScanSuccess: () => void;
}

export const Scanner: React.FC<ScannerProps> = ({ onScanSuccess }) => {
  const { exams, processCommitteeScan, currentUser } = useApp();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSecure, setIsSecure] = useState(true);
  
  // Available committees for manual simulation
  const availableCommittees = Array.from<string>(new Set(
      exams.map(e => e.committeeNumber)
  )).sort();

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isScanningRef = useRef(false);

  useEffect(() => {
    // 1. Check for Secure Context (HTTPS or Localhost)
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        setIsSecure(false);
        return;
    }

    // 2. Initialize Scanner
    const startScanner = async () => {
        if (isScanningRef.current) return;

        try {
            const html5QrCode = new Html5Qrcode("reader");
            scannerRef.current = html5QrCode;

            await html5QrCode.start(
                { facingMode: "environment" },
                {
                    fps: 10,
                    qrbox: { width: 250, height: 250 },
                    aspectRatio: 1.0
                },
                (decodedText) => {
                    handleScan(decodedText);
                },
                (errorMessage) => {
                    // ignore frame errors
                }
            );
            isScanningRef.current = true;
        } catch (err) {
            console.error("Error starting scanner", err);
            setErrorMsg("فشل تشغيل الكاميرا. تأكد من منح الصلاحيات.");
        }
    };

    // Delay start slightly to ensure DOM is ready
    const timer = setTimeout(startScanner, 500);

    return () => {
        clearTimeout(timer);
        if (scannerRef.current && isScanningRef.current) {
            scannerRef.current.stop().then(() => {
                scannerRef.current?.clear();
                isScanningRef.current = false;
            }).catch(err => console.error("Failed to stop scanner", err));
        }
    };
  }, []);

  const handleScan = async (data: string) => {
    // Avoid multiple scans in short time
    if (!currentUser) return;

    // Pause scanner temporarily if needed, but usually we just process
    // Parse JSON if needed
    let committeeId = data;
    try {
        const parsed = JSON.parse(data);
        if (parsed.type === 'committee' && parsed.id) {
            committeeId = parsed.id;
        }
    } catch (e) {
        // Raw string
    }

    // If we have a modal or something, we might want to stop scanning. 
    // Here we just try to process.
    
    // Stop scanning on success to prevent loop
    if (scannerRef.current && isScanningRef.current) {
         await scannerRef.current.stop();
         isScanningRef.current = false;
    }

    const result = await processCommitteeScan(committeeId, currentUser.id);
    
    if (result.success) {
        onScanSuccess();
    } else {
        setErrorMsg(result.message || 'خطأ في المسح');
        // Restart scanner after 3 seconds if failed
        setTimeout(() => {
             setErrorMsg(null);
             if (scannerRef.current && !isScanningRef.current) {
                 scannerRef.current.start(
                    { facingMode: "environment" },
                    { fps: 10, qrbox: { width: 250, height: 250 } },
                    (txt) => handleScan(txt),
                    () => {}
                 ).then(() => { isScanningRef.current = true; });
             }
        }, 3000);
    }
  };

  const handleSimulatedScan = async (committeeId: string) => {
    if (!currentUser) return;
    handleScan(JSON.stringify({ type: 'committee', id: committeeId }));
  };

  if (!isSecure) {
      return (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-yellow-50">
              <div className="bg-yellow-100 p-4 rounded-full text-yellow-600 mb-4">
                  <ShieldAlert size={48} />
              </div>
              <h3 className="text-xl font-bold mb-2 text-gray-800">اتصال غير آمن</h3>
              <p className="text-gray-600 mb-4">
                  المتصفح يمنع تشغيل الكاميرا لأن الموقع لا يعمل عبر بروتوكول <b>HTTPS</b>.
              </p>
              <div className="bg-white p-4 rounded-lg border border-yellow-200 text-sm text-left w-full max-w-sm" dir="ltr">
                  <p className="font-mono text-xs text-gray-500 mb-2">Current: {window.location.protocol}//{window.location.host}</p>
                  <p>To fix this:</p>
                  <ul className="list-disc ml-5 mt-1 text-gray-700">
                      <li>Use <b>https://</b> if available.</li>
                      <li>Use <b>localhost</b> for testing.</li>
                      <li>Or use the manual buttons below.</li>
                  </ul>
              </div>
              
              <div className="mt-8 w-full max-w-sm">
                   <p className="text-sm font-bold text-gray-500 mb-2">الاختيار اليدوي (بديل للكاميرا)</p>
                   <div className="grid grid-cols-2 gap-2">
                    {availableCommittees.map(committeeNum => (
                        <button
                            key={committeeNum}
                            onClick={() => handleSimulatedScan(committeeNum)}
                            className="bg-white border border-gray-300 text-gray-700 py-3 rounded-lg text-sm font-bold hover:bg-gray-50 flex items-center justify-center gap-2"
                        >
                            لجنة {committeeNum}
                        </button>
                    ))}
                   </div>
              </div>
          </div>
      )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] md:h-auto relative bg-black rounded-xl overflow-hidden">
      {/* Camera Viewfinder UI */}
      <div className="absolute inset-0 z-0 bg-black flex items-center justify-center">
         <div id="reader" className="w-full h-full"></div>
      </div>

      {/* Overlay UI */}
      <div className="relative z-10 flex flex-col h-full items-center justify-between p-8 pointer-events-none">
        <div className="text-white text-center pointer-events-auto bg-black/40 p-4 rounded-xl backdrop-blur-sm">
            <h2 className="text-xl font-bold mb-1">مسح رمز اللجنة</h2>
            <p className="text-white/90 text-sm">أهلاً، أستاذ {currentUser?.name}</p>
            <p className="text-white/70 text-xs mt-1">وجّه الكاميرا نحو رمز QR الملصق على باب اللجنة</p>
        </div>

        <div className="relative">
             {/* Visual Frame only - Scanner logic handles the box */}
            <div className="w-64 h-64 border-2 border-white/30 rounded-3xl relative">
                <div className="absolute inset-0 border-2 border-primary-500 rounded-3xl animate-pulse opacity-50"></div>
            </div>
            
            {errorMsg ? (
                 <div className="absolute -bottom-24 left-1/2 transform -translate-x-1/2 w-72 pointer-events-auto">
                    <div className="bg-red-500 text-white px-4 py-3 rounded-lg text-sm flex items-center gap-2 justify-center shadow-lg animate-fade-in">
                        <AlertTriangle size={20} className="shrink-0" />
                        <span>{errorMsg}</span>
                    </div>
                </div>
            ) : (
                <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2">
                    <div className="bg-black/50 backdrop-blur-md px-4 py-2 rounded-full text-white text-xs flex items-center gap-2">
                        <ScanLine size={14} />
                        <span>جاري البحث عن لجنة...</span>
                    </div>
                </div>
            )}
        </div>

        {/* Manual Controls */}
        <div className="w-full max-w-md bg-black/60 backdrop-blur-md rounded-xl p-4 border border-white/10 max-h-48 overflow-y-auto no-scrollbar pointer-events-auto">
            <p className="text-white/60 text-xs text-center mb-3 uppercase tracking-wider">
                للاختبار اليدوي (في حال تعطل الكاميرا)
            </p>
            <div className="grid grid-cols-2 gap-2">
                {availableCommittees.length === 0 && (
                    <div className="col-span-2 text-white/50 text-center text-xs">لا توجد لجان متاحة اليوم</div>
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