import React, { useState, useMemo, FormEvent, useEffect, ChangeEvent } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { User, Order, OrderStatus, Address, LoyaltyHistoryEntry, InteractionHistoryEntry, StoreProfile, OrderItem } from '../../types';
import { User as UserIcon, AwardIcon, ListOrderedIcon, SaveIcon, PackageIcon, CalendarDaysIcon, DollarSignIcon, ChevronLeftIcon, ChevronRightIcon, ShoppingCartIcon, MessageCircleIcon, KeyIcon, AlertTriangleIcon, ClockIcon, ZapIcon, CheckCircleIcon, XIcon, PackageCheckIcon, InfoIcon, ListIcon, StarIcon, MapPinIcon, PlusCircleIcon, Trash2Icon, HomeIcon, BriefcaseIcon, BellIcon, EditIcon, Share2Icon, CopyIcon, HistoryIcon, MailIcon, MessageSquareTextIcon } from 'lucide-react';
import { CreateOrderTab } from '../public/customer-home/CreateOrderTab';
import { AIAssistantTab } from '../public/customer-home/AIAssistantTab';
import { RatingTipModal } from '../../components/shared/RatingTipModal';
import { Modal } from '../../components/ui/Modal';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '../../contexts/ToastContext';

// Helper function to format date for input[type="date"]
const formatDateForInput = (date?: Date): string => {
  if (!date) return '';
  const d = new Date(date);
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Address Modal Component
const AddressModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (address: Address) => void;
    address: Address | null;
}> = ({ isOpen, onClose, onSave, address }) => {
    const [formData, setFormData] = useState({
        id: address?.id || uuidv4(),
        label: address?.label || '',
        street: address?.street || '',
        isDefault: address?.isDefault || false,
    });

    useEffect(() => {
        setFormData({
            id: address?.id || uuidv4(),
            label: address?.label || '',
            street: address?.street || '',
            isDefault: address?.isDefault || false,
        });
    }, [address, isOpen]);

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }));
    };

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (!formData.label.trim() || !formData.street.trim()) {
            alert('Vui lòng điền đầy đủ thông tin.');
            return;
        }
        onSave(formData);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={address ? 'Sửa Địa chỉ' : 'Thêm Địa chỉ Mới'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <Input name="label" label="Nhãn (VD: Nhà riêng, Công ty)" value={formData.label} onChange={handleChange} required />
                <Input name="street" label="Địa chỉ chi tiết" value={formData.street} onChange={handleChange} required />
                <label className="flex items-center space-x-2">
                    <input type="checkbox" name="isDefault" checked={formData.isDefault} onChange={handleChange} />
                    <span>Đặt làm địa chỉ mặc định</span>
                </label>
                <div className="flex justify-end space-x-2 pt-4 border-t border-border-base">
                    <Button type="button" variant="secondary" onClick={onClose}>Hủy</Button>
                    <Button type="submit">Lưu</Button>
                </div>
            </form>
        </Modal>
    );
};


