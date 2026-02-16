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

  // ✅ محول البيانات الذكي لمركز الطباعة (تم تحديثه لحساب الأعداد)
  const getPrintData = () => {
      // 1. تحويل الطلاب ليتوافقوا مع الهيكل القديم
      const mappedStudents = students.map(s => ({
          ...s,
          studentId: s.id,        
          class: s.className,     
          phone: s.parentPhone    
      }));

      // 2. استنتاج اللجان وحساب أعداد الطلاب فيها (الحل لمشكلة الأصفار)
      const uniqueCommittees = Array.from(new Set(
          [...exams.map(e => e.committeeNumber), ...students.map(s => s.committeeNumber)]
          .filter(Boolean)
      ));

      const committeesData = uniqueCommittees.map((num, idx) => {
          // حساب عدد الطلاب في هذه اللجنة لكل مرحلة
          const committeeStudents = students.filter(s => s.committeeNumber === num);
          
          // 1=أول، 2=ثاني، 3=ثالث (حسب معرفات المراحل في الأسفل)
          const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0 }; 

          committeeStudents.forEach(s => {
              if (s.grade.includes('أول') || s.grade.includes('1')) counts[1]++;
              else if (s.grade.includes('ثاني') || s.grade.includes('2')) counts[2]++;
              else if (s.grade.includes('ثالث') || s.grade.includes('3')) counts[3]++;
          });

          return {
              id: idx + 1,
              name: String(num),
              location: exams.find(e => e.committeeNumber === num)?.location || '',
              counts: counts, // ✅ الآن تحتوي على الأرقام الفعلية
              invigilatorCount: 1
          };
      });

      // 3. هيكل المراحل
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
