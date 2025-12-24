import React, { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { AttendanceStatus, EnvelopeStatus, Student } from '../../types';
import { Check, X, Clock, Users, Send, Layers, Hash, BookOpen, Sun, Moon } from 'lucide-react';

export const ExamSession: React.FC = () => {
  const { activeExamId, exams, markAttendance, submitEnvelope } = useApp();
  
  const currentExam = exams.find(e => e.id === activeExamId);

  // Group students by Grade for display
  const groupedStudents = useMemo(() => {
    if (!currentExam) return {};
    const groups: { [key: string]: Student[] } = {};
    currentExam.students.forEach(student => {
      const key = `${student.grade} - ${student.subject}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(student);
    });
    return groups;
  }, [currentExam]);

  if (!currentExam) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center p-6 bg-white rounded-xl shadow-sm">
        <div className="bg-gray-100 p-6 rounded-full mb-4">
            <Clock size={48} className="text-gray-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">لا يوجد جلسة اختبار نشطة</h2>
        <p className="text-gray-500 max-w-xs">يرجى الانتقال إلى صفحة المسح الضوئي لاستلام مظروف وبدء الجلسة.</p>
      </div>
    );
  }

  const attendanceCount = currentExam.attendance.filter(a => a.status !== AttendanceStatus.UNKNOWN).length;
  const totalStudents = currentExam.students.length;
  const progress = (attendanceCount / totalStudents) * 100;

  // Determine Icon based on Period text
  const isMorning = !currentExam.period.includes('الثانية');

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      {/* Header Info */}
      <div className={`p-6 rounded-xl shadow-sm border ${isMorning ? 'bg-white border-gray-100' : 'bg-orange-50 border-orange-100'}`}>
        <div className="flex flex-col md:flex-row justify-between md:items-start mb-4 gap-2">
            <div>
                <div className="flex items-center gap-2 mb-1">
                   {isMorning ? <Sun size={16} className="text-orange-400" /> : <Moon size={16} className="text-indigo-400" />}
                   <span className={`text-xs font-bold ${isMorning ? 'text-gray-500' : 'text-orange-700'}`}>{currentExam.period}</span>
                </div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    {currentExam.subject}
                </h1>
                <div className="flex flex-wrap gap-2 mt-2">
                    <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-bold">لجنة {currentExam.committeeNumber}</span>
                    {currentExam.grades.map(g => (
                         <span key={g} className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs">{g}</span>
                    ))}
                </div>
            </div>
            <div className="bg-primary-50 text-primary-700 px-3 py-1 rounded-full text-sm font-bold font-mono self-start md:self-auto">
                {currentExam.startTime} - {currentExam.endTime}
            </div>
        </div>
        
        {/* Progress Bar */}
        <div className="space-y-2">
            <div className="flex justify-between text-sm">
                <span className="text-gray-600">اكتمال التحضير</span>
                <span className="font-bold text-gray-900">{attendanceCount} / {totalStudents}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                <div 
                    className="bg-primary-600 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${progress}%` }}
                ></div>
            </div>
        </div>
      </div>

      {/* Student List Groups - SORTED */}
      <div className="space-y-6">
        {(Object.entries(groupedStudents) as [string, Student[]][])
         .sort(([titleA], [titleB]) => {
             // Sort Logic: First Grade -> Second Grade -> Third Grade
             const getWeight = (s: string) => {
                 if (s.includes('أول') || s.includes('اول') || s.includes('1')) return 1;
                 if (s.includes('ثاني') || s.includes('2')) return 2;
                 if (s.includes('ثالث') || s.includes('3')) return 3;
                 return 4;
             };
             return getWeight(titleA) - getWeight(titleB);
         })
         .map(([groupTitle, students]) => (
            <div key={groupTitle} className="space-y-3 animate-fade-in">
                <h3 className="font-bold text-gray-800 flex items-center gap-2 border-r-4 border-primary-500 pr-3">
                    <Layers size={18} className="text-primary-500" />
                    {groupTitle}
                    <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{students.length} طلاب</span>
                </h3>

                <div className="grid grid-cols-1 gap-3">
                    {students.map(student => {
                        const status = currentExam.attendance.find(a => a.studentId === student.id)?.status || AttendanceStatus.UNKNOWN;
                        return (
                            <div key={student.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:shadow-md">
                                <div className="flex items-start sm:items-center gap-3">
                                    <div className="relative">
                                        <img src={student.image} alt={student.name} className="w-14 h-14 rounded-xl object-cover bg-gray-200" />
                                        <div className="absolute -bottom-2 -right-2 bg-gray-900 text-white text-[10px] px-1.5 py-0.5 rounded-md font-mono border-2 border-white">
                                            {student.className}
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className="font-bold text-gray-900">{student.name}</h4>
                                        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                                            <span className="flex items-center gap-1 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                                                <Hash size={10} /> {student.seatNumber}
                                            </span>
                                            <span className="flex items-center gap-1 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                                                <BookOpen size={10} /> {student.subject}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 justify-end">
                                    <button 
                                        onClick={() => markAttendance(currentExam.id, student.id, AttendanceStatus.PRESENT)}
                                        className={`flex-1 sm:flex-none p-3 rounded-lg transition-all flex items-center justify-center gap-2 ${
                                            status === AttendanceStatus.PRESENT 
                                            ? 'bg-green-500 text-white shadow-md' 
                                            : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                                        }`}
                                    >
                                        <Check size={20} />
                                        <span className="sm:hidden text-sm font-bold">حاضر</span>
                                    </button>
                                    <button 
                                        onClick={() => markAttendance(currentExam.id, student.id, AttendanceStatus.ABSENT)}
                                        className={`flex-1 sm:flex-none p-3 rounded-lg transition-all flex items-center justify-center gap-2 ${
                                            status === AttendanceStatus.ABSENT 
                                            ? 'bg-red-500 text-white shadow-md' 
                                            : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                                        }`}
                                    >
                                        <X size={20} />
                                        <span className="sm:hidden text-sm font-bold">غائب</span>
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        ))}
      </div>

      {/* Action Footer */}
      <div className="sticky bottom-20 md:bottom-4 left-0 right-0 px-4 md:px-0 mt-8 z-30">
        <button 
            onClick={() => {
                if(window.confirm('هل أنت متأكد من إنهاء الاختبار وجمع الأوراق؟ لا يمكن التراجع عن هذا الإجراء.')) {
                    submitEnvelope(currentExam.id);
                }
            }}
            disabled={attendanceCount < totalStudents}
            className={`w-full py-4 rounded-xl font-bold text-white shadow-lg flex items-center justify-center gap-2 transition-all ${
                attendanceCount < totalStudents 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-primary-600 hover:bg-primary-700 hover:shadow-xl'
            }`}
        >
            <Send size={20} />
            إنهاء الاختبار وجمع الأوراق
        </button>
      </div>
    </div>
  );
};