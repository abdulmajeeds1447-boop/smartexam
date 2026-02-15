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

const AppContent: React.FC = () => {
  const { userRole, exams, students, teachers } = useApp();
  const [currentPage, setCurrentPage] = useState<string>('dashboard');

  useEffect(() => {
    if (userRole === Role.MANAGER || userRole === Role.ADMIN) setCurrentPage('dashboard');
    if (userRole === Role.CONTROL) setCurrentPage('exams');
    if (userRole === Role.COUNSELOR) setCurrentPage('counselor_dashboard');
  }, [userRole]);

  // ✅ تصحيح: محول البيانات لتفادي أخطاء TypeScript عند البناء
  const getPrintData = () => {
      // 1. تحويل الطلاب ليتوافقوا مع مركز الطباعة (System 1 Format)
      const mappedStudents = students.map(s => ({
          ...s,
          studentId: s.id,        // تحويل id -> studentId
          class: s.className,     // تحويل className -> class
          phone: s.parentPhone    // تحويل parentPhone -> phone
      }));

      // 2. استنتاج اللجان
      const uniqueCommittees = Array.from(new Set(
          [...exams.map(e => e.committeeNumber), ...students.map(s => s.committeeNumber)]
          .filter(Boolean)
      ));

      const committeesData = uniqueCommittees.map((num, idx) => ({
          id: idx + 1,
          name: String(num),
          location: exams.find(e => e.committeeNumber === num)?.location || '',
          counts: {}, 
          invigilatorCount: 1
      }));

      // 3. بناء المراحل
      const stagesData = [
          { 
              id: 1, name: 'أول ثانوي', prefix: '1', total: 0, 
              students: mappedStudents.filter((s: any) => s.grade.includes('أول') || s.grade.includes('1')) 
          },
          { 
              id: 2, name: 'ثاني ثانوي', prefix: '2', total: 0, 
              students: mappedStudents.filter((s: any) => s.grade.includes('ثاني') || s.grade.includes('2')) 
          },
          { 
              id: 3, name: 'ثالث ثانوي', prefix: '3', total: 0, 
              students: mappedStudents.filter((s: any) => s.grade.includes('ثالث') || s.grade.includes('3')) 
          },
      ];

      return {
          school: { name: 'المدرسة الثانوية', year: '1447', term: 'الثاني', managerName: '', agentName: '' },
          stages: stagesData,
          committees: committeesData,
          teachers: teachers,
          schedule: undefined 
      };
  };

  if (!userRole) return <Login />;
  if (userRole === Role.TEACHER) return <TeacherDashboard />;

  const renderPage = () => {
    switch (currentPage) {
        case 'dashboard': return <AdminDashboard />;
        // ✅ تمرير البيانات المصححة لمركز الطباعة
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
