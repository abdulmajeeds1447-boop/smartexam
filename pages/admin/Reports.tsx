import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { AttendanceStatus, EnvelopeStatus } from '../../types';
import { Printer, Calendar, FileText, Bell, CheckCircle, Clock, AlertTriangle, Filter } from 'lucide-react';

type ReportTab = 'ABSENCE' | 'COMMITTEES' | 'NOTIFICATIONS';

export const Reports: React.FC = () => {
  const { exams, notifications, teachers } = useApp();
  const [activeTab, setActiveTab] = useState<ReportTab>('COMMITTEES'); // Default to Committees for Control
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('ALL'); // 'ALL' | 'الفترة الأولى' | 'الفترة الثانية'

  // --- REPORT DATA PROCESSING ---

  // 1. Absence Data
  const absenceData = exams
    .filter(e => e.date === selectedDate)
    .filter(e => selectedPeriod === 'ALL' || e.period === selectedPeriod)
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

  // 2. Committee Operations Data (Handover Report)
  const committeesData = exams
    .filter(e => e.date === selectedDate)
    .filter(e => selectedPeriod === 'ALL' || e.period === selectedPeriod)
    // Sort: Date (Implicitly same) -> Committee Number (Numeric)
    .sort((a, b) => a.committeeNumber.localeCompare(b.committeeNumber, 'en', { numeric: true }));

  // 3. Notifications Data
  const notificationsData = [...notifications].sort((a, b) => b.timestamp - a.timestamp);


  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header - Visible on Print as Report Header */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100 gap-4 print:shadow-none print:border-0 print:p-0 print:mb-8 print:border-b-2 print:border-gray-800 print:pb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
             <FileText className="text-primary-600 print:hidden" />
             {activeTab === 'COMMITTEES' ? 'بيان تسليم واستلام مظاريف الاختبارات' : 
              activeTab === 'ABSENCE' ? 'تقرير الغياب اليومي' : 'سجل العمليات'}
          </h2>
          <div className="mt-2 flex gap-4 text-sm text-gray-600 print:text-black font-medium">
             <p>التاريخ: <span dir="ltr">{selectedDate}</span></p>
             <p>الفترة: {selectedPeriod === 'ALL' ? 'جميع الفترات' : selectedPeriod}</p>
          </div>
        </div>
        
        <div className="flex gap-2 print:hidden">
            <button 
                onClick={handlePrint}
                className="bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2 shadow-lg"
            >
                <Printer size={20} />
                طباعة التقرير
            </button>
        </div>
      </div>

      {/* Controls & Tabs - Hidden on Print */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-2 flex flex-col md:flex-row gap-4 print:hidden items-center">
          <div className="flex bg-gray-100 p-1 rounded-lg shrink-0">
              <button 
                onClick={() => setActiveTab('COMMITTEES')}
                className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'COMMITTEES' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                  متابعة اللجان
              </button>
              <button 
                onClick={() => setActiveTab('ABSENCE')}
                className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'ABSENCE' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                  تقرير الغياب
              </button>
              <button 
                onClick={() => setActiveTab('NOTIFICATIONS')}
                className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'NOTIFICATIONS' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                  سجل التنبيهات
              </button>
          </div>

          {(activeTab === 'ABSENCE' || activeTab === 'COMMITTEES') && (
              <div className="flex flex-1 gap-2 justify-end items-center w-full">
                  
                  {/* Period Filter */}
                  <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                      <Filter size={16} className="text-gray-500" />
                      <select 
                        value={selectedPeriod}
                        onChange={(e) => setSelectedPeriod(e.target.value)}
                        className="bg-transparent border-none text-sm focus:ring-0 text-gray-700 font-bold outline-none cursor-pointer"
                      >
                          <option value="ALL">جميع الفترات</option>
                          <option value="الفترة الأولى">الفترة الأولى</option>
                          <option value="الفترة الثانية">الفترة الثانية</option>
                      </select>
                  </div>

                  {/* Date Filter */}
                  <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                      <Calendar size={16} className="text-gray-500" />
                      <input 
                        type="date" 
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="bg-transparent border-none text-sm focus:ring-0 text-gray-700 font-bold outline-none cursor-pointer"
                      />
                  </div>
              </div>
          )}
      </div>

      {/* REPORT CONTENT AREA */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden print:shadow-none print:border-0 print:overflow-visible">
          
          {/* ABSENCE REPORT */}
          {activeTab === 'ABSENCE' && (
              <div>
                  <div className="p-6 bg-red-50 border-b border-red-100 print:hidden">
                      <h3 className="text-lg font-bold text-red-800 flex items-center gap-2">
                          <AlertTriangle size={20} />
                          كشف الطلاب الغائبين
                      </h3>
                  </div>
                  {absenceData.length === 0 ? (
                      <div className="p-12 text-center text-gray-500">لا يوجد غياب مسجل لهذا اليوم/الفترة</div>
                  ) : (
                      <table className="w-full text-right border-collapse">
                          <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider print:bg-gray-200 print:text-black">
                              <tr>
                                  <th className="p-4 border border-gray-200">اسم الطالب</th>
                                  <th className="p-4 border border-gray-200">الصف</th>
                                  <th className="p-4 border border-gray-200">المادة</th>
                                  <th className="p-4 border border-gray-200">اللجنة</th>
                                  <th className="p-4 border border-gray-200">الفترة</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 text-sm">
                              {absenceData.map((record, idx) => (
                                  <tr key={idx} className="hover:bg-gray-50">
                                      <td className="p-4 border border-gray-200 font-bold text-gray-900">{record.studentName}</td>
                                      <td className="p-4 border border-gray-200 text-gray-600">{record.grade}</td>
                                      <td className="p-4 border border-gray-200 text-gray-600">{record.examSubject}</td>
                                      <td className="p-4 border border-gray-200 text-gray-600 font-mono text-center">{record.committee}</td>
                                      <td className="p-4 border border-gray-200 text-gray-600">{record.period}</td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  )}
                  <div className="p-4 bg-gray-50 text-xs text-gray-500 border-t border-gray-200 print:flex justify-between mt-4">
                      <span>إجمالي الغائبين: {absenceData.length}</span>
                  </div>
              </div>
          )}

          {/* COMMITTEES REPORT (HANDOVER) */}
          {activeTab === 'COMMITTEES' && (
              <div>
                  <div className="p-6 bg-blue-50 border-b border-blue-100 print:hidden">
                      <h3 className="text-lg font-bold text-blue-800 flex items-center gap-2">
                          <Clock size={20} />
                          جدول متابعة اللجان (بيان الاستلام)
                      </h3>
                  </div>
                  {committeesData.length === 0 ? (
                      <div className="p-12 text-center text-gray-500">لا توجد لجان مسجلة لهذا اليوم/الفترة</div>
                  ) : (
                      <>
                        <table className="w-full text-right border-collapse">
                            <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider print:bg-gray-200 print:text-black">
                                <tr>
                                    <th className="p-3 border border-gray-300 w-16 text-center">اللجنة</th>
                                    <th className="p-3 border border-gray-300">المادة / الصفوف</th>
                                    <th className="p-3 border border-gray-300 text-center w-24">الطلاب</th>
                                    <th className="p-3 border border-gray-300 text-center w-24">الحضور</th>
                                    <th className="p-3 border border-gray-300 text-center w-24">غياب</th>
                                    <th className="p-3 border border-gray-300">المعلم المستلم (المراقب)</th>
                                    <th className="p-3 border border-gray-300">الحالة</th>
                                    <th className="p-3 border border-gray-300 w-32 print:block hidden">توقيع المستلم</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm">
                                {committeesData.map((exam, idx) => {
                                    const teacher = teachers.find(t => t.id === exam.teacherId);
                                    const teacherName = teacher ? teacher.name : (exam.teacherId || '-');
                                    
                                    const totalStudents = exam.students.length;
                                    const absentCount = exam.attendance.filter(a => a.status === AttendanceStatus.ABSENT).length;
                                    const presentCount = exam.attendance.filter(a => a.status === AttendanceStatus.PRESENT).length;

                                    return (
                                        <tr key={idx} className="hover:bg-gray-50">
                                            <td className="p-3 border border-gray-300 font-bold font-mono text-center text-lg">{exam.committeeNumber}</td>
                                            <td className="p-3 border border-gray-300">
                                                <div className="font-bold">{exam.subject}</div>
                                                <div className="text-xs text-gray-500">{exam.grades.join('، ')}</div>
                                            </td>
                                            <td className="p-3 border border-gray-300 text-center font-mono">{totalStudents}</td>
                                            <td className="p-3 border border-gray-300 text-center font-mono text-green-700">{presentCount}</td>
                                            <td className="p-3 border border-gray-300 text-center font-mono text-red-600">{absentCount > 0 ? absentCount : '-'}</td>
                                            <td className="p-3 border border-gray-300 text-gray-800">{teacherName}</td>
                                            <td className="p-3 border border-gray-300 text-xs">
                                                {exam.status === EnvelopeStatus.PENDING && 'انتظار'}
                                                {exam.status === EnvelopeStatus.RECEIVED && 'جاري الاختبار'}
                                                {exam.status === EnvelopeStatus.COMPLETED && 'تم الجمع'}
                                                {exam.status === EnvelopeStatus.DELIVERED && 'بالكنترول'}
                                            </td>
                                            <td className="p-3 border border-gray-300 print:table-cell hidden"></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        
                        {/* Print Footer Signature Area */}
                        <div className="hidden print:flex mt-12 justify-between items-end px-12">
                            <div className="text-center space-y-4">
                                <p className="font-bold">عضو الكنترول المستلم</p>
                                <p className="mt-4">........................................</p>
                            </div>
                            <div className="text-center space-y-4">
                                <p className="font-bold">رئيس لجنة التحكم والضبط</p>
                                <p className="mt-4">........................................</p>
                            </div>
                            <div className="text-center space-y-4">
                                <p className="font-bold">مدير المدرسة</p>
                                <p className="mt-4">........................................</p>
                            </div>
                        </div>
                      </>
                  )}
              </div>
          )}

          {/* NOTIFICATIONS REPORT */}
          {activeTab === 'NOTIFICATIONS' && (
              <div>
                  <div className="p-6 bg-purple-50 border-b border-purple-100 print:hidden">
                      <h3 className="text-lg font-bold text-purple-800 flex items-center gap-2">
                          <Bell size={20} />
                          سجل التنبيهات والعمليات
                      </h3>
                  </div>
                  <table className="w-full text-right border-collapse">
                      <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider print:bg-gray-200">
                          <tr>
                              <th className="p-4 border border-gray-200">الوقت</th>
                              <th className="p-4 border border-gray-200">النوع</th>
                              <th className="p-4 border border-gray-200">العنوان</th>
                              <th className="p-4 border border-gray-200">التفاصيل</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-sm">
                          {notificationsData.map((notif, idx) => (
                              <tr key={idx} className="hover:bg-gray-50">
                                  <td className="p-4 border border-gray-200 font-mono text-gray-500">
                                      {new Date(notif.timestamp).toLocaleString('ar-SA')}
                                  </td>
                                  <td className="p-4 border border-gray-200">
                                      {notif.type === 'warning' ? 'تنبيه' : notif.type === 'success' ? 'نجاح' : 'معلومة'}
                                  </td>
                                  <td className="p-4 border border-gray-200 font-bold text-gray-800">{notif.title}</td>
                                  <td className="p-4 border border-gray-200 text-gray-600">{notif.message}</td>
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