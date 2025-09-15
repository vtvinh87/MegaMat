

import React, { useState, useMemo, FormEvent } from 'react';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { User, UserRole, Promotion } from '../../types';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { RatingTipModal } from '../../components/shared/RatingTipModal'; 
import { SearchIcon, MessageCircleIcon, PhoneIcon, TagIcon, CopyIcon, Building2Icon } from 'lucide-react';
import { APP_NAME } from '../../constants';
import { OrderLookupTab } from './customer-home/OrderLookupTab';
import { AIAssistantTab } from './customer-home/AIAssistantTab';
import { useToast } from '../../contexts/ToastContext';

type ActiveTab = 'lookup' | 'aiAssistant';


const PromotionCardDisplay: React.FC<{ promotion: Promotion; storeName: string | null }> = ({ promotion, storeName }) => {
    // FIX: Import useToast hook to resolve 'Cannot find name 'useToast'' error. The import has been added at the top of the file.
    const { addToast } = useToast();
    const discountText = promotion.discountType === 'percentage'
        ? `Giảm ${promotion.discountValue}%`
        : `Giảm ${promotion.discountValue.toLocaleString('vi-VN')} VNĐ`;

    const maxDiscountText = promotion.discountType === 'percentage' && promotion.maxDiscountAmount
        ? ` (tối đa ${promotion.maxDiscountAmount.toLocaleString('vi-VN')} VNĐ)`
        : '';
    
    const minOrderText = promotion.minOrderAmount
        ? ` cho đơn từ ${promotion.minOrderAmount.toLocaleString('vi-VN')} VNĐ`
        : '';

    const handleCopyCode = () => {
        navigator.clipboard.writeText(promotion.code);
        addToast({ message: `Đã sao chép mã: ${promotion.code}`, type: 'success' });
    };

    return (
        <Card className="flex flex-col h-full bg-bg-subtle/40">
            <div className="flex justify-between items-start">
                <h3 className="text-base font-bold text-text-heading pr-4">{promotion.name}</h3>
                {promotion.isSystemWide ? (
                    <span className="flex-shrink-0 text-xs font-semibold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full flex items-center">
                        <Building2Icon size={12} className="mr-1"/> Toàn chuỗi
                    </span>
                ) : (
                    <span className="flex-shrink-0 text-xs font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                        Cửa hàng: {storeName}
                    </span>
                )}
            </div>

            <div className="mt-2 text-sm text-brand-primary font-mono bg-blue-500/10 px-3 py-1.5 rounded-md flex justify-between items-center">
                <span>{promotion.code}</span>
                <Button variant="ghost" size="sm" onClick={handleCopyCode} className="p-1 h-auto" title="Sao chép mã">
                    <CopyIcon size={16}/>
                </Button>
            </div>
            
            <p className="text-sm text-text-body mt-2 flex-grow">
                {discountText}{maxDiscountText}{minOrderText}.
            </p>
            
            <p className="text-xs text-text-muted mt-3 pt-2 border-t border-border-base">
                {promotion.endDate ? `Hạn sử dụng: ${new Date(promotion.endDate).toLocaleDateString('vi-VN')}` : 'Không thời hạn'}
            </p>
        </Card>
    );
};


