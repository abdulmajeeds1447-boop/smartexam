import React, { useState, useEffect } from 'react';
import { useApp } from './context/AppContext';
import { Role, AttendanceStatus } from './types';
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

  // ✅ الوظيفة الإبداعية: محول البيانات الذكي (Data Adapter)
  const getPrintData = () => {
      // 1. تحويل الطلاب ليتوافقوا مع مركز الطباعة
      const mappedStudents = students.map(s => ({
          ...s,
          studentId: s.id,        
          class: s.className,     
          phone: s.parentPhone    
      }));

      // 2. استنتاج اللجان وحساب إحصائياتها الحية (Live Stats)
      const uniqueCommittees = Array.from(new Set(
          [...exams.map(e => e.committeeNumber), ...students.map(s => s.committeeNumber)]
          .filter(Boolean)
      )).sort((a, b) => parseInt(a) - parseInt(b)); // ترتيب رقمي (1، 2، 3...)

      const committeesData = uniqueCommittees.map((num, idx) => {
          const committeeExams = exams.filter(e => e.committeeNumber === num);
          
          // حساب الإجماليات لهذه اللجنة من البيانات الحية
          let totalRegistered = 0;
          let totalAbsent = 0;
          const subjectsSet = new Set<string>();
          const teacherNamesSet = new Set<string>();

          committeeExams.forEach(exam => {
              totalRegistered += exam.students.length;
              const absentCount = exam.attendance.filter(a => a.status === AttendanceStatus.ABSENT).length;
              totalAbsent += absentCount;

              if (exam.subject) subjectsSet.add(exam.subject.trim());

              // البحث عن اسم المعلم بدلاً من الرقم
              if (exam.teacherId) {
                  const teacherObj = teachers.find(t => t.id === exam.teacherId || t.phone === exam.teacherId);
                  if (teacherObj) teacherNamesSet.add(teacherObj.name);
                  else teacherNamesSet.add(exam.teacherId);
              }
          });

          // في حال لم تبدأ اختبارات بعد، نستخدم الطلاب المسكنين كمرجع
          if (committeeExams.length === 0) {
             const staticStudents = students.filter(s => s.committeeNumber === num);
             totalRegistered = staticStudents.length;
          }

          const activeCount = totalRegistered - totalAbsent;

          return {
              id: parseInt(num),
              name: String(num),
              location: exams.find(e => e.committeeNumber === num)?.location || '',
              
              // كائن الإحصائيات الذكي
              stats: {
                  total: totalRegistered,
                  absent: totalAbsent,
                  present: activeCount,
                  subjects: Array.from(subjectsSet).join(' + '),
                  teachers: Array.from(teacherNamesSet).join(' / ')
              },
              
              counts: {}, // (للتوافق القديم)
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
          rawExams: exams // ✅ هام جداً: تمرير البيانات الخام للطباعة التفصيلية
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
