
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '../../contexts/DataContext';
import { MaterialOrder, MaterialOrderItemDetail } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ArrowLeftIcon, ShoppingCart, CalendarDays, UserCircle, CheckCircle, XCircle, MessageSquare, DollarSign, InfoIcon, ListChecks, FileText, HashIcon, SigmaIcon, Edit3Icon } from 'lucide-react';

const MaterialOrderDetailPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { materialOrders, addNotification } = useData();
  const [order, setOrder] = useState<MaterialOrder | null>(null);

  useEffect(() => {
    if (orderId) {
      const foundOrder = materialOrders.find(o => o.id === orderId);
      if (foundOrder) {
        setOrder(foundOrder);
      } else {
        addNotification({ message: `Không tìm thấy đơn đặt nguyên vật liệu với ID: ${orderId}`, type: 'error' });
        navigate('/admin/material-orders');
      }
    }
  }, [orderId, materialOrders, navigate, addNotification]);

  if (!order) {
    return (
      <Card title="Đang tải...">
        <p className="text-center text-text-muted py-10">Đang tìm thông tin đơn đặt nguyên vật liệu...</p>
      </Card>
    );
  }

  const getStatusInfo = (status: MaterialOrder['status']): { textColor: string, bgColor: string, borderColor: string, text: string, icon: React.ReactNode } => {
    switch (status) {
      case 'Chờ duyệt':
        return { textColor: 'text-status-warning-text', bgColor: 'bg-status-warning-bg', borderColor: 'border-status-warning', text: 'Chờ duyệt', icon: <InfoIcon size={14} className="mr-1.5" /> };
      case 'Đã duyệt':
        return { textColor: 'text-status-success-text', bgColor: 'bg-status-success-bg', borderColor: 'border-status-success', text: 'Đã duyệt', icon: <CheckCircle size={14} className="mr-1.5" /> };
      case 'Đã hủy':
        return { textColor: 'text-status-danger-text', bgColor: 'bg-status-danger-bg', borderColor: 'border-status-danger', text: 'Đã hủy', icon: <XCircle size={14} className="mr-1.5" /> };
      default:
        return { textColor: 'text-text-muted', bgColor: 'bg-bg-subtle', borderColor: 'border-border-base', text: status, icon: <InfoIcon size={14} className="mr-1.5" /> };
    }
  };

  const statusStyle = getStatusInfo(order.status);

  const DetailItem: React.FC<{ label: string; children: React.ReactNode; className?: string; dtClassName?: string; ddClassName?: string }> =
    ({ label, children, className = '', dtClassName = '', ddClassName = '' }) => (
      <div className={`py-3 sm:grid sm:grid-cols-3 sm:gap-4 items-center ${className}`}>
        <dt className={`text-sm font-medium text-text-muted ${dtClassName}`}>{label}</dt>
        <dd className={`mt-1 text-sm text-text-body sm:mt-0 sm:col-span-2 ${ddClassName}`}>{children}</dd>
      </div>
    );
  
  const itemTableHeaders = [
    { label: "STT", icon: <HashIcon size={14} /> },
    { label: "Tên Nguyên vật liệu", icon: <FileText size={14} /> },
    { label: "Đơn vị", icon: <ListChecks size={14} /> },
    { label: "Số lượng", icon: <SigmaIcon size={14} /> },
    { label: "Đơn giá", icon: <DollarSign size={14} /> },
    { label: "Thành tiền", icon: <DollarSign size={14} /> },
    { label: "Ghi chú mục", icon: <Edit3Icon size={14} /> }
  ];


  return (
    <div className="space-y-6">
      <Button variant="link" onClick={() => navigate('/admin/material-orders')} className="text-text-link hover:text-brand-primary-hover mb-0 pl-0 -mt-2">
        <ArrowLeftIcon size={18} className="mr-1.5" /> Quay lại danh sách
      </Button>

      <Card title={`Chi tiết Đơn đặt NVL: ${order.id}`} titleClassName="!text-2xl !font-bold">
        <dl className="divide-y divide-border-base">
          <DetailItem label="Mã Đơn đặt NVL:">{order.id}</DetailItem>
          <DetailItem label="Ngày tạo:">{new Date(order.createdAt).toLocaleString('vi-VN', { dateStyle: 'long', timeStyle: 'short' })}</DetailItem>
          <DetailItem label="Người tạo:">{order.createdBy}</DetailItem>
          <DetailItem label="Trạng thái:">
            <span className={`font-semibold px-2.5 py-1 rounded-full text-xs inline-flex items-center ${statusStyle.bgColor} ${statusStyle.textColor} border ${statusStyle.borderColor}`}>
              {statusStyle.icon}{statusStyle.text}
            </span>
          </DetailItem>
          {order.approvedBy && <DetailItem label={order.status === 'Đã hủy' ? "Người hủy:" : "Người duyệt:"}>{order.approvedBy}</DetailItem>}
          <DetailItem label="Tổng tiền:" ddClassName="!text-xl !font-semibold text-brand-primary">
            {order.totalAmount.toLocaleString('vi-VN')} VNĐ
          </DetailItem>
          <DetailItem label="Ghi chú chung:">
            {order.notes ? <span className="whitespace-pre-wrap">{order.notes}</span> : <span className="italic text-text-muted">Không có ghi chú</span>}
          </DetailItem>
        </dl>
      </Card>

      <Card>
        <h3 className="text-lg font-semibold text-text-heading mb-4 flex items-center">
          <ShoppingCart size={20} className="mr-2 text-brand-primary" /> Danh mục Nguyên vật liệu Đặt
        </h3>
        {order.items.length === 0 ? (
          <p className="text-center text-text-muted py-6">Đơn đặt này không có mục nguyên vật liệu nào.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border-base">
            <table className="min-w-full divide-y divide-border-base">
              <thead className="bg-bg-subtle/50">
                <tr>
                  {itemTableHeaders.map(header => (
                     <th key={header.label} className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">
                        <div className="flex items-center">
                          {React.cloneElement(header.icon as React.ReactElement<{ className?: string }>, {className: "mr-1.5 flex-shrink-0"})}
                          <span>{header.label}</span>
                        </div>
                     </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-bg-surface divide-y divide-border-base">
                {order.items.map((item, index) => (
                  <tr key={item.id} className="hover:bg-bg-surface-hover transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-text-body">{index + 1}</td>
                    <td className="px-4 py-3 text-sm text-text-body">{item.nameSnapshot}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-text-body">{item.unitSnapshot}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-text-body text-right">{item.quantity}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-text-body text-right">{item.unitPriceSnapshot.toLocaleString('vi-VN')} VNĐ</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-text-body text-right">{(item.quantity * item.unitPriceSnapshot).toLocaleString('vi-VN')} VNĐ</td>
                    <td className="px-4 py-3 text-sm text-text-muted max-w-xs truncate" title={item.itemNotes}>
                      {item.itemNotes || <span className="italic">Không có</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default MaterialOrderDetailPage;