// Main page component
const CustomerDashboardPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { addNotification } = useData();

  const [activeTab, setActiveTab] = useState<'history' | 'createOrder' | 'aiAssistant'>('history');
  
  // State for "reorder" feature
  const [preFilledItems, setPreFilledItems] = useState<OrderItem[] | null>(null);

  // State for rating modal
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [orderIdForRating, setOrderIdForRating] = useState<string | null>(null);

  if (!currentUser) {
    return <p>Vui lòng đăng nhập để xem trang này.</p>;
  }

  const handleReorder = (order: Order) => {
    setPreFilledItems(order.items);
    setActiveTab('createOrder');
    addNotification({ message: 'Đã điền lại các dịch vụ từ đơn hàng trước.', type: 'info', showToast: true });
    // Scroll to top for better UX
    window.scrollTo(0, 0);
  };
  
  const handleOrderCreated = () => {
    setPreFilledItems(null);
    setActiveTab('history');
  };
  
  const openRatingModal = (orderId: string) => {
    setOrderIdForRating(orderId);
    setIsRatingModalOpen(true);
  };
  
  const TABS = [
    { id: 'history', label: 'Lịch sử Đơn hàng', icon: <ListOrderedIcon size={18}/> },
    { id: 'createOrder', label: 'Đặt lịch Mới', icon: <ShoppingCartIcon size={18}/> },
    { id: 'aiAssistant', label: 'Trợ Lý AI', icon: <MessageCircleIcon size={18}/> },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-text-heading">Chào mừng, {currentUser.name}!</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 border-b border-border-base pb-4 mb-4">
              {TABS.map(tab => (
                <Button 
                  key={tab.id} 
                  variant={activeTab === tab.id ? 'primary' : 'secondary'} 
                  onClick={() => {
                      setActiveTab(tab.id as any);
                      if (tab.id !== 'createOrder') setPreFilledItems(null); // Clear pre-filled items if switching away
                  }}
                  className="w-full justify-center py-2.5 sm:py-3"
                  leftIcon={React.cloneElement(tab.icon, {className: `mr-2 ${activeTab === tab.id ? 'text-text-on-primary' : 'text-brand-primary'}`})}
                >
                  {tab.label}
                </Button>
              ))}
            </div>
            
            {activeTab === 'history' && <OrderHistoryView onReorder={handleReorder} onRate={openRatingModal} />}
            {activeTab === 'createOrder' && <CreateOrderTab isStaffServingModeActive={false} customerForNewOrder={currentUser} identifiedPublicCustomer={currentUser} preFilledItems={preFilledItems} onOrderCreated={handleOrderCreated} />}
            {activeTab === 'aiAssistant' && <AIAssistantTab loggedInCustomer={currentUser} />}
          </Card>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <LoyaltyTierCard user={currentUser} />
          <MyAccountCard user={currentUser} />
          <ReferralCard user={currentUser} />
          <InteractionHistoryCard user={currentUser} />
        </div>
      </div>
      
      {isRatingModalOpen && orderIdForRating && (
        <RatingTipModal isOpen={isRatingModalOpen} onClose={() => setIsRatingModalOpen(false)} orderId={orderIdForRating} customerUserId={currentUser.id} />
      )}
    </div>
  );
};

// Child components for the dashboard

