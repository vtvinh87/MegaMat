
import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { Order, OrderStatus, ScanHistoryEntry, UserRole } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ArrowLeftIcon, Package, User, CalendarDays, Trash2Icon, MessageSquareIcon, UserCogIcon, AlertTriangle } from 'lucide-react';

const DeletedOrdersHistoryPage: React.FC = () => {
  const { orders } = useData();
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const deletedOrders = useMemo(() => {
    return orders
      .filter(order => order.status === OrderStatus.DELETED_BY_ADMIN)
      .map(order => {
        const deletionEntry = order.scanHistory?.slice().reverse().find(entry => entry.action === 'Đơn hàng đã bị xóa');
        return {
          ...order,
          deletedAt: deletionEntry?.timestamp,
          deletedBy: deletionEntry?.scannedBy,
          deletionReason: deletionEntry?.reason,
        };
      })
      .sort((a, b) => (b.deletedAt?.getTime() || 0) - (a.deletedAt?.getTime() || 0));
  }, [orders]);

  // Ensure only Owner can access this page
  if (currentUser?.role !== UserRole.OWNER) {
    return (
      <Card title="Không có quyền truy cập">
        <div className="text-center py-10">
          <AlertTriangle size={48} className="mx-auto text-status-danger mb-4" />
          <p className="text-text-muted text-lg">Bạn không có quyền xem trang này.</p>
          <Button onClick={() => navigate('/admin/dashboard')} className="mt-6">
            Về Bảng điều khiển
          </Button>
        </div>
      </Card>
    );
  }

  const tableHeaders = [
    { label: "Mã ĐH", icon: <Package size={14} /> },
    { label: "Khách hàng", icon: <User size={14} /> },
    { label: "Ngày Xóa", icon: <CalendarDays size={14} /> },
    { label: "Người Xóa", icon: <UserCogIcon size={14} /> },
    { label: "Lý do Xóa", icon: <MessageSquareIcon size={14} /> },
  ];

  return (
    <div className="space-y-6">
        <Button variant="link" onClick={() => navigate('/admin/orders')} className="text-text-link hover:text-brand-primary-hover mb-0 pl-0 -mt-2">
            <ArrowLeftIcon size={18} className="mr-1.5"/> Quay lại Danh sách Đơn hàng
        </Button>
        <Card title="Lịch sử Xóa Đơn hàng">
        {deletedOrders.length === 0 ? (
            <p className="text-center text-text-muted py-10">Không có đơn hàng nào trong lịch sử xóa.</p>
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
                {deletedOrders.map(order => (
                    <tr key={order.id} className="hover:bg-bg-surface-hover dark:hover:bg-slate-700/60 transition-colors">
                    <td className="px-5 py-4 whitespace-nowrap text-sm font-medium text-text-body">
                        {order.id}
                         <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-status-danger-bg text-status-danger-text dark:text-rose-200 dark:bg-rose-700/50">Đã xóa</span>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-sm text-text-body">
                        {order.customer.name} <span className="text-text-muted">({order.customer.phone})</span>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-sm text-text-body">
                        {order.deletedAt ? new Date(order.deletedAt).toLocaleString('vi-VN', {dateStyle:'short', timeStyle:'short'}) : 'N/A'}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-sm text-text-body">
                        {order.deletedBy || 'N/A'}
                    </td>
                    <td className="px-5 py-4 text-sm text-text-body min-w-[200px] max-w-md whitespace-pre-wrap">
                        {order.deletionReason || <span className="italic text-text-muted">Không có lý do</span>}
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

export default DeletedOrdersHistoryPage;
