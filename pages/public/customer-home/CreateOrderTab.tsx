



import React, { useState, useMemo, useEffect, FormEvent } from 'react';
import { useData } from '../../../contexts/DataContext';
import { useAuth } from '../../../contexts/AuthContext';
// FIX: Add PaymentStatus to new order payload
// FIX: Removed deprecated WashMethod type.
import { Order, OrderStatus, ServiceItem as AppServiceItem, User, OrderItem, PaymentStatus, Promotion } from '../../../types';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { Select } from '../../../components/ui/Select';
import { v4 as uuidv4 } from 'uuid';
import { ShoppingCartIcon, PlusIcon, MinusCircleIcon, PackageIcon, TruckIcon, NavigationIcon, CalendarDaysIcon, DollarSignIcon, MessageCircleIcon, AlertTriangle, InfoIcon, BuildingIcon, TagIcon } from 'lucide-react';

interface CustomerOrderItemStructure {
  id: string;
  serviceNameKey: string;
  // FIX: Replaced selectedWashMethod with selectedWashMethodId to align with the data model.
  selectedWashMethodId: string;
  quantity: number;
  notes?: string;
}

interface CreateOrderTabProps {
  isStaffServingModeActive: boolean;
  customerForNewOrder: User | null;
  // FIX: Added missing prop `identifiedPublicCustomer` to the interface.
  identifiedPublicCustomer: User | null;
}