export const CustomerHomePage: React.FC = () => {
  const { 
    addNotification,
    users,
    promotions,
    findStoreProfileByOwnerId,
  } = useData();
  const { currentUser } = useAuth();
  
  const [activeTab, setActiveTab] = useState<ActiveTab>('lookup');
  
  // State for Staff Serving Mode
  const [customerForNewOrder, setCustomerForNewOrder] = useState<User | null>(null); 
  const [servingCustomerPhoneInput, setServingCustomerPhoneInput] = useState(''); 
  const [isStaffServingModeActive, setIsStaffServingModeActive] = useState(!!(currentUser && currentUser.role !== 'Khách hàng')); 

  // State for Rating Modal
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [orderIdForRating, setOrderIdForRating] = useState<string | null>(null);
  const [customerIdForRating, setCustomerIdForRating] = useState<string | null>(null);

  const activePromotions = useMemo(() => {
    const now = new Date();
    const today = now.getDay(); // 0 for Sunday, 1 for Monday...
    return promotions.filter(p => 
        p.isActive &&
        (!p.startDate || new Date(p.startDate) <= now) &&
        (!p.endDate || new Date(p.endDate) >= now) &&
        (!p.applicableDaysOfWeek || p.applicableDaysOfWeek.length === 0 || p.applicableDaysOfWeek.includes(today)) &&
        (!p.applicableChannels || p.applicableChannels.length === 0 || p.applicableChannels.includes('online'))
    ).sort((a,b) => (a.isSystemWide ? -1 : 1) - (b.isSystemWide ? -1 : 1)); // Show system-wide first
  }, [promotions]);

  const openRatingModal = (orderId: string, customerId: string) => {
    setOrderIdForRating(orderId);
    setCustomerIdForRating(customerId);
    setIsRatingModalOpen(true);
  };

  const handleSetServingCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    const phoneToFind = servingCustomerPhoneInput.trim();
    if (!phoneToFind) {
        addNotification({ message: "Vui lòng nhập SĐT khách hàng.", type: 'warning', showToast: true });
        setCustomerForNewOrder(null); 
        return;
    }
    const foundCustomer = users.find(c => c.role === 'Khách hàng' && c.phone === phoneToFind);
    if (foundCustomer) {
        setCustomerForNewOrder(foundCustomer);
        addNotification({ message: `Đang phục vụ khách: ${foundCustomer.name} (${foundCustomer.phone})`, type: 'info', showToast: true });
    } else {
        addNotification({ message: `Không tìm thấy khách hàng với SĐT: ${phoneToFind}. Vui lòng thêm mới nếu cần.`, type: 'warning', showToast: true });
        setCustomerForNewOrder(null); 
    }
  };

  const handleClearServingCustomer = () => {
    setServingCustomerPhoneInput(''); 
    setCustomerForNewOrder(null); 
    addNotification({ message: "Đã hủy chọn khách hàng đang phục vụ.", type: 'info', showToast: true });
  };
  
  const isStaffLoggedIn = currentUser && currentUser.role !== 'Khách hàng';

  const TABS = [
    { id: 'lookup', label: 'Tra cứu Đơn hàng', icon: <SearchIcon size={18}/> },
    { id: 'aiAssistant', label: 'Trợ Lý AI', icon: <MessageCircleIcon size={18}/> },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Card className="shadow-lg rounded-xl p-3 sm:p-4 border border-border-base">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between pb-3 mb-3">
          <div className="flex-grow mb-3 sm:mb-0">
            <h1 className="text-2xl font-bold text-text-heading mb-1">Chào mừng bạn đến với {APP_NAME}!</h1>
            <p className="text-sm text-text-muted">Tra cứu đơn hàng hoặc trò chuyện với trợ lý AI của chúng tôi.</p>
            
            {isStaffLoggedIn && (
              isStaffServingModeActive && !customerForNewOrder ? (
                <form onSubmit={handleSetServingCustomer} className="mt-2 flex items-end space-x-2">
                  <Input
                    label="SĐT Khách hàng phục vụ"
                    value={servingCustomerPhoneInput}
                    onChange={(e) => setServingCustomerPhoneInput(e.target.value)}
                    placeholder="Nhập SĐT khách..."
                    leftIcon={<PhoneIcon size={16} />}
                    wrapperClassName="flex-grow"
                    className="!py-2 text-sm"
                  />
                  <Button type="submit" variant="primary" size="md" className="!py-2 whitespace-nowrap">Chọn Khách</Button>
                </form>
              ) : isStaffServingModeActive && customerForNewOrder ? (
                <div className="mt-2 text-sm text-text-muted">
                  Đang phục vụ: <strong className="text-text-body">{customerForNewOrder.name} ({customerForNewOrder.phone})</strong>
                  <Button variant="link" size="sm" onClick={handleClearServingCustomer} className="ml-2 !p-0.5 text-xs">Đổi khách</Button>
                </div>
              ) : null
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border-t border-border-base pt-4">
          {TABS.map(tab => (
            <Button 
              key={tab.id} 
              variant={activeTab === tab.id ? 'primary' : 'secondary'} 
              onClick={() => setActiveTab(tab.id as ActiveTab)}
              className={`w-full justify-center py-2.5 sm:py-3 ${activeTab === tab.id ? 'shadow-sm' : ''}`}
              leftIcon={React.cloneElement(tab.icon, {className: `mr-2 ${activeTab === tab.id ? 'text-text-on-primary' : 'text-brand-primary'}`})}
            >
              {tab.label}
            </Button>
          ))}
        </div>
      </Card>
      
      {activePromotions.length > 0 && (
          <Card title="Khuyến mãi hấp dẫn" icon={<TagIcon className="text-brand-primary" size={20}/>}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activePromotions.map(promo => {
                      const storeName = promo.isSystemWide 
                          ? null 
                          : (findStoreProfileByOwnerId(promo.ownerId)?.storeName || 'Cửa hàng không xác định');
                      
                      return <PromotionCardDisplay key={promo.id} promotion={promo} storeName={storeName} />;
                  })}
              </div>
          </Card>
      )}

      {activeTab === 'lookup' && (
        <OrderLookupTab
          isStaffServingModeActive={isStaffServingModeActive}
          customerForNewOrder={customerForNewOrder}
          setCustomerForNewOrder={setCustomerForNewOrder}
          identifiedPublicCustomer={null}
          openRatingModal={openRatingModal}
        />
      )}

      {activeTab === 'aiAssistant' && (
        <AIAssistantTab />
      )}
      
      {isRatingModalOpen && orderIdForRating && customerIdForRating && (
        <RatingTipModal 
          isOpen={isRatingModalOpen}
          onClose={() => setIsRatingModalOpen(false)}
          orderId={orderIdForRating}
          customerUserId={customerIdForRating}
        />
      )}
    </div>
  );
};