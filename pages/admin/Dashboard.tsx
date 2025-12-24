import React from 'react';
import { useApp } from '../../context/AppContext';
import { EnvelopeStatus, AttendanceStatus } from '../../types';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { Activity, Users, FileCheck, AlertTriangle, Layers } from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { exams, students } = useApp();

  // --- Fixed Statistics Logic ---

  // 1. Unique Committees Count (Physical Rooms)
  const uniqueCommitteesCount = new Set(exams.map(e => e.committeeNumber)).size;

  // 2. Total Master Students (from the Database, not sum of exams)
  // If master list is empty (legacy), fallback to unique IDs found in exams
  const totalUniqueStudents = students.length > 0 
    ? students.length 
    : new Set(exams.flatMap(e => e.students.map(s => s.id))).size;

  // 3. Ongoing Exams (Active Envelopes)
  const ongoingExams = exams.filter(e => e.status === EnvelopeStatus.RECEIVED).length;

  // 4. Total Absent (Cumulative)
  let totalAbsent = 0;
  let totalPresent = 0;
  let totalScheduledStudentSessions = 0;

  exams.forEach(exam => {
    totalScheduledStudentSessions += exam.students.length;
    exam.attendance.forEach(att => {
      if (att.status === AttendanceStatus.PRESENT) totalPresent++;
      if (att.status === AttendanceStatus.ABSENT) totalAbsent++;
    });
  });

  const completedExams = exams.filter(e => e.status === EnvelopeStatus.COMPLETED || e.status === EnvelopeStatus.DELIVERED).length;

  const attendanceData = [
    { name: 'حضور', value: totalPresent, color: '#10b981' },
    { name: 'غياب', value: totalAbsent, color: '#ef4444' },
    { name: 'غير محدد', value: totalScheduledStudentSessions - (totalPresent + totalAbsent), color: '#e5e7eb' },
  ];

  const statusData = [
    { name: 'قيد الانتظار', count: exams.filter(e => e.status === EnvelopeStatus.PENDING).length },
    { name: 'جاري الاختبار', count: ongoingExams },
    { name: 'تم التسليم', count: completedExams },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          icon={<Layers className="text-blue-600" />} 
          title="عدد اللجان" 
          value={uniqueCommitteesCount} 
          subValue="لجان فعلية"
          color="bg-blue-50"
        />
        <StatCard 
          icon={<Activity className="text-green-600" />} 
          title="اختبارات جارية" 
          value={ongoingExams} 
          subValue="مظروف مفتوح الآن"
          color="bg-green-50"
        />
        <StatCard 
          icon={<Users className="text-purple-600" />} 
          title="إجمالي الطلاب" 
          value={totalUniqueStudents} 
          subValue="طالب مسجل بالنظام"
          color="bg-purple-50"
        />
        <StatCard 
          icon={<AlertTriangle className="text-red-600" />} 
          title="حالات الغياب" 
          value={totalAbsent} 
          subValue="غياب تراكمي"
          color="bg-red-50"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendance Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 min-w-0">
          <h3 className="text-lg font-bold text-gray-800 mb-4">تقرير الحضور والغياب اللحظي</h3>
          <div className="h-64 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <PieChart>
                <Pie
                  data={attendanceData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {attendanceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Exam Status Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 min-w-0">
          <h3 className="text-lg font-bold text-gray-800 mb-4">حالة المظاريف (الجلسات)</h3>
          <div className="h-64 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={statusData}>
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip cursor={{fill: 'transparent'}} />
                <Bar dataKey="count" fill="#0ea5e9" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Activity / Envelope Status Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h3 className="text-lg font-bold text-gray-800">مراقبة اللجان (Live)</h3>
          <span className="flex h-3 w-3 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-gray-50 text-gray-500 text-sm">
              <tr>
                <th className="p-4 font-medium">رقم اللجنة</th>
                <th className="p-4 font-medium">المادة / الصفوف</th>
                <th className="p-4 font-medium">الحالة</th>
                <th className="p-4 font-medium">المعلم المستلم</th>
                <th className="p-4 font-medium">نسبة الحضور</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {exams.length === 0 ? (
                 <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-400">لا توجد اختبارات مسجلة</td>
                 </tr>
              ) : (
                exams.slice(0, 10).map(exam => { // Show only recent/first 10 to avoid lag
                    const total = exam.students.length;
                    const present = exam.attendance.filter(a => a.status === AttendanceStatus.PRESENT).length;
                    const percentage = total > 0 ? Math.round((present / total) * 100) : 0;
                    
                    return (
                    <tr key={exam.id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-4 font-bold text-gray-900">{exam.committeeNumber}</td>
                        <td className="p-4 text-gray-600">
                            <div className="font-bold">{exam.subject}</div>
                            <div className="text-xs text-gray-400 truncate max-w-[200px]">
                                {exam.grades.join(', ')}
                            </div>
                        </td>
                        <td className="p-4">
                        <StatusBadge status={exam.status} />
                        </td>
                        <td className="p-4 text-sm text-gray-500">{exam.teacherId || '-'}</td>
                        <td className="p-4">
                        <div className="flex items-center gap-2">
                            <div className="w-24 bg-gray-200 rounded-full h-2">
                            <div className="bg-primary-500 h-2 rounded-full" style={{ width: `${percentage}%` }}></div>
                            </div>
                            <span className="text-xs text-gray-500">{percentage}%</span>
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
    [EnvelopeStatus.PENDING]: 'bg-yellow-100 text-yellow-700',
    [EnvelopeStatus.RECEIVED]: 'bg-blue-100 text-blue-700',
    [EnvelopeStatus.COMPLETED]: 'bg-purple-100 text-purple-700',
    [EnvelopeStatus.DELIVERED]: 'bg-green-100 text-green-700',
  };

  const labels = {
    [EnvelopeStatus.PENDING]: 'في الانتظار',
    [EnvelopeStatus.RECEIVED]: 'جاري الاختبار',
    [EnvelopeStatus.COMPLETED]: 'تم الجمع',
    [EnvelopeStatus.DELIVERED]: 'تم التسليم للكنترول',
  };

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
};