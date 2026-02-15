import React, { useState, useEffect } from 'react';
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
  X,
  Grid,
  GraduationCap,
  Printer,
  Bell,
  UserCircle
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  onNavigate: (page: string) => void;
  currentPage: string;
}

// ✅ التصحيح: يجب أن يبدأ اسم المكون بحرف كبير (PascalCase)
const ItemIconForHeader = ({ id, items }: { id: string, items: any[] }) => {
    const item = items.find(i => i.id === id);
    if (!item) return <School size={20} className="text-blue-600" />;
    const Icon = item.icon;
    return <Icon size={20} className="text-blue-600" />;
};

export const Layout: React.FC<LayoutProps> = ({ children, onNavigate, currentPage }) => {
  const { userRole, setUserRole, currentUser, notifications } = useApp();
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const count = notifications.filter(n => !n.read).length;
    setUnreadCount(count);
  }, [notifications]);

  const getMenuItems = () => {
    const items = [];
    
    // القوائم حسب الصلاحيات
    if (userRole !== Role.TEACHER) {
        items.push({ id: 'dashboard', label: 'الرئيسية', icon: LayoutDashboard });
    }
    if (userRole === Role.ADMIN || userRole === Role.MANAGER) {
      items.push({ id: 'reports', label: 'التقارير', icon: FileText });
    }
    if (userRole === Role.ADMIN || userRole === Role.CONTROL) {
      items.push({ id: 'exams', label: 'الكنترول', icon: ClipboardList });
      items.push({ id: 'print', label: 'الطباعة', icon: Printer });
      items.push({ id: 'teachers', label: 'المعلمين', icon: Users });
      items.push({ id: 'students', label: 'الطلاب', icon: GraduationCap });
    }
    if (userRole === Role.COUNSELOR || userRole === Role.ADMIN) {
        items.push({ id: 'counselor_dashboard', label: 'المتابعة', icon: HeartHandshake });
    }
    if (userRole === Role.TEACHER) {
        items.push({ id: 'scanner', label: 'مسح QR', icon: QrCode });
        items.push({ id: 'session', label: 'اللجنة', icon: FileText });
    }
    return items;
  };

  const menuItems = getMenuItems();
  const mainMobileItems = menuItems.slice(0, 4);
  const moreMobileItems = menuItems.slice(4);
  const currentPageLabel = menuItems.find(i => i.id === currentPage)?.label || 'النظام الذكي';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row font-sans text-right" dir="rtl">
      
      {/* 1. DESKTOP SIDEBAR */}
      <aside className="hidden md:flex flex-col w-72 bg-slate-900 text-white min-h-screen fixed right-0 top-0 bottom-0 z-50 shadow-2xl transition-all duration-300 border-l border-slate-800">
        <div className="p-8 border-b border-slate-800/50 flex items-center gap-3">
          <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-2.5 rounded-xl shadow-lg shadow-blue-900/20">
            <School className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-wide">النظام الذكي</h1>
            <p className="text-[10px] text-slate-400 font-medium opacity-80">الإصدار الاحترافي 3.0</p>
          </div>
        </div>

        <div className="px-6 pt-6 pb-2">
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 flex items-center gap-3">
                <div className="bg-slate-700 p-2 rounded-full">
                    <UserCircle size={20} className="text-slate-300" />
                </div>
                <div className="overflow-hidden">
                    <p className="text-sm font-bold text-white truncate">{currentUser?.name || 'المستخدم'}</p>
                    <p className="text-[10px] text-blue-400 font-bold uppercase">{userRole}</p>
                </div>
            </div>
        </div>
        
        <nav className="flex-1 px-4 py-4 space-y-1.5 overflow-y-auto custom-scrollbar">
          {menuItems.map((item) => {
            const isActive = currentPage === item.id;
            return (
                <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl transition-all duration-200 group relative overflow-hidden ${
                    isActive 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20 translate-x-[-4px]' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
                >
                <div className="flex items-center gap-3 relative z-10">
                    <item.icon size={20} className={`transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                    <span className="font-bold text-sm">{item.label}</span>
                </div>
                {isActive && <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></div>}
                </button>
            );
          })}
        </nav>

        <div className="p-6 border-t border-slate-800/50 bg-slate-900/50 backdrop-blur-sm">
          <button 
            onClick={() => setUserRole(null)}
            className="w-full flex items-center justify-center gap-2 text-red-400 bg-red-500/10 hover:bg-red-500 hover:text-white px-5 py-3 rounded-xl transition-all duration-200 font-bold group"
          >
            <LogOut size={18} className="group-hover:-translate-x-1 transition-transform" />
            <span>خروج</span>
          </button>
        </div>
      </aside>

      {/* 2. MAIN CONTENT */}
      <main className="flex-1 md:mr-72 pb-28 md:pb-0 transition-all duration-300 min-w-0 flex flex-col min-h-screen">
        <header className="md:hidden bg-white/90 backdrop-blur-xl px-5 py-4 shadow-sm flex justify-between items-center sticky top-0 z-40 border-b border-gray-100 transition-all">
            <div className="flex items-center gap-3">
                <div className="bg-slate-50 p-2 rounded-full border border-slate-100">
                    {/* ✅ استخدام المكون المصحح */}
                    <ItemIconForHeader id={currentPage} items={menuItems} />
                </div>
                <div>
                    <h2 className="font-black text-lg text-slate-800 leading-tight">{currentPageLabel}</h2>
                    <p className="text-[10px] text-slate-500 font-bold mt-0.5">{currentUser?.name}</p>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <button className="relative p-2 text-slate-400 hover:text-slate-600 transition-colors">
                    <Bell size={20} />
                    {unreadCount > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>}
                </button>
            </div>
        </header>

        <div className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full animate-fade-in">
            {children}
        </div>
      </main>

      {/* 3. MOBILE NAV */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 pb-safe z-50 shadow-[0_-8px_30px_rgba(0,0,0,0.04)] rounded-t-[1.5rem]">
        <div className="flex justify-around items-center h-20 px-2 relative">
          {mainMobileItems.map((item) => {
            const isActive = currentPage === item.id;
            return (
                <button
                    key={item.id}
                    onClick={() => { onNavigate(item.id); setShowMobileMenu(false); }}
                    className={`flex flex-col items-center justify-center w-full h-full space-y-1.5 transition-all duration-300 relative group ${
                        isActive ? 'text-blue-600 -translate-y-2' : 'text-gray-400'
                    }`}
                >
                    <div className={`p-2.5 rounded-2xl transition-all duration-300 ${isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 ring-4 ring-white' : 'bg-transparent group-hover:bg-gray-50'}`}>
                        <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                    </div>
                    <span className={`text-[10px] font-bold transition-opacity ${isActive ? 'opacity-100 text-blue-700' : 'opacity-70'}`}>{item.label}</span>
                </button>
            );
          })}
          {moreMobileItems.length > 0 && (
              <button
                onClick={() => setShowMobileMenu(true)}
                className={`flex flex-col items-center justify-center w-full h-full space-y-1.5 text-gray-400 hover:text-slate-800 transition-all ${showMobileMenu ? 'text-blue-600 -translate-y-2' : ''}`}
              >
                  <div className={`p-2.5 rounded-2xl transition-all duration-300 ${showMobileMenu ? 'bg-slate-800 text-white shadow-lg ring-4 ring-white' : 'bg-transparent'}`}>
                      <Grid size={22} />
                  </div>
                  <span className="text-[10px] font-bold opacity-80">المزيد</span>
              </button>
          )}
        </div>
      </div>

      {/* 4. MOBILE DRAWER */}
      {showMobileMenu && (
          <div className="fixed inset-0 z-[60] md:hidden flex items-end justify-center">
              <div 
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity animate-fade-in"
                onClick={() => setShowMobileMenu(false)}
              ></div>
              <div className="bg-white w-full rounded-t-[2.5rem] p-6 relative z-10 animate-slide-up shadow-2xl max-h-[75vh] overflow-y-auto flex flex-col">
                  <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-8"></div>
                  <div className="flex justify-between items-center mb-8">
                      <div>
                          <h3 className="text-xl font-black text-slate-800">قائمة الخدمات</h3>
                          <p className="text-xs text-gray-400 font-medium">اختر القسم للانتقال السريع</p>
                      </div>
                      <button onClick={() => setShowMobileMenu(false)} className="bg-gray-100 p-2.5 rounded-full hover:bg-gray-200 transition text-gray-600"><X size={20}/></button>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mb-8 flex-1">
                      {moreMobileItems.map((item) => (
                          <button 
                            key={item.id}
                            onClick={() => { onNavigate(item.id); setShowMobileMenu(false); }}
                            className={`flex items-center gap-4 p-4 rounded-2xl border transition-all active:scale-95 text-right ${
                                currentPage === item.id 
                                ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm' 
                                : 'bg-white border-gray-100 text-gray-600 hover:border-gray-300'
                            }`}
                          >
                              <div className={`p-3 rounded-xl ${currentPage === item.id ? 'bg-blue-200 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                                  <item.icon size={24} />
                              </div>
                              <span className="text-sm font-bold">{item.label}</span>
                          </button>
                      ))}
                  </div>
                  <div className="border-t border-gray-100 pt-6 mt-auto">
                      <button 
                        onClick={() => { setUserRole(null); setShowMobileMenu(false); }}
                        className="w-full flex items-center justify-center gap-3 text-red-600 bg-red-50 py-4 rounded-2xl font-bold hover:bg-red-100 transition-colors active:scale-95"
                      >
                          <LogOut size={20} />
                          تسجيل الخروج
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
