
import React, { useMemo } from 'react'; 
import { Link, useNavigate } from 'react-router-dom'; // Added useNavigate
import { useAppContext } from '../../contexts/AppContext';
import { UserRole, Notification, User, OrderStatus } from '../../types'; // Added OrderStatus
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button'; // Added Button
import { PackageIcon, UsersIcon, ShoppingBagIcon, BarChart2Icon, AlertTriangleIcon, ArrowRightIcon, Settings2Icon, CheckCircle, InfoIcon, ActivityIcon, BriefcaseIcon, PlusCircleIcon, BuildingIcon } from 'lucide-react'; 

// Helper function to get Notification Icon based on type (can be moved to a shared utils if needed)
const NotificationIcon: React.FC<{type: Notification['type']}> = ({ type }) => {
  switch (type) {
    case 'success': return <CheckCircle size={16} className="text-status-success mr-2 mt-0.5 flex-shrink-0" />;
    case 'info': return <InfoIcon size={16} className="text-status-info mr-2 mt-0.5 flex-shrink-0" />;
    case 'warning': return <AlertTriangleIcon size={16} className="text-status-warning mr-2 mt-0.5 flex-shrink-0" />;
    case 'error': return <AlertTriangleIcon size={16} className="text-status-danger mr-2 mt-0.5 flex-shrink-0" />; // Error can also use AlertTriangle
    default: return <InfoIcon size={16} className="text-text-muted mr-2 mt-0.5 flex-shrink-0" />;
  }
};


