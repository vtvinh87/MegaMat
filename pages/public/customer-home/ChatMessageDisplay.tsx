import React from 'react';
import { ChatMessage, OrderSummaryForAI, OrderStatus } from '../../../types';
import { PackageIcon, CalendarDaysIcon, DollarSignIcon, ClockIcon, ZapIcon, CheckCircleIcon, XIcon, PackageCheckIcon, InfoIcon } from 'lucide-react';

const getStatusInfo = (status: OrderStatus): { text: string; icon?: React.ReactNode; className: string } => {
    switch (status) {
      case OrderStatus.PENDING: return { text: OrderStatus.PENDING, icon: <ClockIcon size={14} />, className: 'text-amber-800 bg-amber-100 dark:text-amber-100 dark:bg-amber-800/40' };
      case OrderStatus.PROCESSING: return { text: OrderStatus.PROCESSING, icon: <ZapIcon size={14} />, className: 'text-blue-800 bg-blue-100 dark:text-blue-100 dark:bg-blue-800/40' };
      case OrderStatus.COMPLETED: return { text: OrderStatus.COMPLETED, icon: <CheckCircleIcon size={14} />, className: 'text-green-800 bg-green-100 dark:text-green-100 dark:bg-green-800/40' };
      case OrderStatus.CANCELLED: return { text: OrderStatus.CANCELLED, icon: <XIcon size={14} />, className: 'text-red-800 bg-red-100 dark:text-red-100 dark:bg-red-800/40' };
      case OrderStatus.RETURNED: return { text: OrderStatus.RETURNED, icon: <PackageCheckIcon size={14} />, className: 'text-white bg-brand-primary' };
      default: return { text: status, icon: <InfoIcon size={14} />, className: 'text-gray-800 bg-gray-100 dark:text-gray-100 dark:bg-gray-600' };
    }
};

const OrderSummaryCard: React.FC<{ order: OrderSummaryForAI }> = ({ order }) => {
    const statusInfo = getStatusInfo(order.status);
    return (
        <div className="mt-2 p-3 border-t border-gray-500/30">
            <h4 className="font-semibold text-base mb-1 flex items-center justify-between">
              <span>Đơn hàng: {order.id}</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${statusInfo.className}`}>{statusInfo.icon && <span className="mr-1.5">{statusInfo.icon}</span>}{statusInfo.text}</span>
            </h4>
            <div className="space-y-1 text-sm">
                <p className="flex items-center"><CalendarDaysIcon size={14} className="mr-2 opacity-70" /> {new Date(order.createdAt).toLocaleString('vi-VN')}</p>
                <p className="flex items-center font-bold"><DollarSignIcon size={14} className="mr-2 opacity-70" /> {order.totalAmount.toLocaleString('vi-VN')} VNĐ</p>
                <div>
                    <p className="font-medium mt-1">Dịch vụ:</p>
                    <ul className="list-disc list-inside pl-2 text-xs opacity-90">
                        {order.items.map((item, index) => (
                            <li key={index}>{item.name} (x{item.quantity})</li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
};


export const ChatMessageDisplay: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const isUser = message.sender === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`max-w-[85%] sm:max-w-[70%] p-3 rounded-lg shadow ${
          isUser 
            ? 'bg-brand-primary text-text-on-primary rounded-br-none' 
            : 'bg-bg-surface dark:bg-slate-700 text-text-body dark:text-slate-100 rounded-bl-none border border-border-base'
        }`}
      >
        <p className="text-sm whitespace-pre-wrap">{message.text}</p>
        {message.structuredContent?.type === 'orderSummary' && (
          <div className="space-y-2">
            {message.structuredContent.orders.map(order => (
              <OrderSummaryCard key={order.id} order={order} />
            ))}
          </div>
        )}
        <p className={`text-xs mt-1 text-right ${isUser ? 'text-sky-200' : 'text-text-muted'}`}>
          {new Date(message.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
};