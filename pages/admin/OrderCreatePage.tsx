import React, { useState, useEffect, useCallback, FormEvent, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
// FIX: Replaced useAppContext with useData and useAuth
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
// FIX: Replaced deprecated Customer type with User.
// FIX: Removed WashMethod import as it is deprecated.
import { User, Order, OrderItem, OrderStatus, ServiceItem as AppServiceItem, UserRole, ScanHistoryEntry, Promotion, PaymentStatus } from '../../types'; // Renamed ServiceItem
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { v4 as uuidv4 } from 'uuid';
import { PlusCircleIcon, Trash2Icon, SaveIcon, XCircleIcon, Users, ShoppingCart, DollarSign, Clock, Edit3Icon, MessageSquareIcon, PrinterIcon, SearchIcon, PhoneIcon, RotateCcwIcon, AlertTriangleIcon, InfoIcon, CalendarDays as CalendarIcon, TagIcon } from 'lucide-react';
import { Spinner } from '../../components/ui/Spinner';


interface LocalOrderItem {
  id: string; 
  serviceNameKey: string; 
  selectedWashMethodId: string;
  quantity: number;
  notes?: string;
}

export const OrderCreatePage: React.FC = () => {
  const { id: editOrderId } = useParams<{ id?: string }>(); 
  // FIX: Replaced useAppContext with useData and useAuth
  const { 
    // FIX: Using `users` array instead of deprecated `customers`.
    users, 
    services: appContextServices,
    addOrder, 
    updateOrder, 
    findOrder, 
    // FIX: `addUser` is used to add new customers (as Users).
    addUser: addNewGlobalCustomer, 
    addNotification,
    getCurrentUserOwnerId,
    findPromotionByCode,
    washMethods,
  } = useData();
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [isEditMode, setIsEditMode] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  const [customerPhoneInput, setCustomerPhoneInput] = useState('');
  const [customerNameInput, setCustomerNameInput] = useState('');
  const [customerAddressInput, setCustomerAddressInput] = useState('');
  // FIX: Replaced deprecated Customer type with User.
  const [resolvedCustomer, setResolvedCustomer] = useState<User | null>(null);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [showNewCustomerFields, setShowNewCustomerFields] = useState(false);
  const [isCustomerPhoneLocked, setIsCustomerPhoneLocked] = useState(false);
  
  const [orderItems, setOrderItems] = useState<LocalOrderItem[]>([]);
  const [editReason, setEditReason] = useState<string>(''); 
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [orderNotes, setOrderNotes] = useState('');
  const [manualEstimatedReturnTime, setManualEstimatedReturnTime] = useState('');
  
  // State for return time warning modal
  const [isReturnTimeWarningModalOpen, setIsReturnTimeWarningModalOpen] = useState(false);
  const [returnTimeWarningMessage, setReturnTimeWarningMessage] = useState('');
  
  // State for promotions
  const [voucherCode, setVoucherCode] = useState('');
  const [appliedPromotion, setAppliedPromotion] = useState<Promotion | null>(null);
  const [promotionError, setPromotionError] = useState<string | null>(null);


  // Ref for auto-focus
  const customerNameInputRef = useRef<HTMLInputElement>(null);


  const uniqueServiceGroupOptions = useMemo(() => {
    if (!appContextServices || appContextServices.length === 0) return [];
    const serviceNames = new Set<string>();
    appContextServices.forEach(service => serviceNames.add(service.name));
    return Array.from(serviceNames).map(name => ({
      value: name,
      label: name,
    })).sort((a,b) => a.label.localeCompare(b.label));
  }, [appContextServices]);


  useEffect(() => {
    if (editOrderId) {
      const orderToEdit = findOrder(editOrderId);
      if (orderToEdit) {
        if (orderToEdit.status !== OrderStatus.PENDING && orderToEdit.status !== OrderStatus.CANCELLED && orderToEdit.status !== OrderStatus.WAITING_FOR_CONFIRMATION) {
            addNotification({message: `Chỉ có thể sửa đơn hàng ở trạng thái "Chờ xác nhận", "Chưa xử lý" hoặc "Đã hủy". Đơn hàng ${editOrderId} đang ở trạng thái "${orderToEdit.status}".`, type: 'error'});
            navigate('/admin/orders');
            return;
        }
        const currentUserOwnerId = getCurrentUserOwnerId();
        if (currentUser?.role !== UserRole.CHAIRMAN && orderToEdit.ownerId !== currentUserOwnerId) {
            addNotification({message: `Bạn không có quyền sửa đơn hàng ${editOrderId} này.`, type: 'error'});
            navigate('/admin/orders');
            return;
        }

        setIsEditMode(true);
        setEditingOrder(orderToEdit);
        setResolvedCustomer(orderToEdit.customer);
        setCustomerPhoneInput(orderToEdit.customer.phone);
        setCustomerNameInput(orderToEdit.customer.name);
        setCustomerAddressInput(orderToEdit.customer.address || '');
        setIsCustomerPhoneLocked(true); 
        setShowNewCustomerFields(false);
        setOrderNotes(orderToEdit.notes || '');
        
        if (orderToEdit.estimatedCompletionTime) {
            const d = new Date(orderToEdit.estimatedCompletionTime);
            d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
            setManualEstimatedReturnTime(d.toISOString().slice(0, 16));
        }

        setOrderItems(orderToEdit.items.map(item => ({ 
          id: uuidv4(),
          serviceNameKey: item.serviceItem.name, 
          selectedWashMethodId: item.selectedWashMethodId, 
          quantity: item.quantity,
          notes: item.notes || '',
        }))); 
      } else {
        addNotification({ message: `Không tìm thấy đơn hàng để chỉnh sửa: ${editOrderId}, hoặc bạn không có quyền truy cập.`, type: 'error' });
        navigate('/admin/orders');
      }
    } else {
      setIsEditMode(false); setEditingOrder(null); setCustomerPhoneInput(''); setCustomerNameInput('');
      setCustomerAddressInput(''); setResolvedCustomer(null); setShowNewCustomerFields(false);
      setIsCustomerPhoneLocked(false); setOrderItems([]); setEditReason(''); setOrderNotes('');
      setManualEstimatedReturnTime('');
    }
  }, [editOrderId, findOrder, navigate, addNotification, currentUser, getCurrentUserOwnerId]);
  
  // Auto-focus on customer name input when new customer fields are shown
  useEffect(() => {
    if (showNewCustomerFields && !resolvedCustomer) {
      const timer = setTimeout(() => {
        customerNameInputRef.current?.focus();
      }, 50); // Small delay to ensure the input is rendered
      return () => clearTimeout(timer);
    }
  }, [showNewCustomerFields, resolvedCustomer]);
  
  const handleCustomerPhoneSearch = async () => {
    if (!customerPhoneInput.trim()) {
      addNotification({message: "Vui lòng nhập SĐT khách hàng.", type: 'warning'});
      return;
    }
    setIsSearchingCustomer(true);
    setResolvedCustomer(null);
    setShowNewCustomerFields(false);
    setGlobalError(null);
    await new Promise(res => setTimeout(res, 300)); // Simulate API delay
    // FIX: Search for users with the role of Customer.
    const foundCustomer = users.find(c => c.role === UserRole.CUSTOMER && c.phone === customerPhoneInput.trim());
    if (foundCustomer) {
      setResolvedCustomer(foundCustomer);
      setCustomerNameInput(foundCustomer.name);
      setCustomerAddressInput(foundCustomer.address || '');
      setIsCustomerPhoneLocked(true);
      addNotification({message: `Đã tìm thấy khách hàng: ${foundCustomer.name}`, type: 'success'});
    } else {
      setShowNewCustomerFields(true);
      setCustomerNameInput('');
      setCustomerAddressInput('');
      addNotification({message: `Không tìm thấy khách hàng. Vui lòng nhập thông tin khách mới.`, type: 'info'});
    }
    setIsSearchingCustomer(false);
  };
  
  const handlePhoneKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // Prevent default form submission behavior
      handleCustomerPhoneSearch();
    }
  };

  const handleResetCustomerSearch = () => {
    setCustomerPhoneInput('');
    setCustomerNameInput('');
    setCustomerAddressInput('');
    setResolvedCustomer(null);
    setShowNewCustomerFields(false);
    setIsCustomerPhoneLocked(false);
    setGlobalError(null);
  };

  const handleAddOrderItem = () => {
    if (uniqueServiceGroupOptions.length === 0) {
      addNotification({ message: 'Không có dịch vụ nào được định nghĩa để thêm.', type: 'warning' });
      return;
    }
    const defaultServiceName = uniqueServiceGroupOptions[0].value;
    const servicesWithThisName = appContextServices.filter(s => s.name === defaultServiceName);
    const defaultWashMethodId = servicesWithThisName.length > 0 ? servicesWithThisName[0].washMethodId : (washMethods.find(wm => wm.name === "Giặt ướt")?.id || '');

    setOrderItems(prev => [
      ...prev,
      { 
        id: uuidv4(),
        serviceNameKey: defaultServiceName, 
        selectedWashMethodId: defaultWashMethodId,
        quantity: 1, 
        notes: '' 
      }
    ]);
  };

  const handleOrderItemChange = (index: number, field: keyof LocalOrderItem, value: string | number) => {
    setOrderItems(prevItems => 
      prevItems.map((item, i) => {
        if (i === index) {
          const updatedItem = { ...item, [field]: value };
          if (field === 'serviceNameKey') {
            const newServiceName = value as string;
            const servicesWithThisName = appContextServices.filter(s => s.name === newServiceName);
            updatedItem.selectedWashMethodId = servicesWithThisName.length > 0 ? servicesWithThisName[0].washMethodId : ''; 
          }
          if (field === 'quantity') {
            updatedItem.quantity = Math.max(1, Number(value) || 1);
          }
          return updatedItem;
        }
        return item;
      })
    );
  };

  const handleRemoveOrderItem = (index: number) => {
    setOrderItems(prev => prev.filter((_, i) => i !== index));
  };

  const subtotal = useMemo(() => {
    return orderItems.reduce((sum, localItem) => {
      const service = appContextServices.find(s => s.name === localItem.serviceNameKey && s.washMethodId === localItem.selectedWashMethodId);
      if (service) {
        return sum + Math.max(service.price * localItem.quantity, service.minPrice || 0);
      }
      return sum;
    }, 0);
  }, [orderItems, appContextServices]);

  const promotionDiscount = useMemo(() => {
    if (!appliedPromotion) return 0;
    if (appliedPromotion.minOrderAmount && subtotal < appliedPromotion.minOrderAmount) {
        return 0; // Don't apply if subtotal is too low
    }
    if (appliedPromotion.discountType === 'percentage') {
        let discount = (subtotal * appliedPromotion.discountValue) / 100;
        if (appliedPromotion.maxDiscountAmount && discount > appliedPromotion.maxDiscountAmount) {
            discount = appliedPromotion.maxDiscountAmount;
        }
        return discount;
    }
    if (appliedPromotion.discountType === 'fixed_amount') {
        return Math.min(subtotal, appliedPromotion.discountValue); // Can't discount more than the subtotal
    }
    return 0;
  }, [appliedPromotion, subtotal]);

  const finalTotal = subtotal - promotionDiscount;

  const handleApplyVoucher = () => {
    setPromotionError(null);
    setAppliedPromotion(null);
    if (!voucherCode.trim()) {
        addNotification({message: "Vui lòng nhập mã khuyến mãi.", type: 'warning'});
        return;
    }
    const promotion = findPromotionByCode(voucherCode.trim(), getCurrentUserOwnerId(), 'instore');

    if (!promotion) {
        setPromotionError("Mã khuyến mãi không hợp lệ, đã hết hạn, hoặc không áp dụng cho đơn hàng tại cửa hàng.");
        return;
    }
    if (!promotion.isActive) {
        setPromotionError("Mã khuyến mãi đã hết hiệu lực.");
        return;
    }
    if (promotion.startDate && new Date(promotion.startDate) > new Date()) {
        setPromotionError("Mã khuyến mãi chưa đến ngày áp dụng.");
        return;
    }
    if (promotion.endDate && new Date(promotion.endDate) < new Date()) {
        setPromotionError("Mã khuyến mãi đã hết hạn.");
        return;
    }
    if (promotion.usageLimit && promotion.timesUsed >= promotion.usageLimit) {
        setPromotionError("Mã khuyến mãi đã hết lượt sử dụng.");
        return;
    }
     if (orderItems.length === 0) {
        setPromotionError("Vui lòng thêm dịch vụ vào đơn hàng trước khi áp dụng mã.");
        return;
    }
    if (promotion.applicableServiceIds && promotion.applicableServiceIds.length > 0) {
        const hasApplicableService = orderItems.some(localItem => {
            const service = appContextServices.find(s => s.name === localItem.serviceNameKey && s.washMethodId === localItem.selectedWashMethodId);
            return service && promotion.applicableServiceIds!.includes(service.id);
        });
        if (!hasApplicableService) {
            setPromotionError("Mã khuyến mãi này không áp dụng cho bất kỳ dịch vụ nào trong đơn hàng của bạn.");
            return;
        }
    }
    if (promotion.applicableWashMethodIds && promotion.applicableWashMethodIds.length > 0) {
        const hasApplicableWashMethod = orderItems.some(localItem => 
            promotion.applicableWashMethodIds!.includes(localItem.selectedWashMethodId)
        );
        if (!hasApplicableWashMethod) {
            setPromotionError("Mã khuyến mãi này không áp dụng cho phương pháp giặt nào trong đơn hàng của bạn.");
            return;
        }
    }
    if (promotion.minOrderAmount && subtotal < promotion.minOrderAmount) {
        setPromotionError(`Đơn hàng phải có giá trị tối thiểu ${promotion.minOrderAmount.toLocaleString('vi-VN')} VNĐ để áp dụng mã này.`);
        return;
    }
    if (promotion.usageLimitPerCustomer && resolvedCustomer) {
        const timesUsedByCustomer = (promotion.usedByCustomerIds || []).filter(id => id === resolvedCustomer.id).length;
        if (timesUsedByCustomer >= promotion.usageLimitPerCustomer) {
            setPromotionError(`Mã này đã được bạn sử dụng tối đa ${promotion.usageLimitPerCustomer} lần.`);
            return;
        }
    }
    
    setAppliedPromotion(promotion);
    addNotification({message: `Áp dụng thành công mã "${promotion.name}".`, type: 'success'});
};

  const handleRemoveVoucher = () => {
      setVoucherCode('');
      setAppliedPromotion(null);
      setPromotionError(null);
  };


  const systemCalculatedReturnTime = useMemo(() => {
    if (orderItems.length === 0) return null;

    const maxCustomerReturnTimeHours = Math.max(0, ...orderItems.map(localItem => {
        const service = appContextServices.find(s => s.name === localItem.serviceNameKey && s.washMethodId === localItem.selectedWashMethodId);
        return service ? service.customerReturnTimeHours : 0;
    }));

    if (maxCustomerReturnTimeHours === 0) return null;

    const receivedAtBase = (isEditMode && editingOrder?.receivedAt) ? new Date(editingOrder.receivedAt) : new Date();
    
    return new Date(receivedAtBase.getTime() + maxCustomerReturnTimeHours * 60 * 60 * 1000);
  }, [orderItems, appContextServices, isEditMode, editingOrder]);
  
  const finalDisplayReturnTime = useMemo(() => {
    if (manualEstimatedReturnTime) {
        const d = new Date(manualEstimatedReturnTime);
        return isNaN(d.getTime()) ? null : d;
    }
    return systemCalculatedReturnTime;
  }, [manualEstimatedReturnTime, systemCalculatedReturnTime]);


  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setGlobalError('');

    const isConfirmingOrder = isEditMode && editingOrder?.status === OrderStatus.WAITING_FOR_CONFIRMATION;
    
    if (isEditMode && !editReason.trim()) {
        const reasonPrompt = isConfirmingOrder ? 'Lý do xác nhận (ghi lại thay đổi nếu có) là bắt buộc.' : 'Lý do chỉnh sửa là bắt buộc khi cập nhật đơn hàng.';
        setGlobalError(reasonPrompt);
        return;
    }
    if (!currentUser) {
      setGlobalError('Không thể xác định người dùng hiện tại. Vui lòng đăng nhập lại.');
      return;
    }

    const currentUserStoreOwnerId = getCurrentUserOwnerId();
     if (!isEditMode && !currentUserStoreOwnerId && currentUser.role !== UserRole.CHAIRMAN) {
        setGlobalError('Không thể xác định cửa hàng của bạn để tạo đơn hàng.');
        return;
    }
     if (isEditMode && editingOrder && editingOrder.ownerId !== currentUserStoreOwnerId && currentUser.role !== UserRole.CHAIRMAN) {
        setGlobalError('Bạn không có quyền sửa đơn hàng này vì nó không thuộc cửa hàng của bạn.');
        return;
    }

    let finalCustomer: User | null = null;
    if (isEditMode && editingOrder) {
        finalCustomer = editingOrder.customer;
        if (finalCustomer.name !== customerNameInput || finalCustomer.address !== customerAddressInput) {
           finalCustomer = {...finalCustomer, name: customerNameInput.trim(), address: customerAddressInput.trim() || undefined };
        }
    } else { 
        if (!customerPhoneInput.trim()) { setGlobalError('Vui lòng nhập SĐT khách hàng hoặc tìm kiếm.'); return; }
        if (resolvedCustomer) finalCustomer = resolvedCustomer;
        else if (showNewCustomerFields) {
            if (!customerNameInput.trim()) { setGlobalError('Vui lòng nhập tên khách hàng mới.'); return; }
            // FIX: Create a proper User object for the new customer.
            const newCustomerData: Omit<User, 'id'> = { 
                name: customerNameInput.trim(), 
                phone: customerPhoneInput.trim(), 
                address: customerAddressInput.trim() || undefined, 
                loyaltyPoints: 0, 
                role: UserRole.CUSTOMER,
                username: customerPhoneInput.trim(), // Use phone as username
                password: '123123', // Default password for admin-created customers
            };
            // FIX: The second argument for `addUser` should be `storeProfileData` (an object) or omitted, not a string. For a customer, it should be omitted.
            await addNewGlobalCustomer(newCustomerData); // This function now returns a boolean
            // Find the newly created customer to attach to the order.
            finalCustomer = users.find(u => u.phone === newCustomerData.phone && u.role === UserRole.CUSTOMER) || { ...newCustomerData, id: uuidv4() };

        } else { setGlobalError('Không tìm thấy thông tin khách hàng. Vui lòng tìm hoặc tạo mới.'); return; }
    }
    
    if (!finalCustomer) { setGlobalError('Lỗi xác định thông tin khách hàng.'); return; }
    if (orderItems.length === 0) { setGlobalError('Vui lòng thêm ít nhất một dịch vụ vào đơn hàng.'); return; }
    
    const finalOrderItems: OrderItem[] = [];
    let itemMappingError = false;
    orderItems.forEach(localItem => {
        const service = appContextServices.find(s => s.name === localItem.serviceNameKey && s.washMethodId === localItem.selectedWashMethodId);
        if (!service) {
            const washMethodName = washMethods.find(wm => wm.id === localItem.selectedWashMethodId)?.name || localItem.selectedWashMethodId;
            setGlobalError(`Dịch vụ "${localItem.serviceNameKey}" với phương pháp "${washMethodName}" không hợp lệ hoặc không tìm thấy. Vui lòng kiểm tra lại.`);
            itemMappingError = true;
            return; 
        }
        finalOrderItems.push({
            serviceItem: service,
            selectedWashMethodId: localItem.selectedWashMethodId,
            quantity: localItem.quantity,
            notes: localItem.notes?.trim() || undefined,
        });
    });

    if(itemMappingError) return; 
    
    let finalEstimatedCompletionTime: Date | undefined;
    const systemCalculatedReturnTimeForSubmit = (() => {
        if (finalOrderItems.length === 0) return undefined;
        const maxCustomerReturnTimeHours = Math.max(0, ...finalOrderItems.map(item => item.serviceItem.customerReturnTimeHours));
        if (maxCustomerReturnTimeHours === 0 && !isEditMode) return undefined;
        const receivedAtBase = isEditMode && editingOrder?.receivedAt ? new Date(editingOrder.receivedAt) : new Date();
        return new Date(receivedAtBase.getTime() + maxCustomerReturnTimeHours * 60 * 60 * 1000);
    })();

    if (manualEstimatedReturnTime) {
        const manualTime = new Date(manualEstimatedReturnTime);
        if (isNaN(manualTime.getTime())) {
            setGlobalError('Thời gian hẹn trả bạn nhập không hợp lệ.');
            return;
        }
        if (systemCalculatedReturnTimeForSubmit && manualTime < systemCalculatedReturnTimeForSubmit) {
            setReturnTimeWarningMessage(`Thời gian hẹn trả không được sớm hơn thời gian hệ thống đề xuất: ${systemCalculatedReturnTimeForSubmit.toLocaleString('vi-VN', {dateStyle: 'short', timeStyle: 'short'})}. Vui lòng chọn lại.`);
            setIsReturnTimeWarningModalOpen(true);
            return;
        }
        finalEstimatedCompletionTime = manualTime;
    } else {
        finalEstimatedCompletionTime = systemCalculatedReturnTimeForSubmit;
    }
    
    const totalAmount = finalTotal;

    const now = new Date();

    if (isEditMode && editingOrder) {
        const updatedOrder: Order = {
            ...editingOrder,
            customer: finalCustomer, 
            items: finalOrderItems,
            totalAmount: totalAmount, 
            appliedPromotionId: appliedPromotion?.id,
            promotionDiscountAmount: promotionDiscount > 0 ? promotionDiscount : undefined,
            estimatedCompletionTime: finalEstimatedCompletionTime, 
            notes: orderNotes.trim() || undefined,
            status: isConfirmingOrder ? OrderStatus.PENDING : editingOrder.status,
            scanHistory: [
                ...(editingOrder.scanHistory || []),
                { timestamp: now, action: isConfirmingOrder ? 'Nhân viên đã xác nhận đơn hàng.' : 'Đơn hàng đã được chỉnh sửa.', scannedBy: currentUser.role, staffUserId: currentUser.id, reason: editReason } as ScanHistoryEntry,
            ],
            qrCodePaymentUrl: editingOrder.totalAmount !== totalAmount ? `https://api.vietqr.io/image/ACB-99998888-z5NqV5g.png?amount=${totalAmount}&addInfo=${editingOrder.id.replace(/[^A-Z0-9-]/gi,'_')}&accountName=TIEM%20GIAT%20LA%20ABC` : editingOrder.qrCodePaymentUrl,
        };
        updateOrder(updatedOrder);
        const successMessage = isConfirmingOrder ? `Đã xác nhận đơn hàng ${updatedOrder.id}.` : `Đơn hàng ${updatedOrder.id} đã được cập nhật. Lý do: ${editReason}`;
        addNotification({ message: successMessage, type: 'success' });
        navigate('/admin/orders');

    } else { 
        if (currentUser.role === UserRole.CHAIRMAN) {
             setGlobalError("Chủ tịch không thể tạo đơn hàng trực tiếp từ giao diện này. Chức năng này dành cho nhân viên cửa hàng.");
             return;
        }
        
        const ownerIdForNewOrder = getCurrentUserOwnerId();
        if (!ownerIdForNewOrder) {
            setGlobalError("Không thể xác định cửa hàng của bạn để tạo đơn hàng. Vui lòng liên hệ quản trị viên.");
            return;
        }

        const newOrderId = `DH-${uuidv4().slice(0, 6).toUpperCase()}`;
        // FIX: Add paymentStatus to new order payload
        const newOrderPayload: Order = {
            id: newOrderId,
            customer: finalCustomer,
            items: finalOrderItems, 
            status: OrderStatus.PENDING,
            paymentStatus: PaymentStatus.UNPAID,
            createdAt: now,
            receivedAt: now, 
            estimatedCompletionTime: finalEstimatedCompletionTime,
            totalAmount: totalAmount, 
            appliedPromotionId: appliedPromotion?.id,
            promotionDiscountAmount: promotionDiscount > 0 ? promotionDiscount : undefined,
            notes: orderNotes.trim() || undefined,
            qrCodePaymentUrl: `https://api.vietqr.io/image/ACB-99998888-z5NqV5g.png?amount=${totalAmount}&addInfo=${newOrderId.replace(/[^A-Z0-9-]/gi,'_')}&accountName=TIEM%20GIAT%20LA%20ABC`,
            scanHistory: [{ 
                timestamp: now, action: 'Đơn hàng được tạo bởi nhân viên.', 
                scannedBy: currentUser.role, staffUserId: currentUser.id, staffRoleInAction: 'pickup' 
            }],
            ownerId: ownerIdForNewOrder,
        };
        addOrder(newOrderPayload); 
        addNotification({ message: `Đơn hàng mới ${newOrderId} đã được tạo. Sẵn sàng để in.`, type: 'success' });
        navigate(`/admin/orders/print/${newOrderId}`);
    }
  };
  
  const isConfirmingOrderMode = isEditMode && editingOrder?.status === OrderStatus.WAITING_FOR_CONFIRMATION;
  const pageTitle = isConfirmingOrderMode ? `Xác nhận Đơn hàng: ${editingOrder?.id || ''}` : (isEditMode ? `Chỉnh sửa Đơn hàng: ${editingOrder?.id || ''}` : "Tạo đơn hàng mới");
  const saveButtonText = isConfirmingOrderMode ? "Xác nhận & Chuyển xử lý" : (isEditMode ? "Lưu thay đổi" : "Lưu và In hóa đơn");
  const SaveButtonIcon = isEditMode ? SaveIcon : PrinterIcon;

  const renderServiceItemRow = (item: LocalOrderItem, index: number) => {
    const currentSelectedServiceInfo = appContextServices.find(s => s.name === item.serviceNameKey && s.washMethodId === item.selectedWashMethodId);
    const washMethodOptionsForSelectedName = appContextServices
        .filter(s => s.name === item.serviceNameKey)
        .map(s => {
            const washMethod = washMethods.find(wm => wm.id === s.washMethodId);
            return { value: s.washMethodId, label: `${washMethod?.name || s.washMethodId} (${s.price.toLocaleString('vi-VN')} VNĐ)`};
        })
        .filter((option, idx, self) => self.findIndex(o => o.value === option.value) === idx); // Ensure unique wash methods

    const lineTotal = currentSelectedServiceInfo ? Math.max(currentSelectedServiceInfo.price * item.quantity, currentSelectedServiceInfo.minPrice || 0) : 0;

    return (
        <div key={item.id} className="p-4 border border-border-base dark:border-slate-700 rounded-lg bg-bg-subtle/30 dark:bg-slate-700/20 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-x-4 gap-y-3 items-end">
                <Select
                    wrapperClassName="md:col-span-4"
                    label={`Dịch vụ ${index + 1}`}
                    options={uniqueServiceGroupOptions}
                    value={item.serviceNameKey}
                    onChange={(e) => handleOrderItemChange(index, 'serviceNameKey', e.target.value)}
                    disabled={uniqueServiceGroupOptions.length === 0}
                />
                <Select
                    wrapperClassName="md:col-span-3"
                    label="PP Giặt & Giá"
                    options={washMethodOptionsForSelectedName.length > 0 ? washMethodOptionsForSelectedName : [{value: item.selectedWashMethodId, label: item.selectedWashMethodId}]}
                    value={item.selectedWashMethodId}
                    onChange={(e) => handleOrderItemChange(index, 'selectedWashMethodId', e.target.value)}
                    disabled={washMethodOptionsForSelectedName.length === 0}
                />
                <Input
                    wrapperClassName="md:col-span-1"
                    label="SL*" type="number" min="1"
                    value={item.quantity}
                    onChange={(e) => handleOrderItemChange(index, 'quantity', parseInt(e.target.value, 10))}
                    required
                />
                <div className="md:col-span-2 text-sm text-right self-center">
                    <span className="block text-xs text-text-muted">Đơn giá: {currentSelectedServiceInfo?.price.toLocaleString('vi-VN') || '-'}</span>
                    <span className="font-semibold text-text-heading dark:text-slate-100">TT: {lineTotal.toLocaleString('vi-VN')}</span>
                </div>
                <div className="md:col-span-2 flex justify-end items-end">
                     <Button type="button" variant="danger" size="sm" onClick={() => handleRemoveOrderItem(index)} className="p-2" title="Xóa dịch vụ">
                        <Trash2Icon size={16} />
                    </Button>
                </div>
            </div>
            <Input
                label="Ghi chú cho dịch vụ này"
                value={item.notes || ''}
                onChange={(e) => handleOrderItemChange(index, 'notes', e.target.value)}
                placeholder="VD: Giặt kỹ cổ áo, không tẩy..."
                className="text-sm py-1.5"
            />
             {!currentSelectedServiceInfo && item.serviceNameKey && item.selectedWashMethodId &&
                <p className="text-xs text-status-danger mt-1">
                    Không tìm thấy cấu hình giá cho "{item.serviceNameKey}" với phương pháp "{washMethods.find(wm => wm.id === item.selectedWashMethodId)?.name || item.selectedWashMethodId}". Vui lòng kiểm tra lại.
                </p>
            }
        </div>
    );
  };

  return (
    <>
      <Card title={pageTitle} titleClassName="text-xl">
        <form onSubmit={handleSubmit} className="space-y-8">
          {globalError && 
              <div className="p-3 mb-4 bg-status-danger-bg text-status-danger-text rounded-md text-sm border border-status-danger flex items-center">
                  <AlertTriangleIcon size={18} className="mr-2"/> {globalError}
              </div>
          }
          
          <fieldset className="space-y-4 p-4 border border-border-base dark:border-slate-700 rounded-lg">
            <legend className="text-lg font-semibold text-black dark:text-slate-100 mb-3 px-2 flex items-center -ml-2">
              <Users size={22} className="mr-2 text-brand-primary"/>Thông tin Khách hàng
            </legend>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <Input 
                  label="SĐT Khách hàng*" 
                  name="customerPhone" 
                  value={customerPhoneInput} 
                  onChange={(e) => setCustomerPhoneInput(e.target.value)} 
                  onKeyDown={handlePhoneKeyDown}
                  placeholder="Nhập SĐT để tìm hoặc tạo mới"
                  required
                  disabled={isCustomerPhoneLocked || isEditMode}
                  leftIcon={<PhoneIcon />}
                  wrapperClassName="md:col-span-2"
              />
              {!isEditMode && (
                  isCustomerPhoneLocked ? (
                      <Button type="button" variant="secondary" onClick={handleResetCustomerSearch} leftIcon={<RotateCcwIcon size={16}/>} className="whitespace-nowrap">Tìm SĐT Khác</Button>
                  ) : (
                      <Button type="button" onClick={handleCustomerPhoneSearch} disabled={isSearchingCustomer || !customerPhoneInput.trim()} leftIcon={isSearchingCustomer ? <Spinner size="sm"/> : <SearchIcon size={18}/>} className="whitespace-nowrap">
                        {isSearchingCustomer ? 'Đang tìm...' : 'Tìm/Tạo KH'}
                      </Button>
                  )
              )}
            </div>
            {(resolvedCustomer || showNewCustomerFields) && !isSearchingCustomer && (
              <div className="space-y-3 pt-3 border-t border-border-base dark:border-slate-700/50 mt-3">
                  <Input 
                    label="Tên Khách hàng*" 
                    name="customerName" 
                    value={customerNameInput} 
                    onChange={e => setCustomerNameInput(e.target.value)} 
                    required 
                    disabled={isEditMode && isCustomerPhoneLocked}
                    ref={customerNameInputRef}
                  />
                  <Input label="Địa chỉ" name="customerAddress" value={customerAddressInput} onChange={e => setCustomerAddressInput(e.target.value)} disabled={isEditMode && isCustomerPhoneLocked} />
                  {showNewCustomerFields && !resolvedCustomer && <p className="text-xs text-status-info">Đây là khách hàng mới, thông tin sẽ được lưu lại.</p>}
              </div>
            )}
          </fieldset>

          <fieldset className="space-y-4 p-4 border border-border-base dark:border-slate-700 rounded-lg">
            <legend className="text-lg font-semibold text-black dark:text-slate-100 mb-3 px-2 flex items-center -ml-2">
              <ShoppingCart size={22} className="mr-2 text-brand-primary"/>Chi tiết Dịch vụ ({orderItems.length})
            </legend>
            {orderItems.map(renderServiceItemRow)}
            <Button type="button" variant="secondary" onClick={handleAddOrderItem} leftIcon={<PlusCircleIcon size={18}/>} disabled={uniqueServiceGroupOptions.length === 0}>
              Thêm Dịch vụ
            </Button>
            {uniqueServiceGroupOptions.length === 0 && <p className="text-xs text-text-muted mt-1">Chưa có dịch vụ nào được định nghĩa trong hệ thống.</p>}
          </fieldset>

          <fieldset className="p-4 border border-border-base rounded-lg">
            <legend className="text-lg font-semibold text-text-heading mb-3 px-2 flex items-center -ml-2">
                <TagIcon size={22} className="mr-2 text-brand-primary"/>Khuyến mãi & Thanh toán
            </legend>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <Input 
                    label="Mã khuyến mãi (voucher)"
                    value={voucherCode}
                    onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                    placeholder="Nhập mã..."
                    disabled={!!appliedPromotion}
                    wrapperClassName="md:col-span-2"
                />
                 {appliedPromotion ? (
                    <Button onClick={handleRemoveVoucher} variant="secondary">Hủy mã</Button>
                ) : (
                    <Button onClick={handleApplyVoucher}>Áp dụng</Button>
                )}
            </div>
            {promotionError && <p className="text-xs text-status-danger mt-1">{promotionError}</p>}
            {appliedPromotion && (
                <div className="mt-2 p-2 bg-emerald-50 text-emerald-700 rounded-md text-sm border border-emerald-200">
                    Đang áp dụng: "{appliedPromotion.name}" (Giảm {promotionDiscount.toLocaleString('vi-VN')} VNĐ)
                </div>
            )}
            
            <div className="mt-4 pt-4 border-t border-dashed border-border-base grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                    <p className="flex justify-between"><span>Tạm tính:</span> <span>{subtotal.toLocaleString('vi-VN')} VNĐ</span></p>
                    {promotionDiscount > 0 && 
                        <p className="flex justify-between text-status-success-text"><span>Giảm giá:</span> <span>-{promotionDiscount.toLocaleString('vi-VN')} VNĐ</span></p>
                    }
                </div>
                <div className="flex justify-between items-center sm:border-l sm:border-border-base sm:pl-4">
                    <span className="font-semibold text-lg text-text-heading">Tổng cộng:</span>
                    <span className="font-bold text-2xl text-brand-primary">{finalTotal.toLocaleString('vi-VN')} VNĐ</span>
                </div>
            </div>
          </fieldset>

           <fieldset className="p-4 border border-border-base rounded-lg">
            <legend className="text-lg font-semibold text-text-heading mb-3 px-2 flex items-center -ml-2">
              <Clock size={22} className="mr-2 text-brand-primary"/>Thông tin Bổ sung
            </legend>
            <div className="space-y-3">
              <Input 
                isTextArea 
                rows={2} 
                label="Ghi chú chung cho đơn hàng" 
                value={orderNotes} 
                onChange={(e) => setOrderNotes(e.target.value)} 
                placeholder="VD: Quần áo trắng giặt riêng, cẩn thận đồ mỏng..." 
                leftIcon={<MessageSquareIcon size={16} />}
              />
              <div className="p-2 bg-sky-50 dark:bg-sky-900/30 rounded-md text-sm">
                <div className="flex items-start">
                    <InfoIcon size={16} className="mr-2 mt-0.5 text-sky-600 dark:text-sky-400 flex-shrink-0" />
                    <div>
                        <p className="text-sky-800 dark:text-sky-200">Thời gian trả dự kiến (hệ thống): <strong className="font-semibold">{systemCalculatedReturnTime ? systemCalculatedReturnTime.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : 'Chưa tính'}</strong></p>
                        <p className="text-xs text-sky-700 dark:text-sky-300">Bạn có thể ghi đè bằng cách nhập thời gian hẹn trả thủ công bên dưới.</p>
                    </div>
                </div>
              </div>
              <Input
                label="Hẹn trả thủ công (ghi đè)"
                type="datetime-local"
                value={manualEstimatedReturnTime}
                onChange={e => setManualEstimatedReturnTime(e.target.value)}
                leftIcon={<CalendarIcon size={16} />}
              />
            </div>
          </fieldset>

          {isEditMode && (
              <Input isTextArea rows={2} label={isConfirmingOrderMode ? 'Ghi chú xác nhận*' : 'Lý do chỉnh sửa*'} value={editReason} onChange={(e) => setEditReason(e.target.value)} required leftIcon={<Edit3Icon size={16} />} />
          )}

          <div className="flex justify-end pt-4 border-t border-border-base">
            <Button type="submit" size="lg" leftIcon={<SaveButtonIcon size={20}/>}>
              {saveButtonText}
            </Button>
          </div>
        </form>
      </Card>

       <Modal
          isOpen={isReturnTimeWarningModalOpen}
          onClose={() => setIsReturnTimeWarningModalOpen(false)}
          title="Cảnh báo Thời gian Hẹn trả"
          titleIcon={<AlertTriangleIcon className="text-status-warning" />}
        >
          <p>{returnTimeWarningMessage}</p>
          <div className="mt-4 flex justify-end">
            <Button onClick={() => setIsReturnTimeWarningModalOpen(false)}>Đã hiểu</Button>
          </div>
        </Modal>
    </>
  );
};

// FIX: Changed export to a named export to match the import in App.tsx.
// export default OrderCreatePage;