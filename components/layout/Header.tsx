
import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAppContext } from '../../contexts/AppContext';
import { UserRole } from '../../types';
import { APP_NAME } from '../../constants'; 
import { Select } from '../ui/Select'; 
import { HomeIcon, PackageIcon, UsersIcon, ShoppingBagIcon, BarChart2Icon, SettingsIcon, BellIcon, SunIcon, MoonIcon, MenuIcon, XIcon, SparklesIcon, TrendingUpIcon, LogOutIcon, LogInIcon, UserCircleIcon, UserCogIcon, BuildingIcon } from 'lucide-react';
import { Button } from '../ui/Button';

export const Header: React.FC = () => {
  const { currentUser, logout, notifications, theme, setTheme } = useAppContext(); 
  const unreadNotificationsCount = notifications.filter(n => !n.read).length;
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
    setMobileMenuOpen(false);
  };
  
  const handleLoginRedirect = () => {
    navigate('/login');
    setMobileMenuOpen(false);
  }

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };
  
  const isAdminAreaUser = currentUser && currentUser.role !== UserRole.CUSTOMER;
  const isOwnerOrManager = currentUser && (currentUser.role === UserRole.OWNER || currentUser.role === UserRole.MANAGER);
  const isChairman = currentUser && currentUser.role === UserRole.CHAIRMAN;

  let navItems = [];

  if (isChairman) {
    navItems = [
      { to: "/admin/dashboard", label: "Tổng quan Chuỗi", icon: <BuildingIcon size={18}/> },
      { to: "/admin/users", label: "Quản lý Người dùng", icon: <UserCogIcon size={18}/> },
      { to: "/admin/reports", label: "Báo cáo TC Toàn Chuỗi", icon: <BarChart2Icon size={18}/> },
      { to: "/admin/kpi-reports", label: "Báo cáo KPI Toàn Chuỗi", icon: <TrendingUpIcon size={18}/> },
    ];
  } else if (isAdminAreaUser) {
    const baseNavItems = [
      { to: "/admin/dashboard", label: "Tổng quan C.Hàng", icon: <HomeIcon size={18}/> },
      { to: "/admin/orders", label: "Đơn hàng", icon: <PackageIcon size={18}/> },
      { to: "/admin/customers", label: "Khách hàng", icon: <UsersIcon size={18}/> },
      { to: "/admin/services", label: "Dịch vụ", icon: <SparklesIcon size={18}/> },
      { to: "/admin/suppliers", label: "Nhà cung cấp", icon: <ShoppingBagIcon size={18}/> },
      { to: "/admin/inventory", label: "Tồn kho", icon: <BarChart2Icon size={18}/> },
      { to: "/admin/kpi-reports", label: "Báo cáo KPI", icon: <TrendingUpIcon size={18}/> },
      { to: "/admin/reports", label: "Báo cáo TC", icon: <SettingsIcon size={18}/> }
    ];
    navItems = [...baseNavItems];
    if (isOwnerOrManager) {
      navItems.push({ to: "/admin/users", label: "Người dùng C.Hàng", icon: <UserCogIcon size={18}/> });
      // Ensure "Báo cáo TC" (SettingsIcon) is last if it exists and "Người dùng C.Hàng" was added.
      const reportsTcIndex = navItems.findIndex(item => item.label === "Báo cáo TC");
      if (reportsTcIndex !== -1 && reportsTcIndex !== navItems.length -1) {
          const reportsTcItem = navItems.splice(reportsTcIndex, 1)[0];
          navItems.push(reportsTcItem);
      }
    }
  }


  return (
    <header className="bg-bg-surface shadow-md sticky top-0 z-40 border-b border-border-base">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link 
              to={isAdminAreaUser ? "/admin/dashboard" : "/"} 
              className="flex items-center text-xl font-bold text-text-heading dark:text-slate-100 hover:opacity-80 transition-opacity"
              onClick={() => setMobileMenuOpen(false)}
            >
              <img 
                src="https://img.upanh.tv/2025/06/06/Megamat.png" 
                alt="Megamat Logo" 
                className="h-8 w-8 mr-2 rounded-md object-contain"
              /> 
              {APP_NAME} {isChairman && <span className="text-xs font-normal ml-1 text-purple-500">(Panel Chủ tịch)</span>}
            </Link>
          </div>
          
          {isAdminAreaUser && (
            <nav className="hidden md:flex items-center space-x-1">
              {navItems.map(item => (
                <NavLink key={item.to} to={item.to} icon={item.icon} currentPath={location.pathname}>
                  {item.label}
                </NavLink>
              ))}
            </nav>
          )}

          <div className="flex items-center space-x-2 sm:space-x-3">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={toggleTheme} 
              className="text-text-muted hover:text-brand-primary p-2 rounded-lg hover:bg-bg-surface-hover"
              aria-label={theme === 'light' ? 'Chuyển sang giao diện tối' : 'Chuyển sang giao diện sáng'}
            >
              {theme === 'light' ? <MoonIcon size={20} /> : <SunIcon size={20} />}
            </Button>
            
            <div className="relative"> 
              <BellIcon className="text-text-muted h-6 w-6 cursor-pointer hover:text-brand-primary" onClick={() => {}} />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-status-danger text-white text-xs rounded-full h-4.5 w-4.5 flex items-center justify-center text-[10px]">
                  {unreadNotificationsCount}
                </span>
              )}
            </div>

            {currentUser ? (
              <div className="hidden sm:flex items-center space-x-2">
                <span className="text-sm text-text-body dark:text-slate-300">
                  <UserCircleIcon size={18} className="inline mr-1 align-middle"/>
                  {currentUser.name} <span className="text-xs text-text-muted">({currentUser.role})</span>
                </span>
                <Button variant="secondary" size="sm" onClick={handleLogout} leftIcon={<LogOutIcon size={16}/>}>Đăng xuất</Button>
              </div>
            ) : (
              <Button variant="primary" size="sm" onClick={handleLoginRedirect} leftIcon={<LogInIcon size={16}/>} className="hidden sm:flex">Đăng nhập Q.Trị</Button>
            )}
            
             <div className="md:hidden">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="text-text-muted hover:text-brand-primary p-2 rounded-lg hover:bg-bg-surface-hover"
                aria-label="Mở menu"
              >
                {mobileMenuOpen ? <XIcon size={24} /> : <MenuIcon size={24} />}
              </Button>
            </div>
          </div>
        </div>
        
        {mobileMenuOpen && isAdminAreaUser && (
          <div className="md:hidden py-3 border-t border-border-base space-y-2">
            {navItems.map(item => (
              <NavLink 
                key={item.to} 
                to={item.to} 
                icon={item.icon} 
                currentPath={location.pathname}
                className="block w-full text-left"
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.label}
              </NavLink>
            ))}
             <div className="sm:hidden pt-2">
                {currentUser ? (
                    <div className="space-y-2">
                        <p className="px-3 py-2 text-sm text-text-body dark:text-slate-300">
                          <UserCircleIcon size={18} className="inline mr-1 align-middle"/>
                          {currentUser.name} ({currentUser.role})
                        </p>
                        <Button variant="secondary" onClick={handleLogout} className="w-full" leftIcon={<LogOutIcon size={16}/>}>Đăng xuất</Button>
                    </div>
                ) : (
                    <Button variant="primary" onClick={handleLoginRedirect} className="w-full" leftIcon={<LogInIcon size={16}/>}>Đăng nhập Quản trị</Button>
                )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

interface NavLinkProps {
  to: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  currentPath: string;
  className?: string;
  onClick?: () => void;
}
const NavLink: React.FC<NavLinkProps> = ({ to, children, icon, currentPath, className, onClick }) => {
  const isActive = currentPath === to || (to !== "/" && currentPath.startsWith(to) && to !== "/admin/dashboard" && currentPath.startsWith("/admin/")); 
  // Specific check for dashboard to ensure it's not active if a sub-route of /admin is active
  if (to === "/admin/dashboard" && currentPath !== "/admin/dashboard" && currentPath.startsWith("/admin/")) {
     // isActive = false; // This logic seems to be commented out, check if it's intended
  }


  return (
    <Link 
      to={to} 
      onClick={onClick}
      className={`
        px-3 py-2 rounded-md text-sm font-medium flex items-center space-x-2 transition-colors duration-150
        ${isActive 
          ? 'bg-sky-100 dark:bg-sky-500/20 text-brand-primary dark:text-sky-300' 
          : 'text-text-muted hover:text-brand-primary dark:hover:text-sky-400 hover:bg-bg-surface-hover dark:hover:bg-slate-700/70'}
        ${className}
      `}
      aria-current={isActive ? 'page' : undefined}
    >
      {icon && React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: `flex-shrink-0 ${isActive ? 'text-brand-primary dark:text-sky-300' : ''}`})}
      <span>{children}</span>
    </Link>
  );
}