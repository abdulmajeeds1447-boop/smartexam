import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { QRCodeCanvas } from 'qrcode.react';
import { 
  Printer, X, CheckCircle, MapPin, Calendar, Play, 
  Trash2, ScanLine, AlertTriangle, Database, RefreshCw, Clock, Loader2 
} from 'lucide-react';
import { EnvelopeStatus, ExamEnvelope, Student, AttendanceStatus, ExamSchedule, SubjectDetail } from '../../types';
import { Html5Qrcode } from 'html5-qrcode';
import { doc, getDoc, getDocs, collection } from 'firebase/firestore'; 
import { db } from '../../firebase';

export const ExamManagement: React.FC = () => {
  const { exams, students, importExams, clearAllExams, processAdminDeliveryScan } = useApp();
  
  // --- UI States ---
  const [selectedCommittee, setSelectedCommittee] = useState<{number: string, location: string, grades: string[]} | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  
  // --- Scanner States ---
  const [scanResult, setScanResult] = useState<{success: boolean, msg: string} | null>(null);
  const [lastScannedId, setLastScannedId] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // --- Data States ---
  const [cloudSchedule, setCloudSchedule] = useState<ExamSchedule | null>(null);
  const [cloudCommittees, setCloudCommittees] = useState<Record<string, Student[]>>({});
  const [committeeLocations, setCommitteeLocations] = useState<Record<string, string>>({}); 

  // 1. تجميع الطلاب حسب اللجان
  useEffect(() => {
    if (students.length > 0) {
        const groups: Record<string, Student[]> = {};
        students.forEach(s => {
            const commNum = s.committeeNumber || 'General';
            if (!groups[commNum]) groups[commNum] = [];
            groups[commNum].push(s);
        });
        setCloudCommittees(groups);
    }
  }, [students]);

  // 2. تجميع المظاريف الحالية للعرض
  const examsByCommittee = useMemo(() => {
      const groups: Record<string, ExamEnvelope[]> = {};
      exams.forEach(exam => {
          if (!groups[exam.committeeNumber]) groups[exam.committeeNumber] = [];
          groups[exam.committeeNumber].push(exam);
      });
      return groups;
  }, [exams]);

  // 3. إدارة الماسح الضوئي (نفس المنطق السابق)
  useEffect(() => {
    if (showScanner) {
        const initScanner = async () => {
            if (scannerRef.current) await scannerRef.current.clear();
            const html5QrCode = new Html5Qrcode("admin-reader");
            scannerRef.current = html5QrCode;
            try {
                 await html5QrCode.start(
                    { facingMode: "environment" },
                    { fps: 10, qrbox: { width: 250, height: 250 } },
                    (text) => handleQrScan(text),
                    () => {}
                 );
            } catch(e) { console.error("Scanner Error", e); }
        };
        setTimeout(initScanner, 300);
    } else {
        if (scannerRef.current) {
            scannerRef.current.stop().catch(() => {}).finally(() => scannerRef.current?.clear());
        }
    }
    return () => { if (scannerRef.current) scannerRef.current.stop().catch(() => {}); };
  }, [showScanner]);

  const handleControlScan = async (committeeId: string) => {
    if (committeeId === lastScannedId) return;
    setLastScannedId(committeeId);
    setScanResult(null);
    const result = await processAdminDeliveryScan(committeeId);
    setScanResult({
        success: result.success,
        msg: result.message || (result.success ? "تم الاستلام بنجاح" : "حدث خطأ")
    });
    setTimeout(() => { setScanResult(null); setLastScannedId(null); }, 3000);
  };

  const handleQrScan = (data: string | null) => {
      if (data) {
          let cId = data;
          try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'committee' && parsed.id) cId = parsed.id;
          } catch(e) {}
          handleControlScan(cId);
      }
  };

  const fetchCloudData = async () => {
      setIsFetching(true);
      try {
          // جلب الجدول
          const scheduleDocRef = doc(db, 'system_config', 'exam_schedule');
          const scheduleSnap = await getDoc(scheduleDocRef);
          
          if (!scheduleSnap.exists()) {
              alert("لم يتم العثور على جدول! تأكد من التصدير من النظام الأول.");
              setIsFetching(false);
              return;
          }

          setCloudSchedule(scheduleSnap.data() as ExamSchedule);
          
          // جلب المقرات
          const configSnapshot = await getDocs(collection(db, 'system_config'));
          const locationsMap: Record<string, string> = {};
          
          configSnapshot.forEach(docSnap => {
              const data = docSnap.data();
              if (data.committeeNumber && data.location) {
                  locationsMap[String(data.committeeNumber)] = data.location;
              }
          });
          
          setCommitteeLocations(locationsMap);
          setShowWizard(true);

      } catch (error) {
          console.error("Cloud Fetch Error:", error);
          alert("خطأ في الاتصال.");
      } finally {
          setIsFetching(false);
      }
  };

  // --- دالة المطابقة الذكية (Smart Matching) ---
  const findSubjectForStudent = (studentGrade: string, subjects: Record<string, SubjectDetail>) => {
      // 1. محاولة التطابق المباشر
      if (subjects[studentGrade]) return subjects[studentGrade];

      // 2. محاولة التطابق الذكي (تنظيف النصوص)
      // نحذف "الصف"، "الثانوية"، "المرحلة"، والمسافات
      const clean = (s: string) => s.replace(/(الصف|المرحلة|ثانوي|الثانوية|Secondary)/g, '').trim();
      
      const sGradeClean = clean(studentGrade);

      // نبحث عن أي مفتاح في الجدول يحتوي على الكلمة الجوهرية (مثلاً "ثاني" موجودة في "الثاني ثانوي")
      const matchingKey = Object.keys(subjects).find(key => {
          const keyClean = clean(key);
          return keyClean.includes(sGradeClean) || sGradeClean.includes(keyClean);
      });

      return matchingKey ? subjects[matchingKey] : null;
  };

  // --- المحرك الرئيسي لتوليد المظاريف ---
  const handleGenerate = () => {
      if (!cloudSchedule) return;

      const newExams: ExamEnvelope[] = [];
      const committeeKeys = Object.keys(cloudCommittees).filter(k => k !== 'General' && k !== 'احتياط');

      if (committeeKeys.length === 0) {
          alert("لا توجد لجان موزعة.");
          return;
      }

      cloudSchedule.days.forEach((daySchedule) => {
          const dateStr = daySchedule.date;

          daySchedule.periods.forEach((period) => {
              
              committeeKeys.forEach(commNum => {
                  const commStudents = cloudCommittees[commNum];
                  
                  const affectedStudents: Student[] = [];
                  const gradesInCommittee: string[] = [];
                  const relevantSubjects: string[] = [];
                  
                  let earliestStart = "23:59";
                  let latestEnd = "00:00";

                  commStudents.forEach(student => {
                      const studentStage = student.grade; 
                      
                      // استخدام المطابقة الذكية هنا
                      const subjectDetail = period.subjects ? findSubjectForStudent(studentStage, period.subjects) : undefined;

                      if (subjectDetail && subjectDetail.name) {
                          affectedStudents.push({ 
                              ...student, 
                              subject: subjectDetail.name 
                          });

                          // نضيف اسم الصف كما هو مكتوب في الجدول لتوحيد العرض
                          // أو نستخدم اسم الصف الخاص بالطالب
                          if (!gradesInCommittee.includes(studentStage)) gradesInCommittee.push(studentStage);
                          if (!relevantSubjects.includes(subjectDetail.name)) relevantSubjects.push(subjectDetail.name);

                          if (subjectDetail.startTime < earliestStart) earliestStart = subjectDetail.startTime;
                          if (subjectDetail.endTime > latestEnd) latestEnd = subjectDetail.endTime;
                      }
                  });

                  if (affectedStudents.length > 0) {
                      // دمج المواد المتشابهة لمنع التكرار في العنوان
                      const uniqueSubjects = Array.from(new Set(relevantSubjects));
                      const subjectDisplay = uniqueSubjects.join(' + ');
                      
                      const examId = `EX-${commNum}-${dateStr}-P${period.periodId}`;
                      const realLocation = committeeLocations[commNum] || `مقر ${commNum}`;

                      newExams.push({
                          id: examId,
                          subject: subjectDisplay, 
                          grades: gradesInCommittee,
                          committeeNumber: commNum,
                          location: realLocation,
                          date: dateStr,
                          startTime: earliestStart === "23:59" ? "07:30" : earliestStart,
                          endTime: latestEnd === "00:00" ? "10:00" : latestEnd,
                          period: `الفترة ${period.periodId}`,
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
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">إدارة الاختبارات</h2>
          <p className="text-gray-500 text-sm mt-1">
             {students.length > 0 
                ? `● النظام متصل: ${students.length} طالب و ${exams.length} مظروف` 
                : '○ جاري مزامنة البيانات...'}
          </p>
        </div>
        
        <div className="flex gap-2">
             <button onClick={() => setShowScanner(true)} className="bg-purple-600 text-white border border-purple-600 px-4 py-3 rounded-lg hover:bg-purple-700 flex items-center gap-2 shadow-lg shadow-purple-200 transition-all">
                <ScanLine size={20} /> <span className="hidden md:inline font-bold">استلام للكنترول</span>
            </button>
             <button onClick={() => setShowDeleteAllModal(true)} className="bg-white text-red-600 border border-red-100 px-4 py-3 rounded-lg hover:bg-red-50 flex items-center gap-2" title="تصفير الجدول">
                <Trash2 size={20} />
            </button>
            <button onClick={fetchCloudData} disabled={isFetching} className={`text-white px-6 py-3 rounded-lg shadow-lg transition-all font-bold flex items-center gap-2 ${isFetching ? 'bg-secondary/70 cursor-wait' : 'bg-secondary hover:bg-green-700'}`}>
                {isFetching ? <Loader2 size={20} className="animate-spin" /> : <Database size={20} />}
                <span>{isFetching ? 'جاري الاتصال...' : 'جلب الجدول وتوليد المظاريف'}</span>
            </button>
        </div>
      </div>

      {/* Grid */}
      <div className="space-y-8">
        {Object.entries(examsByCommittee).map(([committeeNum, committeeExams]: [string, ExamEnvelope[]]) => {
            const firstExam = committeeExams[0];
            const allGrades = Array.from(new Set(committeeExams.flatMap(e => e.grades)));
            
            return (
                <div key={committeeNum} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                    <div className="bg-gray-50 p-4 border-b border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-4">
                            <div className="bg-white border border-gray-200 w-16 h-16 rounded-xl flex flex-col items-center justify-center shadow-sm">
                                <span className="text-[10px] text-gray-400 font-bold uppercase">Lajna</span>
                                <span className="text-2xl font-black text-secondary">{committeeNum}</span>
                            </div>
                            <div>
                                <div className="flex items-center gap-2 text-gray-800 font-bold text-lg">
                                    <MapPin size={18} className="text-red-500" />
                                    {firstExam.location}
                                </div>
                                <div className="text-sm text-gray-500 flex gap-2 mt-1 flex-wrap">
                                    {allGrades.map(g => (
                                        <span key={g} className="bg-white border px-2 py-0.5 rounded text-xs">{g}</span>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <button 
                            onClick={() => setSelectedCommittee({ number: committeeNum, location: firstExam.location, grades: allGrades })}
                            className="bg-gray-900 text-white px-5 py-2.5 rounded-lg hover:bg-black transition-colors flex items-center gap-2 text-sm font-bold shadow-lg"
                        >
                            <Printer size={16} /> طباعة ملصق اللجنة
                        </button>
                    </div>

                    <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-gray-50/30">
                        {committeeExams.sort((a,b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)).map(exam => (
                            <div key={exam.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col relative group hover:border-secondary/30 transition-all">
                                <div className={`absolute top-4 left-4 w-2 h-2 rounded-full ${
                                    exam.status === EnvelopeStatus.COMPLETED ? 'bg-green-500' : 
                                    exam.status === EnvelopeStatus.RECEIVED ? 'bg-blue-500' : 'bg-gray-300'
                                }`}></div>
                                
                                <div className="flex justify-between items-start mb-3 pl-4">
                                    <span className="text-xs font-bold text-gray-500 flex items-center gap-1 bg-gray-50 px-2 py-1 rounded">
                                        <Calendar size={12}/> {exam.date}
                                    </span>
                                </div>
                                
                                <h4 className="font-bold text-gray-800 text-sm line-clamp-2 min-h-[40px]" title={exam.subject}>
                                    {exam.subject}
                                </h4>
                                
                                <div className="text-xs text-gray-400 mt-2 flex items-center gap-1 border-t pt-2 border-dashed">
                                    <Clock size={12}/> <span className="font-mono">{exam.startTime} - {exam.endTime}</span>
                                </div>
                                
                                <div className="mt-4 pt-2">
                                    {(exam.status === EnvelopeStatus.COMPLETED || exam.status === EnvelopeStatus.DELIVERED) && (
                                        <button 
                                            onClick={() => processAdminDeliveryScan(exam.committeeNumber)}
                                            disabled={exam.status === EnvelopeStatus.DELIVERED}
                                            className={`w-full py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors ${
                                                exam.status === EnvelopeStatus.DELIVERED 
                                                ? 'bg-green-50 text-green-600 cursor-default' 
                                                : 'bg-green-600 text-white hover:bg-green-700'
                                            }`}
                                        >
                                            {exam.status === EnvelopeStatus.DELIVERED ? <CheckCircle size={14}/> : <ScanLine size={14}/>}
                                            {exam.status === EnvelopeStatus.DELIVERED ? 'تم الاستلام' : 'استلام يدوي'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            );
        })}
      </div>

      {/* Confirmation Wizard */}
      {showWizard && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl animate-scale-in">
                  <div className="bg-secondary p-6 text-white flex justify-between items-center">
                      <h3 className="font-bold text-xl flex items-center gap-2"><CheckCircle className="text-white" /> البيانات جاهزة</h3>
                      <button onClick={() => setShowWizard(false)} className="hover:bg-white/20 p-2 rounded-full"><X size={20}/></button>
                  </div>
                  <div className="p-8 space-y-6">
                      <div className="bg-blue-50 p-4 rounded-xl text-sm text-blue-800 border border-blue-100">
                          <p><strong>جاهز للتوليد:</strong></p>
                          <ul className="list-disc list-inside mt-2 space-y-1">
                              <li>عدد الأيام: {cloudSchedule?.days.length}</li>
                              <li>عدد الطلاب الموزعين: {students.filter(s => s.committeeNumber).length}</li>
                              <li>عدد اللجان: {Object.keys(cloudCommittees).length}</li>
                          </ul>
                      </div>
                      <button onClick={handleGenerate} className="w-full bg-secondary text-white py-4 rounded-xl font-bold text-lg hover:bg-green-700 shadow-lg flex items-center justify-center gap-2">
                          <Play size={24}/> اعتماد وإنشاء المظاريف
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* QR Modal & Scanner & Delete Modal */}
      {selectedCommittee && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden relative">
            <button onClick={() => setSelectedCommittee(null)} className="absolute top-4 left-4 bg-gray-100 p-2 rounded-full"><X size={20} /></button>
            <div className="p-8 flex flex-col items-center text-center">
              <div className="text-4xl font-black text-gray-900 mb-2">لجنة {selectedCommittee.number}</div>
              <div className="flex items-center justify-center gap-2 text-gray-500 mb-6 bg-gray-50 px-4 py-1.5 rounded-full text-sm font-bold border border-gray-100">
                  <MapPin size={16} className="text-secondary"/> {selectedCommittee.location}
              </div>
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
      
      {showScanner && (
         <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 rounded-2xl w-full max-w-lg overflow-hidden relative shadow-2xl border border-gray-800">
               <button onClick={() => setShowScanner(false)} className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 p-2 rounded-full text-white z-20"><X size={20}/></button>
               <div className="p-8 flex flex-col items-center relative h-[500px]">
                   <h3 className="text-xl font-bold text-white mb-8 flex items-center gap-3 z-10"><ScanLine className="text-purple-400" /> ماسح الكنترول</h3>
                   <div className="absolute inset-0 z-0 bg-black flex items-center justify-center overflow-hidden rounded-xl">
                       <div id="admin-reader" className="w-full h-full object-cover opacity-80"></div>
                   </div>
                   {scanResult && (
                       <div className="absolute bottom-10 left-0 right-0 flex justify-center z-20">
                           <div className={`px-6 py-3 rounded-full font-bold flex items-center gap-2 shadow-2xl animate-bounce ${scanResult.success ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                               {scanResult.success ? <CheckCircle size={20}/> : <AlertTriangle size={20}/>} {scanResult.msg}
                           </div>
                       </div>
                   )}
               </div>
            </div>
         </div>
      )}

       {showDeleteAllModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-scale-in">
                  <div className="bg-red-50 p-6 flex flex-col items-center text-center border-b border-red-100">
                      <div className="bg-red-100 p-4 rounded-full mb-4"><Trash2 size={32} className="text-red-600"/></div>
                      <h3 className="text-xl font-bold text-gray-900">مسح كافة المظاريف؟</h3>
                      <p className="text-gray-500 mt-2 text-sm">سيتم إعادة توليدها عند الجلب مرة أخرى.</p>
                  </div>
                  <div className="p-4 bg-white flex gap-3">
                      <button onClick={() => setShowDeleteAllModal(false)} className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200">إلغاء</button>
                      <button onClick={() => { clearAllExams(); setShowDeleteAllModal(false); }} className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700">نعم، مسح الكل</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
