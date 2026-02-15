import React from 'react';
import { useApp } from '../context/AppContext';
import { Role } from '../types';
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  LogOut, 
  School,
  ClipboardList,
  HeartHandshake,
  QrCode,
  ScanLine
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  onNavigate: (page: string) => void;
  currentPage: string;
}

export const Layout: React.FC<LayoutProps> = ({ children, onNavigate, currentPage }) => {
  const { userRole, setUserRole, currentUser } = useApp();

  // تحديد عناصر القائمة بناءً على الصلاحية
  const getMenuItems = () => {
    const items = [];
    
    // 1. المشرف العام / المدير
    if (userRole === Role.ADMIN || userRole === Role.MANAGER) {
      items.push({ id: 'dashboard', label: 'الرئيسية', icon: LayoutDashboard });
      items.push({ id: 'reports', label: 'التقارير', icon: FileText });
    }

    // 2. الكنترول
    if (userRole === Role.ADMIN || userRole === Role.CONTROL) {
      items.push({ id: 'exams', label: 'اللجان', icon: ClipboardList });
      // في الجوال نختصر القوائم، في الكمبيوتر تظهر كلها
      if (typeof window !== 'undefined' && window.innerWidth > 768) {
          items.push({ id: 'teachers', label: 'المعلمين', icon: Users });
          items.push({ id: 'students', label: 'الطلاب', icon: School });
      }
    }

    // 3. المرشد
    if (userRole === Role.COUNSELOR || userRole === Role.ADMIN) {
        items.push({ id: 'counselor_dashboard', label: 'الغياب', icon: HeartHandshake });
    }

    // 4. المعلم (في حال استخدم التخطيط العام)
    if (userRole === Role.TEACHER) {
        items.push({ id: 'scanner', label: 'مسح', icon: QrCode });
        items.push({ id: 'session', label: 'اللجنة', icon: FileText });
    }

    return items;
  };

  const menuItems = getMenuItems();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      
      {/* 1. Desktop Sidebar (يظهر فقط في الشاشات الكبيرة) */}
      <aside className="hidden md:flex flex-col w-72 bg-slate-900 text-white min-h-screen fixed right-0 top-0 bottom-0 z-50 shadow-2xl">
        <div className="p-8 border-b border-slate-800">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg"><School className="text-white w-6 h-6" /></div>
            النظام الذكي
          </h1>
          <p className="text-sm text-slate-400 mt-4 pr-1">أهلاً، {currentUser?.name || 'المستخدم'}</p>
        </div>
        
        <nav className="flex-1 p-6 space-y-3">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-200 group ${
                currentPage === item.id 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50 translate-x-[-5px]' 
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <item.icon size={22} className={currentPage === item.id ? 'animate-pulse' : ''} />
              <span className="font-bold text-base">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-6 border-t border-slate-800">
          <button 
            onClick={() => setUserRole(null)}
            className="w-full flex items-center gap-3 text-red-400 hover:bg-red-500/10 px-5 py-4 rounded-2xl transition-colors font-bold"
          >
            <LogOut size={20} />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* 2. Main Content Area */}
      <main className="flex-1 md:mr-72 pb-24 md:pb-0 transition-all duration-300">
        
        {/* Mobile Top Bar (عنوان الصفحة في الجوال) */}
        <div className="md:hidden bg-white/80 backdrop-blur-md px-6 py-4 shadow-sm flex justify-between items-center sticky top-0 z-40 border-b border-gray-100">
            <div>
                <h2 className="font-black text-xl text-slate-800">{menuItems.find(i => i.id === currentPage)?.label || 'الرئيسية'}</h2>
                <p className="text-xs text-slate-500 font-medium">{currentUser?.name}</p>
            </div>
            <button onClick={() => setUserRole(null)} className="bg-red-50 p-2 rounded-full text-red-500">
                <LogOut size={18} />
            </button>
        </div>

        {/* Page Content */}
        <div className="p-4 md:p-10 max-w-7xl mx-auto w-full">
            {children}
        </div>
      </main>

      {/* 3. Mobile Bottom Navigation (يظهر فقط في الجوال - لجميع الأدوار) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 pb-safe z-50 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] rounded-t-[1.5rem]">
        <div className="flex justify-around items-center h-20 px-2">
          {menuItems.slice(0, 5).map((item) => {
            const isActive = currentPage === item.id;
            return (
                <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`flex flex-col items-center justify-center w-full h-full space-y-1.5 transition-all duration-300 relative ${
                    isActive ? 'text-blue-600 -translate-y-1' : 'text-gray-400'
                }`}
                >
                <div className={`p-2 rounded-xl transition-all duration-300 ${isActive ? 'bg-blue-50' : 'bg-transparent'}`}>
                    <item.icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span className={`text-[10px] font-bold ${isActive ? 'opacity-100' : 'opacity-70'}`}>{item.label}</span>
                
                {/* Active Indicator Dot */}
                {isActive && <div className="absolute -bottom-1 w-1 h-1 bg-blue-600 rounded-full"></div>}
                </button>
            );
          })}
        </div>
      </div>

    </div>
  );
};
