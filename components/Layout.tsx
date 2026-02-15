import React, { useState } from 'react';
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
  Menu,
  X,
  Grid,
  Settings,
  GraduationCap
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  onNavigate: (page: string) => void;
  currentPage: string;
}

export const Layout: React.FC<LayoutProps> = ({ children, onNavigate, currentPage }) => {
  const { userRole, setUserRole, currentUser } = useApp();
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // --- تعريف القوائم الشاملة (لم يتم حذف أي شيء) ---
  const getMenuItems = () => {
    const items = [];
    
    // 1. المشرف العام / المدير
    if (userRole === Role.ADMIN || userRole === Role.MANAGER) {
      items.push({ id: 'dashboard', label: 'الرئيسية', icon: LayoutDashboard });
      items.push({ id: 'reports', label: 'التقارير', icon: FileText });
    }

    // 2. الكنترول (تمت إعادة القوائم المفقودة)
    if (userRole === Role.ADMIN || userRole === Role.CONTROL) {
      items.push({ id: 'exams', label: 'اللجان', icon: ClipboardList });
      items.push({ id: 'teachers', label: 'المعلمين', icon: Users });
      items.push({ id: 'students', label: 'الطلاب', icon: GraduationCap });
    }

    // 3. المرشد
    if (userRole === Role.COUNSELOR || userRole === Role.ADMIN) {
        items.push({ id: 'counselor_dashboard', label: 'المتابعة', icon: HeartHandshake });
    }

    // 4. المعلم
    if (userRole === Role.TEACHER) {
        items.push({ id: 'scanner', label: 'مسح QR', icon: QrCode });
        items.push({ id: 'session', label: 'اللجنة', icon: FileText });
    }

    return items;
  };

  const menuItems = getMenuItems();

  // --- منطق تقسيم القوائم للجوال ---
  // نأخذ أول 4 عناصر للشريط السفلي، والباقي نضعه في قائمة "المزيد"
  const mainMobileItems = menuItems.slice(0, 4);
  const moreMobileItems = menuItems.slice(4);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row font-sans">
      
      {/* ================= DESKTOP SIDEBAR (للكمبيوتر فقط) ================= */}
      <aside className="hidden md:flex flex-col w-72 bg-slate-900 text-white min-h-screen fixed right-0 top-0 bottom-0 z-50 shadow-2xl transition-all">
        <div className="p-8 border-b border-slate-800">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg"><School className="text-white w-6 h-6" /></div>
            النظام الذكي
          </h1>
          <p className="text-sm text-slate-400 mt-4 pr-1 font-medium">أهلاً، {currentUser?.name || userRole}</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-4 px-5 py-4 rounded-xl transition-all duration-200 group ${
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

      {/* ================= MAIN CONTENT AREA ================= */}
      <main className="flex-1 md:mr-72 pb-24 md:pb-0 transition-all duration-300 min-w-0">
        
        {/* Mobile Top Header (عنوان الصفحة فقط) */}
        <div className="md:hidden bg-white/90 backdrop-blur-md px-5 py-4 shadow-sm flex justify-between items-center sticky top-0 z-40 border-b border-gray-100">
            <div>
                <h2 className="font-black text-lg text-slate-800">{menuItems.find(i => i.id === currentPage)?.label || 'الرئيسية'}</h2>
                <p className="text-[10px] text-slate-500 font-medium mt-0.5">{currentUser?.name || userRole}</p>
            </div>
            <div className="bg-blue-50 p-2 rounded-full border border-blue-100">
                <School size={20} className="text-blue-700" />
            </div>
        </div>

        {/* Page Content Render */}
        <div className="p-4 md:p-8 max-w-7xl mx-auto w-full">
            {children}
        </div>
      </main>

      {/* ================= MOBILE BOTTOM NAVIGATION (للجوال فقط) ================= */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 pb-safe z-50 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] rounded-t-[1.5rem]">
        <div className="flex justify-around items-center h-20 px-2">
          
          {/* عرض أول 4 عناصر رئيسية */}
          {mainMobileItems.map((item) => {
            const isActive = currentPage === item.id;
            return (
                <button
                    key={item.id}
                    onClick={() => { onNavigate(item.id); setShowMobileMenu(false); }}
                    className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-all duration-300 relative ${
                        isActive ? 'text-blue-600 -translate-y-2' : 'text-gray-400 hover:text-gray-600'
                    }`}
                >
                    <div className={`p-2 rounded-xl transition-all duration-300 ${isActive ? 'bg-blue-50 shadow-sm ring-4 ring-white' : 'bg-transparent'}`}>
                        <item.icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                    </div>
                    <span className={`text-[10px] font-bold ${isActive ? 'opacity-100' : 'opacity-80'}`}>{item.label}</span>
                </button>
            );
          })}

          {/* زر "المزيد" يظهر فقط إذا كان هناك عناصر مخفية */}
          {moreMobileItems.length > 0 && (
              <button
                onClick={() => setShowMobileMenu(true)}
                className={`flex flex-col items-center justify-center w-full h-full space-y-1 text-gray-400 hover:text-slate-800 transition-all ${showMobileMenu ? 'text-blue-600 -translate-y-2' : ''}`}
              >
                  <div className={`p-2 rounded-xl ${showMobileMenu ? 'bg-blue-50 ring-4 ring-white' : ''}`}>
                      <Grid size={24} />
                  </div>
                  <span className="text-[10px] font-bold opacity-80">المزيد</span>
              </button>
          )}
        </div>
      </div>

      {/* ================= MOBILE "MORE" MENU (قائمة منبثقة) ================= */}
      {showMobileMenu && (
          <div className="fixed inset-0 z-[60] md:hidden flex items-end justify-center">
              <div 
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity animate-fade-in"
                onClick={() => setShowMobileMenu(false)}
              ></div>

              <div className="bg-white w-full rounded-t-[2rem] p-6 relative z-10 animate-slide-up shadow-2xl max-h-[70vh] overflow-y-auto">
                  <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6"></div>
                  
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-lg font-bold text-slate-800">كل الخدمات</h3>
                      <button onClick={() => setShowMobileMenu(false)} className="bg-gray-100 p-2 rounded-full hover:bg-gray-200 transition"><X size={20}/></button>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-8">
                      {moreMobileItems.map((item) => (
                          <button 
                            key={item.id}
                            onClick={() => { onNavigate(item.id); setShowMobileMenu(false); }}
                            className={`flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all active:scale-95 ${
                                currentPage === item.id ? 'bg-blue-50 border-blue-200 text-blue-600 shadow-sm' : 'bg-gray-50 border-gray-100 text-gray-600'
                            }`}
                          >
                              <item.icon size={28} />
                              <span className="text-xs font-bold text-center">{item.label}</span>
                          </button>
                      ))}
                  </div>

                  <div className="border-t pt-6">
                      <button 
                        onClick={() => { setUserRole(null); setShowMobileMenu(false); }}
                        className="w-full flex items-center justify-center gap-2 text-red-600 bg-red-50 py-4 rounded-2xl font-bold hover:bg-red-100 transition-colors active:scale-95"
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
