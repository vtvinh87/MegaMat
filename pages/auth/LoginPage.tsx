
import React, { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { LogInIcon, UserIcon, KeyIcon, AlertTriangleIcon } from 'lucide-react';
import { APP_NAME } from '../../constants';

const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // FIX: The login function now returns the user object on success or null on failure.
    // We check for a truthy value to confirm a successful login.
    const loggedInUser = await login(username, password);
    if (loggedInUser) {
      navigate('/admin/dashboard');
    } else {
      setError('Tên đăng nhập hoặc mật khẩu không chính xác.');
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-[calc(100vh-150px)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <Card
            className="shadow-2xl border-t-4 border-brand-primary"
            contentClassName="!p-8 sm:!p-10"
        >
          <div className="text-center">
            <img
                src="https://raw.githubusercontent.com/vtvinh87/MegaMat/refs/heads/main/pictures/megamat-logo.png"
                alt={`${APP_NAME} Logo`}
                className="mx-auto h-16 w-auto mb-4 rounded-lg object-contain"
            />
            <h2 className="text-3xl font-extrabold text-text-heading">
              Đăng nhập hệ thống
            </h2>
            <p className="mt-2 text-sm text-text-muted">
              Truy cập vào tài khoản quản trị của bạn.
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
              id="username"
              name="username"
              type="text"
              label="Tên đăng nhập"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Nhập tên đăng nhập"
              leftIcon={<UserIcon className="text-text-muted" />}
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
              placeholder="Nhập mật khẩu"
              leftIcon={<KeyIcon className="text-text-muted" />}
            />
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
            Quay lại <Link to="/" className="font-medium text-text-link hover:text-brand-primary-hover">Trang chủ Khách hàng</Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
