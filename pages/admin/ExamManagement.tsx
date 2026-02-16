import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { QRCodeCanvas } from 'qrcode.react';
import { 
  Printer, X, CheckCircle, MapPin, 
  Play, Trash2, Database, Loader2, Clock, UserCheck, Search, ArrowRightLeft, Package, Sparkles, ScanLine
} from 'lucide-react';
import { EnvelopeStatus, ExamEnvelope, Student, AttendanceStatus } from '../../types';
import { doc, getDoc, getDocs, collection } from 'firebase/firestore'; 
import { db } from '../../firebase';
import { Scanner } from '../teacher/Scanner';
import { printCommitteeSticker } from '../../services/printService'; 

export const ExamManagement: React.FC = () => {
  const { exams, students, teachers, importExams, clearAllExams, deliverEnvelopeToControl, processAdminDeliveryScan } = useApp();
  
  const [selectedCommittee, setSelectedCommittee] = useState<any | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showReceiveScanner, setShowReceiveScanner] = useState(false);
  
  const [isFetching, setIsFetching] = useState(false);
  const [filterMode, setFilterMode] = useState<'TODAY' | 'ALL'>('TODAY');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [cloudSchedule, setCloudSchedule] = useState<any | null>(null);
  const [cloudCommitteesConfig, setCloudCommitteesConfig] = useState<Record<string, any>>({});

  // ✅ ميزة تجميد الخلفية: تمنع الصفحة الأصلية من التحرك عند فتح أي نافذة لضمان التركيز
  useEffect(() => {
    if (showReceiveScanner || selectedCommittee || showWizard || showDeleteModal) {
        document.body.style.overflow = 'hidden';
    } else {
        document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; }
  }, [showReceiveScanner, selectedCommittee, showWizard, showDeleteModal]);

  const examsByCommittee = useMemo(() => {
      const today = new Date().toISOString().split('T')[0];
      const filteredExams = exams.filter(e => {
          const matchesDate = filterMode === 'ALL' ? true : e.date === today;
          const matchesSearch = searchTerm ? (e.committeeNumber.includes(searchTerm) || e.location.includes(searchTerm) || e.subject.includes(searchTerm)) : true;
          return matchesDate && matchesSearch;
      });
      const groups: Record<string, ExamEnvelope[]> = {};
      filteredExams.forEach(exam => {
          if (!groups[exam.committeeNumber]) groups[exam.committeeNumber] = [];
          groups[exam.committeeNumber].push(exam);
      });
      return groups;
  }, [exams, filterMode, searchTerm]);

  const stats = useMemo(() => {
      const todayExams = exams.filter(e => e.date === new Date().toISOString().split('T')[0]);
      return {
          total: todayExams.length,
          active: todayExams.filter(e => e.status === EnvelopeStatus.RECEIVED).length,
          delivered: todayExams.filter(e => e.status === EnvelopeStatus.DELIVERED).length,
          pending: todayExams.filter(e => e.status === EnvelopeStatus.PENDING).length
      };
  }, [exams]);

  const getTeacherName = (idOrPhone: string) => {
      if (!idOrPhone) return '---';
      const t = teachers.find(teacher => teacher.id === idOrPhone || teacher.phone === idOrPhone);
      return t ? t.name : idOrPhone;
  };

  const handlePrintSticker = () => {
      const canvas = document.getElementById('committee-qr') as HTMLCanvasElement;
      if (!canvas) return;
      const imgUrl = canvas.toDataURL(); 
      const defaultSettings = {
          schoolName: 'ثانوية الأمير عبدالمجيد', adminName: 'الإدارة العامة للتعليم بمحافظة جدة', managerName: '', agentName: '', logoUrl: 'https://up6.cc/2026/02/177116640037762.png',
          doorLabelTitle: '', attendanceTitle: '', stickerTitle: '', showBorder: true, colSequence: '', colSeatId: '', colName: '', colStage: '', colPresence: '', colSignature: '', showColSequence: true, showColSeatId: true, showColName: true, showColStage: true, showColPresence: true, showColSignature: true
      };
      printCommitteeSticker(selectedCommittee.number, selectedCommittee.location, imgUrl, defaultSettings);
  };

  const fetchCloudData = async () => {
      setIsFetching(true);
      try {
          const scheduleSnap = await getDoc(doc(db, 'system_config', 'exam_schedule'));
          if (!scheduleSnap.exists()) throw new Error("لم يتم العثور على جدول.");
          setCloudSchedule(scheduleSnap.data());
          const configSnapshot = await getDocs(collection(db, 'system_config'));
          const configs: Record<string, any> = {};
          configSnapshot.forEach(docSnap => {
              const d = docSnap.data(); if (d.type === 'committee_meta') configs[d.committeeNumber] = d;
          });
          setCloudCommitteesConfig(configs);
          setShowWizard(true);
      } catch (error: any) { alert("تنبيه: " + error.message); } finally { setIsFetching(false); }
  };

  const handleGenerateFromCloud = () => {
      if (!cloudSchedule) return;
      const newExams: ExamEnvelope[] = [];
      const studentsMap: Record<string, Student[]> = {};
      students.forEach(s => { const cNum = s.committeeNumber || 'General'; if (!studentsMap[cNum]) studentsMap[cNum] = []; studentsMap[cNum].push(s); });
      cloudSchedule.days.forEach((day: any) => {
          day.periods.forEach((period: any) => {
              Object.keys(studentsMap).forEach(commNum => {
                  const commStudents = studentsMap[commNum];
                  const commConfig = cloudCommitteesConfig[commNum];
                  const affectedStudents: Student[] = [];
                  const gradesInEnvelope: string[] = [];
                  const subjectsInEnvelope: string[] = [];
                  let startTime = "07:30"; let endTime = "10:00";
                  commStudents.forEach(student => {
                      const stageKey = Object.keys(period.subjects || {}).find(k => student.grade.includes(k));
                      if (stageKey && period.subjects[stageKey]) {
                          const subj = period.subjects[stageKey];
                          affectedStudents.push({ ...student, subject: subj.name });
                          if (!gradesInEnvelope.includes(student.grade)) gradesInEnvelope.push(student.grade);
                          const cleanSubject = subj.name.trim();
                          if (!subjectsInEnvelope.includes(cleanSubject)) subjectsInEnvelope.push(cleanSubject);
                          startTime = subj.startTime; endTime = subj.endTime;
                      }
                  });
                  if (affectedStudents.length > 0) {
                      const commIndex = parseInt(commNum) - 1;
                      const assignedTeacherName = (period.main && period.main[commIndex]) || null;
                      newExams.push({
                          id: `EX-${commNum}-${day.date}-P${period.periodId}`, subject: [...new Set(subjectsInEnvelope)].join(' + '),
                          grades: gradesInEnvelope, committeeNumber: commNum, location: commConfig?.location || `مقر ${commNum}`, date: day.date,
                          startTime, endTime, period: period.periodId === 1 ? 'الفترة الأولى' : 'الفترة الثانية', status: EnvelopeStatus.PENDING,
                          students: affectedStudents, attendance: affectedStudents.map(s => ({ studentId: s.id, status: AttendanceStatus.PRESENT })), teacherId: assignedTeacherName
                      });
                  }
              });
          });
      });
      importExams(newExams);
      setShowWizard(false);
      alert(`✅ تم إنشاء ${newExams.length} مظروف اختبار بنجاح!`);
  };

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      
      {/* 1. Header & Stats Area */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden">
        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-center gap-6">
            <div>
                <h2 className="text-3xl font-black text-slate-800 flex items-center gap-3">غرفة عمليات الكنترول</h2>
                <p className="text-gray-500 mt-2 font-medium">إدارة شاملة لدورة حياة الاختبارات</p>
            </div>
            <div className="flex gap-3">
                <button onClick={() => setShowReceiveScanner(true)} className="bg-green-600 text-white px-6 py-3 rounded-2xl hover:bg-green-700 shadow-xl font-bold flex items-center gap-2 active:scale-95 transition-all"><ScanLine size={20} /><span>استلام مظروف (Scan)</span></button>
                <button onClick={fetchCloudData} disabled={isFetching} className={`bg-slate-900 text-white px-6 py-3 rounded-2xl hover:bg-slate-800 shadow-xl transition-all font-bold flex items-center gap-2 ${isFetching ? 'opacity-70 cursor-wait' : ''}`}>{isFetching ? <Loader2 size={20} className="animate-spin" /> : <Play size={20} className="text-yellow-400" />}<span>جلب الجدول</span></button>
                <button onClick={() => setShowDeleteModal(true)} className="bg-white text-red-500 border-2 border-red-50 p-3 rounded-2xl"><Trash2 size={20} /></button>
            </div>
        </div>
        <div className="grid grid-cols-4 gap-4 mt-8 pt-6 border-t border-gray-100">
            <div className="text-center border-l border-gray-100 last:border-0"><div className="text-3xl font-black text-slate-800">{stats.total}</div><div className="text-xs font-bold text-gray-400">مظروف اليوم</div></div>
            <div className="text-center border-l border-gray-100 last:border-0"><div className="text-3xl font-black text-yellow-500">{stats.active}</div><div className="text-xs font-bold text-gray-400">جاري الاختبار</div></div>
            <div className="text-center border-l border-gray-100 last:border-0"><div className="text-3xl font-black text-green-500">{stats.delivered}</div><div className="text-xs font-bold text-gray-400">تم الاستلام</div></div>
            <div className="text-center border-l border-gray-100 last:border-0"><div className="text-3xl font-black text-gray-400">{stats.pending}</div><div className="text-xs font-bold text-gray-400">قيد الانتظار</div></div>
        </div>
      </div>

      {/* 2. Controls & Search */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="relative w-full sm:w-96 group">
              <input type="text" placeholder="بحث..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-2xl shadow-sm outline-none font-bold text-gray-700"/>
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          </div>
          <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-gray-200">
              <button onClick={() => setFilterMode('TODAY')} className={`px-6 py-2 rounded-xl text-sm font-bold ${filterMode === 'TODAY' ? 'bg-slate-900 text-white shadow' : 'text-gray-500'}`}>اليوم</button>
              <button onClick={() => setFilterMode('ALL')} className={`px-6 py-2 rounded-xl text-sm font-bold ${filterMode === 'ALL' ? 'bg-slate-900 text-white shadow' : 'text-gray-500'}`}>الكل</button>
          </div>
      </div>

      {/* 3. Grid View */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {Object.entries(examsByCommittee).sort(([a], [b]) => a.localeCompare(b, 'en', {numeric: true})).map(([committeeNum, committeeExams]) => {
            const firstExam = committeeExams[0];
            const allGrades = Array.from(new Set(committeeExams.flatMap(e => e.grades)));
            return (
                <div key={committeeNum} className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden hover:shadow-xl transition-all duration-300 group">
                    <div className="bg-gradient-to-r from-slate-50 to-white p-5 border-b border-gray-100 flex justify-between items-start relative">
                        <div className="flex gap-4 items-center">
                            <div className="bg-white w-16 h-16 rounded-2xl flex flex-col items-center justify-center font-black text-3xl text-slate-800 shadow-sm border border-gray-100 relative z-10">{committeeNum}<span className="text-[9px] font-medium text-gray-400 -mt-1">لجنة</span></div>
                            <div>
                                <div className="font-bold text-slate-900 text-lg flex items-center gap-2"><MapPin size={18} className="text-red-500 fill-red-50"/>{firstExam.location}</div>
                                <div className="flex gap-1 mt-2 flex-wrap">{allGrades.map(g => <span key={g} className="text-[10px] bg-white border border-gray-200 px-2 py-1 rounded-lg text-gray-500 font-bold">{g}</span>)}</div>
                            </div>
                        </div>
                        <button onClick={() => setSelectedCommittee({number: committeeNum, location: firstExam.location})} className="text-gray-400 hover:text-slate-800 p-2 rounded-xl"><Printer size={20} /></button>
                    </div>
                    <div className="p-4 space-y-3 bg-gray-50/30">
                        {committeeExams.map(exam => {
                            const isDone = exam.status === EnvelopeStatus.COMPLETED || exam.status === EnvelopeStatus.DELIVERED;
                            return (
                                <div key={exam.id} className={`p-4 rounded-2xl border relative overflow-hidden transition-all bg-white shadow-sm ${isDone ? 'border-green-200' : 'border-gray-100'}`}>
                                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${exam.status === EnvelopeStatus.RECEIVED ? 'bg-blue-500 animate-pulse' : exam.status === EnvelopeStatus.COMPLETED ? 'bg-green-500' : exam.status === EnvelopeStatus.DELIVERED ? 'bg-slate-800' : 'bg-yellow-400'}`}></div>
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <h4 className="font-black text-gray-800 text-sm mb-1">{exam.subject}</h4>
                                            <div className="flex items-center gap-3 text-xs font-bold text-gray-500"><span><Clock size={12} className="inline ml-1"/>{exam.startTime}</span><span>|</span><span>{exam.period}</span></div>
                                            {exam.teacherId && <div className="flex items-center gap-1.5 text-[10px] text-blue-700 mt-2 font-bold bg-blue-50 px-2 py-1 rounded-lg w-fit"><UserCheck size={12} />{getTeacherName(exam.teacherId)}</div>}
                                        </div>
                                        <span className={`text-[9px] font-black px-2 py-1 rounded-lg ${exam.status === EnvelopeStatus.COMPLETED ? 'bg-green-50 text-green-700' : 'bg-slate-50 text-slate-500'}`}>{exam.status === EnvelopeStatus.DELIVERED ? 'مستلم' : exam.status === EnvelopeStatus.COMPLETED ? 'جاهز' : 'انتظار'}</span>
                                    </div>
                                    <div className="border-t border-gray-50 pt-2 mt-2 pl-2">
                                        {exam.status === EnvelopeStatus.COMPLETED && (
                                            <button onClick={() => { if(window.confirm(`استلام مظروف ${exam.subject}؟`)) deliverEnvelopeToControl(exam.id); }} className="w-full bg-slate-900 text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-[0.98]"><ArrowRightLeft size={14} className="text-green-400" /> استلام المظروف</button>
                                        )}
                                        {exam.status === EnvelopeStatus.DELIVERED && <div className="w-full bg-green-50 text-green-700 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border border-green-100"><CheckCircle size={14} /> محفوظ في الكنترول</div>}
                                        {exam.status === EnvelopeStatus.RECEIVED && <div className="text-center"><span className="text-[10px] text-blue-500 font-bold animate-pulse">● الاختبار قائم حالياً</span></div>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        })}
      </div>

      {/* ✅✅✅ [الحل الجذري للمشكلة] ✅✅✅ */}
      {/* تم جعل جميع النوافذ FIXED لتظهر في منتصف الشاشة المرئية تماماً بغض النظر عن طول الصفحة */}

      {/* 1. مودال الاستلام بالماسح */}
      {showReceiveScanner && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in">
            <div className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-scale-in">
                <button onClick={() => setShowReceiveScanner(false)} className="absolute top-4 left-4 z-[101] bg-black/40 p-2 rounded-full text-white transition-colors"><X size={24}/></button>
                <div className="h-[450px] bg-black"><Scanner onScanSuccess={() => setTimeout(() => setShowReceiveScanner(false), 1500)} customProcessor={processAdminDeliveryScan} /></div>
                <div className="bg-slate-900 text-white p-6 text-center"><h3 className="text-xl font-bold mb-1">وضع الاستلام</h3><p className="text-slate-400 text-sm">وجه الكاميرا نحو باركود المظروف</p></div>
            </div>
        </div>
      )}

      {/* 2. مودال QR والملصق */}
      {selectedCommittee && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-sm bg-white rounded-[2.5rem] p-8 text-center shadow-2xl animate-scale-in">
             <button onClick={() => setSelectedCommittee(null)} className="absolute top-4 left-4 p-2 bg-gray-100 rounded-full transition-colors"><X size={20}/></button>
             <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 block">رقم اللجنة</span>
             <h3 className="text-6xl font-black mb-4 text-slate-800">{selectedCommittee.number}</h3>
             <div className="bg-gray-50 px-4 py-2 rounded-xl text-gray-600 font-bold mb-6 inline-flex items-center gap-2 border border-gray-100"><MapPin size={16} className="text-red-500" />{selectedCommittee.location}</div>
             <div className="border-4 border-slate-900 p-4 rounded-[2rem] inline-block mb-8 bg-white shadow-xl">
                <QRCodeCanvas id="committee-qr" value={JSON.stringify({ type: 'committee', id: selectedCommittee.number })} size={220} level="H" includeMargin />
             </div>
             <button onClick={handlePrintSticker} className="w-full bg-slate-900 text-white py-5 rounded-[1.5rem] font-black text-lg flex items-center justify-center gap-3 hover:bg-slate-800 shadow-xl transition-all active:scale-95">
                <Printer size={22}/> طباعة الملصق التعريفي
             </button>
          </div>
        </div>
      )}

      {/* 3. مودال مراجعة البيانات (Wizard) */}
      {showWizard && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
              <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden animate-scale-in">
                  <div className="bg-slate-900 p-8 text-white relative">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>
                      <h3 className="font-bold text-2xl flex items-center gap-3 relative z-10"><Database className="text-green-400" /> مراجعة البيانات</h3>
                  </div>
                  <div className="p-8 space-y-6">
                      <div className="space-y-4">
                          <div className="flex justify-between items-center p-5 bg-gray-50 rounded-2xl border border-gray-100"><span className="text-gray-500 font-bold text-sm">أيام الاختبارات</span><span className="text-xl font-black text-slate-800">{cloudSchedule?.days.length} أيام</span></div>
                          <div className="flex justify-between items-center p-5 bg-gray-50 rounded-2xl border border-gray-100"><span className="text-gray-500 font-bold text-sm">عدد اللجان</span><span className="text-xl font-black text-slate-800">{Object.keys(cloudCommitteesConfig).length} لجنة</span></div>
                      </div>
                      <div className="flex gap-3 pt-4">
                          <button onClick={() => setShowWizard(false)} className="flex-1 bg-gray-100 py-4 rounded-2xl font-bold text-gray-600 hover:bg-gray-200 transition">إلغاء</button>
                          <button onClick={handleGenerateFromCloud} className="flex-[2] bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-xl shadow-blue-200 flex items-center justify-center gap-2 transition-all active:scale-95"><Sparkles size={20} className="text-yellow-300" /> تنفيذ التوزيع</button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* 4. مودال التصفير (Delete) */}
       {showDeleteModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 animate-fade-in">
              <div className="relative w-full max-w-sm bg-white rounded-[2.5rem] p-10 text-center shadow-2xl animate-scale-in">
                  <div className="bg-red-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 text-red-500 border-4 border-red-100 shadow-inner"><Trash2 size={42} /></div>
                  <h3 className="text-2xl font-black text-slate-800 mb-3 font-tajawal">تصفير النظام؟</h3>
                  <p className="text-gray-500 text-sm mb-10 leading-relaxed">سيتم حذف جميع المظاريف والجدول الحالي.<br/>هذا الإجراء لا يمكن التراجع عنه.</p>
                  <div className="flex gap-3">
                      <button onClick={() => setShowDeleteModal(false)} className="flex-1 bg-gray-100 py-4 rounded-2xl font-bold text-gray-600 transition-colors">إلغاء</button>
                      <button onClick={() => { clearAllExams(); setShowDeleteModal(false); }} className="flex-1 bg-red-600 text-white py-4 rounded-2xl font-bold shadow-xl shadow-red-200 transition-all active:scale-95">نعم، مسح</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
