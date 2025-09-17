

import React, { useState, useMemo, ChangeEvent, useEffect, KeyboardEvent, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
// FIX: Replaced useAppContext with useData and useAuth
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { Order, OrderStatus, UserRole, ScanHistoryEntry, PaymentStatus } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { PickupLocationModal } from '../../components/admin/PickupLocationModal'; // New Modal
import { PlusCircleIcon, EyeIcon, FilterIcon, SearchIcon, Package, User, CalendarDays, CreditCard, Tag, Settings, PackageCheck, EditIcon, Trash2Icon, HistoryIcon, CameraIcon, ZapIcon, CheckCircleIcon, XCircleIcon, InfoIcon, XIcon, AlertTriangleIcon } from 'lucide-react'; // Added CheckCircleIcon, XCircleIcon, InfoIcon, XIcon, AlertTriangleIcon
import { UrgentOrderWarningModal } from '../../components/admin/UrgentOrderWarningModal';

// Helper function to map English query param to Vietnamese OrderStatus
const mapQueryParamToOrderStatus = (paramValue: string | null): OrderStatus | '' => {
  if (!paramValue) return '';
  switch (paramValue.toUpperCase()) {
    case 'PENDING': return OrderStatus.PENDING;
    case 'PROCESSING': return OrderStatus.PROCESSING;
    case 'COMPLETED': return OrderStatus.COMPLETED;
    case 'RETURNED': return OrderStatus.RETURNED;
    case 'WAITING_FOR_CONFIRMATION': return OrderStatus.WAITING_FOR_CONFIRMATION;
    default:
      if (Object.values(OrderStatus).includes(paramValue as OrderStatus)) {
        return paramValue as OrderStatus;
      }
      return ''; 
  }
};

// Simple Reason Modal Component (remains the same)
interface ReasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  title: string;
  orderId?: string;
}

const ReasonModal: React.FC<ReasonModalProps> = ({ isOpen, onClose, onConfirm, title, orderId }) => {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (isOpen) {
      setReason('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!reason.trim()) {
      alert('Lý do không được để trống.');
      return;
    }
    onConfirm(reason);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 transition-opacity duration-300 animate-fadeIn">
      <Card title={title} className="w-full max-w-md bg-bg-surface shadow-xl !border-border-base">
        {orderId && <p className="text-sm text-text-muted mb-2">Đơn hàng: {orderId}</p>}
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Nhập lý do..."
          rows={4}
          className="w-full p-2 border border-border-input rounded-md bg-bg-input focus:ring-brand-primary-focus focus:border-brand-primary-focus"
          aria-label="Lý do"
        />
        <div className="mt-4 flex justify-end space-x-3">
          <Button variant="secondary" onClick={onClose}>Hủy</Button>
          <Button variant="primary" onClick={handleConfirm}>Xác nhận</Button>
        </div>
      </Card>
    </div>
  );
};


