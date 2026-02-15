import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { AttendanceStatus, EnvelopeStatus, Student } from '../../types';
import { 
  QrCode, UserCheck, UserX, Search, Clock, 
  CheckCircle, AlertCircle, LogOut, ShieldCheck, 
  Users, Send, Camera, Info, Layers, RefreshCw
} from 'lucide-react';
import { Scanner } from './Scanner'; // الاعتماد على مكون الماسح المرفوع

export const TeacherDashboard: React.FC = () => {
  const { 
    exams, currentUser, activeExamId, setActiveExamId,
    markAttendance, submitEnvelope, setUserRole 
  } = useApp();

  const [isScanningMode, setIsScanningMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'present' | 'absent' | 'pending'>('all');

  // 1. تحديد الاختبار النشط بناءً على المسح (RECEIVED) والارتباط بالمعلم الحالي
  const activeExam = useMemo(() => {
    return exams.find(e => 
      e.id === activeExamId || 
      (e.teacherId === currentUser?.id && e.status === EnvelopeStatus.RECEIVED)
    );
  }, [exams, activeExamId, currentUser]);

  // تحديث المعرف النشط في AppContext لضمان استمرارية الجلسة
  useEffect(() => {
    if (activeExam && activeExam.id !== activeExamId) {
        setActiveExamId(activeExam.id);
    }
  }, [activeExam, activeExamId, setActiveExamId]);

  // 2. منطق الترتيب التصاعدي للمراحل (أول ثانوي -> ثاني -> ثالث)
  const sortedGroupedStudents = useMemo(() => {
    if (!activeExam) return {};
    
    const groups: { [key: string]: Student[] } = {};
    
    // فلترة الطلاب حسب البحث والدمج في المجموعات
    activeExam.students.forEach(student => {
      const matchesSearch = student.name.includes(searchTerm) || student.seatNumber.includes(searchTerm);
      if (matchesSearch) {
          const key = student.grade;
          if (!groups[key]) groups[key] = [];
          groups[key].push(student);
      }
    });

    // دالة الأوزان لضمان ترتيب: أول ثانوي (1)، ثاني ثانوي (2)، ثالث ثانوي (3)
    const getGradeWeight = (grade: string) => {
        if (grade.includes('أول') || grade.includes('1')) return 1;
        if (grade.includes('ثاني') || grade.includes('2')) return 2;
        if (grade.includes('ثالث') || grade.includes('3')) return 3;
        return 4;
    };

    // إعادة بناء المجموعات مرتبة
    const sortedKeys = Object.keys(groups).sort((a, b) => getGradeWeight(a) - getGradeWeight(b));
    const sortedGroups: { [key: string]: Student[] } = {};
    sortedKeys.forEach(key => {
        sortedGroups[key] = groups[key];
    });

    return sortedGroups;
  }, [activeExam, searchTerm]);

  // إحصائيات اللجنة الحالية
  const stats = useMemo(() => {
    if (!activeExam) return { total: 0, present: 0, absent: 0 };
    const total = activeExam.students.length;
    const present = activeExam.attendance.filter(a => a.status === AttendanceStatus.PRESENT).length;
    const absent = activeExam.attendance.filter(a => a.status === AttendanceStatus.ABSENT).length;
    return { total, present, absent };
  }, [activeExam]);

  // عند نجاح المسح، نغلق وضع الكاميرا
  const onScanSuccess = () => {
    setIsScanningMode(false);
  };

  // --- الحالة 1: شاشة المسح (تظهر عند عدم وجود لجنة أو عند طلب تغيير اللجنة) ---
  if (!activeExam || isScanningMode) {
    return (
      <div className="min-h-screen bg-[#050b14] text-white flex flex-col font-sans" dir="rtl">
        <header className="p-6 flex justify-between items-center border-b border-white/10 backdrop-blur-md sticky top-0 z-50">
            <div className="flex items-center gap-3">
                <img src="https://up6.cc/2026/02/177116640037762.png" alt="شعار" className="h-10" />
                <div className="text-right">
                    <h2 className="text-white text-sm font-black">ثانوية الأمير عبدالمجيد</h2>
                    <p className="text-blue-400 text-[10px] font-bold">نظام الاختبارات الذكي</p>
                </div>
            </div>
            {activeExam && (
                 <button onClick={() => setIsScanningMode(false)} className="text-white/60 text-sm font-bold">تراجع</button>
            )}
        </header>

        <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-10">
            <div className="text-center space-y-4 max-w-xs">
                <div className="w-24 h-24 bg-blue-600 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-2xl border-4 border-white/5 animate-pulse">
                    <QrCode size={48} className="text-white" />
                </div>
                <h1 className="text-2xl font-black">{isScanningMode ? "تغيير اللجنة" : "بدء العمل"}</h1>
                <p className="text-slate-400 text-sm leading-relaxed">يرجى توجيه الكاميرا نحو رمز QR المطبوع على مظروف اللجنة لفتح بيانات الطلاب.</p>
            </div>

            <div className="w-full max-w-sm rounded-[2rem] overflow-hidden shadow-2xl border border-white/10">
                <Scanner onScanSuccess={onScanSuccess} />
            </div>
        </div>

        <footer className="py-8 text-center">
            <button onClick={() => setUserRole(null)} className="text-red-400 flex items-center gap-2 mx-auto font-bold text-sm bg-red-400/5 px-6 py-2 rounded-full border border-red-400/20">
                <LogOut size={18}/> تسجيل الخروج
            </button>
        </footer>
      </div>
    );
  }

  // --- الحالة 2: شاشة اللجنة النشطة (تضم جميع المراحل والطلاب) ---
  return (
    <div className="min-h-screen bg-slate-50 pb-36 font-sans text-right" dir="rtl">
      {/* الهيدر الغامق المعتمد */}
      <div className="bg-[#050b14] text-white p-6 rounded-b-[2.5rem] shadow-2xl sticky top-0 z-30 border-b-4 border-blue-600">
        <div className="flex justify-between items-start mb-6">
            <div className="space-y-1">
                <div className="flex items-center gap-2 mb-2">
                    <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase shadow-lg shadow-blue-900/50">اللجنة نشطة</span>
                    <button 
                        onClick={() => setIsScanningMode(true)}
                        className="flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-lg text-[10px] font-bold text-blue-300 hover:bg-white/20 transition-all border border-white/5"
                    >
                        <RefreshCw size={12} /> إعادة المسح
                    </button>
                </div>
                <h2 className="text-2xl font-black">{activeExam.subject}</h2>
                <div className="flex items-center gap-2 text-blue-400 text-sm font-bold">
                    <Users size={16} /> لجنة {activeExam.committeeNumber} • {activeExam.location}
                </div>
            </div>
            <div className="bg-white/5 backdrop-blur-md p-4 rounded-3xl border border-white/10 text-center min-w-[90px] shadow-inner">
                <Clock size={20} className="mx-auto mb-1 text-yellow-400" />
                <span className="text-base font-black block leading-none">{activeExam.endTime}</span>
                <span className="text-[8px] text-slate-500 font-bold mt-1 block uppercase">نهاية الفترة</span>
            </div>
        </div>

        <div className="relative group">
            <input 
                type="text" 
                placeholder="ابحث عن طالب في هذه اللجنة..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white/10 border border-white/10 rounded-2xl py-4 px-12 text-sm focus:bg-white focus:text-slate-900 outline-none transition-all placeholder-white/30 font-bold shadow-inner"
            />
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30" size={20} />
        </div>
      </div>

      {/* شريط الفلاتر */}
      <div className="flex gap-2 p-4 overflow-x-auto no-scrollbar sticky top-[195px] z-20 bg-slate-50/90 backdrop-blur-md border-b border-slate-200">
          <FilterTab label="الكل" count={stats.total} active={filter === 'all'} onClick={() => setFilter('all')} />
          <FilterTab label="حاضر" count={stats.present} active={filter === 'present'} onClick={() => setFilter('present')} color="bg-green-500" />
          <FilterTab label="غائب" count={stats.absent} active={filter === 'absent'} onClick={() => setFilter('absent')} color="bg-red-500" />
          <FilterTab label="بانتظار" count={stats.total - (stats.present + stats.absent)} active={filter === 'pending'} onClick={() => setFilter('pending')} color="bg-slate-400" />
      </div>

      {/* قائمة الطلاب المجمعة والمرتبة تصاعدياً */}
      <div className="p-4 space-y-10">
        {Object.entries(sortedGroupedStudents).map(([gradeTitle, students]) => {
            // تطبيق فلتر الحضور على قائمة الطلاب في كل مرحلة
            const displayedStudents = students.filter(s => {
                const record = activeExam.attendance.find(a => a.studentId === s.id);
                if (filter === 'present') return record?.status === AttendanceStatus.PRESENT;
                if (filter === 'absent') return record?.status === AttendanceStatus.ABSENT;
                if (filter === 'pending') return !record || record.status === AttendanceStatus.UNKNOWN;
                return true;
            });

            if (displayedStudents.length === 0) return null;

            return (
                <div key={gradeTitle} className="space-y-4 animate-fade-in">
                    <h3 className="font-black text-slate-800 flex items-center gap-3 border-r-4 border-blue-600 pr-4 py-1">
                        <Layers size={22} className="text-blue-600" />
                        {gradeTitle}
                        <span className="text-[10px] font-bold text-slate-500 bg-blue-100/50 px-3 py-1 rounded-full">{students.length} طالب</span>
                    </h3>

                    <div className="grid grid-cols-1 gap-3">
                        {displayedStudents.map(student => {
                            const record = activeExam.attendance.find(a => a.studentId === student.id);
                            const isPresent = record?.status === AttendanceStatus.PRESENT;
                            const isAbsent = record?.status === AttendanceStatus.ABSENT;

                            return (
                                <div key={student.id} className={`bg-white rounded-[2rem] p-5 shadow-sm border-2 transition-all flex items-center justify-between ${isPresent ? 'border-green-100 shadow-green-50/50' : isAbsent ? 'border-red-100 shadow-red-50/50' : 'border-slate-100'}`}>
                                    <div className="flex items-center gap-4">
                                        <div className="relative">
                                            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center font-black text-2xl text-slate-300 border border-slate-100 overflow-hidden shadow-inner">
                                                {student.name.charAt(0)}
                                            </div>
                                            {isPresent && <div className="absolute -top-1 -right-1 bg-green-500 text-white rounded-full border-4 border-white p-1 shadow-lg animate-scale-in"><CheckCircle size={14}/></div>}
                                            {isAbsent && <div className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full border-4 border-white p-1 shadow-lg animate-scale-in"><AlertCircle size={14}/></div>}
                                        </div>
                                        <div>
                                            <h4 className="font-black text-slate-800 text-base leading-tight mb-1">{student.name}</h4>
                                            <div className="flex gap-2">
                                                <span className="text-[10px] bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg font-bold shadow-sm">مقعد: {student.seatNumber}</span>
                                                <span className="text-[10px] text-blue-500 font-black uppercase tracking-tighter">{student.className}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => markAttendance(activeExam.id, student.id, AttendanceStatus.PRESENT)}
                                            className={`p-4 rounded-2xl transition-all active:scale-90 ${isPresent ? 'bg-green-500 text-white shadow-xl shadow-green-200 ring-4 ring-green-50' : 'bg-slate-50 text-slate-400 hover:bg-green-50'}`}
                                        >
                                            <UserCheck size={28} strokeWidth={2.5} />
                                        </button>
                                        <button 
                                            onClick={() => markAttendance(activeExam.id, student.id, AttendanceStatus.ABSENT)}
                                            className={`p-4 rounded-2xl transition-all active:scale-90 ${isAbsent ? 'bg-red-500 text-white shadow-xl shadow-red-200 ring-4 ring-red-50' : 'bg-slate-50 text-slate-400 hover:bg-red-50'}`}
                                        >
                                            <UserX size={28} strokeWidth={2.5} />
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

      {/* إجراء الإنهاء السفلي */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/80 backdrop-blur-2xl border-t border-slate-200 z-40 pb-safe shadow-[0_-20px_40px_rgba(0,0,0,0.05)]">
          <button 
            onClick={() => {
                if(window.confirm('تنبيه: هل أنت متأكد من إنهاء رصد الغياب لهذه اللجنة؟ لا يمكن التعديل بعد ذلك.')) {
                    submitEnvelope(activeExam.id);
                }
            }}
            className="w-full bg-[#050b14] text-white py-5 rounded-3xl font-black text-xl flex items-center justify-center gap-3 shadow-2xl shadow-blue-900/30 active:scale-95 transition-all"
          >
              <Send size={24} className="text-blue-400" />
              إنهاء اللجنة وتسليم المظروف
          </button>
      </div>
    </div>
  );
};

// مكون تبويب التصفية
const FilterTab = ({ label, count, active, onClick, color = "bg-blue-600" }: any) => (
    <button 
        onClick={onClick}
        className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl border-2 transition-all whitespace-nowrap font-black text-xs ${
            active ? 'bg-white border-blue-600 shadow-lg text-slate-800 scale-105' : 'bg-transparent border-transparent text-slate-400'
        }`}
    >
        <span className={`w-2 h-2 rounded-full ${active ? color : 'bg-slate-300'}`}></span>
        {label}
        <span className={`px-2 py-0.5 rounded-lg text-[10px] ${active ? 'bg-slate-100 text-blue-800' : 'bg-slate-200/50 text-slate-400'}`}>{count}</span>
    </button>
);
