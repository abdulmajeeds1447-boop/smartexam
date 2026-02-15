import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { QRCodeCanvas } from 'qrcode.react';
import { 
  Printer, X, CheckCircle, MapPin, Calendar, 
  Play, Trash2, ScanLine, 
  Database, Loader2, Edit3, Users, Clock, Filter, AlertCircle
} from 'lucide-react';
import { EnvelopeStatus, ExamEnvelope, Student, AttendanceStatus } from '../../types';
import { Html5Qrcode } from 'html5-qrcode';
import { doc, getDoc, getDocs, collection } from 'firebase/firestore'; 
import { db } from '../../firebase';

export const ExamManagement: React.FC = () => {
  const { exams, students, importExams, clearAllExams, processAdminDeliveryScan, teachers } = useApp();
  
  // States
  const [selectedCommittee, setSelectedCommittee] = useState<any | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [filterMode, setFilterMode] = useState<'TODAY' | 'ALL'>('TODAY'); // عرض لجان اليوم فقط افتراضياً
  
  // Data from Cloud
  const [cloudSchedule, setCloudSchedule] = useState<any | null>(null);
  const [cloudCommitteesConfig, setCloudCommitteesConfig] = useState<Record<string, any>>({});

  // 1. Group Exams by Committee
  const examsByCommittee = useMemo(() => {
      const today = new Date().toISOString().split('T')[0];
      
      // Filter logic
      const filteredExams = exams.filter(e => 
          filterMode === 'ALL' ? true : e.date === today
      );

      const groups: Record<string, ExamEnvelope[]> = {};
      filteredExams.forEach(exam => {
          if (!groups[exam.committeeNumber]) groups[exam.committeeNumber] = [];
          groups[exam.committeeNumber].push(exam);
      });
      return groups;
  }, [exams, filterMode]);

  // --- دوال الكنترول القوية ---

  const fetchCloudData = async () => {
      setIsFetching(true);
      try {
          // 1. جلب الجدول المعتمد
          const scheduleSnap = await getDoc(doc(db, 'system_config', 'exam_schedule'));
          if (!scheduleSnap.exists()) throw new Error("لم يتم العثور على جدول في السحابة. تأكد من الرفع من النظام الأول.");
          setCloudSchedule(scheduleSnap.data());

          // 2. جلب إعدادات اللجان (المقر + عدد الملاحظين)
          const configSnapshot = await getDocs(collection(db, 'system_config'));
          const configs: Record<string, any> = {};
          configSnapshot.forEach(docSnap => {
              const d = docSnap.data();
              if (d.type === 'committee_meta') {
                  configs[d.committeeNumber] = d;
              }
          });
          setCloudCommitteesConfig(configs);
          
          setShowWizard(true);
      } catch (error: any) {
          alert("خطأ: " + error.message);
      } finally {
          setIsFetching(false);
      }
  };

  const handleGenerateFromCloud = () => {
      if (!cloudSchedule) return;

      const newExams: ExamEnvelope[] = [];
      const studentsMap: Record<string, Student[]> = {}; // توزيع الطلاب حسب رقم اللجنة

      // تجميع الطلاب حسب اللجان من قاعدة البيانات المحلية (التي تمت مزامنتها)
      students.forEach(s => {
          const cNum = s.committeeNumber || 'General';
          if (!studentsMap[cNum]) studentsMap[cNum] = [];
          studentsMap[cNum].push(s);
      });

      cloudSchedule.days.forEach((day: any) => {
          day.periods.forEach((period: any) => {
              
              // لكل لجنة فيها طلاب
              Object.keys(studentsMap).forEach(commNum => {
                  const commStudents = studentsMap[commNum];
                  const commConfig = cloudCommitteesConfig[commNum];
                  
                  const affectedStudents: Student[] = [];
                  const gradesInEnvelope: string[] = [];
                  const subjectsInEnvelope: string[] = [];
                  let startTime = "07:30";
                  let endTime = "10:00";

                  // البحث عن مواد الطلاب في هذه الفترة
                  commStudents.forEach(student => {
                      // محاولة مطابقة ذكية لاسم المرحلة
                      const stageKey = Object.keys(period.subjects || {}).find(k => 
                          student.grade.includes(k) || k.includes(student.grade.split(' ')[0])
                      );

                      if (stageKey && period.subjects[stageKey]) {
                          const subj = period.subjects[stageKey];
                          affectedStudents.push({ ...student, subject: subj.name });
                          
                          if (!gradesInEnvelope.includes(student.grade)) gradesInEnvelope.push(student.grade);
                          if (!subjectsInEnvelope.includes(subj.name)) subjectsInEnvelope.push(subj.name);
                          
                          // توحيد الوقت
                          startTime = subj.startTime;
                          endTime = subj.endTime;
                      }
                  });

                  if (affectedStudents.length > 0) {
                      // تحديد المعلمين المراقبين (إن وجدوا في الجدول)
                      // هذه ميزة قوية: ربط المراقبين بالمظروف مباشرة
                      const invigilatorsCount = commConfig?.invigilatorCount || 1;
                      // (منطق بسيط لجلب المراقبين من الجدول إذا كان النظام الأول يدعم تصديرهم، 
                      // حالياً سنتركها فارغة ليقوم الكنترول بالتعيين أو المسح)

                      newExams.push({
                          id: `EX-${commNum}-${day.date}-P${period.periodId}`,
                          subject: [...new Set(subjectsInEnvelope)].join(' + '),
                          grades: gradesInEnvelope,
                          committeeNumber: commNum,
                          location: commConfig?.location || `مقر ${commNum}`,
                          date: day.date,
                          startTime,
                          endTime,
                          period: period.periodId === 1 ? 'الفترة الأولى' : 'الفترة الثانية',
                          status: EnvelopeStatus.PENDING,
                          students: affectedStudents,
                          attendance: affectedStudents.map(s => ({ studentId: s.id, status: AttendanceStatus.PRESENT }))
                      });
                  }
              });
          });
      });

      importExams(newExams);
      setShowWizard(false);
      alert(`✅ تم توليد ${newExams.length} مظروف اختبار بنجاح!`);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      
      {/* Header Panel */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col lg:flex-row justify-between items-center gap-6">
        <div>
          <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
              <Database className="text-blue-600" /> غرفة عمليات الكنترول
          </h2>
          <p className="text-gray-500 text-sm mt-1 font-medium">
             إدارة المظاريف، توزيع اللجان، ومراقبة الاستلام والتسليم
          </p>
          <div className="flex gap-4 mt-3 text-xs text-gray-400">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400"></span> انتظار التسليم</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span> عند المعلم</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> تم الاستلام</span>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-3 justify-end">
             <div className="bg-gray-100 p-1 rounded-lg flex items-center">
                 <button onClick={() => setFilterMode('TODAY')} className={`px-4 py-2 rounded-md text-xs font-bold transition-all ${filterMode === 'TODAY' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>اليوم</button>
                 <button onClick={() => setFilterMode('ALL')} className={`px-4 py-2 rounded-md text-xs font-bold transition-all ${filterMode === 'ALL' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>الكل</button>
             </div>

             <button onClick={() => setShowScanner(true)} className="bg-purple-600 text-white px-5 py-3 rounded-xl hover:bg-purple-700 flex items-center gap-2 shadow-lg shadow-purple-200 transition-all font-bold">
                <ScanLine size={20} /> استلام مظاريف (Scan)
            </button>
            <button onClick={fetchCloudData} disabled={isFetching} className={`text-white px-6 py-3 rounded-xl shadow-lg transition-all font-bold flex items-center gap-2 ${isFetching ? 'bg-gray-400 cursor-wait' : 'bg-slate-800 hover:bg-slate-900'}`}>
                {isFetching ? <Loader2 size={20} className="animate-spin" /> : <Database size={20} />}
                <span>جلب الجدول وتوليد المظاريف</span>
            </button>
            <button onClick={() => setShowDeleteModal(true)} className="bg-red-50 text-red-500 p-3 rounded-xl hover:bg-red-100 transition-colors border border-red-100">
                <Trash2 size={20} />
            </button>
        </div>
      </div>

      {/* Grid Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {Object.keys(examsByCommittee).length === 0 && (
            <div className="col-span-full py-20 text-center text-gray-400 bg-white rounded-3xl border-2 border-dashed border-gray-200">
                <AlertCircle className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p className="font-bold text-lg">لا توجد لجان ظاهرة</p>
                <p className="text-sm">تأكد من "جلب الجدول" أو تغيير الفلتر إلى "الكل"</p>
            </div>
        )}

        {Object.entries(examsByCommittee)
            .sort(([a], [b]) => a.localeCompare(b, 'en', {numeric: true}))
            .map(([committeeNum, committeeExams]) => {
            
            const firstExam = committeeExams[0];
            const allGrades = Array.from(new Set(committeeExams.flatMap(e => e.grades)));
            const activeExam = committeeExams.find(e => e.status === EnvelopeStatus.RECEIVED);
            
            return (
                <div key={committeeNum} className={`bg-white rounded-2xl border transition-all hover:shadow-md overflow-hidden ${activeExam ? 'border-blue-300 shadow-blue-100' : 'border-gray-200 shadow-sm'}`}>
                    
                    {/* Committee Header */}
                    <div className="bg-gray-50 p-4 border-b border-gray-100 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl shadow-sm ${activeExam ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border'}`}>
                                {committeeNum}
                            </div>
                            <div>
                                <div className="font-bold text-gray-800 text-sm flex items-center gap-1">
                                    <MapPin size={14} className="text-red-500"/>
                                    {firstExam.location}
                                </div>
                                <div className="flex gap-1 mt-1">
                                    {allGrades.map(g => <span key={g} className="text-[10px] bg-white border px-1.5 rounded text-gray-500">{g}</span>)}
                                </div>
                            </div>
                        </div>
                        <button 
                            onClick={() => setSelectedCommittee({number: committeeNum, location: firstExam.location})}
                            className="text-gray-400 hover:text-black p-2 bg-white rounded-lg border border-gray-200 hover:border-black transition-all"
                            title="طباعة ملصق اللجنة"
                        >
                            <Printer size={18} />
                        </button>
                    </div>

                    {/* Exams List inside Committee */}
                    <div className="p-2 space-y-2">
                        {committeeExams.map(exam => {
                            const isDone = exam.status === EnvelopeStatus.COMPLETED || exam.status === EnvelopeStatus.DELIVERED;
                            
                            return (
                                <div key={exam.id} className={`p-3 rounded-xl border relative overflow-hidden group ${isDone ? 'bg-green-50/50 border-green-100' : 'bg-white border-gray-100'}`}>
                                    <div className="flex justify-between items-start mb-2 relative z-10">
                                        <div>
                                            <h4 className="font-bold text-gray-800 text-sm">{exam.subject}</h4>
                                            <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                                                <span className="flex items-center gap-1"><Clock size={10}/> {exam.startTime}</span>
                                                <span className="bg-gray-100 px-1.5 rounded">{exam.period}</span>
                                            </div>
                                        </div>
                                        
                                        {/* Status Badge */}
                                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                                            exam.status === EnvelopeStatus.PENDING ? 'bg-yellow-100 text-yellow-700' :
                                            exam.status === EnvelopeStatus.RECEIVED ? 'bg-blue-100 text-blue-700 animate-pulse' :
                                            exam.status === EnvelopeStatus.COMPLETED ? 'bg-purple-100 text-purple-700' :
                                            'bg-green-100 text-green-700'
                                        }`}>
                                            {exam.status === EnvelopeStatus.PENDING ? 'انتظار' :
                                             exam.status === EnvelopeStatus.RECEIVED ? 'جاري...' :
                                             exam.status === EnvelopeStatus.COMPLETED ? 'جاهز للتسليم' : 'تم الاستلام'}
                                        </span>
                                    </div>

                                    {/* Control Actions */}
                                    <div className="flex gap-2 mt-3 relative z-10">
                                        {exam.status === EnvelopeStatus.COMPLETED && (
                                            <button 
                                                onClick={() => processAdminDeliveryScan(exam.committeeNumber)}
                                                className="flex-1 bg-purple-600 text-white py-1.5 rounded-lg text-xs font-bold hover:bg-purple-700 flex items-center justify-center gap-1 shadow-sm"
                                            >
                                                <CheckCircle size={12} /> استلام المظروف
                                            </button>
                                        )}
                                        {exam.status === EnvelopeStatus.DELIVERED && (
                                            <div className="flex-1 bg-green-100 text-green-700 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1">
                                                <CheckCircle size={12} /> محفوظ بالكنترول
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

      {/* Confirmation Wizard Modal */}
      {showWizard && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl animate-scale-in">
                  <div className="bg-slate-900 p-6 text-white flex justify-between items-center rounded-t-2xl">
                      <h3 className="font-bold text-xl flex items-center gap-2"><CheckCircle className="text-green-400" /> مراجعة البيانات</h3>
                      <button onClick={() => setShowWizard(false)} className="hover:bg-white/20 p-2 rounded-full"><X size={20}/></button>
                  </div>
                  <div className="p-8 space-y-6">
                      <div className="bg-blue-50 p-5 rounded-xl text-sm text-blue-900 border border-blue-100 leading-relaxed">
                          <p className="font-bold mb-2">تم جلب البيانات التالية من النظام الأول:</p>
                          <ul className="list-disc list-inside space-y-1 text-blue-800">
                              <li>عدد أيام الجدول: <b>{cloudSchedule?.days.length}</b> أيام</li>
                              <li>عدد الطلاب الموزعين: <b>{students.filter(s => s.committeeNumber).length}</b> طالب</li>
                              <li>عدد اللجان المعتمدة: <b>{Object.keys(cloudCommitteesConfig).length}</b> لجنة</li>
                          </ul>
                          <p className="mt-4 text-xs text-blue-600">سيقوم النظام بدمج هذه البيانات لإنشاء مظاريف الاختبارات وتعيين الطلاب لها تلقائياً.</p>
                      </div>
                      <button onClick={handleGenerateFromCloud} className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-lg hover:bg-slate-800 shadow-xl flex items-center justify-center gap-2">
                          <Play size={24} fill="currentColor"/> اعتماد وتوليد المظاريف
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* QR Modal & Scanner & Delete Modal (نفس السابق) */}
      {selectedCommittee && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden relative">
            <button onClick={() => setSelectedCommittee(null)} className="absolute top-4 left-4 bg-gray-100 p-2 rounded-full"><X size={20} /></button>
            <div className="p-8 flex flex-col items-center text-center">
              <div className="text-6xl font-black text-slate-900 mb-4">{selectedCommittee.number}</div>
              <div className="bg-gray-100 px-4 py-2 rounded-full font-bold text-gray-600 mb-6">{selectedCommittee.location}</div>
              <div className="border-4 border-black p-4 rounded-2xl mb-6 bg-white shadow-inner">
                <QRCodeCanvas value={JSON.stringify({ type: 'committee', id: selectedCommittee.number })} size={220} level="H" />
              </div>
              <button onClick={() => window.print()} className="w-full bg-black text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-800">
                <Printer size={20} /> طباعة الملصق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
       {showDeleteModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-xl p-6 max-w-sm w-full text-center">
                  <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500"><Trash2 size={32} /></div>
                  <h3 className="text-xl font-bold mb-2">تصفير النظام؟</h3>
                  <p className="text-gray-500 text-sm mb-6">سيتم حذف جميع المظاريف الحالية. لن يتم حذف الطلاب أو المعلمين.</p>
                  <div className="flex gap-2">
                      <button onClick={() => setShowDeleteModal(false)} className="flex-1 bg-gray-100 py-3 rounded-xl font-bold">إلغاء</button>
                      <button onClick={() => { clearAllExams(); setShowDeleteModal(false); }} className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold">مسح</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
