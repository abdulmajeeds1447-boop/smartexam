import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { AttendanceStatus } from '../../types';
import { Phone, MessageCircle, User, AlertCircle, Calendar, CheckCheck } from 'lucide-react';

export const CounselorDashboard: React.FC = () => {
  const { exams, students } = useApp();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Combine Exam Attendance data with Master Student Data to get Phone Numbers
  const absentStudents = useMemo(() => {
    return exams
      .filter(e => e.date === selectedDate)
      .flatMap(exam => {
        return exam.students
          .filter(s => {
             const record = exam.attendance.find(a => a.studentId === s.id);
             return record?.status === AttendanceStatus.ABSENT;
          })
          .map(examStudent => {
             // Try to find more details (like phone) from master list
             const masterStudent = students.find(ms => ms.id === examStudent.id);
             return {
                 ...examStudent,
                 parentPhone: masterStudent?.parentPhone || 'غير مسجل',
                 examSubject: exam.subject,
                 period: exam.period,
                 timestamp: exam.attendance.find(a => a.studentId === examStudent.id)?.timestamp
             };
          });
      })
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)); // Most recent first
  }, [exams, students, selectedDate]);

  const handleWhatsApp = (phone: string, studentName: string) => {
      // Remove leading zero, add country code (Assuming SA +966)
      let cleanPhone = phone.replace(/\D/g, '');
      if (cleanPhone.startsWith('0')) cleanPhone = '966' + cleanPhone.substring(1);
      
      const message = `السلام عليكم، نفيدكم بغياب الطالب/ة ${studentName} عن اختبار اليوم (${selectedDate}). نرجو التواصل مع المدرسة.`;
      window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  return (
    <div className="space-y-6 animate-fade-in">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <AlertCircle className="text-orange-500" />
                    لوحة متابعة الغياب
                </h2>
                <p className="text-gray-500">متابعة فورية للطلاب الغائبين والتواصل مع أولياء الأمور</p>
            </div>
            
            <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
                <Calendar size={18} className="text-gray-500" />
                <input 
                    type="date" 
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-transparent border-none focus:ring-0 text-gray-700 font-bold"
                />
            </div>
        </div>

        {absentStudents.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center border border-gray-100">
                <div className="bg-green-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCheck size={40} className="text-green-500" />
                </div>
                <h3 className="text-xl font-bold text-gray-800">لا يوجد غياب اليوم!</h3>
                <p className="text-gray-500 mt-2">جميع الطلاب حاضرون للاختبارات في التاريخ المحدد.</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {absentStudents.map((student, idx) => (
                    <div key={`${student.id}-${idx}`} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
                        <div className="p-4 flex items-start gap-4">
                            <img src={student.image} alt="" className="w-16 h-16 rounded-lg object-cover bg-gray-200" />
                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-gray-900 truncate">{student.name}</h3>
                                <p className="text-xs text-gray-500 mb-1">{student.grade} - {student.className}</p>
                                <div className="inline-flex items-center gap-1 bg-red-50 text-red-600 px-2 py-0.5 rounded text-[10px] font-bold">
                                    <AlertCircle size={10} />
                                    غائب: {student.examSubject}
                                </div>
                            </div>
                        </div>

                        <div className="bg-gray-50 px-4 py-3 border-t border-gray-100 flex items-center justify-between gap-2">
                            <div className="flex flex-col">
                                <span className="text-[10px] text-gray-400">ولي الأمر</span>
                                <span className="text-sm font-mono font-bold text-gray-700 dir-ltr">{student.parentPhone}</span>
                            </div>
                            
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => window.location.href = `tel:${student.parentPhone}`}
                                    className="p-2 bg-white border border-gray-200 rounded-lg text-gray-600 hover:text-blue-600 hover:border-blue-200 transition-colors"
                                    title="اتصال"
                                >
                                    <Phone size={18} />
                                </button>
                                <button 
                                    onClick={() => handleWhatsApp(student.parentPhone, student.name)}
                                    className="p-2 bg-green-50 border border-green-200 rounded-lg text-green-600 hover:bg-green-100 transition-colors"
                                    title="مراسلة واتساب"
                                >
                                    <MessageCircle size={18} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        )}
    </div>
  );
};