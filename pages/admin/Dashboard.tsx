import React from 'react';
import { useApp } from '../../context/AppContext';
import { EnvelopeStatus, AttendanceStatus } from '../../types';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { Activity, Users, FileCheck, AlertTriangle, Layers, CalendarClock } from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { exams, students } = useApp();

  // --- 1. FILTER FOR LIVE VIEW (TODAY or ACTIVE) ---
  const today = new Date().toISOString().split('T')[0];
  
  // We include exams that are:
  // 1. Scheduled for TODAY
  // 2. OR status is RECEIVED (currently running, even if date is wrong)
  // 3. OR status is PENDING/COMPLETED but date is TODAY
  const liveExams = exams.filter(e => 
    e.date === today || e.status === EnvelopeStatus.RECEIVED
  );

  // Sort Numerically: 1, 2, 10 instead of 1, 10, 2
  const sortedLiveExams = [...liveExams].sort((a, b) => 
    a.committeeNumber.localeCompare(b.committeeNumber, 'en', { numeric: true })
  );

  // --- 2. STATISTICS CALCULATIONS (Based on LIVE data mostly) ---

  // Unique Committees Today
  const uniqueCommitteesCount = new Set(liveExams.map(e => e.committeeNumber)).size;

  // Ongoing Exams Now
  const ongoingExamsCount = liveExams.filter(e => e.status === EnvelopeStatus.RECEIVED).length;

  // Attendance Stats (For Today's Exams)
  let todayAbsent = 0;
  let todayPresent = 0;
  let todayScheduled = 0;

  liveExams.forEach(exam => {
    todayScheduled += exam.students.length;
    exam.attendance.forEach(att => {
      if (att.status === AttendanceStatus.PRESENT) todayPresent++;
      if (att.status === AttendanceStatus.ABSENT) todayAbsent++;
    });
  });

  const todayUnspecified = todayScheduled - (todayPresent + todayAbsent);

  // Completed Today
  const completedTodayCount = liveExams.filter(e => e.status === EnvelopeStatus.COMPLETED || e.status === EnvelopeStatus.DELIVERED).length;

  // --- 3. CHART DATA ---

  const attendanceData = [
    { name: 'حضور', value: todayPresent, color: '#10b981' }, // Green
    { name: 'غياب', value: todayAbsent, color: '#ef4444' },  // Red
    { name: 'غير محدد', value: todayUnspecified, color: '#e5e7eb' }, // Gray
  ];

  const statusData = [
    { name: 'في الانتظار', count: liveExams.filter(e => e.status === EnvelopeStatus.PENDING).length },
    { name: 'جاري الاختبار', count: ongoingExamsCount },
    { name: 'تم التسليم', count: completedTodayCount },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Header Info */}
      <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">لوحة المتابعة المركزية</h2>
            <p className="text-gray-500 text-sm flex items-center gap-2">
                <CalendarClock size={16} />
                حالة الاختبارات ليوم: <span className="font-bold text-primary-600" dir="ltr">{today}</span>
            </p>
          </div>
      </div>

      {/* 1. Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          icon={<Layers className="text-blue-600" />} 
          title="لجان اليوم" 
          value={uniqueCommitteesCount} 
          subValue="لجنة مجدولة اليوم"
          color="bg-blue-50"
        />
        <StatCard 
          icon={<Activity className="text-green-600" />} 
          title="جلسات نشطة" 
          value={ongoingExamsCount} 
          subValue="اختبار يجري الآن"
          color="bg-green-50"
        />
        <StatCard 
          icon={<Users className="text-purple-600" />} 
          title="الطلاب المستهدفين" 
          value={todayScheduled} 
          subValue="طالب لديه اختبار اليوم"
          color="bg-purple-50"
        />
        <StatCard 
          icon={<AlertTriangle className="text-red-600" />} 
          title="غياب اليوم" 
          value={todayAbsent} 
          subValue="حالة غياب مرصودة"
          color="bg-red-50"
        />
      </div>

      {/* 2. Live Monitoring Table (Priority View) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-gray-800">مراقبة اللجان (Live)</h3>
              <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full animate-pulse font-bold">مباشر</span>
          </div>
          <div className="text-xs text-gray-400">يتم التحديث تلقائياً</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-white text-gray-500 text-sm border-b border-gray-100">
              <tr>
                <th className="p-4 font-medium w-32">رقم اللجنة</th>
                <th className="p-4 font-medium">المادة / الصفوف</th>
                <th className="p-4 font-medium">الوقت</th>
                <th className="p-4 font-medium">الحالة</th>
                <th className="p-4 font-medium">المراقب</th>
                <th className="p-4 font-medium">الحضور</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sortedLiveExams.length === 0 ? (
                 <tr>
                    <td colSpan={6} className="p-12 text-center text-gray-400">
                        <div className="flex flex-col items-center gap-2">
                            <CalendarClock size={32} />
                            <p>لا توجد اختبارات مجدولة لهذا اليوم ({today})</p>
                        </div>
                    </td>
                 </tr>
              ) : (
                sortedLiveExams.map(exam => {
                    const total = exam.students.length;
                    const present = exam.attendance.filter(a => a.status === AttendanceStatus.PRESENT).length;
                    const percentage = total > 0 ? Math.round((present / total) * 100) : 0;
                    
                    return (
                    <tr key={exam.id} className="hover:bg-blue-50/50 transition-colors">
                        <td className="p-4">
                            <span className="font-bold text-gray-900 text-lg bg-gray-100 px-3 py-1 rounded-lg border border-gray-200 block w-fit text-center min-w-[60px]">
                                {exam.committeeNumber}
                            </span>
                        </td>
                        <td className="p-4 text-gray-600">
                            <div className="font-bold text-gray-800">{exam.subject}</div>
                            <div className="text-xs text-gray-500 mt-1">
                                {exam.grades.join(' • ')}
                            </div>
                        </td>
                        <td className="p-4 font-mono text-sm text-gray-600">
                            {exam.startTime} - {exam.endTime}
                        </td>
                        <td className="p-4">
                             <StatusBadge status={exam.status} />
                        </td>
                        <td className="p-4 text-sm text-gray-500">
                            {exam.teacherId ? (
                                <span className="flex items-center gap-1 text-green-700 font-medium">
                                    <Users size={14} />
                                    {exam.teacherId}
                                </span>
                            ) : '-'}
                        </td>
                        <td className="p-4">
                        <div className="flex items-center gap-2 w-32">
                            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full rounded-full transition-all duration-500 ${
                                        percentage === 100 ? 'bg-green-500' : 'bg-blue-500'
                                    }`} 
                                    style={{ width: `${percentage}%` }}
                                ></div>
                            </div>
                            <span className="text-xs font-bold text-gray-600 w-8 text-left">{percentage}%</span>
                        </div>
                        </td>
                    </tr>
                    );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Attendance Chart (Requested as Real-time Report) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 min-w-0 flex flex-col">
          <h3 className="text-lg font-bold text-gray-800 mb-2">تقرير الحضور والغياب اللحظي</h3>
          <p className="text-xs text-gray-400 mb-6">إحصائيات فورية لاختبارات اليوم فقط</p>
          
          <div className="flex-1 min-h-[300px]" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={attendanceData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => percent > 0 ? `${(percent * 100).toFixed(0)}%` : ''}
                >
                  {attendanceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                  ))}
                </Pie>
                <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
          
          {/* Summary Text */}
          <div className="grid grid-cols-3 gap-2 mt-4 text-center">
              <div className="bg-green-50 p-2 rounded-lg">
                  <div className="text-xl font-bold text-green-600">{todayPresent}</div>
                  <div className="text-xs text-green-800">حضور</div>
              </div>
              <div className="bg-red-50 p-2 rounded-lg">
                  <div className="text-xl font-bold text-red-600">{todayAbsent}</div>
                  <div className="text-xs text-red-800">غياب</div>
              </div>
              <div className="bg-gray-100 p-2 rounded-lg">
                  <div className="text-xl font-bold text-gray-600">{todayUnspecified}</div>
                  <div className="text-xs text-gray-800">غير محدد</div>
              </div>
          </div>
        </div>

        {/* 4. Envelope Status Chart (Requested at the end) */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 min-w-0 flex flex-col">
          <h3 className="text-lg font-bold text-gray-800 mb-2">حالة المظاريف (الجلسات)</h3>
          <p className="text-xs text-gray-400 mb-6">متابعة تسليم واستلام مظاريف الاختبارات لليوم</p>
          
          <div className="flex-1 min-h-[300px]" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusData} barSize={60}>
                <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#6b7280', fontSize: 12}}
                    dy={10}
                />
                <YAxis 
                    hide 
                />
                <Tooltip 
                    cursor={{fill: '#f3f4f6', radius: 4}}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar 
                    dataKey="count" 
                    fill="#3b82f6" 
                    radius={[8, 8, 8, 8]}
                    label={{ position: 'top', fill: '#374151', fontSize: 14, fontWeight: 'bold' }}
                >
                    {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 1 ? '#10b981' : index === 2 ? '#6366f1' : '#fbbf24'} />
                    ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ icon: React.ReactNode, title: string, value: number, subValue: string, color: string }> = ({ icon, title, value, subValue, color }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-start justify-between">
    <div>
      <p className="text-gray-500 text-sm font-medium mb-1">{title}</p>
      <h4 className="text-3xl font-bold text-gray-900">{value}</h4>
      <p className="text-xs text-gray-400 mt-1">{subValue}</p>
    </div>
    <div className={`p-3 rounded-lg ${color}`}>
      {icon}
    </div>
  </div>
);

const StatusBadge: React.FC<{ status: EnvelopeStatus }> = ({ status }) => {
  const styles = {
    [EnvelopeStatus.PENDING]: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
    [EnvelopeStatus.RECEIVED]: 'bg-blue-100 text-blue-700 border border-blue-200 animate-pulse',
    [EnvelopeStatus.COMPLETED]: 'bg-purple-100 text-purple-700 border border-purple-200',
    [EnvelopeStatus.DELIVERED]: 'bg-green-100 text-green-700 border border-green-200',
  };

  const labels = {
    [EnvelopeStatus.PENDING]: 'في الانتظار',
    [EnvelopeStatus.RECEIVED]: 'جاري الاختبار',
    [EnvelopeStatus.COMPLETED]: 'تم الجمع',
    [EnvelopeStatus.DELIVERED]: 'بالكنترول',
  };

  return (
    <span className={`px-3 py-1 rounded-lg text-xs font-bold shadow-sm ${styles[status]}`}>
      {labels[status]}
    </span>
  );
};