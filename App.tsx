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
import PrintCenter from './components/PrintCenter'; // تأكد أن المسار صحيح

const AppContent: React.FC = () => {
  const { userRole, exams, students, teachers } = useApp();
  const [currentPage, setCurrentPage] = useState<string>('dashboard');

  // إعادة توجيه الصفحة الافتراضية حسب الدور
  useEffect(() => {
    if (userRole === Role.MANAGER || userRole === Role.ADMIN) setCurrentPage('dashboard');
    if (userRole === Role.CONTROL) setCurrentPage('exams');
    if (userRole === Role.COUNSELOR) setCurrentPage('counselor_dashboard');
  }, [userRole]);

  // --- المحول الذكي (The Adapter) ---
  // يقوم بتحويل البيانات الحية من Firebase إلى تنسيق يفهمه مركز الطباعة
  const getPrintData = () => {
      // استنتاج اللجان من المظاريف والطلاب
      const uniqueCommittees = Array.from(new Set(
          [...exams.map(e => e.committeeNumber), ...students.map(s => s.committeeNumber)]
          .filter(Boolean)
      ));

      const committeesData = uniqueCommittees.map((num, idx) => ({
          id: idx + 1,
          name: String(num),
          location: exams.find(e => e.committeeNumber === num)?.location || '',
          counts: {}, // لا يهم للأغراض الطباعية الحالية
          invigilatorCount: 1
      }));

      // محاكاة المراحل (لأغراض الطباعة)
      const stagesData = [
          { id: 1, name: 'أول ثانوي', prefix: '1', total: 0, students: students.filter(s => s.grade.includes('أول') || s.grade.includes('1')) },
          { id: 2, name: 'ثاني ثانوي', prefix: '2', total: 0, students: students.filter(s => s.grade.includes('ثاني') || s.grade.includes('2')) },
          { id: 3, name: 'ثالث ثانوي', prefix: '3', total: 0, students: students.filter(s => s.grade.includes('ثالث') || s.grade.includes('3')) },
      ];

      return {
          school: { name: 'المدرسة الثانوية', year: '1447', term: 'الثاني', managerName: '', agentName: '' },
          stages: stagesData,
          committees: committeesData,
          teachers: teachers,
          schedule: undefined // يمكن إضافته لاحقاً إذا لزم الأمر
      };
  };

  if (!userRole) return <Login />;
  if (userRole === Role.TEACHER) return <TeacherDashboard />;

  const renderPage = () => {
    const commonProps = {
        // أي خصائص مشتركة
    };

    switch (currentPage) {
        case 'dashboard': return <AdminDashboard />;
        
        // هنا تم إضافة صفحة الطباعة مع تمرير البيانات المحولة
        case 'print': return <PrintCenter data={getPrintData()} onUpdateSchool={() => {}} />;
        
        case 'exams': return <ExamManagement />;
        case 'teachers': return <TeacherManagement />;
        case 'students': return <StudentManagement />;
        case 'reports': return <Reports />;
        case 'counselor_dashboard': return <CounselorDashboard />;
        default: return <ExamManagement />; // صفحة افتراضية للكنترول
    }
  };

  return (
    <Layout onNavigate={setCurrentPage} currentPage={currentPage}>
      {renderPage()}
    </Layout>
  );
};

export default AppContent;
