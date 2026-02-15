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
// استيراد لوحة تحكم المعلم الجديدة
import { TeacherDashboard } from './pages/teacher/TeacherDashboard';

const AppContent: React.FC = () => {
  const { userRole } = useApp();
  const [currentPage, setCurrentPage] = useState<string>('dashboard');

  // إعادة توجيه الصفحة الافتراضية حسب الدور
  useEffect(() => {
    if (userRole === Role.MANAGER || userRole === Role.ADMIN) setCurrentPage('dashboard');
    if (userRole === Role.CONTROL) setCurrentPage('exams');
    if (userRole === Role.COUNSELOR) setCurrentPage('counselor_dashboard');
    // المعلم لا يحتاج لتحديد صفحة هنا لأنه يملك واجهة واحدة ذكية
  }, [userRole]);

  // 1. حالة عدم تسجيل الدخول
  if (!userRole) {
    return <Login />;
  }

  // 2. حالة المعلم (تطبيق خاص مستقل عن التخطيط الإداري)
  // هذا يضمن ظهور واجهة الموبايل (الماسح والقوائم) بملء الشاشة بدون Sidebar
  if (userRole === Role.TEACHER) {
      return <TeacherDashboard />;
  }

  // 3. باقي الأدوار الإدارية (داخل التخطيط القياسي Layout)
  const renderAdminPage = () => {
    // MANAGER VIEW
    if (userRole === Role.MANAGER) {
         switch (currentPage) {
             case 'dashboard': return <AdminDashboard />;
             case 'reports': return <Reports />;
             default: return <AdminDashboard />;
         }
    }

    // CONTROL VIEW
    if (userRole === Role.CONTROL) {
        switch (currentPage) {
            case 'exams': return <ExamManagement />;
            case 'teachers': return <TeacherManagement />;
            case 'students': return <StudentManagement />;
            case 'reports': return <Reports />;
            default: return <ExamManagement />;
        }
    }

    // COUNSELOR VIEW
    if (userRole === Role.COUNSELOR) {
        switch (currentPage) {
            case 'counselor_dashboard': return <CounselorDashboard />;
            default: return <CounselorDashboard />;
        }
    }

    // ADMIN (SUPER) VIEW
    if (userRole === Role.ADMIN) {
      switch (currentPage) {
        case 'dashboard': return <AdminDashboard />;
        case 'exams': return <ExamManagement />;
        case 'teachers': return <TeacherManagement />;
        case 'students': return <StudentManagement />;
        case 'reports': return <Reports />;
        case 'counselor_dashboard': return <CounselorDashboard />;
        default: return <AdminDashboard />;
      }
    }
    
    return <AdminDashboard />;
  };

  return (
    <Layout onNavigate={setCurrentPage} currentPage={currentPage}>
      {renderAdminPage()}
    </Layout>
  );
};

export default AppContent;
