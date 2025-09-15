
import React, { useState, useMemo, ChangeEvent, FormEvent } from 'react';
import { useData } from '../../contexts/DataContext';
import { Supplier } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { PlusCircleIcon, EditIcon, SearchIcon, Briefcase, Phone, Mail, Settings, Tag } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

const SUPPLIER_TYPES: Array<Supplier['type']> = ['Đối tác giặt khô', 'Nguyên vật liệu', 'Bảo trì'];

const SupplierManagementPage: React.FC = () => {
  const { suppliers, addSupplier, updateSupplier } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentSupplier, setCurrentSupplier] = useState<Partial<Supplier> | null>(null);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(supplier =>
      supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.phone.includes(searchTerm) ||
      supplier.type.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a,b) => a.name.localeCompare(b.name));
  }, [suppliers, searchTerm]);

  const openModal = (mode: 'add' | 'edit', supplier: Partial<Supplier> | null = null) => {
    setModalMode(mode);
    setCurrentSupplier(mode === 'add' ? { name: '', phone: '', type: SUPPLIER_TYPES[0] } : { ...supplier });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setCurrentSupplier(null);
  };

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    if (!currentSupplier || !currentSupplier.name || !currentSupplier.phone || !currentSupplier.type) {
      alert('Tên, SĐT và Loại nhà cung cấp là bắt buộc.');
      return;
    }
    if (modalMode === 'add') {
      addSupplier({ ...currentSupplier, id: uuidv4() } as Supplier);
    } else if (currentSupplier.id) {
      updateSupplier(currentSupplier as Supplier);
    }
    closeModal();
  };
  
  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if(currentSupplier) {
        setCurrentSupplier({ ...currentSupplier, [e.target.name]: e.target.value as Supplier['type'] | string });
    }
  };
  
  const tableHeaders = [
    { label: "Tên NCC", icon: <Briefcase size={14}/> },
    { label: "Loại", icon: <Tag size={14}/> },
    { label: "SĐT", icon: <Phone size={14}/> },
    { label: "Email", icon: <Mail size={14}/> },
    { label: "Hành động", icon: <Settings size={14}/> }
  ];

  return (
    <>
      <Card 
        title="Quản lý Nhà cung cấp"
        actions={
          <Button variant="primary" onClick={() => openModal('add')} leftIcon={<PlusCircleIcon size={18}/>}>Thêm NCC</Button>
        }
      >
        <Input 
          placeholder="Tìm kiếm nhà cung cấp..."
          value={searchTerm}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
          className="mb-6"
          leftIcon={<SearchIcon />}
        />

        {filteredSuppliers.length === 0 ? (
          <p className="text-center text-text-muted py-10">Không có nhà cung cấp nào.</p>
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
                {filteredSuppliers.map(supplier => (
                  <tr key={supplier.id} className="hover:bg-bg-surface-hover dark:hover:bg-slate-700/60 transition-colors">
                    <td className="px-5 py-4 whitespace-nowrap text-sm font-medium text-text-heading">{supplier.name}</td>
                    <td className="px-5 py-4 whitespace-nowrap text-sm text-text-body">{supplier.type}</td>
                    <td className="px-5 py-4 whitespace-nowrap text-sm text-text-body">{supplier.phone}</td>
                    <td className="px-5 py-4 whitespace-nowrap text-sm text-text-body">{supplier.email || '-'}</td>
                    <td className="px-5 py-4 whitespace-nowrap text-sm font-medium">
                      <Button variant="ghost" size="sm" onClick={() => openModal('edit', supplier)} title="Sửa" className="text-text-link hover:text-brand-primary p-1.5">
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

      {isModalOpen && currentSupplier && (
        <Modal
          isOpen={isModalOpen}
          onClose={closeModal}
          title={modalMode === 'add' ? 'Thêm Nhà cung cấp' : 'Sửa thông tin NCC'}
          size="lg"
        >
          <form onSubmit={handleSave}>
            <div className="space-y-4 pt-2">
              <Input label="Tên NCC*" name="name" value={currentSupplier.name || ''} onChange={handleInputChange} />
              <Select
                label="Loại NCC*"
                name="type"
                options={SUPPLIER_TYPES.map(t => ({ value: t, label: t}))}
                value={currentSupplier.type || ''}
                onChange={handleInputChange}
              />
              <Input label="Số điện thoại*" name="phone" value={currentSupplier.phone || ''} onChange={handleInputChange} />
              <Input label="Email" name="email" type="email" value={currentSupplier.email || ''} onChange={handleInputChange} />
              <Input label="Địa chỉ" name="address" value={currentSupplier.address || ''} onChange={handleInputChange} />
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

export default SupplierManagementPage;
