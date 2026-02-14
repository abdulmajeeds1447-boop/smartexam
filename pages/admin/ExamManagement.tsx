import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { QRCodeCanvas } from 'qrcode.react';
import { Printer, X, CheckCircle, UploadCloud, MapPin, Calendar, Download, Settings, Play, Info, Trash2, ScanLine, AlertTriangle, Edit2 } from 'lucide-react';
import { EnvelopeStatus, ExamEnvelope, Student, AttendanceStatus } from '../../types';
import * as XLSX from 'xlsx';
import { Html5Qrcode } from 'html5-qrcode';

// Internal type for the Wizard
interface CommitteeData {
    committeeNumber: string;
    location: string;
    grades: string[];
    students: Student[];
}

// --- DEFAULT TEMPLATE ---
const DEFAULT_SCHEDULE_TEMPLATE = [
  // Sunday 15/7
  {
    periodLabel: 'الفترة الأولى',
    startTime: '07:30',
    endTime: '10:00', 
    subjects: {
      'أول': 'رياضيات',
      'ثاني': 'رياضيات',
      'ثالث': 'رياضيات'
    }
  },
  {
    periodLabel: 'الفترة الثانية',
    startTime: '10:30',
    endTime: '12:30',
    subjects: {
      'ثاني': 'كفايات لغوية' 
    }
  },
  // Monday 16/7
  {
    periodLabel: 'الفترة الأولى',
    startTime: '07:30',
    endTime: '10:00',
    subjects: {
      'أول': 'لغة إنجليزية',
      'ثاني': 'لغة إنجليزية',
      'ثالث': 'لغة إنجليزية'
    }
  },
  // Tuesday 17/7
  {
    periodLabel: 'الفترة الأولى',
    startTime: '07:30',
    endTime: '09:30',
    subjects: {
      'أول': 'كيمياء',
      'ثاني': 'كيمياء',
      'ثالث': 'كيمياء'
    }
  },
  // Wednesday 18/7
  {
    periodLabel: 'الفترة الأولى',
    startTime: '07:30',
    endTime: '10:00',
    subjects: {
      'أول': 'كفايات لغوية',
      'ثاني': 'فيزياء',
      'ثالث': 'فيزياء'
    }
  },
  // Thursday 19/7
  {
    periodLabel: 'الفترة الأولى',
    startTime: '07:30',
    endTime: '09:30',
    subjects: {
      'أول': 'أحياء',
      'ثاني': 'أحياء',
      'ثالث': 'علوم الأرض والفضاء'
    }
  }
];

// Helper to get unique values
const unique = (arr: string[]) => Array.from(new Set(arr));

// Helper to normalize grade strings
const normalizeGrade = (gradeStr: string): string => {
    if (gradeStr.includes('أول') || gradeStr.includes('اول') || gradeStr.includes('1')) return 'أول';
    if (gradeStr.includes('ثاني') || gradeStr.includes('2')) return 'ثاني';
    if (gradeStr.includes('ثالث') || gradeStr.includes('3')) return 'ثالث';
    return '';
};

