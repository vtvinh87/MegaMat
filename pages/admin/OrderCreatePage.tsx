import React, { useState, useEffect, useCallback, FormEvent, ChangeEvent, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppContext } from '../../contexts/AppContext';
import { Customer, Order, OrderItem, OrderStatus, ServiceItem as AppServiceItem, UserRole, ScanHistoryEntry, WashMethod } from '../../types'; // Renamed ServiceItem
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { v4 as uuidv4 } from 'uuid';
import { PlusCircleIcon, Trash2Icon, SaveIcon, XCircleIcon, Users, ShoppingCart, DollarSign, Clock, Edit3Icon, MessageSquareIcon, PrinterIcon, SearchIcon, PhoneIcon, UserPlusIcon, RotateCcwIcon, AlertTriangleIcon } from 'lucide-react';
import { Spinner } from '../../components/ui/Spinner';


interface LocalOrderItem {
  id: string; 
  serviceNameKey: string; 
  selectedWashMethod: WashMethod;
  quantity: number;
  notes?: string;
}

const OrderCreatePage: React.FC = () => {
  const { id: editOrderId } = useParams<{ id?: string }>(); 
  const { 
    customers, 
    services: appContextServices,
    addOrder, 
    updateOrder, 
    findOrder, 
    addCustomer: addNewGlobalCustomer, 
    currentUser, 
    addNotification,
    getCurrentUserOwnerId,
  } = useAppContext();
  const navigate = useNavigate();

  const [isEditMode, setIsEditMode] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  const [customerPhoneInput, setCustomerPhoneInput] = useState('');
  const [customerNameInput, setCustomerNameInput] = useState('');
  const [customerAddressInput, setCustomerAddressInput] = useState('');
  const [resolvedCustomer, setResolvedCustomer] = useState<Customer | null>(null);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [showNewCustomerFields, setShowNewCustomerFields] = useState(false);
  const [isCustomerPhoneLocked, setIsCustomerPhoneLocked] = useState(false);
  
  const [orderItems, setOrderItems] = useState<LocalOrderItem[]>([]);
  const [editReason, setEditReason] = useState<string>(''); 
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [orderNotes, setOrderNotes] = useState('');


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
        if (orderToEdit.status !== OrderStatus.PENDING && orderToEdit.status !== OrderStatus.CANCELLED) {
            addNotification({message: `Chỉ có thể sửa đơn hàng ở trạng thái "Chưa xử lý" hoặc "Đã hủy". Đơn hàng ${editOrderId} đang ở trạng thái "${orderToEdit.status}".`, type: 'error'});
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

        setOrderItems(orderToEdit.items.map(item => ({ 
          id: uuidv4(),
          serviceNameKey: item.serviceItem.name, 
          selectedWashMethod: item.selectedWashMethod, 
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
    }
  }, [editOrderId, findOrder, navigate, addNotification, currentUser, getCurrentUserOwnerId]);

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
    const foundCustomer = customers.find(c => c.phone === customerPhoneInput.trim());
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
    const defaultWashMethod = servicesWithThisName.length > 0 ? servicesWithThisName[0].washMethod : WashMethod.WET_WASH;

    setOrderItems(prev => [
      ...prev,
      { 
        id: uuidv4(),
        serviceNameKey: defaultServiceName, 
        selectedWashMethod: defaultWashMethod,
        quantity: 1, 
        notes: '' 
      }
    ]);
  };

  const handleOrderItemChange = (index: number, field: keyof LocalOrderItem, value: string | number | WashMethod) => {
    setOrderItems(prevItems => 
      prevItems.map((item, i) => {
        if (i === index) {
          const updatedItem = { ...item, [field]: value };
          if (field === 'serviceNameKey') {
            const newServiceName = value as string;
            const servicesWithThisName = appContextServices.filter(s => s.name === newServiceName);
            updatedItem.selectedWashMethod = servicesWithThisName.length > 0 ? servicesWithThisName[0].washMethod : WashMethod.WET_WASH; // Default to first available or WET_WASH
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

  const calculateTotal = useCallback(() => {
    return orderItems.reduce((sum, localItem) => {
      const service = appContextServices.find(s => s.name === localItem.serviceNameKey && s.washMethod === localItem.selectedWashMethod);
      if (service) {
        return sum + Math.max(service.price * localItem.quantity, service.minPrice || 0);
      }
      return sum;
    }, 0);
  }, [orderItems, appContextServices]);

  const calculateEstimatedCompletionTime = useCallback(() => {
    if (orderItems.length === 0) return undefined;
    const maxProcessingTimeHours = Math.max(0, ...orderItems.map(localItem => {
      const service = appContextServices.find(s => s.name === localItem.serviceNameKey && s.washMethod === localItem.selectedWashMethod);
      return service ? service.estimatedTimeHours : 0;
    }));
    const receivedAt = isEditMode && editingOrder?.receivedAt ? new Date(editingOrder.receivedAt) : new Date();
    return new Date(receivedAt.getTime() + maxProcessingTimeHours * 60 * 60 * 1000);
  }, [orderItems, appContextServices, isEditMode, editingOrder]);


  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setGlobalError('');

    if (isEditMode && !editReason.trim()) {
        setGlobalError('Lý do chỉnh sửa là bắt buộc khi cập nhật đơn hàng.');
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

    let finalCustomer: Customer | null = null;
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
            finalCustomer = { id: uuidv4(), name: customerNameInput.trim(), phone: customerPhoneInput.trim(), address: customerAddressInput.trim() || undefined };
            addNewGlobalCustomer(finalCustomer);
        } else { setGlobalError('Không tìm thấy thông tin khách hàng. Vui lòng tìm hoặc tạo mới.'); return; }
    }
    
    if (!finalCustomer) { setGlobalError('Lỗi xác định thông tin khách hàng.'); return; }
    if (orderItems.length === 0) { setGlobalError('Vui lòng thêm ít nhất một dịch vụ vào đơn hàng.'); return; }
    
    const finalOrderItems: OrderItem[] = [];
    let itemMappingError = false;
    orderItems.forEach(localItem => {
        const service = appContextServices.find(s => s.name === localItem.serviceNameKey && s.washMethod === localItem.selectedWashMethod);
        if (!service) {
            setGlobalError(`Dịch vụ "${localItem.serviceNameKey}" với phương pháp "${localItem.selectedWashMethod}" không hợp lệ hoặc không tìm thấy. Vui lòng kiểm tra lại.`);
            itemMappingError = true;
            return; 
        }
        finalOrderItems.push({
            serviceItem: service,
            selectedWashMethod: localItem.selectedWashMethod,
            quantity: localItem.quantity,
            notes: localItem.notes?.trim() || undefined,
        });
    });

    if(itemMappingError) return; 
    
    const totalAmount = finalOrderItems.reduce((sum, item) => {
        return sum + Math.max(item.serviceItem.price * item.quantity, item.serviceItem.minPrice || 0);
    }, 0);

    const estimatedCompletionTime = (() => {
        if (finalOrderItems.length === 0) return undefined;
        const maxProcessingTimeHours = Math.max(0, ...finalOrderItems.map(item => item.serviceItem.estimatedTimeHours));
        const receivedAtBase = isEditMode && editingOrder?.receivedAt ? new Date(editingOrder.receivedAt) : new Date();
        return new Date(receivedAtBase.getTime() + maxProcessingTimeHours * 60 * 60 * 1000);
    })();

    const now = new Date();

    if (isEditMode && editingOrder) {
        const updatedOrder: Order = {
            ...editingOrder,
            customer: finalCustomer, 
            items: finalOrderItems,
            totalAmount: totalAmount, 
            estimatedCompletionTime: estimatedCompletionTime, 
            notes: orderNotes.trim() || undefined,
            scanHistory: [
                ...(editingOrder.scanHistory || []),
                { timestamp: now, action: 'Đơn hàng đã được chỉnh sửa.', scannedBy: currentUser.role, staffUserId: currentUser.id, reason: editReason } as ScanHistoryEntry,
            ],
            qrCodePaymentUrl: editingOrder.totalAmount !== totalAmount ? `https://api.vietqr.io/image/ACB-99998888-z5NqV5g.png?amount=${totalAmount}&addInfo=${editingOrder.id.replace(/[^A-Z0-9-]/gi,'_')}&accountName=TIEM%20GIAT%20LA%20ABC` : editingOrder.qrCodePaymentUrl,
        };
        updateOrder(updatedOrder);
        addNotification({ message: `Đơn hàng ${updatedOrder.id} đã được cập nhật. Lý do: ${editReason}`, type: 'success' });
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
        const newOrderPayload: Order = {
            id: newOrderId,
            customer: finalCustomer,
            items: finalOrderItems, 
            status: OrderStatus.PENDING,
            createdAt: now,
            receivedAt: now, 
            estimatedCompletionTime: estimatedCompletionTime,
            totalAmount: totalAmount, 
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
  
  const pageTitle = isEditMode ? `Chỉnh sửa Đơn hàng: ${editingOrder?.id || ''}` : "Tạo đơn hàng mới";
  const saveButtonText = isEditMode ? "Lưu thay đổi" : "Lưu và In hóa đơn";
  const SaveButtonIcon = isEditMode ? SaveIcon : PrinterIcon;

  const renderServiceItemRow = (item: LocalOrderItem, index: number) => {
    const currentSelectedServiceInfo = appContextServices.find(s => s.name === item.serviceNameKey && s.washMethod === item.selectedWashMethod);
    const washMethodOptionsForSelectedName = appContextServices
        .filter(s => s.name === item.serviceNameKey)
        .map(s => ({ value: s.washMethod, label: `${s.washMethod} (${s.price.toLocaleString('vi-VN')} VNĐ)`}))
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
                    options={washMethodOptionsForSelectedName.length > 0 ? washMethodOptionsForSelectedName : [{value: item.selectedWashMethod, label: item.selectedWashMethod}]}
                    value={item.selectedWashMethod}
                    onChange={(e) => handleOrderItemChange(index, 'selectedWashMethod', e.target.value as WashMethod)}
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
             {!currentSelectedServiceInfo && item.serviceNameKey && item.selectedWashMethod &&
                <p className="text-xs text-status-danger mt-1">
                    Không tìm thấy cấu hình giá cho "{item.serviceNameKey}" với phương pháp "{item.selectedWashMethod}". Vui lòng kiểm tra lại.
                </p>
            }
        </div>
    );
  };

  return (
    <Card title={pageTitle} titleClassName="text-xl">
      <form onSubmit={handleSubmit} className="space-y-8">
        {globalError && 
            <div className="p-3 mb-4 bg-status-danger-bg text-status-danger-text rounded-md text-sm border border-status-danger flex items-center">
                <AlertTriangleIcon size={18} className="mr-2"/> {globalError}
            </div>
        }
        
        <fieldset className="space-y-4 p-4 border border-border-base dark:border-slate-700 rounded-lg">
          <legend className="text-lg font-semibold text-text-heading dark:text-slate-100 mb-3 px-2 flex items-center -ml-2">
            <Users size={22} className="mr-2 text-brand-primary"/>Thông tin Khách hàng
          </legend>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <Input 
                label="SĐT Khách hàng*" 
                name="customerPhone" 
                value={customerPhoneInput} 
                onChange={(e) => setCustomerPhoneInput(e.target.value)} 
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
                <Input label="Tên Khách hàng*" name="customerName" value={customerNameInput} onChange={e => setCustomerNameInput(e.target.value)} required disabled={isEditMode && isCustomerPhoneLocked}/>
                <Input label="Địa chỉ" name="customerAddress" value={customerAddressInput} onChange={e => setCustomerAddressInput(e.target.value)} disabled={isEditMode && isCustomerPhoneLocked} />
                {showNewCustomerFields && !resolvedCustomer && <p className="text-xs text-status-info">Đây là khách hàng mới, thông tin sẽ được lưu lại.</p>}
            </div>
          )}
        </fieldset>

        <fieldset className="space-y-4 p-4 border border-border-base dark:border-slate-700 rounded-lg">
           <legend className="text-lg font-semibold text-text-heading dark:text-slate-100 mb-3 px-2 flex items-center -ml-2">
            <ShoppingCart size={22} className="mr-2 text-brand-primary"/>Chi tiết Dịch vụ ({orderItems.length})
          </legend>
          {orderItems.map(renderServiceItemRow)}
          <Button type="button" variant="secondary" onClick={handleAddOrderItem} leftIcon={<PlusCircleIcon size={18}/>} disabled={uniqueServiceGroupOptions.length === 0}>
            Thêm Dịch vụ
          </Button>
          {uniqueServiceGroupOptions.length === 0 && <p className="text-xs text-text-muted mt-1">Chưa có dịch vụ nào được định nghĩa trong hệ thống.</p>}
        </fieldset>
        
        <Input 
            label="Ghi chú chung cho đơn hàng (nếu có)" 
            value={orderNotes} 
            onChange={e => setOrderNotes(e.target.value)} 
            placeholder="VD: Yêu cầu giao hàng sớm, không dùng hóa chất X..." 
            isTextArea 
            rows={2}
            leftIcon={<MessageSquareIcon />}
        />


        {isEditMode && (
            <fieldset className="p-4 border border-border-base dark:border-slate-700 rounded-lg">
                 <legend className="text-lg font-semibold text-text-heading dark:text-slate-100 mb-3 px-2 flex items-center -ml-2">
                    <Edit3Icon size={20} className="mr-2 text-brand-primary"/>Lý do Chỉnh sửa
                </legend>
                <Input label="Lý do chỉnh sửa đơn hàng*" name="editReason" value={editReason} onChange={(e) => setEditReason(e.target.value)} required isTextArea />
            </fieldset>
        )}
        
        <div className="p-4 border border-border-base dark:border-slate-700 rounded-lg bg-sky-50 dark:bg-sky-800/20">
            <div className="flex justify-between items-center">
                <span className="text-lg font-semibold text-text-heading dark:text-sky-100 flex items-center"><DollarSign size={22} className="mr-2 text-brand-primary"/>Tổng tiền:</span>
                <span className="text-2xl font-bold text-brand-primary dark:text-sky-300">{calculateTotal().toLocaleString('vi-VN')} VNĐ</span>
            </div>
            <div className="flex justify-between items-center mt-1">
                <span className="text-sm text-text-muted dark:text-sky-300 flex items-center"><Clock size={16} className="mr-2"/>Dự kiến hoàn thành:</span>
                <span className="text-sm font-medium text-text-body dark:text-sky-200">{calculateEstimatedCompletionTime()?.toLocaleString('vi-VN', {dateStyle: 'short', timeStyle: 'short'}) || 'N/A'}</span>
            </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 pt-4 border-t border-border-base dark:border-slate-700">
          <Button type="button" variant="secondary" onClick={() => navigate(isEditMode && editingOrder ? `/admin/orders/${editingOrder.id}` : '/admin/orders')} leftIcon={<XCircleIcon size={18}/>}>
            Hủy bỏ
          </Button>
          <Button 
            type="submit" 
            variant="primary" 
            leftIcon={<SaveButtonIcon size={18}/>} 
            size="md" 
            disabled={
                isSearchingCustomer || 
                (orderItems.length > 0 && orderItems.some(item => !appContextServices.find(s => s.name === item.serviceNameKey && s.washMethod === item.selectedWashMethod))) ||
                (!resolvedCustomer && !showNewCustomerFields && !isEditMode) ||
                (showNewCustomerFields && !customerNameInput.trim() && !isEditMode) ||
                orderItems.length === 0
            }
          >
            {saveButtonText}
          </Button>
        </div>
      </form>
    </Card>
  );
};

export default OrderCreatePage;