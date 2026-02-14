import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { QRCodeCanvas } from 'qrcode.react';
import { Printer, X, CheckCircle, MapPin, Calendar, Settings, Play, Info, Trash2, ScanLine, AlertTriangle, Database, RefreshCw, Clock } from 'lucide-react';
import { EnvelopeStatus, ExamEnvelope, Student, AttendanceStatus, ExamSchedule, SubjectDetail } from '../../types';
import { Html5Qrcode } from 'html5-qrcode';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';

export const ExamManagement: React.FC = () => {
  const { exams, students, importExams, clearAllExams, processAdminDeliveryScan } = useApp();
  const [selectedCommittee, setSelectedCommittee] = useState<{number: string, location: string, grades: string[]} | null>(null);
  
  // UI States
  const [showWizard, setShowWizard] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scanResult, setScanResult] = useState<{success: boolean, msg: string} | null>(null);
  const [lastScannedId, setLastScannedId] = useState<string | null>(null);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);

  // Data States
  const [cloudSchedule, setCloudSchedule] = useState<ExamSchedule | null>(null);
  const [cloudCommittees, setCloudCommittees] = useState<Record<string, Student[]>>({});

  const scannerRef = useRef<Html5Qrcode | null>(null);

  // --- 1. Prepare Students Data (Group by Committee) ---
  useEffect(() => {
    if (students.length > 0) {
        const groups: Record<string, Student[]> = {};
        students.forEach(s => {
            // Use the committee number synced from System 1
            const commNum = s.committeeNumber || 'General';
            if (!groups[commNum]) groups[commNum] = [];
            groups[commNum].push(s);
        });
        setCloudCommittees(groups);
    }
  }, [students]);

  // --- 2. Group Exams for Display ---
  const examsByCommittee = useMemo(() => {
      const groups: Record<string, ExamEnvelope[]> = {};
      exams.forEach(exam => {
          if (!groups[exam.committeeNumber]) groups[exam.committeeNumber] = [];
          groups[exam.committeeNumber].push(exam);
      });
      return groups;
  }, [exams]);

  // List of committees pending delivery
  const pendingDeliveryCommittees = useMemo(() => {
      const today = new Date().toISOString().split('T')[0];
      const pending = exams.filter(e => 
        e.date === today && 
        e.status === EnvelopeStatus.COMPLETED
      ).map(e => e.committeeNumber);
      return Array.from(new Set(pending)).sort();
  }, [exams]);

  // --- 3. Scanner Logic ---
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

  // --- 4. Fetch Schedule from Firebase ---
  const fetchCloudSchedule = async () => {
      try {
          const docRef = doc(db, 'system_config', 'exam_schedule');
          const snap = await getDoc(docRef);
          if (snap.exists()) {
              setCloudSchedule(snap.data() as ExamSchedule);
              setShowWizard(true);
          } else {
              alert("لم يتم العثور على جدول! يرجى التأكد من 'حفظ الجدول' ثم 'تصدير' من النظام الأول.");
          }
      } catch (error) {
          console.error(error);
          alert("حدث خطأ أثناء الاتصال بقاعدة البيانات.");
      }
  };

  // --- 5. Generate Exams Logic (The Core) ---
  const handleGenerate = () => {
      if (!cloudSchedule) return;

      const newExams: ExamEnvelope[] = [];
      const committeeKeys = Object.keys(cloudCommittees).filter(k => k !== 'General' && k !== 'احتياط');

      if (committeeKeys.length === 0) {
          alert("لا توجد لجان موزعة (لا يوجد طلاب مرتبطين بلجان). تأكد من استيراد الطلاب في النظام الأول.");
          return;
      }

      // Loop Days
      cloudSchedule.days.forEach((daySchedule) => {
          const dateStr = daySchedule.date;

          // Loop Periods
          daySchedule.periods.forEach((period) => {
              
              // Loop Committees
              committeeKeys.forEach(commNum => {
                  const commStudents = cloudCommittees[commNum];
                  
                  // Analyze subjects for this committee in this period
                  const relevantSubjects: string[] = [];
                  const affectedStudents: Student[] = [];
                  const gradesInCommittee: string[] = [];
                  
                  let earliestStart = "23:59";
                  let latestEnd = "00:00";

                  commStudents.forEach(student => {
                      const studentStage = student.grade; // Matches Stage Name in Sys 1
                      
                      // Check if this stage has a subject in this period
                      const subjectDetail: SubjectDetail | undefined = period.subjects?.[studentStage];

                      if (subjectDetail && subjectDetail.name) {
                          affectedStudents.push({ 
                              ...student, 
                              subject: subjectDetail.name 
                          });

                          if (!relevantSubjects.includes(subjectDetail.name)) relevantSubjects.push(subjectDetail.name);
                          if (!gradesInCommittee.includes(studentStage)) gradesInCommittee.push(studentStage);

                          if (subjectDetail.startTime < earliestStart) earliestStart = subjectDetail.startTime;
                          if (subjectDetail.endTime > latestEnd) latestEnd = subjectDetail.endTime;
                      }
                  });

                  if (affectedStudents.length > 0) {
                      // Create display subject name
                      const subjectDisplay = gradesInCommittee.map(g => {
                          const sub = period.subjects?.[g];
                          return sub ? `${sub.name}` : '';
                      }).filter(Boolean).join(' + ');

                      const examId = `EX-${commNum}-${dateStr}-P${period.periodId}`;
                      
                      newExams.push({
                          id: examId,
                          subject: subjectDisplay, 
                          grades: gradesInCommittee,
                          committeeNumber: commNum,
                          location: `مقر ${commNum}`, // Can be enhanced if location stored in firebase
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
      alert(`تم توليد ${newExams.length} مظروف اختبار بنجاح!`);
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">إدارة الاختبارات</h2>
          <p className="text-gray-500">
             {students.length > 0 ? `النظام متصل: ${students.length} طالب جاهز` : 'جاري مزامنة البيانات...'}
          </p>
        </div>
        
        <div className="flex gap-2 flex-wrap">
             <button 
                onClick={() => setShowScanner(true)}
                className="bg-purple-600 text-white border border-purple-600 px-4 py-3 rounded-lg hover:bg-purple-700 flex items-center gap-2 shadow-lg shadow-purple-200"
             >
                <ScanLine size={20} />
                <span className="hidden md:inline">استلام للكنترول (Scan)</span>
            </button>

             <button 
                onClick={() => setShowDeleteAllModal(true)}
                className="bg-red-50 text-red-600 border border-red-100 px-4 py-3 rounded-lg hover:bg-red-100 flex items-center gap-2"
             >
                <Trash2 size={20} />
                <span className="hidden md:inline">مسح الكل</span>
            </button>

            <button 
                onClick={fetchCloudSchedule}
                className="bg-secondary hover:bg-secondary/90 text-white px-6 py-3 rounded-lg shadow transition-colors font-bold flex items-center gap-2"
            >
                <Database size={20} />
                جلب الجدول وتوليد المظاريف
            </button>
        </div>
      </div>

      {exams.length === 0 ? (
        <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-12 text-center">
            <div className="bg-gray-50 p-4 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                <RefreshCw size={40} className="text-gray-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-700">الجدول فارغ</h3>
            <p className="text-gray-500 mt-2">اضغط على زر "جلب الجدول وتوليد المظاريف" لجلب الخطة المعتمدة من النظام الرئيسي.</p>
        </div>
      ) : (
          <div className="space-y-8">
            {Object.entries(examsByCommittee).map(([committeeNum, committeeExams]: [string, ExamEnvelope[]]) => {
                const firstExam = committeeExams[0];
                
                return (
                    <div key={committeeNum} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        {/* Committee Header */}
                        <div className="bg-gray-50 p-4 border-b border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4">
                            <div className="flex items-center gap-4">
                                <div className="bg-primary-600 text-white p-3 rounded-lg shadow-sm">
                                    <span className="block text-xs opacity-75">لجنة رقم</span>
                                    <span className="text-xl font-bold">{committeeNum}</span>
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 text-gray-800 font-bold text-lg">
                                        <MapPin size={18} className="text-primary-500" />
                                        {firstExam.location}
                                    </div>
                                    <div className="text-sm text-gray-500">
                                        {firstExam.grades.join(' • ')}
                                    </div>
                                </div>
                            </div>
                            
                            <button 
                                onClick={() => setSelectedCommittee({
                                    number: committeeNum, 
                                    location: firstExam.location,
                                    grades: firstExam.grades
                                })}
                                className="bg-black text-white px-6 py-2 rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2 shadow-lg"
                            >
                                <Printer size={18} />
                                طباعة ملصق اللجنة
                            </button>
                        </div>

                        {/* Exams Grid */}
                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-gray-50/50">
                            {committeeExams.sort((a,b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)).map(exam => (
                                <div key={exam.id} className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm flex flex-col relative hover:shadow-md transition-all">
                                    <div className={`absolute top-0 left-0 w-1 h-full rounded-l-lg ${
                                        exam.status === EnvelopeStatus.COMPLETED ? 'bg-green-500' : 
                                        exam.status === EnvelopeStatus.RECEIVED ? 'bg-blue-500' : 'bg-gray-300'
                                    }`}></div>
                                    
                                    <div className="flex justify-between items-start mb-2 pl-3">
                                        <div className="text-xs font-bold text-gray-500 flex items-center gap-1">
                                            <Calendar size={12}/> {exam.date}
                                        </div>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                                            exam.status === EnvelopeStatus.COMPLETED ? 'bg-green-100 text-green-700' : 
                                            exam.status === EnvelopeStatus.RECEIVED ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                                        }`}>
                                            {exam.status === EnvelopeStatus.RECEIVED ? 'جاري الآن' : 
                                             exam.status === EnvelopeStatus.COMPLETED ? 'منتهي' : 
                                             exam.period}
                                        </span>
                                    </div>
                                    
                                    <h4 className="font-bold text-gray-800 pl-3 line-clamp-2 h-10" title={exam.subject}>{exam.subject}</h4>
                                    <div className="text-xs text-gray-400 pl-3 mt-1 flex items-center gap-1">
                                        <Clock size={12}/> {exam.startTime} - {exam.endTime}
                                    </div>
                                    
                                    <div className="mt-3 pl-3 flex gap-2">
                                        {(exam.status === EnvelopeStatus.COMPLETED || exam.status === EnvelopeStatus.DELIVERED) && (
                                            <button 
                                                onClick={() => deliverEnvelopeToControl(exam.id)}
                                                disabled={exam.status === EnvelopeStatus.DELIVERED}
                                                className={`text-xs flex-1 py-1.5 rounded flex items-center justify-center gap-1 ${
                                                    exam.status === EnvelopeStatus.DELIVERED 
                                                    ? 'bg-green-50 text-green-600' 
                                                    : 'bg-green-600 text-white hover:bg-green-700'
                                                }`}
                                            >
                                                {exam.status === EnvelopeStatus.DELIVERED ? <CheckCircle size={12}/> : null}
                                                {exam.status === EnvelopeStatus.DELIVERED ? 'تم الاستلام' : 'استلام للكنترول'}
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
      )}

      {/* ADMIN SCANNER MODAL */}
      {showScanner && (
         <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 rounded-2xl w-full max-w-lg overflow-hidden relative shadow-2xl animate-scale-in border border-gray-700">
               <button onClick={() => setShowScanner(false)} className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 p-2 rounded-full text-white z-20"><X size={20}/></button>
               <div className="p-8 flex flex-col items-center relative h-[450px]">
                   <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2 z-10"><ScanLine className="text-purple-400" /> ماسح استلام المظاريف</h3>
                   <div className="absolute inset-0 z-0 bg-black flex items-center justify-center"><div id="admin-reader" className="w-full h-full"></div></div>
                   {/* Results & Simulation UI similar to previous code */}
               </div>
            </div>
         </div>
      )}

      {/* CONFIRMATION WIZARD (Fetched Schedule Preview) */}
      {showWizard && cloudSchedule && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl animate-scale-in">
                  <div className="p-6 border-b flex justify-between items-center">
                      <h3 className="font-bold text-xl flex items-center gap-2"><CheckCircle className="text-green-500" /> تم جلب الجدول بنجاح</h3>
                      <button onClick={() => setShowWizard(false)}><X size={20}/></button>
                  </div>
                  <div className="p-6 space-y-4">
                      <div className="bg-blue-50 p-4 rounded-xl text-sm text-blue-800 border border-blue-100">
                          <p><strong>ملخص البيانات المستلمة:</strong></p>
                          <ul className="list-disc list-inside mt-2 space-y-1">
                              <li>عدد الأيام: {cloudSchedule.days.length}</li>
                              <li>عدد الطلاب الجاهزون: {students.length}</li>
                              <li>عدد اللجان: {Object.keys(cloudCommittees).length}</li>
                          </ul>
                      </div>
                      <p className="text-gray-600 text-sm">سيقوم النظام بدمج الطلاب مع موادهم وأوقاتهم وإنشاء المظاريف الرقمية.</p>
                      <button onClick={handleGenerate} className="w-full bg-primary-600 text-white py-3 rounded-xl font-bold hover:bg-primary-700 shadow-lg flex items-center justify-center gap-2">
                          <Play size={20}/> اعتماد وإنشاء المظاريف
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* STATIC COMMITTEE QR Modal */}
      {selectedCommittee && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden animate-scale-in">
            <div className="bg-black p-4 flex justify-between items-center text-white">
              <h3 className="font-bold">ملصق اللجنة</h3>
              <button onClick={() => setSelectedCommittee(null)} className="hover:bg-white/20 p-1 rounded-full"><X size={20} /></button>
            </div>
            <div className="p-8 flex flex-col items-center text-center">
              <div className="border-4 border-black p-4 rounded-xl mb-6 bg-white">
                <QRCodeCanvas value={JSON.stringify({ type: 'committee', id: selectedCommittee.number })} size={200} level="H" />
              </div>
              <div className="text-4xl font-black text-gray-800 mb-2">لجنة {selectedCommittee.number}</div>
              <div className="flex items-center justify-center gap-2 text-gray-500 mb-4 bg-gray-100 px-3 py-1 rounded-full text-sm"><MapPin size={16} /> {selectedCommittee.location}</div>
              <button onClick={() => window.print()} className="mt-6 w-full bg-gray-900 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"><Printer size={20} /> طباعة الملصق</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete All Modal */}
       {showDeleteAllModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-scale-in">
                  <div className="bg-red-600 text-white p-6 flex justify-between items-center">
                      <h3 className="text-xl font-bold">مسح البيانات</h3>
                      <button onClick={() => setShowDeleteAllModal(false)} className="hover:bg-white/20 p-2 rounded-full"><X size={20}/></button>
                  </div>
                  <div className="p-8 text-center space-y-4">
                      <div className="bg-red-50 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto text-red-600 mb-2"><Trash2 size={32} /></div>
                      <h4 className="font-bold text-gray-900 text-lg">هل أنت متأكد؟</h4>
                      <div className="flex gap-3 mt-6">
                          <button onClick={() => setShowDeleteAllModal(false)} className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold">إلغاء</button>
                          <button onClick={() => { clearAllExams(); setShowDeleteAllModal(false); }} className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold">نعم، مسح الكل</button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
