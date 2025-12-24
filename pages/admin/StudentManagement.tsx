import React, { useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { UploadCloud, Search, User, Trash2, Download, GraduationCap, X, Phone } from 'lucide-react';
import { Student } from '../../types';
import * as XLSX from 'xlsx';

export const StudentManagement: React.FC = () => {
  const { students, importStudents, deleteStudent, clearAllStudents } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);

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

      // Logic to parse file
      // Look for columns: ID/SeatNumber, Name, Grade, Class
      const headers = rows[0].map(h => String(h).trim());
      const getIndex = (keywords: string[]) => headers.findIndex(h => keywords.some(k => h.includes(k)));

      const idxName = getIndex(['اسم الطالب', 'الاسم']);
      const idxId = getIndex(['رقم الجلوس', 'رقم الهوية', 'الرقم']);
      const idxGrade = getIndex(['الصف', 'المرحلة']);
      const idxClass = getIndex(['الفصل', 'الشعبة']);
      const idxPhone = getIndex(['جوال ولي الأمر', 'رقم ولي الأمر', 'الهاتف', 'الجوال']);

      if (idxName === -1) {
          alert("خطأ: لا يوجد عمود باسم الطالب في الملف");
          return;
      }

      const newStudents: Student[] = [];
      
      rows.slice(1).forEach((row, index) => {
          if(!row[idxName]) return;
          
          const name = String(row[idxName]).trim();
          const id = idxId > -1 ? String(row[idxId]).trim() : `S-${Date.now()}-${index}`;
          const grade = idxGrade > -1 ? String(row[idxGrade]).trim() : 'عام';
          const className = idxClass > -1 ? String(row[idxClass]).trim() : '';
          const phone = idxPhone > -1 ? String(row[idxPhone]).trim() : '';
          
          newStudents.push({
              id: id,
              name: name,
              seatNumber: id,
              grade: grade,
              className: className,
              stage: 'الثانوية', // Default
              subject: 'عام',
              image: `https://ui-avatars.com/api/?name=${name}&background=random`,
              parentPhone: phone
          });
      });

      if (newStudents.length > 0) {
        importStudents(newStudents);
      } else {
        alert("لم يتم العثور على بيانات صالحة");
      }
      
      if(fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsArrayBuffer(file);
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["اسم الطالب", "رقم الجلوس", "الصف", "الفصل", "جوال ولي الأمر"],
      ["أحمد محمد", "2024001", "أول ثانوي", "1/1", "0555555555"],
      ["سعيد علي", "2024002", "ثاني ثانوي", "2/3", "0500000000"]
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "الطلاب");
    XLSX.writeFile(wb, "نموذج_الطلاب.xlsx");
  };

  const filteredStudents = students.filter(s => 
    s.name.includes(search) || s.id.includes(search) || s.grade.includes(search)
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header & Actions */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">سجل الطلاب العام</h2>
          <p className="text-gray-500">إدارة قاعدة بيانات الطلاب، الاستيراد، والحذف</p>
        </div>
        
        <div className="flex gap-2 flex-wrap">
             <button 
                onClick={() => setShowDeleteAllModal(true)}
                className="bg-red-50 text-red-600 border border-red-100 px-4 py-3 rounded-lg hover:bg-red-100 flex items-center gap-2"
                title="مسح جميع الطلاب"
            >
                <Trash2 size={20} />
                <span className="hidden md:inline">مسح الكل</span>
            </button>

            <button 
                onClick={downloadTemplate}
                className="bg-white border border-gray-300 text-gray-600 px-4 py-3 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                title="تحميل نموذج Excel"
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
                    id="student-upload"
                />
                <label 
                    htmlFor="student-upload" 
                    className="bg-primary-600 text-white px-6 py-3 rounded-lg shadow hover:bg-primary-700 transition-colors font-medium flex items-center gap-2 cursor-pointer"
                >
                    <UploadCloud size={20} />
                    استيراد الطلاب
                </label>
            </div>
        </div>
      </div>

      {/* Search Bar */}
      {students.length > 0 && (
        <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
                type="text" 
                placeholder="بحث باسم الطالب، رقم الجلوس، أو الصف..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-4 pr-10 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
            />
        </div>
      )}

      {/* Students List */}
      {students.length === 0 ? (
        <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-12 text-center">
            <div className="bg-gray-50 p-4 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                <GraduationCap size={40} className="text-gray-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-700">لا يوجد طلاب مسجلين</h3>
            <p className="text-gray-500 mt-2">قم باستيراد ملف Excel لبناء قاعدة بيانات الطلاب.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
             <div className="overflow-x-auto">
                <table className="w-full text-right">
                    <thead className="bg-gray-50 text-gray-500 text-sm">
                        <tr>
                            <th className="p-4 font-medium">الطالب</th>
                            <th className="p-4 font-medium">رقم الجلوس</th>
                            <th className="p-4 font-medium">الصف</th>
                            <th className="p-4 font-medium">الفصل</th>
                            <th className="p-4 font-medium">ولي الأمر</th>
                            <th className="p-4 font-medium">إجراءات</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredStudents.map(student => (
                            <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                                <td className="p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-gray-200 rounded-full h-8 w-8 overflow-hidden">
                                            <img src={student.image} alt="" className="h-full w-full object-cover" />
                                        </div>
                                        <span className="font-bold text-gray-900">{student.name}</span>
                                    </div>
                                </td>
                                <td className="p-4 font-mono text-gray-600">{student.seatNumber}</td>
                                <td className="p-4 text-gray-600">{student.grade}</td>
                                <td className="p-4 text-gray-600">{student.className}</td>
                                <td className="p-4 text-gray-600">
                                    {student.parentPhone ? (
                                        <div className="flex items-center gap-1 font-mono text-xs bg-gray-50 px-2 py-1 rounded w-fit">
                                            <Phone size={12} />
                                            {student.parentPhone}
                                        </div>
                                    ) : '-'}
                                </td>
                                <td className="p-4">
                                    <button 
                                        onClick={() => {
                                            if(window.confirm(`هل أنت متأكد من حذف الطالب ${student.name}؟`)) {
                                                deleteStudent(student.id);
                                            }
                                        }}
                                        className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
             </div>
             {filteredStudents.length === 0 && (
                 <div className="p-8 text-center text-gray-500">لا توجد نتائج مطابقة للبحث</div>
             )}
        </div>
      )}
      
      <div className="text-xs text-gray-400 text-center">
        إجمالي الطلاب: {students.length}
      </div>

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
                      <p className="text-gray-600">سيؤدي هذا الإجراء إلى حذف جميع بيانات الطلاب ({students.length} طالب) من النظام بشكل نهائي. لا يمكن التراجع عن هذا الإجراء.</p>
                      
                      <div className="flex gap-3 mt-6">
                          <button 
                             onClick={() => setShowDeleteAllModal(false)}
                             className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200"
                          >
                              إلغاء
                          </button>
                          <button 
                             onClick={() => {
                                 clearAllStudents();
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