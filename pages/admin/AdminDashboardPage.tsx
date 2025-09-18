import React, { useMemo, useState, useEffect, useCallback } from 'react'; 
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { UserRole, Notification, User, OrderStatus, Promotion, InventoryAdjustmentRequest, CrmTask, PaymentStatus } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { PackageIcon, UsersIcon, ShoppingBagIcon, BarChart2Icon, AlertTriangleIcon, ArrowRightIcon, Settings2Icon, CheckCircle, InfoIcon, ActivityIcon, BriefcaseIcon, PlusCircleIcon, BuildingIcon, LineChartIcon, PieChartIcon, SparklesIcon, MessageSquareIcon, MessageCircleIcon, RefreshCwIcon, MegaphoneIcon, ShieldAlertIcon, XCircleIcon, XIcon, ClipboardListIcon, UserPlusIcon, StarIcon, ThumbsUp, ThumbsDown, Lightbulb, DollarSignIcon, TrendingUpIcon } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';
import { GoogleGenAI, Type } from "@google/genai";
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

const MyTasksWidget: React.FC = () => {
  const { crmTasks, findUserById } = useData();
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const myPendingTasks = useMemo(() => {
    if (!currentUser) return [];
    return crmTasks
      .filter(task => task.assignedToUserId === currentUser.id && task.status === 'pending')
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [crmTasks, currentUser]);

  const getDueDateInfo = (dueDate: Date): { text: string; colorClass: string } => {
    const now = new Date();
    const due = new Date(dueDate);
    now.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { text: `Quá hạn ${Math.abs(diffDays)} ngày`, colorClass: 'text-status-danger' };
    if (diffDays === 0) return { text: 'Hết hạn hôm nay', colorClass: 'text-status-warning-text' };
    return { text: `Còn ${diffDays} ngày`, colorClass: 'text-text-muted' };
  };

  if (myPendingTasks.length === 0) {
    return (
      <Card title="Công việc của tôi" icon={<ClipboardListIcon size={20} className="text-brand-primary" />}>
        <div className="text-center py-4">
          <CheckCircle size={32} className="mx-auto text-status-success mb-2" />
          <p className="text-text-muted">Tuyệt vời! Bạn không có công việc nào cần làm.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card title={`Công việc của tôi (${myPendingTasks.length})`} icon={<ClipboardListIcon size={20} className="text-brand-primary" />}>
      <div className="space-y-3 max-h-80 overflow-y-auto">
        {myPendingTasks.map(task => {
          const customer = findUserById(task.customerId);
          const dueDateInfo = getDueDateInfo(task.dueDate);
          return (
            <div key={task.id} className="p-2.5 bg-bg-subtle/50 rounded-md border-l-4 border-brand-primary/50">
              <p className="font-semibold text-text-body leading-tight">{task.title}</p>
              {customer && (
                <p className="text-sm text-text-muted">
                  KH: <Link to={`/admin/customers/${task.customerId}`} className="hover:underline text-brand-primary">{customer.name}</Link>
                </p>
              )}
              <div className="flex justify-between items-center mt-1">
                <span className={`text-xs font-medium ${dueDateInfo.colorClass}`}>{dueDateInfo.text}</span>
                 <Button variant="ghost" size="sm" className="text-xs !p-1" onClick={() => navigate(`/admin/customers/${task.customerId}?tab=tasks`)}>Chi tiết</Button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};


const CrmAnalyticsWidget: React.FC = () => {
    const { users, orders, findUserById } = useData();

    const crmMetrics = useMemo(() => {
        const customers = users.filter(u => u.role === UserRole.CUSTOMER);
        
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const ordersThisMonth = orders.filter(o => new Date(o.createdAt) >= startOfMonth);
        const customerIdsThisMonth = [...new Set(ordersThisMonth.map(o => o.customer.id))];
        
        const newCustomerCount = customerIdsThisMonth.filter(id => {
            const user = findUserById(id);
            return user && user.customerSince && new Date(user.customerSince) >= startOfMonth;
        }).length;
        const returningCustomerCount = customerIdsThisMonth.length - newCustomerCount;
        
        const vipCustomerCount = customers.filter(c => c.tags?.includes('VIP')).length;

        const interactionCounts = customers
            .flatMap(c => c.interactionHistory || [])
            .reduce((acc, interaction) => {
                acc[interaction.channel] = (acc[interaction.channel] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

        return {
            newCustomerCount,
            returningCustomerCount,
            totalCustomersThisMonth: customerIdsThisMonth.length,
            vipCustomerCount,
            interactionCounts,
        };
    }, [users, orders, findUserById]);
    
    const interactionLabels: Record<string, string> = {
        'in-person': 'Trực tiếp',
        'phone': 'Điện thoại',
        'sms': 'SMS',
        'email': 'Email',
        'other': 'Khác'
    };

    return (
        <Card title="Phân tích CRM" icon={<BarChart2Icon size={20} className="text-brand-primary" />}>
            <div className="space-y-4">
                <div className="flex items-center space-x-4">
                    <UserPlusIcon size={28} className="text-status-success" />
                    <div>
                        <p className="font-semibold text-text-heading">{crmMetrics.totalCustomersThisMonth} Khách hàng tháng này</p>
                        <p className="text-sm text-text-muted">{crmMetrics.newCustomerCount} mới / {crmMetrics.returningCustomerCount} quay lại</p>
                    </div>
                </div>
                <div className="flex items-center space-x-4">
                    <StarIcon size={28} className="text-amber-500" />
                    <div>
                        <p className="font-semibold text-text-heading">{crmMetrics.vipCustomerCount} Khách hàng VIP</p>
                        <p className="text-sm text-text-muted">Tổng số khách hàng có tag 'VIP'</p>
                    </div>
                </div>
                 <div className="pt-3 border-t border-border-base">
                    <p className="font-semibold text-text-heading mb-2">Loại tương tác đã ghi nhận:</p>
                    <div className="space-y-1 text-sm">
                       {Object.entries(crmMetrics.interactionCounts).length > 0 ? (
                           Object.entries(crmMetrics.interactionCounts).map(([channel, count]) => (
                               <div key={channel} className="flex justify-between">
                                   <span className="text-text-muted">{interactionLabels[channel] || channel}:</span>
                                   <span className="font-medium text-text-body">{count}</span>
                               </div>
                           ))
                       ) : (
                           <p className="text-sm text-text-muted italic">Chưa có tương tác nào được ghi nhận.</p>
                       )}
                    </div>
                </div>
            </div>
        </Card>
    );
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
    // FIX: Re-implemented with a Map to ensure type safety and avoid arithmetic operation errors on potentially undefined keys.
    const statusCounts = new Map<OrderStatus, number>([
      [OrderStatus.PENDING, 0],
      [OrderStatus.PROCESSING, 0],
      [OrderStatus.COMPLETED, 0],
    ]);
    orders.forEach(order => {
      if (statusCounts.has(order.status)) {
        statusCounts.set(order.status, (statusCounts.get(order.status) || 0) + 1);
      }
    });
    return [
      { name: OrderStatus.PENDING, value: statusCounts.get(OrderStatus.PENDING) || 0 },
      { name: OrderStatus.PROCESSING, value: statusCounts.get(OrderStatus.PROCESSING) || 0 },
      { name: OrderStatus.COMPLETED, value: statusCounts.get(OrderStatus.COMPLETED) || 0 },
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
              <Pie data={orderStatusData} cx="50%" cy="50%" outerRadius={80} fill="#8884d8" dataKey="value" nameKey="name" labelLine={false} label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}>
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

const AIFeedbackAnalysis: React.FC = () => {
  const { serviceRatings, staffRatings, addNotification } = useData();
  const [analysis, setAnalysis] = useState<{ sentimentScore: number; positiveTopics: string[]; negativeTopics: string[]; actionableSuggestion: string; } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAnalyzeFeedback = useCallback(async () => {
    setIsLoading(true);
    setError('');
    setAnalysis(null);

    try {
      if (!process.env.API_KEY) throw new Error("API key is not configured.");

      const allComments = [...serviceRatings.map(r => r.comment), ...staffRatings.map(r => r.comment)].filter(Boolean);

      if (allComments.length < 3) {
        setError("Chưa có đủ bình luận của khách hàng để tạo phân tích.");
        setIsLoading(false);
        return;
      }

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const schema = {
        type: Type.OBJECT,
        properties: {
            sentimentScore: { type: Type.NUMBER, description: "A sentiment score from 0 (very negative) to 100 (very positive) based on all comments." },
            positiveTopics: { type: Type.ARRAY, description: "An array of 2-3 key positive topics or keywords mentioned frequently (in Vietnamese). E.g., ['Giao hàng nhanh', 'Sạch sẽ']", items: { type: Type.STRING } },
            negativeTopics: { type: Type.ARRAY, description: "An array of 2-3 key negative topics or keywords mentioned frequently (in Vietnamese). E.g., ['Cổ áo còn bẩn', 'Giao trễ']", items: { type: Type.STRING } },
            actionableSuggestion: { type: Type.STRING, description: "One single, concise, and actionable suggestion for the store manager to improve service based on the feedback." }
        }
      };
      
      const prompt = `Bạn là chuyên gia phân tích dịch vụ khách hàng cho tiệm giặt là ${APP_NAME}. Dựa trên các bình luận dưới đây, hãy tạo một phân tích JSON ngắn gọn.
      
      Yêu cầu phân tích:
      1.  **sentimentScore:** Một con số từ 0 (rất tiêu cực) đến 100 (rất tích cực) thể hiện tâm trạng chung.
      2.  **positiveTopics:** Một mảng chứa 2-3 chủ đề/từ khóa tích cực được nhắc đến nhiều nhất (bằng tiếng Việt).
      3.  **negativeTopics:** Một mảng chứa 2-3 chủ đề/từ khóa tiêu cực được nhắc đến nhiều nhất (bằng tiếng Việt).
      4.  **actionableSuggestion:** Một đề xuất hành động duy nhất, ngắn gọn, và khả thi cho quản lý cửa hàng để cải thiện dịch vụ.
      
      Chỉ trả về đối tượng JSON theo schema đã cung cấp.
      
      Bình luận của khách hàng:
      ${allComments.map(c => `- ${c}`).join('\n')}
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: "application/json", responseSchema: schema },
      });

      // FIX: Added .trim() to response.text to handle potential whitespace before JSON parsing.
      setAnalysis(JSON.parse(response.text.trim()));

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
  
  const scoreColor = analysis ? (analysis.sentimentScore > 75 ? 'bg-green-500' : analysis.sentimentScore > 50 ? 'bg-yellow-500' : 'bg-red-500') : 'bg-gray-300';

  return (
    <Card 
      title="Phân tích Phản hồi Khách hàng bởi AI" 
      icon={<MessageCircleIcon size={20} className="text-brand-primary"/>}
      actions={ <Button onClick={handleAnalyzeFeedback} disabled={isLoading} size="sm" variant="ghost"> <RefreshCwIcon size={16} className={isLoading ? 'animate-spin' : ''}/> </Button> }
    >
      {isLoading && <div className="flex justify-center items-center h-40"><Spinner /></div>}
      {error && !isLoading && <p className="text-status-danger-text text-center p-4">{error}</p>}
      {!isLoading && !error && analysis && (
        <div className="space-y-4">
            <div>
                <p className="text-sm font-medium text-text-muted text-center mb-1">Điểm Tâm trạng Chung</p>
                <div className="w-full bg-bg-subtle rounded-full h-4">
                    <div className={`h-4 rounded-full ${scoreColor} transition-all duration-500`} style={{ width: `${analysis.sentimentScore}%` }}></div>
                </div>
                <p className="text-center font-bold text-2xl mt-1">{analysis.sentimentScore}<span className="text-sm font-normal text-text-muted">/100</span></p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-border-base">
                <div>
                    <h4 className="font-semibold text-text-heading flex items-center mb-2"><ThumbsUp size={16} className="mr-2 text-status-success"/>Chủ đề Tích cực</h4>
                    <div className="space-y-1">
                        {analysis.positiveTopics.map((topic, i) => <span key={i} className="inline-block bg-green-100 text-green-800 text-xs font-medium mr-2 px-2.5 py-0.5 rounded-full">{topic}</span>)}
                    </div>
                </div>
                 <div>
                    <h4 className="font-semibold text-text-heading flex items-center mb-2"><ThumbsDown size={16} className="mr-2 text-status-danger"/>Chủ đề Tiêu cực</h4>
                    <div className="space-y-1">
                        {analysis.negativeTopics.map((topic, i) => <span key={i} className="inline-block bg-red-100 text-red-800 text-xs font-medium mr-2 px-2.5 py-0.5 rounded-full">{topic}</span>)}
                    </div>
                </div>
            </div>
            <div className="pt-3 border-t border-border-base">
                 <h4 className="font-semibold text-text-heading flex items-center mb-2"><Lightbulb size={16} className="mr-2 text-amber-500"/>Đề xuất Hành động</h4>
                 <p className="text-sm text-text-body p-3 bg-amber-50 border border-amber-200 rounded-md">{analysis.actionableSuggestion}</p>
            </div>
        </div>
      )}
    </Card>
  );
};


const AdminDashboardPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { 
    orders, suppliers, inventory, users, notifications, findUserById,
    getOwnerIdForUser, materialOrders, findStoreProfileByOwnerId, serviceRatings, staffRatings,
    promotions, acknowledgedSystemPromos, acknowledgedCancelRequests, acknowledgeSystemPromo, acknowledgeCancelRequest,
    respondToOptOutRequest, acknowledgeOptOutRequest, acknowledgedOptOutRequests, inventoryAdjustmentRequests,
    acknowledgedRejectedRequests, acknowledgeRejectedRequest
  } = useData();
  const navigate = useNavigate();

  const [promoForModal, setPromoForModal] = useState<Promotion | null>(null);
  const [cancelRequestForModal, setCancelRequestForModal] = useState<Promotion | null>(null);
  const [optOutRequestForModal, setOptOutRequestForModal] = useState<{ promo: Promotion; request: NonNullable<Promotion['optOutRequests']>[0] } | null>(null);
  const [isRejectionReasonModalOpen, setIsRejectionReasonModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

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

  const isChairman = currentUser?.role === UserRole.CHAIRMAN;
  const isOwnerOrManager = currentUser && (currentUser.role === UserRole.OWNER || currentUser.role === UserRole.MANAGER);

  interface QuickStat {
    title: string;
    value: string;
    link: string;
    icon: React.ReactNode;
    colorClass: string; 
    iconBgClass: string; 
  }
  
  if (isChairman) {
    const totalRevenue = orders
        .filter(o => o.status !== OrderStatus.CANCELLED && o.status !== OrderStatus.DELETED_BY_ADMIN)
        .reduce((sum, o) => sum + o.totalAmount, 0);
    const actualRevenue = orders
        .filter(o => o.paymentStatus === PaymentStatus.PAID)
        .reduce((sum, o) => sum + o.totalAmount, 0);

    const chairmanQuickStats: QuickStat[] = [
       { title: 'Doanh thu (Toàn chuỗi)', value: `${(totalRevenue / 1000000).toFixed(2)} tr`, link: '/admin/reports', icon: <TrendingUpIcon />, colorClass: 'text-indigo-700', iconBgClass: 'bg-indigo-100' },
       { title: 'Thực thu (Toàn chuỗi)', value: `${(actualRevenue / 1000000).toFixed(2)} tr`, link: '/admin/reports', icon: <DollarSignIcon />, colorClass: 'text-green-700', iconBgClass: 'bg-green-100' },
       { title: 'Tổng ĐH toàn chuỗi', value: orders.length.toLocaleString('vi-VN'), link: '#', icon: <PackageIcon />, colorClass: 'text-status-info-text', iconBgClass: 'bg-status-info-bg' },
       { title: 'Tổng số Chủ Cửa hàng', value: users.filter(u=> u.role === UserRole.OWNER).length.toLocaleString('vi-VN'), link: '/admin/users', icon: <UsersIcon />, colorClass: 'text-purple-700', iconBgClass: 'bg-purple-100' },
    ];

    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-text-heading">Bảng điều khiển Chủ tịch</h1>
        <p className="text-text-body">Chào mừng, {currentUser?.name}. Tại đây bạn có thể quản lý các Chủ cửa hàng và theo dõi hoạt động chung của chuỗi.</p>
        
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CrmAnalyticsWidget />
            <AIFeedbackAnalysis />
        </div>

        <DashboardCharts />

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
  const customers = useMemo(() => users.filter(u => u.role === UserRole.CUSTOMER), [users]);
  const waitingForConfirmationCount = orders.filter(o => o.status === OrderStatus.WAITING_FOR_CONFIRMATION).length;
  const pendingOrdersCount = orders.filter(o => o.status === OrderStatus.PENDING).length;
  const processingOrdersCount = orders.filter(o => o.status === OrderStatus.PROCESSING).length;
  const lowStockItemsCount = inventory.filter(item => item.quantity <= item.lowStockThreshold).length;
  const pendingMaterialOrdersCount = materialOrders.filter(mo => mo.status === 'Chờ duyệt').length;
  const pendingInventoryRequestsCount = useMemo(() => inventoryAdjustmentRequests.filter(req => req.status === 'pending').length, [inventoryAdjustmentRequests]);
  const unacknowledgedRejectedRequests = useMemo(() => {
    if (!currentUser) return [];
    return inventoryAdjustmentRequests.filter(
      req => req.status === 'rejected' && 
             req.requestedByUserId === currentUser.id &&
             !acknowledgedRejectedRequests.includes(req.id)
    );
  }, [inventoryAdjustmentRequests, currentUser, acknowledgedRejectedRequests]);

  const isToday = (someDate: Date) => {
    const today = new Date();
    return someDate.getDate() === today.getDate() &&
      someDate.getMonth() === today.getMonth() &&
      someDate.getFullYear() === today.getFullYear();
  };
  const todaysOrders = orders.filter(o => isToday(new Date(o.createdAt)));

  const totalRevenue = todaysOrders
      .filter(o => o.status !== OrderStatus.CANCELLED && o.status !== OrderStatus.DELETED_BY_ADMIN)
      .reduce((sum, o) => sum + o.totalAmount, 0);
  const actualRevenue = todaysOrders
      .filter(o => o.paymentStatus === PaymentStatus.PAID)
      .reduce((sum, o) => sum + o.totalAmount, 0);


  const pendingPromotionsForApprovalCount = useMemo(() => {
    if (!currentUser || (currentUser.role !== UserRole.OWNER && currentUser.role !== UserRole.CHAIRMAN)) {
      return 0;
    }

    return promotions.filter(p => {
      if (p.status !== 'pending') {
        return false;
      }
      
      const creator = findUserById(p.createdBy || '');
      if (!creator) {
        return false;
      }

      if (currentUser.role === UserRole.CHAIRMAN) {
        return true;
      }

      if (currentUser.role === UserRole.OWNER) {
        return creator.managedBy === currentUser.id;
      }

      return false;
    }).length;
  }, [promotions, currentUser, findUserById]);
  
  const pendingManagerReportsCount = useMemo(() => {
    if (currentUser?.role !== UserRole.OWNER) return 0;
    return promotions.filter(p => p.ownerId === currentUser.id && p.managerReports?.some(r => r.status === 'pending')).length;
  }, [promotions, currentUser]);


  const quickStats: QuickStat[] = [
    { title: 'Doanh thu (Hôm nay)', value: `${(totalRevenue / 1000).toFixed(0)}k`, link: '/admin/reports', icon: <TrendingUpIcon />, colorClass: 'text-indigo-700', iconBgClass: 'bg-indigo-100' },
    { title: 'Thực thu (Hôm nay)', value: `${(actualRevenue / 1000).toFixed(0)}k`, link: '/admin/reports', icon: <DollarSignIcon />, colorClass: 'text-green-700', iconBgClass: 'bg-green-100' },
    { title: 'Đơn hàng chờ xử lý', value: pendingOrdersCount.toLocaleString('vi-VN'), link: '/admin/orders?status=PENDING', icon: <PackageIcon />, colorClass: 'text-status-warning-text', iconBgClass: 'bg-status-warning-bg' },
    { title: 'Đơn hàng đang xử lý', value: processingOrdersCount.toLocaleString('vi-VN'), link: '/admin/orders?status=PROCESSING', icon: <PackageIcon />, colorClass: 'text-status-info-text', iconBgClass: 'bg-status-info-bg' },
    { title: 'Tổng số khách hàng', value: customers.length.toLocaleString('vi-VN'), link: '/admin/customers', icon: <UsersIcon />, colorClass: 'text-status-success-text', iconBgClass: 'bg-status-success-bg' },
  ];

  const hasAlerts = lowStockItemsCount > 0 || pendingMaterialOrdersCount > 0 || pendingPromotionsForApprovalCount > 0 || pendingManagerReportsCount > 0 || pendingInventoryRequestsCount > 0 || unacknowledgedRejectedRequests.length > 0 || waitingForConfirmationCount > 0;

  return (
    <div className="space-y-6">
        <h1 className="text-3xl font-bold text-text-heading">Bảng điều khiển</h1>
        <p className="text-text-body">Chào mừng, {currentUser?.name}. Tổng quan hoạt động của cửa hàng bạn.</p>
        
        {hasAlerts && (
            <Card title="Cảnh báo & Việc cần làm" icon={<AlertTriangleIcon size={20} className="text-status-warning"/>} className="border-l-4 border-status-warning !bg-status-warning-bg/60">
                <ul className="space-y-3 text-sm font-medium">
                    {waitingForConfirmationCount > 0 && (
                        <li className="flex items-start text-purple-700">
                            <ArrowRightIcon size={16} className="mr-2 mt-0.5 flex-shrink-0"/>
                            <div><Link to="/admin/orders?status=WAITING_FOR_CONFIRMATION" className="hover:underline">Có <strong>{waitingForConfirmationCount}</strong> đơn hàng do khách tạo đang chờ bạn xác nhận.</Link></div>
                        </li>
                    )}
                    {lowStockItemsCount > 0 && (
                        <li className="flex items-start text-status-warning-text">
                            <ArrowRightIcon size={16} className="mr-2 mt-0.5 flex-shrink-0"/>
                            <div><Link to="/admin/inventory" className="hover:underline">Có <strong>{lowStockItemsCount}</strong> mặt hàng tồn kho sắp hết.</Link></div>
                        </li>
                    )}
                    {pendingInventoryRequestsCount > 0 && (currentUser?.role === UserRole.OWNER || currentUser?.role === UserRole.MANAGER) && (
                        <li className="flex items-start text-status-warning-text">
                            <ArrowRightIcon size={16} className="mr-2 mt-0.5 flex-shrink-0"/>
                            <div><Link to="/admin/inventory" className="hover:underline">Có <strong>{pendingInventoryRequestsCount}</strong> yêu cầu điều chỉnh tồn kho đang chờ duyệt.</Link></div>
                        </li>
                    )}
                    {unacknowledgedRejectedRequests.length > 0 && (
                        <li className="flex items-start text-status-danger-text">
                            <XCircleIcon size={16} className="mr-2 mt-0.5 flex-shrink-0"/>
                            <div>
                                <p className="font-bold">Bạn có yêu cầu điều chỉnh tồn kho <span className="text-status-danger">bị từ chối</span>:</p>
                                <ul className="list-disc pl-5 mt-1 space-y-1 text-sm">
                                    {unacknowledgedRejectedRequests.map(req => (
                                        <li key={req.id} className="flex justify-between items-center">
                                            <span>
                                                <Link to="/admin/inventory" className="hover:underline font-normal text-text-body">{req.inventoryItemName}</Link>
                                            </span>
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                className="p-1 h-auto text-xs text-text-muted hover:bg-black/10"
                                                onClick={() => acknowledgeRejectedRequest(req.id)}
                                                aria-label={`Đánh dấu đã xem cảnh báo cho ${req.inventoryItemName}`}
                                            >
                                                <XIcon size={14} className="mr-1"/> Đã xem
                                            </Button>
                                        </li>
                                    ))}
                                </ul>
                                <p className="text-xs text-text-muted mt-1">Hãy kiểm tra lại lý do trong trang Tồn kho.</p>
                            </div>
                        </li>
                    )}
                    {pendingMaterialOrdersCount > 0 && currentUser?.role !== UserRole.STAFF && (
                        <li className="flex items-start text-status-warning-text">
                            <ArrowRightIcon size={16} className="mr-2 mt-0.5 flex-shrink-0"/>
                           <div> <Link to="/admin/material-orders" className="hover:underline">Có <strong>{pendingMaterialOrdersCount}</strong> đơn đặt NVL đang chờ bạn duyệt.</Link></div>
                        </li>
                    )}
                    {pendingPromotionsForApprovalCount > 0 && (currentUser?.role === UserRole.OWNER || currentUser?.role === UserRole.CHAIRMAN) && (
                        <li className="flex items-start text-status-warning-text">
                            <ArrowRightIcon size={16} className="mr-2 mt-0.5 flex-shrink-0"/>
                            <div><Link to="/admin/promotions" className="hover:underline">Có <strong>{pendingPromotionsForApprovalCount}</strong> chương trình khuyến mãi đang chờ bạn duyệt.</Link></div>
                        </li>
                    )}
                    {pendingManagerReportsCount > 0 && currentUser?.role === UserRole.OWNER && (
                        <li className="flex items-start text-status-warning-text">
                            <ArrowRightIcon size={16} className="mr-2 mt-0.5 flex-shrink-0"/>
                            <div><Link to="/admin/promotions" className="hover:underline">Có <strong>{pendingManagerReportsCount}</strong> báo cáo khuyến mãi từ quản lý cần xem xét.</Link></div>
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

        {(isOwnerOrManager || isChairman) && <AIFeedbackAnalysis />}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <MyTasksWidget />
            {(isOwnerOrManager || isChairman) && <CrmAnalyticsWidget />}
            {!(isOwnerOrManager || isChairman) && 
                <Card title="Hoạt động gần đây" icon={<ActivityIcon size={20} className="text-brand-primary"/>}>
                    {recentActivities.length === 0 ? (
                        <p className="text-sm text-text-muted text-center py-4">Không có hoạt động nào gần đây.</p>
                    ) : (
                        <ul className="space-y-3 text-sm text-text-body max-h-80 overflow-y-auto">
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
            }
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
