
import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { UserRole } from '../../types';
import { APP_NAME } from '../../constants'; 
import { HomeIcon, PackageIcon, UsersIcon, ShoppingBagIcon, BarChart2Icon, SettingsIcon, BellIcon, MenuIcon, XIcon, SparklesIcon, TrendingUpIcon, LogOutIcon, LogInIcon, UserCircleIcon, UserCogIcon, BuildingIcon, FileTextIcon, MoonIcon, SunIcon, TagIcon, LayoutDashboard, DropletsIcon } from 'lucide-react';
import { Button } from '../ui/Button';

export const Header: React.FC = () => {
  const { currentUser, logout } = useAuth(); 
  const { notifications, theme, setTheme } = useData();
  const unreadNotificationsCount = notifications.filter(n => !n.read).length;
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
    setMobileMenuOpen(false);
  };
  
  const isCustomer = currentUser?.role === UserRole.CUSTOMER;
  const isAdminAreaUser = currentUser && currentUser.role !== UserRole.CUSTOMER;
  const isOwnerOrManager = currentUser && (currentUser.role === UserRole.OWNER || currentUser.role === UserRole.MANAGER);
  const isChairman = currentUser && currentUser.role === UserRole.CHAIRMAN;

  let navItems = [];

  if (isChairman) {
    navItems = [
      { to: "/admin/dashboard", label: "Tổng quan Chuỗi", icon: <BuildingIcon size={20}/> },
      { to: "/admin/stores", label: "Quản lý Cửa hàng", icon: <HomeIcon size={20}/> },
      { to: "/admin/promotions", label: "Quản lý Khuyến mãi", icon: <TagIcon size={20}/> },
      { to: "/admin/users", label: "Quản lý Người dùng", icon: <UserCogIcon size={20}/> },
      { to: "/admin/reports", label: "Báo cáo TC Toàn Chuỗi", icon: <BarChart2Icon size={20}/> },
      { to: "/admin/kpi-reports", label: "Báo cáo KPI Toàn Chuỗi", icon: <TrendingUpIcon size={20}/> },
    ];
  } else if (isAdminAreaUser) {
    const baseNavItems = [
      { to: "/admin/dashboard", label: "Tổng quan C.Hàng", icon: <HomeIcon size={20}/> },
      { to: "/admin/orders", label: "Đơn hàng", icon: <PackageIcon size={20}/> },
      { to: "/admin/customers", label: "Khách hàng", icon: <UsersIcon size={20}/> },
      { to: "/admin/services", label: "Dịch vụ", icon: <SparklesIcon size={20}/> },
      { to: "/admin/suppliers", label: "Nhà cung cấp", icon: <ShoppingBagIcon size={20}/> },
      { to: "/admin/inventory", label: "Tồn kho", icon: <BarChart2Icon size={20}/> },
      { to: "/admin/kpi-reports", label: "Báo cáo KPI", icon: <TrendingUpIcon size={20}/> },
      { to: "/admin/reports", label: "Báo cáo TC", icon: <FileTextIcon size={20}/> }
    ];
    navItems = [...baseNavItems];
    if (isOwnerOrManager) {
      navItems.splice(4, 0, { to: "/admin/wash-methods", label: "PP Giặt", icon: <DropletsIcon size={20}/> });
      navItems.push({ to: "/admin/promotions", label: "Khuyến mãi", icon: <TagIcon size={20}/> });
      navItems.push({ to: "/admin/settings", label: "Cài đặt C.Hàng", icon: <SettingsIcon size={20}/> });
      navItems.push({ to: "/admin/users", label: "Người dùng C.Hàng", icon: <UserCogIcon size={20}/> });
      const reportsTcIndex = navItems.findIndex(item => item.label === "Báo cáo TC");
      if (reportsTcIndex !== -1 && reportsTcIndex !== navItems.length -1) {
          const reportsTcItem = navItems.splice(reportsTcIndex, 1)[0];
          navItems.push(reportsTcItem);
      }
    }
  } else if (isCustomer) {
    navItems = [
      { to: "/portal/dashboard", label: "Bảng điều khiển", icon: <LayoutDashboard size={20} /> },
    ];
  }


  return (
    <>
      <header className="bg-bg-surface shadow-md sticky top-0 z-40 border-b border-border-base">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link 
                to={currentUser ? (isCustomer ? "/portal/dashboard" : "/admin/dashboard") : "/"} 
                className="flex items-center text-xl font-bold text-text-heading hover:opacity-80 transition-opacity"
              >
                <img 
                  src="https://raw.githubusercontent.com/vtvinh87/MegaMat/refs/heads/main/pictures/megamat-logo.png" 
                  alt="Megamat Logo" 
                  className="h-8 w-8 mr-2 rounded-md object-contain"
                /> 
                {APP_NAME} {isChairman && <span className="text-xs font-normal ml-1 text-purple-500">(Panel Chủ tịch)</span>}
              </Link>
            </div>
            
            {(isAdminAreaUser || isCustomer) && (
              <nav className="hidden lg:flex items-center space-x-1">
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
                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                className="text-text-muted hover:text-brand-primary p-2 rounded-lg hover:bg-bg-surface-hover"
                aria-label={theme === 'light' ? 'Chuyển sang chế độ tối' : 'Chuyển sang chế độ sáng'}
                title={theme === 'light' ? 'Chuyển sang chế độ tối' : 'Chuyển sang chế độ sáng'}
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
                  <span className="text-sm text-text-body">
                    <UserCircleIcon size={18} className="inline mr-1 align-middle"/>
                    {currentUser.name} <span className="text-xs text-text-muted">({currentUser.role})</span>
                  </span>
                  <Button variant="secondary" size="sm" onClick={handleLogout} leftIcon={<LogOutIcon size={16}/>}>Đăng xuất</Button>
                </div>
              ) : (
                <div className="hidden sm:flex items-center space-x-2">
                  <Button variant="secondary" size="sm" onClick={() => navigate('/login')} leftIcon={<UserCogIcon size={16}/>}>Đăng nhập Q.Trị</Button>
                  <Button variant="primary" size="sm" onClick={() => navigate('/customer-login')} leftIcon={<LogInIcon size={16}/>}>Đăng nhập K.Hàng</Button>
                </div>
              )}
              
              <div className="lg:hidden">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setMobileMenuOpen(true)}
                  className="text-text-muted hover:text-brand-primary p-2 rounded-lg hover:bg-bg-surface-hover"
                  aria-label="Mở menu"
                >
                  <MenuIcon size={24} />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu Panel & Overlay */}
      <div
        className={`lg:hidden fixed inset-0 z-50 transition-all duration-300 ease-in-out ${mobileMenuOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-menu-title"
      >
        {/* Overlay */}
        <div 
          className="fixed inset-0 bg-black/40"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        ></div>

        {/* Menu Content */}
        <div 
          className={`fixed top-0 right-0 bottom-0 w-4/5 max-w-sm bg-bg-surface border-l border-border-base shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}
        >
          <div className="flex justify-between items-center p-4 border-b border-border-base flex-shrink-0">
            <h2 id="mobile-menu-title" className="font-semibold text-text-heading text-lg">Menu</h2>
            <Button variant="ghost" size="sm" onClick={() => setMobileMenuOpen(false)} className="p-2 -mr-2" aria-label="Đóng menu">
              <XIcon size={24} />
            </Button>
          </div>
          
          {(isAdminAreaUser || isCustomer) && (
            <nav className="flex-grow p-4 space-y-2 overflow-y-auto">
              {navItems.map((item, index) => (
                <NavLink 
                  key={item.to} 
                  to={item.to} 
                  icon={item.icon} 
                  currentPath={location.pathname}
                  className={`block w-full text-left transition-all duration-300 ease-out ${mobileMenuOpen ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'}`}
                  style={{ transitionDelay: `${50 + index * 30}ms` }}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          )}
          
          <div className="p-4 border-t border-border-base flex-shrink-0">
            {currentUser ? (
                <div className="space-y-3">
                    <p className="px-3 py-2 text-sm text-text-body">
                      <UserCircleIcon size={18} className="inline mr-2 align-middle"/>
                      {currentUser.name} ({currentUser.role})
                    </p>
                    <Button variant="secondary" onClick={handleLogout} className="w-full" leftIcon={<LogOutIcon size={16}/>}>Đăng xuất</Button>
                </div>
            ) : (
                <div className="space-y-3">
                    <Button variant="primary" onClick={() => {navigate('/customer-login'); setMobileMenuOpen(false);}} className="w-full" leftIcon={<LogInIcon size={16}/>}>Đăng nhập Khách hàng</Button>
                    <Button variant="secondary" onClick={() => {navigate('/login'); setMobileMenuOpen(false);}} className="w-full" leftIcon={<UserCogIcon size={16}/>}>Đăng nhập Quản trị</Button>
                </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

interface NavLinkProps {
  to: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  currentPath: string;
  className?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
}
const NavLink: React.FC<NavLinkProps> = ({ to, children, icon, currentPath, className, onClick, style }) => {
  const isDashboard = to.endsWith("dashboard");
  const isActive = isDashboard 
    ? currentPath === to 
    : (to !== "/" && currentPath.startsWith(to));

  return (
    <Link 
      to={to} 
      onClick={onClick}
      style={style}
      className={`
        px-3 py-2 rounded-lg text-base lg:text-sm font-medium flex items-center space-x-3 lg:space-x-2 transition-all duration-200 ease-in-out
        group
        ${isActive 
          ? 'bg-brand-primary/10 text-brand-primary font-semibold' 
          : 'text-text-body hover:text-brand-primary hover:bg-blue-500/5'}
        ${className}
      `}
      aria-current={isActive ? 'page' : undefined}
    >
      {icon && React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: `flex-shrink-0 transition-colors duration-200 ${isActive ? 'text-brand-primary' : 'text-text-muted group-hover:text-brand-primary'}`})}
      <span>{children}</span>
    </Link>
  );
}
