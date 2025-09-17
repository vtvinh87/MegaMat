import React, { useState, useMemo, FormEvent, useEffect, ChangeEvent } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { User, Order, OrderStatus, Address, LoyaltyHistoryEntry, Notification } from '../../types';
import { User as UserIcon, AwardIcon, ListOrderedIcon, SaveIcon, PackageIcon, CalendarDaysIcon, DollarSignIcon, ChevronLeftIcon, ChevronRightIcon, ShoppingCartIcon, MessageCircleIcon, KeyIcon, AlertTriangleIcon, ClockIcon, ZapIcon, CheckCircleIcon, XIcon, PackageCheckIcon, InfoIcon, ListIcon, StarIcon, MapPinIcon, PlusCircleIcon, Trash2Icon, HomeIcon, BriefcaseIcon, BellIcon, EditIcon } from 'lucide-react';
import { CreateOrderTab } from '../public/customer-home/CreateOrderTab';
import { AIAssistantTab } from '../public/customer-home/AIAssistantTab';
import { RatingTipModal } from '../../components/shared/RatingTipModal';
import { QRCodeDisplay } from '../../components/shared/QRCodeDisplay';
import { Modal } from '../../components/ui/Modal';
import { v4 as uuidv4 } from 'uuid';

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

const formatDateForInput = (date?: Date): string => {
  if (!date) return '';
  const d = new Date(date);
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const AddressModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (address: Address) => void;
  address: Address | null;
}> = ({ isOpen, onClose, onSave, address }) => {
    const [formData, setFormData] = useState<Address | null>(null);

    useEffect(() => {
        if (address) {
            setFormData({ ...address });
        }
    }, [address]);
    
    if (!isOpen || !formData) return null;

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => prev ? { ...prev, [name]: type === 'checkbox' ? checked : value } : null);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={formData.id.startsWith('temp-') ? 'Thêm Địa chỉ mới' : 'Sửa Địa chỉ'}>
            <form onSubmit={(e) => { e.preventDefault(); onSave(formData); }} className="space-y-4">
                <Input label="Nhãn*" name="label" value={formData.label} onChange={handleChange} placeholder="VD: Nhà riêng, Công ty..." required />
                <Input label="Địa chỉ chi tiết*" name="street" value={formData.street} onChange={handleChange} required />
                <label className="flex items-center space-x-2 cursor-pointer">
                    <input type="checkbox" name="isDefault" checked={formData.isDefault} onChange={handleChange} className="h-4 w-4 rounded text-brand-primary focus:ring-brand-primary-focus" />
                    <span className="text-sm">Đặt làm địa chỉ mặc định</span>
                </label>
                <div className="mt-6 flex justify-end space-x-3 border-t border-border-base pt-4">
                    <Button type="button" variant="secondary" onClick={onClose}>Hủy</Button>
                    <Button type="submit">Lưu</Button>
                </div>
            </form>
        </Modal>
    );
};


