import React, { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { LogInIcon, PhoneIcon, KeyIcon, AlertTriangleIcon } from 'lucide-react';
import { APP_NAME } from '../../constants';
import { User, UserRole } from '../../types';
import { simpleHash } from '../../contexts/app/utils';
import { ForcePasswordChangeModal } from '../../components/shared/ForcePasswordChangeModal';

const CustomerLoginPage: React.FC = () => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const [userToForceChange, setUserToForceChange] = useState<User | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const loggedInUser = await login(phone, password);

    if (loggedInUser && loggedInUser.role === UserRole.CUSTOMER) {
      const defaultPasswordHash = await simpleHash('123123');
      if (loggedInUser.password === defaultPasswordHash) {
        // First time login with default password, force change
        setUserToForceChange(loggedInUser);
      } else {
        navigate('/portal/dashboard');
      }
    } else {
      setError('Số điện thoại hoặc mật khẩu không chính xác.');
    }
    setIsLoading(false);
  };

  return (
    <>
      <div className="min-h-[calc(100vh-150px)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <Card
              className="shadow-2xl border-t-4 border-brand-primary"
              contentClassName="!p-8 sm:!p-10"
          >
            <div className="text-center">
              <img
                  src="pictures/megamat-logo.png"
                  alt={`${APP_NAME} Logo`}
                  className="mx-auto h-16 w-auto mb-4 rounded-lg object-contain"
              />
              <h2 className="text-3xl font-extrabold text-text-heading">
                Cổng thông tin Khách hàng
              </h2>
              <p className="mt-2 text-sm text-text-muted">
                Đăng nhập để xem lịch sử đơn hàng và quản lý tài khoản.
              </p>
            </div>

            {error && (
              <div className="mt-4 bg-status-danger-bg border border-status-danger text-status-danger-text px-4 py-3 rounded-md text-sm flex items-center">
                <AlertTriangleIcon size={20} className="mr-2"/>
                {error}
              </div>
            )}

            <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
              <Input
                id="phone"
                name="phone"
                type="tel"
                label="Số điện thoại"
                autoComplete="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Nhập SĐT đã đăng ký"
                leftIcon={<PhoneIcon className="text-text-muted" />}
              />
              <Input
                id="password"
                name="password"
                type="password"
                label="Mật khẩu"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mật khẩu của bạn"
                leftIcon={<KeyIcon className="text-text-muted" />}
              />
              <p className="text-xs text-text-muted text-center">Lưu ý: Nếu đây là lần đầu đăng nhập, mật khẩu mặc định của bạn là <strong className="font-mono">123123</strong>.</p>
              <div>
                <Button
                  type="submit"
                  variant="primary"
                  className="w-full group py-3"
                  disabled={isLoading}
                  leftIcon={isLoading ? undefined : <LogInIcon size={20} className="group-hover:translate-x-1 transition-transform"/>}
                >
                  {isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
                </Button>
              </div>
            </form>
          </Card>
          <p className="mt-6 text-center text-sm text-text-muted">
              Quay lại <Link to="/" className="font-medium text-text-link hover:text-brand-primary-hover">Trang chủ</Link>
          </p>
        </div>
      </div>
      {userToForceChange && (
          <ForcePasswordChangeModal 
              user={userToForceChange}
              onSuccess={() => {
                  setUserToForceChange(null);
                  navigate('/portal/dashboard');
              }}
          />
      )}
    </>
  );
};

export default CustomerLoginPage;
