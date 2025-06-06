
import React, { useState, useMemo, ChangeEvent } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { Customer } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { PlusCircleIcon, EditIcon, SearchIcon, User, Phone, MapPin, Settings } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

const CustomerManagementPage: React.FC = () => {
  const { customers, addCustomer, updateCustomer } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentCustomer, setCurrentCustomer] = useState<Partial<Customer> | null>(null);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');

  const filteredCustomers = useMemo(() => {
    return customers.filter(customer =>
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phone.includes(searchTerm)
    ).sort((a,b) => a.name.localeCompare(b.name));
  }, [customers, searchTerm]);

  const openModal = (mode: 'add' | 'edit', customer: Partial<Customer> | null = null) => {
    setModalMode(mode);
    setCurrentCustomer(mode === 'add' ? { name: '', phone: '', address: '' } : { ...customer });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setCurrentCustomer(null);
  };

  const handleSave = () => {
    if (!currentCustomer || !currentCustomer.name || !currentCustomer.phone) {
      // TODO: Show error in UI instead of alert
      alert('Tên và số điện thoại là bắt buộc.');
      return;
    }
    if (modalMode === 'add') {
      addCustomer({ ...currentCustomer, id: uuidv4() } as Customer);
    } else if (currentCustomer.id) {
      updateCustomer(currentCustomer as Customer);
    }
    closeModal();
  };
  
  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if(currentCustomer) {
        setCurrentCustomer({ ...currentCustomer, [e.target.name]: e.target.value });
    }
  };

  const tableHeaders = [
    { label: "Tên", icon: <User size={14}/> },
    { label: "SĐT", icon: <Phone size={14}/> },
    { label: "Địa chỉ", icon: <MapPin size={14}/> },
    { label: "Hành động", icon: <Settings size={14}/> }
  ];

  return (
    <Card 
      title="Quản lý Khách hàng"
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

      {isModalOpen && currentCustomer && (
        <div className="fixed inset-0 bg-black/70 dark:bg-slate-900/80 flex items-center justify-center p-4 z-50 transition-opacity duration-300 animate-fadeIn">
          <Card 
            title={modalMode === 'add' ? 'Thêm Khách hàng mới' : 'Sửa thông tin Khách hàng'} 
            className="w-full max-w-lg bg-bg-surface shadow-xl !border-border-base"
            headerClassName="!border-b !border-border-base"
          >
            <div className="space-y-4 pt-2">
              <Input label="Tên Khách hàng*" name="name" value={currentCustomer.name || ''} onChange={handleInputChange} />
              <Input label="Số điện thoại*" name="phone" value={currentCustomer.phone || ''} onChange={handleInputChange} />
              <Input label="Địa chỉ" name="address" value={currentCustomer.address || ''} onChange={handleInputChange} />
            </div>
            <div className="mt-6 flex justify-end space-x-3 border-t border-border-base pt-4">
              <Button variant="secondary" onClick={closeModal}>Hủy</Button>
              <Button variant="primary" onClick={handleSave}>Lưu</Button>
            </div>
          </Card>
        </div>
      )}
    </Card>
  );
};

export default CustomerManagementPage;