const CustomerDashboardPage: React.FC = () => {
  const { currentUser } = useAuth();
  // FIX: Property 'allNotifications' does not exist on type 'DataContextType'. It should be 'notifications'.
  const { orders: allOrders, updateUser, addNotification, notifications } = useData();

  const [activeTab, setActiveTab] = useState<'history' | 'createOrder' | 'aiAssistant'>('history');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: currentUser?.name || '',
    newPassword: '',
    confirmNewPassword: '',
    dob: formatDateForInput(currentUser?.dob),
  });
  const [editError, setEditError] = useState<string | null>(null);
  
  // State for order history view
  const [currentPage, setCurrentPage] = useState(1);
  const [detailedOrder, setDetailedOrder] = useState<Order | null>(null);
  
  // State for rating modal
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [orderIdForRating, setOrderIdForRating] = useState<string | null>(null);

  // State for new feature modals
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [isLoyaltyHistoryModalOpen, setIsLoyaltyHistoryModalOpen] = useState(false);
  
  useEffect(() => {
    if (isEditingProfile && currentUser) {
        setEditFormData({
            name: currentUser.name,
            newPassword: '',
            confirmNewPassword: '',
            dob: formatDateForInput(currentUser.dob),
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

    const { name, newPassword, confirmNewPassword, dob } = editFormData;

    if (!name.trim()) {
      setEditError("Tên không được để trống.");
      return;
    }

    if (newPassword && newPassword !== confirmNewPassword) {
      setEditError("Mật khẩu mới không khớp.");
      return;
    }

    const userUpdatePayload: Partial<User> & { id: string } = {
      id: currentUser.id,
      name: name.trim(),
      dob: dob ? new Date(dob) : undefined,
    };
    
    if (newPassword) {
      userUpdatePayload.password = newPassword;
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

  const openAddressModal = (address: Address | null = null) => {
    setEditingAddress(address || { id: uuidv4(), label: '', street: '', isDefault: !(currentUser.addresses && currentUser.addresses.length > 0) });
    setIsAddressModalOpen(true);
  };

  const handleSaveAddress = (addressToSave: Address) => {
      if (!addressToSave.street.trim() || !addressToSave.label.trim()) {
          addNotification({ message: 'Vui lòng nhập đầy đủ Nhãn và Địa chỉ.', type: 'error', showToast: true });
          return;
      }
      
      let updatedAddresses = [...(currentUser.addresses || [])];
      
      if (addressToSave.isDefault) {
          updatedAddresses = updatedAddresses.map(addr => ({ ...addr, isDefault: false }));
      }

      const existingIndex = updatedAddresses.findIndex(a => a.id === addressToSave.id);
      if (existingIndex > -1) {
          updatedAddresses[existingIndex] = addressToSave;
      } else {
          updatedAddresses.push(addressToSave);
      }
      
      if (updatedAddresses.length > 0 && !updatedAddresses.some(a => a.isDefault)) {
          updatedAddresses[0].isDefault = true;
      }

      updateUser({ id: currentUser.id, addresses: updatedAddresses }).then(success => {
          if(success) {
              addNotification({ message: 'Đã cập nhật địa chỉ.', type: 'success', showToast: true });
              setIsAddressModalOpen(false);
          }
      });
  };

  const handleDeleteAddress = (addressId: string) => {
      if (window.confirm('Bạn có chắc chắn muốn xóa địa chỉ này?')) {
          let updatedAddresses = (currentUser.addresses || []).filter(a => a.id !== addressId);
          if (updatedAddresses.length > 0 && !updatedAddresses.some(a => a.isDefault)) {
              updatedAddresses[0].isDefault = true;
          }
          updateUser({ id: currentUser.id, addresses: updatedAddresses }).then(success => {
              if(success) addNotification({ message: 'Đã xóa địa chỉ.', type: 'success', showToast: true });
          });
      }
  };

  const customerNotifications = useMemo(() => {
    return notifications.filter(n => n.userId === currentUser.id || allOrders.filter(o => o.customer.id === currentUser.id).map(o => o.id).includes(n.orderId || '')).sort((a,b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 7);
  }, [notifications, allOrders, currentUser]);
  
  const TABS = [
    { id: 'history', label: 'Lịch sử Đơn hàng', icon: <ListOrderedIcon size={18}/> },
    { id: 'createOrder', label: 'Đặt lịch Giặt là', icon: <ShoppingCartIcon size={18}/> },
    { id: 'aiAssistant', label: 'Trợ Lý AI', icon: <MessageCircleIcon size={18}/> },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-text-heading">Chào mừng, {currentUser.name}!</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            {/* Profile Card */}
            <Card title="Thông tin của tôi" icon={<UserIcon size={20} />}>
              {isEditingProfile ? (
                <form onSubmit={handleProfileUpdate} className="space-y-4">
                  {editError && <p className="text-sm text-status-danger flex items-center"><AlertTriangleIcon size={16} className="mr-1.5"/>{editError}</p>}
                  <Input label="Tên*" value={editFormData.name} onChange={e => setEditFormData({...editFormData, name: e.target.value })} required />
                  <Input label="Số điện thoại" value={currentUser.phone} disabled />
                  <Input label="Ngày sinh" type="date" value={editFormData.dob} onChange={e => setEditFormData({...editFormData, dob: e.target.value })} />
                  <Input label="Mật khẩu mới (để trống nếu không đổi)" type="password" value={editFormData.newPassword} onChange={e => setEditFormData({...editFormData, newPassword: e.target.value })} leftIcon={<KeyIcon size={16}/>} />
                  <Input label="Xác nhận mật khẩu mới" type="password" value={editFormData.confirmNewPassword} onChange={e => setEditFormData({...editFormData, confirmNewPassword: e.target.value })} leftIcon={<KeyIcon size={16}/>} />
                  <div className="flex space-x-2">
                    <Button type="button" variant="secondary" onClick={() => setIsEditingProfile(false)}>Hủy</Button>
                    <Button type="submit" leftIcon={<SaveIcon size={16} />}>Lưu</Button>
                  </div>
                </form>
              ) : (
                <div className="space-y-2 text-sm">
                  <p><strong className="text-text-muted">Tên:</strong> {currentUser.name}</p>
                  <p><strong className="text-text-muted">SĐT:</strong> {currentUser.phone}</p>
                  <p><strong className="text-text-muted">Ngày sinh:</strong> {currentUser.dob ? new Date(currentUser.dob).toLocaleDateString('vi-VN') : 'Chưa có'}</p>
                  <Button variant="link" onClick={() => setIsEditingProfile(true)} className="!p-0 !text-sm mt-2">Chỉnh sửa thông tin</Button>
                </div>
              )}
            </Card>

            {/* Saved Addresses Card */}
            <Card title="Sổ địa chỉ" icon={<MapPinIcon size={20}/>} actions={<Button size="sm" variant="secondary" onClick={() => openAddressModal(null)} leftIcon={<PlusCircleIcon size={16}/>}>Thêm</Button>}>
                <div className="space-y-3 max-h-60 overflow-y-auto">
                    {(currentUser.addresses && currentUser.addresses.length > 0) ? currentUser.addresses.map(addr => (
                        <div key={addr.id} className="p-3 bg-bg-subtle rounded-md border border-border-base flex justify-between items-start">
                            <div>
                                <p className="font-semibold text-text-body flex items-center">
                                    {addr.label === 'Nhà riêng' ? <HomeIcon size={14} className="mr-2"/> : <BriefcaseIcon size={14} className="mr-2" />}
                                    {addr.label} {addr.isDefault && <span className="ml-2 text-xs text-status-success bg-status-success-bg px-1.5 py-0.5 rounded-full">Mặc định</span>}
                                </p>
                                <p className="text-sm text-text-muted">{addr.street}</p>
                            </div>
                            <div className="flex space-x-1 flex-shrink-0">
                                <Button variant="ghost" size="sm" className="p-1" onClick={() => openAddressModal(addr)}><EditIcon size={16} /></Button>
                                <Button variant="ghost" size="sm" className="p-1 text-status-danger" onClick={() => handleDeleteAddress(addr.id)}><Trash2Icon size={16} /></Button>
                            </div>
                        </div>
                    )) : <p className="text-sm text-text-muted text-center">Bạn chưa có địa chỉ nào được lưu.</p>}
                </div>
            </Card>
          </div>

          <div className="space-y-6">
            {/* Loyalty Card */}
            <Card title="Điểm tích lũy" icon={<AwardIcon size={20} />}>
                <div className="text-center">
                    <p className="text-5xl font-bold text-amber-500">{currentUser.loyaltyPoints || 0}</p>
                    <p className="text-text-muted mt-1">điểm</p>
                    <Button variant="secondary" size="sm" className="mt-4" onClick={() => setIsLoyaltyHistoryModalOpen(true)}>Xem Lịch sử Điểm</Button>
                </div>
            </Card>

            {/* Communication Log */}
            <Card title="Thông báo từ Cửa hàng" icon={<BellIcon size={20} />}>
                <div className="space-y-3 max-h-60 overflow-y-auto">
                    {customerNotifications.length > 0 ? customerNotifications.map(n => (
                        <div key={n.id} className="flex items-start space-x-3 text-sm">
                            <CheckCircleIcon size={16} className="text-status-success mt-0.5 flex-shrink-0" />
                            <div className="flex-grow">
                                <p className="text-text-body">{n.message}</p>
                                <p className="text-xs text-text-muted">{new Date(n.createdAt).toLocaleString('vi-VN', {dateStyle: 'short', timeStyle: 'short'})}</p>
                            </div>
                        </div>
                    )) : <p className="text-sm text-text-muted text-center">Không có thông báo nào.</p>}
                </div>
            </Card>
          </div>
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

      <AddressModal isOpen={isAddressModalOpen} onClose={() => setIsAddressModalOpen(false)} onSave={handleSaveAddress} address={editingAddress} />
      
      <Modal isOpen={isLoyaltyHistoryModalOpen} onClose={() => setIsLoyaltyHistoryModalOpen(false)} title="Lịch sử Điểm thưởng" size="lg">
          <div className="max-h-96 overflow-y-auto">
              {(!currentUser.loyaltyHistory || currentUser.loyaltyHistory.length === 0) ? (
                  <p className="text-center text-text-muted py-4">Chưa có lịch sử điểm.</p>
              ) : (
                  <ul className="divide-y divide-border-base">
                      {[...currentUser.loyaltyHistory].reverse().map((entry, index) => (
                          <li key={index} className="py-3 flex justify-between items-center">
                              <div>
                                  <p className="text-sm font-medium text-text-body">{entry.reason}</p>
                                  <p className="text-xs text-text-muted">{new Date(entry.timestamp).toLocaleString('vi-VN')}</p>
                              </div>
                              <span className={`text-lg font-bold ${entry.pointsChange > 0 ? 'text-status-success' : 'text-status-danger'}`}>
                                  {entry.pointsChange > 0 ? '+' : ''}{entry.pointsChange}
                              </span>
                          </li>
                      ))}
                  </ul>
              )}
          </div>
      </Modal>

    </div>
  );
};

export default CustomerDashboardPage;
