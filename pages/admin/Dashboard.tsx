import React from 'react';
import { useApp } from '../../context/AppContext';
import { EnvelopeStatus, AttendanceStatus } from '../../types';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, Tooltip } from 'recharts';
import { Activity, Users, AlertTriangle, Layers, CalendarClock, CheckCircle2 } from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { exams, students, teachers } = useApp();

  const today = new Date().toISOString().split('T')[0];
  
  // الفلاتر الحية
  const liveExams = exams.filter(e => e.date === today || e.status === EnvelopeStatus.RECEIVED);
  const ongoingExamsCount = liveExams.filter(e => e.status === EnvelopeStatus.RECEIVED).length;
  
  // إحصائيات الحضور والغياب (لليوم فقط)
  let todayAbsent = 0;
  let todayPresent = 0;
  let todayTotalStudents = 0;

  liveExams.forEach(exam => {
    todayTotalStudents += exam.students.length;
    exam.attendance.forEach(att => {
      if (att.status === AttendanceStatus.PRESENT) todayPresent++;
      if (att.status === AttendanceStatus.ABSENT) todayAbsent++;
    });
  });

  const attendanceData = [
    { name: 'حضور', value: todayPresent, color: '#10b981' },
    { name: 'غياب', value: todayAbsent, color: '#ef4444' },
    { name: 'لم يرصد', value: todayTotalStudents - (todayPresent + todayAbsent), color: '#e5e7eb' },
  ];

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-black text-gray-800">لوحة القيادة المركزية</h2>
            <p className="text-gray-500 text-sm flex items-center gap-2 mt-1">
                <CalendarClock size={16} className="text-blue-500" />
                ملخص العمليات ليوم: <span className="font-bold text-gray-800" dir="ltr">{today}</span>
            </p>
          </div>
          <div className="flex gap-2">
              <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100 text-sm font-bold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                  النظام متصل
              </div>
          </div>
      </div>

      {/* 1. إحصائيات سريعة (Cards) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard 
          icon={<Layers className="text-blue-600" />} 
          title="لجان اليوم" 
          value={new Set(liveExams.map(e => e.committeeNumber)).size} 
          color="bg-blue-50"
        />
        <StatCard 
          icon={<Activity className="text-green-600" />} 
          title="لجان نشطة الآن" 
          value={ongoingExamsCount} 
          color="bg-green-50"
          animate
        />
        <StatCard 
          icon={<Users className="text-purple-600" />} 
          title="الطلاب المستهدفين" 
          value={todayTotalStudents} 
          color="bg-purple-50"
        />
        <StatCard 
          icon={<AlertTriangle className="text-red-600" />} 
          title="حالات الغياب" 
          value={todayAbsent} 
          color="bg-red-50"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* 2. الرسم البياني للحضور (يمين) */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center min-h-[300px]">
              <h3 className="text-lg font-bold text-gray-800 mb-4 w-full">نسبة الحضور اليوم</h3>
              <div className="w-full h-48 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={attendanceData}
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {attendanceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                {/* النسبة في الوسط */}
                <div className="absolute inset-0 flex items-center justify-center flex-col">
                    <span className="text-3xl font-black text-gray-800">
                        {todayTotalStudents > 0 ? Math.round((todayPresent / todayTotalStudents) * 100) : 0}%
                    </span>
                    <span className="text-xs text-gray-400">حضور</span>
                </div>
              </div>
              
              <div className="flex gap-4 mt-4 text-xs font-bold">
                  <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500"></span> حضور ({todayPresent})</div>
                  <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500"></span> غياب ({todayAbsent})</div>
              </div>
          </div>

          {/* 3. المراقبة الحية للجان (يسار - يأخذ مساحة أكبر) */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
              <div className="p-6 border-b border-gray-50 flex justify-between items-center">
                  <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                      <Activity className="text-red-500 w-5 h-5" />
                      غرفة العمليات (Live)
                  </h3>
                  <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-500">تحديث تلقائي</span>
              </div>
              
              <div className="overflow-y-auto max-h-[300px] p-4 space-y-3 custom-scrollbar">
                  {liveExams.length === 0 ? (
                      <div className="text-center py-10 text-gray-400">لا توجد اختبارات جارية الآن</div>
                  ) : (
                      liveExams.map(exam => (
                          <div key={exam.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-blue-200 transition-colors">
                              <div className="flex items-center gap-4">
                                  <div className="bg-white w-12 h-12 rounded-lg flex flex-col items-center justify-center border border-gray-200 shadow-sm">
                                      <span className="text-[10px] text-gray-400 font-bold">لجنة</span>
                                      <span className="text-lg font-black text-gray-800">{exam.committeeNumber}</span>
                                  </div>
                                  <div>
                                      <h4 className="font-bold text-gray-800 text-sm">{exam.subject}</h4>
                                      <p className="text-xs text-gray-500">{exam.grades.join('، ')}</p>
                                  </div>
                              </div>
                              
                              <div className="flex items-center gap-3">
                                  {/* حالة المظروف */}
                                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                      exam.status === EnvelopeStatus.RECEIVED ? 'bg-blue-100 text-blue-700 animate-pulse' :
                                      exam.status === EnvelopeStatus.COMPLETED ? 'bg-green-100 text-green-700' :
                                      'bg-yellow-100 text-yellow-700'
                                  }`}>
                                      {exam.status === EnvelopeStatus.RECEIVED ? 'جاري الاختبار' : 
                                       exam.status === EnvelopeStatus.COMPLETED ? 'تم الجمع' : 'انتظار'}
                                  </span>
                              </div>
                          </div>
                      ))
                  )}
              </div>
          </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ icon: React.ReactNode, title: string, value: number, color: string, animate?: boolean }> = ({ icon, title, value, color, animate }) => (
  <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between relative overflow-hidden group">
    <div className={`absolute right-0 top-0 p-20 rounded-full opacity-5 group-hover:scale-150 transition-transform duration-500 ${color.replace('bg-', 'bg-text-')}`}></div>
    <div>
      <p className="text-gray-500 text-xs font-bold mb-1">{title}</p>
      <h4 className="text-3xl font-black text-gray-800 flex items-center gap-2">
          {value}
          {animate && value > 0 && <span className="flex h-3 w-3 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>}
      </h4>
    </div>
    <div className={`p-3 rounded-xl ${color}`}>
      {icon}
    </div>
  </div>
);
