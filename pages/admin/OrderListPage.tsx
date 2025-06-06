
import React, { useState, useMemo, ChangeEvent, useEffect, KeyboardEvent, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAppContext } from '../../contexts/AppContext';
import { Order, OrderStatus, UserRole, ScanHistoryEntry } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { PickupLocationModal } from '../../components/admin/PickupLocationModal'; // New Modal
import { PlusCircleIcon, EyeIcon, FilterIcon, SearchIcon, Package, User, CalendarDays, CreditCard, Tag, Settings, PackageCheck, EditIcon, Trash2Icon, HistoryIcon, CameraIcon, ZapIcon, CheckCircleIcon, XCircleIcon, InfoIcon } from 'lucide-react'; // Added CheckCircleIcon, XCircleIcon, InfoIcon
import { PICKUP_LOCATIONS, DEFAULT_PROCESSING_TIME_HOURS } from '../../constants'; // Import constants

// Helper function to map English query param to Vietnamese OrderStatus
const mapQueryParamToOrderStatus = (paramValue: string | null): OrderStatus | '' => {
  if (!paramValue) return '';
  switch (paramValue.toUpperCase()) {
    case 'PENDING': return OrderStatus.PENDING;
    case 'PROCESSING': return OrderStatus.PROCESSING;
    case 'COMPLETED': return OrderStatus.COMPLETED;
    case 'RETURNED': return OrderStatus.RETURNED;
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
    <div className="fixed inset-0 bg-black/70 dark:bg-slate-900/80 flex items-center justify-center p-4 z-50 transition-opacity duration-300 animate-fadeIn">
      <Card title={title} className="w-full max-w-md bg-bg-surface shadow-xl !border-border-base">
        {orderId && <p className="text-sm text-text-muted mb-2">Đơn hàng: {orderId}</p>}
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Nhập lý do..."
          rows={4}
          className="w-full p-2 border border-border-input rounded-md bg-bg-input dark:bg-bg-subtle focus:ring-brand-primary-focus focus:border-brand-primary-focus"
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
  const { orders, currentUser, deleteOrder, addNotification, updateOrder, findOrder } = useAppContext();
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

  // State for QR Scanning
  const [qrScanInput, setQrScanInput] = useState('');
  const [isProcessingScan, setIsProcessingScan] = useState(false);
  const [orderForLocationSelection, setOrderForLocationSelection] = useState<Order | null>(null);
  const [isPickupLocationModalOpen, setIsPickupLocationModalOpen] = useState(false);
  const qrScanInputRef = React.useRef<HTMLInputElement>(null);
  const [lastScanFeedback, setLastScanFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  useEffect(() => {
    if (lastScanFeedback) {
      const timer = setTimeout(() => {
        setLastScanFeedback(null);
      }, 5000); // Clear feedback after 5 seconds
      return () => clearTimeout(timer);
    }
  }, [lastScanFeedback]);


  useEffect(() => {
    const statusFromQuery = queryParams.get('status');
    setStatusFilter(mapQueryParamToOrderStatus(statusFromQuery));
  }, [queryParams]);

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
      case OrderStatus.PENDING: return {className: 'bg-status-warning-bg text-status-warning-text dark:text-amber-300 dark:bg-amber-700/40', text: OrderStatus.PENDING};
      case OrderStatus.PROCESSING: return {className: 'bg-status-info-bg text-status-info-text dark:text-sky-300 dark:bg-sky-700/40', text: OrderStatus.PROCESSING};
      case OrderStatus.COMPLETED: return {className: 'bg-status-success-bg text-status-success-text dark:text-emerald-300 dark:bg-emerald-700/40', text: OrderStatus.COMPLETED};
      case OrderStatus.CANCELLED: return {className: 'bg-status-danger-bg text-status-danger-text dark:text-rose-300 dark:bg-rose-700/40', text: OrderStatus.CANCELLED};
      case OrderStatus.RETURNED: return {className: 'bg-brand-primary/10 text-brand-primary dark:text-sky-300 dark:bg-brand-primary/30', text: OrderStatus.RETURNED};
      default: return {className: 'bg-bg-subtle text-text-muted dark:bg-slate-600/40', text: status};
    }
  };
  
  const handleQrScanEnter = async (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && qrScanInput.trim() && !isProcessingScan) {
      event.preventDefault();
      const scannedData = qrScanInput.trim();
      setQrScanInput(''); 
      setIsProcessingScan(true);
      setLastScanFeedback(null); 

      const parts = scannedData.split(',');
      const orderIdPart = parts.find(p => p.startsWith('ORDER_ID:'));
      if (!orderIdPart) {
        setLastScanFeedback({ type: 'error', message: 'Mã Sai' });
        addNotification({ message: "Mã QR không hợp lệ: Thiếu thông tin ORDER_ID.", type: "error" });
        setIsProcessingScan(false);
        return;
      }
      const orderIdToUpdate = orderIdPart.split(':')[1];

      const orderToUpdate = findOrder(orderIdToUpdate);
      if (!orderToUpdate) {
        setLastScanFeedback({ type: 'error', message: 'Không ĐH' });
        addNotification({ message: `Không tìm thấy đơn hàng với ID: ${orderIdToUpdate}.`, type: "error" });
        setIsProcessingScan(false);
        return;
      }

      if (!currentUser) {
        setLastScanFeedback({ type: 'error', message: 'Lỗi User' });
        addNotification({ message: "Không thể xác định người dùng. Vui lòng đăng nhập lại.", type: "error" });
        setIsProcessingScan(false);
        return;
      }
      
      let newStatus: OrderStatus | null = null;
      let scanActionText = "";
      let notificationMessage = "";
      let openPickupModal = false;

      switch (orderToUpdate.status) {
        case OrderStatus.PENDING:
          newStatus = OrderStatus.PROCESSING;
          scanActionText = "Quét QR: Chuyển sang Đang xử lý.";
          notificationMessage = `Đơn hàng ${orderToUpdate.id} đã chuyển sang Đang xử lý.`;
          setLastScanFeedback({ type: 'success', message: 'Đang XL' });
          break;
        case OrderStatus.PROCESSING:
          newStatus = OrderStatus.COMPLETED; // Temp status, real update after location
          scanActionText = "Quét QR: Chuyển sang Đã xử lý (chờ chọn vị trí).";
          openPickupModal = true;
          setOrderForLocationSelection(orderToUpdate);
          setLastScanFeedback({ type: 'success', message: 'Chọn Vị Trí' });
          break;
        case OrderStatus.COMPLETED:
          newStatus = OrderStatus.RETURNED;
          scanActionText = "Quét QR: Chuyển sang Đã trả.";
          notificationMessage = `Đơn hàng ${orderToUpdate.id} đã được trả cho khách.`;
          setLastScanFeedback({ type: 'success', message: 'Đã Trả' });
          break;
        case OrderStatus.RETURNED:
          setLastScanFeedback({ type: 'info', message: 'Đã Trả Rồi' });
          addNotification({ message: `Đơn hàng ${orderToUpdate.id} đã được trả. Không có hành động thêm.`, type: "info" });
          setIsProcessingScan(false);
          return;
        case OrderStatus.CANCELLED:
        case OrderStatus.DELETED_BY_ADMIN:
          setLastScanFeedback({ type: 'info', message: 'ĐH Hủy/Xóa' });
          addNotification({ message: `Đơn hàng ${orderToUpdate.id} đã hủy/xóa. Không thể cập nhật qua QR.`, type: "warning" });
          setIsProcessingScan(false);
          return;
        default:
          setLastScanFeedback({ type: 'error', message: 'Lỗi TT' });
          addNotification({ message: `Trạng thái đơn hàng không xác định: ${orderToUpdate.status}.`, type: "error" });
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
            updatedOrderObject.estimatedCompletionTime = new Date(receivedAt.getTime() + (itemsMaxHours || DEFAULT_PROCESSING_TIME_HOURS) * 60 * 60 * 1000);
        }
        if (newStatus === OrderStatus.RETURNED && !updatedOrderObject.completedAt) {
            updatedOrderObject.completedAt = new Date(); 
        }

        updateOrder(updatedOrderObject);
        addNotification({ message: notificationMessage, type: "success" });
      }
      setIsProcessingScan(false);
    }
  };

  const handlePickupLocationConfirm = (selectedLocation: string) => {
    if (!orderForLocationSelection || !currentUser) return;

    const scanActionText = `Quét QR & Chọn vị trí: Hoàn thành xử lý. Vị trí: ${selectedLocation}.`;
    const notificationMessage = `Đơn hàng ${orderForLocationSelection.id} đã xử lý xong. Vị trí: ${selectedLocation}.`;

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
    addNotification({ message: notificationMessage, type: "success" });
    setLastScanFeedback({ type: 'success', message: 'Lưu Vị Trí OK' });
    setOrderForLocationSelection(null);
    setIsPickupLocationModalOpen(false);
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
    ...Object.values(OrderStatus)
        .filter(s => s !== OrderStatus.DELETED_BY_ADMIN && s !== OrderStatus.CANCELLED)
        .map(s => ({ value: s, label: s}))
  ];

  const handleOpenDeleteModal = (order: Order) => {
    setOrderToDelete(order);
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
        
        <div className="mb-6 p-4 border border-dashed border-brand-primary dark:border-sky-600 rounded-lg bg-sky-50 dark:bg-sky-700/20">
            <label htmlFor="qrScanInput" className="block text-sm font-medium text-text-heading dark:text-sky-200 mb-1">Quét mã QR Đơn hàng tại đây:</label>
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
                 {lastScanFeedback && (
                    <div className={`flex items-center text-xs ml-2 px-1.5 py-0.5 rounded-md shadow-sm ${
                        lastScanFeedback.type === 'success' ? 'bg-green-100 text-green-700 dark:bg-green-700/30 dark:text-green-300 border border-green-300 dark:border-green-600' :
                        lastScanFeedback.type === 'error' ? 'bg-red-100 text-red-700 dark:bg-red-700/30 dark:text-red-300 border border-red-300 dark:border-red-600' :
                        'bg-sky-100 text-sky-700 dark:bg-sky-700/30 dark:text-sky-300 border border-sky-300 dark:border-sky-600'
                    }`}>
                        {lastScanFeedback.type === 'success' && <CheckCircleIcon size={14} className="mr-1 flex-shrink-0"/>}
                        {lastScanFeedback.type === 'error' && <XCircleIcon size={14} className="mr-1 flex-shrink-0"/>}
                        {lastScanFeedback.type === 'info' && <InfoIcon size={14} className="mr-1 flex-shrink-0"/>}
                        <span className="truncate max-w-[100px]">{lastScanFeedback.message}</span>
                    </div>
                )}
            </div>
            {isProcessingScan && <p className="text-xs text-brand-primary dark:text-sky-400 mt-1 animate-pulse flex items-center"><ZapIcon size={12} className="mr-1"/>Đang xử lý mã QR...</p>}
        </div>


        {filteredOrders.length === 0 ? (
          <p className="text-center text-text-muted py-10">Không có đơn hàng nào phù hợp.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border-base">
            <table className="min-w-full divide-y divide-border-base">
              <thead className="bg-bg-subtle/50 dark:bg-slate-700/30">
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
                  const isEditableDeletableStatus = order.status === OrderStatus.PENDING || order.status === OrderStatus.CANCELLED;
                  const canEditOrder = userCanPerformEdit && isEditableDeletableStatus;
                  const canDeleteOrder = userCanPerformDelete && isEditableDeletableStatus;

                  return (
                    <tr key={order.id} className="hover:bg-bg-surface-hover dark:hover:bg-slate-700/60 transition-colors">
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
        title="Xác nhận xóa đơn hàng"
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
      />
    </>
  );
};

export default OrderListPage;
