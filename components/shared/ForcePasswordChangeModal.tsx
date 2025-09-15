import React, { useState, FormEvent } from 'react';
import { User } from '../../types';
import { useData } from '../../contexts/DataContext';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { KeyIcon, AlertTriangleIcon } from 'lucide-react';
import { APP_NAME } from '../../constants';

interface ForcePasswordChangeModalProps {
  user: User;
  onSuccess: () => void;
}

export const ForcePasswordChangeModal: React.FC<ForcePasswordChangeModalProps> = ({ user, onSuccess }) => {
  const { updateUser, addNotification } = useData();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!newPassword || !confirmPassword) {
      setError('Vui lòng nhập đầy đủ mật khẩu mới.');
      return;
    }

    if (newPassword.length < 6) {
      setError('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Mật khẩu mới không khớp.');
      return;
    }
    
    if (newPassword === '123123') {
        setError('Vui lòng chọn mật khẩu khác với mật khẩu mặc định.');
        return;
    }

    setIsLoading(true);

    const updatedUser = { ...user, password: newPassword };
    const success = await updateUser(updatedUser);

    setIsLoading(false);

    if (success) {
      addNotification({ message: 'Đổi mật khẩu thành công. Chào mừng bạn!', type: 'success', showToast: true });
      onSuccess();
    } else {
      setError('Đã xảy ra lỗi. Vui lòng thử lại.');
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={() => {}} // Cannot be closed
      title="Đổi mật khẩu lần đầu"
      size="md"
    >
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <p className="text-sm text-text-body">
            Chào mừng bạn đến với {APP_NAME}! Vì đây là lần đăng nhập đầu tiên, vui lòng đổi mật khẩu để bảo vệ tài khoản.
          </p>
          {error && (
            <div className="bg-status-danger-bg border border-status-danger text-status-danger-text px-3 py-2 rounded-md text-sm flex items-center">
              <AlertTriangleIcon size={18} className="mr-2"/>{error}
            </div>
          )}
          <Input
            label="Mật khẩu mới"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            leftIcon={<KeyIcon />}
            required
            autoComplete="new-password"
          />
          <Input
            label="Xác nhận mật khẩu mới"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            leftIcon={<KeyIcon />}
            required
            autoComplete="new-password"
          />
        </div>
        <div className="mt-6 flex justify-end space-x-3 border-t border-border-base pt-4">
          <Button type="submit" variant="primary" disabled={isLoading}>
            {isLoading ? 'Đang lưu...' : 'Lưu và Đăng nhập'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
