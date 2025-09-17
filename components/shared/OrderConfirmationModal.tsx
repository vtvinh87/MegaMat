import React, { useState, useMemo, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { QRCodeDisplay } from './QRCodeDisplay';
// FIX: Replaced deprecated Customer type with User.
// FIX: Removed deprecated WashMethod type and added WashMethodDefinition for lookups.
import { Order, User, ServiceItem as AppServiceItem, OrderItem, OrderStatus, UserRole, ScanHistoryEntry, WashMethodDefinition, OrderDetailsFromAI as AppOrderDetailsFromAI, StoreProfile, PaymentStatus, Promotion } from '../../types';
import { XIcon, CheckCircleIcon, ShoppingCartIcon, UserIcon, CalendarDaysIcon, TruckIcon, DollarSignIcon, AlertTriangleIcon, InfoIcon, PlusIcon, MinusCircleIcon, TagIcon } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useData } from '../../contexts/DataContext'; 
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Modal } from '../ui/Modal';

interface EditableOrderItem {
  id: string;
  serviceNameKey: string;
  // FIX: Replaced selectedWashMethod with selectedWashMethodId to align with data model.
  selectedWashMethodId: string;
  quantity: number;
  notes?: string;
}

interface OrderConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (confirmedOrder: Order, isNewCustomer: boolean) => void; 
  orderDetailsFromAI: AppOrderDetailsFromAI;
  // FIX: Replaced deprecated Customer type with User.
  customer: User; 
  availableServices: AppServiceItem[];
  addUser: (customer: Omit<User, 'id'>) => Promise<User | null>; 
  targetStoreOwnerId?: string; 
  // FIX: Added washMethods prop to allow for name lookups.
  washMethods: WashMethodDefinition[];
}

