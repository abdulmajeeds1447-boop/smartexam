import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { QRCodeCanvas } from 'qrcode.react';
import { 
  Printer, X, CheckCircle, UploadCloud, MapPin, Calendar, 
  Download, Settings, Play, Info, Trash2, ScanLine, 
  AlertTriangle, Database, Loader2, Edit3 
} from 'lucide-react';
import { EnvelopeStatus, ExamEnvelope, Student, AttendanceStatus, SubjectDetail } from '../../types';
import * as XLSX from 'xlsx';
import { Html5Qrcode } from 'html5-qrcode';
import { doc, getDoc, getDocs, collection } from 'firebase/firestore'; 
import { db } from '../../firebase';

// --- دالة توحيد أسماء الصفوف ---
const normalizeGrade = (gradeStr: string): string => {
    if (!gradeStr) return '';
    const s = gradeStr.toString();
    if (s.includes('أول') || s.includes('اول') || s.includes('1')) return 'أول';
    if (s.includes('ثاني') || s.includes('2')) return 'ثاني';
    if (s.includes('ثالث') || s.includes('3')) return 'ثالث';
    return '';
};

// هيكل صف الجدول الموحد
interface ScheduleRow {
    id: number;
    date: string;
    periodLabel: string; // الفترة الأولى / الفترة الثانية
    startTime: string;
    endTime: string;
    // مواد المراحل الثلاث في نفس السطر لضمان الدمج
    subject1: string; // أول ثانوي
    subject2: string; // ثاني ثانوي
    subject3: string; // ثالث ثانوي
}