const AdminDashboardPage: React.FC = () => {
  const { 
    orders, // Now filtered by context for non-Chairman roles
    customers, // Global
    suppliers, // Global
    inventory, // Now filtered by context
    currentUser, 
    users, // All users (for finding names etc.)
    notifications, // Filtered by context
    findUserById,
    getCurrentUserOwnerId,
    materialOrders // Added to check for pending material orders
  } = useAppContext();
  const navigate = useNavigate();

  const pendingOrdersCount = orders.filter(o => o.status === OrderStatus.PENDING).length;
  const processingOrdersCount = orders.filter(o => o.status === OrderStatus.PROCESSING).length;
  const lowStockItemsCount = inventory.filter(item => item.quantity <= item.lowStockThreshold).length;
  const pendingMaterialOrdersCount = materialOrders.filter(mo => mo.status === 'Chờ duyệt').length;

  interface QuickStat {
    title: string;
    value: number | string;
    link: string;
    icon: React.ReactNode;
    colorClass: string; 
    iconBgClass: string; 
  }
  
  const quickStats: QuickStat[] = [
    { title: 'Đơn hàng chờ xử lý', value: pendingOrdersCount, link: '/admin/orders?status=PENDING', icon: <PackageIcon />, colorClass: 'status-warning', iconBgClass: 'bg-status-warning-bg dark:bg-amber-700/30' },
    { title: 'Đơn hàng đang xử lý', value: processingOrdersCount, link: '/admin/orders?status=PROCESSING', icon: <PackageIcon />, colorClass: 'status-info', iconBgClass: 'bg-status-info-bg dark:bg-sky-700/30' },
    { title: 'Tổng số khách hàng (Toàn chuỗi)', value: customers.length, link: '/admin/customers', icon: <UsersIcon />, colorClass: 'status-success', iconBgClass: 'bg-status-success-bg dark:bg-emerald-700/30' },
    { title: 'Nhà cung cấp (Toàn chuỗi)', value: suppliers.length, link: '/admin/suppliers', icon: <ShoppingBagIcon />, colorClass: 'brand-accent', iconBgClass: 'bg-teal-100 dark:bg-teal-700/30' },
    { title: 'Mặt hàng tồn kho (Cửa hàng này)', value: inventory.length, link: '/admin/inventory', icon: <BarChart2Icon />, colorClass: 'brand-primary', iconBgClass: 'bg-sky-100 dark:bg-sky-700/30' },
  ];
  
  const isChairman = currentUser?.role === UserRole.CHAIRMAN;
  const isAdminUser = currentUser && (currentUser.role === UserRole.OWNER || currentUser.role === UserRole.MANAGER || currentUser.role === UserRole.STAFF);

  const getAllSubordinateIds = (managerId: string, allUsers: User[]): string[] => {
    const subordinates = new Set<string>();
    const queue: string[] = [managerId]; 
    const visitedInQueue = new Set<string>([managerId]); 

    let head = 0;
    while(head < queue.length) {
        const currentManagerIdInQueue = queue[head++];
        allUsers.forEach(u => {
            if (u.managedBy === currentManagerIdInQueue) { 
                if (!subordinates.has(u.id)) { 
                    subordinates.add(u.id);
                    if ((u.role === UserRole.MANAGER || u.role === UserRole.OWNER) && !visitedInQueue.has(u.id)) {
                        queue.push(u.id);
                        visitedInQueue.add(u.id);
                    }
                }
            }
        });
    }
    return Array.from(subordinates);
  };


  const recentActivities = useMemo(() => {
    // Notifications are already filtered by ownerId in the context for non-Chairman roles
    // For Chairman, context returns all notifications.
    return notifications
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 7); 
  }, [notifications]);


  if (isChairman) {
    const totalChainOrders = useAppContext().orders.length; // Get all orders from unfiltered context for chairman
    const totalChainInventory = useAppContext().inventory.length; // Get all inventory from unfiltered context

    const chairmanQuickStats: QuickStat[] = [
       { title: 'Tổng ĐH toàn chuỗi', value: totalChainOrders, link: '/admin/orders', icon: <PackageIcon />, colorClass: 'status-info', iconBgClass: 'bg-status-info-bg' },
       { title: 'Tổng tồn kho toàn chuỗi', value: totalChainInventory, link: '/admin/inventory', icon: <BarChart2Icon />, colorClass: 'brand-primary', iconBgClass: 'bg-sky-100' },
       { title: 'Tổng số Chủ Cửa hàng', value: users.filter(u=> u.role === UserRole.OWNER).length, link: '/admin/users', icon: <UsersIcon />, colorClass: 'status-success', iconBgClass: 'bg-status-success-bg' },
    ];

    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-text-heading">Bảng điều khiển Chủ tịch</h1>
        <p className="text-text-body">Chào mừng, {currentUser?.name}. Tại đây bạn có thể quản lý các Chủ cửa hàng và theo dõi hoạt động chung của chuỗi.</p>
        
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {chairmanQuickStats.map(stat => (
              <Card key={stat.title} className={`border-l-4 border-${stat.colorClass} dark:border-${stat.colorClass}`} contentClassName="!p-0">
                <Link to={stat.link} className="block hover:bg-bg-surface-hover dark:hover:bg-slate-700/40 p-5 rounded-xl">
                  <div className="flex items-center justify-between">
                      <div>
                          <p className="text-sm font-medium text-text-muted truncate">{stat.title}</p>
                          <p className="text-3xl font-semibold text-text-heading">{stat.value}</p>
                      </div>
                      <div className={`p-3 rounded-full ${stat.iconBgClass}`}>
                        {React.cloneElement(stat.icon as React.ReactElement<{ size?: number; className?: string }>, { size: 24, className: `text-${stat.colorClass}` })}
                      </div>
                  </div>
                </Link>
              </Card>
            ))}
        </div>

        <Card title="Quản lý Chuỗi Cửa hàng" icon={<BuildingIcon size={20} className="text-brand-primary"/>}>
            <div className="space-y-3">
                <Button 
                    onClick={() => navigate('/admin/users', { state: { action: 'addOwnerFromChairmanDashboard' }})} 
                    leftIcon={<PlusCircleIcon size={18} />} 
                    variant="primary"
                    className="w-full md:w-auto"
                >
                    Thêm Chủ Cửa hàng Mới
                </Button>
                <p className="text-sm text-text-muted italic mt-2">Chức năng quản lý danh sách cửa hàng chi tiết sẽ được phát triển trong tương lai.</p>
            </div>
        </Card>
         <Card title="Hoạt động Người dùng Gần đây (Toàn chuỗi)" icon={<ActivityIcon size={20} className="text-brand-primary"/>}>
          {recentActivities.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-4">Không có hoạt động nào gần đây.</p>
          ) : (
            <ul className="space-y-3 text-sm text-text-body">
              {recentActivities.map(activity => {
                const activityUser = activity.userId ? findUserById(activity.userId) : null;
                const activityUserName = activityUser ? `${activityUser.name} (${activityUser.role})` : (activity.userRole || 'Hệ thống');
                
                return (
                  <li key={activity.id} className="flex items-start p-2 rounded-md hover:bg-bg-surface-hover dark:hover:bg-slate-700/30 transition-colors">
                    <NotificationIcon type={activity.type} />
                    <div className="flex-1">
                      <p>
                        <strong className="text-text-heading">{activityUserName}: </strong>
                        {activity.message}
                        {activity.ownerId && <span className="text-xs text-purple-500 ml-1">(Cửa hàng: {users.find(u=>u.id === activity.ownerId)?.name || activity.ownerId.slice(-4)})</span>}
                      </p>
                      <p className="text-xs text-text-muted mt-0.5">
                        {new Date(activity.createdAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    );
  }

  // Dashboard for Owner, Manager, Staff
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-text-heading">Bảng điều khiển Cửa hàng</h1>
      
      {lowStockItemsCount > 0 && (
        <Card className="bg-status-warning-bg dark:bg-amber-800/60 border-l-4 border-status-warning dark:border-amber-500">
          <div className="flex items-center">
            <AlertTriangleIcon className="h-8 w-8 text-status-warning-text dark:text-amber-300 mr-4 flex-shrink-0"/>
            <div>
              <h3 className="text-lg font-semibold text-status-warning-text dark:text-amber-200">Cảnh báo tồn kho thấp!</h3>
              <p className="text-sm text-status-warning-text dark:text-amber-300 opacity-90">Có {lowStockItemsCount} mặt hàng sắp hết. <Link to="/admin/inventory" className="font-semibold hover:underline">Xem chi tiết</Link></p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {quickStats.map(stat => (
          <Card key={stat.title} className={`border-l-4 border-${stat.colorClass} dark:border-${stat.colorClass}`} contentClassName="!p-0">
            <Link to={stat.link} className="block hover:bg-bg-surface-hover dark:hover:bg-slate-700/40 p-5 rounded-xl">
              <div className="flex items-center justify-between">
                  <div>
                      <p className="text-sm font-medium text-text-muted truncate">{stat.title}</p>
                      <p className="text-3xl font-semibold text-text-heading">{stat.value}</p>
                  </div>
                  <div className={`p-3 rounded-full ${stat.iconBgClass}`}>
                    {React.cloneElement(stat.icon as React.ReactElement<{ size?: number; className?: string }>, { size: 24, className: `text-${stat.colorClass}` })}
                  </div>
              </div>
              <div className="mt-3 text-sm text-text-link hover:underline flex items-center">
                Xem chi tiết <ArrowRightIcon size={16} className="ml-1" />
              </div>
            </Link>
          </Card>
        ))}
      </div>

      { isAdminUser && 
        <Card title="Tác vụ nhanh" className="bg-bg-subtle/30 dark:bg-slate-800/60">
            <div className="space-y-3">
                  <Link to="/admin/material-orders" className="flex items-center text-text-link hover:underline">
                    <Settings2Icon size={18} className="mr-2"/>
                    Quản lý Đơn đặt Nguyên vật liệu
                    {pendingMaterialOrdersCount > 0 && (
                        <span className="ml-2 relative" title={`${pendingMaterialOrdersCount} đơn NVL chờ duyệt`}>
                            <AlertTriangleIcon size={18} className="text-status-warning dark:text-amber-400" />
                            <span className="absolute -top-1 -right-1 bg-status-warning text-white text-[10px] rounded-full h-3.5 w-3.5 flex items-center justify-center border border-white dark:border-bg-surface">
                                {pendingMaterialOrdersCount > 9 ? '9+' : pendingMaterialOrdersCount}
                            </span>
                        </span>
                    )}
                  </Link>
            </div>
        </Card>
      }
      
       <Card title="Hoạt động gần đây (Cửa hàng này)" icon={<ActivityIcon size={20} className="text-brand-primary"/>}>
          {recentActivities.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-4">Không có hoạt động nào gần đây.</p>
          ) : (
            <ul className="space-y-3 text-sm text-text-body">
              {recentActivities.map(activity => {
                const activityUser = activity.userId ? findUserById(activity.userId) : null;
                const activityUserName = activityUser ? activityUser.name : (activity.userRole || 'Hệ thống');
                const showActivityUser = currentUser && activity.userId && activity.userId !== currentUser.id;

                return (
                  <li key={activity.id} className="flex items-start p-2 rounded-md hover:bg-bg-surface-hover dark:hover:bg-slate-700/30 transition-colors">
                    <NotificationIcon type={activity.type} />
                    <div className="flex-1">
                      <p>
                        {showActivityUser && <strong className="text-text-heading">{activityUserName}: </strong>}
                        {activity.message}
                      </p>
                      <p className="text-xs text-text-muted mt-0.5">
                        {new Date(activity.createdAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

    </div>
  );
};

export default AdminDashboardPage;
