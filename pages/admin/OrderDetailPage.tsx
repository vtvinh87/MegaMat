
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom'; // Added useLocation
// FIX: Replaced useAppContext with useData and useAuth
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { Order, OrderStatus, UserRole, ScanHistoryEntry, User } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { QRCodeDisplay } from '../../components/shared/QRCodeDisplay';
import { Select } from '../../components/ui/Select';
import { 
  ArrowLeftIcon, PrinterIcon, QrCodeIcon, CheckCircleIcon, ZapIcon, MapPinIcon, SaveIcon, 
  Package, UserCircle, ListOrdered, DollarSignIcon, ClockIcon, InfoIcon, PackageCheckIcon,
  CalendarDaysIcon, UsersIcon, ShoppingCartIcon, FileTextIcon, Edit3Icon, SendIcon, MessageSquareIcon, AwardIcon, TagIcon
} from 'lucide-react';

// Simple Reason Modal Component (can be extracted)
interface ReasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  title: string;
  actionDescription?: string;
}

const ReasonModal: React.FC<ReasonModalProps> = ({ isOpen, onClose, onConfirm, title, actionDescription }) => {
  const [reason, setReason] = useState('');

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!reason.trim()) {
      alert('Lý do không được để trống.'); // Replace with better error handling
      return;
    }
    onConfirm(reason);
    setReason('');
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[60] transition-opacity duration-300 animate-fadeIn">
      <Card title={title} className="w-full max-w-md bg-bg-surface shadow-xl !border-border-base">
        {actionDescription && <p className="text-sm text-text-muted mb-3">{actionDescription}</p>}
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Nhập lý do thay đổi..."
          rows={4}
          className="w-full p-2 border border-border-input rounded-md bg-bg-input focus:ring-brand-primary-focus focus:border-brand-primary-focus"
          aria-label="Lý do thay đổi"
        />
        <div className="mt-4 flex justify-end space-x-3">
          <Button variant="secondary" onClick={onClose}>Hủy</Button>
          <Button variant="primary" onClick={handleConfirm}>Xác nhận</Button>
        </div>
      </Card>
    </div>
  );
};