export const CreateOrderTab: React.FC<CreateOrderTabProps> = ({
  isStaffServingModeActive,
  customerForNewOrder,
  identifiedPublicCustomer,
}) => {
  const { 
    services: availableServices, 
    addNotification, 
    addOrder: systemAddOrder, 
    storeProfiles,
    promotions,
    // FIX: Get washMethods from context to look up names.
    washMethods,
  } = useData();
  const { currentUser } = useAuth();

  const [customerOrderItems, setCustomerOrderItems] = useState<CustomerOrderItemStructure[]>([]);
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupTime, setPickupTime] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryTime, setDeliveryTime] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [selectedStoreForManualOrder, setSelectedStoreForManualOrder] = useState<string | null>(null);
  const [selectedPromotionId, setSelectedPromotionId] = useState<string>('');


  const displayCustomer = isStaffServingModeActive ? customerForNewOrder : (currentUser || identifiedPublicCustomer);

  useEffect(() => {
    if (displayCustomer) {
      // FIX: Property 'address' does not exist on type 'User'. Did you mean 'addresses'?
      setPickupAddress(displayCustomer.addresses?.[0]?.street || '');
      // FIX: Property 'address' does not exist on type 'User'. Did you mean 'addresses'?
      setDeliveryAddress(displayCustomer.addresses?.[0]?.street || '');
    } else {
      setPickupAddress('');
      setDeliveryAddress('');
    }
    // Reset order items when customer context changes
    setCustomerOrderItems([]);
    setOrderNotes('');
  }, [displayCustomer]);

  useEffect(() => {
    if (storeProfiles.length === 1) {
      setSelectedStoreForManualOrder(storeProfiles[0].ownerId);
    } else if (storeProfiles.length > 1 && !selectedStoreForManualOrder) {
      setSelectedStoreForManualOrder(null);
    }
  }, [storeProfiles, selectedStoreForManualOrder]);
  
  const uniqueServiceNames = useMemo(() => {
    if (!availableServices || availableServices.length === 0) return [];
    const serviceNames = new Set<string>();
    availableServices.forEach(service => serviceNames.add(service.name));
    return Array.from(serviceNames).map(name => ({
      value: name,
      label: name,
    })).sort((a,b) => a.label.localeCompare(b.label));
  }, [availableServices]);

  const handleAddCustomerOrderItem = () => {
    if (uniqueServiceNames.length === 0) {
        addNotification({ message: "Không có dịch vụ nào để thêm.", type: 'warning' });
        return;
    }
    const defaultServiceName = uniqueServiceNames[0].value;
    const servicesWithThisName = availableServices.filter(s => s.name === defaultServiceName);
    // FIX: Updated to use washMethodId.
    const defaultWashMethodId = servicesWithThisName.length > 0 ? servicesWithThisName[0].washMethodId : (washMethods.find(wm => wm.name === "Giặt ướt")?.id || '');

    setCustomerOrderItems(prev => [
      ...prev,
      { 
        id: uuidv4(),
        serviceNameKey: defaultServiceName, 
        // FIX: Set selectedWashMethodId instead of selectedWashMethod.
        selectedWashMethodId: defaultWashMethodId, 
        quantity: 1, 
        notes: '' 
      }
    ]);
  };

  const handleCustomerOrderItemChange = (itemId: string, field: keyof CustomerOrderItemStructure, value: string | number) => {
    setCustomerOrderItems(prevItems => 
      prevItems.map(item => {
        if (item.id === itemId) {
          const updatedItem = { ...item };
          if (field === 'serviceNameKey') {
            const newServiceName = value as string;
            updatedItem.serviceNameKey = newServiceName;
            const servicesWithThisName = availableServices.filter(s => s.name === newServiceName);
            // FIX: Updated to use washMethodId.
            updatedItem.selectedWashMethodId = servicesWithThisName.length > 0 ? servicesWithThisName[0].washMethodId : (washMethods.find(wm => wm.name === "Giặt ướt")?.id || '');
          } else if (field === 'selectedWashMethodId') {
            // FIX: Updated to handle selectedWashMethodId field.
            updatedItem.selectedWashMethodId = value as string;
          } else if (field === 'quantity') {
            updatedItem.quantity = Math.max(1, parseInt(value as string, 10) || 1);
          } else if (field === 'notes') {
            updatedItem.notes = value as string;
          }
          return updatedItem;
        }
        return item;
      })
    );
  };

  const handleRemoveCustomerOrderItem = (itemId: string) => {
    setCustomerOrderItems(prev => prev.filter(item => item.id !== itemId));
  };

  const subtotal = useMemo(() => {
    return customerOrderItems.reduce((sum, item) => {
      // FIX: Find service using washMethodId.
      const service = availableServices.find(s => s.name === item.serviceNameKey && s.washMethodId === item.selectedWashMethodId);
      if (service) {
        const lineTotal = Math.max(service.price * item.quantity, service.minPrice || 0);
        return sum + lineTotal;
      }
      return sum;
    }, 0);
  }, [customerOrderItems, availableServices]);
  
  const availablePromotionsForOrder = useMemo(() => {
    if (!displayCustomer || !selectedStoreForManualOrder) return [];
    const now = new Date();
    return promotions.filter(p => {
        const isStoreMatch = (p.ownerId === selectedStoreForManualOrder && !p.isSystemWide) ||
                             (p.isSystemWide && !p.optOutRequests?.some(req => req.storeOwnerId === selectedStoreForManualOrder && req.status === 'approved'));

        const isChannelMatch = !p.applicableChannels || p.applicableChannels.length === 0 || p.applicableChannels.includes('online');

        // FIX: Replaced deprecated `!p.isActive` with `p.status !== 'active'` to check promotion status.
        if (!isStoreMatch || p.status !== 'active' || !isChannelMatch) return false;
        
        if (p.startDate && new Date(p.startDate) > now) return false;
        if (p.endDate && new Date(p.endDate) < now) return false;
        if (p.usageLimit && p.timesUsed >= p.usageLimit) return false;
        if (p.usageLimitPerCustomer) {
            const customerUses = (p.usedByCustomerIds || []).filter(id => id === displayCustomer.id).length;
            if (customerUses >= p.usageLimitPerCustomer) return false;
        }
        if (p.minOrderAmount && subtotal < p.minOrderAmount) return false;
        
        // New checks for service and wash method applicability
        if (p.applicableServiceIds && p.applicableServiceIds.length > 0) {
          if (customerOrderItems.length > 0) { // Only apply this filter if there are items in the cart
            const hasApplicableService = customerOrderItems.some(item => {
                // FIX: Find service using washMethodId.
                const service = availableServices.find(s => s.name === item.serviceNameKey && s.washMethodId === item.selectedWashMethodId);
                return service && p.applicableServiceIds!.includes(service.id);
            });
            if (!hasApplicableService) return false;
          }
        }
        // FIX: Changed applicableWashMethods to applicableWashMethodIds.
        if (p.applicableWashMethodIds && p.applicableWashMethodIds.length > 0) {
           if (customerOrderItems.length > 0) {
            // FIX: Changed applicableWashMethods to applicableWashMethodIds.
            const hasApplicableWashMethod = customerOrderItems.some(item => p.applicableWashMethodIds!.includes(item.selectedWashMethodId));
            if (!hasApplicableWashMethod) return false;
           }
        }
        
        return true;
    });
  }, [promotions, displayCustomer, selectedStoreForManualOrder, subtotal, customerOrderItems, availableServices]);

  // Reset selected promotion if it's no longer available after subtotal change
  useEffect(() => {
      if(selectedPromotionId && !availablePromotionsForOrder.some(p => p.id === selectedPromotionId)){
          setSelectedPromotionId('');
      }
  }, [availablePromotionsForOrder, selectedPromotionId]);

  const { promotionDiscount, appliedPromotion } = useMemo(() => {
    const promotion = availablePromotionsForOrder.find(p => p.id === selectedPromotionId);
    if (!promotion) return { promotionDiscount: 0, appliedPromotion: null };

    let discount = 0;
    if (promotion.discountType === 'percentage') {
        discount = (subtotal * promotion.discountValue) / 100;
        if (promotion.maxDiscountAmount && discount > promotion.maxDiscountAmount) {
            discount = promotion.maxDiscountAmount;
        }
    } else { // fixed_amount
        discount = Math.min(subtotal, promotion.discountValue);
    }
    return { promotionDiscount: discount, appliedPromotion: promotion };
  }, [selectedPromotionId, availablePromotionsForOrder, subtotal]);
  
  const finalTotal = subtotal - promotionDiscount;


  const handleCreateOrderSubmit = (e: FormEvent) => {
    e.preventDefault();
     if (customerOrderItems.length === 0) {
      addNotification({ message: 'Vui lòng chọn ít nhất một dịch vụ.', type: 'warning' });
      return;
    }
    
    const customerContextForOrder = displayCustomer; 

    if (!customerContextForOrder) { 
      addNotification({ message: 'Không xác định được thông tin khách hàng. Vui lòng đăng nhập hoặc được nhân viên chọn phục vụ.', type: 'error'});
      return;
    }

    let ownerIdForOrder: string | null = null;
    if (storeProfiles.length === 1) {
      ownerIdForOrder = storeProfiles[0].ownerId;
    } else if (storeProfiles.length > 1) {
      if (!selectedStoreForManualOrder) {
        addNotification({ message: 'Vui lòng chọn cửa hàng để đặt dịch vụ.', type: 'warning' });
        return;
      }
      ownerIdForOrder = selectedStoreForManualOrder;
    } else { 
        addNotification({ message: 'Hiện tại không có cửa hàng nào để đặt dịch vụ. Vui lòng thử lại sau.', type: 'error' });
        return;
    }

    if (!ownerIdForOrder) { 
      addNotification({ message: 'Lỗi: Không thể xác định cửa hàng. Vui lòng thử lại.', type: 'error' });
      return;
    }
    
    let hasInvalidServiceCombination = false;
    // FIX: Construct OrderItem with selectedWashMethodId instead of selectedWashMethod.
    const itemsForNewOrder: OrderItem[] = customerOrderItems.map(coItem => {
        // FIX: Find service using washMethodId.
        const serviceItem = availableServices.find(s => s.name === coItem.serviceNameKey && s.washMethodId === coItem.selectedWashMethodId);
        if (!serviceItem) {
            addNotification({ message: `Lỗi: Không tìm thấy dịch vụ "${coItem.serviceNameKey}" với phương pháp "${coItem.selectedWashMethodId}".`, type: 'error'});
            hasInvalidServiceCombination = true;
            return { serviceItem: {} as AppServiceItem, selectedWashMethodId: coItem.selectedWashMethodId, quantity: coItem.quantity };
        }
        return { 
            serviceItem, 
            selectedWashMethodId: coItem.selectedWashMethodId, 
            quantity: coItem.quantity,
            notes: coItem.notes 
        };
    });

    if (hasInvalidServiceCombination) {
        return; 
    }

    const createdAt = new Date();
    let receivedAt = createdAt;
    if (pickupTime) { 
        try {
            const parsedPickupTime = new Date(pickupTime);
            if (!isNaN(parsedPickupTime.getTime())) {
                receivedAt = parsedPickupTime;
            }
        } catch (e) { console.warn("Error parsing pickupTime", e); }
    }
    
    const itemsMaxCustomerReturnTimeHours = Math.max(0, ...itemsForNewOrder.map(item => item.serviceItem.customerReturnTimeHours));
    const calculatedEstCompletionTimeBasedOnServices = new Date(receivedAt.getTime() + itemsMaxCustomerReturnTimeHours * 60 * 60 * 1000);

    const finalEstimatedCompletionTime = deliveryTime && !isNaN(new Date(deliveryTime).getTime())
        ? new Date(deliveryTime)
        : (itemsMaxCustomerReturnTimeHours > 0 ? calculatedEstCompletionTimeBasedOnServices : undefined);

    const notesParts: string[] = [];
    if (orderNotes.trim()) notesParts.push(orderNotes.trim());
    if (pickupAddress.trim()) notesParts.push(`Lấy đồ tại: ${pickupAddress.trim()}${pickupTime ? ` lúc ${new Date(pickupTime).toLocaleString('vi-VN')}` : ''}`);
    if (deliveryAddress.trim()) notesParts.push(`Giao đồ tại: ${deliveryAddress.trim()}${deliveryTime ? ` lúc ${new Date(deliveryTime).toLocaleString('vi-VN')}` : ''}`);
    const finalCombinedNotes = notesParts.join('; ').trim() || undefined;

    const newOrderPayload: Order = { 
        id: `CUS-REQ-${uuidv4().slice(0,6).toUpperCase()}`, 
        customer: customerContextForOrder,
        items: itemsForNewOrder,
        status: OrderStatus.WAITING_FOR_CONFIRMATION, 
        paymentStatus: PaymentStatus.UNPAID,
        createdAt: createdAt,
        receivedAt: receivedAt,
        estimatedCompletionTime: finalEstimatedCompletionTime,
        totalAmount: finalTotal, 
        appliedPromotionId: appliedPromotion?.id,
        promotionDiscountAmount: promotionDiscount > 0 ? promotionDiscount : undefined,
        scanHistory: [{ timestamp: createdAt, action: 'Yêu cầu đặt lịch từ khách hàng', scannedBy: 'Khách hàng Website' }],
        notes: finalCombinedNotes, 
        ownerId: ownerIdForOrder,
    };
    systemAddOrder(newOrderPayload); 
    addNotification({ message: `Đã gửi yêu cầu đặt lịch. Mã tham khảo: ${newOrderPayload.id}. Cửa hàng sẽ sớm liên hệ để xác nhận.`, type: 'success' });
    
    // Reset form
    setCustomerOrderItems([]); 
    // FIX: Property 'address' does not exist on type 'User'. Did you mean 'addresses'?
    if (customerContextForOrder?.addresses && customerContextForOrder.addresses.length > 0) { 
      // FIX: Property 'address' does not exist on type 'User'. Did you mean 'addresses'?
      setPickupAddress(customerContextForOrder.addresses[0].street); 
      // FIX: Property 'address' does not exist on type 'User'. Did you mean 'addresses'?
      setDeliveryAddress(customerContextForOrder.addresses[0].street); 
    } else {
      setPickupAddress('');
      setDeliveryAddress('');
    }
    setPickupTime(''); 
    setDeliveryTime(''); 
    setOrderNotes('');
    setSelectedStoreForManualOrder(storeProfiles.length === 1 ? storeProfiles[0].ownerId : null);
    setSelectedPromotionId('');
  };
  
  const canSubmitCreateOrder = 
    customerOrderItems.length > 0 &&
    displayCustomer &&
    availableServices.length > 0 &&
    // FIX: Find service using washMethodId.
    !customerOrderItems.some(item => !availableServices.find(s => s.name === item.serviceNameKey && s.washMethodId === item.selectedWashMethodId)) &&
    (storeProfiles.length === 0 || (storeProfiles.length === 1 && storeProfiles[0].ownerId) || (storeProfiles.length > 1 && selectedStoreForManualOrder));

  return (
    <Card title="Đặt lịch Giặt là Trực tuyến" icon={<ShoppingCartIcon className="text-brand-primary" size={20} />}>
      {!displayCustomer && (
        <div className="p-3 mb-4 bg-amber-50 rounded-md text-sm border border-amber-300 flex items-start">
          <AlertTriangle size={18} className="mr-2 flex-shrink-0 mt-0.5 text-amber-600" />
          <div>
            {isStaffServingModeActive ? (
              <span className="text-slate-700">Nhập SĐT ở trên để tìm hoặc tạo khách hàng mới trước khi tạo đơn.</span>
            ) : (
              <span className="text-slate-700">Vui lòng nhập SĐT của bạn ở trên hoặc đăng nhập để đặt lịch.</span>
            )}
          </div>
        </div>
      )}
      {displayCustomer && (
        <div className="p-3 mb-4 bg-emerald-50 text-emerald-700 rounded-md text-sm border border-emerald-300">
          <p><strong className="font-semibold">Khách hàng:</strong> {displayCustomer.name} ({displayCustomer.phone})</p>
          {/* FIX: Property 'address' does not exist on type 'User'. Did you mean 'addresses'? */}
          {displayCustomer.addresses?.[0]?.street && <p><strong className="font-semibold">Địa chỉ mặc định:</strong> {displayCustomer.addresses[0].street}</p>}
        </div>
      )}

      <form onSubmit={handleCreateOrderSubmit} className="space-y-6">
        <fieldset className="space-y-4 p-4 border border-border-base rounded-lg">
          <legend className="text-md font-semibold text-text-heading mb-2 px-1 flex items-center"><PackageIcon size={18} className="mr-2 text-brand-primary" />Dịch vụ Chọn</legend>
          {customerOrderItems.map((item, index) => {
            // FIX: Use washMethods to look up names for the options.
            const washMethodsForService = availableServices
              .filter(s => s.name === item.serviceNameKey)
              .map(s => {
                  const washMethod = washMethods.find(wm => wm.id === s.washMethodId);
                  return { value: s.washMethodId, label: `${washMethod?.name || s.washMethodId} (${s.price.toLocaleString('vi-VN')}đ)`};
              })
              .filter((option, idx, self) => self.findIndex(o => o.value === option.value) === idx);
            
            // FIX: Find service using washMethodId.
            const currentSelectedServiceDetails = availableServices.find(s => s.name === item.serviceNameKey && s.washMethodId === item.selectedWashMethodId);
            const lineItemTotal = currentSelectedServiceDetails ? Math.max(currentSelectedServiceDetails.price * item.quantity, currentSelectedServiceDetails.minPrice || 0) : 0;

            return (
              <div key={item.id} className="p-3 border border-border-input rounded-md bg-bg-subtle/30 space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-x-3 gap-y-2 items-end">
                  <Select wrapperClassName="md:col-span-4" label={`Dịch vụ ${index + 1}`} options={uniqueServiceNames} value={item.serviceNameKey} onChange={(e) => handleCustomerOrderItemChange(item.id, 'serviceNameKey', e.target.value)} disabled={uniqueServiceNames.length === 0} />
                  <Select wrapperClassName="md:col-span-3" label="PP Giặt & Giá" options={washMethodsForService.length > 0 ? washMethodsForService : [{ value: item.selectedWashMethodId, label: item.selectedWashMethodId }]} value={item.selectedWashMethodId} onChange={(e) => handleCustomerOrderItemChange(item.id, 'selectedWashMethodId', e.target.value)} disabled={washMethodsForService.length === 0} />
                  <Input wrapperClassName="md:col-span-1" label="SL*" type="number" min="1" value={item.quantity.toString()} onChange={(e) => handleCustomerOrderItemChange(item.id, 'quantity', parseInt(e.target.value, 10))} required />
                  <div className="md:col-span-2 text-sm text-right self-center">
                    <span className="font-semibold text-text-heading">TT: {lineItemTotal.toLocaleString('vi-VN')}</span>
                  </div>
                  <div className="md:col-span-2 flex justify-end">
                    <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveCustomerOrderItem(item.id)} className="p-1.5 text-status-danger hover:bg-rose-100" title="Xóa mục"><MinusCircleIcon size={18} /></Button>
                  </div>
                </div>
                <Input label="Ghi chú cho dịch vụ này" value={item.notes || ''} onChange={(e) => handleCustomerOrderItemChange(item.id, 'notes', e.target.value)} placeholder="VD: Giặt kỹ cổ áo, không tẩy..." className="text-xs py-1.5" />
              </div>
            );
          })}
          <Button type="button" variant="secondary" onClick={handleAddCustomerOrderItem} leftIcon={<PlusIcon size={16} />} size="sm" disabled={uniqueServiceNames.length === 0}>Thêm dịch vụ</Button>
          {uniqueServiceNames.length === 0 && <p className="text-xs text-text-muted mt-1">Hiện chưa có dịch vụ nào được định nghĩa.</p>}
        </fieldset>

        {storeProfiles.length > 1 && (
          <Select label="Chọn cửa hàng phục vụ*" options={storeProfiles.map(p => ({ value: p.ownerId, label: `${p.storeName} (${p.storeAddress?.substring(0, 20) || 'N/A'}...)` }))} value={selectedStoreForManualOrder || ""} onChange={e => setSelectedStoreForManualOrder(e.target.value)} placeholder="-- Chọn một cửa hàng --" leftIcon={<BuildingIcon size={16} />} required />
        )}
        {storeProfiles.length === 1 && (
          <p className="text-sm text-text-muted p-2 bg-sky-50 rounded-md">Dịch vụ sẽ được xử lý tại: <strong className="text-text-body">{storeProfiles[0].storeName}</strong>.</p>
        )}
        {storeProfiles.length === 0 && (
          <p className="text-sm text-status-warning p-2 bg-amber-50 rounded-md">Hiện chưa có cửa hàng nào được cấu hình. Vui lòng thử lại sau.</p>
        )}
        
        <fieldset className="space-y-3 p-4 border border-border-base rounded-lg">
           <legend className="text-md font-semibold text-text-heading mb-2 px-1 flex items-center"><TagIcon size={18} className="mr-2 text-brand-primary" />Khuyến mãi</legend>
            {storeProfiles.length > 1 && !selectedStoreForManualOrder ? (
                <p className="text-sm text-text-muted italic p-2 bg-blue-50 rounded-md">Vui lòng chọn một cửa hàng để xem các khuyến mãi áp dụng.</p>
            ) : availablePromotionsForOrder.length > 0 ? (
                <Select
                    label="Chọn khuyến mãi để áp dụng"
                    value={selectedPromotionId}
                    onChange={(e) => setSelectedPromotionId(e.target.value)}
                    options={[{value: '', label: '-- Không áp dụng --'}, ...availablePromotionsForOrder.map(p => ({
                        value: p.id,
                        label: `${p.name} (${p.code})`
                    }))]}
                />
            ) : (
                <p className="text-sm text-text-muted">Không có khuyến mãi nào phù hợp cho đơn hàng của bạn tại cửa hàng này.</p>
            )}
        </fieldset>


        <fieldset className="space-y-3 p-4 border border-border-base rounded-lg">
          <legend className="text-md font-semibold text-text-heading mb-2 px-1 flex items-center"><TruckIcon size={18} className="mr-2 text-brand-primary" />Thông tin Giao/Nhận (tùy chọn)</legend>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Địa chỉ lấy đồ" value={pickupAddress} onChange={e => setPickupAddress(e.target.value)} placeholder="Để trống nếu mang đến tiệm" leftIcon={<NavigationIcon size={16} />} />
            <Input label="Thời gian lấy đồ" type="datetime-local" value={pickupTime} onChange={e => setPickupTime(e.target.value)} leftIcon={<CalendarDaysIcon size={16} />} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Địa chỉ giao đồ" value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} placeholder="Để trống nếu tự đến lấy" leftIcon={<NavigationIcon size={16} />} />
            <Input label="Thời gian giao đồ" type="datetime-local" value={deliveryTime} onChange={e => setDeliveryTime(e.target.value)} leftIcon={<CalendarDaysIcon size={16} />} />
          </div>
        </fieldset>
        <Input label="Ghi chú chung cho đơn hàng" isTextArea rows={2} value={orderNotes} onChange={e => setOrderNotes(e.target.value)} placeholder="Yêu cầu đặc biệt khác..." leftIcon={<MessageCircleIcon size={16} />} />
        
        <div className="p-4 bg-sky-50 dark:bg-sky-800/30 rounded-lg border border-sky-200 dark:border-sky-700 space-y-2">
            <div className="flex justify-between items-center text-md">
                <span className="text-text-muted">Tạm tính:</span>
                <span className="text-text-body">{subtotal.toLocaleString('vi-VN')} VNĐ</span>
            </div>
             {promotionDiscount > 0 && (
                <div className="flex justify-between items-center text-md text-status-success-text">
                    <span>Khuyến mãi ({appliedPromotion?.code}):</span>
                    <span>- {promotionDiscount.toLocaleString('vi-VN')} VNĐ</span>
                </div>
             )}
          <div className="flex justify-between items-center pt-2 border-t border-sky-200">
            <p className="text-md font-semibold text-text-heading flex items-center">
              <DollarSignIcon size={18} className="inline mr-1.5 text-brand-primary" />Tổng tiền dự kiến:
            </p>
            <p className="text-xl font-bold text-brand-primary">{finalTotal.toLocaleString('vi-VN')} VNĐ</p>
          </div>
        </div>

        <Button type="submit" variant="primary" size="lg" className="w-full" leftIcon={<ShoppingCartIcon size={20} />} disabled={!canSubmitCreateOrder}>
          Gửi Yêu cầu Đặt lịch
        </Button>
      </form>
    </Card>
  );
};
