

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom'; // Added useLocation
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { Order, OrderStatus, UserRole, ScanHistoryEntry, User, PaymentStatus } from '../../types';
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
          if (updatedOrder.paymentStatus !== PaymentStatus.PAID) {
              addNotification({ message: `Không thể trả hàng: Đơn hàng ${order.id} chưa được thanh toán.`, type: 'error', showToast: true });
              return;
          }
          updatedOrder.status = OrderStatus.RETURNED;
          if (!updatedOrder.completedAt) {
            updatedOrder.completedAt = new Date();
          }
          actionText = `Đã trả hàng cho khách.`;
          staffRoleInAction = 'return';
          notificationMessage = `Đơn hàng ${order.id} đã được trả cho khách.`;
          notificationType = 'success';
          shouldCreateRatingPrompt = true;
        }
        break;
      case OrderStatus.CANCELLED:
        if (order.status === OrderStatus.PENDING || order.status === OrderStatus.WAITING_FOR_CONFIRMATION) {
            updatedOrder.status = OrderStatus.CANCELLED;
            actionText = `Hủy đơn hàng.`;
            notificationMessage = `Đơn hàng ${order.id} đã được hủy.`;
            notificationType = 'warning';
        }
        break;
      default:
        addNotification({ message: `Hành động không hợp lệ cho trạng thái hiện tại của đơn hàng.`, type: 'warning', showToast: true });
        return;
    }

    const newScanHistoryEntry: ScanHistoryEntry = {
        timestamp: new Date(),
        action: actionText,
        staffUserId: currentUser.id,
        scannedBy: currentUser.role,
        reason: reason,
        staffRoleInAction: staffRoleInAction,
    };
    updatedOrder.scanHistory = [...(updatedOrder.scanHistory || []), newScanHistoryEntry];
    
    updateOrder(updatedOrder);

    if (notificationMessage) {
        addNotification({ message: notificationMessage, type: notificationType, showToast: true, orderId: order.id });
    }

    if (shouldCreateRatingPrompt) {
        addNotification({
            message: `Khách hàng ${order.customer.name} có thể đánh giá đơn hàng ${order.id} ngay bây giờ.`,
            type: 'rating_prompt',
            orderId: order.id,
            userId: order.customer.id,
            showToast: true,
        });
    }
    
    closeReasonModal();
  };
  
  const handleUpdatePickupLocation = () => {
    if (!order || !currentUser) return;
    const updatedOrder: Order = {
        ...order,
        pickupLocation: selectedPickupLocation,
        scanHistory: [
            ...(order.scanHistory || []),
            {
                timestamp: new Date(),
                action: `Cập nhật vị trí để đồ: ${selectedPickupLocation}`,
                staffUserId: currentUser.id,
                scannedBy: currentUser.role,
            }
        ]
    };
    updateOrder(updatedOrder);
    addNotification({ message: `Đã cập nhật vị trí cho đơn hàng ${order.id}.`, type: 'info', showToast: true });
  };

  const { pickupStaff, returnStaff, processingStaff } = useMemo(() => {
    if (!order) return { pickupStaff: undefined, returnStaff: undefined, processingStaff: [] };
    return getStaffForOrderActions(order.id);
  }, [order, getStaffForOrderActions]);

  if (!order) {
    return (
      <Card title="Đang tải...">
        <p className="text-center text-text-muted py-10">Đang tìm thông tin đơn hàng...</p>
      </Card>
    );
  }

  const statusStyle = getStatusInfo(order.status);

  // FIX: Added missing DetailItem component definition
  const DetailItem: React.FC<{ label: string; children: React.ReactNode; className?: string; dtClassName?: string; ddClassName?: string }> =
    ({ label, children, className = '', dtClassName = '', ddClassName = '' }) => (
      <div className={`py-3 sm:grid sm:grid-cols-3 sm:gap-4 items-center ${className}`}>
        <dt className={`text-sm font-medium text-text-muted ${dtClassName}`}>{label}</dt>
        <dd className={`mt-1 text-sm text-text-body sm:mt-0 sm:col-span-2 ${ddClassName}`}>{children}</dd>
      </div>
    );

  return (
    <div className="space-y-6">
      <Button variant="link" onClick={() => navigate('/admin/orders')} className="text-text-link hover:text-brand-primary-hover mb-0 pl-0 -mt-2">
        <ArrowLeftIcon size={18} className="mr-1.5"/> Quay lại danh sách đơn hàng
      </Button>

      <Card title={`Chi tiết Đơn hàng: ${order.id}`} titleClassName="!text-2xl !font-bold">
        <dl className="divide-y divide-border-base">
          <DetailItem label="Trạng thái:">
            <span className={`font-semibold px-2.5 py-1 rounded-full text-xs inline-flex items-center ${statusStyle.bgColor} ${statusStyle.textColor} border ${statusStyle.borderColor}`}>
              {statusStyle.icon}{statusStyle.text}
            </span>
          </DetailItem>
          <DetailItem label="Khách hàng:">{order.customer.name} - {order.customer.phone}</DetailItem>
          <DetailItem label="Ngày tạo:">{new Date(order.createdAt).toLocaleString('vi-VN', { dateStyle: 'long', timeStyle: 'short' })}</DetailItem>
          <DetailItem label="Dự kiến trả:">{order.estimatedCompletionTime ? new Date(order.estimatedCompletionTime).toLocaleString('vi-VN', { dateStyle: 'long', timeStyle: 'short' }) : 'N/A'}</DetailItem>
          <DetailItem label="Ghi chú chung:">{order.notes || <span className="italic text-text-muted">Không có</span>}</DetailItem>
        </dl>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <h3 className="text-lg font-semibold text-text-heading mb-4 flex items-center"><ListOrdered size={20} className="mr-2 text-brand-primary"/> Chi tiết Dịch vụ</h3>
            <div className="space-y-3">
              {order.items.map((item, index) => (
                <div key={index} className="p-3 bg-bg-subtle rounded-lg border border-border-base">
                  <div className="flex justify-between items-start">
                    <p className="font-semibold text-text-body">{item.serviceItem.name}</p>
                    <p className="font-semibold text-text-heading">{Math.max(item.serviceItem.price * item.quantity, item.serviceItem.minPrice || 0).toLocaleString('vi-VN')} VNĐ</p>
                  </div>
                  <p className="text-sm text-text-muted">PP Giặt: {washMethods.find(wm => wm.id === item.selectedWashMethodId)?.name || 'Không rõ'}</p>
                  <p className="text-sm text-text-muted">Số lượng: {item.quantity} {item.serviceItem.unit}</p>
                  {item.notes && <p className="text-sm text-text-body italic mt-1">Ghi chú: "{item.notes}"</p>}
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h3 className="text-lg font-semibold text-text-heading mb-4 flex items-center"><FileTextIcon size={20} className="mr-2 text-brand-primary"/> Lịch sử & Thao tác</h3>
            <ul className="space-y-3 max-h-60 overflow-y-auto text-sm border-b border-border-base pb-4 mb-4">
              {order.scanHistory?.map((entry, index) => (
                <li key={index} className="flex items-start">
                  <span className="text-text-muted w-32 flex-shrink-0">{new Date(entry.timestamp).toLocaleString('vi-VN', {dateStyle: 'short', timeStyle: 'short'})}</span>
                  <div className="flex-grow pl-2 border-l-2 border-border-base">
                    <p className="text-text-body">{entry.action}</p>
                    <p className="text-xs text-text-muted">Bởi: {entry.scannedBy} {entry.reason && `(Lý do: ${entry.reason})`}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="space-y-4">
               {order.status === OrderStatus.PROCESSING && (
                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <Select label="Vị trí để đồ" options={pickupLocations.map(l=>({value: l, label:l}))} value={selectedPickupLocation} onChange={e=>setSelectedPickupLocation(e.target.value)} wrapperClassName="flex-grow w-full" />
                  <Button onClick={handleUpdatePickupLocation} leftIcon={<SaveIcon size={16}/>} className="w-full sm:w-auto">Cập nhật Vị trí</Button>
                </div>
              )}
              <div className="flex flex-wrap gap-2 justify-end">
                {order.status === OrderStatus.PENDING && <Button variant="primary" onClick={() => performStatusUpdate(OrderStatus.PROCESSING)}>Bắt đầu xử lý</Button>}
                {order.status === OrderStatus.PROCESSING && <Button variant="primary" onClick={() => performStatusUpdate(OrderStatus.COMPLETED)}>Hoàn thành xử lý</Button>}
                {(order.status === OrderStatus.COMPLETED) && <Button variant="primary" onClick={() => performStatusUpdate(OrderStatus.RETURNED)}>Đã trả cho khách</Button>}
                {(order.status === OrderStatus.PENDING || order.status === OrderStatus.WAITING_FOR_CONFIRMATION) && <Button variant="danger" onClick={() => openReasonModal('Xác nhận Hủy Đơn hàng', (reason) => performStatusUpdate(OrderStatus.CANCELLED, reason))}>Hủy Đơn hàng</Button>}
                <Button variant="secondary" onClick={() => navigate(`/admin/orders/print/${order.id}`)} leftIcon={<PrinterIcon size={16}/>}>In Hóa đơn</Button>
              </div>
            </div>
          </Card>

        </div>
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <h3 className="text-lg font-semibold text-text-heading mb-2 flex items-center"><DollarSignIcon size={20} className="mr-2 text-brand-primary"/>Thanh toán</h3>
            <dl className="text-sm space-y-2">
              <div className="flex justify-between"><dt className="text-text-muted">Tạm tính:</dt><dd className="text-text-body">{subtotal.toLocaleString('vi-VN')} VNĐ</dd></div>
              {appliedPromotion && <div className="flex justify-between"><dt className="text-text-muted">{`KM (${appliedPromotion.code}):`}</dt><dd className="text-status-success-text">-{order.promotionDiscountAmount?.toLocaleString('vi-VN')} VNĐ</dd></div>}
              {order.loyaltyDiscountAmount && <div className="flex justify-between"><dt className="text-text-muted">{`Điểm thưởng (${order.loyaltyPointsRedeemed}):`}</dt><dd className="text-status-success-text">-{order.loyaltyDiscountAmount.toLocaleString('vi-VN')} VNĐ</dd></div>}
              <div className="flex justify-between font-bold text-lg pt-2 border-t border-border-base"><dt className="text-text-heading">Tổng cộng:</dt><dd className="text-brand-primary">{order.totalAmount.toLocaleString('vi-VN')} VNĐ</dd></div>
            </dl>
             <div className="mt-4 text-center">
                <p className="text-sm font-semibold text-text-heading mb-1">Trạng thái: {order.paymentStatus}</p>
                {order.paymentMethod && <p className="text-xs text-text-muted">Phương thức: {order.paymentMethod}</p>}
                {order.qrCodePaymentUrl && order.paymentStatus !== PaymentStatus.PAID && <QRCodeDisplay value={order.qrCodePaymentUrl} size={100} className="mt-2" />}
            </div>
          </Card>
           <Card>
                <h3 className="text-lg font-semibold text-text-heading mb-4 flex items-center"><UsersIcon size={20} className="mr-2 text-brand-primary"/> Nhân viên Phụ trách</h3>
                <div className="space-y-2 text-sm">
                    <p><strong className="text-text-muted w-24 inline-block">Nhận đồ:</strong> {pickupStaff?.name || 'Chưa xác định'}</p>
                    <p><strong className="text-text-muted w-24 inline-block">Xử lý:</strong> {processingStaff.length > 0 ? processingStaff.map(s => s.name).join(', ') : 'Chưa xác định'}</p>
                    <p><strong className="text-text-muted w-24 inline-block">Trả đồ:</strong> {returnStaff?.name || 'Chưa xác định'}</p>
                </div>
            </Card>
        </div>
      </div>

       <ReasonModal
        isOpen={isReasonModalOpen}
        onClose={closeReasonModal}
        onConfirm={reasonModalConfig?.onConfirm || (() => {})}
        title={reasonModalConfig?.title || ''}
        actionDescription={reasonModalConfig?.actionDescription}
      />
    </div>
  );
};

// FIX: This was missing due to file truncation.
export default OrderDetailPage;