export const OrderConfirmationModal: React.FC<OrderConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  orderDetailsFromAI,
  customer: customerFromAI, 
  availableServices,
  // FIX: Renamed for clarity.
  addUser: addUserToContext, 
  targetStoreOwnerId, 
  // FIX: Destructure new washMethods prop.
  washMethods,
}) => {
  const { users: globalUsers, storeProfiles, findPromotionByCode, addNotification } = useData(); 

  const [showPaymentQR, setShowPaymentQR] = useState(false);
  const [finalOrderForQR, setFinalOrderForQR] = useState<Order | null>(null); 
  const [processingError, setProcessingError] = useState<string | null>(null);
  
  // Editable state
  const [editableItems, setEditableItems] = useState<EditableOrderItem[]>([]);
  const [editableOrderDetails, setEditableOrderDetails] = useState({
      pickupAddress: '', deliveryAddress: '', pickupTime: '', deliveryTime: '', orderNotes: ''
  });

  // Promotion State
  const [voucherCode, setVoucherCode] = useState('');
  const [appliedPromotion, setAppliedPromotion] = useState<Promotion | null>(null);
  const [promotionError, setPromotionError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setShowPaymentQR(false);
      setFinalOrderForQR(null);
      setProcessingError(null);
      setVoucherCode('');
      setAppliedPromotion(null);
      setPromotionError(null);
      
      if(orderDetailsFromAI) {
        const mappedItems = orderDetailsFromAI.items.map(aiItem => {
          const matchingService = availableServices.find(s => s.name.toLowerCase() === aiItem.serviceName.toLowerCase());
          return {
            id: uuidv4(),
            serviceNameKey: matchingService?.name || aiItem.serviceName,
            // FIX: Replaced deprecated washMethod with washMethodId.
            selectedWashMethodId: matchingService?.washMethodId || '',
            quantity: aiItem.quantity,
            notes: aiItem.notes,
          };
        });
        setEditableItems(mappedItems);
        setEditableOrderDetails({
          pickupAddress: orderDetailsFromAI.pickupAddress || '',
          deliveryAddress: orderDetailsFromAI.deliveryAddress || '',
          pickupTime: orderDetailsFromAI.pickupTime || '',
          deliveryTime: orderDetailsFromAI.deliveryTime || '',
          orderNotes: orderDetailsFromAI.orderNotes || '',
        });
      }
    }
  }, [isOpen, orderDetailsFromAI, availableServices]);

  const uniqueServiceNames = useMemo(() => {
    if (!availableServices || availableServices.length === 0) return [];
    const serviceNames = new Set<string>();
    availableServices.forEach(service => serviceNames.add(service.name));
    return Array.from(serviceNames).map(name => ({ value: name, label: name })).sort((a,b) => a.label.localeCompare(b.label));
  }, [availableServices]);

  const { subtotal, serviceMatchingErrors } = useMemo(() => {
    let currentTotal = 0;
    const errors: string[] = [];
    editableItems.forEach(item => {
      // FIX: Changed check from washMethod to washMethodId.
      const service = availableServices.find(s => s.name === item.serviceNameKey && s.washMethodId === item.selectedWashMethodId);
      if (service) {
        currentTotal += Math.max(service.price * item.quantity, service.minPrice || 0);
      } else {
        errors.push(`Dịch vụ "${item.serviceNameKey}" không hợp lệ.`);
      }
    });
    return { subtotal: currentTotal, serviceMatchingErrors: errors };
  }, [editableItems, availableServices]);

  const promotionDiscount = useMemo(() => {
    if (!appliedPromotion || subtotal <= 0) return 0;
    if (appliedPromotion.minOrderAmount && subtotal < appliedPromotion.minOrderAmount) {
        return 0; 
    }
    if (appliedPromotion.discountType === 'percentage') {
        let discount = (subtotal * appliedPromotion.discountValue) / 100;
        if (appliedPromotion.maxDiscountAmount && discount > appliedPromotion.maxDiscountAmount) {
            discount = appliedPromotion.maxDiscountAmount;
        }
        return discount;
    }
    if (appliedPromotion.discountType === 'fixed_amount') {
        return Math.min(subtotal, appliedPromotion.discountValue);
    }
    return 0;
  }, [appliedPromotion, subtotal]);

  const finalTotal = subtotal - promotionDiscount;


  const handleItemChange = (itemId: string, field: keyof EditableOrderItem, value: string | number) => {
    setEditableItems(prev => prev.map(item => {
      if (item.id === itemId) {
        const updated = { ...item, [field]: value };
        if (field === 'serviceNameKey') {
          const servicesWithThisName = availableServices.filter(s => s.name === value);
          // FIX: Updated to use washMethodId.
          updated.selectedWashMethodId = servicesWithThisName[0]?.washMethodId || '';
        }
        if (field === 'quantity') {
          updated.quantity = Math.max(1, Number(value) || 1);
        }
        return updated;
      }
      return item;
    }));
  };

  const handleAddItem = () => {
    if (uniqueServiceNames.length === 0) return;
    const defaultService = availableServices.find(s => s.name === uniqueServiceNames[0].value);
    setEditableItems(prev => [...prev, {
      id: uuidv4(),
      serviceNameKey: defaultService?.name || '',
      // FIX: Updated to use washMethodId.
      selectedWashMethodId: defaultService?.washMethodId || '',
      quantity: 1,
      notes: ''
    }]);
  };

  const handleRemoveItem = (itemId: string) => {
    setEditableItems(prev => prev.filter(item => item.id !== itemId));
  };

  const handleApplyVoucher = () => {
    setPromotionError(null);
    setAppliedPromotion(null);
    if (!voucherCode.trim()) return;

    const promotion = findPromotionByCode(voucherCode.trim(), targetStoreOwnerId, 'online');
    
    if (!promotion) { setPromotionError("Mã khuyến mãi không hợp lệ hoặc không áp dụng cho cửa hàng này."); return; }
    // FIX: Replaced deprecated `promotion.isActive` with `promotion.status !== 'active'` to check promotion status.
    if (promotion.status !== 'active') { setPromotionError("Mã khuyến mãi đã hết hiệu lực."); return; }
    if (promotion.startDate && new Date(promotion.startDate) > new Date()) { setPromotionError("Mã chưa đến ngày áp dụng."); return; }
    if (promotion.endDate && new Date(promotion.endDate) < new Date()) { setPromotionError("Mã đã hết hạn."); return; }
    if (promotion.usageLimit && promotion.timesUsed >= promotion.usageLimit) { setPromotionError("Mã đã hết lượt sử dụng."); return; }
    
    if (editableItems.length === 0) {
        setPromotionError("Vui lòng thêm dịch vụ vào đơn hàng trước khi áp dụng mã.");
        return;
    }
    if (promotion.applicableServiceIds && promotion.applicableServiceIds.length > 0) {
        const hasApplicableService = editableItems.some(item => {
            // FIX: Updated to use washMethodId for finding the service.
            const service = availableServices.find(s => s.name === item.serviceNameKey && s.washMethodId === item.selectedWashMethodId);
            return service && promotion.applicableServiceIds!.includes(service.id);
        });
        if (!hasApplicableService) {
            setPromotionError("Mã khuyến mãi này không áp dụng cho bất kỳ dịch vụ nào trong đơn hàng của bạn.");
            return;
        }
    }
    // FIX: Changed applicableWashMethods to applicableWashMethodIds.
    if (promotion.applicableWashMethodIds && promotion.applicableWashMethodIds.length > 0) {
        const hasApplicableWashMethod = editableItems.some(item => 
            // FIX: Changed applicableWashMethods to applicableWashMethodIds.
            promotion.applicableWashMethodIds!.includes(item.selectedWashMethodId)
        );
        if (!hasApplicableWashMethod) {
            // FIX: Changed applicableWashMethods to applicableWashMethodIds.
            setPromotionError("Mã khuyến mãi này không áp dụng cho phương pháp giặt nào trong đơn hàng của bạn.");
            return;
        }
    }

    if (promotion.minOrderAmount && subtotal < promotion.minOrderAmount) { setPromotionError(`Đơn hàng phải có giá trị tối thiểu ${promotion.minOrderAmount.toLocaleString('vi-VN')} VNĐ.`); return; }
    if (promotion.usageLimitPerCustomer) {
        const customerUses = (promotion.usedByCustomerIds || []).filter(id => id === customerFromAI.id).length;
        if (customerUses >= promotion.usageLimitPerCustomer) { setPromotionError(`Bạn đã sử dụng mã này tối đa ${promotion.usageLimitPerCustomer} lần.`); return; }
    }
    
    setAppliedPromotion(promotion);
    addNotification({message: `Áp dụng thành công mã "${promotion.name}".`, type: 'success'});
  };

  const handleRemoveVoucher = () => {
      setVoucherCode('');
      setAppliedPromotion(null);
      setPromotionError(null);
  };


  const handleConfirmAndPay = async () => {
    setProcessingError(null);
    if (serviceMatchingErrors.length > 0) {
      setProcessingError(`Không thể tạo đơn hàng do có dịch vụ không hợp lệ: ${serviceMatchingErrors.join('; ')}`);
      return;
    }

    const isValidOwnerId = targetStoreOwnerId && storeProfiles.some(p => p.ownerId === targetStoreOwnerId);
    if (!isValidOwnerId) {
      setProcessingError("Lỗi: Cửa hàng được AI chọn không hợp lệ hoặc không được cung cấp. Vui lòng yêu cầu AI chọn lại một cửa hàng từ danh sách.");
      return;
    }

    let finalCustomerForOrder: User | null = null;
    const isTrulyNewCustomer = customerFromAI.id.startsWith('temp-') || !globalUsers.some(gc => gc.phone === customerFromAI.phone);

    if (isTrulyNewCustomer) {
      const newCustomerData: Omit<User, 'id'> = {
          ...customerFromAI,
          role: UserRole.CUSTOMER,
          username: customerFromAI.phone, 
          password: '123123'
      };
      const newlyCreatedUser = await addUserToContext(newCustomerData);
      if (newlyCreatedUser) {
        finalCustomerForOrder = newlyCreatedUser;
      } else {
        setProcessingError("Lỗi: Không thể tạo khách hàng mới. Tên đăng nhập (SĐT) có thể đã tồn tại.");
        return;
      }
    } else {
      const existingGlobalCustomer = globalUsers.find(gc => gc.phone === customerFromAI.phone);
      if (existingGlobalCustomer) {
        finalCustomerForOrder = { ...existingGlobalCustomer, name: orderDetailsFromAI.customer?.name || existingGlobalCustomer.name, address: orderDetailsFromAI.customer?.address || existingGlobalCustomer.address || undefined };
      }
    }

    if (!finalCustomerForOrder) {
      setProcessingError("Lỗi: Không thể xác định thông tin khách hàng.");
      return;
    }

    // FIX: Construct OrderItem with selectedWashMethodId instead of selectedWashMethod.
    const itemsForNewOrder: OrderItem[] = editableItems.map(item => {
      // FIX: Find service using washMethodId.
      const service = availableServices.find(s => s.name === item.serviceNameKey && s.washMethodId === item.selectedWashMethodId)!; // Already validated
      return {
          serviceItem: service,
          selectedWashMethodId: item.selectedWashMethodId,
          quantity: item.quantity,
          notes: item.notes?.trim() || undefined,
      };
    });

    const createdAt = new Date();
    const newOrderId = `AI-${uuidv4().slice(0, 6).toUpperCase()}`;

    const newOrderPayload: Order = {
      id: newOrderId,
      customer: finalCustomerForOrder,
      items: itemsForNewOrder,
      status: OrderStatus.WAITING_FOR_CONFIRMATION,
      paymentStatus: PaymentStatus.UNPAID,
      createdAt,
      totalAmount: finalTotal,
      appliedPromotionId: appliedPromotion?.id,
      promotionDiscountAmount: promotionDiscount > 0 ? promotionDiscount : undefined,
      notes: editableOrderDetails.orderNotes,
      scanHistory: [{ timestamp: createdAt, action: 'Yêu cầu đặt lịch từ Trợ Lý AI', scannedBy: 'Trợ lý AI' }],
      ownerId: targetStoreOwnerId!,
    };

    onConfirm(newOrderPayload, isTrulyNewCustomer);
  };
  
  if (!isOpen) return null;

  const renderItemRow = (item: EditableOrderItem) => {
    // FIX: Updated to use washMethodId and get wash method name from the new prop.
    const washMethodsForService = availableServices
      .filter(s => s.name === item.serviceNameKey)
      .map(s => {
          const washMethod = washMethods.find(wm => wm.id === s.washMethodId);
          return { value: s.washMethodId, label: `${washMethod?.name || s.washMethodId} (${s.price.toLocaleString('vi-VN')}đ)`};
      });
    const lineTotal = availableServices.find(s => s.name === item.serviceNameKey && s.washMethodId === item.selectedWashMethodId)?.price * item.quantity || 0;

    return (
      <div key={item.id} className="grid grid-cols-12 gap-2 items-end border-b border-border-base pb-2 mb-2">
        <div className="col-span-12 md:col-span-4">
          <Select label="Dịch vụ" options={uniqueServiceNames} value={item.serviceNameKey} onChange={e => handleItemChange(item.id, 'serviceNameKey', e.target.value)} />
        </div>
        <div className="col-span-6 md:col-span-3">
          <Select label="PP Giặt" options={washMethodsForService} value={item.selectedWashMethodId} onChange={e => handleItemChange(item.id, 'selectedWashMethodId', e.target.value)} />
        </div>
        <div className="col-span-6 md:col-span-2">
          <Input label="SL" type="number" min="1" value={item.quantity} onChange={e => handleItemChange(item.id, 'quantity', e.target.value)} />
        </div>
        <div className="col-span-10 md:col-span-2 text-right self-center">
          <span className="text-sm font-medium">{lineTotal.toLocaleString('vi-VN')}đ</span>
        </div>
        <div className="col-span-2 md:col-span-1 text-right">
          <Button variant="ghost" size="sm" onClick={() => handleRemoveItem(item.id)} className="p-1 text-status-danger hover:bg-status-danger-bg"><MinusCircleIcon size={16} /></Button>
        </div>
        <div className="col-span-12">
            <Input label="Ghi chú" value={item.notes || ''} onChange={e => handleItemChange(item.id, 'notes', e.target.value)} className="text-xs py-1" />
        </div>
      </div>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Xác nhận Đơn hàng từ AI" size="xl">
        <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-2">
            {processingError && <p className="text-sm text-status-danger p-2 bg-status-danger-bg rounded-md flex items-center"><AlertTriangleIcon size={16} className="mr-2"/>{processingError}</p>}
            
            <Card title="Thông tin Khách hàng" icon={<UserIcon size={18}/>} className="bg-bg-subtle">
                <p><strong>Tên:</strong> {customerFromAI.name}</p>
                <p><strong>SĐT:</strong> {customerFromAI.phone}</p>
                {customerFromAI.address && <p><strong>Địa chỉ:</strong> {customerFromAI.address}</p>}
            </Card>

            <Card title="Chi tiết Dịch vụ" icon={<ShoppingCartIcon size={18}/>} className="bg-bg-subtle">
                {editableItems.map(renderItemRow)}
                <Button onClick={handleAddItem} variant="secondary" size="sm" leftIcon={<PlusIcon size={16}/>}>Thêm dịch vụ</Button>
            </Card>

            <Card title="Khuyến mãi" icon={<TagIcon size={18}/>} className="bg-bg-subtle">
                <div className="flex items-end space-x-2">
                    <Input wrapperClassName="flex-grow" label="Mã Voucher" value={voucherCode} onChange={e => setVoucherCode(e.target.value.toUpperCase())} placeholder="Nhập mã..." disabled={!!appliedPromotion} />
                    {appliedPromotion ? (
                        <Button onClick={handleRemoveVoucher} variant="secondary">Hủy mã</Button>
                    ) : (
                        <Button onClick={handleApplyVoucher}>Áp dụng</Button>
                    )}
                </div>
                 {promotionError && <p className="text-xs text-status-danger mt-1">{promotionError}</p>}
                 {appliedPromotion && (
                    <div className="mt-2 p-2 bg-emerald-50 text-emerald-700 rounded-md text-sm border border-emerald-200">
                        Đang áp dụng: "{appliedPromotion.name}"
                    </div>
                 )}
            </Card>

            <div className="p-4 bg-sky-50 rounded-lg border border-sky-200 space-y-2">
                <div className="flex justify-between items-center text-md">
                    <span className="text-text-muted">Tạm tính:</span>
                    <span className="text-text-body">{subtotal.toLocaleString('vi-VN')} VNĐ</span>
                </div>
                 {promotionDiscount > 0 && (
                    <div className="flex justify-between items-center text-md text-status-success-text">
                        <span>Khuyến mãi:</span>
                        <span>- {promotionDiscount.toLocaleString('vi-VN')} VNĐ</span>
                    </div>
                 )}
              <div className="flex justify-between items-center pt-2 border-t border-sky-200">
                  <span className="text-lg font-semibold text-text-heading flex items-center"><DollarSignIcon size={20} className="mr-2"/>Tổng cộng:</span>
                  <span className="text-2xl font-bold text-brand-primary">{finalTotal.toLocaleString('vi-VN')} VNĐ</span>
              </div>
            </div>
        </div>
        <div className="mt-6 flex justify-end space-x-3 border-t border-border-base pt-4">
            <Button type="button" variant="secondary" onClick={onClose}>Hủy</Button>
            <Button type="button" variant="primary" onClick={handleConfirmAndPay} disabled={!!processingError || editableItems.length === 0 || serviceMatchingErrors.length > 0}>
                Xác nhận & Gửi yêu cầu
            </Button>
        </div>
    </Modal>
  );
};