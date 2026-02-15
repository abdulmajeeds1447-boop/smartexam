import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { AttendanceStatus, EnvelopeStatus, Student } from '../../types';
import { 
  QrCode, UserCheck, UserX, Search, Clock, 
  CheckCircle, AlertCircle, LogOut, ShieldCheck, 
  Users, Send, Camera, Info, Layers, RefreshCw
} from 'lucide-react';

export const TeacherDashboard: React.FC = () => {
  const { 
    exams, currentUser, activeExamId, setActiveExamId,
    processCommitteeScan, markAttendance, submitEnvelope, setUserRole 
  } = useApp();

  const [isScanningMode, setIsScanningMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'present' | 'absent' | 'pending'>('all');
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);

  // 1. الحصر الذكي: تحديد الاختبار المرتبط بهذا المعلم حالياً (بناءً على المسح فقط)
  const activeExam = useMemo(() => {
    return exams.find(e => 
      e.id === activeExamId || 
      (e.teacherId === currentUser?.id && e.status === EnvelopeStatus.RECEIVED)
    );
  }, [exams, activeExamId, currentUser]);

  // تحديث المعرف النشط تلقائياً عند التعرف عليه
  useEffect(() => {
    if (activeExam && activeExam.id !== activeExamId) {
        setActiveExamId(activeExam.id);
    }
  }, [activeExam, activeExamId, setActiveExamId]);

  // 2. منطق الترتيب التصاعدي للمراحل (أول -> ثاني -> ثالث)
  const sortedGroupedStudents = useMemo(() => {
    if (!activeExam) return {};
    
    // تجميع الطلاب حسب المرحلة
    const groups: { [key: string]: Student[] } = {};
    activeExam.students.forEach(student => {
      const key = student.grade;
      if (!groups[key]) groups[key] = [];
      groups[key].push(student);
    });

    // ترتيب المجموعات بناءً على وزن المرحلة (أول ثانوي = 1، ثاني = 2، ثالث = 3)
    const getWeight = (s: string) => {
        if (s.includes('أول') || s.includes('اول') || s.includes('1')) return 1;
        if (s.includes('ثاني') || s.includes('2')) return 2;
        if (s.includes('ثالث') || s.includes('3')) return 3;
        return 4;
    };

    const sortedKeys = Object.keys(groups).sort((a, b) => getWeight(a) - getWeight(b));
    
    const sortedGroups: { [key: string]: Student[] } = {};
    sortedKeys.forEach(key => {
        sortedGroups[key] = groups[key];
    });

    return sortedGroups;
  }, [activeExam]);

  // دالة معالجة المسح (تستخدم للمسح الأول أو إعادة المسح)
  const handleBarcodeScanned = async (committeeData: string) => {
    if (!currentUser) return;
    
    let committeeNum = committeeData;
    try {
        const parsed = JSON.parse(committeeData);
        if (parsed.type === 'committee') committeeNum = parsed.id;
    } catch (e) {
        committeeNum = committeeData.replace(/\D/g, ''); 
    }

    const result = await processCommitteeScan(committeeNum, currentUser.id);
    if (result.success) {
        setIsScanningMode(false);
    } else {
        alert(result.message || "عذراً، هذا المظروف غير مجدول لك حالياً");
    }
  };

  // تصفية الطلاب للجنة النشطة
  const filteredStudentsByGroup = (students: Student[]) => {
    return students.filter(student => {
      const record = activeExam?.attendance.find(a => a.studentId === student.id);
      const matchesSearch = student.name.includes(searchTerm) || student.seatNumber.includes(searchTerm);
      
      if (filter === 'present') return matchesSearch && record?.status === AttendanceStatus.PRESENT;
      if (filter === 'absent') return matchesSearch && record?.status === AttendanceStatus.ABSENT;
      if (filter === 'pending') return matchesSearch && (!record || record.status === AttendanceStatus.UNKNOWN);
      return matchesSearch;
    });
  };

  const stats = useMemo(() => {
    if (!activeExam) return { total: 0, present: 0, absent: 0 };
    const total = activeExam.students.length;
    const present = activeExam.attendance.filter(a => a.status === AttendanceStatus.PRESENT).length;
    const absent = activeExam.attendance.filter(a => a.status === AttendanceStatus.ABSENT).length;
    return { total, present, absent };
  }, [activeExam]);

  // --- واجهة رقم 1: حالة انتظار المسح أو إعادة المسح ---
  if (!activeExam || isScanningMode) {
    return (
      <div className="min-h-screen bg-[#050b14] text-white flex flex-col items-center p-6 font-sans" dir="rtl">
        <header className="w-full max-w-md flex justify-between items-center mb-12 mt-4 bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-md">
            <div className="flex items-center gap-3">
                <img src="https://up6.cc/2026/02/177116640037762.png" alt="شعار" className="h-10" />
                <div className="text-right">
                    <p className="text-[10px] text-blue-400 font-bold">المعلم المراقب</p>
                    <h2 className="text-sm font-black truncate max-w-[150px]">{currentUser?.name}</h2>
                </div>
            </div>
            {activeExam && (
                 <button onClick={() => setIsScanningMode(false)} className="p-2 text-white/50 hover:text-white"><X size={20}/></button>
            )}
        </header>

        <div className="w-full max-w-md flex-1 flex flex-col justify-center gap-8 text-center">
            <div className="w-24 h-24 bg-blue-600 rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl animate-pulse">
                <QrCode size={48} className="text-white" />
            </div>
            <h1 className="text-2xl font-black">{isScanningMode ? "إعادة مسح المظروف" : "فتح مظروف اللجنة"}</h1>
            <p className="text-slate-400">قم بمسح الباركود الموجود على المظروف المسلم لك للبدء</p>

            <button 
                onClick={() => {
                    const manualCode = prompt("أدخل رقم اللجنة الموجود على المظروف:");
                    if(manualCode) handleBarcodeScanned(manualCode);
                }}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-5 rounded-[1.5rem] font-black text-xl flex items-center justify-center gap-3 shadow-xl transition-all active:scale-95"
            >
                <Camera size={28} />
                مسح كود المظروف
            </button>
        </div>
      </div>
    );
  }

  // --- واجهة رقم 2: حالة اللجنة النشطة (بعد المسح) ---
  return (
    <div className="min-h-screen bg-slate-50 pb-32 font-sans" dir="rtl">
      {/* Header المظروف النشط مع إمكانية المسح دائماً */}
      <div className="bg-[#050b14] text-white p-6 rounded-b-[2.5rem] shadow-2xl sticky top-0 z-30 border-b-4 border-blue-600">
        <div className="flex justify-between items-start mb-6">
            <div>
                <div className="flex items-center gap-2 mb-2">
                    <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase">اللجنة نشطة</span>
                    {/* زر المسح المتاح دائماً */}
                    <button 
                        onClick={() => setIsScanningMode(true)}
                        className="flex items-center gap-1 bg-white/10 px-2 py-1 rounded-lg text-[10px] font-bold text-blue-300 hover:bg-white/20 transition-all"
                    >
                        <RefreshCw size={12} /> تغيير اللجنة
                    </button>
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

      {/* قائمة الطلاب المرتبة تصاعدياً حسب المرحلة */}
      <div className="p-4 space-y-8">
        {Object.entries(sortedGroupedStudents).map(([gradeTitle, students]) => {
            const displayStudents = filteredStudentsByGroup(students);
            if (displayStudents.length === 0) return null;

            return (
                <div key={gradeTitle} className="space-y-3 animate-fade-in">
                    <h3 className="font-black text-slate-800 flex items-center gap-2 border-r-4 border-blue-600 pr-3">
                        <Layers size={18} className="text-blue-600" />
                        {gradeTitle}
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{students.length} طالب</span>
                    </h3>

                    <div className="grid grid-cols-1 gap-3">
                        {displayStudents.map(student => {
                            const record = activeExam.attendance.find(a => a.studentId === student.id);
                            const isPresent = record?.status === AttendanceStatus.PRESENT;
                            const isAbsent = record?.status === AttendanceStatus.ABSENT;

                            return (
                                <div key={student.id} className={`bg-white rounded-3xl p-5 shadow-sm border transition-all flex items-center justify-between ${isPresent ? 'border-green-100 shadow-green-50' : isAbsent ? 'border-red-100 shadow-red-50' : 'border-slate-100'}`}>
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
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => markAttendance(activeExam.id, student.id, AttendanceStatus.PRESENT)}
                                            className={`p-3 rounded-2xl transition-all active:scale-90 ${isPresent ? 'bg-green-500 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}
                                        >
                                            <UserCheck size={24} />
                                        </button>
                                        <button 
                                            onClick={() => markAttendance(activeExam.id, student.id, AttendanceStatus.ABSENT)}
                                            className={`p-3 rounded-2xl transition-all active:scale-90 ${isAbsent ? 'bg-red-500 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}
                                        >
                                            <UserX size={24} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        })}
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
                  <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
                      <ShieldCheck size={40} />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 mb-2">إنهاء اللجنة؟</h3>
                  <p className="text-slate-500 text-sm mb-8">سيتم إرسال محضر الغياب النهائي (عدد: {stats.absent}) للكنترول والمرشد الطلابي.</p>
                  
                  <div className="flex gap-3">
                      <button onClick={() => setShowConfirmSubmit(false)} className="flex-1 py-4 font-bold text-slate-400">تراجع</button>
                      <button 
                        onClick={() => {
                            submitEnvelope(activeExam.id);
                            setShowConfirmSubmit(false);
                        }}
                        className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-black shadow-lg"
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

// مكون تصفية القوائم
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
