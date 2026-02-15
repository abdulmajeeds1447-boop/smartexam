import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { QRCodeCanvas } from 'qrcode.react';
import { 
  Printer, X, CheckCircle, MapPin, 
  Play, Trash2, ScanLine, 
  Database, Loader2, Clock, AlertCircle, UserCheck, Search
} from 'lucide-react';
import { EnvelopeStatus, ExamEnvelope, Student, AttendanceStatus } from '../../types';
import { doc, getDoc, getDocs, collection } from 'firebase/firestore'; 
import { db } from '../../firebase';

export const ExamManagement: React.FC = () => {
  const { exams, students, importExams, clearAllExams, processAdminDeliveryScan } = useApp();
  
  // UI States
  const [selectedCommittee, setSelectedCommittee] = useState<any | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [filterMode, setFilterMode] = useState<'TODAY' | 'ALL'>('TODAY');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Cloud Data Storage
  const [cloudSchedule, setCloudSchedule] = useState<any | null>(null);
  const [cloudCommitteesConfig, setCloudCommitteesConfig] = useState<Record<string, any>>({});

  // 1. تجميع وتصفية البيانات
  const examsByCommittee = useMemo(() => {
      const today = new Date().toISOString().split('T')[0];
      
      const filteredExams = exams.filter(e => {
          const matchesDate = filterMode === 'ALL' ? true : e.date === today;
          const matchesSearch = searchTerm ? e.committeeNumber.includes(searchTerm) || e.location.includes(searchTerm) : true;
          return matchesDate && matchesSearch;
      });

      const groups: Record<string, ExamEnvelope[]> = {};
      filteredExams.forEach(exam => {
          if (!groups[exam.committeeNumber]) groups[exam.committeeNumber] = [];
          groups[exam.committeeNumber].push(exam);
      });
      return groups;
  }, [exams, filterMode, searchTerm]);

  // --- العمليات ---

  const fetchCloudData = async () => {
      setIsFetching(true);
      try {
          // جلب الجدول المعتمد
          const scheduleSnap = await getDoc(doc(db, 'system_config', 'exam_schedule'));
          if (!scheduleSnap.exists()) throw new Error("لم يتم العثور على جدول في السحابة. تأكد من الرفع من النظام الأول.");
          setCloudSchedule(scheduleSnap.data());

          // جلب إعدادات اللجان (المقر + السعة + المراقبين)
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
          alert("تنبيه: " + error.message);
      } finally {
          setIsFetching(false);
      }
  };

  const handleGenerateFromCloud = () => {
      if (!cloudSchedule) return;

      const newExams: ExamEnvelope[] = [];
      const studentsMap: Record<string, Student[]> = {};

      // توزيع الطلاب الموجودين في النظام على لجانهم
      students.forEach(s => {
          const cNum = s.committeeNumber || 'General';
          if (!studentsMap[cNum]) studentsMap[cNum] = [];
          studentsMap[cNum].push(s);
      });

      cloudSchedule.days.forEach((day: any) => {
          day.periods.forEach((period: any) => {
              
              // المرور على اللجان التي بها طلاب
              Object.keys(studentsMap).forEach(commNum => {
                  const commStudents = studentsMap[commNum];
                  const commConfig = cloudCommitteesConfig[commNum];
                  
                  const affectedStudents: Student[] = [];
                  const gradesInEnvelope: string[] = [];
                  const subjectsInEnvelope: string[] = [];
                  let startTime = "07:30";
                  let endTime = "10:00";

                  // البحث عن مادة لكل طالب في هذه الفترة
                  commStudents.forEach(student => {
                      // مطابقة ذكية لاسم المرحلة
                      const stageKey = Object.keys(period.subjects || {}).find(k => 
                          student.grade.includes(k) || k.includes(student.grade.split(' ')[0])
                      );

                      if (stageKey && period.subjects[stageKey]) {
                          const subj = period.subjects[stageKey];
                          affectedStudents.push({ ...student, subject: subj.name });
                          
                          if (!gradesInEnvelope.includes(student.grade)) gradesInEnvelope.push(student.grade);
                          if (!subjectsInEnvelope.includes(subj.name)) subjectsInEnvelope.push(subj.name);
                          
                          startTime = subj.startTime;
                          endTime = subj.endTime;
                      }
                  });

                  if (affectedStudents.length > 0) {
                      // محاولة جلب اسم المراقب من الجدول (إن وجد)
                      // نفترض أن period.main تحتوي أسماء المراقبين مرتبة
                      const commIndex = parseInt(commNum) - 1;
                      const assignedTeacherName = period.main && period.main[commIndex] ? period.main[commIndex] : undefined;

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
                          attendance: affectedStudents.map(s => ({ studentId: s.id, status: AttendanceStatus.PRESENT })),
                          teacherId: assignedTeacherName // حفظ اسم المراقب المتوقع
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
      
      {/* لوحة التحكم العلوية */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col lg:flex-row justify-between items-center gap-6">
        <div>
          <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
              <Database className="text-blue-600" /> غرفة عمليات الكنترول
          </h2>
          <p className="text-gray-500 text-sm mt-1 font-medium">
             مراقبة اللجان، تسليم المظاريف، ومتابعة سير الاختبارات
          </p>
        </div>
        
        <div className="flex flex-wrap gap-3 justify-end items-center">
             
             {/* البحث */}
             <div className="relative group">
                 <input 
                    type="text" 
                    placeholder="بحث عن لجنة..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none w-40 transition-all"
                 />
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
             </div>

             {/* الفلتر */}
             <div className="bg-gray-100 p-1 rounded-xl flex items-center">
                 <button onClick={() => setFilterMode('TODAY')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${filterMode === 'TODAY' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>اليوم</button>
                 <button onClick={() => setFilterMode('ALL')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${filterMode === 'ALL' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>الجدول كامل</button>
             </div>

            <div className="h-8 w-px bg-gray-200 mx-1"></div>

            <button onClick={fetchCloudData} disabled={isFetching} className={`text-white px-5 py-2.5 rounded-xl shadow-lg transition-all font-bold flex items-center gap-2 text-sm ${isFetching ? 'bg-gray-400 cursor-wait' : 'bg-slate-800 hover:bg-slate-900'}`}>
                {isFetching ? <Loader2 size={18} className="animate-spin" /> : <Database size={18} />}
                <span>جلب الجدول وتوليد المظاريف</span>
            </button>
            
            <button onClick={() => setShowDeleteModal(true)} className="bg-red-50 text-red-500 p-2.5 rounded-xl hover:bg-red-100 transition-colors border border-red-100" title="تصفير النظام">
                <Trash2 size={20} />
            </button>
        </div>
      </div>

      {/* شبكة اللجان */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {Object.keys(examsByCommittee).length === 0 && (
            <div className="col-span-full py-20 text-center text-gray-400 bg-white rounded-3xl border-2 border-dashed border-gray-200">
                <AlertCircle className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p className="font-bold text-lg">لا توجد بيانات للعرض</p>
                <p className="text-sm">تأكد من ضغط زر "جلب الجدول" أو تغيير الفلتر لعرض الكل</p>
            </div>
        )}

        {Object.entries(examsByCommittee)
            .sort(([a], [b]) => a.localeCompare(b, 'en', {numeric: true}))
            .map(([committeeNum, committeeExams]) => {
            
            const firstExam = committeeExams[0];
            const allGrades = Array.from(new Set(committeeExams.flatMap(e => e.grades)));
            
            return (
                <div key={committeeNum} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-all">
                    
                    {/* رأس اللجنة */}
                    <div className="bg-gray-50 p-4 border-b border-gray-100 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-slate-800 text-white rounded-xl flex items-center justify-center font-black text-xl shadow-sm">
                                {committeeNum}
                            </div>
                            <div>
                                <div className="font-bold text-gray-800 text-sm flex items-center gap-1">
                                    <MapPin size={14} className="text-red-500"/>
                                    {firstExam.location}
                                </div>
                                <div className="flex gap-1 mt-1 flex-wrap">
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

                    {/* قائمة الاختبارات داخل اللجنة */}
                    <div className="p-3 space-y-3">
                        {committeeExams.map(exam => {
                            const isDone = exam.status === EnvelopeStatus.COMPLETED || exam.status === EnvelopeStatus.DELIVERED;
                            
                            return (
                                <div key={exam.id} className={`p-3 rounded-xl border relative overflow-hidden group ${isDone ? 'bg-green-50/50 border-green-100' : 'bg-white border-gray-100'}`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <h4 className="font-bold text-gray-800 text-sm">{exam.subject}</h4>
                                            <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                                                <span className="bg-gray-100 px-1.5 rounded font-mono">{exam.startTime}</span>
                                                <span className="text-gray-400">|</span>
                                                <span>{exam.period}</span>
                                            </div>
                                            {/* عرض اسم المراقب المسند */}
                                            {exam.teacherId && (
                                                <div className="flex items-center gap-1 text-[10px] text-blue-600 mt-2 font-bold bg-blue-50 px-2 py-1 rounded w-fit">
                                                    <UserCheck size={12} />
                                                    {exam.teacherId}
                                                </div>
                                            )}
                                        </div>
                                        
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

                                    {/* أزرار التحكم اليدوي (للتوثيق) */}
                                    <div className="flex gap-2 mt-3 pt-2 border-t border-gray-100/50">
                                        {exam.status === EnvelopeStatus.COMPLETED && (
                                            <button 
                                                onClick={() => processAdminDeliveryScan(exam.committeeNumber)}
                                                className="flex-1 bg-purple-600 text-white py-1.5 rounded-lg text-xs font-bold hover:bg-purple-700 flex items-center justify-center gap-1 shadow-sm transition-all active:scale-95"
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

      {/* نافذة التأكيد (Wizard) */}
      {showWizard && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl animate-scale-in">
                  <div className="bg-slate-900 p-6 text-white flex justify-between items-center rounded-t-2xl">
                      <h3 className="font-bold text-xl flex items-center gap-2"><CheckCircle className="text-green-400" /> مراجعة البيانات المستوردة</h3>
                      <button onClick={() => setShowWizard(false)} className="hover:bg-white/20 p-2 rounded-full"><X size={20}/></button>
                  </div>
                  <div className="p-8 space-y-6">
                      <div className="bg-blue-50 p-5 rounded-xl text-sm text-blue-900 border border-blue-100 leading-relaxed">
                          <p className="font-bold mb-3 text-lg">ملخص البيانات من النظام الأول:</p>
                          <ul className="list-disc list-inside space-y-2 text-blue-800 font-medium">
                              <li>عدد أيام الجدول: <b className="text-black">{cloudSchedule?.days.length}</b> أيام</li>
                              <li>عدد الطلاب الجاهزون للتوزيع: <b className="text-black">{students.filter(s => s.committeeNumber).length}</b> طالب</li>
                              <li>عدد اللجان المعتمدة: <b className="text-black">{Object.keys(cloudCommitteesConfig).length}</b> لجنة</li>
                          </ul>
                          <p className="mt-4 text-xs text-blue-600 bg-white p-2 rounded border border-blue-200">
                              سيقوم النظام الآن بدمج هذه البيانات، وتوزيع الطلاب على المظاريف، وتعيين المراقبين آلياً حسب الجدول.
                          </p>
                      </div>
                      <button onClick={handleGenerateFromCloud} className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-lg hover:bg-slate-800 shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all">
                          <Play size={24} fill="currentColor"/> اعتماد وتوليد المظاريف
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* نافذة الطباعة (QR) */}
      {selectedCommittee && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden relative shadow-2xl">
            <button onClick={() => setSelectedCommittee(null)} className="absolute top-4 left-4 bg-gray-100 p-2 rounded-full hover:bg-gray-200"><X size={20} /></button>
            <div className="p-8 flex flex-col items-center text-center">
              <div className="text-6xl font-black text-slate-900 mb-4">{selectedCommittee.number}</div>
              <div className="bg-gray-100 px-4 py-2 rounded-full font-bold text-gray-600 mb-6 flex items-center gap-2">
                  <MapPin size={16} />
                  {selectedCommittee.location}
              </div>
              <div className="border-4 border-black p-4 rounded-2xl mb-6 bg-white shadow-inner">
                <QRCodeCanvas value={JSON.stringify({ type: 'committee', id: selectedCommittee.number })} size={220} level="H" />
              </div>
              <button onClick={() => window.print()} className="w-full bg-black text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-800 transition-all">
                <Printer size={20} /> طباعة الملصق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة الحذف */}
       {showDeleteModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-xl p-6 max-w-sm w-full text-center shadow-2xl">
                  <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500"><Trash2 size={32} /></div>
                  <h3 className="text-xl font-bold mb-2">تصفير النظام؟</h3>
                  <p className="text-gray-500 text-sm mb-6">سيتم حذف جميع المظاريف الحالية لإنشاء جدول جديد. لن يتم حذف بيانات الطلاب أو المعلمين.</p>
                  <div className="flex gap-2">
                      <button onClick={() => setShowDeleteModal(false)} className="flex-1 bg-gray-100 py-3 rounded-xl font-bold hover:bg-gray-200 text-gray-700">إلغاء</button>
                      <button onClick={() => { clearAllExams(); setShowDeleteModal(false); }} className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 shadow-lg shadow-red-200">تصفير ومسح</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
