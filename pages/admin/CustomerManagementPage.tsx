import React, { useState, useMemo, ChangeEvent, FormEvent } from 'react';
import { useData } from '../../contexts/DataContext';
import { User, UserRole } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { PlusCircleIcon, EditIcon, SearchIcon, User as UserIconLucide, Phone, MapPin, Settings, AwardIcon, KeyIcon } from 'lucide-react';

interface EditingCustomerState extends Partial<User> {
  password?: string;
  passwordConfirmation?: string;
}

const CustomerManagementPage: React.FC = () => {
  const { users, addUser, updateUser } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<EditingCustomerState | null>(null);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');

  const customers = useMemo(() => users.filter(u => u.role === UserRole.CUSTOMER), [users]);

  const filteredCustomers = useMemo(() => {
    return customers.filter(customer =>
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phone.includes(searchTerm)
    ).sort((a,b) => a.name.localeCompare(b.name));
  }, [customers, searchTerm]);

  const openModal = (mode: 'add' | 'edit', user: Partial<User> | null = null) => {
    setModalMode(mode);
    setCurrentUser(mode === 'add' ? { name: '', phone: '', address: '', loyaltyPoints: 0, role: UserRole.CUSTOMER, password: '', passwordConfirmation: '' } : { ...user, password: '', passwordConfirmation: '' });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setCurrentUser(null);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentUser || !currentUser.name?.trim() || !currentUser.phone?.trim()) {
      alert('Tên và số điện thoại là bắt buộc.');
      return;
    }
    
    if (currentUser.password && currentUser.password !== currentUser.passwordConfirmation) {
      alert('Mật khẩu và xác nhận mật khẩu không khớp.');
      return;
    }

    if (currentUser.password && currentUser.password.length < 6) {
      alert('Mật khẩu phải có ít nhất 6 ký tự.');
      return;
    }
    
    if (modalMode === 'add') {
      const newCustomerData: Omit<User, 'id'> = {
        name: currentUser.name.trim(),
        phone: currentUser.phone.trim(),
        username: currentUser.phone.trim(),
        role: UserRole.CUSTOMER,
        address: currentUser.address?.trim() || undefined,
        loyaltyPoints: 0,
        password: currentUser.password?.trim() || '123123',
      };
      await addUser(newCustomerData);
    } else if (currentUser.id) {
        const updatePayload: Partial<User> & { id: string } = {
            id: currentUser.id,
            name: currentUser.name.trim(),
            phone: currentUser.phone.trim(),
            username: currentUser.phone.trim(),
            address: currentUser.address?.trim() || undefined,
            loyaltyPoints: Number(currentUser.loyaltyPoints) || 0,
        };

        if (currentUser.password && currentUser.password.trim()) {
            updatePayload.password = currentUser.password;
        }

        await updateUser(updatePayload);
    }
    closeModal();
  };
  
  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if(currentUser) {
        const { name, value, type } = e.target;
        const finalValue = type === 'number' ? parseFloat(value) : value;
        setCurrentUser({ ...currentUser, [name]: finalValue });
    }
  };

  const tableHeaders = [
    { label: "Tên", icon: <UserIconLucide size={14}/> },
    { label: "SĐT / Tên ĐN", icon: <Phone size={14}/> },
    { label: "Địa chỉ", icon: <MapPin size={14}/> },
    { label: "Điểm Tích Lũy", icon: <AwardIcon size={14}/> },
    { label: "Hành động", icon: <Settings size={14}/> }
  ];

  return (
    <>
      <Card 
        title="Quản lý Khách hàng & Tài khoản"
        actions={
          <Button variant="primary" onClick={() => openModal('add')} leftIcon={<PlusCircleIcon size={18}/>}>Thêm khách hàng</Button>
        }
      >
        <Input 
          placeholder="Tìm kiếm khách hàng theo tên, SĐT..."
          value={searchTerm}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
          className="mb-6"
          leftIcon={<SearchIcon />}
        />

        {filteredCustomers.length === 0 ? (
          <p className="text-center text-text-muted py-10">Không có khách hàng nào.</p>
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
                {filteredCustomers.map(customer => (
                  <tr key={customer.id} className="hover:bg-bg-surface-hover dark:hover:bg-slate-700/60 transition-colors">
                    <td className="px-5 py-4 whitespace-nowrap text-sm font-medium text-text-heading">{customer.name}</td>
                    <td className="px-5 py-4 whitespace-nowrap text-sm text-text-body">{customer.phone}</td>
                    <td className="px-5 py-4 whitespace-nowrap text-sm text-text-body truncate max-w-xs">{customer.address || '-'}</td>
                    <td className="px-5 py-4 whitespace-nowrap text-sm text-text-body font-semibold text-center">{customer.loyaltyPoints || 0}</td>
                    <td className="px-5 py-4 whitespace-nowrap text-sm font-medium">
                      <Button variant="ghost" size="sm" onClick={() => openModal('edit', customer)} title="Sửa" className="text-text-link hover:text-brand-primary p-1.5">
                        <EditIcon size={18}/>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {isModalOpen && currentUser && (
        <Modal
          isOpen={isModalOpen}
          onClose={closeModal}
          title={modalMode === 'add' ? 'Thêm Khách hàng mới' : 'Sửa thông tin Khách hàng'}
          size="lg"
        >
          <form onSubmit={handleSave}>
            <div className="space-y-4 pt-2">
              <fieldset className="border p-3 rounded-md border-border-base">
                <legend className="text-sm font-medium px-1">Thông tin Cá nhân</legend>
                <Input label="Tên Khách hàng*" name="name" value={currentUser.name || ''} onChange={handleInputChange} required className="mt-2" />
                <Input label="Số điện thoại*" name="phone" value={currentUser.phone || ''} onChange={handleInputChange} required className="mt-2" />
                <Input label="Địa chỉ" name="address" value={currentUser.address || ''} onChange={handleInputChange} className="mt-2" />
                {modalMode === 'edit' && (
                   <Input label="Điểm tích lũy" name="loyaltyPoints" type="number" value={currentUser.loyaltyPoints || 0} onChange={handleInputChange} className="mt-2" />
                )}
              </fieldset>
               <fieldset className="border p-3 rounded-md border-border-base">
                <legend className="text-sm font-medium px-1">Thông tin Tài khoản</legend>
                <Input label="Tên đăng nhập (SĐT)" name="username" value={currentUser.phone || ''} disabled className="mt-2" />
                <Input label="Mật khẩu mới" name="password" type="password" value={currentUser.password || ''} onChange={handleInputChange} placeholder={modalMode === 'edit' ? 'Để trống nếu không đổi' : ''} className="mt-2" leftIcon={<KeyIcon size={16}/>} />
                <Input label="Xác nhận mật khẩu mới" name="passwordConfirmation" type="password" value={currentUser.passwordConfirmation || ''} onChange={handleInputChange} className="mt-2" leftIcon={<KeyIcon size={16}/>}/>
                {modalMode === 'add' && <p className="text-xs text-text-muted">Mật khẩu mặc định sẽ là '123123' nếu để trống.</p>}
               </fieldset>
            </div>
            <div className="mt-6 flex justify-end space-x-3 border-t border-border-base pt-4">
              <Button type="button" variant="secondary" onClick={closeModal}>Hủy</Button>
              <Button type="submit" variant="primary">Lưu</Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
};

export default CustomerManagementPage;