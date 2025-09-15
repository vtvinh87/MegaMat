

import React, { useState, ChangeEvent, FormEvent, useEffect, useMemo } from 'react';
import { useData } from '../../../contexts/DataContext';
import { useAuth } from '../../../contexts/AuthContext';
import { Order, OrderStatus, User, UserRole } from '../../../types';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { QRCodeDisplay } from '../../../components/shared/QRCodeDisplay';
import { SearchIcon, PackageIcon, UserIcon, ClockIcon, CheckCircleIcon, ZapIcon, MapPinIcon, InfoIcon, XIcon, PackageCheckIcon, DollarSignIcon, ListIcon, CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon, StarIcon, MessageCircleIcon } from 'lucide-react';

const ITEMS_PER_PAGE = 5;

interface OrderLookupTabProps {
  isStaffServingModeActive: boolean;
  customerForNewOrder: User | null;
  setCustomerForNewOrder: (customer: User | null) => void;
  // FIX: Added missing prop `identifiedPublicCustomer` to the interface.
  identifiedPublicCustomer: User | null;
  openRatingModal: (orderId: string, customerUserId: string) => void;
}

export const OrderLookupTab: React.FC<OrderLookupTabProps> = ({
  isStaffServingModeActive,
  customerForNewOrder,
  setCustomerForNewOrder,
  identifiedPublicCustomer,
  openRatingModal,
}) => {
  const { orders: allOrders, findOrder: findOrderById, users } = useData();
  const { currentUser } = useAuth(); // A customer might be logged in
  
  const [lookupSearchTerm, setLookupSearchTerm] = useState('');
  const [lookupDate, setLookupDate] = useState('');
  const [detailedOrder, setDetailedOrder] = useState<Order | null>(null);
  const [orderList, setOrderList] = useState<Order[]>([]);
  const [displayedOrders, setDisplayedOrders] = useState<Order[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);

  const handleLookupSearch = (e: FormEvent) => {
    e.preventDefault();
    setDetailedOrder(null); setOrderList([]); setDisplayedOrders([]); setCurrentPage(1); setSearchError(null); setSearchMessage(null);

    let effectiveSearchTermForLogic = lookupSearchTerm.trim();
    let searchInitiatedByActiveCustomer = false;

    if (!effectiveSearchTermForLogic && identifiedPublicCustomer) {
      effectiveSearchTermForLogic = identifiedPublicCustomer.phone;
      searchInitiatedByActiveCustomer = true;
    } else if (!effectiveSearchTermForLogic && currentUser && currentUser.role === UserRole.CUSTOMER) {
      effectiveSearchTermForLogic = currentUser.phone;
      searchInitiatedByActiveCustomer = true; 
    } else if (!effectiveSearchTermForLogic && isStaffServingModeActive && customerForNewOrder) {
      effectiveSearchTermForLogic = customerForNewOrder.phone;
      searchInitiatedByActiveCustomer = true;
    } else if (!effectiveSearchTermForLogic) {
      setSearchError('Vui lòng nhập Mã ĐH hoặc SĐT.');
      return;
    }
    
    const searchTermNormalized = effectiveSearchTermForLogic.toUpperCase();

    if (searchTermNormalized.startsWith('DH-') || searchTermNormalized.startsWith('CUS-REQ-') || searchTermNormalized.startsWith('AI-')) {
      const order = findOrderById(effectiveSearchTermForLogic);
      if (order) {
        setDetailedOrder(order);
        if (isStaffServingModeActive) setCustomerForNewOrder(order.customer);
        setSearchMessage(`Kết quả cho Mã ĐH "${effectiveSearchTermForLogic}".`);
      } else {
        setSearchError(`Không tìm thấy đơn hàng với mã: ${effectiveSearchTermForLogic}.`);
      }
    } else { 
      const ordersByPhoneBase = allOrders.filter(o => o.customer.phone === effectiveSearchTermForLogic);
      
      if (ordersByPhoneBase.length === 0) {
        setSearchError(`Không tìm thấy đơn hàng nào cho SĐT "${effectiveSearchTermForLogic}".`);
        setOrderList([]);
        if (isStaffServingModeActive) {
          const foundUser = users.find(u => u.role === UserRole.CUSTOMER && u.phone === effectiveSearchTermForLogic);
          setCustomerForNewOrder(foundUser || null);
        }
        return;
      }
      
      if (isStaffServingModeActive) setCustomerForNewOrder(ordersByPhoneBase[0].customer);

      let ordersAfterDateFilter = ordersByPhoneBase;
      let dateFilterInfo = "";
      if (lookupDate && /^\d{4}-\d{2}-\d{2}$/.test(lookupDate)) {
        const [year, month, day] = lookupDate.split('-').map(Number);
        const targetDateStart = new Date(year, month - 1, day, 0, 0, 0, 0);
        const targetDateEnd = new Date(year, month - 1, day, 23, 59, 59, 999);
        dateFilterInfo = ` tạo ngày ${day}/${month}/${year}`;
        ordersAfterDateFilter = ordersByPhoneBase.filter(o => {
          const orderDate = new Date(o.createdAt);
          return orderDate >= targetDateStart && orderDate <= targetDateEnd;
        });
      }
      
      if (ordersAfterDateFilter.length === 0) {
          setSearchError(`Không tìm thấy đơn hàng nào cho SĐT "${effectiveSearchTermForLogic}"${dateFilterInfo}.`);
          setOrderList([]);
          return;
      }

      const finalResultsToDisplay = ordersAfterDateFilter.sort((a, b) => {
        const aIsReturned = a.status === OrderStatus.RETURNED;
        const bIsReturned = b.status === OrderStatus.RETURNED;
        if (aIsReturned && !bIsReturned) return 1; 
        if (!aIsReturned && bIsReturned) return -1; 
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); 
      });
      
      const baseSearchSubject = searchInitiatedByActiveCustomer 
          ? `cho SĐT (${effectiveSearchTermForLogic})`
          : `cho SĐT "${effectiveSearchTermForLogic}"`;

      setSearchMessage(`Tìm thấy ${finalResultsToDisplay.length} đơn hàng ${baseSearchSubject}${dateFilterInfo}. Sắp xếp ưu tiên đơn chưa trả.`);
      
      setOrderList(finalResultsToDisplay);
      setTotalPages(Math.ceil(finalResultsToDisplay.length / ITEMS_PER_PAGE));
    }
  };

  useEffect(() => {
    if (orderList.length > 0) {
      const start = (currentPage - 1) * ITEMS_PER_PAGE;
      setDisplayedOrders(orderList.slice(start, start + ITEMS_PER_PAGE));
    } else {
      setDisplayedOrders([]);
    }
  }, [orderList, currentPage]);

  const handleViewDetails = (order: Order) => {
    setDetailedOrder(order);
    if (isStaffServingModeActive) {
      setCustomerForNewOrder(order.customer);
    }
  };

  const handleBackToList = () => {
    setDetailedOrder(null);
  };

  const paginate = (page: number) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  const getStatusInfo = (status: OrderStatus): { textColor: string; bgColor: string; borderColor: string; text: string; icon?: React.ReactNode } => {
    switch (status) {
      case OrderStatus.WAITING_FOR_CONFIRMATION: return { textColor: 'text-purple-800', bgColor: 'bg-purple-100', borderColor: 'border-purple-400', text: OrderStatus.WAITING_FOR_CONFIRMATION, icon: <MessageCircleIcon size={14} className="mr-1.5" /> };
      case OrderStatus.PENDING: return { textColor: 'text-status-warning-text', bgColor: 'bg-status-warning-bg', borderColor: 'border-yellow-400', text: OrderStatus.PENDING, icon: <ClockIcon size={14} className="mr-1.5" /> };
      case OrderStatus.PROCESSING: return { textColor: 'text-status-info-text', bgColor: 'bg-status-info-bg', borderColor: 'border-blue-400', text: OrderStatus.PROCESSING, icon: <ZapIcon size={14} className="mr-1.5" /> };
      case OrderStatus.COMPLETED: return { textColor: 'text-status-success-text', bgColor: 'bg-status-success-bg', borderColor: 'border-green-400', text: OrderStatus.COMPLETED, icon: <CheckCircleIcon size={14} className="mr-1.5" /> };
      case OrderStatus.CANCELLED: return { textColor: 'text-status-danger-text', bgColor: 'bg-status-danger-bg', borderColor: 'border-red-400', text: OrderStatus.CANCELLED, icon: <XIcon size={14} className="mr-1.5" /> };
      case OrderStatus.RETURNED: return { textColor: 'text-text-on-primary', bgColor: 'bg-brand-primary', borderColor: 'border-brand-primary-focus', text: OrderStatus.RETURNED, icon: <PackageCheckIcon size={14} className="mr-1.5" /> };
      default: return { textColor: 'text-text-muted', bgColor: 'bg-bg-subtle', borderColor: 'border-border-base', text: status, icon: <InfoIcon size={14} className="mr-1.5" /> };
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

  const DetailItem: React.FC<{ label: string; children: React.ReactNode; dtCls?: string; ddCls?: string; }> =
    ({ label, children, dtCls = '', ddCls = '' }) => (
      <div className="flex justify-between py-1.5">
        <dt className={`text-sm font-medium text-text-muted ${dtCls}`}>{label}</dt>
        <dd className={`text-sm text-text-body text-right ${ddCls}`}>{children}</dd>
      </div>
    );

  const lookupInputPlaceholder = useMemo(() => {
    if (isStaffServingModeActive && customerForNewOrder) {
      return `Tra cứu cho SĐT đang phục vụ (${customerForNewOrder.phone}) hoặc nhập SĐT/Mã ĐH khác`;
    }
    if (currentUser && currentUser.role === UserRole.CUSTOMER) {
      return `Tra cứu cho SĐT của bạn (${currentUser.phone}) hoặc nhập Mã ĐH khác`;
    }
    if (identifiedPublicCustomer) {
      return `Tra cứu cho SĐT đã xác nhận (${identifiedPublicCustomer.phone}) hoặc nhập Mã ĐH khác`;
    }
    return "VD: DH-12345 hoặc 090xxxxxxx";
  }, [isStaffServingModeActive, customerForNewOrder, currentUser, identifiedPublicCustomer]);

  return (
    <Card title="Tra cứu Thông tin Đơn hàng" icon={<SearchIcon className="text-brand-primary" size={20} />}>
      <form onSubmit={handleLookupSearch} className="space-y-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            wrapperClassName="md:col-span-2"
            label="Nhập Mã đơn hàng hoặc SĐT của bạn"
            value={lookupSearchTerm}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setLookupSearchTerm(e.target.value)}
            placeholder={lookupInputPlaceholder}
            leftIcon={<PackageIcon />}
          />
          <Input
            label="Ngày tạo đơn (tùy chọn)"
            type="date"
            value={lookupDate}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setLookupDate(e.target.value)}
            leftIcon={<CalendarDaysIcon />}
          />
        </div>
        <Button type="submit" variant="primary" className="w-full md:w-auto" leftIcon={<SearchIcon size={18} />}>
          Tìm kiếm
        </Button>
      </form>

      {searchError && <p className="text-center text-status-danger bg-status-danger-bg p-3 rounded-md">{searchError}</p>}
      {searchMessage && !searchError && <p className="text-center text-status-info bg-status-info-bg p-3 rounded-md">{searchMessage}</p>}

      {detailedOrder ? (
        <Card className="mt-6 bg-bg-subtle">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-semibold text-text-heading">Chi tiết Đơn hàng: {detailedOrder.id}</h3>
            <Button variant="ghost" onClick={handleBackToList} size="sm" leftIcon={<ListIcon size={16} />}>Xem danh sách</Button>
          </div>
          <dl className="divide-y divide-border-base">
            <DetailItem label="Khách hàng:">
              <span className="flex items-center justify-end"> <UserIcon size={14} className="mr-1.5 text-text-muted" /> {detailedOrder.customer.name} ({detailedOrder.customer.phone})</span>
            </DetailItem>
            <DetailItem label="Trạng thái:">
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold inline-flex items-center ${getStatusInfo(detailedOrder.status).bgColor} ${getStatusInfo(detailedOrder.status).textColor} border ${getStatusInfo(detailedOrder.status).borderColor}`}>
                {getStatusInfo(detailedOrder.status).icon}
                {getStatusInfo(detailedOrder.status).text}
              </span>
            </DetailItem>
            <DetailItem label="Ngày tạo:">
              <span className="flex items-center justify-end"><CalendarDaysIcon size={14} className="mr-1.5 text-text-muted" /> {new Date(detailedOrder.createdAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}</span>
            </DetailItem>
            <DetailItem label="Tổng tiền:">
              <span className="font-bold text-brand-primary flex items-center justify-end"><DollarSignIcon size={14} className="mr-1" /> {detailedOrder.totalAmount.toLocaleString('vi-VN')} VNĐ</span>
            </DetailItem>
            {detailedOrder.pickupLocation && (
              <DetailItem label="Vị trí để đồ:">
                <span className="flex items-center justify-end"><MapPinIcon size={14} className="mr-1.5 text-text-muted" /> {detailedOrder.pickupLocation}</span>
              </DetailItem>
            )}
            {(detailedOrder.status === OrderStatus.PROCESSING || detailedOrder.status === OrderStatus.PENDING) && detailedOrder.estimatedCompletionTime && (
              <DetailItem label={detailedOrder.status === OrderStatus.PENDING ? "Dự kiến trả:" : "Dự kiến xong trong:"}>
                <span className="flex items-center justify-end text-status-info-text">
                  <ClockIcon size={14} className="mr-1.5" />
                  {detailedOrder.status === OrderStatus.PENDING
                    ? new Date(detailedOrder.estimatedCompletionTime).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
                    : getRemainingTime(detailedOrder.estimatedCompletionTime)}
                </span>
              </DetailItem>
            )}
            {detailedOrder.notes && (
              <DetailItem label="Ghi chú đơn hàng:" dtCls="self-start pt-1.5" ddCls="whitespace-pre-wrap text-left sm:text-right">
                {detailedOrder.notes}
              </DetailItem>
            )}
            {detailedOrder.qrCodePaymentUrl && (
              <div className="py-3 text-center">
                <p className="text-sm text-text-muted mb-1">Mã QR thanh toán:</p>
                <QRCodeDisplay value={detailedOrder.qrCodePaymentUrl} size={100} />
              </div>
            )}
          </dl>
          <div className="mt-4 border-t border-border-base pt-4">
            <h4 className="text-md font-semibold text-text-heading mb-2">Các dịch vụ:</h4>
            <ul className="space-y-1 text-sm">
              {detailedOrder.items.map((item, index) => (
                <li key={index} className="flex justify-between p-1.5 bg-bg-base rounded">
                  <span>{item.serviceItem.name} (x{item.quantity})</span>
                  <span>{(item.serviceItem.price * item.quantity).toLocaleString('vi-VN')} VNĐ</span>
                </li>
              ))}
            </ul>
          </div>
          {detailedOrder.status === OrderStatus.RETURNED && (
            <div className="mt-5 text-center">
              <Button onClick={() => openRatingModal(detailedOrder.id, detailedOrder.customer.id)} variant="primary" leftIcon={<StarIcon size={18} />}>
                Đánh giá & Tip
              </Button>
            </div>
          )}
        </Card>
      ) : orderList.length > 0 ? (
        <div className="mt-6">
          <div className="grid grid-cols-1 gap-4">
            {displayedOrders.map(order => (
              <Card key={order.id} className="hover:shadow-lg transition-shadow duration-200">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2">
                  <h3 className="text-md font-semibold text-text-link hover:underline">
                    <a href="#" onClick={(e) => { e.preventDefault(); handleViewDetails(order); }}>{order.id}</a>
                  </h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold inline-flex items-center ${getStatusInfo(order.status).bgColor} ${getStatusInfo(order.status).textColor} border ${getStatusInfo(order.status).borderColor}`}>
                    {getStatusInfo(order.status).icon}
                    {getStatusInfo(order.status).text}
                  </span>
                </div>
                <div className="text-sm text-text-muted space-y-1">
                  <p className="flex items-center"><UserIcon size={14} className="mr-1.5" />{order.customer.name} ({order.customer.phone})</p>
                  <p className="flex items-center"><CalendarDaysIcon size={14} className="mr-1.5" />Ngày tạo: {new Date(order.createdAt).toLocaleDateString('vi-VN')}</p>
                  <p className="flex items-center"><DollarSignIcon size={14} className="mr-1.5" />Tổng tiền: {order.totalAmount.toLocaleString('vi-VN')} VNĐ</p>
                  {order.status === OrderStatus.PENDING && order.estimatedCompletionTime && (
                    <p className="flex items-center"><ClockIcon size={14} className="mr-1.5 text-status-info-text" />Dự kiến trả: {new Date(order.estimatedCompletionTime).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}</p>
                  )}
                </div>
                <div className="mt-3 text-right">
                  <Button variant="ghost" size="sm" onClick={() => handleViewDetails(order)} leftIcon={<ListIcon size={16} />}>Xem chi tiết</Button>
                </div>
              </Card>
            ))}
          </div>
          {totalPages > 1 && (
            <div className="mt-6 flex justify-center items-center space-x-2">
              <Button onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1} variant="secondary" size="sm"><ChevronLeftIcon size={16} /></Button>
              <span className="text-sm text-text-muted">Trang {currentPage} / {totalPages}</span>
              <Button onClick={() => paginate(currentPage + 1)} disabled={currentPage === totalPages} variant="secondary" size="sm"><ChevronRightIcon size={16} /></Button>
            </div>
          )}
        </div>
      ) : null}
    </Card>
  );
};