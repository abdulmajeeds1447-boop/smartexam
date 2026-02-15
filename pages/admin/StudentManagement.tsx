import React, { useRef, useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { UploadCloud, Search, Trash2, Download, RefreshCw, Layers } from 'lucide-react';
import { Student } from '../../types';
import * as XLSX from 'xlsx';

export const StudentManagement: React.FC = () => {
  const { students, importStudents, deleteStudent, clearAllStudents } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // --- دوال الاستيراد الذكي (يقرأ جميع الصفحات) ---
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          
          let allStudents: Student[] = [];
          
          // 🔄 التعديل الجوهري: المرور على جميع الصفحات (Sheets) وليس الأولى فقط
          workbook.SheetNames.forEach(sheetName => {
              const sheet = workbook.Sheets[sheetName];
              const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

              if (!rows || rows.length < 2) return;

              // البحث عن فهارس الأعمدة في هذه الصفحة
              const headers = rows[0].map(h => String(h).trim());
              const getIndex = (keywords: string[]) => headers.findIndex(h => keywords.some(k => h.includes(k)));

              // كلمات مفتاحية ذكية للتعرف على الأعمدة
              const idxName = getIndex(['اسم الطالب', 'الاسم', 'Name']);
              const idxId = getIndex(['رقم الجلوس', 'رقم الهوية', 'الرقم', 'Seat']);
              const idxGrade = getIndex(['الصف', 'المرحلة', 'Grade']);
              const idxCommittee = getIndex(['اللجنة', 'رقم اللجنة', 'Committee', 'مقر', 'رقم']); // أضفنا "رقم" و "مقر" لزيادة الدقة
              const idxPhone = getIndex(['جوال', 'هاتف', 'ولي الأمر', 'Mobile']);

              if (idxName === -1) return; // تخطي الصفحات التي لا تحتوي أسماء

              rows.slice(1).forEach((row, index) => {
                  if(!row[idxName]) return;
                  
                  const name = String(row[idxName]).trim();
                  
                  // استخراج رقم اللجنة (هام جداً للتوزيع)
                  let committee = idxCommittee > -1 ? String(row[idxCommittee]).trim() : '';
                  // تنظيف رقم اللجنة (إبقاء الأرقام فقط)
                  committee = committee.replace(/[^\d]/g, ''); 

                  // إذا لم نجد رقم جلوس، ننشئ واحداً مؤقتاً
                  const id = idxId > -1 ? String(row[idxId]).trim() : `S-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
                  
                  // تحديد الصف: إما من العمود أو من اسم الصفحة (Sheet Name)
                  let grade = idxGrade > -1 ? String(row[idxGrade]).trim() : '';
                  
                  // تخمين الصف من اسم الصفحة إذا كان العمود فارغاً (مهم جداً للملفات المقسمة صفحات)
                  if (!grade) {
                      if (sheetName.includes('أول') || sheetName.includes('1')) grade = 'أول ثانوي';
                      else if (sheetName.includes('ثاني') || sheetName.includes('2')) grade = 'ثاني ثانوي';
                      else if (sheetName.includes('ثالث') || sheetName.includes('3')) grade = 'ثالث ثانوي';
                      else grade = 'عام';
                  }

                  allStudents.push({
                      id: id,
                      name: name,
                      seatNumber: id,
                      grade: grade,
                      className: '',
                      committeeNumber: committee, // هذا الرقم هو الذي يوزع الطالب
                      stage: 'الثانوية',
                      subject: 'عام',
                      image: `https://ui-avatars.com/api/?name=${name}&background=random`,
                      parentPhone: idxPhone > -1 ? String(row[idxPhone]).trim() : ''
                  });
              });
          });

          if (allStudents.length > 0) {
            importStudents(allStudents);
            alert(`تم استيراد ${allStudents.length} طالب من ${workbook.SheetNames.length} صفحات (مراحل) بنجاح!`);
          } else {
            alert("لم يتم العثور على بيانات طلاب. تأكد من وجود عمود 'اسم الطالب' و 'اللجنة'.");
          }
      } catch (err) {
          console.error(err);
          alert("حدث خطأ أثناء قراءة الملف");
      } finally {
          setIsProcessing(false);
          if(fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["اسم الطالب", "رقم الجلوس", "الصف", "رقم اللجنة", "جوال ولي الأمر"],
      ["أحمد محمد", "2024001", "أول ثانوي", "1", "0555555555"],
      ["سعيد علي", "2024002", "ثاني ثانوي", "1", "0500000000"]
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "الطلاب");
    XLSX.writeFile(wb, "نموذج_الطلاب_واللجان.xlsx");
  };

  // --- التصفية والعرض ---
  const filteredStudents = useMemo(() => {
    return students.filter(s => 
      s.name.includes(search) || 
      s.seatNumber.includes(search) || 
      s.committeeNumber?.includes(search)
    ).sort((a, b) => {
        // ترتيب رقمي للجان
        const commA = parseInt(a.committeeNumber || '999');
        const commB = parseInt(b.committeeNumber || '999');
        if (commA !== commB) return commA - commB;
        // ثم ترتيب حسب الصف
        return a.grade.localeCompare(b.grade);
    });
  }, [students, search]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header & Actions */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">سجل الطلاب وتوزيع اللجان</h2>
          <p className="text-gray-500">
             {students.length > 0 ? `تم تحميل ${students.length} طالب` : 'قم باستيراد ملف التوزيع من النظام الأول'}
          </p>
        </div>
        
        <div className="flex gap-2 flex-wrap">
             <button 
                onClick={() => setShowDeleteAllModal(true)}
                className="bg-red-50 text-red-600 border border-red-100 px-4 py-3 rounded-lg hover:bg-red-100 flex items-center gap-2"
            >
                <Trash2 size={20} />
            </button>

            <button 
                onClick={downloadTemplate}
                className="bg-white border border-gray-300 text-gray-600 px-4 py-3 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                title="تحميل نموذج Excel"
            >
                <Download size={20} />
            </button>
            
            <div className="relative">
                <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".xlsx, .xls, .csv"
                    className="hidden" 
                    id="student-upload"
                />
                <label 
                    htmlFor="student-upload" 
                    className={`bg-blue-600 text-white px-6 py-3 rounded-lg shadow hover:bg-blue-700 transition-colors font-bold flex items-center gap-2 cursor-pointer ${isProcessing ? 'opacity-70 cursor-wait' : ''}`}
                >
                    {isProcessing ? <RefreshCw className="animate-spin" size={20}/> : <UploadCloud size={20} />}
                    {isProcessing ? 'جاري المعالجة...' : 'استيراد (يقرأ كل الصفحات)'}
                </label>
            </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
                type="text" 
                placeholder="ابحث بالاسم، رقم الجلوس، أو رقم اللجنة..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-4 pr-10 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all shadow-sm"
            />
      </div>

      {/* Students List Table */}
      {students.length === 0 ? (
        <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-16 text-center">
            <div className="bg-blue-50 p-6 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
                <Layers size={40} className="text-blue-500" />
            </div>
            <h3 className="text-xl font-bold text-gray-800">القائمة فارغة</h3>
            <p className="text-gray-500 mt-2 max-w-md mx-auto">
                اضغط على زر <b>"استيراد"</b> واختر ملف الإكسل. سيقوم النظام بدمج الطلاب من جميع صفحات الملف تلقائياً.
            </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
             <div className="overflow-x-auto">
                <table className="w-full text-right">
                    <thead className="bg-gray-50 text-gray-600 text-sm border-b">
                        <tr>
                            <th className="p-4 font-bold">لجنة</th>
                            <th className="p-4 font-bold">الطالب</th>
                            <th className="p-4 font-bold">الصف الدراسي</th>
                            <th className="p-4 font-bold">رقم الجلوس</th>
                            <th className="p-4 font-bold">تحكم</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredStudents.map(student => (
                            <tr key={student.id} className="hover:bg-blue-50/30 transition-colors group">
                                <td className="p-4">
                                    {student.committeeNumber ? (
                                        <div className="bg-blue-600 text-white w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shadow-sm">
                                            {student.committeeNumber}
                                        </div>
                                    ) : (
                                        <span className="text-gray-400 text-xs italic">غير موزع</span>
                                    )}
                                </td>
                                <td className="p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">
                                            {student.name.charAt(0)}
                                        </div>
                                        <span className="font-bold text-gray-800">{student.name}</span>
                                    </div>
                                </td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                                        student.grade.includes('أول') ? 'bg-green-100 text-green-700' :
                                        student.grade.includes('ثاني') ? 'bg-yellow-100 text-yellow-700' :
                                        'bg-purple-100 text-purple-700'
                                    }`}>
                                        {student.grade}
                                    </span>
                                </td>
                                <td className="p-4 font-mono text-gray-600">{student.seatNumber}</td>
                                <td className="p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        onClick={() => {
                                            if(window.confirm('حذف هذا الطالب؟')) deleteStudent(student.id);
                                        }}
                                        className="text-red-400 hover:text-red-600 p-1"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
             </div>
        </div>
      )}

      {/* Delete Modal */}
       {showDeleteAllModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl max-w-sm w-full p-6 text-center shadow-2xl">
                  <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Trash2 size={32} />
                  </div>
                  <h3 className="font-bold text-xl text-gray-900 mb-2">مسح جميع الطلاب؟</h3>
                  <p className="text-gray-500 text-sm mb-6">سيتم حذف كل البيانات الحالية لإعادة الاستيراد بشكل نظيف.</p>
                  <div className="flex gap-2">
                      <button onClick={() => setShowDeleteAllModal(false)} className="flex-1 bg-gray-100 py-2 rounded-lg font-bold text-gray-700">إلغاء</button>
                      <button onClick={() => { clearAllStudents(); setShowDeleteAllModal(false); }} className="flex-1 bg-red-600 py-2 rounded-lg font-bold text-white">مسح الكل</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
