import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { AttendanceStatus, EnvelopeStatus } from '../../types';
import { Printer, Calendar, FileText, Bell, AlertTriangle, ClipboardList } from 'lucide-react';

type ReportTab = 'LOGISTICS' | 'ABSENCE' | 'NOTIFICATIONS';

export const Reports: React.FC = () => {
  const { exams, notifications } = useApp();
  const [activeTab, setActiveTab] = useState<ReportTab>('LOGISTICS');
  
  // ✅ إصلاح التاريخ: استخدام التاريخ المحلي (YYYY-MM-DD)
  // هذا يحل مشكلة اختفاء البيانات ليلاً
  const getLocalDate = () => {
      const now = new Date();
      return now.toLocaleDateString('en-CA'); 
  };
  
  const [selectedDate, setSelectedDate] = useState(getLocalDate());

  const logisticsData = exams
    .filter(e => e.date === selectedDate)
    .sort((a, b) => a.committeeNumber.localeCompare(b.committeeNumber, 'en', {numeric: true}))
    .map(exam => ({
        committee: exam.committeeNumber,
        subject: exam.subject,
        teacher: exam.teacherId || '---',
        status: exam.status,
        startTime: exam.startTime,
        endTime: exam.endTime
    }));

  const absenceData = exams
    .filter(e => e.date === selectedDate) // مطابقة دقيقة للتاريخ
    .flatMap(exam => {
        return exam.students
            .filter(student => {
                const record = exam.attendance.find(a => a.studentId === student.id);
                // ✅ التأكد من حالة الغياب
                return record?.status === AttendanceStatus.ABSENT;
            })
            .map(student => ({
                studentName: student.name,
                grade: student.grade,
                examSubject: exam.subject,
                committee: exam.committeeNumber
            }));
    });

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4 print:hidden">
        <div>
          <h2 className="text-2xl font-black text-slate-800">مركز التقارير والتوثيق</h2>
          <p className="text-gray-500 text-sm mt-1">إصدار الكشوفات الرسمية وسجلات المتابعة</p>
        </div>
        <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-2xl border border-gray-200">
            <Calendar className="text-gray-400 ml-2" size={20} />
            <input 
                type="date" 
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent border-none outline-none text-slate-800 font-bold"
            />
        </div>
      </div>

      {/* ترويسة الطباعة */}
      <div className="hidden print:block text-center mb-8 border-b-2 border-black pb-4">
          <h1 className="text-2xl font-black mb-2">المملكة العربية السعودية</h1>
          <h2 className="text-xl font-bold">وزارة التعليم - إدارة الاختبارات</h2>
          <h3 className="text-lg mt-4 border-2 border-black inline-block px-6 py-2 rounded-lg">
              {activeTab === 'LOGISTICS' ? 'سجل تسليم واستلام المظاريف' : 'كشف الطلاب الغائبين'}
          </h3>
          <div className="flex justify-between mt-6 px-10 font-bold">
              <p>التاريخ: {selectedDate}</p>
              <p>الفصل الدراسي: الثاني 1447هـ</p>
          </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar print:hidden">
          <button onClick={() => setActiveTab('LOGISTICS')} className={`px-6 py-4 rounded-2xl font-bold flex gap-3 ${activeTab === 'LOGISTICS' ? 'bg-slate-900 text-white' : 'bg-white border'}`}>
              <ClipboardList size={20} /> سجل الاستلام
          </button>
          <button onClick={() => setActiveTab('ABSENCE')} className={`px-6 py-4 rounded-2xl font-bold flex gap-3 ${activeTab === 'ABSENCE' ? 'bg-slate-900 text-white' : 'bg-white border'}`}>
              <AlertTriangle size={20} /> كشف الغياب <span className="bg-red-100 text-red-600 px-2 rounded-full text-xs">{absenceData.length}</span>
          </button>
          <button onClick={() => setActiveTab('NOTIFICATIONS')} className={`px-6 py-4 rounded-2xl font-bold flex gap-3 ${activeTab === 'NOTIFICATIONS' ? 'bg-slate-900 text-white' : 'bg-white border'}`}>
              <Bell size={20} /> سجل العمليات
          </button>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden min-h-[500px] print:shadow-none print:border-none print:rounded-none">
          {activeTab === 'LOGISTICS' && (
              <div className="p-0">
                  <div className="p-6 border-b bg-gray-50 flex justify-between items-center print:hidden">
                      <h3 className="font-bold text-lg text-gray-800">حركة المظاريف</h3>
                      <button onClick={() => window.print()} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold flex gap-2"><Printer size={18} /> طباعة</button>
                  </div>
                  <table className="w-full text-sm text-right print:text-black">
                      <thead className="bg-gray-100 font-bold border-b print:bg-gray-200 print:border-black">
                          <tr>
                              <th className="p-4 border print:border-black">لجنة</th>
                              <th className="p-4 border print:border-black">المادة</th>
                              <th className="p-4 border print:border-black">المراقب</th>
                              <th className="p-4 border print:border-black">الوقت</th>
                              <th className="p-4 border print:border-black print:hidden">الحالة</th>
                              <th className="p-4 border print:border-black w-32">توقيع الاستلام</th>
                              <th className="p-4 border print:border-black w-32">توقيع التسليم</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 print:divide-black">
                          {logisticsData.map((row, idx) => (
                              <tr key={idx} className="print:h-12">
                                  <td className="p-4 font-black border print:border-black text-center">{row.committee}</td>
                                  <td className="p-4 border print:border-black">{row.subject}</td>
                                  <td className="p-4 border print:border-black">{row.teacher}</td>
                                  <td className="p-4 border print:border-black dir-ltr">{row.startTime}</td>
                                  <td className="p-4 border print:border-black print:hidden">{row.status}</td>
                                  <td className="p-4 border print:border-black"></td>
                                  <td className="p-4 border print:border-black"></td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          )}

          {activeTab === 'ABSENCE' && (
              <div className="p-0">
                  <div className="p-6 border-b bg-gray-50 flex justify-between items-center print:hidden">
                      <h3 className="font-bold text-lg text-gray-800">كشف الغياب ({absenceData.length})</h3>
                      <button onClick={() => window.print()} className="bg-red-600 text-white px-5 py-2.5 rounded-xl font-bold flex gap-2"><Printer size={18} /> طباعة</button>
                  </div>
                  <table className="w-full text-sm text-right print:text-black">
                      <thead className="bg-gray-100 font-bold border-b print:bg-gray-200 print:border-black">
                          <tr>
                              <th className="p-4 border print:border-black w-10">م</th>
                              <th className="p-4 border print:border-black">الطالب</th>
                              <th className="p-4 border print:border-black">الصف</th>
                              <th className="p-4 border print:border-black">اللجنة</th>
                              <th className="p-4 border print:border-black">المادة</th>
                              <th className="p-4 border print:border-black w-40">ملاحظات</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 print:divide-black">
                          {absenceData.map((row, idx) => (
                              <tr key={idx}>
                                  <td className="p-4 border print:border-black text-center">{idx + 1}</td>
                                  <td className="p-4 border print:border-black font-bold">{row.studentName}</td>
                                  <td className="p-4 border print:border-black">{row.grade}</td>
                                  <td className="p-4 border print:border-black text-center">{row.committee}</td>
                                  <td className="p-4 border print:border-black">{row.examSubject}</td>
                                  <td className="p-4 border print:border-black"></td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          )}
          
          {activeTab === 'NOTIFICATIONS' && (
              <div className="p-6">
                  {notifications.map((n, i) => (
                      <div key={i} className="p-3 border-b flex justify-between">
                          <span>{n.message}</span>
                          <span className="text-gray-400 text-xs">{new Date(n.timestamp).toLocaleTimeString('ar-SA')}</span>
                      </div>
                  ))}
              </div>
          )}
      </div>
      
      <div className="hidden print:flex justify-between items-end mt-20 px-12 text-center font-bold text-black">
          <div><p className="mb-16">مسؤول الكنترول</p><p>................................</p></div>
          <div><p className="mb-16">وكيل الشؤون التعليمية</p><p>................................</p></div>
          <div><p className="mb-16">مدير المدرسة</p><p>................................</p></div>
      </div>
    </div>
  );
};
