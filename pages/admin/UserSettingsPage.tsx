


import React, { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { User } from '../../types';
import { UserCogIcon, SaveIcon, KeyIcon, AlertTriangleIcon, User as UserIcon, Building } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

const UserSettingsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { updateUser, addNotification } = useData();

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name);
      // FIX: Property 'address' does not exist on type 'User'. Did you mean 'addresses'?
      setAddress(currentUser.addresses?.[0]?.street || '');
      setAvatarPreview(currentUser.avatarUrl || null);
    }
  }, [currentUser]);

  const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAvatarFile(file);
      const base64 = await fileToBase64(file);
      setAvatarPreview(base64);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!currentUser) return;

    if (newPassword && newPassword !== confirmPassword) {
      setError('Mật khẩu mới không khớp.');
      return;
    }
    if (newPassword && newPassword.length < 6) {
      setError('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }

    setIsSaving(true);

    let avatarUrlToSave = currentUser.avatarUrl;
    if (avatarFile) {
      avatarUrlToSave = await fileToBase64(avatarFile);
    }
    
    // Xây dựng một đối tượng chỉ chứa các trường dữ liệu đã thay đổi.
    // Điều này đảm bảo chúng ta không gửi lại mật khẩu cũ đã được mã hóa.
    const updatePayload: Partial<User> & { id: string } = {
      id: currentUser.id,
      name: name,
      avatarUrl: avatarUrlToSave,
    };
    
    // FIX: Object literal may only specify known properties, but 'address' does not exist in type 'Partial<User> & { id: string; }'. Did you mean to write 'addresses'?
    const updatedAddresses = currentUser.addresses ? JSON.parse(JSON.stringify(currentUser.addresses)) : [];
    if (updatedAddresses.length > 0) {
        updatedAddresses[0].street = address || '';
    } else if (address) {
        updatedAddresses.push({ id: uuidv4(), label: 'Mặc định', street: address, isDefault: true });
    }

    if (address || updatedAddresses.length > 0) {
        updatePayload.addresses = updatedAddresses;
    }
    // Chỉ thêm mật khẩu vào đối tượng cập nhật nếu người dùng đã nhập mật khẩu mới.
    if (newPassword) {
      updatePayload.password = newPassword;
    }

    const success = await updateUser(updatePayload);
    setIsSaving(false);

    if (success) {
      addNotification({ message: 'Cập nhật thông tin thành công!', type: 'success', showToast: true });
      setNewPassword('');
      setConfirmPassword('');
    } else {
      setError('Có lỗi xảy ra, không thể cập nhật thông tin.');
    }
  };

  if (!currentUser) {
    return <Card title="Lỗi">Bạn cần đăng nhập để truy cập trang này.</Card>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card title="Cài đặt Tài khoản" icon={<UserCogIcon size={24} className="text-brand-primary" />}>
        <form onSubmit={handleSubmit} className="space-y-8">
          {error && <p className="text-sm text-status-danger bg-status-danger-bg p-3 rounded-md flex items-center"><AlertTriangleIcon size={16} className="mr-2"/>{error}</p>}
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            <div className="md:col-span-1 flex flex-col items-center">
              <img 
                src={avatarPreview || `https://placehold.co/150x150/E2E8F0/475569/png?text=${currentUser.name.charAt(0)}`}
                alt="Avatar"
                className="w-32 h-32 rounded-full object-cover mb-4 border-2 border-border-base"
              />
              <input type="file" id="avatarUpload" className="hidden" onChange={handleAvatarChange} accept="image/*" />
              <label htmlFor="avatarUpload" className="cursor-pointer bg-bg-subtle text-text-body hover:bg-slate-200 focus:ring-slate-400 border border-border-input font-semibold rounded-lg px-4 py-2 text-sm">
                Thay đổi ảnh
              </label>
            </div>
            
            <div className="md:col-span-2 space-y-4">
              <Card title="Thông tin Cá nhân" icon={<UserIcon size={18} />} className="!shadow-none bg-bg-subtle/50">
                <div className="space-y-4">
                    <Input label="Tên hiển thị*" value={name} onChange={e => setName(e.target.value)} required />
                    <Input label="Tên đăng nhập" value={currentUser.username} disabled />
                    <Input label="Vai trò" value={currentUser.role} disabled />
                    <Input label="Địa chỉ" value={address} onChange={e => setAddress(e.target.value)} />
                </div>
              </Card>
              
              <Card title="Đổi Mật khẩu" icon={<KeyIcon size={18} />} className="!shadow-none bg-bg-subtle/50">
                 <div className="space-y-4">
                    <Input label="Mật khẩu mới" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Để trống nếu không đổi" />
                    <Input label="Xác nhận mật khẩu mới" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                 </div>
              </Card>
            </div>
          </div>
          
          <div className="flex justify-end pt-5 border-t border-border-base">
            <Button type="submit" size="lg" leftIcon={<SaveIcon size={20} />} disabled={isSaving}>
              {isSaving ? 'Đang lưu...' : 'Lưu Thay đổi'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default UserSettingsPage;
