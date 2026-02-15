import React, { useRef, useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { UploadCloud, Search, Trash2, Download, GraduationCap, X, Phone, RefreshCw, MapPin } from 'lucide-react';
import { Student } from '../../types';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import * as XLSX from 'xlsx';

export const StudentManagement: React.FC = () => {
  const { students, importStudents, deleteStudent, clearAllStudents } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // --- دالة المزامنة الجديدة من النظام الأول ---
  const syncFromSystem1 = async () => {
    setIsSyncing(true);
    try {
        console.log("Starting Sync...");
        
        // 1. جلب الطلاب (يفترض أن النظام الأول يرفعهم في مجموعة 'students' أو 'students_master')
        // سنحاول البحث في المجموعة التي يستخدمها التطبيق حالياً
        const studentsSnap = await getDocs(collection(db, 'students'));
        
        // إذا كانت فارغة، قد يكون النظام الأول يرفع لمكان آخر، لكن سنفترض التوافق
        // أو نقوم بجلب التوزيعات من مجموعة 'committees' إذا كان النظام الأول يخزنها هناك
        // للأمان: سنجلب من 'students' ونعتمد على الحقول الموجودة
        
        const fetchedStudents: Student[] = [];
        
        studentsSnap.forEach(doc => {
            const data = doc.data();
            // نأخذ الطالب فقط إذا كان لديه رقم لجنة (موزع)
            // أو نجلب الجميع
            if (data.name) {
                fetchedStudents.push({
                    id: doc.id,
                    name: data.name,
                    seatNumber: data.seatNumber || doc.id,
                    grade: data.grade || 'عام',
                    className: data.className || '',
                    committeeNumber: data.committeeNumber || '', // الحقل الأهم
                    parentPhone: data.parentPhone || '',
                    image: data.image || `https://ui-avatars.com/api/?name=${data.name}&background=random`,
                    ...data
                } as Student);
            }
        });

        if (fetchedStudents.length > 0) {
            // تحديث الحالة المحلية
            await importStudents(fetchedStudents);
            alert(`تمت المزامنة بنجاح! تم تحميل ${fetchedStudents.length} طالب.`);
        } else {
            alert("لم يتم العثور على بيانات في السحابة. تأكد من ضغط 'تصدير' في النظام الأول.");
        }

    } catch (error) {
        console.error("Sync Error:", error);
        alert("حدث خطأ أثناء المزامنة مع قاعدة البيانات.");
    } finally {
        setIsSyncing(false);
    }
  };

  // --- تصفية وتنظيم الطلاب ---
  const filteredStudents = useMemo(() => {
    return students.filter(s => 
      s.name.includes(search) || 
      s.seatNumber.includes(search) || 
      s.committeeNumber?.includes(search)
    ).sort((a, b) => {
        // ترتيب حسب اللجنة أولاً ثم الصف
        const commA = parseInt(a.committeeNumber || '999');
        const commB = parseInt(b.committeeNumber || '999');
        if (commA !== commB) return commA - commB;
        return a.grade.localeCompare(b.grade);
    });
  }, [students, search]);

  // --- دوال الاستيراد اليدوي (Excel) ---
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

      if (!rows || rows.length < 2) return;

      const headers = rows[0].map(h => String(h).trim());
      const getIndex = (keywords: string[]) => headers.findIndex(h => keywords.some(k => h.includes(k)));

      const idxName = getIndex(['اسم الطالب', 'الاسم']);
      const idxId = getIndex(['رقم الجلوس', 'رقم الهوية', 'الرقم']);
      const idxGrade = getIndex(['الصف', 'المرحلة']);
      const idxCommittee = getIndex(['اللجنة', 'رقم اللجنة']); // إضافة اللجنة
      const idxPhone = getIndex(['جوال', 'هاتف']);

      if (idxName === -1) {
          alert("خطأ: لا يوجد عمود باسم الطالب في الملف");
          return;
      }

      const newStudents: Student[] = [];
      
      rows.slice(1).forEach((row, index) => {
          if(!row[idxName]) return;
          
          const name = String(row[idxName]).trim();
          const id = idxId > -1 ? String(row[idxId]).trim() : `S-${Date.now()}-${index}`;
          const committee = idxCommittee > -1 ? String(row[idxCommittee]).trim() : '';
          
          newStudents.push({
              id: id,
              name: name,
              seatNumber: id,
              grade: idxGrade > -1 ? String(row[idxGrade]).trim() : 'عام',
              className: '',
              committeeNumber: committee, // تخزين اللجنة
              stage: 'الثانوية',
              subject: 'عام',
              image: `https://ui-avatars.com/api/?name=${name}&background=random`,
              parentPhone: idxPhone > -1 ? String(row[idxPhone]).trim() : ''
          });
      });

      if (newStudents.length > 0) {
        importStudents(newStudents);
        alert(`تم استيراد ${newStudents.length} طالب.`);
      }
      if(fileInputRef.current) fileInputRef.current.value = '';
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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header & Actions */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">سجل الطلاب وتوزيع اللجان</h2>
          <p className="text-gray-500">
             {students.length > 0 ? `تم تحميل ${students.length} طالب` : 'قم بالمزامنة لجلب التوزيع من النظام الأول'}
          </p>
        </div>
        
        <div className="flex gap-2 flex-wrap">
             <button 
                onClick={syncFromSystem1}
                disabled={isSyncing}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg shadow hover:bg-blue-700 transition-colors font-bold flex items-center gap-2"
            >
                <RefreshCw size={20} className={isSyncing ? "animate-spin" : ""} />
                {isSyncing ? 'جاري المزامنة...' : 'مزامنة من النظام الأول'}
            </button>

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
                    className="bg-white border border-gray-300 text-gray-700 px-4 py-3 rounded-lg hover:bg-gray-50 cursor-pointer flex items-center gap-2"
                    title="رفع ملف إكسل يدوي"
                >
                    <UploadCloud size={20} />
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
                <RefreshCw size={40} className="text-blue-500" />
            </div>
            <h3 className="text-xl font-bold text-gray-800">القائمة فارغة</h3>
            <p className="text-gray-500 mt-2 max-w-md mx-auto">
                اضغط على زر <b>"مزامنة من النظام الأول"</b> في الأعلى لجلب أسماء الطلاب وتوزيع اللجان المعتمد.
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
                            <th className="p-4 font-bold">ولي الأمر</th>
                            <th className="p-4 font-bold">تحكم</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredStudents.map(student => (
                            <tr key={student.id} className="hover:bg-blue-50/30 transition-colors group">
                                <td className="p-4">
                                    {student.committeeNumber ? (
                                        <div className="flex items-center gap-2">
                                            <div className="bg-blue-600 text-white w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shadow-sm">
                                                {student.committeeNumber}
                                            </div>
                                            {/* محاولة عرض اسم المقر إذا كان مخزناً، وإلا نكتفي بالرقم */}
                                        </div>
                                    ) : (
                                        <span className="text-gray-400 text-xs italic">غير موزع</span>
                                    )}
                                </td>
                                <td className="p-4">
                                    <div className="flex items-center gap-3">
                                        <img src={student.image} alt="" className="h-8 w-8 rounded-full bg-gray-200 object-cover" />
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
                                <td className="p-4 text-gray-500 text-sm">{student.parentPhone || '-'}</td>
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
                  <p className="text-gray-500 text-sm mb-6">سيتم حذف كل البيانات الحالية. يمكنك إعادة المزامنة لاحقاً.</p>
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