const LoyaltyTierCard: React.FC<{ user: User }> = ({ user }) => {
    const { orders, storeProfiles } = useData();
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

    const homeStoreOwnerId = useMemo(() => {
        const storeCounts = orders
            .filter(o => o.customer.id === user.id)
            .reduce((acc, o) => {
                acc[o.ownerId] = (acc[o.ownerId] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);
        
        const mostFrequentStore = Object.entries(storeCounts).sort((a, b) => b[1] - a[1])[0];
        return mostFrequentStore ? mostFrequentStore[0] : (storeProfiles.length > 0 ? storeProfiles[0].ownerId : null);
    }, [orders, user.id, storeProfiles]);

    const storeProfile = useMemo(() => storeProfiles.find(p => p.ownerId === homeStoreOwnerId), [storeProfiles, homeStoreOwnerId]);

    if (!storeProfile?.loyaltySettings?.enabled || !storeProfile.loyaltySettings.tiers) {
        return (
            <Card title="Thành viên & Điểm thưởng" icon={<AwardIcon size={20} />}>
                <div className="text-center py-4">
                    <p className="text-5xl font-bold text-amber-500">{user.loyaltyPoints || 0}</p>
                    <p className="text-text-muted mt-1">điểm</p>
                    <Button variant="secondary" size="sm" className="mt-4" onClick={() => setIsHistoryModalOpen(true)}>Xem Lịch sử Điểm</Button>
                     <p className="text-xs text-text-muted mt-4">Chương trình hạng thành viên chưa được kích hoạt tại cửa hàng bạn hay ghé thăm.</p>
                </div>
                 <LoyaltyHistoryModal isOpen={isHistoryModalOpen} onClose={() => setIsHistoryModalOpen(false)} history={user.loyaltyHistory || []} />
            </Card>
        );
    }
    
    const tiers = storeProfile.loyaltySettings.tiers.sort((a,b) => a.minSpend - b.minSpend);
    const currentTier = tiers.slice().reverse().find(t => (user.lifetimeValue || 0) >= t.minSpend) || tiers[0];
    const currentTierIndex = tiers.findIndex(t => t.name === currentTier.name);
    const nextTier = currentTierIndex < tiers.length - 1 ? tiers[currentTierIndex + 1] : null;

    const progressPercentage = nextTier 
        ? (((user.lifetimeValue || 0) - currentTier.minSpend) / (nextTier.minSpend - currentTier.minSpend)) * 100
        : 100;

    const amountToNextTier = nextTier ? nextTier.minSpend - (user.lifetimeValue || 0) : 0;
    
    return (
      <>
        <Card title="Thành viên & Điểm thưởng" icon={<AwardIcon size={20} />}>
            <div className="text-center">
                <p className="text-xs text-text-muted">Hạng hiện tại</p>
                <p className="text-2xl font-bold text-amber-500">{currentTier.name}</p>
                <p className="text-sm text-text-muted">Tổng chi tiêu: {(user.lifetimeValue || 0).toLocaleString('vi-VN')} VNĐ</p>
            </div>
            
            {nextTier && (
                <div className="mt-4">
                    <div className="flex justify-between text-xs text-text-muted mb-1">
                        <span>{currentTier.name}</span>
                        <span>{nextTier.name}</span>
                    </div>
                    <div className="w-full bg-bg-subtle rounded-full h-2.5">
                        <div className="bg-amber-400 h-2.5 rounded-full" style={{ width: `${Math.min(100, progressPercentage)}%` }}></div>
                    </div>
                    <p className="text-xs text-center text-text-muted mt-2">
                        Chi tiêu thêm {amountToNextTier.toLocaleString('vi-VN')} VNĐ để đạt hạng {nextTier.name}.
                    </p>
                </div>
            )}
            
            <div className="mt-4 pt-4 border-t border-border-base">
                <h4 className="font-semibold text-text-heading mb-2">Quyền lợi hạng {currentTier.name}:</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-text-body">
                    {currentTier.benefits.map((benefit, index) => <li key={index}>{benefit}</li>)}
                </ul>
            </div>

            <div className="my-4 border-t border-dashed border-border-base"></div>

            <div className="text-center">
                <p className="text-sm text-text-muted">Điểm tích lũy</p>
                <p className="text-5xl font-bold text-brand-primary">{user.loyaltyPoints || 0}</p>
                <Button variant="secondary" size="sm" className="mt-2" onClick={() => setIsHistoryModalOpen(true)}>
                    Xem Lịch sử Điểm
                </Button>
            </div>
        </Card>
        <LoyaltyHistoryModal isOpen={isHistoryModalOpen} onClose={() => setIsHistoryModalOpen(false)} history={user.loyaltyHistory || []} />
      </>
    );
};

const MyAccountCard: React.FC<{ user: User }> = ({ user }) => {
    const { updateUser, addNotification } = useData();
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [formData, setFormData] = useState({ name: user.name, dob: formatDateForInput(user.dob), newPassword: '', confirmPassword: '' });
    const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
    const [editingAddress, setEditingAddress] = useState<Address | null>(null);

    const handleProfileSave = (e: FormEvent) => {
        e.preventDefault();
        if (formData.newPassword && formData.newPassword !== formData.confirmPassword) {
            addNotification({ message: "Mật khẩu mới không khớp.", type: 'error', showToast: true });
            return;
        }
        const payload: Partial<User> & { id: string } = { id: user.id, name: formData.name, dob: formData.dob ? new Date(formData.dob) : undefined };
        if (formData.newPassword) payload.password = formData.newPassword;
        updateUser(payload).then(success => {
            if (success) {
                addNotification({ message: "Đã cập nhật thông tin.", type: 'success', showToast: true });
                setIsEditingProfile(false);
            }
        });
    };
    
    const handleAddressSave = (address: Address) => {
        let updatedAddresses = [...(user.addresses || [])];
        if (address.isDefault) updatedAddresses.forEach(a => a.isDefault = false);
        const existingIndex = updatedAddresses.findIndex(a => a.id === address.id);
        if (existingIndex > -1) updatedAddresses[existingIndex] = address;
        else updatedAddresses.push({ ...address, id: uuidv4() });
        if (!updatedAddresses.some(a => a.isDefault)) updatedAddresses[0].isDefault = true;
        updateUser({ id: user.id, addresses: updatedAddresses }).then(success => {
            if (success) {
                addNotification({ message: 'Đã lưu địa chỉ.', type: 'success', showToast: true });
                setIsAddressModalOpen(false);
            }
        });
    };
    
    const handleAddressDelete = (id: string) => {
        if (!window.confirm("Xóa địa chỉ này?")) return;
        let updatedAddresses = (user.addresses || []).filter(a => a.id !== id);
        if (updatedAddresses.length > 0 && !updatedAddresses.some(a => a.isDefault)) updatedAddresses[0].isDefault = true;
        updateUser({ id: user.id, addresses: updatedAddresses }).then(success => {
            if (success) addNotification({ message: 'Đã xóa địa chỉ.', type: 'success', showToast: true });
        });
    };

    const handleCommPrefChange = (pref: 'sms' | 'email', isChecked: boolean) => {
        const currentPrefs = new Set(user.communicationPreferences || []);
        isChecked ? currentPrefs.add(pref) : currentPrefs.delete(pref);
        updateUser({ id: user.id, communicationPreferences: Array.from(currentPrefs) });
    };

    return (
      <>
        <Card title="Tài khoản của tôi" icon={<UserIcon size={20} />}>
          <div className="space-y-4">
            {/* Profile Section */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-semibold text-text-heading">Thông tin cá nhân</h4>
                <Button variant="ghost" size="sm" className="p-1" onClick={() => setIsEditingProfile(!isEditingProfile)}><EditIcon size={16}/></Button>
              </div>
              {isEditingProfile ? (
                <form onSubmit={handleProfileSave} className="space-y-3 p-2 bg-bg-subtle rounded-md">
                   <Input label="Tên*" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                   <Input label="Ngày sinh" type="date" value={formData.dob} onChange={e => setFormData({...formData, dob: e.target.value})} />
                   <Input label="Mật khẩu mới" type="password" value={formData.newPassword} onChange={e => setFormData({...formData, newPassword: e.target.value})} />
                   <Input label="Xác nhận MK" type="password" value={formData.confirmPassword} onChange={e => setFormData({...formData, confirmPassword: e.target.value})} />
                   <div className="flex justify-end space-x-2"><Button type="button" variant="secondary" size="sm" onClick={() => setIsEditingProfile(false)}>Hủy</Button><Button size="sm" type="submit">Lưu</Button></div>
                </form>
              ) : (
                <div className="text-sm space-y-1">
                   <p><strong>Tên:</strong> {user.name}</p>
                   <p><strong>Ngày sinh:</strong> {user.dob ? new Date(user.dob).toLocaleDateString('vi-VN') : 'Chưa có'}</p>
                </div>
              )}
            </div>
            {/* Communication Preferences */}
            <div className="pt-3 border-t border-border-base">
                 <h4 className="font-semibold text-text-heading mb-2">Tùy chọn liên lạc</h4>
                 <div className="space-y-2 text-sm">
                    <label className="flex items-center"><input type="checkbox" className="mr-2" checked={user.communicationPreferences?.includes('sms')} onChange={e => handleCommPrefChange('sms', e.target.checked)} /> Nhận tin nhắn SMS</label>
                    <label className="flex items-center"><input type="checkbox" className="mr-2" checked={user.communicationPreferences?.includes('email')} onChange={e => handleCommPrefChange('email', e.target.checked)} /> Nhận Email</label>
                 </div>
            </div>
             {/* Address Section */}
            <div className="pt-3 border-t border-border-base">
                 <div className="flex justify-between items-center mb-2">
                    <h4 className="font-semibold text-text-heading">Địa chỉ đã lưu</h4>
                    <Button variant="ghost" size="sm" className="p-1" onClick={() => { setEditingAddress(null); setIsAddressModalOpen(true); }}><PlusCircleIcon size={16}/></Button>
                 </div>
                 <div className="space-y-2 text-sm max-h-40 overflow-y-auto">
                    {(user.addresses || []).map(addr => (
                      <div key={addr.id} className="p-2 bg-bg-subtle rounded-md flex justify-between items-start">
                        <div>
                          <p className="font-semibold">{addr.label} {addr.isDefault && '(Mặc định)'}</p>
                          <p className="text-xs text-text-muted">{addr.street}</p>
                        </div>
                        <div className="flex space-x-1">
                          <Button variant="ghost" size="sm" className="p-1" onClick={() => { setEditingAddress(addr); setIsAddressModalOpen(true); }}><EditIcon size={14}/></Button>
                          <Button variant="ghost" size="sm" className="p-1 text-status-danger" onClick={() => handleAddressDelete(addr.id)}><Trash2Icon size={14}/></Button>
                        </div>
                      </div>
                    ))}
                 </div>
            </div>
          </div>
        </Card>
        {isAddressModalOpen && <AddressModal isOpen={isAddressModalOpen} onClose={() => setIsAddressModalOpen(false)} onSave={handleAddressSave} address={editingAddress} />}
      </>
    );
};

const ReferralCard: React.FC<{ user: User }> = ({ user }) => {
    const { addToast } = useToast();
    const handleCopy = () => {
        if(user.referralCode) {
            navigator.clipboard.writeText(user.referralCode);
            addToast({ message: `Đã sao chép mã: ${user.referralCode}`, type: 'success' });
        }
    };
    return (
        <Card title="Giới thiệu Bạn bè" icon={<Share2Icon size={20}/>}>
            <p className="text-sm text-text-muted mb-2">Chia sẻ mã của bạn để cả hai cùng nhận 500 điểm thưởng!</p>
            <div className="p-2 bg-bg-subtle rounded-md flex justify-between items-center">
                <span className="font-mono text-lg text-brand-primary">{user.referralCode || 'N/A'}</span>
                <Button variant="ghost" size="sm" onClick={handleCopy}><CopyIcon size={16}/></Button>
            </div>
            <div className="mt-4 pt-3 border-t border-border-base">
                <h4 className="font-semibold text-text-heading mb-2">Giới thiệu thành công:</h4>
                <div className="space-y-1 text-sm max-h-32 overflow-y-auto">
                    {(user.successfulReferrals && user.successfulReferrals.length > 0) ? user.successfulReferrals.map((ref, i) => (
                        <div key={i} className="flex justify-between items-center">
                            <span>{ref.name}</span>
                            <span className="text-xs text-text-muted">{new Date(ref.firstOrderCompletedAt).toLocaleDateString('vi-VN')}</span>
                        </div>
                    )) : <p className="text-xs text-text-muted italic">Chưa có giới thiệu thành công nào.</p>}
                </div>
            </div>
        </Card>
    );
};

const InteractionHistoryCard: React.FC<{ user: User }> = ({ user }) => {
    const { findUserById } = useData();
    return (
        <Card title="Lịch sử Tương tác" icon={<HistoryIcon size={20}/>}>
            <div className="space-y-3 max-h-60 overflow-y-auto text-sm">
                 {(user.interactionHistory && user.interactionHistory.length > 0) ? user.interactionHistory.map((entry, i) => (
                    <div key={i}>
                        <p className="font-medium text-text-body">{entry.summary}</p>
                        <p className="text-xs text-text-muted">{new Date(entry.timestamp).toLocaleString('vi-VN')} - Bởi {findUserById(entry.staffUserId)?.name || 'Hệ thống'} qua {entry.channel}</p>
                    </div>
                 )) : <p className="text-xs text-text-muted italic text-center">Không có lịch sử tương tác.</p>}
            </div>
        </Card>
    );
};

const OrderHistoryView: React.FC<{ onReorder: (order: Order) => void; onRate: (orderId: string) => void; }> = ({ onReorder, onRate }) => {
    const ITEMS_PER_PAGE = 5;

    const getStatusInfo = (status: OrderStatus): { textColor: string; bgColor: string; text: string; icon?: React.ReactNode } => {
        switch (status) {
          case OrderStatus.WAITING_FOR_CONFIRMATION: return { textColor: 'text-purple-800', bgColor: 'bg-purple-100', text: OrderStatus.WAITING_FOR_CONFIRMATION, icon: <MessageCircleIcon size={14} className="mr-1.5" /> };
          case OrderStatus.PENDING: return { textColor: 'text-status-warning-text', bgColor: 'bg-status-warning-bg', text: OrderStatus.PENDING, icon: <ClockIcon size={14} className="mr-1.5" /> };
          case OrderStatus.PROCESSING: return { textColor: 'text-status-info-text', bgColor: 'bg-status-info-bg', text: OrderStatus.PROCESSING, icon: <ZapIcon size={14} className="mr-1.5" /> };
          case OrderStatus.COMPLETED: return { textColor: 'text-status-success-text', bgColor: 'bg-status-success-bg', text: OrderStatus.COMPLETED, icon: <CheckCircleIcon size={14} className="mr-1.5" /> };
          case OrderStatus.CANCELLED: return { textColor: 'text-status-danger-text', bgColor: 'bg-status-danger-bg', text: OrderStatus.CANCELLED, icon: <XIcon size={14} className="mr-1.5" /> };
          case OrderStatus.RETURNED: return { textColor: 'text-text-on-primary', bgColor: 'bg-brand-primary', text: OrderStatus.RETURNED, icon: <PackageCheckIcon size={14} className="mr-1.5" /> };
          default: return { textColor: 'text-text-muted', bgColor: 'bg-bg-subtle', text: status, icon: <InfoIcon size={14} className="mr-1.5" /> };
        }
    };

    const DetailItem: React.FC<{ label: string; children: React.ReactNode; }> = ({ label, children }) => (
      <div className="flex justify-between py-1.5">
          <dt className="text-sm font-medium text-text-muted">{label}</dt>
          <dd className="text-sm text-text-body text-right">{children}</dd>
      </div>
    );
    
    const { currentUser } = useAuth();
    const { orders: allOrders } = useData();
    const [currentPage, setCurrentPage] = useState(1);
    const [detailedOrder, setDetailedOrder] = useState<Order | null>(null);

    const customerOrders = useMemo(() => {
        if (!currentUser) return [];
        return allOrders.filter(o => o.customer.id === currentUser.id).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [allOrders, currentUser]);
    
    const totalPages = Math.ceil(customerOrders.length / ITEMS_PER_PAGE);
    const paginatedOrders = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return customerOrders.slice(start, start + ITEMS_PER_PAGE);
    }, [customerOrders, currentPage]);

    if(detailedOrder) {
      return (
        <div className="p-1">
          <Button variant="ghost" size="sm" onClick={() => setDetailedOrder(null)} leftIcon={<ListIcon size={16}/>}>Quay lại danh sách</Button>
           <div className="mt-2 p-3 bg-bg-subtle rounded-lg">
             <dl className="divide-y divide-border-base">
                <DetailItem label="Mã ĐH:"><span className="font-semibold">{detailedOrder.id}</span></DetailItem>
                <DetailItem label="Trạng thái:">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold inline-flex items-center ${getStatusInfo(detailedOrder.status).bgColor} ${getStatusInfo(detailedOrder.status).textColor}`}>
                        {getStatusInfo(detailedOrder.status).icon} {getStatusInfo(detailedOrder.status).text}
                    </span>
                </DetailItem>
                <DetailItem label="Ngày tạo:">{new Date(detailedOrder.createdAt).toLocaleString('vi-VN')}</DetailItem>
                <DetailItem label="Tổng tiền:"><span className="font-bold text-brand-primary">{detailedOrder.totalAmount.toLocaleString('vi-VN')} VNĐ</span></DetailItem>
             </dl>
           </div>
        </div>
      );
    }
    
    return (
        <div>
            {customerOrders.length === 0 ? (
                <p className="text-center text-text-muted py-8">Bạn chưa có đơn hàng nào.</p>
            ) : (
                <div className="space-y-4">
                    {paginatedOrders.map(order => (
                        <div key={order.id} className="p-3 border border-border-base rounded-lg">
                            <div className="flex justify-between items-center">
                                <a href="#" onClick={e => { e.preventDefault(); setDetailedOrder(order); }} className="font-semibold text-brand-primary hover:underline">{order.id}</a>
                                <p className="text-sm font-semibold">{order.totalAmount.toLocaleString('vi-VN')} VNĐ</p>
                            </div>
                            <p className="text-xs text-text-muted mt-1">{new Date(order.createdAt).toLocaleString('vi-VN')}</p>
                            <div className="mt-2 pt-2 border-t border-border-base/70 flex justify-between items-center">
                                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full inline-flex items-center ${getStatusInfo(order.status).bgColor} ${getStatusInfo(order.status).textColor}`}>
                                    {getStatusInfo(order.status).icon} {getStatusInfo(order.status).text}
                                </span>
                                <div className="flex items-center space-x-2">
                                    {(order.status === OrderStatus.RETURNED || order.status === OrderStatus.COMPLETED) && (
                                      <Button variant="secondary" size="sm" onClick={() => onReorder(order)}>Đặt lại</Button>
                                    )}
                                    {order.status === OrderStatus.RETURNED && (
                                        <Button size="sm" onClick={() => onRate(order.id)} leftIcon={<StarIcon size={14}/>}>Đánh giá</Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                    {totalPages > 1 && (
                        <div className="flex justify-center items-center space-x-2"><Button onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1} variant="secondary" size="sm"><ChevronLeftIcon size={16}/></Button><span>Trang {currentPage}/{totalPages}</span><Button onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages} variant="secondary" size="sm"><ChevronRightIcon size={16}/></Button></div>
                    )}
                </div>
            )}
        </div>
    );
};

const LoyaltyHistoryModal: React.FC<{ isOpen: boolean; onClose: () => void; history: LoyaltyHistoryEntry[] }> = ({ isOpen, onClose, history }) => (
    <Modal isOpen={isOpen} onClose={onClose} title="Lịch sử Điểm thưởng">
      <div className="max-h-96 overflow-y-auto">
          {history.length === 0 ? (<p className="text-center text-text-muted py-4">Chưa có lịch sử điểm.</p>) : (
              <ul className="divide-y divide-border-base">
                  {[...history].reverse().map((entry, index) => (
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
);

export default CustomerDashboardPage;