export const ExamManagement: React.FC = () => {
  const { exams, deliverEnvelopeToControl, importExams, clearAllExams, importStudents, processAdminDeliveryScan } = useApp();
  const [selectedCommittee, setSelectedCommittee] = useState<{number: string, location: string, grades: string[]} | null>(null);
  
  // Wizard State
  const [showWizard, setShowWizard] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scanResult, setScanResult] = useState<{success: boolean, msg: string} | null>(null);
  const [lastScannedId, setLastScannedId] = useState<string | null>(null);
  
  const [importedCommittees, setImportedCommittees] = useState<CommitteeData[]>([]);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [scheduleConfig, setScheduleConfig] = useState<any[]>([]);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // Group Exams by Committee for Display
  const examsByCommittee = useMemo(() => {
      const groups: Record<string, ExamEnvelope[]> = {};
      exams.forEach(exam => {
          if (!groups[exam.committeeNumber]) groups[exam.committeeNumber] = [];
          groups[exam.committeeNumber].push(exam);
      });
      return groups;
  }, [exams]);

  // List of committees that have COMPLETED exams today but NOT DELIVERED
  const pendingDeliveryCommittees = useMemo(() => {
      const today = new Date().toISOString().split('T')[0];
      const pending = exams.filter(e => 
        e.date === today && 
        e.status === EnvelopeStatus.COMPLETED
      ).map(e => e.committeeNumber);
      return Array.from(new Set(pending)).sort();
  }, [exams]);

  // --- FIX: Scanner Handling Logic ---
  
  // 1. Function to safely close the scanner BEFORE unmounting logic
  const handleCloseScanner = async () => {
      if (scannerRef.current) {
          try {
              // Pause first
              await scannerRef.current.stop();
              scannerRef.current.clear();
          } catch (error) {
              console.warn("Scanner stop error:", error);
          }
          scannerRef.current = null;
      }
      setShowScanner(false); // Close Modal only AFTER stopping
  };

  // 2. Effect for opening scanner
  useEffect(() => {
    if (showScanner) {
        const initScanner = async () => {
            // Wait for DOM to be ready
            await new Promise(r => setTimeout(r, 300));

            // Clean previous instance if exists (safety check)
            if (scannerRef.current) {
                try { await scannerRef.current.stop(); } catch(e){}
                scannerRef.current.clear();
            }

            const html5QrCode = new Html5Qrcode("admin-reader");
            scannerRef.current = html5QrCode;
            try {
                 await html5QrCode.start(
                    { facingMode: "environment" },
                    { fps: 10, qrbox: { width: 250, height: 250 } },
                    (text) => handleQrScan(text),
                    () => {}
                 );
            } catch(e) {
                console.error("Scanner Error", e);
            }
        };
        initScanner();
    }

    // Cleanup when component unmounts (navigating away from page)
    return () => {
         if (scannerRef.current) {
            scannerRef.current.stop().catch(() => {});
            scannerRef.current.clear();
        }
    };
  }, [showScanner]);

  // Update Schedule Config when StartDate Changes or Wizard Opens
  useEffect(() => {
    if (showWizard) {
        const start = new Date(startDate);
        let currentDayIndex = 0;

        const newConfig = DEFAULT_SCHEDULE_TEMPLATE.map((item, index) => {
            if (item.periodLabel.includes('الأولى') && index > 0) {
                currentDayIndex++;
            }

            const d = new Date(start);
            d.setDate(start.getDate() + currentDayIndex);
            
            return {
                ...item,
                date: d.toISOString().split('T')[0]
            };
        });
        setScheduleConfig(newConfig);
    }
  }, [showWizard, startDate]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

      if (!rows || rows.length < 2) {
          alert("الملف فارغ أو لا يحتوي على بيانات");
          return;
      }

      const headers = rows[0].map(h => String(h).trim());
      const getIndex = (keywords: string[]) => headers.findIndex(h => keywords.some(k => h.includes(k)));

      const idxCommittee = getIndex(['اللجنة', 'رقم اللجنة']);
      const idxName = getIndex(['اسم الطالب', 'الاسم']);
      
      if (idxCommittee === -1 || idxName === -1) {
          alert('عفواً، يجب أن يحتوي الملف على عمودي "اللجنة" و "اسم الطالب" كحد أدنى.');
          return;
      }

      const idxLocation = getIndex(['المقر', 'المكان', 'القاعة']);
      const idxGrade = getIndex(['الصف', 'السنة الدراسية']);
      const idxSeat = getIndex(['رقم الجلوس', 'الجلوس']);
      const idxStage = getIndex(['المرحلة']);
      const idxClass = getIndex(['الفصل', 'الشعبة']);
      const idxPhone = getIndex(['جوال', 'الهاتف', 'رقم ولي الأمر', 'موبايل']);

      const tempMap = new Map<string, CommitteeData>();

      rows.slice(1).forEach((row, rowIndex) => {
        if (row.length === 0) return;
        const cNo = String(row[idxCommittee] || '').trim();
        const sName = String(row[idxName] || '').trim();

        if (!cNo || !sName) return;

        if (!tempMap.has(cNo)) {
            tempMap.set(cNo, {
                committeeNumber: cNo,
                location: idxLocation > -1 ? String(row[idxLocation] || '') : 'غير محدد',
                grades: [],
                students: []
            });
        }

        const comm = tempMap.get(cNo)!;
        const gradeRaw = idxGrade > -1 ? String(row[idxGrade] || '') : '';
        
        if (gradeRaw && !comm.grades.includes(gradeRaw)) comm.grades.push(gradeRaw);

        const seat = idxSeat > -1 ? String(row[idxSeat] || '') : `S-${cNo}-${rowIndex}`;
        const phone = idxPhone > -1 ? String(row[idxPhone] || '').trim() : '';
        
        comm.students.push({
            id: seat,
            name: sName,
            image: `https://ui-avatars.com/api/?name=${sName}&background=random`,
            stage: idxStage > -1 ? String(row[idxStage] || '') : '',
            grade: gradeRaw, 
            className: idxClass > -1 ? String(row[idxClass] || '') : '',
            seatNumber: seat,
            subject: 'عام',
            parentPhone: phone 
        });
      });

      setImportedCommittees(Array.from(tempMap.values()));
      setShowWizard(true);
      if(fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsArrayBuffer(file);
  };

  const updateScheduleItem = (index: number, field: string, value: string) => {
      const updated = [...scheduleConfig];
      updated[index] = { ...updated[index], [field]: value };
      setScheduleConfig(updated);
  };

  const handleGenerate = () => {
      const newExams: ExamEnvelope[] = [];
      const allUniqueStudentsMap = new Map<string, Student>();

      const getGradeWeight = (grade: string) => {
          if (grade.includes('أول') || grade.includes('اول') || grade.includes('1')) return 1;
          if (grade.includes('ثاني') || grade.includes('2')) return 2;
          if (grade.includes('ثالث') || grade.includes('3')) return 3;
          return 99; 
      };

      scheduleConfig.forEach((scheduleItem) => {
          const dateStr = scheduleItem.date;

          importedCommittees.forEach(comm => {
              const relevantSubjects: string[] = [];
              let affectedStudents: Student[] = [];

              comm.students.forEach(student => {
                  if (!allUniqueStudentsMap.has(student.id)) {
                      allUniqueStudentsMap.set(student.id, student);
                  }

                  const sGradeNorm = normalizeGrade(student.grade);
                  const subject = scheduleItem.subjects[sGradeNorm];
                  
                  if (subject) {
                      relevantSubjects.push(subject);
                      affectedStudents.push({
                          ...student,
                          subject: subject 
                      });
                  }
              });

              if (affectedStudents.length > 0) {
                  affectedStudents.sort((a, b) => getGradeWeight(a.grade) - getGradeWeight(b.grade));

                  const uniqueSubjects = unique(relevantSubjects);
                  const examId = `EX-${comm.committeeNumber}-${dateStr}-${scheduleItem.periodLabel.replace(' ','')}`;
                  
                  newExams.push({
                      id: examId,
                      subject: uniqueSubjects.join(' + '), 
                      grades: comm.grades,
                      committeeNumber: comm.committeeNumber,
                      location: comm.location,
                      date: dateStr,
                      startTime: scheduleItem.startTime,
                      endTime: scheduleItem.endTime,
                      period: scheduleItem.periodLabel,
                      status: EnvelopeStatus.PENDING,
                      students: affectedStudents,
                      attendance: affectedStudents.map(s => ({ studentId: s.id, status: AttendanceStatus.PRESENT }))
                  });
              }
          });
      });

      if (newExams.length === 0) {
          alert("لم يتم توليد أي اختبارات. تأكد من صحة البيانات.");
          return;
      }

      importExams(newExams);

      const masterStudentList = Array.from(allUniqueStudentsMap.values());
      if (masterStudentList.length > 0) {
          importStudents(masterStudentList);
      }

      setShowWizard(false);
  };

  const handleControlScan = async (committeeId: string) => {
    if (committeeId === lastScannedId) return; 

    setLastScannedId(committeeId);
    setScanResult(null);
    const result = await processAdminDeliveryScan(committeeId);
    setScanResult({
        success: result.success,
        msg: result.message || (result.success ? "تم الاستلام بنجاح" : "حدث خطأ")
    });
    
    setTimeout(() => {
        setScanResult(null);
        setLastScannedId(null);
    }, 3000);
  };

  const handleQrScan = (data: string | null) => {
      if (data) {
          let cId = data;
          try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'committee' && parsed.id) {
                  cId = parsed.id;
              }
          } catch(e) {}
          handleControlScan(cId);
      }
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["اللجنة", "المقر", "اسم الطالب", "رقم الجلوس", "الصف", "المرحلة", "الفصل", "رقم الجوال"],
      ["101", "الدور الأول", "خالد عبدالله", "2005", "أول ثانوي", "الثانوية", "1/2", "0550000000"],
      ["101", "الدور الأول", "سعد محمد", "2006", "ثاني ثانوي", "الثانوية", "2/1", "0500000000"]
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "بيانات_الطلاب_واللجان");
    XLSX.writeFile(wb, "نموذج_توزيع_الطلاب.xlsx");
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">إدارة اللجان والمظاريف</h2>
          <p className="text-gray-500">لجان الاختبارات ثابتة، ويتم توليد المظاريف حسب الجدول المعتمد</p>
        </div>
        
        <div className="flex gap-2 flex-wrap">
             <button 
                onClick={() => setShowScanner(true)}
                className="bg-purple-600 text-white border border-purple-600 px-4 py-3 rounded-lg hover:bg-purple-700 flex items-center gap-2 shadow-lg shadow-purple-200"
                title="استلام مظروف عبر QR"
            >
                <ScanLine size={20} />
                <span className="hidden md:inline">استلام للكنترول (Scan)</span>
            </button>

             <button 
                onClick={() => setShowDeleteAllModal(true)}
                className="bg-red-50 text-red-600 border border-red-100 px-4 py-3 rounded-lg hover:bg-red-100 flex items-center gap-2"
                title="مسح جميع اللجان"
            >
                <Trash2 size={20} />
                <span className="hidden md:inline">مسح الكل</span>
            </button>

            <button 
                onClick={downloadTemplate}
                className="bg-white border border-gray-300 text-gray-600 px-4 py-3 rounded-lg hover:bg-gray-50 flex items-center gap-2"
            >
                <Download size={20} />
                <span className="hidden md:inline">نموذج</span>
            </button>
            <div className="relative">
                <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                    className="hidden" 
                    id="exam-upload"
                />
                <label 
                    htmlFor="exam-upload" 
                    className="bg-primary-600 text-white px-6 py-3 rounded-lg shadow hover:bg-primary-700 transition-colors font-medium flex items-center gap-2 cursor-pointer"
                >
                    <UploadCloud size={20} />
                    رفع التوزيع وتوليد الجدول
                </label>
            </div>
        </div>
      </div>

      {exams.length === 0 ? (
        <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-12 text-center">
            <div className="bg-gray-50 p-4 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                <Calendar size={40} className="text-gray-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-700">لا توجد لجان</h3>
            <p className="text-gray-500 mt-2">ابدأ برفع ملف توزيع الطلاب لإنشاء اللجان وتطبيق الجدول المعتمد.</p>
        </div>
      ) : (
          <div className="space-y-8">
            {Object.entries(examsByCommittee).map(([committeeNum, committeeExams]: [string, ExamEnvelope[]]) => {
                const firstExam = committeeExams[0];
                const allGrades = unique(committeeExams.reduce((acc, e) => [...acc, ...e.grades], [] as string[]));
                
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
                                        {allGrades.join(' • ')}
                                    </div>
                                </div>
                            </div>
                            
                            <button 
                                onClick={() => setSelectedCommittee({
                                    number: committeeNum, 
                                    location: firstExam.location,
                                    grades: allGrades
                                })}
                                className="bg-black text-white px-6 py-2 rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2 shadow-lg"
                            >
                                <Printer size={18} />
                                طباعة ملصق اللجنة
                            </button>
                        </div>

                        {/* Exams Grid for this Committee */}
                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-gray-50/50">
                            {committeeExams.sort((a,b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)).map(exam => (
                                <div key={exam.id} className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm flex flex-col relative">
                                    <div className={`absolute top-0 left-0 w-1 h-full rounded-l-lg ${
                                        exam.status === EnvelopeStatus.COMPLETED ? 'bg-green-500' : 
                                        exam.status === EnvelopeStatus.RECEIVED ? 'bg-blue-500' : 'bg-gray-300'
                                    }`}></div>
                                    
                                    <div className="flex justify-between items-start mb-2 pl-3">
                                        <span className="text-xs font-bold text-gray-500">{exam.date}</span>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                                            exam.status === EnvelopeStatus.COMPLETED ? 'bg-green-100 text-green-700' : 
                                            exam.status === EnvelopeStatus.RECEIVED ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                                        }`}>
                                            {exam.status === EnvelopeStatus.RECEIVED ? 'جاري الآن' : 
                                             exam.status === EnvelopeStatus.COMPLETED ? 'منتهي' : 
                                             exam.period}
                                        </span>
                                    </div>
                                    
                                    <h4 className="font-bold text-gray-800 pl-3 line-clamp-2" title={exam.subject}>{exam.subject}</h4>
                                    <p className="text-xs text-gray-400 pl-3 mt-1">{exam.startTime} - {exam.endTime}</p>
                                    
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
               {/* FIX: Use handleCloseScanner instead of direct setShowScanner(false) */}
               <button 
                 onClick={handleCloseScanner} 
                 className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 p-2 rounded-full text-white z-20 pointer-events-auto"
               >
                 <X size={20}/>
               </button>
               
               <div className="p-8 flex flex-col items-center relative h-[450px]">
                   <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2 z-10">
                       <ScanLine className="text-purple-400" />
                       ماسح استلام المظاريف (الكنترول)
                   </h3>

                   <div className="absolute inset-0 z-0 bg-black flex items-center justify-center">
                        <div id="admin-reader" className="w-full h-full"></div>
                   </div>

                   <div className="relative z-10 w-full flex flex-col items-center mt-10 pointer-events-none">
                        <div className="w-64 h-64 border-2 border-white/50 rounded-3xl relative overflow-hidden bg-transparent">
                            <div className="absolute inset-0 border-2 border-purple-500 rounded-3xl animate-pulse"></div>
                        </div>

                        {/* Result Message */}
                        {scanResult && (
                             <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 w-64 text-center">
                                <div className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 justify-center shadow-lg animate-fade-in ${
                                    scanResult.success ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                                }`}>
                                    {scanResult.success ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                                    <span>{scanResult.msg}</span>
                                </div>
                            </div>
                        )}
                   </div>

                   {/* Simulation List */}
                   <div className="w-full bg-white/5 rounded-xl p-4 border border-white/10 absolute bottom-4 z-10">
                       <p className="text-gray-400 text-xs text-center mb-3 uppercase tracking-wider">
                           محاكاة المسح (المظاريف الجاهزة للتسليم)
                       </p>
                       <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto no-scrollbar">
                           {pendingDeliveryCommittees.length === 0 && (
                               <div className="col-span-2 text-gray-600 text-center text-xs py-2">لا توجد مظاريف منتهية بانتظار التسليم حالياً</div>
                           )}
                           {pendingDeliveryCommittees.map(committeeNum => (
                               <button
                                   key={committeeNum}
                                   onClick={() => handleControlScan(committeeNum)}
                                   className="bg-purple-600/20 text-purple-200 py-2 rounded-lg text-sm hover:bg-purple-600 hover:text-white transition-all flex items-center justify-center gap-2 border border-purple-500/30"
                               >
                                   <span>لجنة {committeeNum}</span>
                                   <ScanLine size={12} />
                               </button>
                           ))}
                       </div>
                   </div>
               </div>
            </div>
         </div>
      )}

      {/* SCHEDULE WIZARD MODAL */}
      {showWizard && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl animate-scale-in flex flex-col max-h-[90vh]">
                  <div className="bg-gray-900 text-white p-6 flex justify-between items-center shrink-0">
                      <div className="flex items-center gap-3">
                          <Settings className="text-primary-400" />
                          <div>
                              <h3 className="text-xl font-bold">إعداد وتعديل جدول الاختبارات</h3>
                              <p className="text-gray-400 text-xs">تم قراءة {importedCommittees.length} لجنة. يمكنك تعديل الأوقات والتواريخ أدناه قبل الاعتماد.</p>
                          </div>
                      </div>
                      <button onClick={() => setShowWizard(false)} className="hover:bg-white/20 p-2 rounded-full"><X size={20}/></button>
                  </div>
                  
                  <div className="p-6 overflow-y-auto flex-1">
                      <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex gap-3 mb-6">
                          <Info className="text-blue-600 shrink-0" size={24} />
                          <div className="text-sm text-blue-800">
                              <p className="font-bold mb-1">تعليمات الجدول</p>
                              <p>يتم تعبئة الجدول تلقائياً بناءً على تاريخ البداية. يمكنك تعديل التاريخ، وقت البدء، ووقت النهاية يدوياً لأي فترة. سيتم تطبيق هذه المواعيد على جميع اللجان.</p>
                          </div>
                      </div>

                      <div className="flex items-end gap-4 mb-6">
                           <div className="flex-1">
                                <label className="block text-sm font-bold text-gray-700 mb-2">تاريخ بداية الاختبارات (لإعادة التعيين)</label>
                                <input 
                                    type="date" 
                                    value={startDate}
                                    onChange={e => setStartDate(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-primary-500 outline-none"
                                />
                           </div>
                           <div className="pb-3 text-xs text-gray-500">
                               تغيير هذا التاريخ سيقوم بإعادة حساب تواريخ الجدول أدناه تلقائياً.
                           </div>
                      </div>

                      <div className="border border-gray-200 rounded-xl overflow-hidden text-sm">
                          <table className="w-full text-right bg-white">
                              <thead className="bg-gray-100 text-gray-700 font-bold">
                                  <tr>
                                      <th className="p-3 border-b w-40">التاريخ</th>
                                      <th className="p-3 border-b">الفترة</th>
                                      <th className="p-3 border-b w-32">من</th>
                                      <th className="p-3 border-b w-32">إلى</th>
                                      <th className="p-3 border-b">أبرز المواد (للتوضيح)</th>
                                  </tr>
                              </thead>
                              <tbody>
                                  {scheduleConfig.map((item, index) => (
                                      <tr key={index} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                                          <td className="p-2">
                                              <input 
                                                type="date" 
                                                value={item.date}
                                                onChange={(e) => updateScheduleItem(index, 'date', e.target.value)}
                                                className="w-full p-2 border border-gray-300 rounded focus:border-primary-500 outline-none text-sm"
                                              />
                                          </td>
                                          <td className="p-3 font-bold text-gray-700">{item.periodLabel}</td>
                                          <td className="p-2">
                                              <input 
                                                type="time" 
                                                value={item.startTime}
                                                onChange={(e) => updateScheduleItem(index, 'startTime', e.target.value)}
                                                className="w-full p-2 border border-gray-300 rounded focus:border-primary-500 outline-none text-sm font-mono"
                                              />
                                          </td>
                                          <td className="p-2">
                                              <input 
                                                type="time" 
                                                value={item.endTime}
                                                onChange={(e) => updateScheduleItem(index, 'endTime', e.target.value)}
                                                className="w-full p-2 border border-gray-300 rounded focus:border-primary-500 outline-none text-sm font-mono"
                                              />
                                          </td>
                                          <td className="p-3 text-gray-500 text-xs">
                                              {unique(Object.values(item.subjects as Record<string, string>)).join('، ')}
                                          </td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      </div>
                  </div>
                  
                  <div className="p-6 border-t border-gray-100 bg-gray-50 shrink-0">
                      <button 
                        onClick={handleGenerate}
                        className="w-full bg-primary-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-primary-700 transition-colors flex items-center justify-center gap-2 shadow-lg"
                      >
                          <Play size={24} />
                          توليد واعتماد المظاريف حسب الجدول أعلاه
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
              <h3 className="font-bold">ملصق اللجنة (ثابت)</h3>
              <button onClick={() => setSelectedCommittee(null)} className="hover:bg-white/20 p-1 rounded-full">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-8 flex flex-col items-center text-center">
              <div className="border-4 border-black p-4 rounded-xl mb-6 bg-white">
                <QRCodeCanvas 
                    value={JSON.stringify({ type: 'committee', id: selectedCommittee.number })} 
                    size={200} 
                    level="H" 
                />
              </div>
              
              <div className="text-4xl font-black text-gray-800 mb-2">لجنة {selectedCommittee.number}</div>
              
              <div className="flex items-center justify-center gap-2 text-gray-500 mb-4 bg-gray-100 px-3 py-1 rounded-full text-sm">
                  <MapPin size={16} />
                  {selectedCommittee.location}
              </div>

              <div className="w-full bg-gray-50 p-4 rounded-lg text-right text-sm space-y-2">
                 <p className="flex justify-between border-b pb-1 border-gray-200"><span className="font-bold text-gray-600">المراحل:</span> <span>{selectedCommittee.grades.join(', ')}</span></p>
                 <p className="text-xs text-gray-500 text-center mt-2">هذا الرمز ثابت ويستخدم طوال فترة الاختبارات</p>
              </div>
              <button 
                onClick={() => window.print()} 
                className="mt-6 w-full bg-gray-900 text-white py-3 rounded-xl font-bold hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
              >
                <Printer size={20} />
                طباعة الملصق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete All Modal */}
       {showDeleteAllModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-scale-in">
                  <div className="bg-red-600 text-white p-6 flex justify-between items-center">
                      <h3 className="text-xl font-bold">مسح قاعدة البيانات</h3>
                      <button onClick={() => setShowDeleteAllModal(false)} className="hover:bg-white/20 p-2 rounded-full"><X size={20}/></button>
                  </div>
                  
                  <div className="p-8 text-center space-y-4">
                      <div className="bg-red-50 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto text-red-600 mb-2">
                        <Trash2 size={32} />
                      </div>
                      <h4 className="font-bold text-gray-900 text-lg">هل أنت متأكد تماماً؟</h4>
                      <p className="text-gray-600">سيؤدي هذا الإجراء إلى حذف جميع اللجان والاختبارات الحالية ({exams.length} لجنة) من النظام بشكل نهائي. يجب إعادة توليد الجدول بعد الحذف.</p>
                      
                      <div className="flex gap-3 mt-6">
                          <button 
                             onClick={() => setShowDeleteAllModal(false)}
                             className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200"
                          >
                              إلغاء
                          </button>
                          <button 
                             onClick={() => {
                                 clearAllExams();
                                 setShowDeleteAllModal(false);
                             }}
                             className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 shadow-lg shadow-red-500/30"
                          >
                              نعم، مسح الكل
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
