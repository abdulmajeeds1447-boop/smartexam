import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { EnvelopeStatus, ExamEnvelope } from '../../types';
import { QrCode, MapPin, Clock, ChevronLeft, Search, X, CheckCircle2 } from 'lucide-react';

// دالة تنسيق التاريخ بدون مكتبات خارجية (Native JS)
const formatDateNative = (dateStr: string) => {
  try {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('ar-SA', { weekday: 'long', day: 'numeric', month: 'long' }).format(date);
  } catch {
    return dateStr;
  }
};

// دالة تنظيف وتوحيد أسماء المراحل لمنع التكرار
const uniqueGrades = (grades: string[]) => {
    const normalized = grades.map(g => {
        if(g.includes('أول') || g.includes('1')) return 'أول ثانوي';
        if(g.includes('ثاني') || g.includes('2')) return 'ثاني ثانوي';
        if(g.includes('ثالث') || g.includes('3')) return 'ثالث ثانوي';
        return g;
    });
    return Array.from(new Set(normalized));
};

export const TeacherDashboard: React.FC = () => {
  const { exams, processCommitteeScan, currentUser } = useApp();
  const [scanning, setScanning] = useState(false);
  const [selectedCommittee, setSelectedCommittee] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const groupedExams = useMemo(() => {
    const groups: { [key: string]: ExamEnvelope[] } = {};
    exams.forEach(exam => {
      if (searchTerm && !exam.committeeNumber.includes(searchTerm)) return;
      if (!groups[exam.committeeNumber]) groups[exam.committeeNumber] = [];
      groups[exam.committeeNumber].push(exam);
    });
    return groups;
  }, [exams, searchTerm]);

  const handleScanRequest = async () => {
    if (!selectedCommittee || !currentUser) return;
    setScanning(true);
    const result = await processCommitteeScan(selectedCommittee, currentUser.id);
    if (!result.success) alert(result.message);
    setScanning(false);
  };

  return (
    <div className="bg-gray-50 min-h-screen pb-28 font-sans safe-area-inset-bottom" dir="rtl">
      
      {/* رأس التطبيق (Header) */}
      <div className="bg-slate-900 text-white pt-14 pb-10 px-6 rounded-b-[2.5rem] shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex justify-between items-start">
          <div>
            <p className="text-slate-300 text-xs font-medium mb-1">مرحباً بك،</p>
            <h1 className="text-2xl font-bold">{currentUser?.name || 'المعلم المراقب'}</h1>
            <p className="text-xs text-slate-400 mt-1">اختر اللجنة لبدء الاختبار</p>
          </div>
          <div className="bg-white/10 p-2.5 rounded-2xl backdrop-blur-md border border-white/10 shadow-lg">
             <QrCode className="text-white w-6 h-6" />
          </div>
        </div>

        {/* البحث */}
        <div className="mt-8 relative transform translate-y-4">
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl flex items-center px-4 py-3 shadow-lg">
                <Search className="text-slate-300 w-5 h-5 ml-3" />
                <input 
                  type="text" 
                  placeholder="بحث عن رقم اللجنة..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-transparent border-none text-white placeholder-slate-400 text-sm font-bold w-full focus:ring-0 focus:outline-none"
                />
            </div>
        </div>
      </div>

      {/* قائمة اللجان (Cards) */}
      <div className="px-5 mt-8 space-y-4">
        {Object.entries(groupedExams).length === 0 ? (
            <div className="text-center py-20 text-gray-400">
                <p>لا توجد لجان متاحة</p>
            </div>
        ) : (
            Object.entries(groupedExams).map(([committeeNum, committeeExams]) => {
            const firstExam = committeeExams[0];
            const allGrades = uniqueGrades(committeeExams.flatMap(e => e.grades));
            const activeCount = committeeExams.filter(e => e.status === EnvelopeStatus.RECEIVED).length;
            
            return (
                <div 
                    key={committeeNum} 
                    onClick={() => setSelectedCommittee(committeeNum)}
                    className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex items-center justify-between active:scale-95 transition-all cursor-pointer relative overflow-hidden"
                >
                    <div className={`absolute right-0 top-0 bottom-0 w-1.5 ${activeCount > 0 ? 'bg-green-500' : 'bg-blue-600'}`}></div>
                    <div className="flex items-center gap-5 mr-3">
                        <div className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center border-2 border-gray-50 shadow-sm ${activeCount > 0 ? 'bg-green-50 text-green-700' : 'bg-slate-50 text-slate-700'}`}>
                            <span className="text-[10px] font-bold opacity-60">لجنة</span>
                            <span className="text-2xl font-black">{committeeNum}</span>
                        </div>
                        <div>
                            <div className="flex items-center gap-2 text-gray-800 font-bold mb-1.5 text-lg">
                                <MapPin size={16} className="text-red-500" />
                                <span>{firstExam.location}</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {allGrades.map(g => (
                                    <span key={g} className="text-[10px] bg-gray-100 text-gray-500 px-2.5 py-1 rounded-lg font-bold border border-gray-200">
                                        {g}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                    <ChevronLeft className="text-gray-300 w-5 h-5" />
                </div>
            );
            })
        )}
      </div>

      {/* تفاصيل اللجنة (Popup) */}
      {selectedCommittee && groupedExams[selectedCommittee] && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedCommittee(null)}></div>
          <div className="bg-white w-full max-w-lg rounded-t-[2.5rem] p-6 relative z-10 animate-slide-up shadow-2xl max-h-[85vh] overflow-y-auto flex flex-col">
            <div className="w-16 h-1.5 bg-gray-200 rounded-full mx-auto mb-8"></div>
            <div className="flex items-start justify-between mb-8">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-1">لجنة {selectedCommittee}</h2>
                    <p className="text-gray-500 flex items-center gap-1.5 text-sm font-medium">
                        <MapPin className="w-4 h-4 text-red-500" /> {groupedExams[selectedCommittee][0].location}
                    </p>
                </div>
                <button onClick={() => setSelectedCommittee(null)} className="bg-gray-100 p-2 rounded-full"><X className="w-5 h-5 text-gray-600" /></button>
            </div>
            <div className="space-y-4 mb-8 flex-1">
                {groupedExams[selectedCommittee].map(exam => (
                    <div key={exam.id} className="border rounded-2xl p-4 flex items-center gap-4 bg-gray-50">
                        <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center shrink-0"><Clock size={20} /></div>
                        <div className="flex-1">
                            <h3 className="font-bold text-gray-800 text-base mb-1">{exam.subject}</h3>
                            <div className="flex justify-between items-center text-xs text-gray-500 font-medium">
                                <span className="bg-white px-2 py-1 rounded border border-gray-100">
                                    {formatDateNative(exam.date)}
                                </span>
                                <span dir="ltr">{exam.startTime} - {exam.endTime}</span>
                            </div>
                        </div>
                        {/* أيقونة الحالة */}
                        {exam.status === EnvelopeStatus.COMPLETED && (
                            <CheckCircle2 className="text-green-500 w-5 h-5" />
                        )}
                    </div>
                ))}
            </div>
            <button onClick={handleScanRequest} disabled={scanning} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold text-lg hover:bg-slate-800 shadow-xl flex items-center justify-center gap-3">
                {scanning ? 'جاري التحقق...' : <><QrCode className="w-6 h-6" /><span>فتح المظروف وبدء اللجنة</span></>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
