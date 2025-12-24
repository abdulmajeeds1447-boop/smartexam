import React from 'react';
import { useApp } from '../context/AppContext';
import { Role } from '../types';
import { LogOut, LayoutDashboard, QrCode, FileText, Bell, Users, GraduationCap, Printer, HeartHandshake, Settings } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  onNavigate: (page: string) => void;
  currentPage: string;
}

export const Layout: React.FC<LayoutProps> = ({ children, onNavigate, currentPage }) => {
  const { userRole, setUserRole, notifications, currentUser } = useApp();

  const handleLogout = () => {
    setUserRole(null);
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const getRoleLabel = () => {
      switch(userRole) {
          case Role.MANAGER: return 'مدير المدرسة';
          case Role.CONTROL: return 'مسؤول الكنترول';
          case Role.COUNSELOR: return 'المرشد الطلابي';
          case Role.TEACHER: return currentUser?.name || 'معلم';
          default: return 'مدير النظام';
      }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Navigation - Hidden on Print */}
      <header className="bg-white shadow-sm sticky top-0 z-50 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary-600 text-white p-2 rounded-lg">
              <QrCode size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 leading-tight">النظام الذكي</h1>
              <p className="text-xs text-gray-500">إدارة الاختبارات</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button 
                onClick={() => userRole === Role.COUNSELOR ? onNavigate('counselor_dashboard') : onNavigate('reports')}
                className="relative p-2 text-gray-500 hover:text-gray-700 transition-colors"
            >
              <Bell size={24} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 h-3 w-3 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
              )}
            </button>
            <div className="hidden md:flex items-center gap-2">
              <div className="text-right">
                  <div className="text-sm font-bold text-gray-800">{getRoleLabel()}</div>
                  <div className="text-[10px] text-gray-500">{userRole}</div>
              </div>
              <img src={`https://ui-avatars.com/api/?name=${userRole}&background=random`} alt="User" className="h-8 w-8 rounded-full" />
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              title="تسجيل خروج"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col md:flex-row max-w-7xl mx-auto w-full p-4 gap-4 print:p-0 print:w-full print:max-w-none">
        
        {/* Sidebar - Dynamically rendered based on Role */}
        {userRole !== Role.TEACHER && (
          <nav className="hidden md:flex flex-col w-64 bg-white rounded-xl shadow-sm p-4 h-fit sticky top-24 print:hidden shrink-0">
            
            {/* MANAGER MENU */}
            {(userRole === Role.MANAGER || userRole === Role.ADMIN) && (
                 <NavItem 
                    icon={<LayoutDashboard />} 
                    label="لوحة المتابعة" 
                    active={currentPage === 'dashboard'} 
                    onClick={() => onNavigate('dashboard')} 
                />
            )}

            {/* CONTROL MENU */}
            {(userRole === Role.CONTROL || userRole === Role.ADMIN || userRole === Role.MANAGER) && (
                <>
                    <NavItem 
                        icon={<FileText />} 
                        label="إدارة اللجان والمظاريف" 
                        active={currentPage === 'exams'} 
                        onClick={() => onNavigate('exams')} 
                    />
                    <NavItem 
                        icon={<Printer />} 
                        label="التقارير والسجلات" 
                        active={currentPage === 'reports'} 
                        onClick={() => onNavigate('reports')} 
                    />
                </>
            )}

            {/* COUNSELOR MENU */}
            {(userRole === Role.COUNSELOR || userRole === Role.ADMIN) && (
                <>
                    <NavItem 
                        icon={<HeartHandshake />} 
                        label="متابعة الغياب" 
                        active={currentPage === 'counselor_dashboard'} 
                        onClick={() => onNavigate('counselor_dashboard')} 
                    />
                </>
            )}

            {/* SHARED ADMIN/CONTROL SETTINGS */}
            {(userRole === Role.ADMIN || userRole === Role.CONTROL) && (
                <>
                    <div className="my-2 border-t border-gray-100"></div>
                    <NavItem 
                        icon={<Users />} 
                        label="إدارة المعلمين" 
                        active={currentPage === 'teachers'} 
                        onClick={() => onNavigate('teachers')} 
                    />
                    <NavItem 
                        icon={<GraduationCap />} 
                        label="سجل الطلاب العام" 
                        active={currentPage === 'students'} 
                        onClick={() => onNavigate('students')} 
                    />
                </>
            )}

            {/* MANAGER EXTRA */}
            {(userRole === Role.MANAGER) && (
                <NavItem 
                    icon={<Bell />} 
                    label="سجل التنبيهات" 
                    active={currentPage === 'reports'} 
                    onClick={() => onNavigate('reports')} 
                />
            )}

          </nav>
        )}

        <div className="flex-1 min-w-0">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Nav (Teacher only) - Hidden on Print */}
      {userRole === Role.TEACHER && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] p-4 flex justify-around z-40 pb-safe print:hidden">
           <button 
             onClick={() => onNavigate('scanner')}
             className={`flex flex-col items-center gap-1 ${currentPage === 'scanner' ? 'text-primary-600' : 'text-gray-400'}`}
           >
             <QrCode size={24} />
             <span className="text-xs font-medium">مسح QR</span>
           </button>
           <button 
             onClick={() => onNavigate('session')}
             className={`flex flex-col items-center gap-1 ${currentPage === 'session' ? 'text-primary-600' : 'text-gray-400'}`}
           >
             <FileText size={24} />
             <span className="text-xs font-medium">اللجنة الحالية</span>
           </button>
        </div>
      )}
    </div>
  );
};

const NavItem: React.FC<{ icon: React.ReactNode, label: string, active: boolean, onClick: () => void }> = ({ icon, label, active, onClick }) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-3 p-3 rounded-lg w-full transition-all mb-2 ${
      active 
      ? 'bg-primary-50 text-primary-700 font-bold shadow-sm' 
      : 'text-gray-600 hover:bg-gray-50'
    }`}
  >
    {icon}
    <span>{label}</span>
  </button>
);