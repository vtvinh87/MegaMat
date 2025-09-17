import React, { useMemo, useState, useEffect, useCallback } from 'react'; 
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { UserRole, Notification, User, OrderStatus, Promotion } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
// FIX: Added MessageCircleIcon to imports
import { PackageIcon, UsersIcon, ShoppingBagIcon, BarChart2Icon, AlertTriangleIcon, ArrowRightIcon, Settings2Icon, CheckCircle, InfoIcon, ActivityIcon, BriefcaseIcon, PlusCircleIcon, BuildingIcon, LineChartIcon, PieChartIcon, SparklesIcon, MessageSquareIcon, MessageCircleIcon, RefreshCwIcon, MegaphoneIcon, ShieldAlertIcon } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';
import { GoogleGenAI } from '@google/genai';
import { Spinner } from '../../components/ui/Spinner';
import { APP_NAME } from '../../constants';

// Helper function to get Notification Icon based on type
const NotificationIcon: React.FC<{type: Notification['type']}> = ({ type }) => {
  switch (type) {
    case 'success': return <CheckCircle size={16} className="text-status-success mr-2 mt-0.5 flex-shrink-0" />;
    case 'info': return <InfoIcon size={16} className="text-status-info mr-2 mt-0.5 flex-shrink-0" />;
    case 'warning': return <AlertTriangleIcon size={16} className="text-status-warning mr-2 mt-0.5 flex-shrink-0" />;
    case 'error': return <AlertTriangleIcon size={16} className="text-status-danger mr-2 mt-0.5 flex-shrink-0" />;
    default: return <InfoIcon size={16} className="text-text-muted mr-2 mt-0.5 flex-shrink-0" />;
  }
};

const DashboardCharts = () => {
  const { orders } = useData();

  const weeklyRevenueData = useMemo(() => {
    const last7Days: { name: string, revenue: number }[] = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateString = `${date.getDate()}/${date.getMonth() + 1}`;
      last7Days.push({ name: dateString, revenue: 0 });
    }
    
    orders.forEach(order => {
      const orderDate = new Date(order.createdAt);
      const timeDiff = today.getTime() - orderDate.getTime();
      const daysAgo = Math.floor(timeDiff / (1000 * 3600 * 24));
      
      if (daysAgo >= 0 && daysAgo < 7) {
        const index = 6 - daysAgo;
        last7Days[index].revenue += order.totalAmount;
      }
    });
    
    return last7Days;
  }, [orders]);

  const orderStatusData = useMemo(() => {
    const statusCounts = {
      [OrderStatus.PENDING]: 0,
      [OrderStatus.PROCESSING]: 0,
      [OrderStatus.COMPLETED]: 0,
    };
    orders.forEach(order => {
      if (order.status in statusCounts) {
        statusCounts[order.status as keyof typeof statusCounts]++;
      }
    });
    return [
      { name: OrderStatus.PENDING, value: statusCounts[OrderStatus.PENDING] },
      { name: OrderStatus.PROCESSING, value: statusCounts[OrderStatus.PROCESSING] },
      { name: OrderStatus.COMPLETED, value: statusCounts[OrderStatus.COMPLETED] },
    ].filter(d => d.value > 0);
  }, [orders]);

  const PIE_COLORS = {
    [OrderStatus.PENDING]: '#f59e0b', // amber-500
    [OrderStatus.PROCESSING]: '#3b82f6', // blue-500
    [OrderStatus.COMPLETED]: '#16a34a', // green-600
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <Card title="Doanh thu 7 ngày qua" icon={<LineChartIcon size={20} className="text-brand-primary"/>} className="lg:col-span-3">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weeklyRevenueData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => `${(value / 1000).toLocaleString('vi-VN')}k`} />
              <Tooltip formatter={(value: number) => `${value.toLocaleString('vi-VN')} VNĐ`} />
              <Legend />
              <Line type="monotone" dataKey="revenue" name="Doanh thu" stroke="#0ea5e9" strokeWidth={2} activeDot={{ r: 8 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card title="Trạng thái Đơn hàng" icon={<PieChartIcon size={20} className="text-brand-primary"/>} className="lg:col-span-2">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              {/* FIX: The 'percent' property from recharts can be undefined, causing an arithmetic error when multiplying. Coalescing to 0 ensures the operation is always valid. */}
              {/* FIX: The 'percent' property from recharts can be undefined. Coalesce to 0 to prevent arithmetic error. */}
              <Pie data={orderStatusData} cx="50%" cy="50%" outerRadius={80} fill="#8884d8" dataKey="value" nameKey="name" labelLine={false} label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}>
                {orderStatusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={PIE_COLORS[entry.name as keyof typeof PIE_COLORS]} />
                ))}
              </Pie>
              <Tooltip formatter={(value, name) => [`${value} đơn`, name]} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
};

