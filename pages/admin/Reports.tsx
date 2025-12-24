import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { AttendanceStatus, EnvelopeStatus } from '../../types';
import { Printer, Calendar, FileText, Bell, CheckCircle, Clock, AlertTriangle } from 'lucide-react';

type ReportTab = 'ABSENCE' | 'COMMITTEES' | 'NOTIFICATIONS';

export const Reports: React.FC = () => {
  const { exams, notifications } = useApp();
  const [activeTab, setActiveTab] = useState<ReportTab>('ABSENCE');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // --- REPORT DATA PROCESSING ---

  // 1. Absence Data
  const absenceData = exams
    .filter(e => e.date === selectedDate)
    .flatMap(exam => {
        return exam.students
            .filter(student => {
                const record = exam.attendance.find(a => a.studentId === student.id);
                return record?.status === AttendanceStatus.ABSENT;
            })
            .map(student => ({
                studentName: student.name,
                grade: student.grade,
                examSubject: exam.subject,
                committee: exam.committeeNumber,
                period: exam.period
            }));
    });

  // 2. Committee Operations Data
  const committeesData = exams
    .filter(e => e.date === selectedDate)
    // Fix: Use numeric sort so "2" comes before "10"
    .sort((a, b) => a.committeeNumber.localeCompare(b.committeeNumber, 'en', { numeric: true }));

  // 3. Notifications Data
  // No date filter for notifications history typically, or maybe last 20
  const notificationsData = [...notifications].sort((a, b) => b.timestamp - a.timestamp);


  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header - Visible on Print as Report Header */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100 gap-4 print:shadow-none print:border-0 print:p-0 print:mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
             <FileText className="text-primary-600" />
             التقارير والسجلات المركزية
          </h2>
          <p className="text-gray-500 print:hidden">استعراض وطباعة تقارير الغياب وسير اللجان والتنبيهات</p>
          <p className="hidden print:block text-sm text-gray-500 mt-1">تاريخ التقرير: {new Date().toLocaleDateString('ar-SA')}</p>
        </div>
        
        <div className="flex gap-2 print:hidden">
            <button 
                onClick={handlePrint}
                className="bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2 shadow-lg"
            >
                <Printer size={20} />
                طباعة التقرير الحالي
            </button>
        </div>
      </div>

      {/* Controls & Tabs - Hidden on Print */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-2 flex flex-col md:flex-row gap-4 print:hidden">
          <div className="flex bg-gray-100 p-1 rounded-lg">
              <button 
                onClick={() => setActiveTab('ABSENCE')}
                className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'ABSENCE' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                  تقرير الغياب
              </button>
              <button 
                onClick={() => setActiveTab('COMMITTEES')}
                className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'COMMITTEES' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                  متابعة اللجان
              </button>
              <button 
                onClick={() => setActiveTab('NOTIFICATIONS')}
                className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'NOTIFICATIONS' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                  سجل التنبيهات
              </button>
          </div>

          {(activeTab === 'ABSENCE' || activeTab === 'COMMITTEES') && (
              <div className="flex items-center gap-2 bg-gray-50 px-3 py-1 rounded-lg border border-gray-200 ml-auto">
                  <Calendar size={16} className="text-gray-500" />
                  <input 
                    type="date" 
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-transparent border-none text-sm focus:ring-0 text-gray-700"
                  />
              </div>
          )}
      </div>

      {/* REPORT CONTENT AREA */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden print:shadow-none print:border-2 print:border-gray-900">
          
          {/* ABSENCE REPORT */}
          {activeTab === 'ABSENCE' && (
              <div>
                  <div className="p-6 bg-red-50 border-b border-red-100 print:bg-gray-100 print:border-gray-300">
                      <h3 className="text-lg font-bold text-red-800 print:text-black flex items-center gap-2">
                          <AlertTriangle size={20} />
                          كشف الطلاب الغائبين
                          <span className="text-sm font-normal text-red-600 print:text-gray-600 mr-2">
                              (تاريخ: {selectedDate})
                          </span>
                      </h3>
                  </div>
                  {absenceData.length === 0 ? (
                      <div className="p-12 text-center text-gray-500">لا يوجد غياب مسجل لهذا اليوم</div>
                  ) : (
                      <table className="w-full text-right">
                          <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider print:bg-gray-200">
                              <tr>
                                  <th className="p-4 border-b">اسم الطالب</th>
                                  <th className="p-4 border-b">الصف</th>
                                  <th className="p-4 border-b">المادة</th>
                                  <th className="p-4 border-b">اللجنة</th>
                                  <th className="p-4 border-b">الفترة</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 text-sm">
                              {absenceData.map((record, idx) => (
                                  <tr key={idx} className="hover:bg-gray-50">
                                      <td className="p-4 font-bold text-gray-900">{record.studentName}</td>
                                      <td className="p-4 text-gray-600">{record.grade}</td>
                                      <td className="p-4 text-gray-600">{record.examSubject}</td>
                                      <td className="p-4 text-gray-600 font-mono">{record.committee}</td>
                                      <td className="p-4 text-gray-600">{record.period}</td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  )}
                  <div className="p-4 bg-gray-50 text-xs text-gray-500 border-t border-gray-200 print:flex justify-between">
                      <span>إجمالي الغائبين: {absenceData.length}</span>
                      <span className="hidden print:block">توقيع مسؤول الكنترول: ............................</span>
                  </div>
              </div>
          )}

          {/* COMMITTEES REPORT */}
          {activeTab === 'COMMITTEES' && (
              <div>
                  <div className="p-6 bg-blue-50 border-b border-blue-100 print:bg-gray-100 print:border-gray-300">
                      <h3 className="text-lg font-bold text-blue-800 print:text-black flex items-center gap-2">
                          <Clock size={20} />
                          تقرير سير اللجان والمظاريف
                          <span className="text-sm font-normal text-blue-600 print:text-gray-600 mr-2">
                              (تاريخ: {selectedDate})
                          </span>
                      </h3>
                  </div>
                  {committeesData.length === 0 ? (
                      <div className="p-12 text-center text-gray-500">لا توجد لجان مسجلة لهذا اليوم</div>
                  ) : (
                      <table className="w-full text-right">
                          <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider print:bg-gray-200">
                              <tr>
                                  <th className="p-4 border-b">رقم اللجنة</th>
                                  <th className="p-4 border-b">المادة</th>
                                  <th className="p-4 border-b">وقت البدء</th>
                                  <th className="p-4 border-b">الحالة</th>
                                  <th className="p-4 border-b">المعلم المسؤول</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 text-sm">
                              {committeesData.map((exam, idx) => (
                                  <tr key={idx} className="hover:bg-gray-50">
                                      <td className="p-4 font-bold font-mono">{exam.committeeNumber}</td>
                                      <td className="p-4">{exam.subject}</td>
                                      <td className="p-4 font-mono">{exam.startTime}</td>
                                      <td className="p-4">
                                          {exam.status === EnvelopeStatus.PENDING && 'في الانتظار'}
                                          {exam.status === EnvelopeStatus.RECEIVED && 'جاري الاختبار'}
                                          {exam.status === EnvelopeStatus.COMPLETED && 'تم الجمع (منتهي)'}
                                          {exam.status === EnvelopeStatus.DELIVERED && 'تم التسليم للكنترول'}
                                      </td>
                                      <td className="p-4 text-gray-500">{exam.teacherId || '-'}</td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  )}
              </div>
          )}

          {/* NOTIFICATIONS REPORT */}
          {activeTab === 'NOTIFICATIONS' && (
              <div>
                  <div className="p-6 bg-purple-50 border-b border-purple-100 print:bg-gray-100 print:border-gray-300">
                      <h3 className="text-lg font-bold text-purple-800 print:text-black flex items-center gap-2">
                          <Bell size={20} />
                          سجل التنبيهات والعمليات
                      </h3>
                  </div>
                  <table className="w-full text-right">
                      <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider print:bg-gray-200">
                          <tr>
                              <th className="p-4 border-b">الوقت</th>
                              <th className="p-4 border-b">نوع التنبيه</th>
                              <th className="p-4 border-b">العنوان</th>
                              <th className="p-4 border-b">التفاصيل</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-sm">
                          {notificationsData.map((notif, idx) => (
                              <tr key={idx} className="hover:bg-gray-50">
                                  <td className="p-4 font-mono text-gray-500">
                                      {new Date(notif.timestamp).toLocaleString('ar-SA')}
                                  </td>
                                  <td className="p-4">
                                      <span className={`px-2 py-1 rounded-full text-xs ${
                                          notif.type === 'warning' ? 'bg-red-100 text-red-700' :
                                          notif.type === 'success' ? 'bg-green-100 text-green-700' :
                                          'bg-blue-100 text-blue-700'
                                      }`}>
                                          {notif.type === 'warning' ? 'تنبيه/غياب' : notif.type === 'success' ? 'عملية ناجحة' : 'معلومة'}
                                      </span>
                                  </td>
                                  <td className="p-4 font-bold text-gray-800">{notif.title}</td>
                                  <td className="p-4 text-gray-600">{notif.message}</td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          )}
      </div>
    </div>
  );
};