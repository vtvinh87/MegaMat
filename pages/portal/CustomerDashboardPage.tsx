

import React, { useState, useMemo, FormEvent, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { User, Order, OrderStatus } from '../../types';
import { User as UserIcon, AwardIcon, ListOrderedIcon, SaveIcon, PackageIcon, CalendarDaysIcon, DollarSignIcon, ChevronLeftIcon, ChevronRightIcon, ShoppingCartIcon, MessageCircleIcon, KeyIcon, AlertTriangleIcon, ClockIcon, ZapIcon, CheckCircleIcon, XIcon, PackageCheckIcon, InfoIcon, ListIcon, StarIcon, MapPinIcon } from 'lucide-react';
import { CreateOrderTab } from '../public/customer-home/CreateOrderTab';
import { AIAssistantTab } from '../public/customer-home/AIAssistantTab';
import { RatingTipModal } from '../../components/shared/RatingTipModal';
import { QRCodeDisplay } from '../../components/shared/QRCodeDisplay';

const ITEMS_PER_PAGE = 5;

// Helper components & functions moved inside for encapsulation
const getStatusInfo = (status: OrderStatus): { textColor: string; bgColor: string; borderColor: string; text: string; icon?: React.ReactNode } => {
    switch (status) {
      case OrderStatus.WAITING_FOR_CONFIRMATION: return { textColor: 'text-purple-800', bgColor: 'bg-purple-100', borderColor: 'border-purple-400', text: OrderStatus.WAITING_FOR_CONFIRMATION, icon: <MessageCircleIcon size={14} className="mr-1.5" /> };
      case OrderStatus.PENDING: return { textColor: 'text-status-warning-text', bgColor: 'bg-status-warning-bg', borderColor: 'border-yellow-400', text: OrderStatus.PENDING, icon: <ClockIcon size={14} className="mr-1.5" /> };
      case OrderStatus.PROCESSING: return { textColor: 'text-status-info-text', bgColor: 'bg-status-info-bg', borderColor: 'border-blue-400', text: OrderStatus.PROCESSING, icon: <ZapIcon size={14} className="mr-1.5" /> };
      case OrderStatus.COMPLETED: return { textColor: 'text-status-success-text', bgColor: 'bg-status-success-bg', borderColor: 'border-green-400', text: OrderStatus.COMPLETED, icon: <CheckCircleIcon size={14} className="mr-1.5" /> };
      case OrderStatus.CANCELLED: return { textColor: 'text-status-danger-text', bgColor: 'bg-status-danger-bg', borderColor: 'border-red-400', text: OrderStatus.CANCELLED, icon: <XIcon size={14} className="mr-1.5" /> };
      case OrderStatus.RETURNED: return { textColor: 'text-text-on-primary', bgColor: 'bg-brand-primary', borderColor: 'border-brand-primary-focus', text: OrderStatus.RETURNED, icon: <PackageCheckIcon size={14} className="mr-1.5" /> };
      default: return { textColor: 'text-text-muted', bgColor: 'bg-bg-subtle', borderColor: 'border-border-base', text: status, icon: <InfoIcon size={14} className="mr-1.5" /> };
    }
};

const getRemainingTime = (estCompletion?: Date): string => {
    if (!estCompletion) return 'N/A';
    const diffMs = new Date(estCompletion).getTime() - new Date().getTime();
    if (diffMs <= 0) return 'Đã xong hoặc quá hạn';
    const hrs = Math.floor(diffMs / 3600000);
    const mins = Math.floor((diffMs % 3600000) / 60000);
    return `${hrs} giờ ${mins} phút`;
};

const DetailItem: React.FC<{ label: string; children: React.ReactNode; dtCls?: string; ddCls?: string; }> =
    ({ label, children, dtCls = '', ddCls = '' }) => (
      <div className="flex justify-between py-1.5">
        <dt className={`text-sm font-medium text-text-muted ${dtCls}`}>{label}</dt>
        <dd className={`text-sm text-text-body text-right ${ddCls}`}>{children}</dd>
      </div>
);


const CustomerDashboardPage: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const { orders: allOrders, updateUser, addNotification } = useData();

  const [activeTab, setActiveTab] = useState<'history' | 'createOrder' | 'aiAssistant'>('history');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: currentUser?.name || '',
    address: currentUser?.address || '',
    newPassword: '',
    confirmNewPassword: '',
  });
  const [editError, setEditError] = useState<string | null>(null);
  
  // State for order history view
  const [currentPage, setCurrentPage] = useState(1);
  const [detailedOrder, setDetailedOrder] = useState<Order | null>(null);
  
  // State for rating modal
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [orderIdForRating, setOrderIdForRating] = useState<string | null>(null);
  
  useEffect(() => {
    if (isEditingProfile && currentUser) {
        setEditFormData({
            name: currentUser.name,
            address: currentUser.address || '',
            newPassword: '',
            confirmNewPassword: '',
        });
        setEditError(null);
    }
  }, [isEditingProfile, currentUser]);

  const customerOrders = useMemo(() => {
    if (!currentUser) return [];
    return allOrders
      .filter(order => order.customer.id === currentUser.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [allOrders, currentUser]);

  const totalPages = Math.ceil(customerOrders.length / ITEMS_PER_PAGE);
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return customerOrders.slice(start, start + ITEMS_PER_PAGE);
  }, [customerOrders, currentPage]);
  
  useEffect(() => {
    // Reset to list view when switching tabs
    setDetailedOrder(null);
  }, [activeTab]);


  if (!currentUser) {
    return <p>Vui lòng đăng nhập để xem trang này.</p>;
  }
  
  const openRatingModal = (orderId: string) => {
    setOrderIdForRating(orderId);
    setIsRatingModalOpen(true);
  };
  
  const handleProfileUpdate = (e: FormEvent) => {
    e.preventDefault();
    setEditError(null);

    const { name, address, newPassword, confirmNewPassword } = editFormData;

    if (!name.trim()) {
      setEditError("Tên không được để trống.");
      return;
    }

    if (newPassword && newPassword !== confirmNewPassword) {
      setEditError("Mật khẩu mới không khớp.");
      return;
    }

    const userUpdatePayload: User = {
      ...currentUser,
      name: name.trim(),
      address: address.trim() || undefined,
    };
    
    if (newPassword) {
      (userUpdatePayload as any).password = newPassword;
    }

    updateUser(userUpdatePayload).then(success => {
      if (success) {
        setIsEditingProfile(false);
        addNotification({ message: "Đã cập nhật thông tin cá nhân.", type: 'success', showToast: true });
      } else {
        setEditError("Không thể cập nhật thông tin. Vui lòng thử lại.");
      }
    });
  };
  
  const TABS = [
    { id: 'history', label: 'Lịch sử Đơn hàng', icon: <ListOrderedIcon size={18}/> },
    { id: 'createOrder', label: 'Đặt lịch Giặt là', icon: <ShoppingCartIcon size={18}/> },
    { id: 'aiAssistant', label: 'Trợ Lý AI', icon: <MessageCircleIcon size={18}/> },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-text-heading">Chào mừng, {currentUser.name}!</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profile Card */}
        <Card title="Thông tin của tôi" icon={<UserIcon size={20} />} className="md:col-span-1">
          {isEditingProfile ? (
            <form onSubmit={handleProfileUpdate} className="space-y-4">
              {editError && <p className="text-sm text-status-danger flex items-center"><AlertTriangleIcon size={16} className="mr-1.5"/>{editError}</p>}
              <Input label="Tên" value={editFormData.name} onChange={e => setEditFormData({...editFormData, name: e.target.value })} required />
              <Input label="Số điện thoại" value={currentUser.phone} disabled />
              <Input label="Địa chỉ" value={editFormData.address} onChange={e => setEditFormData({...editFormData, address: e.target.value })} />
              <Input label="Mật khẩu mới (để trống nếu không đổi)" type="password" value={editFormData.newPassword} onChange={e => setEditFormData({...editFormData, newPassword: e.target.value })} leftIcon={<KeyIcon size={16}/>} />
              <Input label="Xác nhận mật khẩu mới" type="password" value={editFormData.confirmNewPassword} onChange={e => setEditFormData({...editFormData, confirmNewPassword: e.target.value })} leftIcon={<KeyIcon size={16}/>} />
              <div className="flex space-x-2">
                <Button type="button" variant="secondary" onClick={() => { setIsEditingProfile(false); }}>Hủy</Button>
                <Button type="submit" leftIcon={<SaveIcon size={16} />}>Lưu</Button>
              </div>
            </form>
          ) : (
            <div className="space-y-2 text-sm">
              <p><strong className="text-text-muted">Tên:</strong> {currentUser.name}</p>
              <p><strong className="text-text-muted">SĐT:</strong> {currentUser.phone}</p>
              <p><strong className="text-text-muted">Địa chỉ:</strong> {currentUser.address || 'Chưa có'}</p>
              <Button variant="link" onClick={() => setIsEditingProfile(true)} className="!p-0 !text-sm mt-2">Chỉnh sửa thông tin & mật khẩu</Button>
            </div>
          )}
        </Card>
        
        {/* Loyalty Card */}
        <Card title="Điểm tích lũy" icon={<AwardIcon size={20} />} className="md:col-span-2 flex items-center justify-center text-center">
            <div>
                <p className="text-5xl font-bold text-amber-500">{currentUser.loyaltyPoints || 0}</p>
                <p className="text-text-muted mt-1">điểm</p>
            </div>
        </Card>
      </div>
      
      {/* Tabbed Section */}
      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 border-b border-border-base pb-4 mb-4">
          {TABS.map(tab => (
            <Button 
              key={tab.id} 
              variant={activeTab === tab.id ? 'primary' : 'secondary'} 
              onClick={() => setActiveTab(tab.id as any)}
              className={`w-full justify-center py-2.5 sm:py-3 ${activeTab === tab.id ? 'shadow-sm' : ''}`}
              leftIcon={React.cloneElement(tab.icon, {className: `mr-2 ${activeTab === tab.id ? 'text-text-on-primary' : 'text-brand-primary'}`})}
            >
              {tab.label}
            </Button>
          ))}
        </div>
        
        {activeTab === 'history' && (
          <div>
            {detailedOrder ? (
               <Card className="mt-6 bg-bg-subtle">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-semibold text-text-heading">Chi tiết Đơn hàng: {detailedOrder.id}</h3>
                    <Button variant="ghost" onClick={() => setDetailedOrder(null)} size="sm" leftIcon={<ListIcon size={16} />}>Xem danh sách</Button>
                  </div>
                  <dl className="divide-y divide-border-base">
                    <DetailItem label="Trạng thái:">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold inline-flex items-center ${getStatusInfo(detailedOrder.status).bgColor} ${getStatusInfo(detailedOrder.status).textColor} border ${getStatusInfo(detailedOrder.status).borderColor}`}>
                        {getStatusInfo(detailedOrder.status).icon}
                        {getStatusInfo(detailedOrder.status).text}
                      </span>
                    </DetailItem>
                    <DetailItem label="Ngày tạo:">
                      <span className="flex items-center justify-end"><CalendarDaysIcon size={14} className="mr-1.5 text-text-muted" /> {new Date(detailedOrder.createdAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}</span>
                    </DetailItem>
                    <DetailItem label="Tổng tiền:">
                      <span className="font-bold text-brand-primary flex items-center justify-end"><DollarSignIcon size={14} className="mr-1" /> {detailedOrder.totalAmount.toLocaleString('vi-VN')} VNĐ</span>
                    </DetailItem>
                    {detailedOrder.pickupLocation && (
                      <DetailItem label="Vị trí để đồ:">
                        <span className="flex items-center justify-end"><MapPinIcon size={14} className="mr-1.5 text-text-muted" /> {detailedOrder.pickupLocation}</span>
                      </DetailItem>
                    )}
                    {(detailedOrder.status === OrderStatus.PROCESSING || detailedOrder.status === OrderStatus.PENDING) && detailedOrder.estimatedCompletionTime && (
                      <DetailItem label={detailedOrder.status === OrderStatus.PENDING ? "Dự kiến trả:" : "Dự kiến xong trong:"}>
                        <span className="flex items-center justify-end text-status-info-text">
                          <ClockIcon size={14} className="mr-1.5" />
                          {detailedOrder.status === OrderStatus.PENDING
                            ? new Date(detailedOrder.estimatedCompletionTime).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
                            : getRemainingTime(detailedOrder.estimatedCompletionTime)}
                        </span>
                      </DetailItem>
                    )}
                    {detailedOrder.notes && (
                      <DetailItem label="Ghi chú đơn hàng:" dtCls="self-start pt-1.5" ddCls="whitespace-pre-wrap text-left sm:text-right">
                        {detailedOrder.notes}
                      </DetailItem>
                    )}
                    {detailedOrder.qrCodePaymentUrl && (
                      <div className="py-3 text-center">
                        <p className="text-sm text-text-muted mb-1">Mã QR thanh toán:</p>
                        <QRCodeDisplay value={detailedOrder.qrCodePaymentUrl} size={100} />
                      </div>
                    )}
                  </dl>
                  <div className="mt-4 border-t border-border-base pt-4">
                    <h4 className="text-md font-semibold text-text-heading mb-2">Các dịch vụ:</h4>
                    <ul className="space-y-1 text-sm">
                      {detailedOrder.items.map((item, index) => (
                        <li key={index} className="flex justify-between p-1.5 bg-bg-base rounded">
                          <span>{item.serviceItem.name} (x{item.quantity})</span>
                          <span>{(item.serviceItem.price * item.quantity).toLocaleString('vi-VN')} VNĐ</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {detailedOrder.status === OrderStatus.RETURNED && (
                    <div className="mt-5 text-center">
                      <Button onClick={() => openRatingModal(detailedOrder.id)} variant="primary" leftIcon={<StarIcon size={18} />}>
                        Đánh giá & Tip
                      </Button>
                    </div>
                  )}
                </Card>
            ) : (
              <div>
                <h2 className="text-xl font-semibold text-text-heading mb-4">Lịch sử Đơn hàng</h2>
                {customerOrders.length === 0 ? (
                  <p className="text-center text-text-muted py-8">Bạn chưa có đơn hàng nào.</p>
                ) : (
                  <div className="space-y-4">
                    {paginatedOrders.map(order => {
                      const statusInfo = getStatusInfo(order.status);
                      return (
                        <div key={order.id} className="p-4 border border-border-base rounded-lg hover:bg-bg-surface-hover transition-colors">
                          <div className="flex flex-col sm:flex-row justify-between items-start">
                            <div>
                               <a href="#" onClick={(e) => { e.preventDefault(); setDetailedOrder(order); }} className="font-semibold text-brand-primary hover:underline">{order.id}</a>
                              <p className="text-xs text-text-muted flex items-center mt-1"><CalendarDaysIcon size={14} className="mr-1.5"/> {new Date(order.createdAt).toLocaleString('vi-VN')}</p>
                            </div>
                            <span className={`px-2.5 py-1 text-xs font-semibold rounded-full mt-2 sm:mt-0 inline-flex items-center ${statusInfo.bgColor} ${statusInfo.textColor}`}>
                                {statusInfo.icon} {statusInfo.text}
                            </span>
                          </div>
                          <div className="mt-3 pt-3 border-t border-border-base/70 flex justify-between items-center text-sm">
                            <p className="flex items-center text-text-muted"><PackageIcon size={16} className="mr-2"/> {order.items.length} dịch vụ</p>
                            <p className="font-semibold text-text-heading flex items-center"><DollarSignIcon size={16} className="mr-1"/> {order.totalAmount.toLocaleString('vi-VN')} VNĐ</p>
                          </div>
                        </div>
                      );
                    })}
                    {totalPages > 1 && (
                      <div className="mt-6 flex justify-center items-center space-x-2">
                        <Button onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1} variant="secondary" size="sm"><ChevronLeftIcon size={16} /></Button>
                        <span className="text-sm text-text-muted">Trang {currentPage} / {totalPages}</span>
                        <Button onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages} variant="secondary" size="sm"><ChevronRightIcon size={16} /></Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'createOrder' && (
           <CreateOrderTab 
              isStaffServingModeActive={false} 
              customerForNewOrder={currentUser} 
              identifiedPublicCustomer={currentUser} 
           />
        )}
        
        {activeTab === 'aiAssistant' && (
           <AIAssistantTab loggedInCustomer={currentUser} />
        )}
      </Card>
      
      {isRatingModalOpen && orderIdForRating && currentUser && (
        <RatingTipModal
          isOpen={isRatingModalOpen}
          onClose={() => setIsRatingModalOpen(false)}
          orderId={orderIdForRating}
          customerUserId={currentUser.id}
        />
      )}
    </div>
  );
};

export default CustomerDashboardPage;