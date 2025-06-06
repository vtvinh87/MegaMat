import React, { useState, useMemo, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { QRCodeDisplay } from './QRCodeDisplay';
import { Order, Customer, ServiceItem as AppServiceItem, OrderItem, OrderStatus, UserRole, ScanHistoryEntry, WashMethod, OrderDetailsFromAI as AppOrderDetailsFromAI, StoreProfile } from '../../types';
import { XIcon, CheckCircleIcon, ShoppingCartIcon, UserIcon, CalendarDaysIcon, TruckIcon, DollarSignIcon, AlertTriangleIcon, InfoIcon } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useAppContext } from '../../contexts/AppContext'; 

interface OrderConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (confirmedOrder: Order) => void; 
  orderDetailsFromAI: AppOrderDetailsFromAI;
  customer: Customer; 
  availableServices: AppServiceItem[];
  addCustomer: (customer: Customer) => void; 
  targetStoreOwnerId?: string; 
}

export const OrderConfirmationModal: React.FC<OrderConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  orderDetailsFromAI,
  customer: customerFromAI, 
  availableServices,
  addCustomer: addCustomerToContext, 
  targetStoreOwnerId, 
}) => {
  const { customers: globalCustomers, storeProfiles } = useAppContext(); 

  const [showPaymentQR, setShowPaymentQR] = useState(false);
  const [finalOrderForQR, setFinalOrderForQR] = useState<Order | null>(null); 
  const [processingError, setProcessingError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setShowPaymentQR(false);
      setFinalOrderForQR(null);
      setProcessingError(null);
    }
  }, [isOpen]);

  const { confirmedItems, totalAmount, serviceMatchingErrors } = useMemo(() => {
    let currentTotal = 0;
    const errors: string[] = [];
    const items: OrderItem[] = orderDetailsFromAI.items.map(aiItem => {
      const matchingServices = availableServices.filter(s => s.name.toLowerCase() === aiItem.serviceName.toLowerCase());

      if (matchingServices.length > 0) {
        const serviceToUse = matchingServices[0]; 
        const lineTotal = Math.max(serviceToUse.price * aiItem.quantity, serviceToUse.minPrice || 0);
        currentTotal += lineTotal;
        return {
          serviceItem: serviceToUse,
          selectedWashMethod: serviceToUse.washMethod, 
          quantity: aiItem.quantity,
          notes: aiItem.notes,
        };
      } else {
        errors.push(`Không tìm thấy dịch vụ "${aiItem.serviceName}". Vui lòng kiểm tra lại tên dịch vụ.`);
        return {
            serviceItem: { id: 'error-' + uuidv4(), name: `LỖI: ${aiItem.serviceName}`, unit: '', washMethod: WashMethod.WET_WASH, price: 0, estimatedTimeHours: 0, customerReturnTimeHours: 0 },
            selectedWashMethod: WashMethod.WET_WASH, 
            quantity: aiItem.quantity,
            notes: `Dịch vụ này không tồn tại trong hệ thống.`
        } as OrderItem; 
      }
    });
    return { confirmedItems: items, totalAmount: currentTotal, serviceMatchingErrors: errors };
  }, [orderDetailsFromAI.items, availableServices]);

  const handleConfirmAndPay = () => {
    setProcessingError(null);
    if (serviceMatchingErrors.length > 0) {
      setProcessingError(`Không thể tạo đơn hàng do có lỗi dịch vụ: ${serviceMatchingErrors.join('; ')}`);
      return;
    }

    const isValidOwnerId = targetStoreOwnerId && storeProfiles.some(p => p.ownerId === targetStoreOwnerId);
    if (!isValidOwnerId) {
      setProcessingError("Lỗi: Cửa hàng được AI chọn không hợp lệ hoặc không được cung cấp. Vui lòng yêu cầu AI chọn lại một cửa hàng từ danh sách.");
      return;
    }

    let finalCustomerForOrder = customerFromAI;

    const isTrulyNewCustomer = customerFromAI.id.startsWith('temp-') || 
                              !globalCustomers.some(gc => gc.phone === customerFromAI.phone);

    if (isTrulyNewCustomer) {
      finalCustomerForOrder = { ...customerFromAI, id: uuidv4() };
      addCustomerToContext(finalCustomerForOrder);
    } else {
      const existingGlobalCustomer = globalCustomers.find(gc => gc.phone === customerFromAI.phone);
      if (existingGlobalCustomer) {
        finalCustomerForOrder = {
          ...existingGlobalCustomer, 
          name: customerFromAI.name || existingGlobalCustomer.name, 
          address: customerFromAI.address || existingGlobalCustomer.address || '', 
        };
      }
    }

    const receivedAtBaseModal = orderDetailsFromAI.pickupTime && !isNaN(new Date(orderDetailsFromAI.pickupTime).getTime()) 
        ? new Date(orderDetailsFromAI.pickupTime) 
        : new Date();

    const itemsMaxCustomerReturnTimeHoursModal = Math.max(0, ...confirmedItems.map(item => item.serviceItem.customerReturnTimeHours));
    const calculatedEstCompletionTimeBasedOnServicesModal = new Date(receivedAtBaseModal.getTime() + itemsMaxCustomerReturnTimeHoursModal * 60 * 60 * 1000);

    const finalEstimatedCompletionTimeModal = orderDetailsFromAI.deliveryTime && !isNaN(new Date(orderDetailsFromAI.deliveryTime).getTime())
        ? new Date(orderDetailsFromAI.deliveryTime)
        : (itemsMaxCustomerReturnTimeHoursModal > 0 ? calculatedEstCompletionTimeBasedOnServicesModal : undefined);


    const newOrderId = `AI-${uuidv4().slice(0, 6).toUpperCase()}`;
    const newOrderPayload: Order = { 
      id: newOrderId,
      customer: finalCustomerForOrder, 
      items: confirmedItems,
      status: OrderStatus.PENDING, 
      createdAt: new Date(),
      receivedAt: receivedAtBaseModal,
      estimatedCompletionTime: finalEstimatedCompletionTimeModal,
      totalAmount: totalAmount,
      notes: `${orderDetailsFromAI.orderNotes || ''} \nPickup: ${orderDetailsFromAI.pickupAddress || 'N/A'} at ${orderDetailsFromAI.pickupTime || 'N/A'}. \nDelivery: ${orderDetailsFromAI.deliveryAddress || 'N/A'} at ${orderDetailsFromAI.deliveryTime || 'N/A'}`.trim(),
      qrCodePaymentUrl: `https://api.vietqr.io/image/ACB-99998888-z5NqV5g.png?amount=${totalAmount}&addInfo=${newOrderId.replace("AI-","")}&accountName=TIEM%20GIAT%20LA%20AI`,
      scanHistory: [{ timestamp: new Date(), action: 'Đơn hàng tạo bởi Trợ Lý AI, chờ xác nhận/thanh toán', scannedBy: UserRole.CUSTOMER }],
      ownerId: targetStoreOwnerId, 
    };
    
    onConfirm(newOrderPayload); 
    setFinalOrderForQR(newOrderPayload); 
    setShowPaymentQR(true);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 dark:bg-slate-900/80 flex items-center justify-center p-4 z-[100] animate-fadeIn">
      <Card title="Xác nhận Đơn hàng & Thanh toán" className="w-full max-w-lg bg-bg-surface shadow-xl relative"
        actions={!showPaymentQR && <Button variant="ghost" onClick={onClose} className="absolute top-3 right-3 p-2"><XIcon size={20}/></Button>}
      >
        {showPaymentQR && finalOrderForQR ? (
          <div className="text-center">
            <CheckCircleIcon className="w-16 h-16 text-status-success mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-text-heading mb-2">Đã gửi yêu cầu tạo đơn hàng!</h3>
            <p className="text-text-body mb-1">Mã đơn hàng của bạn: <strong className="text-brand-primary">{finalOrderForQR.id}</strong></p>
            <p className="text-text-body mb-1">Cửa hàng xử lý: <strong className="text-brand-primary">{storeProfiles.find(p=>p.ownerId === finalOrderForQR.ownerId)?.storeName || 'Không rõ'}</strong></p>
            <p className="text-text-body mb-3">Tổng tiền: <strong className="text-brand-primary">{finalOrderForQR.totalAmount.toLocaleString('vi-VN')} VNĐ</strong></p>
            {finalOrderForQR.qrCodePaymentUrl && (
              <>
                <p className="text-sm text-text-muted mb-2">Quét mã VietQR dưới đây để thanh toán (nếu có):</p>
                <QRCodeDisplay value={finalOrderForQR.qrCodePaymentUrl} size={160} />
              </>
            )}
            <Button onClick={onClose} className="mt-6 w-full">Đóng</Button>
          </div>
        ) : (
          <>
            {processingError && (
              <div className="p-3 mb-4 bg-status-danger-bg text-status-danger-text rounded-md text-sm border border-status-danger flex items-center">
                <AlertTriangleIcon size={18} className="mr-2"/> {processingError}
              </div>
            )}
            {serviceMatchingErrors.length > 0 && !processingError && (
               <div className="p-3 mb-4 bg-status-warning-bg text-status-warning-text rounded-md text-sm border border-status-warning">
                <h4 className="font-semibold flex items-center"><AlertTriangleIcon size={16} className="mr-1.5"/>Một số dịch vụ AI chọn có thể không khớp:</h4>
                <ul className="list-disc pl-5 mt-1">
                    {serviceMatchingErrors.map((err,idx) => <li key={idx}>{err}</li>)}
                </ul>
                <p className="mt-1">Đơn hàng sẽ được tạo với các dịch vụ hệ thống tìm thấy. Vui lòng kiểm tra kỹ.</p>
              </div>
            )}

            <div className="space-y-3 text-sm mb-5 max-h-[50vh] overflow-y-auto pr-2">
              <h4 className="font-semibold text-text-heading flex items-center"><UserIcon size={16} className="mr-1.5 text-brand-primary"/>Khách hàng:</h4>
              <p><strong className="text-text-muted">Tên:</strong> {customerFromAI.name || 'Chưa có'}</p>
              <p><strong className="text-text-muted">SĐT:</strong> {customerFromAI.phone}</p>
              <p><strong className="text-text-muted">Địa chỉ đã cung cấp cho AI:</strong> {orderDetailsFromAI.customer?.address || customerFromAI.address || 'Chưa có'}</p>
              
              <h4 className="font-semibold text-text-heading mt-3 flex items-center"><ShoppingCartIcon size={16} className="mr-1.5 text-brand-primary"/>Dịch vụ:</h4>
              {confirmedItems.length > 0 ? confirmedItems.map((item, index) => (
                <div key={index} className="p-2 border-b border-border-base last:border-b-0">
                  <p><strong className="text-text-body">{item.serviceItem.name}</strong> (x{item.quantity}) - {item.serviceItem.washMethod}</p>
                  {item.notes && <p className="text-xs text-text-muted italic">Ghi chú: {item.notes}</p>}
                </div>
              )) : <p className="text-text-muted italic">Không có dịch vụ nào được chọn.</p>}

              <h4 className="font-semibold text-text-heading mt-3 flex items-center"><TruckIcon size={16} className="mr-1.5 text-brand-primary"/>Giao nhận:</h4>
              <p><strong className="text-text-muted">Lấy tại:</strong> {orderDetailsFromAI.pickupAddress || 'Chưa có'} - <strong className="text-text-muted">Lúc:</strong> {orderDetailsFromAI.pickupTime || 'Chưa có'}</p>
              <p><strong className="text-text-muted">Giao tại:</strong> {orderDetailsFromAI.deliveryAddress || 'Chưa có'} - <strong className="text-text-muted">Lúc:</strong> {orderDetailsFromAI.deliveryTime || 'Chưa có'}</p>
              
              {orderDetailsFromAI.orderNotes && (
                <>
                  <h4 className="font-semibold text-text-heading mt-3 flex items-center"><InfoIcon size={16} className="mr-1.5 text-brand-primary"/>Ghi chú Đơn hàng:</h4>
                  <p className="whitespace-pre-wrap">{orderDetailsFromAI.orderNotes}</p>
                </>
              )}
            </div>
            
            <div className="p-3 bg-sky-50 dark:bg-sky-800/30 rounded-lg border border-sky-200 dark:border-sky-700 mb-5">
              <p className="text-md font-semibold text-text-heading dark:text-sky-200 flex items-center justify-between">
                <span><DollarSignIcon size={18} className="inline mr-1.5 text-brand-primary"/>Tổng tiền dự kiến:</span>
                <span className="text-xl text-brand-primary dark:text-sky-300">{totalAmount.toLocaleString('vi-VN')} VNĐ</span>
              </p>
            </div>

            <div className="flex justify-end space-x-3">
              <Button variant="secondary" onClick={onClose}>Hủy bỏ / Chỉnh sửa với AI</Button>
              <Button variant="primary" onClick={handleConfirmAndPay} disabled={!!processingError || serviceMatchingErrors.some(err => err.includes("Không tìm thấy dịch vụ"))}>
                Xác nhận & Tạo Đơn
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
};