export const OrderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation(); 
  // FIX: Replaced useAppContext with useData and useAuth
  const { orders, updateOrder, addNotification, users, notifications: contextNotifications, getStaffForOrderActions, findStoreProfileByOwnerId, promotions, washMethods } = useData(); 
  const { currentUser } = useAuth();
  
  const [order, setOrder] = useState<Order | null>(null);
  const [selectedPickupLocation, setSelectedPickupLocation] = useState<string>('');

  const [isReasonModalOpen, setIsReasonModalOpen] = useState(false);
  const [reasonModalConfig, setReasonModalConfig] = useState<{ title: string, actionDescription?: string, onConfirm: (reason: string) => void } | null>(null);

  // Get store profile for settings
  const orderStoreProfile = useMemo(() => {
    if (!order) return null;
    return findStoreProfileByOwnerId(order.ownerId);
  }, [order, findStoreProfileByOwnerId]);
  
  const pickupLocations = useMemo(() => orderStoreProfile?.pickupLocations || [], [orderStoreProfile]);
  const defaultProcessingTimeHours = useMemo(() => orderStoreProfile?.defaultProcessingTimeHours || 5, [orderStoreProfile]);
  
  const appliedPromotion = useMemo(() => {
    if (!order || !order.appliedPromotionId) return null;
    return promotions.find(p => p.id === order.appliedPromotionId);
  }, [order, promotions]);

  const subtotal = useMemo(() => {
    if (!order) return 0;
    return order.items.reduce((sum, item) => sum + Math.max(item.serviceItem.price * item.quantity, item.serviceItem.minPrice || 0), 0);
  }, [order]);

  useEffect(() => {
    const foundOrder = orders.find(o => o.id === id);
    if (foundOrder) {
      setOrder(foundOrder);
      const profile = findStoreProfileByOwnerId(foundOrder.ownerId);
      const locations = profile?.pickupLocations || [];
      if (foundOrder.pickupLocation) {
        setSelectedPickupLocation(foundOrder.pickupLocation);
      } else if (locations.length > 0) {
        setSelectedPickupLocation(locations[0]);
      }
    } else {
      addNotification({ message: `Không tìm thấy đơn hàng với ID: ${id}`, type: 'error'});
      navigate('/admin/orders'); 
    }
  }, [id, orders, navigate, addNotification, findStoreProfileByOwnerId]);

  const openReasonModal = (title: string, onConfirmCallback: (reason: string) => void, actionDescription?: string) => {
    setReasonModalConfig({ title, onConfirm: onConfirmCallback, actionDescription });
    setIsReasonModalOpen(true);
  };

  const closeReasonModal = () => {
    setIsReasonModalOpen(false);
    setReasonModalConfig(null);
  };

  const getStatusInfo = (status: OrderStatus): {textColor: string, bgColor: string, borderColor: string, text: string, icon?: React.ReactNode} => {
    switch (status) {
      case OrderStatus.WAITING_FOR_CONFIRMATION: 
        return {textColor: 'text-purple-800', bgColor: 'bg-purple-100', borderColor: 'border-purple-400', text: OrderStatus.WAITING_FOR_CONFIRMATION, icon: <MessageSquareIcon size={14} className="mr-1.5"/>};
      case OrderStatus.PENDING: 
        return {textColor: 'text-status-warning-text', bgColor: 'bg-status-warning-bg', borderColor: 'border-status-warning', text: OrderStatus.PENDING, icon: <ClockIcon size={14} className="mr-1.5"/>};
      case OrderStatus.PROCESSING: 
        return {textColor: 'text-status-info-text', bgColor: 'bg-status-info-bg', borderColor: 'border-status-info', text: OrderStatus.PROCESSING, icon: <ZapIcon size={14} className="mr-1.5"/>};
      case OrderStatus.COMPLETED: 
        return {textColor: 'text-status-success-text', bgColor: 'bg-status-success-bg', borderColor: 'border-status-success', text: OrderStatus.COMPLETED, icon: <CheckCircleIcon size={14} className="mr-1.5"/>};
      case OrderStatus.CANCELLED: 
        return {textColor: 'text-status-danger-text', bgColor: 'bg-status-danger-bg', borderColor: 'border-status-danger', text: "Đã hủy", icon: <InfoIcon size={14} className="mr-1.5"/>};
      case OrderStatus.RETURNED:
        return {textColor: 'text-text-on-primary', bgColor: 'bg-brand-primary', borderColor: 'border-brand-primary-focus', text: OrderStatus.RETURNED, icon: <PackageCheckIcon size={14} className="mr-1.5"/>};
      default: 
        return {textColor: 'text-text-muted', bgColor: 'bg-bg-subtle', borderColor: 'border-border-base', text: status, icon: <InfoIcon size={14} className="mr-1.5"/>};
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
  
const performStatusUpdate = (newStatus: OrderStatus, reason?: string) => {
    if (!order || !currentUser) return;

    let updatedOrder = { ...order };
    let actionText = `Chuyển trạng thái sang: ${newStatus}.`;
    let staffRoleInAction: ScanHistoryEntry['staffRoleInAction'] = undefined;
    let notificationMessage = '';
    let notificationType: 'info' | 'success' | 'warning' = 'info';
    let shouldCreateRatingPrompt = false;

    switch (newStatus) {
      case OrderStatus.PROCESSING:
        if (order.status === OrderStatus.PENDING) {
          updatedOrder.status = OrderStatus.PROCESSING;
          const receivedAt = order.receivedAt || new Date();
          if (!order.receivedAt) updatedOrder.receivedAt = receivedAt;
          const itemsMaxHours = Math.max(0, ...order.items.map(item => item.serviceItem.customerReturnTimeHours)); // Use customerReturnTimeHours
          updatedOrder.estimatedCompletionTime = new Date(receivedAt.getTime() + (itemsMaxHours || defaultProcessingTimeHours) * 60 * 60 * 1000);
          actionText = "Bắt đầu xử lý đơn hàng."; 
          staffRoleInAction = 'processing'; 
          notificationMessage = `Đơn hàng ${order.id} đã bắt đầu xử lý.`;
          notificationType = 'info';
        }
        break;
      case OrderStatus.COMPLETED:
        if (order.status === OrderStatus.PROCESSING) {
          if (!selectedPickupLocation && currentUser.role !== UserRole.CUSTOMER) {
            addNotification({ message: 'Vui lòng chọn vị trí để đồ trước khi hoàn thành xử lý.', type: 'warning' });
            return; 
          }
          updatedOrder.status = OrderStatus.COMPLETED;
          updatedOrder.completedAt = new Date();
          updatedOrder.pickupLocation = selectedPickupLocation;
          actionText = `Hoàn thành xử lý đơn hàng. Vị trí: ${selectedPickupLocation}.`; 
          staffRoleInAction = 'processing'; 
          notificationMessage = `Đơn hàng ${order.id} đã xử lý xong. Vị trí: ${selectedPickupLocation}.`;
          notificationType = 'success';
        }
        break;
      case OrderStatus.RETURNED:
        if (order.status === OrderStatus.COMPLETED || order.status === OrderStatus.PROCESSING) {
          updatedOrder.status = OrderStatus.RETURNED;
          if (!updatedOrder.completedAt) updatedOrder.completedAt = new Date(); 
          actionText = "Đã trả đồ cho khách."; 
          staffRoleInAction = 'return'; 
          notificationMessage = `Đơn hàng ${order.id} đã được trả cho khách.`;
          notificationType = 'success';
          
          if (order.status !== OrderStatus.COMPLETED) {
            shouldCreateRatingPrompt = true;
          } else {
            const existingPrompt = contextNotifications.find(n => n.orderId === order.id && n.type === 'rating_prompt');
            if (!existingPrompt) {
                shouldCreateRatingPrompt = true;
            }
          }
        }
        break;
      default:
        addNotification({ message: 'Thao tác không hợp lệ cho trạng thái đơn hàng hiện tại hoặc không có thay đổi.', type: 'warning' });
        return; 
    }

    if (!notificationMessage && newStatus !== order.status) { 
        addNotification({ message: `Không thể chuyển từ '${order.status}' sang '${newStatus}' theo quy trình hiện tại.`, type: 'warning' });
        return;
    }

    let actingStaffId: string | undefined = currentUser.id; 

    const newScanEntry: ScanHistoryEntry = {
        timestamp: new Date(),
        action: actionText,
        staffUserId: actingStaffId,
        staffRoleInAction: staffRoleInAction,
        scannedBy: currentUser.role || 'Hệ thống',
        ...(reason && { reason })
    };
    updatedOrder.scanHistory = [...(order.scanHistory || []), newScanEntry];

    updateOrder(updatedOrder);
    setOrder(updatedOrder); 

    if (notificationMessage) { 
      addNotification({ message: notificationMessage, type: notificationType });
    }

    if (shouldCreateRatingPrompt) {
      const existingUnreadPrompt = contextNotifications.find(n => n.orderId === order.id && n.type === 'rating_prompt' && !n.read);
      if (!existingUnreadPrompt) {
        let promptMessage = `Đơn hàng ${order.id} đã ${newStatus === OrderStatus.RETURNED ? 'được trả' : 'hoàn tất'}. Vui lòng đánh giá dịch vụ của chúng tôi!`;
        addNotification({
          message: promptMessage,
          type: 'rating_prompt',
          orderId: order.id,
        });
      }
    }
    closeReasonModal();
};

  const handleStatusUpdateIntent = (newStatus: OrderStatus) => {
    if (!order) return;
    performStatusUpdate(newStatus);
  };
  
  const handleSavePickupLocation = () => {
    if (!order || !currentUser || !selectedPickupLocation) {
        addNotification({ message: 'Lỗi: Không có đơn hàng hoặc vị trí được chọn.', type: 'error', showToast: true });
        return;
    }
    
    if (order.pickupLocation === selectedPickupLocation) {
        addNotification({ message: 'Vị trí không thay đổi.', type: 'info', showToast: true });
        return;
    }

    const reason = `Thay đổi vị trí từ "${order.pickupLocation || 'chưa có'}" thành "${selectedPickupLocation}".`;

    const updatedOrder: Order = {
        ...order,
        pickupLocation: selectedPickupLocation,
        scanHistory: [
            ...(order.scanHistory || []),
            {
                timestamp: new Date(),
                action: 'Cập nhật vị trí để đồ thủ công.',
                staffUserId: currentUser.id,
                scannedBy: currentUser.role,
                reason: reason
            }
        ]
    };
    updateOrder(updatedOrder);
    setOrder(updatedOrder);
    addNotification({ message: `Đã cập nhật vị trí cho đơn hàng ${order.id}.`, type: 'success', showToast: true });
  };


  if (!order) {
    return <Card title="Đang tải..."><p>Đang tìm thông tin đơn hàng...</p></Card>;
  }

  const { pickupStaff, returnStaff } = getStaffForOrderActions(order.id);
  const statusStyle = getStatusInfo(order.status);
  const canUpdateStatus = currentUser?.role !== UserRole.CUSTOMER && order.status !== OrderStatus.RETURNED && order.status !== OrderStatus.CANCELLED;
  const canEditOrder = (currentUser?.role === UserRole.OWNER || currentUser?.role === UserRole.MANAGER || currentUser?.role === UserRole.STAFF) && (order.status === OrderStatus.PENDING || order.status === OrderStatus.WAITING_FOR_CONFIRMATION);
  const DetailItem: React.FC<{ label: string; children: React.ReactNode; className?: string; dtClassName?: string; ddClassName?: string }> =
    ({ label, children, className = '', dtClassName = '', ddClassName = '' }) => (
      <div className={`py-3 sm:grid sm:grid-cols-3 sm:gap-4 items-center ${className}`}>
        <dt className={`text-sm font-medium text-text-muted ${dtClassName}`}>{label}</dt>
        <dd className={`mt-1 text-sm text-text-body sm:mt-0 sm:col-span-2 ${ddClassName}`}>{children}</dd>
      </div>
    );


  return (
    <div className="space-y-6">
      <Button variant="link" onClick={() => navigate(location.state?.from || '/admin/orders')} className="text-text-link hover:text-brand-primary-hover mb-0 pl-0 -mt-2">
        <ArrowLeftIcon size={18} className="mr-1.5" /> Quay lại danh sách
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6">
          <Card title={`Chi tiết Đơn hàng: ${order.id}`} titleClassName="!text-2xl !font-bold">
            <dl className="divide-y divide-border-base">
              <DetailItem label="Khách hàng"><span className="font-medium">{order.customer.name}</span> - {order.customer.phone}</DetailItem>
              <DetailItem label="Trạng thái">
                <span className={`font-semibold px-2.5 py-1 rounded-full text-xs inline-flex items-center ${statusStyle.bgColor} ${statusStyle.textColor} border ${statusStyle.borderColor}`}>{statusStyle.icon}{statusStyle.text}</span>
              </DetailItem>
              <DetailItem label="Ngày tạo">{new Date(order.createdAt).toLocaleString('vi-VN', { dateStyle: 'long', timeStyle: 'short' })}</DetailItem>
              {order.receivedAt && <DetailItem label="Ngày nhận đồ">{new Date(order.receivedAt).toLocaleString('vi-VN', { dateStyle: 'long', timeStyle: 'short' })}</DetailItem>}
              {order.estimatedCompletionTime && <DetailItem label="Dự kiến trả">{new Date(order.estimatedCompletionTime).toLocaleString('vi-VN', { dateStyle: 'long', timeStyle: 'short' })} ({getRemainingTime(order.estimatedCompletionTime)})</DetailItem>}
              {order.completedAt && <DetailItem label="Ngày hoàn thành/trả">{new Date(order.completedAt).toLocaleString('vi-VN', { dateStyle: 'long', timeStyle: 'short' })}</DetailItem>}
              {pickupStaff && <DetailItem label="Nhân viên nhận đồ">{pickupStaff.name}</DetailItem>}
              {returnStaff && <DetailItem label="Nhân viên trả đồ">{returnStaff.name}</DetailItem>}
              
              <DetailItem label="Tạm tính" ddClassName="text-right">{subtotal.toLocaleString('vi-VN')} VNĐ</DetailItem>
              {appliedPromotion && (
                <DetailItem label={`Khuyến mãi (${appliedPromotion.code})`} ddClassName="text-right text-status-success-text">- {order.promotionDiscountAmount?.toLocaleString('vi-VN')} VNĐ</DetailItem>
              )}
              <DetailItem label="Tổng cộng" ddClassName="!text-xl !font-semibold text-brand-primary text-right">{order.totalAmount.toLocaleString('vi-VN')} VNĐ</DetailItem>
              
              <DetailItem label="Ghi chú chung" dtClassName="self-start pt-3">
                {order.notes ? <span className="whitespace-pre-wrap">{order.notes}</span> : <span className="italic text-text-muted">Không có</span>}
              </DetailItem>
            </dl>
          </Card>

          <Card title="Các dịch vụ trong đơn hàng" icon={<ShoppingCartIcon size={20} className="text-brand-primary" />}>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead><tr><th className="p-2 text-left">Dịch vụ</th><th className="p-2 text-left">PP Giặt</th><th className="p-2 text-center">SL</th><th className="p-2 text-right">Đơn giá</th><th className="p-2 text-right">Thành tiền</th></tr></thead>
                <tbody>
                  {order.items.map((item, index) => (
                    <tr key={index} className="border-b border-border-base last:border-b-0">
                      <td className="p-2 font-medium">{item.serviceItem.name} {item.notes && <p className="text-xs text-text-muted italic">Ghi chú: {item.notes}</p>}</td>
                      <td className="p-2">{washMethods.find(wm => wm.id === item.selectedWashMethodId)?.name || 'N/A'}</td>
                      <td className="p-2 text-center">{item.quantity}</td>
                      <td className="p-2 text-right">{item.serviceItem.price.toLocaleString('vi-VN')}</td>
                      <td className="p-2 text-right font-medium">{Math.max(item.serviceItem.price * item.quantity, item.serviceItem.minPrice || 0).toLocaleString('vi-VN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="Lịch sử Quét & Thao tác" icon={<FileTextIcon size={20} className="text-brand-primary" />}>
            <ul className="space-y-3 text-sm max-h-72 overflow-y-auto">
              {(order.scanHistory || []).map((entry, index) => (
                <li key={index} className="flex space-x-3 border-b border-border-base/50 pb-2 last:border-b-0">
                  <div className="text-center flex-shrink-0">
                    <p className="font-semibold">{new Date(entry.timestamp).toLocaleTimeString('vi-VN')}</p>
                    <p className="text-xs text-text-muted">{new Date(entry.timestamp).toLocaleDateString('vi-VN')}</p>
                  </div>
                  <div>
                    <p className="font-medium text-text-heading">{entry.action}</p>
                    <p className="text-xs text-text-muted">Bởi: {entry.scannedBy} {entry.staffUserId && `(${users.find(u => u.id === entry.staffUserId)?.name || 'Không rõ'})`}</p>
                    {entry.reason && <p className="text-xs text-text-muted italic">Lý do: {entry.reason}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <Card title="Hành động" icon={<SendIcon size={20} className="text-brand-primary" />}>
            <div className="space-y-3">
              <Button onClick={() => navigate(`/admin/orders/print/${order.id}`)} variant="primary" className="w-full" leftIcon={<PrinterIcon size={18}/>}>In Hóa đơn</Button>
              {canEditOrder && <Button onClick={() => navigate(`/admin/orders/edit/${order.id}`)} variant="secondary" className="w-full" leftIcon={<Edit3Icon size={18}/>}>Sửa Đơn hàng</Button>}
              {canUpdateStatus && order.status === OrderStatus.PENDING && <Button onClick={() => handleStatusUpdateIntent(OrderStatus.PROCESSING)} className="w-full bg-blue-500 hover:bg-blue-600 text-white" leftIcon={<ZapIcon size={18}/>}>Bắt đầu xử lý</Button>}
              {canUpdateStatus && order.status === OrderStatus.PROCESSING && <Button onClick={() => handleStatusUpdateIntent(OrderStatus.COMPLETED)} className="w-full bg-green-500 hover:bg-green-600 text-white" leftIcon={<CheckCircleIcon size={18}/>}>Hoàn thành xử lý</Button>}
              {canUpdateStatus && order.status === OrderStatus.COMPLETED && <Button onClick={() => handleStatusUpdateIntent(OrderStatus.RETURNED)} className="w-full bg-indigo-500 hover:bg-indigo-600 text-white" leftIcon={<PackageCheckIcon size={18}/>}>Đã trả đồ cho khách</Button>}
            </div>
          </Card>

          {canUpdateStatus && order.status === OrderStatus.COMPLETED && (
            <Card title="Cập nhật Vị trí" icon={<MapPinIcon size={20} className="text-brand-primary"/>}>
                <Select
                    label="Vị trí để đồ"
                    options={pickupLocations.map(loc => ({value: loc, label: loc}))}
                    value={selectedPickupLocation}
                    onChange={(e) => setSelectedPickupLocation(e.target.value)}
                />
                <Button onClick={handleSavePickupLocation} className="w-full mt-3" leftIcon={<SaveIcon size={18}/>} disabled={order.pickupLocation === selectedPickupLocation || !selectedPickupLocation}>Lưu Vị trí</Button>
            </Card>
          )}

          <Card title="Thanh toán" icon={<QrCodeIcon size={20} className="text-brand-primary" />}>
            <div className="text-center">
              {order.qrCodePaymentUrl ? <QRCodeDisplay value={order.qrCodePaymentUrl} size={160}/> : <p>Không có mã QR.</p>}
              <p className="text-xs text-text-muted mt-2">Mã QR để khách hàng thanh toán.</p>
            </div>
          </Card>
        </div>
      </div>
      
      {isReasonModalOpen && reasonModalConfig && (
        <ReasonModal
          isOpen={isReasonModalOpen}
          onClose={closeReasonModal}
          onConfirm={reasonModalConfig.onConfirm}
          title={reasonModalConfig.title}
          actionDescription={reasonModalConfig.actionDescription}
        />
      )}
    </div>
  );
};