const OrderListPage: React.FC = () => {
  // FIX: Replaced useAppContext with useData and useAuth
  const { orders, deleteOrder, addNotification, updateOrder, findOrder, getCurrentUserOwnerId, findStoreProfileByOwnerId } = useData();
  const { currentUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | ''>(() => {
    const statusFromQuery = queryParams.get('status');
    return mapQueryParamToOrderStatus(statusFromQuery);
  });

  const [isReasonModalOpen, setIsReasonModalOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [reasonModalTitle, setReasonModalTitle] = useState('Xác nhận xóa đơn hàng'); // New state for modal title

  // State for QR Scanning
  const [qrScanInput, setQrScanInput] = useState('');
  const [isProcessingScan, setIsProcessingScan] = useState(false);
  const [orderForLocationSelection, setOrderForLocationSelection] = useState<Order | null>(null);
  const [isPickupLocationModalOpen, setIsPickupLocationModalOpen] = useState(false);
  const qrScanInputRef = React.useRef<HTMLInputElement>(null);

  // State for new order creation feedback
  const newOrderInfo = useMemo(() => {
    return location.state?.newOrderId ? { id: location.state.newOrderId, customerName: location.state.customerName } : null;
  }, [location.state]);
  const [creationSuccessMessage, setCreationSuccessMessage] = useState<string | null>(null);

  // State for urgent orders warning modal
  const [urgentOrdersQueue, setUrgentOrdersQueue] = useState<Order[]>([]);
  const [currentUrgentOrder, setCurrentUrgentOrder] = useState<Order | null>(null);

  // Get store settings
  const currentUserStoreProfile = useMemo(() => {
    const ownerId = getCurrentUserOwnerId();
    if (!ownerId) return null;
    return findStoreProfileByOwnerId(ownerId);
  }, [getCurrentUserOwnerId, findStoreProfileByOwnerId]);

  const pickupLocations = useMemo(() => currentUserStoreProfile?.pickupLocations || [], [currentUserStoreProfile]);
  const defaultProcessingTimeHours = useMemo(() => currentUserStoreProfile?.defaultProcessingTimeHours || 5, [currentUserStoreProfile]);


  useEffect(() => {
    if (newOrderInfo) {
      setCreationSuccessMessage(`Đã tạo thành công đơn hàng ${newOrderInfo.id} cho khách hàng ${newOrderInfo.customerName}.`);
      navigate(location.pathname, { replace: true, state: {} }); // Clear state
      const timer = setTimeout(() => setCreationSuccessMessage(null), 7000); // Auto-hide
      return () => clearTimeout(timer);
    }
  }, [newOrderInfo, navigate, location.pathname]);


  useEffect(() => {
    const statusFromQuery = queryParams.get('status');
    setStatusFilter(mapQueryParamToOrderStatus(statusFromQuery));
  }, [queryParams]);

  // Effect to check for urgent orders
  useEffect(() => {
    const checkUrgentOrders = () => {
        if (!orders) return;
        const now = new Date().getTime();
        
        const urgent = orders.filter(o => {
            if (o.status !== OrderStatus.PENDING || !o.receivedAt || !o.items || o.items.length === 0) {
                return false;
            }
            // Don't re-warn if a reason has already been given for the delay.
            const hasBeenPostponed = o.scanHistory?.some(h => h.action?.includes('Trì hoãn xử lý'));
            if (hasBeenPostponed) {
                return false;
            }
            
            try {
                const bufferTimes = o.items.map(item => {
                    if (item?.serviceItem?.customerReturnTimeHours == null || item?.serviceItem?.estimatedTimeHours == null) {
                        return Infinity; // Ignore items with incomplete data
                    }
                    return item.serviceItem.customerReturnTimeHours - item.serviceItem.estimatedTimeHours;
                }).filter(buffer => isFinite(buffer));
                
                if (bufferTimes.length === 0) return false;
                
                const smallestBufferHours = Math.min(...bufferTimes);

                const receivedAtTime = new Date(o.receivedAt).getTime();
                const hoursSinceReceived = (now - receivedAtTime) / (1000 * 60 * 60);
                
                return hoursSinceReceived > smallestBufferHours;
            } catch (error) {
                console.error("Error calculating urgency for order:", o.id, error);
                return false;
            }
        });
        
        // Add new urgent orders to the queue, avoiding duplicates
        setUrgentOrdersQueue(currentQueue => {
            const queueIds = new Set(currentQueue.map(q => q.id));
            const newUrgentOrders = urgent.filter(u => !queueIds.has(u.id));
            if (newUrgentOrders.length > 0) {
                return [...currentQueue, ...newUrgentOrders];
            }
            return currentQueue;
        });
    };

    const interval = setInterval(checkUrgentOrders, 30 * 1000); // Check every 30 seconds
    checkUrgentOrders(); // Initial check

    return () => clearInterval(interval);
  }, [orders]);

  // Effect to display the modal from the queue
  useEffect(() => {
      if (urgentOrdersQueue.length > 0 && !currentUrgentOrder) {
          setCurrentUrgentOrder(urgentOrdersQueue[0]);
      }
  }, [urgentOrdersQueue, currentUrgentOrder]);

  const ordersToConfirm = useMemo(() => {
    return orders.filter(order => order.status === OrderStatus.WAITING_FOR_CONFIRMATION)
                 .sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [orders]);


  const filteredOrders = useMemo(() => {
    return orders
      .filter(order => order.status !== OrderStatus.DELETED_BY_ADMIN)
      .filter(order => statusFilter ? order.status === statusFilter : true)
      .filter(order => 
        order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customer.phone.includes(searchTerm)
      )
      .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, searchTerm, statusFilter]);

  const getStatusClassAndText = (status: OrderStatus): {className: string, text: string} => {
    switch (status) {
      case OrderStatus.WAITING_FOR_CONFIRMATION: return {className: 'bg-purple-100 text-purple-800 animate-pulse', text: OrderStatus.WAITING_FOR_CONFIRMATION};
      case OrderStatus.PENDING: return {className: 'bg-status-warning-bg text-status-warning-text', text: OrderStatus.PENDING};
      case OrderStatus.PROCESSING: return {className: 'bg-status-info-bg text-status-info-text', text: OrderStatus.PROCESSING};
      case OrderStatus.COMPLETED: return {className: 'bg-status-success-bg text-status-success-text', text: OrderStatus.COMPLETED};
      case OrderStatus.CANCELLED: return {className: 'bg-status-danger-bg text-status-danger-text', text: OrderStatus.CANCELLED};
      case OrderStatus.RETURNED: return {className: 'bg-brand-primary/10 text-brand-primary', text: OrderStatus.RETURNED};
      default: return {className: 'bg-bg-subtle text-text-muted', text: status};
    }
  };
  
  const handleQrScanEnter = async (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && qrScanInput.trim() && !isProcessingScan) {
      event.preventDefault();
      const scannedData = qrScanInput.trim();
      setQrScanInput(''); 
      setIsProcessingScan(true);

      const parts = scannedData.split(',');
      const orderIdPart = parts.find(p => p.startsWith('ORDER_ID:'));
      if (!orderIdPart) {
        addNotification({ message: "Mã QR không hợp lệ: Thiếu thông tin ORDER_ID.", type: "error", showToast: true });
        setIsProcessingScan(false);
        return;
      }
      const orderIdToUpdate = orderIdPart.split(':')[1];

      const orderToUpdate = findOrder(orderIdToUpdate);
      if (!orderToUpdate) {
        addNotification({ message: `Không tìm thấy đơn hàng với ID: ${orderIdToUpdate}.`, type: "error", showToast: true });
        setIsProcessingScan(false);
        return;
      }

      if (!currentUser) {
        addNotification({ message: "Không thể xác định người dùng. Vui lòng đăng nhập lại.", type: "error", showToast: true });
        setIsProcessingScan(false);
        return;
      }
      
      let newStatus: OrderStatus | null = null;
      let scanActionText = "";
      let notificationMessage = "";
      let openPickupModal = false;

      switch (orderToUpdate.status) {
        case OrderStatus.WAITING_FOR_CONFIRMATION:
          addNotification({ message: `Đơn hàng ${orderToUpdate.id} cần được xác nhận thủ công trước khi xử lý.`, type: "warning", showToast: true });
          setIsProcessingScan(false);
          navigate(`/admin/orders/edit/${orderToUpdate.id}`);
          return;
        case OrderStatus.PENDING:
          newStatus = OrderStatus.PROCESSING;
          scanActionText = "Quét QR: Chuyển sang Đang xử lý.";
          notificationMessage = `Thành công! Đơn hàng ${orderToUpdate.id} đang được xử lý.`;
          break;
        case OrderStatus.PROCESSING:
          newStatus = OrderStatus.COMPLETED; // Temp status, real update after location
          scanActionText = "Quét QR: Chuyển sang Đã xử lý (chờ chọn vị trí).";
          openPickupModal = true;
          setOrderForLocationSelection(orderToUpdate);
          addNotification({ message: `Đơn hàng ${orderToUpdate.id} đã xử lý xong. Vui lòng chọn vị trí.`, type: "info", showToast: true });
          break;
        case OrderStatus.COMPLETED:
          if (orderToUpdate.paymentStatus === PaymentStatus.UNPAID) {
            addNotification({ message: `Lỗi: Đơn hàng ${orderToUpdate.id} chưa được thanh toán. Không thể trả đồ.`, type: "error", showToast: true });
            setIsProcessingScan(false);
            return;
          }
          newStatus = OrderStatus.RETURNED;
          scanActionText = "Quét QR: Chuyển sang Đã trả.";
          notificationMessage = `Thành công! Đơn hàng ${orderToUpdate.id} đã được trả cho khách.`;
          break;
        case OrderStatus.RETURNED:
          addNotification({ message: `Đơn hàng ${orderToUpdate.id} đã được trả. Không có hành động thêm.`, type: "info", showToast: true });
          setIsProcessingScan(false);
          return;
        case OrderStatus.CANCELLED:
        case OrderStatus.DELETED_BY_ADMIN:
          addNotification({ message: `Đơn hàng ${orderToUpdate.id} đã hủy/xóa. Không thể cập nhật qua QR.`, type: "warning", showToast: true });
          setIsProcessingScan(false);
          return;
        default:
          addNotification({ message: `Trạng thái đơn hàng không xác định: ${orderToUpdate.status}.`, type: "error", showToast: true });
          setIsProcessingScan(false);
          return;
      }

      if (openPickupModal) {
        setIsPickupLocationModalOpen(true);
        setIsProcessingScan(false);
        return; 
      }

      if (newStatus) {
        const updatedScanHistory: ScanHistoryEntry[] = [
          ...(orderToUpdate.scanHistory || []),
          {
            timestamp: new Date(),
            action: scanActionText,
            staffUserId: currentUser.id,
            scannedBy: currentUser.role,
          }
        ];
        
        let updatedOrderObject: Order = { ...orderToUpdate, status: newStatus, scanHistory: updatedScanHistory };

        if (orderToUpdate.status === OrderStatus.PENDING && newStatus === OrderStatus.PROCESSING) {
            const receivedAt = updatedOrderObject.receivedAt || new Date();
            if (!updatedOrderObject.receivedAt) updatedOrderObject.receivedAt = receivedAt;
            const itemsMaxHours = Math.max(0, ...updatedOrderObject.items.map(item => item.serviceItem.customerReturnTimeHours));
            updatedOrderObject.estimatedCompletionTime = new Date(receivedAt.getTime() + (itemsMaxHours || defaultProcessingTimeHours) * 60 * 60 * 1000);
        }
        if (newStatus === OrderStatus.RETURNED && !updatedOrderObject.completedAt) {
            updatedOrderObject.completedAt = new Date(); 
        }

        updateOrder(updatedOrderObject);
        addNotification({ message: notificationMessage, type: "success", showToast: true });
      }
      setIsProcessingScan(false);
    }
  };

  const handlePickupLocationConfirm = (selectedLocation: string) => {
    if (!orderForLocationSelection || !currentUser) return;

    const scanActionText = `Quét QR & Chọn vị trí: Hoàn thành xử lý. Vị trí: ${selectedLocation}.`;
    const notificationMessage = `Đã lưu vị trí "${selectedLocation}" cho đơn hàng ${orderForLocationSelection.id}.`;

    const updatedScanHistory: ScanHistoryEntry[] = [
        ...(orderForLocationSelection.scanHistory || []),
        {
            timestamp: new Date(),
            action: scanActionText,
            staffUserId: currentUser.id,
            scannedBy: currentUser.role,
        }
    ];
    const updatedOrder: Order = {
        ...orderForLocationSelection,
        status: OrderStatus.COMPLETED,
        pickupLocation: selectedLocation,
        completedAt: new Date(),
        scanHistory: updatedScanHistory
    };
    updateOrder(updatedOrder);
    addNotification({ message: notificationMessage, type: "success", showToast: true });
    setOrderForLocationSelection(null);
    setIsPickupLocationModalOpen(false);
  };

  const handleProcessUrgentOrder = () => {
    if (!currentUrgentOrder || !currentUser) return;
    
    const orderToProcess = currentUrgentOrder;

    const updatedScanHistory: ScanHistoryEntry[] = [
      ...(orderToProcess.scanHistory || []),
      {
        timestamp: new Date(),
        action: 'Bắt đầu xử lý (từ cảnh báo sắp quá hạn)',
        staffUserId: currentUser.id,
        scannedBy: currentUser.role,
        staffRoleInAction: 'processing',
      }
    ];

    const receivedAt = orderToProcess.receivedAt || new Date();
    const itemsMaxHours = Math.max(0, ...orderToProcess.items.map(item => item.serviceItem.customerReturnTimeHours));
    const estimatedCompletionTime = new Date(receivedAt.getTime() + (itemsMaxHours || defaultProcessingTimeHours) * 60 * 60 * 1000);

    const updatedOrder: Order = {
      ...orderToProcess,
      status: OrderStatus.PROCESSING,
      scanHistory: updatedScanHistory,
      estimatedCompletionTime: estimatedCompletionTime,
    };
    
    updateOrder(updatedOrder);
    addNotification({ message: `Đơn hàng ${orderToProcess.id} đã bắt đầu được xử lý.`, type: 'success', showToast: true });

    // Close modal and remove from queue
    setCurrentUrgentOrder(null);
    setUrgentOrdersQueue(prev => prev.filter(o => o.id !== orderToProcess.id));
  };

  const handlePostponeUrgentOrder = (reason: string) => {
      if (!currentUrgentOrder || !currentUser) return;
      
      const orderToPostpone = currentUrgentOrder;

      const updatedScanHistory: ScanHistoryEntry[] = [
        ...(orderToPostpone.scanHistory || []),
        {
          timestamp: new Date(),
          action: 'Trì hoãn xử lý (ghi chú từ cảnh báo)',
          staffUserId: currentUser.id,
          scannedBy: currentUser.role,
          reason: reason,
        }
      ];

      const updatedOrder: Order = {
        ...orderToPostpone,
        scanHistory: updatedScanHistory,
      };

      updateOrder(updatedOrder);
      addNotification({ message: `Đã ghi chú lý do chưa xử lý cho đơn hàng ${orderToPostpone.id}.`, type: 'info', showToast: true });

      // Close modal and remove from queue
      setCurrentUrgentOrder(null);
      setUrgentOrdersQueue(prev => prev.filter(o => o.id !== orderToPostpone.id));
  };


  const tableHeaders = [
    { label: "Mã ĐH", icon: <Package size={14} /> },
    { label: "Khách hàng", icon: <User size={14} /> },
    { label: "Ngày tạo", icon: <CalendarDays size={14} /> },
    { label: "Tổng tiền", icon: <CreditCard size={14} /> },
    { label: "Trạng thái", icon: <Tag size={14} /> },
    { label: "Hành động", icon: <Settings size={14} /> }
  ];

  const statusOptions = [
    { value: '', label: 'Tất cả Hóa đơn' },
    { value: OrderStatus.WAITING_FOR_CONFIRMATION, label: `❗ ${OrderStatus.WAITING_FOR_CONFIRMATION}` },
    ...Object.values(OrderStatus)
        .filter(s => s !== OrderStatus.DELETED_BY_ADMIN && s !== OrderStatus.CANCELLED && s !== OrderStatus.WAITING_FOR_CONFIRMATION)
        .map(s => ({ value: s, label: s}))
  ];

  const handleOpenDeleteModal = (order: Order, title: string = 'Xác nhận xóa đơn hàng') => {
    setOrderToDelete(order);
    setReasonModalTitle(title);
    setIsReasonModalOpen(true);
  };

  const handleConfirmDelete = (reason: string) => {
    if (orderToDelete && currentUser?.role) {
      deleteOrder(orderToDelete.id, reason, currentUser.role);
    }
    setIsReasonModalOpen(false);
    setOrderToDelete(null);
  };

  const userCanPerformEdit = currentUser && (currentUser.role === UserRole.OWNER || currentUser.role === UserRole.MANAGER || currentUser.role === UserRole.STAFF);
  const userCanPerformDelete = currentUser && (currentUser.role === UserRole.OWNER || currentUser.role === UserRole.MANAGER);


  return (
    <>
      {creationSuccessMessage && (
        <div className="bg-status-success-bg border-l-4 border-status-success text-status-success-text px-4 py-3 rounded-r-md shadow-md text-sm flex items-center justify-between mb-6 animate-fadeIn">
          <div className="flex items-center">
            <CheckCircleIcon size={20} className="mr-3"/>
            <span>{creationSuccessMessage}</span>
          </div>
          <button onClick={() => setCreationSuccessMessage(null)} className="p-1 rounded-full hover:bg-black/10" aria-label="Đóng thông báo">
            <XIcon size={18} />
          </button>
        </div>
      )}
      {ordersToConfirm.length > 0 && (
        <Card title="Đơn hàng chờ xác nhận" icon={<AlertTriangleIcon size={20} className="text-purple-600"/>} className="mb-6 border-l-4 border-purple-500 !bg-purple-50/60">
            <p className="text-sm text-purple-800 mb-4">Có <strong>{ordersToConfirm.length}</strong> đơn hàng do khách tự tạo cần bạn gọi điện xác nhận và chỉnh sửa trước khi xử lý.</p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
                {ordersToConfirm.map(order => (
                    <div key={order.id} className="flex justify-between items-center p-2 bg-bg-surface rounded-md border border-purple-200">
                        <div>
                            <Link to={`/admin/orders/${order.id}`} className="font-semibold text-text-link hover:underline">{order.id}</Link>
                            <p className="text-xs text-text-muted">{order.customer.name} - {order.customer.phone}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Button 
                                variant="danger" 
                                size="sm" 
                                onClick={() => handleOpenDeleteModal(order, 'Xác nhận hủy đơn hàng')}
                                >
                                Hủy
                            </Button>
                            <Button size="sm" onClick={() => navigate(`/admin/orders/edit/${order.id}`)}>
                                Xác nhận / Sửa
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        </Card>
      )}
      <Card 
        title="Danh sách Đơn hàng"
        actions={
          <div className="flex space-x-2">
            {currentUser?.role === UserRole.OWNER && (
                <Link to="/admin/orders/deleted-history">
                    <Button variant="secondary" leftIcon={<HistoryIcon size={18}/>}>Lịch sử xóa HĐ</Button>
                </Link>
            )}
            <Link to="/admin/orders/new">
              <Button variant="primary" leftIcon={<PlusCircleIcon size={18}/>}>Tạo đơn mới</Button>
            </Link>
          </div>
        }
      >
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
          <Input 
            placeholder="Tìm kiếm theo Mã ĐH, Tên KH, SĐT..."
            value={searchTerm}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
            leftIcon={<SearchIcon />}
            wrapperClassName="flex-grow"
          />
          <Select
            options={statusOptions}
            value={statusFilter}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value as OrderStatus | '')}
            leftIcon={<FilterIcon />}
            wrapperClassName="flex-grow"
          />
        </div>
        
        <div className="mb-6 p-4 border border-dashed border-brand-primary rounded-lg bg-bg-subtle">
            <label htmlFor="qrScanInput" className="block text-sm font-medium text-text-heading mb-1">Quét mã QR Đơn hàng tại đây:</label>
            <div className="flex space-x-2 items-center">
                <Input
                    id="qrScanInput"
                    ref={qrScanInputRef}
                    type="text"
                    value={qrScanInput}
                    onChange={(e) => setQrScanInput(e.target.value)}
                    onKeyDown={handleQrScanEnter}
                    placeholder={isProcessingScan ? "Đang xử lý..." : "Chờ quét mã QR..."}
                    aria-label="QR Code Scan Input"
                    className="flex-grow !py-2.5"
                    disabled={isProcessingScan}
                    leftIcon={<CameraIcon size={18}/>}
                />
                <Button onClick={() => qrScanInputRef.current?.focus()} variant="secondary" className="!py-2.5" disabled={isProcessingScan}>Focus Scan</Button>
            </div>
            {isProcessingScan && <p className="text-xs text-brand-primary mt-1 animate-pulse flex items-center"><ZapIcon size={12} className="mr-1"/>Đang xử lý mã QR...</p>}
        </div>


        {filteredOrders.length === 0 ? (
          <p className="text-center text-text-muted py-10">Không có đơn hàng nào phù hợp.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border-base">
            <table className="min-w-full divide-y divide-border-base">
              <thead className="bg-bg-subtle">
                <tr>
                  {tableHeaders.map(header => (
                    <th key={header.label} className="px-5 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">
                      <div className="flex items-center">
                        {React.cloneElement(header.icon as React.ReactElement<{ className?: string }>, {className: "mr-1.5 flex-shrink-0"})}
                        <span>{header.label}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-bg-surface divide-y divide-border-base">
                {filteredOrders.map(order => {
                  const isEditableDeletableStatus = order.status === OrderStatus.PENDING || order.status === OrderStatus.CANCELLED || order.status === OrderStatus.WAITING_FOR_CONFIRMATION;
                  const canEditOrder = userCanPerformEdit && isEditableDeletableStatus;
                  const canDeleteOrder = userCanPerformDelete && isEditableDeletableStatus;

                  return (
                    <tr key={order.id} className="hover:bg-bg-surface-hover transition-colors">
                      <td className="px-5 py-4 whitespace-nowrap text-sm font-medium text-text-link hover:underline">
                        <Link to={`/admin/orders/${order.id}`}>{order.id}</Link>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-sm text-text-body">
                        {order.customer.name} <span className="text-text-muted">({order.customer.phone})</span>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-sm text-text-body">{new Date(order.createdAt).toLocaleDateString('vi-VN')}</td>
                      <td className="px-5 py-4 whitespace-nowrap text-sm text-text-body font-medium">{order.totalAmount.toLocaleString('vi-VN')} VNĐ</td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 inline-flex items-center text-xs leading-5 font-semibold rounded-full ${getStatusClassAndText(order.status).className}`}>
                          {order.status === OrderStatus.RETURNED && <PackageCheck size={12} className="mr-1"/>}
                          {getStatusClassAndText(order.status).text}
                        </span>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center space-x-1">
                          <Link to={`/admin/orders/${order.id}`}>
                            <Button variant="ghost" size="sm" title="Xem chi tiết" className="text-text-link hover:text-brand-primary p-1.5">
                              <EyeIcon size={18} />
                            </Button>
                          </Link>
                          
                          {userCanPerformEdit && (
                            canEditOrder ? (
                              <Button variant="ghost" size="sm" title="Sửa đơn hàng" className="text-text-link hover:text-brand-primary p-1.5" onClick={() => navigate(`/admin/orders/edit/${order.id}`)}>
                                <EditIcon size={18} />
                              </Button>
                            ) : (
                              <Button variant="ghost" size="sm" title={`Không thể sửa đơn với trạng thái "${order.status}"`} className="text-text-muted cursor-not-allowed p-1.5" disabled>
                                <EditIcon size={18} />
                              </Button>
                            )
                          )}
                          
                          {userCanPerformDelete && (
                            canDeleteOrder ? (
                              <Button variant="ghost" size="sm" title="Xóa đơn hàng" className="text-status-danger hover:text-rose-600 p-1.5" onClick={() => handleOpenDeleteModal(order)}>
                                <Trash2Icon size={18} />
                              </Button>
                            ) : (
                               <Button variant="ghost" size="sm" title={`Không thể xóa đơn với trạng thái "${order.status}"`} className="text-text-muted cursor-not-allowed p-1.5" disabled>
                                <Trash2Icon size={18} />
                              </Button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <ReasonModal
        isOpen={isReasonModalOpen}
        onClose={() => { setIsReasonModalOpen(false); setOrderToDelete(null); }}
        onConfirm={handleConfirmDelete}
        title={reasonModalTitle}
        orderId={orderToDelete?.id}
      />
      <PickupLocationModal
        isOpen={isPickupLocationModalOpen}
        onClose={() => {
          setIsPickupLocationModalOpen(false);
          setOrderForLocationSelection(null); 
          if (qrScanInputRef.current) qrScanInputRef.current.focus();
        }}
        onConfirm={handlePickupLocationConfirm}
        orderId={orderForLocationSelection?.id || ''}
        locations={pickupLocations}
      />
       {currentUrgentOrder && (
          <UrgentOrderWarningModal
              isOpen={!!currentUrgentOrder}
              order={currentUrgentOrder}
              onProcessNow={handleProcessUrgentOrder}
              onPostpone={handlePostponeUrgentOrder}
          />
      )}
    </>
  );
};

export default OrderListPage;