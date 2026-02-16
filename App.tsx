import React, { useState, useEffect } from 'react';
import { useApp } from './context/AppContext';
import { Role } from './types';
import { Login } from './pages/Login';
import { Layout } from './components/Layout';
import { AdminDashboard } from './pages/admin/Dashboard';
import { ExamManagement } from './pages/admin/ExamManagement';
import { TeacherManagement } from './pages/admin/TeacherManagement';
import { StudentManagement } from './pages/admin/StudentManagement';
import { Reports } from './pages/admin/Reports';
import { CounselorDashboard } from './pages/counselor/CounselorDashboard';
import { TeacherDashboard } from './pages/teacher/TeacherDashboard';
import PrintCenter from './components/PrintCenter';
import { AttendanceStatus } from './types';

const AppContent: React.FC = () => {
  const { userRole, exams, students, teachers } = useApp();
  const [currentPage, setCurrentPage] = useState<string>('dashboard');

  useEffect(() => {
    if (userRole === Role.MANAGER || userRole === Role.ADMIN) setCurrentPage('dashboard');
    if (userRole === Role.CONTROL) setCurrentPage('exams');
    if (userRole === Role.COUNSELOR) setCurrentPage('counselor_dashboard');
  }, [userRole]);

  // 🔥 المحرك الذكي الجديد لبيانات الطباعة (The Revolution)
  const getPrintData = () => {
      // 1. تحويل الطلاب
      const mappedStudents = students.map(s => ({
          ...s,
          studentId: s.id,        
          class: s.className,     
          phone: s.parentPhone    
      }));

      // 2. استنتاج اللجان مع الحسابات الدقيقة (المسجلين - الغياب)
      const uniqueCommittees = Array.from(new Set(
          [...exams.map(e => e.committeeNumber), ...students.map(s => s.committeeNumber)]
          .filter(Boolean)
      )).sort((a, b) => parseInt(a) - parseInt(b)); // فرز رقمي

      const committeesData = uniqueCommittees.map((num, idx) => {
          // جلب جميع اختبارات هذه اللجنة لليوم (أو بشكل عام)
          const committeeExams = exams.filter(e => e.committeeNumber === num);
          
          // حساب الإجماليات لهذه اللجنة
          let totalRegistered = 0;
          let totalAbsent = 0;
          const subjectsSet = new Set<string>();
          const teacherNamesSet = new Set<string>();

          committeeExams.forEach(exam => {
              totalRegistered += exam.students.length;
              
              // حساب الغياب الفعلي من سجل الحضور
              const absentCount = exam.attendance.filter(a => a.status === AttendanceStatus.ABSENT).length;
              totalAbsent += absentCount;

              // جمع المواد (مع التنظيف)
              if (exam.subject) subjectsSet.add(exam.subject.trim());

              // ✅ حل مشكلة رقم الجوال: البحث عن اسم المعلم في قائمة teachers
              if (exam.teacherId) {
                  const teacherObj = teachers.find(t => t.id === exam.teacherId || t.phone === exam.teacherId);
                  if (teacherObj) teacherNamesSet.add(teacherObj.name);
                  else teacherNamesSet.add(exam.teacherId); // احتياط لو لم يوجد
              }
          });

          // إذا لم نجد اختبارات (حالة نادرة)، نحسب الطلاب المسكنين فقط
          if (committeeExams.length === 0) {
             const staticStudents = students.filter(s => s.committeeNumber === num);
             totalRegistered = staticStudents.length;
          }

          const activeCount = totalRegistered - totalAbsent;

          return {
              id: parseInt(num),
              name: String(num),
              location: exams.find(e => e.committeeNumber === num)?.location || '',
              
              // بيانات إحصائية دقيقة للطباعة
              stats: {
                  total: totalRegistered,
                  absent: totalAbsent,
                  present: activeCount,
                  subjects: Array.from(subjectsSet).join(' + '),
                  teachers: Array.from(teacherNamesSet).join(' / ') // أسماء المعلمين بدلاً من أرقامهم
              },
              
              counts: {}, // (متروك للتوافق القديم)
              invigilatorCount: 1
          };
      });

      // 3. هيكل المراحل
      const stagesData = [
          { id: 1, name: 'أول ثانوي', prefix: '1', total: 0, students: mappedStudents.filter((s: any) => s.grade.includes('أول') || s.grade.includes('1')) },
          { id: 2, name: 'ثاني ثانوي', prefix: '2', total: 0, students: mappedStudents.filter((s: any) => s.grade.includes('ثاني') || s.grade.includes('2')) },
          { id: 3, name: 'ثالث ثانوي', prefix: '3', total: 0, students: mappedStudents.filter((s: any) => s.grade.includes('ثالث') || s.grade.includes('3')) },
      ];

      return {
          school: { name: 'المدرسة الثانوية', year: '1447', term: 'الثاني', managerName: '', agentName: '' },
          stages: stagesData,
          committees: committeesData, // القائمة المعززة بالبيانات
          teachers: teachers,
          schedule: undefined,
          rawExams: exams 
      };
  };

  if (!userRole) return <Login />;
  if (userRole === Role.TEACHER) return <TeacherDashboard />;

  const renderPage = () => {
    switch (currentPage) {
        case 'dashboard': return <AdminDashboard />;
        case 'print': return <PrintCenter data={getPrintData() as any} onUpdateSchool={() => {}} />;
        case 'exams': return <ExamManagement />;
        case 'teachers': return <TeacherManagement />;
        case 'students': return <StudentManagement />;
        case 'reports': return <Reports />;
        case 'counselor_dashboard': return <CounselorDashboard />;
        default: return <ExamManagement />;
    }
  };

  return (
    <Layout onNavigate={setCurrentPage} currentPage={currentPage}>
      {renderPage()}
    </Layout>
  );
};

export default AppContent;
