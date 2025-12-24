import React, { useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { QRCodeCanvas } from 'qrcode.react';
import { UploadCloud, Search, Phone, User, QrCode, Download, Printer, X, Trash2 } from 'lucide-react';
import { Teacher } from '../../types';
import * as XLSX from 'xlsx';

export const TeacherManagement: React.FC = () => {
  const { teachers, importTeachers, clearAllTeachers } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
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

      // Expected Order: id, name, phone
      const dataRows = rows.slice(1);
      
      const newTeachers: Teacher[] = dataRows
        .map(row => {
            const id = String(row[0] || '').trim();
            const name = String(row[1] || '').trim();
            const phone = String(row[2] || '').trim();

            if (!id || !name) return null;
            return {
                id,
                name,
                phone: phone || '',
                qrCode: `TEACHER:${id}` // Generate unique QR string
            };
        })
        .filter((t): t is Teacher => t !== null);

      importTeachers(newTeachers);
      if(fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsArrayBuffer(file);
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["رقم_المعلم", "الاسم", "الجوال"],
      ["1050", "محمد أحمد علي", "0551234567"]
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "نموذج_بيانات_المعلمين.xlsx");
  };

  const filteredTeachers = teachers.filter(t => 
    t.name.includes(search) || t.id.includes(search)
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header & Actions */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">إدارة المعلمين</h2>
          <p className="text-gray-500">استيراد بيانات المعلمين وتوليد بطاقات QR</p>
        </div>
        
        <div className="flex gap-2 flex-wrap">
            <button 
                onClick={() => setShowDeleteAllModal(true)}
                className="bg-red-50 text-red-600 border border-red-100 px-4 py-3 rounded-lg hover:bg-red-100 flex items-center gap-2"
                title="مسح جميع المعلمين"
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
                    id="teacher-upload"
                />
                <label 
                    htmlFor="teacher-upload" 
                    className="bg-green-600 text-white px-6 py-3 rounded-lg shadow hover:bg-green-700 transition-colors font-medium flex items-center gap-2 cursor-pointer"
                >
                    <UploadCloud size={20} />
                    استيراد بيانات المعلمين
                </label>
            </div>
        </div>
      </div>

      {/* Search Bar */}
      {teachers.length > 0 && (
        <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
                type="text" 
                placeholder="بحث باسم المعلم أو الرقم الوظيفي..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-4 pr-10 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
            />
        </div>
      )}

      {/* Teacher List */}
      {teachers.length === 0 ? (
        <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-12 text-center">
            <div className="bg-gray-50 p-4 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                <User size={40} className="text-gray-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-700">لا يوجد معلمين مسجلين</h3>
            <p className="text-gray-500 mt-2">قم باستيراد ملف Excel أو CSV لإضافة المعلمين</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTeachers.map(teacher => (
                <div key={teacher.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md transition-shadow group">
                    <div className="flex items-center gap-3">
                        <div className="bg-green-50 p-3 rounded-full text-green-600 font-bold text-sm">
                            {teacher.name.charAt(0)}
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-900">{teacher.name}</h4>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                <span className="bg-gray-100 px-1.5 py-0.5 rounded">#{teacher.id}</span>
                                {teacher.phone && <span className="flex items-center gap-1"><Phone size={10} /> {teacher.phone}</span>}
                            </div>
                        </div>
                    </div>
                    <button 
                        onClick={() => setSelectedTeacher(teacher)}
                        className="bg-gray-50 p-2 rounded-lg text-gray-500 hover:bg-green-50 hover:text-green-600 transition-colors"
                        title="عرض QR"
                    >
                        <QrCode size={20} />
                    </button>
                </div>
            ))}
        </div>
      )}

      {/* Teacher QR Modal */}
      {selectedTeacher && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden animate-scale-in">
            <div className="bg-green-600 p-4 flex justify-between items-center text-white">
              <h3 className="font-bold">بطاقة المعلم</h3>
              <button onClick={() => setSelectedTeacher(null)} className="hover:bg-white/20 p-1 rounded-full">
                <X size={20} />
              </button>
            </div>
            <div className="p-8 flex flex-col items-center text-center">
              <div className="border-4 border-black p-4 rounded-xl mb-6 bg-white shadow-lg">
                <QRCodeCanvas value={selectedTeacher.qrCode} size={200} level="H" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">{selectedTeacher.name}</h2>
              <div className="text-lg text-gray-500 mb-2">الرقم الوظيفي: {selectedTeacher.id}</div>
              {selectedTeacher.phone && <div className="text-sm bg-gray-100 px-3 py-1 rounded-full">{selectedTeacher.phone}</div>}

              <button 
                onClick={() => window.print()} 
                className="mt-8 w-full bg-gray-900 text-white py-3 rounded-xl font-bold hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
              >
                <Printer size={20} />
                طباعة البطاقة
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
                      <p className="text-gray-600">سيؤدي هذا الإجراء إلى حذف جميع بيانات المعلمين ({teachers.length} معلم) من النظام بشكل نهائي. يجب إعادة استيرادهم بعد الحذف.</p>
                      
                      <div className="flex gap-3 mt-6">
                          <button 
                             onClick={() => setShowDeleteAllModal(false)}
                             className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200"
                          >
                              إلغاء
                          </button>
                          <button 
                             onClick={() => {
                                 clearAllTeachers();
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