export const ExamManagement: React.FC = () => {
  const { exams, students, importExams, clearAllExams, processAdminDeliveryScan } = useApp();
  
  // UI States
  const [selectedCommittee, setSelectedCommittee] = useState<{number: string, location: string, grades: string[]} | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  
  // Scanner
  const [scanResult, setScanResult] = useState<{success: boolean, msg: string} | null>(null);
  const [lastScannedId, setLastScannedId] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // Data
  const [cloudCommittees, setCloudCommittees] = useState<Record<string, Student[]>>({});
  const [committeeLocations, setCommitteeLocations] = useState<Record<string, string>>({}); 
  
  // --- جدول الاختبارات الافتراضي (يمكنك تعديله من الواجهة) ---
  const [scheduleRows, setScheduleRows] = useState<ScheduleRow[]>([
      { id: 1, date: new Date().toISOString().split('T')[0], periodLabel: 'الفترة الأولى', startTime: '07:30', endTime: '10:00', subject1: 'رياضيات', subject2: 'رياضيات', subject3: 'رياضيات' },
      { id: 2, date: new Date().toISOString().split('T')[0], periodLabel: 'الفترة الثانية', startTime: '10:30', endTime: '12:30', subject1: '', subject2: 'لغة عربية', subject3: '' },
  ]);

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

  // 2. تجميع المظاريف للعرض
  const examsByCommittee = useMemo(() => {
      const groups: Record<string, ExamEnvelope[]> = {};
      exams.forEach(exam => {
          if (!groups[exam.committeeNumber]) groups[exam.committeeNumber] = [];
          groups[exam.committeeNumber].push(exam);
      });
      return groups;
  }, [exams]);

  // --- جلب البيانات (المقرات) ---
  const fetchCloudData = async () => {
      setIsFetching(true);
      try {
          const configSnapshot = await getDocs(collection(db, 'system_config'));
          const locationsMap: Record<string, string> = {};
          
          configSnapshot.forEach(docSnap => {
              const data = docSnap.data();
              if (data.committeeNumber && data.location) {
                  locationsMap[String(data.committeeNumber)] = data.location;
              }
          });
          setCommitteeLocations(locationsMap);
          setShowWizard(true); // فتح الجدول للتعديل قبل التوليد
      } catch (error) {
          console.error("Error:", error);
          alert("خطأ في الاتصال بالسحابة.");
      } finally {
          setIsFetching(false);
      }
  };

  // --- إدارة صفوف الجدول ---
  const addScheduleRow = () => {
      const lastRow = scheduleRows[scheduleRows.length - 1];
      const nextDate = new Date(lastRow.date);
      // إذا كانت الفترة الحالية هي الأولى، أضف الفترة الثانية لنفس اليوم، وإلا انتقل لليوم التالي
      const isPeriod1 = lastRow.periodLabel.includes('الأولى');
      
      if (!isPeriod1) {
          nextDate.setDate(nextDate.getDate() + 1);
      }

      setScheduleRows([
          ...scheduleRows,
          { 
              id: Date.now(), 
              date: isPeriod1 ? lastRow.date : nextDate.toISOString().split('T')[0], 
              periodLabel: isPeriod1 ? 'الفترة الثانية' : 'الفترة الأولى', 
              startTime: isPeriod1 ? '10:30' : '07:30', 
              endTime: isPeriod1 ? '12:30' : '10:00', 
              subject1: '', 
              subject2: '', 
              subject3: '' 
          }
      ]);
  };

  const removeScheduleRow = (id: number) => {
      setScheduleRows(scheduleRows.filter(r => r.id !== id));
  };

  const updateRow = (id: number, field: keyof ScheduleRow, value: string) => {
      setScheduleRows(scheduleRows.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  // --- المحرك الرئيسي: التوليد (Generation Engine) ---
  const handleGenerate = () => {
      const newExams: ExamEnvelope[] = [];
      const committeeKeys = Object.keys(cloudCommittees).filter(k => k !== 'General' && k !== 'احتياط');

      if (committeeKeys.length === 0) {
          alert("لا توجد لجان موزعة (لا يوجد طلاب مرتبطين بلجان).");
          return;
      }

      // 1. نمر على كل سطر في الجدول (فترة زمنية واحدة)
      scheduleRows.forEach((row) => {
          // تخطي الأسطر التي لا يوجد فيها أي مادة
          if (!row.subject1 && !row.subject2 && !row.subject3) return; 

          // 2. نمر على كل لجنة
          committeeKeys.forEach(commNum => {
              const commStudents = cloudCommittees[commNum];
              
              const affectedStudents: Student[] = [];
              const gradesInEnvelope: string[] = [];
              const subjectsInEnvelope: string[] = [];
              
              // 3. نمر على طلاب اللجنة ونوزع المواد بناءً على الصف
              commStudents.forEach(student => {
                  const sGradeNorm = normalizeGrade(student.grade); // توحيد: "الثاني ثانوي" -> "ثاني"
                  let subjectName = '';

                  // تحديد المادة بناءً على صف الطالب
                  if (sGradeNorm === 'أول') subjectName = row.subject1;
                  else if (sGradeNorm === 'ثاني') subjectName = row.subject2;
                  else if (sGradeNorm === 'ثالث') subjectName = row.subject3;

                  // إذا وجدنا مادة للطالب، نضيفه للمظروف
                  if (subjectName) {
                      affectedStudents.push({ ...student, subject: subjectName });
                      
                      // للإحصائيات والعرض
                      const gradeDisplay = sGradeNorm + ' ثانوي';
                      if (!gradesInEnvelope.includes(gradeDisplay)) gradesInEnvelope.push(gradeDisplay);
                      if (!subjectsInEnvelope.includes(subjectName)) subjectsInEnvelope.push(subjectName);
                  }
              });

              // 4. إذا وجدنا طلاباً، ننشئ المظروف الموحد
              if (affectedStudents.length > 0) {
                  // إزالة التكرار من المواد للعرض (مثلاً: رياضيات + رياضيات -> رياضيات)
                  const uniqueSubjects = Array.from(new Set(subjectsInEnvelope));
                  
                  // معرف فريد للمظروف
                  const examId = `EX-${commNum}-${row.date}-${row.periodLabel.replace(/\s/g,'')}`;
                  const realLocation = committeeLocations[commNum] || `مقر ${commNum}`;

                  newExams.push({
                      id: examId,
                      subject: uniqueSubjects.join(' + '), // دمج المواد في عنوان واحد
                      grades: gradesInEnvelope,
                      committeeNumber: commNum,
                      location: realLocation,
                      date: row.date,
                      startTime: row.startTime,
                      endTime: row.endTime,
                      period: row.periodLabel,
                      status: EnvelopeStatus.PENDING,
                      students: affectedStudents, // جميع الطلاب (أول وثاني وثالث) هنا
                      attendance: affectedStudents.map(s => ({ studentId: s.id, status: AttendanceStatus.PRESENT }))
                  });
              }
          });
      });

      importExams(newExams);
      setShowWizard(false);
      alert(`✅ تم توليد ${newExams.length} مظروف بنجاح!`);
  };

  // --- دوال الماسح الضوئي (نفس السابق) ---
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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">إدارة الاختبارات</h2>
          <p className="text-gray-500 text-sm mt-1">
             {students.length > 0 
                ? `● المتصل: ${students.length} طالب | ${exams.length} مظروف` 
                : '○ بانتظار البيانات...'}
          </p>
        </div>
        <div className="flex gap-2">
             <button onClick={() => setShowDeleteAllModal(true)} className="bg-white text-red-600 border border-red-100 px-4 py-3 rounded-lg hover:bg-red-50 flex items-center gap-2" title="تصفير">
                <Trash2 size={20} />
            </button>
            <button onClick={fetchCloudData} disabled={isFetching} className={`text-white px-6 py-3 rounded-lg shadow-lg transition-all font-bold flex items-center gap-2 ${isFetching ? 'bg-secondary/70' : 'bg-secondary hover:bg-green-700'}`}>
                {isFetching ? <Loader2 size={20} className="animate-spin" /> : <Database size={20} />}
                <span>إعداد الجدول وتوليد المظاريف</span>
            </button>
        </div>
      </div>

      {/* Grid Display (Exams) */}
      <div className="space-y-8">
          {Object.entries(examsByCommittee).map(([committeeNum, committeeExams]) => (
             <div key={committeeNum} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                 <div className="bg-gray-50 p-4 border-b flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="bg-blue-600 text-white w-12 h-12 rounded-lg flex items-center justify-center font-bold text-xl">{committeeNum}</div>
                        <div>
                            <div className="font-bold text-lg flex items-center gap-2"><MapPin size={16} className="text-red-500"/> {committeeExams[0].location}</div>
                            {/* عرض جميع المراحل الموجودة في هذه اللجنة */}
                            <div className="text-xs text-gray-500 flex gap-1 flex-wrap">
                                {Array.from(new Set(committeeExams.flatMap(e=>e.grades))).map(g => (
                                    <span key={g} className="bg-white border px-1 rounded">{g}</span>
                                ))}
                            </div>
                        </div>
                    </div>
                    <button 
                        onClick={() => setSelectedCommittee({number: committeeNum, location: committeeExams[0].location, grades: committeeExams[0].grades})}
                        className="bg-black text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2"
                    >
                        <Printer size={16}/> طباعة
                    </button>
                 </div>
                 <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                     {committeeExams.map(exam => (
                         <div key={exam.id} className="border p-3 rounded-lg relative bg-white hover:shadow-md transition-shadow">
                             <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-lg ${exam.status === EnvelopeStatus.COMPLETED ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                             <div className="pl-3">
                                 <div className="flex justify-between text-xs text-gray-500 mb-1">
                                     <span className="font-bold bg-gray-100 px-2 rounded">{exam.date}</span>
                                     <span>{exam.period}</span>
                                 </div>
                                 <div className="font-bold text-gray-800 mb-1">{exam.subject}</div>
                                 <div className="text-xs text-gray-400 flex justify-between">
                                     <span>{exam.startTime} - {exam.endTime}</span>
                                     <span className="text-blue-600 font-bold">{exam.students.length} طالب</span>
                                 </div>
                                 
                                 {/* زر الاستلام السريع */}
                                 {(exam.status === EnvelopeStatus.COMPLETED) && (
                                     <button onClick={() => processAdminDeliveryScan(exam.committeeNumber)} className="mt-2 w-full bg-green-100 text-green-700 text-xs py-1 rounded font-bold flex items-center justify-center gap-1">
                                         <CheckCircle size={12}/> استلام (Scan)
                                     </button>
                                 )}
                             </div>
                         </div>
                     ))}
                 </div>
             </div>
          ))}
      </div>

      {/* --- WIZARD: SCHEDULE EDITOR (الحل الجذري) --- */}
      {showWizard && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl animate-scale-in">
                  
                  {/* Wizard Header */}
                  <div className="p-6 bg-gray-900 text-white flex justify-between items-center shrink-0">
                      <div>
                          <h3 className="text-xl font-bold flex items-center gap-2"><Edit3 className="text-yellow-400" /> إعداد الجدول العام (دمج المراحل)</h3>
                          <p className="text-gray-400 text-xs mt-1">تنبيه: سيتم دمج جميع المواد في السطر الواحد داخل مظروف واحد لكل لجنة.</p>
                      </div>
                      <button onClick={() => setShowWizard(false)} className="bg-white/10 hover:bg-white/20 p-2 rounded-full"><X size={20}/></button>
                  </div>

                  {/* Schedule Table */}
                  <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
                      <table className="w-full text-sm bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200">
                          <thead className="bg-gray-200 text-gray-800 font-bold text-xs uppercase">
                              <tr>
                                  <th className="p-3 text-center w-10">#</th>
                                  <th className="p-3 text-right w-32">التاريخ</th>
                                  <th className="p-3 text-right w-28">الفترة</th>
                                  <th className="p-3 text-right w-24">من</th>
                                  <th className="p-3 text-right w-24">إلى</th>
                                  <th className="p-3 text-right bg-green-50 text-green-900 border-r border-green-200">
                                      مادة (أول ثانوي)
                                  </th>
                                  <th className="p-3 text-right bg-blue-50 text-blue-900 border-r border-blue-200">
                                      مادة (ثاني ثانوي)
                                  </th>
                                  <th className="p-3 text-right bg-purple-50 text-purple-900 border-r border-purple-200">
                                      مادة (ثالث ثانوي)
                                  </th>
                                  <th className="p-3 text-center w-10"></th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                              {scheduleRows.map((row, idx) => (
                                  <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                                      <td className="p-3 text-center text-gray-400">{idx + 1}</td>
                                      <td className="p-2"><input type="date" value={row.date} onChange={e => updateRow(row.id, 'date', e.target.value)} className="w-full p-2 border rounded font-mono bg-gray-50 focus:bg-white"/></td>
                                      <td className="p-2">
                                          <select value={row.periodLabel} onChange={e => updateRow(row.id, 'periodLabel', e.target.value)} className="w-full p-2 border rounded bg-gray-50 focus:bg-white">
                                              <option value="الفترة الأولى">الفترة الأولى</option>
                                              <option value="الفترة الثانية">الفترة الثانية</option>
                                          </select>
                                      </td>
                                      <td className="p-2"><input type="time" value={row.startTime} onChange={e => updateRow(row.id, 'startTime', e.target.value)} className="w-full p-2 border rounded font-mono bg-gray-50 focus:bg-white"/></td>
                                      <td className="p-2"><input type="time" value={row.endTime} onChange={e => updateRow(row.id, 'endTime', e.target.value)} className="w-full p-2 border rounded font-mono bg-gray-50 focus:bg-white"/></td>
                                      
                                      {/* Subject Inputs - The core fix */}
                                      <td className="p-2 bg-green-50/20 border-r border-green-100"><input type="text" placeholder="مثال: رياضيات" value={row.subject1} onChange={e => updateRow(row.id, 'subject1', e.target.value)} className="w-full p-2 border border-green-200 rounded focus:ring-2 focus:ring-green-500 outline-none"/></td>
                                      <td className="p-2 bg-blue-50/20 border-r border-blue-100"><input type="text" placeholder="مثال: فيزياء" value={row.subject2} onChange={e => updateRow(row.id, 'subject2', e.target.value)} className="w-full p-2 border border-blue-200 rounded focus:ring-2 focus:ring-blue-500 outline-none"/></td>
                                      <td className="p-2 bg-purple-50/20 border-r border-purple-100"><input type="text" placeholder="مثال: كيمياء" value={row.subject3} onChange={e => updateRow(row.id, 'subject3', e.target.value)} className="w-full p-2 border border-purple-200 rounded focus:ring-2 focus:ring-purple-500 outline-none"/></td>
                                      
                                      <td className="p-2 text-center">
                                          <button onClick={() => removeScheduleRow(row.id)} className="text-red-400 hover:text-red-600 bg-white p-1 rounded hover:bg-red-50"><Trash2 size={16}/></button>
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                      
                      <button onClick={addScheduleRow} className="mt-4 w-full border-2 border-dashed border-gray-300 text-gray-500 font-bold py-3 rounded-lg hover:border-primary-500 hover:text-primary-600 transition-colors flex items-center justify-center gap-2">
                          + إضافة سطر جديد للجدول
                      </button>
                  </div>

                  {/* Generate Button */}
                  <div className="p-6 border-t bg-white shrink-0 flex justify-between items-center">
                      <div className="text-sm text-gray-500">
                           <span>عدد الطلاب الجاهزون للتوزيع: <strong>{students.length}</strong></span>
                           <span className="mx-2">|</span>
                           <span>عدد اللجان: <strong>{Object.keys(cloudCommittees).length}</strong></span>
                      </div>
                      <button onClick={handleGenerate} className="bg-primary-600 text-white px-8 py-3 rounded-xl font-bold text-lg hover:bg-primary-700 shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95">
                          <Play size={24}/> اعتماد الجدول وتوليد المظاريف الآن
                      </button>
                  </div>
              </div>
          </div>
      )}
      
      {/* QR Code Modal (للطباعة) */}
      {selectedCommittee && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 text-center max-w-sm w-full relative">
             <button onClick={() => setSelectedCommittee(null)} className="absolute top-4 left-4 p-2 bg-gray-100 rounded-full"><X size={20}/></button>
             <h3 className="text-2xl font-bold mb-2">لجنة {selectedCommittee.number}</h3>
             <p className="text-gray-500 mb-6">{selectedCommittee.location}</p>
             <div className="border-4 border-black p-4 rounded-xl inline-block mb-6">
                <QRCodeCanvas value={JSON.stringify({ type: 'committee', id: selectedCommittee.number })} size={200} />
             </div>
             <div className="text-xs text-gray-400 mb-4 px-4">
                 يشمل: {selectedCommittee.grades.join(' + ')}
             </div>
             <button onClick={() => window.print()} className="w-full bg-black text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2">
                 <Printer size={20}/> طباعة الملصق
             </button>
          </div>
        </div>
      )}

      {/* Scanner (للأدمن) */}
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

      {/* Delete Confirmation */}
       {showDeleteAllModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-xl p-6 max-w-sm w-full text-center">
                  <Trash2 size={40} className="text-red-500 mx-auto mb-4" />
                  <h3 className="text-xl font-bold mb-2">مسح الكل؟</h3>
                  <p className="text-gray-500 text-sm mb-6">سيتم حذف المظاريف الحالية لإنشاء جدول جديد.</p>
                  <div className="flex gap-2">
                      <button onClick={() => setShowDeleteAllModal(false)} className="flex-1 bg-gray-100 py-2 rounded-lg font-bold">إلغاء</button>
                      <button onClick={() => { clearAllExams(); setShowDeleteAllModal(false); }} className="flex-1 bg-red-600 text-white py-2 rounded-lg font-bold">مسح</button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};
