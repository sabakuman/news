import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { cn } from '../lib/utils';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { user, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const navItems = [
    { name: 'لوحة التحكم', path: '/', icon: 'dashboard', roles: ['admin', 'editor', 'reviewer', 'sector_approver', 'final_approver', 'viewer'] },
    { name: 'الأخبار والمقالات', path: '/news', icon: 'newspaper', roles: ['admin', 'editor', 'reviewer', 'sector_approver', 'final_approver', 'viewer'] },
    { name: 'الأرشيف', path: '/archive', icon: 'archive', roles: ['admin', 'editor', 'reviewer', 'sector_approver', 'final_approver', 'viewer'] },
    { name: 'البحث والتقارير', path: '/reports', icon: 'search', roles: ['admin', 'editor', 'reviewer', 'sector_approver', 'final_approver', 'viewer'] },
  ];

  const adminItems = [
    { name: 'إدارة المستخدمين', path: '/admin/users', icon: 'group', roles: ['admin'] },
    { name: 'إعدادات النظام', path: '/admin/settings', icon: 'settings', roles: ['admin'] },
  ];

  const filteredNavItems = navItems.filter(item => item.roles.includes(user?.role || ''));
  const filteredAdminItems = adminItems.filter(item => item.roles.includes(user?.role || ''));

  return (
    <div className="min-h-screen flex bg-surface text-on-surface font-sans" dir="rtl">
      {/* Sidebar */}
      <aside 
        dir="rtl"
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-72 bg-surface-container-low border-l border-outline-variant transition-all duration-300 ease-in-out transform lg:translate-x-0 lg:static lg:inset-0",
          !isSidebarOpen && "translate-x-full lg:w-20"
        )}
      >
        <div className="h-full flex flex-col p-4">
          {/* Logo Area */}
          <div className="h-20 flex flex-row items-center justify-between px-4 mb-8">
            <div className={cn("flex flex-row items-center gap-4 overflow-hidden", !isSidebarOpen && "lg:hidden")}>
              <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center text-on-primary shadow-lg shadow-primary/20">
                <span className="material-symbols-rounded text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>newspaper</span>
              </div>
              <div className="flex flex-col text-right">
                <span className="font-extrabold text-xl text-primary leading-tight">مركز الأخبار</span>
                <span className="text-[10px] uppercase tracking-[0.2em] text-on-surface-variant font-bold">المنصة الإعلامية</span>
              </div>
            </div>
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded-full hover:bg-surface-container-high text-on-surface-variant lg:hidden"
            >
              <span className="material-symbols-rounded">close</span>
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-2 px-2">
            {filteredNavItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-row items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-200 group relative overflow-hidden",
                  location.pathname === item.path 
                    ? "bg-primary-container text-on-primary-container font-bold shadow-sm" 
                    : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                )}
              >
                <span className={cn(
                  "material-symbols-rounded text-2xl transition-all shrink-0",
                  location.pathname === item.path ? "scale-110" : "group-hover:scale-110"
                )} style={{ fontVariationSettings: location.pathname === item.path ? "'FILL' 1" : "'FILL' 0" }}>
                  {item.icon}
                </span>
                <span className={cn("text-base transition-opacity duration-300 text-right", !isSidebarOpen && "lg:hidden")}>{item.name}</span>
                {location.pathname === item.path && (
                  <div className="absolute right-0 top-1/4 bottom-1/4 w-1 bg-primary rounded-l-full"></div>
                )}
              </Link>
            ))}

            {isAdmin && (
              <>
                <div className={cn("pt-8 pb-2 px-6 text-[10px] font-black text-outline uppercase tracking-[0.2em] text-right", !isSidebarOpen && "lg:hidden")}>
                  الإدارة والتحكم
                </div>
                {filteredAdminItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      "flex flex-row items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-200 group relative overflow-hidden",
                      location.pathname === item.path 
                        ? "bg-primary-container text-on-primary-container font-bold shadow-sm" 
                        : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                    )}
                  >
                    <span className={cn(
                      "material-symbols-rounded text-2xl transition-all shrink-0",
                      location.pathname === item.path ? "scale-110" : "group-hover:scale-110"
                    )} style={{ fontVariationSettings: location.pathname === item.path ? "'FILL' 1" : "'FILL' 0" }}>
                      {item.icon}
                    </span>
                    <span className={cn("text-base transition-opacity duration-300 text-right", !isSidebarOpen && "lg:hidden")}>{item.name}</span>
                  </Link>
                ))}
              </>
            )}
          </nav>

          {/* Bottom Profile Area */}
          <div className="mt-auto pt-6 border-t border-outline-variant/30 px-2">
            <div className={cn("bg-surface-container rounded-3xl p-4 mb-4 flex flex-row items-center gap-4", !isSidebarOpen && "lg:hidden")}>
              <div className="w-12 h-12 rounded-2xl bg-secondary-container flex items-center justify-center text-on-secondary-container font-black text-xl shadow-inner shrink-0">
                {user?.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0 text-right">
                <p className="text-sm font-bold text-on-surface truncate">{user?.name}</p>
                <p className="text-[10px] font-bold text-primary uppercase tracking-wider">
                  {user?.role === 'admin' ? 'مسؤول النظام' : 
                   user?.role === 'editor' ? 'محرر أخبار' : 
                   user?.role === 'reviewer' ? 'مراجع' : 
                   user?.role === 'sector_approver' ? 'معتمد قطاع' : 
                   user?.role === 'final_approver' ? 'معتمد نهائي' : 'مشاهد'}
                </p>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className={cn(
                "w-full flex flex-row items-center gap-4 px-4 py-4 rounded-2xl text-error font-bold hover:bg-error/10 transition-all active:scale-95",
                !isSidebarOpen && "lg:justify-center lg:px-0"
              )}
            >
              <span className="material-symbols-rounded shrink-0">logout</span>
              <span className={cn("text-base text-right", !isSidebarOpen && "lg:hidden")}>تسجيل الخروج</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative" dir="rtl">
        {/* Top Header Bar */}
        <header className="h-20 bg-surface/80 backdrop-blur-xl border-b border-outline-variant/30 flex flex-row items-center justify-between px-6 lg:px-12 z-40 sticky top-0">
          <div className="flex flex-row items-center gap-6">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors"
            >
              <span className="material-symbols-rounded text-2xl">
                {isSidebarOpen ? 'menu_open' : 'menu'}
              </span>
            </button>
            <div className="h-6 w-px bg-outline-variant/50 hidden md:block"></div>
            <h2 className="text-xl font-extrabold text-on-surface hidden sm:block tracking-tight text-right">
              {location.pathname === '/' ? 'لوحة التحكم الرئيسية' : 
               location.pathname === '/news' ? 'مركز الأخبار والمقالات' : 
               location.pathname.startsWith('/news/') ? 'تفاصيل الخبر' : 
               location.pathname === '/archive' ? 'الأرشيف الإعلامي' : 
               location.pathname === '/reports' ? 'التقارير والتحليلات' : 
               location.pathname.startsWith('/admin') ? 'إدارة النظام' : 'مركز الأخبار'}
            </h2>
          </div>

          <div className="flex flex-row items-center gap-4">
            <div className="hidden md:flex bg-surface-container-high rounded-full px-4 py-2 flex-row items-center gap-3 border border-outline-variant/30">
              <span className="material-symbols-rounded text-on-surface-variant text-xl shrink-0">search</span>
              <input type="text" placeholder="بحث سريع..." className="bg-transparent border-none outline-none text-sm w-40 text-on-surface text-right" />
            </div>
            
            <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant relative transition-colors">
              <span className="material-symbols-rounded">notifications</span>
              <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-error rounded-full border-2 border-surface"></span>
            </button>
            
            <div className="h-8 w-px bg-outline-variant/30 mx-2"></div>
            
            <div className="flex flex-row items-center gap-3 pl-2">
              <div className="text-right hidden md:block">
                <p className="text-xs font-black text-on-surface leading-none mb-1">{user?.name}</p>
                <p className="text-[10px] text-on-surface-variant font-medium">{user?.email}</p>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center text-on-primary text-sm font-black shadow-lg shadow-primary/20 shrink-0">
                {user?.name.charAt(0)}
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-12 bg-surface">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