const AIFeedbackSummary: React.FC = () => {
  const { serviceRatings, staffRatings, addNotification } = useData();
  const [summary, setSummary] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAnalyzeFeedback = useCallback(async () => {
    setIsLoading(true);
    setError('');
    setSummary('');

    try {
      if (!process.env.API_KEY) {
        throw new Error("API key is not configured.");
      }

      const allComments = [
        ...serviceRatings.map(r => r.comment),
        ...staffRatings.map(r => r.comment)
      ].filter(Boolean); // Filter out empty/undefined comments

      if (allComments.length < 3) {
        setSummary("Chưa có đủ bình luận của khách hàng để tạo tóm tắt.");
        setIsLoading(false);
        return;
      }

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Bạn là chuyên gia phân tích dịch vụ khách hàng cho tiệm giặt là ${APP_NAME}. Dựa trên các bình luận dưới đây, hãy tạo một tóm tắt ngắn gọn bằng tiếng Việt.
      
      Yêu cầu tóm tắt:
      1.  **Điểm Tích Cực:** Liệt kê những điều khách hàng hài lòng nhất.
      2.  **Điểm Cần Cải Thiện:** Chỉ ra những vấn đề khách hàng phàn nàn nhiều nhất.
      3.  **Đề xuất Hành động:** Gợi ý 1-2 hành động cụ thể để cải thiện dịch vụ.
      
      Sử dụng định dạng markdown với tiêu đề đậm và gạch đầu dòng.
      
      Bình luận của khách hàng:
      ${allComments.map(c => `- ${c}`).join('\n')}
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      setSummary(response.text);

    } catch (err) {
      console.error("Error analyzing feedback with AI:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(`Lỗi phân tích phản hồi: ${errorMessage}`);
      addNotification({ message: `Lỗi AI: ${errorMessage}`, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [serviceRatings, staffRatings, addNotification]);

  useEffect(() => {
    handleAnalyzeFeedback();
  }, [handleAnalyzeFeedback]);

  return (
    <Card 
      title="Tóm tắt Phản hồi Khách hàng bởi AI" 
      icon={<MessageCircleIcon size={20} className="text-brand-primary"/>}
      actions={
        <Button onClick={handleAnalyzeFeedback} disabled={isLoading} size="sm" variant="ghost">
          <RefreshCwIcon size={16} className={isLoading ? 'animate-spin' : ''}/>
        </Button>
      }
    >
      {isLoading && <div className="flex justify-center items-center h-40"><Spinner /></div>}
      {error && <p className="text-status-danger-text text-center p-4">{error}</p>}
      {!isLoading && !error && summary && (
        <div className="prose prose-sm max-w-none text-text-body whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: summary.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\* (.*?)(?=\n\*|\n\n|$)/g, '<li>$1</li>').replace(/<li>/g, '<li class="list-disc ml-4">') }}>
        </div>
      )}
      {!isLoading && !error && !summary && <p className="text-text-muted text-center p-4">Không có dữ liệu để hiển thị.</p>}
    </Card>
  );
};


const AdminDashboardPage: React.FC = () => {
  // --- ALL HOOKS CALLED AT THE TOP LEVEL ---
  const { currentUser } = useAuth();
  const { 
    // FIX: Removed `customers` from destructuring, using `users` instead.
    orders, suppliers, inventory, users, notifications, findUserById,
    getOwnerIdForUser, materialOrders, findStoreProfileByOwnerId, serviceRatings, staffRatings,
    promotions, acknowledgedSystemPromos, acknowledgedCancelRequests, acknowledgeSystemPromo, acknowledgeCancelRequest,
    respondToOptOutRequest, acknowledgeOptOutRequest, acknowledgedOptOutRequests
  } = useData();
  const navigate = useNavigate();

  const [promoForModal, setPromoForModal] = useState<Promotion | null>(null);
  const [cancelRequestForModal, setCancelRequestForModal] = useState<Promotion | null>(null);
  const [optOutRequestForModal, setOptOutRequestForModal] = useState<{ promo: Promotion; request: NonNullable<Promotion['optOutRequests']>[0] } | null>(null);
  const [isRejectionReasonModalOpen, setIsRejectionReasonModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const topServices = useMemo(() => {
    const serviceCounts: { [key: string]: { name: string; count: number } } = {};
    orders.forEach(order => {
      order.items.forEach(item => {
        const serviceName = item.serviceItem.name;
        if (!serviceCounts[serviceName]) {
          serviceCounts[serviceName] = { name: serviceName, count: 0 };
        }
        serviceCounts[serviceName].count += item.quantity;
      });
    });
    return Object.values(serviceCounts).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [orders]);

  const recentActivities = useMemo(() => {
    return notifications
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 7); 
  }, [notifications]);

  useEffect(() => {
    if (currentUser?.role === UserRole.OWNER) {
      const acknowledgedIds = acknowledgedSystemPromos[currentUser.id] || [];
      const unacknowledgedPromo = promotions.find(p => p.isSystemWide && !acknowledgedIds.includes(p.id));
      if (unacknowledgedPromo) {
        setPromoForModal(unacknowledgedPromo);
        return;
      }
      
      const acknowledgedCancelIds = acknowledgedCancelRequests[currentUser.id] || [];
      const unacknowledgedCancelRequest = promotions.find(p => 
        p.ownerId === currentUser.id &&
        p.cancellationRequest?.status === 'pending' &&
        !acknowledgedCancelIds.includes(p.id)
      );
      if (unacknowledgedCancelRequest) {
        setCancelRequestForModal(unacknowledgedCancelRequest);
      }
    }
  }, [promotions, currentUser, acknowledgedSystemPromos, acknowledgedCancelRequests]);

  useEffect(() => {
    if (currentUser?.role === UserRole.CHAIRMAN) {
        let foundRequest = false;
        for (const promo of promotions) {
            if (promo.isSystemWide && promo.optOutRequests) {
                for (const request of promo.optOutRequests) {
                    const requestId = `${promo.id}::${request.storeOwnerId}`;
                    const isAcknowledged = (acknowledgedOptOutRequests[currentUser.id] || []).includes(requestId);
                    if (request.status === 'pending' && !isAcknowledged) {
                        setOptOutRequestForModal({ promo, request });
                        foundRequest = true;
                        break;
                    }
                }
            }
            if (foundRequest) break;
        }
        if (!foundRequest) {
            setOptOutRequestForModal(null);
        }
    }
  }, [promotions, currentUser, acknowledgedOptOutRequests]);

  // --- HANDLER FUNCTIONS ---
  const handleAcknowledgeAndClosePromoModal = (promoId: string) => {
    acknowledgeSystemPromo(promoId);
    setPromoForModal(null);
  };
  
  const handleAcknowledgeAndCloseCancelModal = (promoId: string) => {
    acknowledgeCancelRequest(promoId);
    setCancelRequestForModal(null);
  };

  const handleConfirmRejection = () => {
    if (!optOutRequestForModal || !rejectionReason.trim()) return;
    const { promo, request } = optOutRequestForModal;
    respondToOptOutRequest(promo.id, request.storeOwnerId, 'rejected', rejectionReason);
    setIsRejectionReasonModalOpen(false);
    setOptOutRequestForModal(null);
    setRejectionReason('');
  };

  // --- RENDER LOGIC ---
  const isChairman = currentUser?.role === UserRole.CHAIRMAN;

  interface QuickStat {
    title: string;
    value: number | string;
    link: string;
    icon: React.ReactNode;
    colorClass: string; 
    iconBgClass: string; 
  }
  
  if (isChairman) {
    const chairmanQuickStats: QuickStat[] = [
       { title: 'Tổng ĐH toàn chuỗi', value: orders.length, link: '#', icon: <PackageIcon />, colorClass: 'text-status-info-text', iconBgClass: 'bg-status-info-bg' },
       { title: 'Tổng tồn kho toàn chuỗi', value: inventory.length, link: '#', icon: <BarChart2Icon />, colorClass: 'text-brand-primary', iconBgClass: 'bg-blue-100' },
       { title: 'Tổng số Chủ Cửa hàng', value: users.filter(u=> u.role === UserRole.OWNER).length, link: '/admin/users', icon: <UsersIcon />, colorClass: 'text-status-success-text', iconBgClass: 'bg-status-success-bg' },
    ];

    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-text-heading">Bảng điều khiển Chủ tịch</h1>
        <p className="text-text-body">Chào mừng, {currentUser?.name}. Tại đây bạn có thể quản lý các Chủ cửa hàng và theo dõi hoạt động chung của chuỗi.</p>
        
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {chairmanQuickStats.map(stat => (
              <Card key={stat.title} className={`border-l-4 ${stat.colorClass.replace('text-', 'border-')}`} contentClassName="!p-0">
                <Link to={stat.link} className="block hover:bg-bg-surface-hover p-5 rounded-xl">
                  <div className="flex items-center justify-between">
                      <div>
                          <p className="text-sm font-medium text-text-muted truncate">{stat.title}</p>
                          <p className="text-3xl font-semibold text-text-heading">{stat.value}</p>
                      </div>
                      <div className={`p-3 rounded-full ${stat.iconBgClass}`}>
                        {React.cloneElement(stat.icon as React.ReactElement<{ size?: number; className?: string }>, { size: 24, className: `${stat.colorClass}` })}
                      </div>
                  </div>
                </Link>
              </Card>
            ))}
        </div>
        
        <DashboardCharts />

        <AIFeedbackSummary />

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
                
                const storeProfile = activity.ownerId ? findStoreProfileByOwnerId(activity.ownerId) : null;
                const storeDisplayName = storeProfile ? storeProfile.storeName : (activity.ownerId ? `Cửa hàng ID ${activity.ownerId.slice(-4)}` : 'Không rõ');

                return (
                  <li key={activity.id} className="flex items-start p-2 rounded-md hover:bg-bg-surface-hover transition-colors">
                    <NotificationIcon type={activity.type} />
                    <div className="flex-1">
                      <p>
                        <strong className="text-text-heading">{activityUserName}: </strong>
                        {activity.message}
                      </p>
                      {activity.ownerId && (
                        <p className="text-xs text-purple-500 mt-1 flex items-center">
                            <BuildingIcon size={12} className="mr-1.5 flex-shrink-0" />
                            {storeDisplayName}
                        </p>
                      )}
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

        {optOutRequestForModal && (
            <Modal
                isOpen={!!optOutRequestForModal}
                onClose={() => { /* Disallow easy close */ }}
                title="Yêu cầu Từ chối Khuyến mãi"
                titleIcon={<ShieldAlertIcon className="text-amber-500" />}
                footerContent={<>
                    <Button variant="secondary" onClick={() => {
                        acknowledgeOptOutRequest(optOutRequestForModal.promo.id, optOutRequestForModal.request.storeOwnerId);
                        setOptOutRequestForModal(null);
                    }}>Để sau</Button>
                    <Button variant="danger" onClick={() => setIsRejectionReasonModalOpen(true)}>Từ chối</Button>
                    <Button variant="primary" onClick={() => {
                        respondToOptOutRequest(optOutRequestForModal.promo.id, optOutRequestForModal.request.storeOwnerId, 'approved');
                        setOptOutRequestForModal(null);
                    }}>Phê duyệt</Button>
                </>}
            >
                <p className="text-text-body">
                    Chủ cửa hàng <strong className="text-text-heading">{findUserById(optOutRequestForModal.request.storeOwnerId)?.name || 'Không rõ'}</strong> đã gửi yêu cầu từ chối tham gia chương trình khuyến mãi toàn chuỗi:
                </p>
                <div className="mt-4 p-3 bg-bg-subtle rounded-lg border border-border-base">
                    <h4 className="font-bold text-lg text-text-heading">{optOutRequestForModal.promo.name}</h4>
                    <p className="text-sm mt-2 font-semibold">Lý do từ Chủ cửa hàng:</p>
                    <p className="text-sm italic text-text-muted">"{optOutRequestForModal.request.reason}"</p>
                </div>
            </Modal>
        )}

        {isRejectionReasonModalOpen && optOutRequestForModal && (
            <Modal
                isOpen={isRejectionReasonModalOpen}
                onClose={() => setIsRejectionReasonModalOpen(false)}
                title="Xác nhận Từ chối Yêu cầu"
                footerContent={<>
                    <Button variant="secondary" onClick={() => setIsRejectionReasonModalOpen(false)}>Hủy</Button>
                    <Button variant="danger" onClick={handleConfirmRejection} disabled={!rejectionReason.trim()}>Gửi & Từ chối</Button>
                </>}
            >
                <Input
                    isTextArea
                    rows={4}
                    label="Lý do từ chối (bắt buộc)*"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    required
                />
            </Modal>
        )}
      </div>
    );
  }

  // --- View for Owner, Manager, Staff ---
  // FIX: Derived customers from users array.
  const customers = useMemo(() => users.filter(u => u.role === UserRole.CUSTOMER), [users]);
  const waitingForConfirmationCount = orders.filter(o => o.status === OrderStatus.WAITING_FOR_CONFIRMATION).length;
  const pendingOrdersCount = orders.filter(o => o.status === OrderStatus.PENDING).length;
  const processingOrdersCount = orders.filter(o => o.status === OrderStatus.PROCESSING).length;
  const lowStockItemsCount = inventory.filter(item => item.quantity <= item.lowStockThreshold).length;
  const pendingMaterialOrdersCount = materialOrders.filter(mo => mo.status === 'Chờ duyệt').length;

  const pendingPromotionsForApprovalCount = useMemo(() => {
    if (!currentUser || (currentUser.role !== UserRole.OWNER && currentUser.role !== UserRole.CHAIRMAN)) {
      return 0;
    }

    return promotions.filter(p => {
      if (p.status !== 'pending') {
        return false;
      }
      
      const creator = findUserById(p.createdBy || '');
      // If no creator, it's a data issue, but we shouldn't show it for approval
      if (!creator) {
        return false;
      }

      // Chairman can approve any pending promotion (as per the approval logic)
      if (currentUser.role === UserRole.CHAIRMAN) {
        return true;
      }

      // Owner can approve promotions created by users they manage
      if (currentUser.role === UserRole.OWNER) {
        return creator.managedBy === currentUser.id;
      }

      return false;
    }).length;
  }, [promotions, currentUser, findUserById]);

  const quickStats: QuickStat[] = [
    { title: 'Đơn hàng chờ xác nhận', value: waitingForConfirmationCount, link: '/admin/orders?status=WAITING_FOR_CONFIRMATION', icon: <MessageSquareIcon />, colorClass: 'text-purple-700', iconBgClass: 'bg-purple-100' },
    { title: 'Đơn hàng chờ xử lý', value: pendingOrdersCount, link: '/admin/orders?status=PENDING', icon: <PackageIcon />, colorClass: 'text-status-warning-text', iconBgClass: 'bg-status-warning-bg' },
    { title: 'Đơn hàng đang xử lý', value: processingOrdersCount, link: '/admin/orders?status=PROCESSING', icon: <PackageIcon />, colorClass: 'text-status-info-text', iconBgClass: 'bg-status-info-bg' },
    { title: 'Tổng số khách hàng', value: customers.length, link: '/admin/customers', icon: <UsersIcon />, colorClass: 'text-status-success-text', iconBgClass: 'bg-status-success-bg' },
    { title: 'Mặt hàng tồn kho', value: inventory.length, link: '/admin/inventory', icon: <BarChart2Icon />, colorClass: 'text-brand-primary', iconBgClass: 'bg-blue-100' },
  ];

  const hasAlerts = lowStockItemsCount > 0 || pendingMaterialOrdersCount > 0 || pendingPromotionsForApprovalCount > 0;

  return (
    <div className="space-y-6">
        <h1 className="text-3xl font-bold text-text-heading">Bảng điều khiển</h1>
        <p className="text-text-body">Chào mừng, {currentUser?.name}. Tổng quan hoạt động của cửa hàng bạn.</p>
        
        {hasAlerts && (
            <Card title="Cảnh báo & Việc cần làm" icon={<AlertTriangleIcon size={20} className="text-status-warning"/>} className="border-l-4 border-status-warning !bg-status-warning-bg/60">
                <ul className="space-y-2 text-sm text-status-warning-text font-medium">
                    {lowStockItemsCount > 0 && (
                        <li className="flex items-center">
                            <ArrowRightIcon size={16} className="mr-2"/>
                            <Link to="/admin/inventory" className="hover:underline">Có <strong>{lowStockItemsCount}</strong> mặt hàng tồn kho sắp hết.</Link>
                        </li>
                    )}
                    {pendingMaterialOrdersCount > 0 && currentUser?.role !== UserRole.STAFF && (
                        <li className="flex items-center">
                            <ArrowRightIcon size={16} className="mr-2"/>
                            <Link to="/admin/material-orders" className="hover:underline">Có <strong>{pendingMaterialOrdersCount}</strong> đơn đặt NVL đang chờ bạn duyệt.</Link>
                        </li>
                    )}
                    {pendingPromotionsForApprovalCount > 0 && (currentUser?.role === UserRole.OWNER || currentUser?.role === UserRole.CHAIRMAN) && (
                        <li className="flex items-center">
                            <ArrowRightIcon size={16} className="mr-2"/>
                            <Link to="/admin/promotions" className="hover:underline">Có <strong>{pendingPromotionsForApprovalCount}</strong> chương trình khuyến mãi đang chờ bạn duyệt.</Link>
                        </li>
                    )}
                </ul>
            </Card>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            {quickStats.map(stat => (
              <Card key={stat.title} className={`border-l-4 ${stat.colorClass.replace('text-', 'border-')}`} contentClassName="!p-0">
                <Link to={stat.link} className="block hover:bg-bg-surface-hover p-5 rounded-xl">
                  <div className="flex items-center justify-between">
                      <div>
                          <p className="text-sm font-medium text-text-muted truncate">{stat.title}</p>
                          <p className="text-3xl font-semibold text-text-heading">{stat.value}</p>
                      </div>
                      <div className={`p-3 rounded-full ${stat.iconBgClass}`}>
                        {React.cloneElement(stat.icon as React.ReactElement<{ size?: number; className?: string }>, { size: 24, className: `${stat.colorClass}` })}
                      </div>
                  </div>
                </Link>
              </Card>
            ))}
        </div>
        
        <DashboardCharts />

        <AIFeedbackSummary />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card title="Dịch vụ được sử dụng nhiều nhất" icon={<BriefcaseIcon size={20} className="text-brand-primary"/>}>
                {topServices.length > 0 ? (
                    <ul className="space-y-3 text-sm">
                        {topServices.map(service => (
                            <li key={service.name} className="flex justify-between items-center p-2 bg-bg-subtle/50 rounded-md">
                                <span className="text-text-body">{service.name}</span>
                                <span className="font-semibold text-text-heading">{service.count} lượt</span>
                            </li>
                        ))}
                    </ul>
                ) : <p className="text-sm text-text-muted text-center py-4">Chưa có dữ liệu dịch vụ.</p>}
            </Card>

            <Card title="Hoạt động gần đây" icon={<ActivityIcon size={20} className="text-brand-primary"/>}>
                {recentActivities.length === 0 ? (
                    <p className="text-sm text-text-muted text-center py-4">Không có hoạt động nào gần đây.</p>
                ) : (
                    <ul className="space-y-3 text-sm text-text-body">
                        {recentActivities.map(activity => {
                            const activityUser = activity.userId ? findUserById(activity.userId) : null;
                            const activityUserName = activityUser ? `${activityUser.name} (${activityUser.role})` : (activity.userRole || 'Hệ thống');
                            return (
                                <li key={activity.id} className="flex items-start p-2 rounded-md hover:bg-bg-surface-hover transition-colors">
                                    <NotificationIcon type={activity.type} />
                                    <div className="flex-1">
                                      <p><strong className="text-text-heading">{activityUserName}: </strong>{activity.message}</p>
                                      <p className="text-xs text-text-muted mt-0.5">{new Date(activity.createdAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}</p>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </Card>
        </div>
        
        {promoForModal && (
            <Modal
                isOpen={!!promoForModal}
                onClose={() => handleAcknowledgeAndClosePromoModal(promoForModal.id)}
                title="Thông báo Khuyến mãi Mới từ Hệ thống"
                titleIcon={<MegaphoneIcon className="text-brand-primary" />}
                footerContent={<Button variant="primary" onClick={() => handleAcknowledgeAndClosePromoModal(promoForModal.id)}>Đã hiểu</Button>}
            >
                <p className="text-text-body">Chủ tịch đã ban hành một chương trình khuyến mãi mới áp dụng cho toàn chuỗi:</p>
                <div className="mt-4 p-3 bg-bg-subtle rounded-lg border border-border-base">
                    <h4 className="font-bold text-lg text-text-heading">{promoForModal.name}</h4>
                    <p className="font-mono text-sm text-brand-primary">{promoForModal.code}</p>
                    <p className="text-sm mt-2">Giảm {promoForModal.discountType === 'percentage' ? `${promoForModal.discountValue}%` : `${promoForModal.discountValue.toLocaleString('vi-VN')} VNĐ`}.</p>
                </div>
            </Modal>
        )}
        {cancelRequestForModal && (
            <Modal
                isOpen={!!cancelRequestForModal}
                onClose={() => handleAcknowledgeAndCloseCancelModal(cancelRequestForModal.id)}
                title="Yêu cầu Hủy Khuyến mãi từ Chủ tịch"
                titleIcon={<ShieldAlertIcon className="text-amber-500" />}
                footerContent={<Button variant="primary" onClick={() => handleAcknowledgeAndCloseCancelModal(cancelRequestForModal.id)}>Đã xem</Button>}
            >
                <p className="text-text-body">Chủ tịch đã yêu cầu bạn hủy chương trình khuyến mãi:</p>
                <div className="mt-4 p-3 bg-bg-subtle rounded-lg border border-border-base">
                    <h4 className="font-bold text-lg text-text-heading">{cancelRequestForModal.name}</h4>
                    <p className="text-sm mt-2 font-semibold">Lý do từ Chủ tịch:</p>
                    <p className="text-sm italic text-text-muted">"{cancelRequestForModal.cancellationRequest?.reason}"</p>
                    <p className="text-sm mt-3">Vui lòng vào trang "Quản lý Khuyến mãi" để xem xét và chấp thuận yêu cầu này.</p>
                </div>
            </Modal>
        )}
    </div>
  );
};

export default AdminDashboardPage;
