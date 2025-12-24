import React, { useState, useRef, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { QRCodeCanvas } from 'qrcode.react';
import { Printer, X, CheckCircle, UploadCloud, MapPin, Calendar, Download, Settings, Play, Info, Trash2 } from 'lucide-react';
import { EnvelopeStatus, ExamEnvelope, Student, AttendanceStatus } from '../../types';
import * as XLSX from 'xlsx';

// Internal type for the Wizard
interface CommitteeData {
    committeeNumber: string;
    location: string;
    grades: string[];
    students: Student[];
}

// --- CONFIGURATION BASED ON IMAGE PROVIDED ---
const FIXED_SCHEDULE = [
  // Sunday 15/7
  {
    dayOffset: 0,
    periodLabel: 'الفترة الأولى',
    startTime: '07:30',
    endTime: '10:00', // 2.5 Hours roughly
    subjects: {
      'أول': 'رياضيات',
      'ثاني': 'رياضيات',
      'ثالث': 'رياضيات'
    }
  },
  {
    dayOffset: 0,
    periodLabel: 'الفترة الثانية',
    startTime: '10:30',
    endTime: '12:30',
    subjects: {
      'ثاني': 'كفايات لغوية' // Only 2nd Secondary
    }
  },
  // Monday 16/7
  {
    dayOffset: 1,
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
    dayOffset: 2,
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
    dayOffset: 3,
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
    dayOffset: 4,
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

// Helper to normalize grade strings for matching
const normalizeGrade = (gradeStr: string): string => {
    if (gradeStr.includes('أول') || gradeStr.includes('اول') || gradeStr.includes('1')) return 'أول';
    if (gradeStr.includes('ثاني') || gradeStr.includes('2')) return 'ثاني';
    if (gradeStr.includes('ثالث') || gradeStr.includes('3')) return 'ثالث';
    return '';
};

export const ExamManagement: React.FC = () => {
  // Added importStudents to destructuring
  const { exams, deliverEnvelopeToControl, importExams, clearAllExams, importStudents } = useApp();
  const [selectedCommittee, setSelectedCommittee] = useState<{number: string, location: string, grades: string[]} | null>(null);
  
  // Wizard State
  const [showWizard, setShowWizard] = useState(false);
  const [importedCommittees, setImportedCommittees] = useState<CommitteeData[]>([]);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Group Exams by Committee for Display
  const examsByCommittee = useMemo(() => {
      const groups: Record<string, ExamEnvelope[]> = {};
      exams.forEach(exam => {
          if (!groups[exam.committeeNumber]) groups[exam.committeeNumber] = [];
          groups[exam.committeeNumber].push(exam);
      });
      return groups;
  }, [exams]);

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

      // Parse Logic
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
        const gradeNormalized = normalizeGrade(gradeRaw);
        
        // Store original grade string but use normalized for logic if needed
        if (gradeRaw && !comm.grades.includes(gradeRaw)) comm.grades.push(gradeRaw);

        const seat = idxSeat > -1 ? String(row[idxSeat] || '') : `S-${cNo}-${rowIndex}`;
        
        comm.students.push({
            id: seat,
            name: sName,
            image: `https://ui-avatars.com/api/?name=${sName}&background=random`,
            stage: idxStage > -1 ? String(row[idxStage] || '') : '',
            grade: gradeRaw, // Keep original e.g. "أول ثانوي"
            className: idxClass > -1 ? String(row[idxClass] || '') : '',
            seatNumber: seat,
            subject: 'عام'
        });
      });

      setImportedCommittees(Array.from(tempMap.values()));
      setShowWizard(true);
      if(fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsArrayBuffer(file);
  };

  const handleGenerate = () => {
      const newExams: ExamEnvelope[] = [];
      const startDateObj = new Date(startDate);
      // Map to track unique students across all committees to import them to Master List
      const allUniqueStudentsMap = new Map<string, Student>();

      // Helper to determine sort weight for grade
      const getGradeWeight = (grade: string) => {
          if (grade.includes('أول') || grade.includes('اول') || grade.includes('1')) return 1;
          if (grade.includes('ثاني') || grade.includes('2')) return 2;
          if (grade.includes('ثالث') || grade.includes('3')) return 3;
          return 99; // Others at the end
      };

      // Iterate through the predefined schedule
      FIXED_SCHEDULE.forEach((scheduleItem, idx) => {
          const currentDay = new Date(startDateObj);
          currentDay.setDate(startDateObj.getDate() + scheduleItem.dayOffset);
          const dateStr = currentDay.toISOString().split('T')[0];

          // For each committee, check if they have students for this schedule item
          importedCommittees.forEach(comm => {
              // Determine if this committee has any relevant grades for this schedule block
              const relevantSubjects: string[] = [];
              let affectedStudents: Student[] = [];

              comm.students.forEach(student => {
                  // Add to master list tracker (if not already added)
                  if (!allUniqueStudentsMap.has(student.id)) {
                      allUniqueStudentsMap.set(student.id, student);
                  }

                  const sGradeNorm = normalizeGrade(student.grade);
                  // Check if this student's grade has a subject in this schedule slot
                  const subject = scheduleItem.subjects[sGradeNorm as keyof typeof scheduleItem.subjects];
                  
                  if (subject) {
                      relevantSubjects.push(subject);
                      affectedStudents.push({
                          ...student,
                          subject: subject // Assign specific subject to student
                      });
                  }
              });

              // If this committee has students taking an exam in this slot
              if (affectedStudents.length > 0) {
                  // SORT STUDENTS BY GRADE WEIGHT HERE
                  affectedStudents.sort((a, b) => getGradeWeight(a.grade) - getGradeWeight(b.grade));

                  const uniqueSubjects = unique(relevantSubjects);
                  const examId = `EX-${comm.committeeNumber}-${dateStr}-${scheduleItem.periodLabel.replace(' ','')}`;
                  
                  newExams.push({
                      id: examId,
                      subject: uniqueSubjects.join(' + '), // e.g. "رياضيات" or "فيزياء + أحياء"
                      grades: comm.grades,
                      committeeNumber: comm.committeeNumber,
                      location: comm.location,
                      date: dateStr,
                      startTime: scheduleItem.startTime,
                      endTime: scheduleItem.endTime,
                      period: scheduleItem.periodLabel,
                      status: EnvelopeStatus.PENDING,
                      students: affectedStudents,
                      attendance: affectedStudents.map(s => ({ studentId: s.id, status: AttendanceStatus.UNKNOWN }))
                  });
              }
          });
      });

      if (newExams.length === 0) {
          alert("لم يتم توليد أي اختبارات. يرجى التأكد من أن أسماء الصفوف في الملف (أول ثانوي، ثاني ثانوي...) تتطابق مع الجدول.");
          return;
      }

      // 1. Save Exams to Database
      importExams(newExams);

      // 2. Save Students to Master Student Database (For Student Management Tab)
      const masterStudentList = Array.from(allUniqueStudentsMap.values());
      if (masterStudentList.length > 0) {
          importStudents(masterStudentList);
      }

      setShowWizard(false);
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["اللجنة", "المقر", "اسم الطالب", "رقم الجلوس", "الصف", "المرحلة", "الفصل"],
      ["101", "الدور الأول", "خالد عبدالله", "2005", "أول ثانوي", "الثانوية", "1/2"],
      ["101", "الدور الأول", "سعد محمد", "2006", "ثاني ثانوي", "الثانوية", "2/1"]
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

      {/* SCHEDULE WIZARD MODAL */}
      {showWizard && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-scale-in">
                  <div className="bg-gray-900 text-white p-6 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                          <Settings className="text-primary-400" />
                          <div>
                              <h3 className="text-xl font-bold">توليد الجدول حسب النموذج المعتمد</h3>
                              <p className="text-gray-400 text-xs">تم قراءة {importedCommittees.length} لجنة من الملف.</p>
                          </div>
                      </div>
                      <button onClick={() => setShowWizard(false)} className="hover:bg-white/20 p-2 rounded-full"><X size={20}/></button>
                  </div>
                  
                  <div className="p-8 space-y-6">
                      <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex gap-3">
                          <Info className="text-blue-600 shrink-0" size={24} />
                          <div className="text-sm text-blue-800">
                              <p className="font-bold mb-1">الجدول المعتمد</p>
                              <p>سيتم توليد الاختبارات تلقائياً بناءً على الجدول: (رياضيات يوم 1)، (إنجليزي يوم 2)، (كيمياء يوم 3)... مع مراعاة المواد المختلفة لكل صف (مثل أحياء/علوم أرض يوم 5).</p>
                          </div>
                      </div>

                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-2">تاريخ بداية الاختبارات (اليوم الأول)</label>
                          <input 
                            type="date" 
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-primary-500 outline-none"
                          />
                          <p className="text-xs text-gray-500 mt-2">سيوافق اليوم الأول مادة الرياضيات لجميع الصفوف.</p>
                      </div>

                      <div className="border border-gray-200 rounded-xl overflow-hidden text-sm">
                          <table className="w-full text-right bg-white">
                              <thead className="bg-gray-50">
                                  <tr>
                                      <th className="p-3 border-b">اليوم</th>
                                      <th className="p-3 border-b">الفترة</th>
                                      <th className="p-3 border-b">أبرز المواد</th>
                                  </tr>
                              </thead>
                              <tbody>
                                  {FIXED_SCHEDULE.map((s, i) => (
                                      <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                                          <td className="p-3">اليوم {s.dayOffset + 1}</td>
                                          <td className="p-3">{s.periodLabel}</td>
                                          <td className="p-3 text-gray-600">
                                              {unique(Object.values(s.subjects)).join('، ')}
                                          </td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      </div>

                      <button 
                        onClick={handleGenerate}
                        className="w-full bg-primary-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-primary-700 transition-colors flex items-center justify-center gap-2 shadow-lg"
                      >
                          <Play size={24} />
                          توليد واعتماد المظاريف
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