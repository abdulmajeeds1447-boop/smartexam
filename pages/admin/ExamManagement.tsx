import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { QRCodeCanvas } from 'qrcode.react';
import { 
  Printer, X, CheckCircle, MapPin, 
  Play, Trash2, ScanLine, 
  Database, Loader2, Clock, AlertCircle, UserCheck, Search, ArrowRightLeft, Package
} from 'lucide-react';
import { EnvelopeStatus, ExamEnvelope, Student, AttendanceStatus } from '../../types';
import { doc, getDoc, getDocs, collection } from 'firebase/firestore'; 
import { db } from '../../firebase';

export const ExamManagement: React.FC = () => {
  const { exams, students, importExams, clearAllExams, processAdminDeliveryScan } = useApp();
  
  // States
  const [selectedCommittee, setSelectedCommittee] = useState<any | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [filterMode, setFilterMode] = useState<'TODAY' | 'ALL'>('TODAY');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Cloud Data
  const [cloudSchedule, setCloudSchedule] = useState<any | null>(null);
  const [cloudCommitteesConfig, setCloudCommitteesConfig] = useState<Record<string, any>>({});

  // تجميع البيانات
  const examsByCommittee = useMemo(() => {
      const today = new Date().toISOString().split('T')[0];
      const filteredExams = exams.filter(e => {
          const matchesDate = filterMode === 'ALL' ? true : e.date === today;
          const matchesSearch = searchTerm ? (e.committeeNumber.includes(searchTerm) || e.location.includes(searchTerm)) : true;
          return matchesDate && matchesSearch;
      });

      const groups: Record<string, ExamEnvelope[]> = {};
      filteredExams.forEach(exam => {
          if (!groups[exam.committeeNumber]) groups[exam.committeeNumber] = [];
          groups[exam.committeeNumber].push(exam);
      });
      return groups;
  }, [exams, filterMode, searchTerm]);

  // إحصائيات سريعة للكنترول
  const stats = useMemo(() => {
      const todayExams = exams.filter(e => e.date === new Date().toISOString().split('T')[0]);
      return {
          total: todayExams.length,
          pending: todayExams.filter(e => e.status === EnvelopeStatus.PENDING).length,
          active: todayExams.filter(e => e.status === EnvelopeStatus.RECEIVED).length,
          completed: todayExams.filter(e => e.status === EnvelopeStatus.COMPLETED).length,
          delivered: todayExams.filter(e => e.status === EnvelopeStatus.DELIVERED).length,
      };
  }, [exams]);

  // --- العمليات ---
  const fetchCloudData = async () => {
      setIsFetching(true);
      try {
          // 1. جلب الجدول
          const scheduleSnap = await getDoc(doc(db, 'system_config', 'exam_schedule'));
          if (!scheduleSnap.exists()) throw new Error("لم يتم العثور على جدول في السحابة. تأكد من الرفع من النظام الأول.");
          setCloudSchedule(scheduleSnap.data());

          // 2. جلب إعدادات اللجان
          const configSnapshot = await getDocs(collection(db, 'system_config'));
          const configs: Record<string, any> = {};
          configSnapshot.forEach(docSnap => {
              const d = docSnap.data();
              if (d.type === 'committee_meta') configs[d.committeeNumber] = d;
          });
          setCloudCommitteesConfig(configs);
          setShowWizard(true);
      } catch (error: any) {
          alert("تنبيه: " + error.message);
      } finally {
          setIsFetching(false);
      }
  };

  const handleGenerateFromCloud = () => {
      if (!cloudSchedule) return;
      const newExams: ExamEnvelope[] = [];
      const studentsMap: Record<string, Student[]> = {};

      students.forEach(s => {
          const cNum = s.committeeNumber || 'General';
          if (!studentsMap[cNum]) studentsMap[cNum] = [];
          studentsMap[cNum].push(s);
      });

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
                          if (!subjectsInEnvelope.includes(subj.name)) subjectsInEnvelope.push(subj.name);
                          startTime = subj.startTime; endTime = subj.endTime;
                      }
                  });

                  if (affectedStudents.length > 0) {
                      // تحديد المراقب المتوقع
                      const commIndex = parseInt(commNum) - 1;
                      
                      // ✅ التصحيح هنا: استخدام OR null لمنع undefined
                      const assignedTeacherName = (period.main && period.main[commIndex]) || null;

                      newExams.push({
                          id: `EX-${commNum}-${day.date}-P${period.periodId}`,
                          subject: [...new Set(subjectsInEnvelope)].join(' + '),
                          grades: gradesInEnvelope,
                          committeeNumber: commNum,
                          location: commConfig?.location || `مقر ${commNum}`,
                          date: day.date,
                          startTime, endTime,
                          period: period.periodId === 1 ? 'الفترة الأولى' : 'الفترة الثانية',
                          status: EnvelopeStatus.PENDING,
                          students: affectedStudents,
                          attendance: affectedStudents.map(s => ({ studentId: s.id, status: AttendanceStatus.PRESENT })),
                          teacherId: assignedTeacherName // الآن القيمة إما اسم أو null
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
    <div className="space-y-6 animate-fade-in pb-20">
      
      {/* 1. Control Dashboard Header */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <div className="flex flex-col lg:flex-row justify-between items-center gap-6 mb-6">
            <div>
                <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                    <div className="bg-slate-900 text-white p-2 rounded-xl"><Database size={24} /></div>
                    غرفة عمليات الكنترول
                </h2>
                <p className="text-gray-500 text-sm mt-2 font-medium mr-14">
                    إدارة دورة حياة الاختبارات من التسليم حتى الاستلام
                </p>
            </div>
            
            <div className="flex gap-2">
                <button onClick={fetchCloudData} disabled={isFetching} className={`bg-slate-900 text-white px-6 py-3 rounded-xl hover:bg-slate-800 shadow-lg transition-all font-bold flex items-center gap-2 ${isFetching ? 'opacity-70 cursor-wait' : ''}`}>
                    {isFetching ? <Loader2 size={20} className="animate-spin" /> : <Play size={20} />}
                    <span>{isFetching ? 'جاري الاتصال...' : 'جلب الجدول وتوليد المظاريف'}</span>
                </button>
                <button onClick={() => setShowDeleteModal(true)} className="bg-red-50 text-red-500 p-3 rounded-xl hover:bg-red-100 border border-red-100" title="تصفير النظام"><Trash2 size={20} /></button>
            </div>
        </div>

        {/* Status Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-100">
            <div className="bg-blue-50 p-4 rounded-2xl flex items-center gap-4">
                <div className="bg-blue-200 text-blue-700 p-2 rounded-lg"><Package size={20} /></div>
                <div><h4 className="text-2xl font-black text-blue-900">{stats.total}</h4><span className="text-xs text-blue-600 font-bold">مظروف اليوم</span></div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-2xl flex items-center gap-4">
                <div className="bg-yellow-200 text-yellow-700 p-2 rounded-lg"><Clock size={20} /></div>
                <div><h4 className="text-2xl font-black text-yellow-900">{stats.active}</h4><span className="text-xs text-yellow-600 font-bold">جاري الاختبار</span></div>
            </div>
            <div className="bg-green-50 p-4 rounded-2xl flex items-center gap-4">
                <div className="bg-green-200 text-green-700 p-2 rounded-lg"><CheckCircle size={20} /></div>
                <div><h4 className="text-2xl font-black text-green-900">{stats.delivered}</h4><span className="text-xs text-green-600 font-bold">تم الاستلام</span></div>
            </div>
            <div className="flex items-center justify-between bg-gray-50 px-4 rounded-2xl border border-gray-200">
                <span className="text-xs font-bold text-gray-500">عرض:</span>
                <div className="flex bg-white rounded-lg p-1 shadow-sm">
                    <button onClick={() => setFilterMode('TODAY')} className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${filterMode === 'TODAY' ? 'bg-slate-800 text-white' : 'text-gray-500'}`}>اليوم</button>
                    <button onClick={() => setFilterMode('ALL')} className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${filterMode === 'ALL' ? 'bg-slate-800 text-white' : 'text-gray-500'}`}>الكل</button>
                </div>
            </div>
        </div>
      </div>

      {/* 2. Grid Display */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {Object.keys(examsByCommittee).length === 0 && (
            <div className="col-span-full py-24 text-center text-gray-400 bg-white rounded-3xl border-2 border-dashed border-gray-200">
                <AlertCircle className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p className="font-bold text-lg">لا توجد مظاريف مطابقة</p>
                <p className="text-sm">تأكد من توليد الجدول أو تغيير الفلتر</p>
            </div>
        )}

        {Object.entries(examsByCommittee)
            .sort(([a], [b]) => a.localeCompare(b, 'en', {numeric: true}))
            .map(([committeeNum, committeeExams]) => {
            
            const firstExam = committeeExams[0];
            const allGrades = Array.from(new Set(committeeExams.flatMap(e => e.grades)));
            
            return (
                <div key={committeeNum} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-lg transition-all group">
                    
                    {/* Card Header */}
                    <div className="bg-slate-50 p-5 border-b border-gray-100 flex justify-between items-start">
                        <div className="flex gap-4">
                            <div className="bg-white w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-black text-2xl text-slate-800 shadow-sm border border-gray-200">
                                {committeeNum}
                                <span className="text-[8px] font-normal text-gray-400 -mt-1">لجنة</span>
                            </div>
                            <div>
                                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                                    <MapPin size={16} className="text-red-500"/>
                                    {firstExam.location}
                                </div>
                                <div className="flex gap-1 mt-2 flex-wrap">
                                    {allGrades.map(g => <span key={g} className="text-[10px] bg-white border border-gray-200 px-2 py-0.5 rounded-md text-gray-500 font-medium">{g}</span>)}
                                </div>
                            </div>
                        </div>
                        <button onClick={() => setSelectedCommittee({number: committeeNum, location: firstExam.location})} className="text-gray-400 hover:text-slate-800 bg-white p-2 rounded-xl shadow-sm"><Printer size={18} /></button>
                    </div>

                    {/* Exams List */}
                    <div className="p-4 space-y-3">
                        {committeeExams.map(exam => {
                            const isDone = exam.status === EnvelopeStatus.COMPLETED || exam.status === EnvelopeStatus.DELIVERED;
                            
                            return (
                                <div key={exam.id} className={`p-4 rounded-2xl border relative overflow-hidden transition-all ${isDone ? 'bg-green-50/50 border-green-100' : 'bg-white border-gray-100'}`}>
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <h4 className="font-bold text-gray-900 text-sm">{exam.subject}</h4>
                                            <div className="flex items-center gap-2 text-xs text-gray-500 mt-1 font-mono">
                                                <Clock size={12} className="text-orange-500" />
                                                {exam.startTime} - {exam.endTime}
                                            </div>
                                            {exam.teacherId && (
                                                <div className="flex items-center gap-1.5 text-[10px] text-blue-700 mt-2 font-bold bg-blue-50 px-2 py-1 rounded-lg w-fit border border-blue-100">
                                                    <UserCheck size={12} />
                                                    {exam.teacherId}
                                                </div>
                                            )}
                                        </div>
                                        
                                        {/* Status Badge */}
                                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg ${
                                            exam.status === EnvelopeStatus.PENDING ? 'bg-yellow-50 text-yellow-700 border border-yellow-100' :
                                            exam.status === EnvelopeStatus.RECEIVED ? 'bg-blue-50 text-blue-700 border border-blue-100 animate-pulse' :
                                            exam.status === EnvelopeStatus.COMPLETED ? 'bg-purple-50 text-purple-700 border border-purple-100' :
                                            'bg-green-50 text-green-700 border border-green-100'
                                        }`}>
                                            {exam.status === EnvelopeStatus.PENDING ? 'انتظار' :
                                             exam.status === EnvelopeStatus.RECEIVED ? 'جاري...' :
                                             exam.status === EnvelopeStatus.COMPLETED ? 'جاهز' : 'مستلم'}
                                        </span>
                                    </div>

                                    {/* Action Buttons (The Power Features) */}
                                    <div className="border-t border-gray-100 pt-3 mt-2 flex gap-2">
                                        {exam.status === EnvelopeStatus.COMPLETED && (
                                            <button 
                                                onClick={() => processAdminDeliveryScan(exam.committeeNumber)}
                                                className="w-full bg-slate-900 text-white py-2 rounded-xl text-xs font-bold hover:bg-slate-800 flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95"
                                            >
                                                <ArrowRightLeft size={14} /> استلام من المعلم
                                            </button>
                                        )}
                                        {exam.status === EnvelopeStatus.DELIVERED && (
                                            <div className="w-full bg-green-100 text-green-700 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border border-green-200">
                                                <CheckCircle size={14} /> محفوظ في الكنترول
                                            </div>
                                        )}
                                        {exam.status === EnvelopeStatus.RECEIVED && (
                                            <div className="w-full text-center text-[10px] text-gray-400 py-1">
                                                المعلم متواجد في اللجنة الآن
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        })}
      </div>

      {/* Delete Confirmation */}
       {showDeleteModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
                  <div className="bg-red-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-red-500"><Trash2 size={40} /></div>
                  <h3 className="text-2xl font-black text-slate-800 mb-2">تصفير النظام؟</h3>
                  <p className="text-gray-500 text-sm mb-8 leading-relaxed">سيتم حذف جميع المظاريف والجدول الحالي. لن يتم حذف بيانات الطلاب أو المعلمين.</p>
                  <div className="flex gap-3">
                      <button onClick={() => setShowDeleteModal(false)} className="flex-1 bg-gray-100 py-3 rounded-2xl font-bold text-gray-600 hover:bg-gray-200">تراجع</button>
                      <button onClick={() => { clearAllExams(); setShowDeleteModal(false); }} className="flex-1 bg-red-600 text-white py-3 rounded-2xl font-bold hover:bg-red-700 shadow-xl shadow-red-200">نعم، مسح</button>
                  </div>
              </div>
          </div>
      )}
      
      {showWizard && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl animate-scale-in overflow-hidden">
                  <div className="bg-slate-900 p-8 text-white">
                      <h3 className="font-bold text-2xl flex items-center gap-3"><Database className="text-green-400" /> تأكيد الاستيراد</h3>
                      <p className="text-slate-400 text-sm mt-2">سيتم إنشاء المظاريف بناءً على البيانات التالية:</p>
                  </div>
                  <div className="p-8 space-y-6">
                      <div className="space-y-4">
                          <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100">
                              <span className="text-gray-500 font-bold text-sm">عدد الأيام</span>
                              <span className="text-xl font-black text-slate-800">{cloudSchedule?.days.length}</span>
                          </div>
                          <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100">
                              <span className="text-gray-500 font-bold text-sm">اللجان المعتمدة</span>
                              <span className="text-xl font-black text-slate-800">{Object.keys(cloudCommitteesConfig).length}</span>
                          </div>
                      </div>
                      <button onClick={handleGenerateFromCloud} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-blue-700 shadow-xl shadow-blue-200 flex items-center justify-center gap-2 active:scale-95 transition-all">
                          <Play size={24} fill="currentColor"/> تنفيذ واعتماد
                      </button>
                  </div>
              </div>
          </div>
      )}
      
      {selectedCommittee && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden relative shadow-2xl">
            <button onClick={() => setSelectedCommittee(null)} className="absolute top-4 left-4 bg-gray-100 p-2 rounded-full hover:bg-gray-200"><X size={20} /></button>
            <div className="p-10 flex flex-col items-center text-center">
              <span className="text-gray-400 font-bold text-xs uppercase tracking-widest mb-2">رقم اللجنة</span>
              <div className="text-8xl font-black text-slate-900 mb-6">{selectedCommittee.number}</div>
              <div className="bg-gray-100 px-6 py-3 rounded-2xl font-bold text-gray-600 mb-8 flex items-center gap-2 shadow-inner">
                  <MapPin size={20} className="text-red-500" />
                  {selectedCommittee.location}
              </div>
              <div className="border-8 border-slate-900 p-4 rounded-3xl mb-8 bg-white shadow-2xl">
                <QRCodeCanvas value={JSON.stringify({ type: 'committee', id: selectedCommittee.number })} size={200} level="H" />
              </div>
              <button onClick={() => window.print()} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-slate-800 transition-all shadow-xl">
                <Printer size={24} /> طباعة الملصق
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
