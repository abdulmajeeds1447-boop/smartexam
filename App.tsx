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
import { Scanner } from './pages/teacher/Scanner';
import { ExamSession } from './pages/teacher/Session';

const AppContent: React.FC = () => {
  const { userRole } = useApp();
  const [currentPage, setCurrentPage] = useState<string>('dashboard');

  // Reset page when role changes
  useEffect(() => {
    if (userRole === Role.ADMIN) setCurrentPage('dashboard');
    if (userRole === Role.TEACHER) setCurrentPage('scanner');
  }, [userRole]);

  if (!userRole) {
    return <Login />;
  }

  const renderPage = () => {
    if (userRole === Role.ADMIN) {
      switch (currentPage) {
        case 'dashboard': return <AdminDashboard />;
        case 'exams': return <ExamManagement />;
        case 'teachers': return <TeacherManagement />;
        case 'students': return <StudentManagement />;
        case 'reports': return <Reports />;
        default: return <AdminDashboard />;
      }
    } else {
      switch (currentPage) {
        case 'scanner': return <Scanner onScanSuccess={() => setCurrentPage('session')} />;
        case 'session': return <ExamSession />;
        default: return <Scanner onScanSuccess={() => setCurrentPage('session')} />;
      }
    }
  };

  return (
    <Layout onNavigate={setCurrentPage} currentPage={currentPage}>
      {renderPage()}
    </Layout>
  );
};

export default AppContent;