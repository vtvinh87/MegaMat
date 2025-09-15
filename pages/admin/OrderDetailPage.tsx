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


const OrderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation(); 
  // FIX: Replaced useAppContext with useData and useAuth
  const { orders, updateOrder, addNotification, users, notifications: contextNotifications, getStaffForOrderActions, findStoreProfileByOwnerId, promotions } = useData(); 
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
    if (!order || !currentUser || (order.status !== OrderStatus.COMPLETED && order.status !== OrderStatus.PROCESSING)) { 
        addNotification({ message: 'Chỉ có thể cập nhật vị trí khi đơn hàng đang xử lý hoặc đã xử lý xong.', type: 'warning'});
        return;
    }
    if (!selectedPickupLocation) {
      addNotification({ message: 'Vui lòng chọn một vị trí để đồ.', type: 'warning'});
      return;
    }
    
    if (order.pickupLocation === selectedPickupLocation) {
        addNotification({ message: 'Vị trí để đồ không thay đổi.', type: 'info'});
        return;
    }

    const confirmSave = (reason: string) => {
        if (!order || !currentUser) return; 
        const updatedOrder = { ...order, pickupLocation: selectedPickupLocation };
        
        let actingStaffId: string | undefined = currentUser.id;

        const newScanEntry: ScanHistoryEntry = {
            timestamp: new Date(),
            action: `Cập nhật vị trí để đồ thành: ${selectedPickupLocation}.`,
            staffUserId: actingStaffId,
            scannedBy: currentUser.role || 'Hệ thống',
            reason: reason
        };
        updatedOrder.scanHistory = [...(order.scanHistory || []), newScanEntry];
        updateOrder(updatedOrder);
        setOrder(updatedOrder);
        addNotification({ message: `Đã cập nhật vị trí để đồ cho đơn ${order.id} thành ${selectedPickupLocation}.`, type: 'info' });
        closeReasonModal();
    };
    
    if (currentUser.role === UserRole.STAFF || currentUser.role === UserRole.MANAGER || currentUser.role === UserRole.OWNER) {
        openReasonModal(
            'Xác nhận lưu vị trí để đồ',
            confirmSave,
            `Cập nhật vị trí cho đơn hàng ${order.id} từ "${order.pickupLocation || 'Chưa có'}" thành "${selectedPickupLocation}". Vui lòng nhập lý do (nếu có, hoặc '-' nếu không có lý do cụ thể).`
        );
    } else {
        confirmSave("Cập nhật vị trí bởi người dùng không thuộc nhóm quản trị."); 
    }
  };
  
  if (!order) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[300px] text-text-muted">
            <ZapIcon className="animate-pulse h-12 w-12 text-brand-primary mb-4"/>
            <p>Đang tải chi tiết đơn hàng...</p>
        </div>
    );
  }
  
  const statusStyle = getStatusInfo(order.status);
  const canPerformActions = currentUser && (currentUser.role === UserRole.MANAGER || currentUser.role === UserRole.OWNER || currentUser.role === UserRole.STAFF);


  const DetailItem: React.FC<{label: string; children: React.ReactNode; className?: string; dtClassName?: string; ddClassName?: string}> = 
    ({label, children, className, dtClassName, ddClassName}) => (
    <div className={`py-3 sm:grid sm:grid-cols-3 sm:gap-4 items-center ${className}`}>
      <dt className={`text-sm font-medium text-text-muted ${dtClassName}`}>{label}</dt>
      <dd className={`mt-1 text-sm text-text-body sm:mt-0 sm:col-span-2 ${ddClassName}`}>{children}</dd>
    </div>
  );
  
  const finalAmountToPay = subtotal - (order.loyaltyDiscountAmount || 0) - (order.promotionDiscountAmount || 0);

  return (
    <div className="space-y-6">
      <Button variant="link" onClick={() => navigate('/admin/orders')} className="text-text-link hover:text-brand-primary-hover mb-0 pl-0 -mt-2">
        <ArrowLeftIcon size={18} className="mr-1.5"/> Quay lại Danh sách Đơn hàng
      </Button>

      {order.status === OrderStatus.WAITING_FOR_CONFIRMATION && (
        <Card className="mb-6 !bg-purple-50 border-l-4 border-purple-500">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-start">
                    <MessageSquareIcon className="h-6 w-6 text-purple-600 mr-3 flex-shrink-0 mt-1"/>
                    <div>
                        <h3 className="font-semibold text-purple-800">Cần Xác Nhận</h3>
                        <p className="text-sm text-purple-700">Đơn hàng này được tạo bởi khách hàng và cần được nhân viên gọi điện xác nhận lại thông tin (dịch vụ, số lượng,...) trước khi xử lý.</p>
                    </div>
                </div>
                <Button onClick={() => navigate(`/admin/orders/edit/${order.id}`)} className="w-full sm:w-auto flex-shrink-0">
                    Xác nhận / Sửa đổi
                </Button>
            </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Column: Main Details */}
        <div className="lg:col-span-3 space-y-6">
          <Card 
            title={`Đơn hàng: ${order.id}`}
            titleClassName="!text-2xl !font-bold"
            headerClassName="border-b-0 pb-0"
            contentClassName="!pt-2"
          >
            <dl className="divide-y divide-border-base">
              <DetailItem label="Trạng thái:">
                <span className={`font-semibold px-2.5 py-1 rounded-full text-xs inline-flex items-center ${statusStyle.bgColor} ${statusStyle.textColor} border ${statusStyle.borderColor}`}>
                  {statusStyle.icon}{statusStyle.text}
                </span>
              </DetailItem>
              <DetailItem label="Ngày tạo:">{new Date(order.createdAt).toLocaleString('vi-VN', { dateStyle: 'long', timeStyle: 'short' })}</DetailItem>
              {order.receivedAt && <DetailItem label="Thời gian nhận đồ:">{new Date(order.receivedAt).toLocaleString('vi-VN', {dateStyle: 'long', timeStyle: 'short'})}</DetailItem>}
              
              {(order.status === OrderStatus.PROCESSING || order.status === OrderStatus.PENDING) && order.estimatedCompletionTime && (
                <DetailItem label="Dự kiến xử lý xong/trả:">
                  {new Date(order.estimatedCompletionTime).toLocaleString('vi-VN', { dateStyle: 'long', timeStyle: 'short' })}
                  {order.status === OrderStatus.PROCESSING && ` (còn ${getRemainingTime(order.estimatedCompletionTime)})`}
                </DetailItem>
              )}

              {(order.status === OrderStatus.COMPLETED || order.status === OrderStatus.RETURNED) && order.completedAt && <DetailItem label="Thời gian hoàn thành/trả đồ:">{new Date(order.completedAt).toLocaleString('vi-VN', {dateStyle: 'long', timeStyle: 'short'})}</DetailItem>}
              {order.pickupLocation && <DetailItem label="Vị trí để đồ:"><span className="flex items-center"><MapPinIcon size={16} className="mr-1.5 text-text-muted"/>{order.pickupLocation}</span></DetailItem>}
              <DetailItem label="Tổng cộng:">
                {subtotal.toLocaleString('vi-VN')} VNĐ
              </DetailItem>
              {order.loyaltyDiscountAmount && order.loyaltyDiscountAmount > 0 && (
                <DetailItem label={`Giảm giá (${order.loyaltyPointsRedeemed} điểm):`}>
                  <span className="text-status-success-text">- {order.loyaltyDiscountAmount.toLocaleString('vi-VN')} VNĐ</span>
                </DetailItem>
              )}
               {order.promotionDiscountAmount && order.promotionDiscountAmount > 0 && (
                <DetailItem label={`Khuyến mãi (${appliedPromotion?.code || ''}):`}>
                  <span className="text-status-success-text flex items-center"><TagIcon size={14} className="mr-1.5"/>- {order.promotionDiscountAmount.toLocaleString('vi-VN')} VNĐ</span>
                </DetailItem>
              )}
              <DetailItem label="Khách trả:" ddClassName="!text-2xl !font-bold text-brand-primary">
                {finalAmountToPay.toLocaleString('vi-VN')} VNĐ
              </DetailItem>
            </dl>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-text-heading flex items-center"><UsersIcon size={20} className="mr-2 text-brand-primary"/>Thông tin Khách hàng</h3>
            </div>
            <dl className="divide-y divide-border-base">
              <DetailItem label="Tên:">{order.customer.name}</DetailItem>
              <DetailItem label="SĐT:">{order.customer.phone}</DetailItem>
              <DetailItem label="Điểm tích lũy:">
                <span className="font-semibold text-amber-600 flex items-center">
                  <AwardIcon size={16} className="mr-1.5"/> {order.customer.loyaltyPoints.toLocaleString('vi-VN')}
                </span>
              </DetailItem>
              {order.customer.address && <DetailItem label="Địa chỉ:">{order.customer.address}</DetailItem>}
            </dl>
          </Card>

          <Card>
            <h3 className="text-lg font-semibold text-text-heading mb-4 flex items-center"><ShoppingCartIcon size={20} className="mr-2 text-brand-primary"/>Danh sách Dịch vụ</h3>
            <ul className="space-y-4">
              {order.items.map((item, index) => (
                <li key={index} className="p-4 border border-border-base rounded-lg bg-bg-subtle/20 hover:shadow-md transition-shadow">
                  <p className="font-semibold text-text-heading">{item.serviceItem.name} (x{item.quantity} {item.serviceItem.unit})</p>
                  <div className="text-sm text-text-body mt-1">
                    <p>Phương pháp: {item.serviceItem.washMethod}</p>
                    <p>Đơn giá: {item.serviceItem.price.toLocaleString('vi-VN')} VNĐ</p>
                  </div>
                  {item.notes && <p className="text-xs text-text-muted italic mt-2 pt-2 border-t border-border-base/50">Ghi chú: {item.notes}</p>}
                </li>
              ))}
            </ul>
          </Card>

          {order.scanHistory && order.scanHistory.length > 0 && (
             <Card>
                <h3 className="text-lg font-semibold text-text-heading mb-4 flex items-center"><FileTextIcon size={20} className="mr-2 text-brand-primary"/>Lịch sử xử lý</h3>
                <ul className="space-y-3 text-sm">
                    {order.scanHistory.map((scan, idx) => (
                        <li key={idx} className="flex items-start p-2 rounded-md hover:bg-bg-surface-hover">
                            <ZapIcon size={14} className="mr-2.5 mt-1 text-text-muted flex-shrink-0"/>
                            <div className="flex-grow">
                                <span className="text-text-body">{scan.action} {scan.scannedBy && <span className="text-xs text-text-muted">(bởi {scan.scannedBy}{scan.staffUserId ? ` - ID NV: ${scan.staffUserId}` : ''})</span>}</span>
                                <p className="text-xs text-text-muted">{new Date(scan.timestamp).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'medium' })}</p>
                                {scan.reason && (
                                  <p className="mt-1 text-xs text-brand-primary italic bg-sky-50 p-1.5 rounded flex items-start">
                                    <MessageSquareIcon size={12} className="mr-1.5 mt-0.5 flex-shrink-0" />
                                    Lý do: {scan.reason}
                                  </p>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            </Card>
          )}
        </div>

        {/* Right Column: Actions & QR */}
        <div className="lg:col-span-2 space-y-6">
          {canPerformActions && (
            <Card>
              <h3 className="text-lg font-semibold text-text-heading mb-4 flex items-center"><Edit3Icon size={20} className="mr-2 text-brand-primary"/>Hành động</h3>
              <div className="space-y-3">
                {order.status === OrderStatus.PENDING && (
                  <Button onClick={() => handleStatusUpdateIntent(OrderStatus.PROCESSING)} className="w-full" leftIcon={<ZapIcon size={18}/>} variant="primary">
                    Bắt đầu xử lý
                  </Button>
                )}
                {order.status === OrderStatus.PROCESSING && (
                  <>
                    <Select
                      label="Chọn vị trí để đồ"
                      options={pickupLocations.map(loc => ({ value: loc, label: loc }))}
                      value={selectedPickupLocation}
                      onChange={e => setSelectedPickupLocation(e.target.value)}
                      placeholder="-- Chọn vị trí --"
                    />
                    <Button onClick={() => handleStatusUpdateIntent(OrderStatus.COMPLETED)} className="w-full" leftIcon={<CheckCircleIcon size={18}/>} variant="primary" disabled={!selectedPickupLocation}>
                      Hoàn thành xử lý
                    </Button>
                  </>
                )}
                {order.status === OrderStatus.COMPLETED && (
                  <>
                    <div className="space-y-3">
                      <Select
                        label="Cập nhật vị trí để đồ (nếu cần)"
                        options={pickupLocations.map(loc => ({ value: loc, label: loc }))}
                        value={selectedPickupLocation}
                        onChange={e => setSelectedPickupLocation(e.target.value)}
                      />
                      <Button onClick={handleSavePickupLocation} className="w-full" leftIcon={<SaveIcon size={18}/>} variant="secondary" disabled={!selectedPickupLocation || selectedPickupLocation === order.pickupLocation}>
                        Lưu vị trí
                      </Button>
                    </div>
                    <Button onClick={() => handleStatusUpdateIntent(OrderStatus.RETURNED)} className="w-full" leftIcon={<PackageCheckIcon size={18}/>} variant="primary">
                      Xác nhận Đã Trả Đồ
                    </Button>
                  </>
                )}
                 {order.status === OrderStatus.WAITING_FOR_CONFIRMATION && (
                    <p className="text-sm text-center p-3 bg-purple-50 text-purple-800 rounded-md">Vui lòng sử dụng nút "Xác nhận / Sửa đổi" ở trên để tiếp tục.</p>
                 )}
                <Button 
                  variant="secondary" 
                  className="w-full" 
                  leftIcon={<PrinterIcon size={18}/>} 
                  onClick={() => navigate(`/admin/orders/print/${order.id}`)}
                >
                  In hóa đơn
                </Button>
              </div>
            </Card>
          )}
          
          {order.qrCodePaymentUrl && (
            <Card className="text-center">
              <h3 className="text-lg font-semibold text-text-heading mb-3 flex items-center justify-center"><DollarSignIcon size={20} className="mr-2 text-brand-primary"/>Mã QR Thanh toán</h3>
              <QRCodeDisplay value={order.qrCodePaymentUrl.replace(`amount=${order.totalAmount}`, `amount=${finalAmountToPay}`)} size={160} />
              <p className="text-xs text-text-muted mt-2">Quét để thanh toán {finalAmountToPay.toLocaleString('vi-VN')} VNĐ (Demo)</p>
            </Card>
          )}
          <Card className="text-center">
            <h3 className="text-lg font-semibold text-text-heading mb-3 flex items-center justify-center"><QrCodeIcon size={20} className="mr-2 text-brand-primary"/>Mã QR Đơn hàng</h3>
            <QRCodeDisplay value={`ORDER_ID:${order.id},STATUS:${order.status}`} size={160} />
            <p className="text-xs text-text-muted mt-2">Dùng để cập nhật trạng thái (Demo)</p>
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

export default OrderDetailPage;