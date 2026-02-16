import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { AttendanceStatus, EnvelopeStatus } from '../../types';
import { Printer, Calendar, FileText, Bell, AlertTriangle, ClipboardList, PenTool, CheckCircle2 } from 'lucide-react';

type ReportTab = 'LOGISTICS' | 'ABSENCE' | 'NOTIFICATIONS';

export const Reports: React.FC = () => {
  const { exams, notifications } = useApp();
  const [activeTab, setActiveTab] = useState<ReportTab>('LOGISTICS');
  
  // ✅ إصلاح التاريخ: استخدام التاريخ المحلي (YYYY-MM-DD) بدلاً من UTC
  // هذا يضمن تطابق تاريخ "اليوم" مع التواريخ المسجلة في الاختبارات
  const getLocalDate = () => {
      const now = new Date();
      return now.toLocaleDateString('en-CA'); // يعيد الصيغة 2026-02-16 حسب توقيت الجهاز
  };
  
  const [selectedDate, setSelectedDate] = useState(getLocalDate());

  // 1. بيانات سجل العمليات (Chain of Custody)
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

  // 2. بيانات الغياب (مصححة)
  const absenceData = exams
    .filter(e => e.date === selectedDate) // تأكد أن تاريخ الاختبار يطابق التاريخ المختار
    .flatMap(exam => {
        return exam.students
            .filter(student => {
                // البحث عن سجل الطالب في الحضور
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
      
      {/* Header (الشاشة فقط) */}
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

      {/* Header (للطباعة فقط - ترويسة رسمية) */}
      <div className="hidden print:block text-center mb-8 border-b-2 border-black pb-4">
          <h1 className="text-2xl font-black mb-2">المملكة العربية السعودية</h1>
          <h2 className="text-xl font-bold">وزارة التعليم - إدارة الاختبارات</h2>
          <h3 className="text-lg mt-4 border-2 border-black inline-block px-6 py-2 rounded-lg">
              {activeTab === 'LOGISTICS' ? 'سجل تسليم واستلام مظاريف الاختبارات' : 'كشف الطلاب الغائبين'}
          </h3>
          <div className="flex justify-between mt-6 px-10 font-bold">
              <p>التاريخ: {selectedDate}</p>
              <p>الفصل الدراسي: الثاني 1447هـ</p>
          </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar print:hidden">
          <button onClick={() => setActiveTab('LOGISTICS')} className={`px-6 py-4 rounded-2xl font-bold whitespace-nowrap transition-all flex items-center gap-3 ${activeTab === 'LOGISTICS' ? 'bg-slate-900 text-white shadow-lg shadow-slate-300 scale-105' : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-100'}`}>
              <ClipboardList size={20} /> سجل الاستلام والتسليم
          </button>
          <button onClick={() => setActiveTab('ABSENCE')} className={`px-6 py-4 rounded-2xl font-bold whitespace-nowrap transition-all flex items-center gap-3 ${activeTab === 'ABSENCE' ? 'bg-slate-900 text-white shadow-lg shadow-slate-300 scale-105' : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-100'}`}>
              <AlertTriangle size={20} /> كشف الغياب <span className="bg-red-100 text-red-600 px-2 rounded-full text-xs">{absenceData.length}</span>
          </button>
          <button onClick={() => setActiveTab('NOTIFICATIONS')} className={`px-6 py-4 rounded-2xl font-bold whitespace-nowrap transition-all flex items-center gap-3 ${activeTab === 'NOTIFICATIONS' ? 'bg-slate-900 text-white shadow-lg shadow-slate-300 scale-105' : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-100'}`}>
              <Bell size={20} /> سجل العمليات
          </button>
      </div>

      {/* Content Area */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden min-h-[500px] print:shadow-none print:border-none print:rounded-none">
          
          {/* 1. LOGISTICS REPORT */}
          {activeTab === 'LOGISTICS' && (
              <div className="p-0">
                  <div className="p-6 border-b bg-gray-50 flex justify-between items-center print:hidden">
                      <div>
                          <h3 className="font-bold text-lg text-gray-800">حركة المظاريف اليومية</h3>
                          <p className="text-xs text-gray-500 mt-1">توثيق خروج وعودة المظاريف (Chain of Custody)</p>
                      </div>
                      <button onClick={() => window.print()} className="bg-blue-600 text-white hover:bg-blue-700 px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg transition-all">
                          <Printer size={18} /> طباعة السجل
                      </button>
                  </div>
                  <div className="overflow-x-auto">
                      <table className="w-full text-sm text-right print:text-black">
                          <thead className="bg-gray-100 text-gray-600 font-bold border-b print:bg-gray-200 print:text-black border-black">
                              <tr>
                                  <th className="p-4 w-20 border print:border-black">لجنة</th>
                                  <th className="p-4 border print:border-black">المادة / الصفوف</th>
                                  <th className="p-4 border print:border-black">المراقب المستلم</th>
                                  <th className="p-4 border print:border-black">وقت البدء</th>
                                  <th className="p-4 border print:border-black print:hidden">الحالة</th>
                                  <th className="p-4 w-40 text-center bg-gray-200/50 border print:border-black">توقيع الاستلام</th>
                                  <th className="p-4 w-40 text-center bg-gray-200/50 border print:border-black">توقيع التسليم</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 print:divide-black">
                              {logisticsData.length === 0 ? (
                                  <tr><td colSpan={7} className="p-16 text-center text-gray-400">لا توجد اختبارات مسجلة لهذا اليوم</td></tr>
                              ) : (
                                  logisticsData.map((row, idx) => (
                                      <tr key={idx} className="hover:bg-gray-50 transition-colors print:hover:bg-transparent">
                                          <td className="p-4 font-black text-lg border print:border-black text-center">{row.committee}</td>
                                          <td className="p-4 font-bold text-gray-800 border print:border-black">{row.subject}</td>
                                          <td className="p-4 text-gray-600 border print:border-black font-medium">{row.teacher}</td>
                                          <td className="p-4 font-mono text-gray-500 border print:border-black dir-ltr text-center">{row.startTime}</td>
                                          <td className="p-4 border print:border-black print:hidden">
                                              <span className={`px-2 py-1 rounded text-[10px] font-bold border ${
                                                  row.status === EnvelopeStatus.DELIVERED ? 'bg-green-50 text-green-700 border-green-200' :
                                                  row.status === EnvelopeStatus.RECEIVED ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                  'bg-gray-50 text-gray-500 border-gray-200'
                                              }`}>
                                                  {row.status === EnvelopeStatus.DELIVERED ? 'مؤرشف' :
                                                   row.status === EnvelopeStatus.RECEIVED ? 'جاري' : 'انتظار'}
                                              </span>
                                          </td>
                                          <td className="p-4 border border-dashed border-gray-300 print:border-solid print:border-black text-center opacity-30 h-16"></td>
                                          <td className="p-4 border border-dashed border-gray-300 print:border-solid print:border-black text-center opacity-30 h-16"></td>
                                      </tr>
                                  ))
                              )}
                          </tbody>
                      </table>
                  </div>
              </div>
          )}

          {/* 2. ABSENCE REPORT */}
          {activeTab === 'ABSENCE' && (
              <div className="p-0">
                  <div className="p-6 border-b bg-gray-50 flex justify-between items-center print:hidden">
                      <div>
                          <h3 className="font-bold text-lg text-gray-800">كشف الطلاب الغائبين ({absenceData.length})</h3>
                          <p className="text-xs text-gray-500 mt-1">يجب تسليم هذا الكشف للمرشد الطلابي</p>
                      </div>
                      <button onClick={() => window.print()} className="bg-red-600 text-white hover:bg-red-700 px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-red-200">
                          <Printer size={18} /> طباعة الكشف
                      </button>
                  </div>
                  <table className="w-full text-sm text-right print:text-black">
                      <thead className="bg-gray-100 text-gray-600 font-bold border-b print:bg-gray-200 print:text-black print:border-black">
                          <tr>
                              <th className="p-4 border print:border-black">م</th>
                              <th className="p-4 border print:border-black">الطالب</th>
                              <th className="p-4 border print:border-black">الصف</th>
                              <th className="p-4 border print:border-black">اللجنة</th>
                              <th className="p-4 border print:border-black">المادة</th>
                              <th className="p-4 border print:border-black w-40">ملاحظات</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 print:divide-black">
                          {absenceData.length === 0 ? (
                              <tr><td colSpan={6} className="p-16 text-center text-gray-400">لا يوجد غياب مسجل حتى الآن</td></tr>
                          ) : (
                              absenceData.map((row, idx) => (
                                  <tr key={idx} className="hover:bg-red-50/50 transition-colors">
                                      <td className="p-4 border print:border-black text-center w-12">{idx + 1}</td>
                                      <td className="p-4 font-bold text-gray-800 border print:border-black">{row.studentName}</td>
                                      <td className="p-4 text-gray-500 border print:border-black">{row.grade}</td>
                                      <td className="p-4 font-mono text-blue-600 font-bold border print:border-black text-center">{row.committee}</td>
                                      <td className="p-4 text-gray-600 border print:border-black">{row.examSubject}</td>
                                      <td className="p-4 border print:border-black"></td>
                                  </tr>
                              ))
                          )}
                      </tbody>
                  </table>
              </div>
          )}

          {/* 3. NOTIFICATIONS */}
          {activeTab === 'NOTIFICATIONS' && (
              <div className="p-0">
                  <div className="p-4 border-b bg-gray-50 print:hidden">
                      <h3 className="font-bold text-gray-700">سجل الأحداث والتنبيهات (System Logs)</h3>
                  </div>
                  <table className="w-full text-sm text-right">
                      <thead className="bg-gray-50 text-gray-500 font-bold border-b">
                          <tr>
                              <th className="p-4 w-32">الوقت</th>
                              <th className="p-4 w-24">النوع</th>
                              <th className="p-4">الرسالة</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                          {notifications.map((notif, idx) => (
                              <tr key={idx} className="hover:bg-gray-50">
                                  <td className="p-4 text-gray-400 dir-ltr font-mono text-xs">
                                      {new Date(notif.timestamp).toLocaleTimeString('ar-SA')}
                                  </td>
                                  <td className="p-4">
                                      {notif.type === 'warning' ? <span className="text-red-500 font-bold text-xs bg-red-50 px-2 py-1 rounded">تنبيه</span> : 
                                       notif.type === 'success' ? <span className="text-green-500 font-bold text-xs bg-green-50 px-2 py-1 rounded">نجاح</span> : 
                                       <span className="text-blue-500 font-bold text-xs bg-blue-50 px-2 py-1 rounded">نظام</span>}
                                  </td>
                                  <td className="p-4 font-medium text-gray-700">{notif.message}</td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          )}
      </div>

      {/* Footer Signatures (Print Only) */}
      <div className="hidden print:flex justify-between items-end mt-20 px-12 text-center font-bold text-black">
          <div>
              <p className="mb-16">مسؤول الكنترول</p>
              <p>................................</p>
          </div>
          <div>
              <p className="mb-16">وكيل الشؤون التعليمية</p>
              <p>................................</p>
          </div>
          <div>
              <p className="mb-16">مدير المدرسة</p>
              <p>................................</p>
          </div>
      </div>
    </div>
  );
};
