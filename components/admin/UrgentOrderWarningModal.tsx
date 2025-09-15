import React, { useState, useMemo } from 'react';
import { Order } from '../../types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { AlertTriangleIcon, ZapIcon, EditIcon } from 'lucide-react';

interface UrgentOrderWarningModalProps {
  isOpen: boolean;
  order: Order;
  onProcessNow: () => void;
  onPostpone: (reason: string) => void;
}

export const UrgentOrderWarningModal: React.FC<UrgentOrderWarningModalProps> = ({
  isOpen,
  order,
  onProcessNow,
  onPostpone,
}) => {
  const [showReasonInput, setShowReasonInput] = useState(false);
  const [reason, setReason] = useState('');

  if (!isOpen) return null;

  const handleConfirmPostpone = () => {
    if (!reason.trim()) {
      alert('Vui lòng nhập lý do.');
      return;
    }
    onPostpone(reason);
  };

  const deadlineInfo = useMemo(() => {
    // The most relevant deadline is the customer-facing one.
    const estCompletionTime = order.estimatedCompletionTime || new Date(new Date(order.receivedAt || Date.now()).getTime() + Math.max(...order.items.map(i => i.serviceItem.customerReturnTimeHours)) * 3600 * 1000);
    if (!estCompletionTime) return "Không có thông tin";
    
    return new Date(estCompletionTime).toLocaleString('vi-VN', {
      dateStyle: 'short',
      timeStyle: 'short'
    });
  }, [order]);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[60] transition-opacity duration-300 animate-fadeIn">
      <Card
        title="Cảnh báo: Đơn hàng sắp đến hạn"
        icon={<AlertTriangleIcon size={24} className="text-status-warning" />}
        className="w-full max-w-lg bg-bg-surface shadow-xl !border-status-warning border-2"
      >
        <p className="text-text-body mb-2">
          Đơn hàng <strong className="text-text-heading">{order.id}</strong> cho khách hàng <strong className="text-text-heading">{order.customer.name}</strong> sắp đến hạn trả nhưng vẫn ở trạng thái "Chưa xử lý".
        </p>
        <p className="text-sm text-text-muted mb-4">
          Dự kiến trả: <strong className="text-text-heading">{deadlineInfo}</strong>.
        </p>

        {!showReasonInput ? (
          <div className="mt-6 flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3">
            <Button variant="secondary" onClick={() => setShowReasonInput(true)} leftIcon={<EditIcon size={16} />}>
              Chưa xử lý (Yêu cầu lý do)
            </Button>
            <Button variant="primary" onClick={onProcessNow} leftIcon={<ZapIcon size={16} />}>
              Xử lý ngay
            </Button>
          </div>
        ) : (
          <div className="mt-4 pt-4 border-t border-border-base">
            <Input
              isTextArea
              label="Lý do chưa xử lý đơn hàng*"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="VD: Chờ khách xác nhận, quá tải,..."
              rows={3}
              required
            />
            <div className="mt-4 flex justify-end space-x-3">
              <Button variant="secondary" onClick={() => setShowReasonInput(false)}>
                Quay lại
              </Button>
              <Button variant="primary" onClick={handleConfirmPostpone} disabled={!reason.trim()}>
                Xác nhận lý do
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
