import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { AttendanceStatus, EnvelopeStatus } from '../../types';
import { 
  QrCode, UserCheck, UserX, Search, Clock, 
  CheckCircle, AlertCircle, LogOut, ShieldCheck, 
  Users, Send, Camera, Info
} from 'lucide-react';
// يتم استيراد قارئ الباركود إذا كان مثبتاً، أو نستخدم واجهة المحاكاة الاحترافية
// import { Html5QrcodeScanner } from 'html5-qrcode'; 

export const TeacherDashboard: React.FC = () => {
  const { 
    exams, currentUser, activeExamId, setActiveExamId,
    processCommitteeScan, markAttendance, submitEnvelope, setUserRole 
  } = useApp();

  const [isScanning, setIsScanning] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'present' | 'absent' | 'pending'>('all');
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);

  // 1. تحديد الاختبار المرتبط بهذا المعلم حالياً (بناءً على المسح)
  const activeExam = useMemo(() => {
    return exams.find(e => e.id === activeExamId || (e.teacherId === currentUser?.id && e.status === EnvelopeStatus.RECEIVED));
  }, [exams, activeExamId, currentUser]);

  // تحديث المعرف النشط تلقائياً عند الدخول
  useEffect(() => {
    if (activeExam && activeExam.id !== activeExamId) {
        setActiveExamId(activeExam.id);
    }
  }, [activeExam, activeExamId, setActiveExamId]);

  // 2. معالجة نتيجة المسح (فتح اللجنة من المظروف)
  const handleBarcodeScanned = async (committeeData: string) => {
    if (!currentUser) return;
    
    // محاولة استخراج رقم اللجنة من النص الممسوح
    let committeeNum = committeeData;
    try {
        const parsed = JSON.parse(committeeData);
        if (parsed.type === 'committee') committeeNum = parsed.id;
    } catch (e) {
        // إذا لم يكن JSON، نأخذ النص الخام (في حال كان الباركود مجرد رقم)
        committeeNum = committeeData.replace(/\D/g, ''); 
    }

    const result = await processCommitteeScan(committeeNum, currentUser.id);
    if (result.success) {
        setIsScanning(false);
    } else {
        alert(result.message || "عذراً، هذا المظروف غير مجدول لك حالياً");
    }
  };

  // 3. تصفية الطلاب للجنة المفتوحة فقط
  const filteredStudents = useMemo(() => {
    if (!activeExam) return [];
    return activeExam.students.filter(student => {
      const record = activeExam.attendance.find(a => a.studentId === student.id);
      const matchesSearch = student.name.includes(searchTerm) || student.seatNumber.includes(searchTerm);
      
      if (filter === 'present') return matchesSearch && record?.status === AttendanceStatus.PRESENT;
      if (filter === 'absent') return matchesSearch && record?.status === AttendanceStatus.ABSENT;
      if (filter === 'pending') return matchesSearch && (!record || record.status === AttendanceStatus.UNKNOWN);
      return matchesSearch;
    });
  }, [activeExam, searchTerm, filter]);

  // إحصائيات اللجنة الحالية
  const stats = useMemo(() => {
    if (!activeExam) return { total: 0, present: 0, absent: 0 };
    const total = activeExam.students.length;
    const present = activeExam.attendance.filter(a => a.status === AttendanceStatus.PRESENT).length;
    const absent = activeExam.attendance.filter(a => a.status === AttendanceStatus.ABSENT).length;
    return { total, present, absent };
  }, [activeExam]);

  // --- واجهة رقم 1: حالة انتظار مسح المظروف ---
  if (!activeExam) {
    return (
      <div className="min-h-screen bg-[#050b14] text-white flex flex-col items-center p-6 font-sans" dir="rtl">
        {/* هيدر المعلم */}
        <header className="w-full max-w-md flex justify-between items-center mb-12 mt-4 bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-md">
            <div className="flex items-center gap-3">
                <img src="https://up6.cc/2026/02/177116640037762.png" alt="شعار" className="h-10" />
                <div className="h-8 w-px bg-white/20"></div>
                <div className="text-right">
                    <p className="text-[10px] text-blue-400 font-bold">المعلم المراقب</p>
                    <h2 className="text-sm font-black truncate max-w-[150px]">{currentUser?.name}</h2>
                </div>
            </div>
            <button onClick={() => setUserRole(null)} className="p-2 text-red-400 hover:bg-red-400/10 rounded-full transition-all"><LogOut size={22}/></button>
        </header>

        <div className="w-full max-w-md flex-1 flex flex-col justify-center gap-8">
            <div className="text-center space-y-4">
                <div className="w-24 h-24 bg-blue-600 rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl shadow-blue-500/20 border-4 border-white/10 animate-pulse">
                    <QrCode size={48} className="text-white" />
                </div>
                <h1 className="text-2xl font-black">فتح مظروف اللجنة</h1>
                <p className="text-slate-400 font-medium px-8">قم بمسح الباركود الموجود على المظروف المسلم لك من الكنترول للبدء</p>
            </div>

            <div className="space-y-4">
                <button 
                    onClick={() => {
                        // هنا يتم استدعاء الكاميرا فعلياً
                        const manualCode = prompt("أدخل رقم اللجنة الموجود على المظروف (للتجربة):");
                        if(manualCode) handleBarcodeScanned(manualCode);
                    }}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-5 rounded-[1.5rem] font-black text-xl flex items-center justify-center gap-3 shadow-xl transition-all active:scale-95"
                >
                    <Camera size={28} />
                    مسح كود المظروف
                </button>
                
                <div className="bg-white/5 border border-white/10 p-4 rounded-2xl flex items-start gap-3">
                    <Info className="text-blue-400 shrink-0" size={20} />
                    <p className="text-xs text-slate-400 leading-relaxed">بمجرد المسح، سيقوم النظام بتسجيل وقت استلامك للمظروف وفتح قائمة تحضير الطلاب الخاصة بهذه اللجنة فقط.</p>
                </div>
            </div>
        </div>

        <footer className="mt-auto py-6 text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em]">
            ثانوية الأمير عبدالمجيد - جدة
        </footer>
      </div>
    );
  }

  // --- واجهة رقم 2: حالة اللجنة النشطة (بعد المسح) ---
  return (
    <div className="min-h-screen bg-slate-50 pb-32 font-sans" dir="rtl">
      {/* Header المظروف النشط */}
      <div className="bg-[#050b14] text-white p-6 rounded-b-[2.5rem] shadow-2xl sticky top-0 z-30 border-b-4 border-blue-600">
        <div className="flex justify-between items-start mb-6">
            <div>
                <div className="flex items-center gap-2 mb-2">
                    <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-[10px] font-black tracking-tighter uppercase">اللجنة نشطة</span>
                    <span className="text-slate-400 text-[10px] font-bold">{activeExam.period}</span>
                </div>
                <h2 className="text-2xl font-black">{activeExam.subject}</h2>
                <div className="flex items-center gap-2 text-blue-400 text-sm font-bold mt-1">
                    <Users size={16} /> لجنة {activeExam.committeeNumber} • {activeExam.location}
                </div>
            </div>
            <div className="bg-white/5 backdrop-blur-md p-3 rounded-2xl border border-white/10 text-center min-w-[80px]">
                <Clock size={18} className="mx-auto mb-1 text-yellow-400" />
                <span className="text-sm font-black block">{activeExam.endTime}</span>
                <span className="text-[8px] text-slate-400 font-bold uppercase">End Time</span>
            </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
            <input 
                type="text" 
                placeholder="ابحث عن طالب في هذه اللجنة..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-2xl py-4 px-12 text-sm focus:bg-white focus:text-slate-900 outline-none transition-all placeholder-white/30 font-bold"
            />
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30" size={20} />
        </div>
      </div>

      {/* Tabs للتصفية */}
      <div className="flex gap-2 p-4 overflow-x-auto no-scrollbar sticky top-[195px] z-20 bg-slate-50/90 backdrop-blur-md border-b border-slate-200">
          <FilterTab label="الكل" count={stats.total} active={filter === 'all'} onClick={() => setFilter('all')} />
          <FilterTab label="حاضر" count={stats.present} active={filter === 'present'} onClick={() => setFilter('present')} color="bg-green-500" />
          <FilterTab label="غائب" count={stats.absent} active={filter === 'absent'} onClick={() => setFilter('absent')} color="bg-red-500" />
          <FilterTab label="بانتظار" count={stats.total - (stats.present + stats.absent)} active={filter === 'pending'} onClick={() => setFilter('pending')} color="bg-slate-400" />
      </div>

      {/* قائمة الطلاب الحصرية لهذه اللجنة */}
      <div className="p-4 space-y-3">
        {filteredStudents.length === 0 ? (
            <div className="py-20 text-center text-slate-400 font-bold">لا يوجد نتائج تطابق البحث</div>
        ) : (
            filteredStudents.map(student => {
                const record = activeExam.attendance.find(a => a.studentId === student.id);
                const isPresent = record?.status === AttendanceStatus.PRESENT;
                const isAbsent = record?.status === AttendanceStatus.ABSENT;

                return (
                    <div key={student.id} className={`bg-white rounded-3xl p-5 shadow-sm border transition-all flex items-center justify-between ${isPresent ? 'border-green-100' : isAbsent ? 'border-red-100' : 'border-slate-100'}`}>
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center font-black text-slate-400 border border-slate-200 overflow-hidden">
                                    {student.name.charAt(0)}
                                </div>
                                {isPresent && <div className="absolute -top-1 -right-1 bg-green-500 text-white rounded-full border-4 border-white p-1 shadow-lg"><CheckCircle size={12}/></div>}
                                {isAbsent && <div className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full border-4 border-white p-1 shadow-lg"><AlertCircle size={12}/></div>}
                            </div>
                            <div>
                                <h4 className="font-black text-slate-800 text-base">{student.name}</h4>
                                <div className="flex gap-2 mt-1">
                                    <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md font-bold">مقعد: {student.seatNumber}</span>
                                    <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md font-bold">{student.grade}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button 
                                onClick={() => markAttendance(activeExam.id, student.id, AttendanceStatus.PRESENT)}
                                className={`p-3 rounded-2xl transition-all active:scale-90 ${isPresent ? 'bg-green-500 text-white shadow-lg shadow-green-200' : 'bg-slate-100 text-slate-400 hover:bg-green-50'}`}
                            >
                                <UserCheck size={24} />
                            </button>
                            <button 
                                onClick={() => markAttendance(activeExam.id, student.id, AttendanceStatus.ABSENT)}
                                className={`p-3 rounded-2xl transition-all active:scale-90 ${isAbsent ? 'bg-red-500 text-white shadow-lg shadow-red-200' : 'bg-slate-100 text-slate-400 hover:bg-red-50'}`}
                            >
                                <UserX size={24} />
                            </button>
                        </div>
                    </div>
                );
            })
        )}
      </div>

      {/* شريط الإجراءات السفلي (إنهاء اللجنة) */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/80 backdrop-blur-xl border-t border-slate-200 z-40 pb-safe shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
          <button 
            onClick={() => setShowConfirmSubmit(true)}
            className="w-full bg-[#050b14] text-white py-5 rounded-[1.5rem] font-black text-lg flex items-center justify-center gap-3 shadow-2xl shadow-blue-900/20 active:scale-95 transition-all"
          >
              <Send size={24} className="text-blue-400" />
              إنهاء الرصد وتسليم المظروف
          </button>
      </div>

      {/* نافذة تأكيد الإرسال النهائي */}
      {showConfirmSubmit && (
          <div className="fixed inset-0 bg-[#050b14]/80 backdrop-blur-sm z-[60] flex items-center justify-center p-6">
              <div className="bg-white rounded-[2.5rem] w-full max-w-sm p-8 text-center animate-scale-in shadow-2xl border border-white/20">
                  <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-6 rotate-3">
                      <ShieldCheck size={40} />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 mb-2">إنهاء اللجنة؟</h3>
                  <p className="text-slate-500 text-sm mb-8 leading-relaxed font-medium">سيتم إرسال محضر الغياب النهائي (عدد: {stats.absent}) للكنترول والمرشد الطلابي ولا يمكن التعديل بعد ذلك.</p>
                  
                  <div className="flex gap-3">
                      <button onClick={() => setShowConfirmSubmit(false)} className="flex-1 py-4 font-bold text-slate-400 hover:text-slate-600 transition-colors">تراجع</button>
                      <button 
                        onClick={() => {
                            submitEnvelope(activeExam.id);
                            setShowConfirmSubmit(false);
                        }}
                        className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-black shadow-lg shadow-blue-200 active:scale-95 transition-all"
                      >
                          اعتماد وتسليم
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

const FilterTab = ({ label, count, active, onClick, color = "bg-blue-600" }: any) => (
    <button 
        onClick={onClick}
        className={`flex items-center gap-2 px-4 py-3 rounded-2xl border transition-all whitespace-nowrap font-black text-xs ${
            active ? 'bg-white border-slate-300 shadow-sm text-slate-800 scale-105' : 'bg-transparent border-transparent text-slate-400'
        }`}
    >
        <span className={`w-2 h-2 rounded-full ${active ? color : 'bg-slate-300'}`}></span>
        {label}
        <span className={`px-2 py-0.5 rounded-lg text-[10px] ${active ? 'bg-slate-100 text-slate-800' : 'bg-slate-200/50 text-slate-400'}`}>{count}</span>
    </button>
);
