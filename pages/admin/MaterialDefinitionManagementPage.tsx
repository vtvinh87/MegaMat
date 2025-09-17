import React, { useState, useMemo, ChangeEvent, FormEvent } from 'react';
import { useData } from '../../contexts/DataContext';
import { MaterialItemDefinition, Supplier } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { PlusCircleIcon, EditIcon, Trash2Icon, SearchIcon, BookUser, Tag, DollarSign, Settings, ShoppingBagIcon } from 'lucide-react';

const MaterialDefinitionManagementPage: React.FC = () => {
  const { 
    materialItemDefinitions, 
    addMaterialItemDefinition, 
    updateMaterialItemDefinition, 
    deleteMaterialItemDefinition,
    suppliers
  } = useData();

  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentDefinition, setCurrentDefinition] = useState<Partial<MaterialItemDefinition> | null>(null);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');

  const filteredDefinitions = useMemo(() => {
    return materialItemDefinitions.filter(def =>
      def.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      def.unit.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => a.name.localeCompare(b.name));
  }, [materialItemDefinitions, searchTerm]);
  
  const supplierOptions = useMemo(() => {
    return [
        { value: '', label: '-- Không chọn --' },
        ...suppliers
            .filter(s => s.type === 'Nguyên vật liệu')
            .map(s => ({ value: s.id, label: s.name }))
    ];
  }, [suppliers]);

  const openModal = (mode: 'add' | 'edit', definition: Partial<MaterialItemDefinition> | null = null) => {
    setModalMode(mode);
    setCurrentDefinition(mode === 'add' ? { name: '', unit: '', price: 0, notes: '' } : { ...definition });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setCurrentDefinition(null);
  };

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    if (!currentDefinition || !currentDefinition.name?.trim() || !currentDefinition.unit?.trim() || currentDefinition.price === undefined) {
      alert('Tên, Đơn vị tính và Đơn giá là bắt buộc.');
      return;
    }
    if (currentDefinition.price < 0) {
      alert('Đơn giá không thể là số âm.');
      return;
    }

    const definitionData = {
      name: currentDefinition.name,
      unit: currentDefinition.unit,
      price: Number(currentDefinition.price),
      supplierId: currentDefinition.supplierId || undefined,
      notes: currentDefinition.notes || undefined,
    };

    if (modalMode === 'add') {
      addMaterialItemDefinition(definitionData);
    } else if (currentDefinition.id) {
      updateMaterialItemDefinition({ ...currentDefinition, ...definitionData } as MaterialItemDefinition);
    }
    closeModal();
  };
  
  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if(currentDefinition) {
        const { name, value, type } = e.target;
        const finalValue = type === 'number' ? (value === '' ? '' : parseFloat(value)) : value;
        setCurrentDefinition({ ...currentDefinition, [name]: finalValue });
    }
  };

  const handleDelete = (definitionId: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa danh mục NVL này?')) {
      deleteMaterialItemDefinition(definitionId);
    }
  };

  const tableHeaders = [
    { label: "Tên NVL", icon: <BookUser size={14}/> },
    { label: "Đơn vị tính", icon: <Tag size={14}/> },
    { label: "Đơn giá (VNĐ)", icon: <DollarSign size={14}/> },
    { label: "NCC Mặc định", icon: <ShoppingBagIcon size={14}/> },
    { label: "Hành động", icon: <Settings size={14}/> }
  ];

  return (
    <>
      <Card 
        title="Quản lý Danh mục Nguyên vật liệu"
        actions={
          <Button variant="primary" onClick={() => openModal('add')} leftIcon={<PlusCircleIcon size={18}/>}>Thêm NVL Mới</Button>
        }
      >
        <Input 
          placeholder="Tìm kiếm NVL theo tên, đơn vị tính..."
          value={searchTerm}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
          className="mb-6"
          leftIcon={<SearchIcon />}
        />

        {filteredDefinitions.length === 0 ? (
          <p className="text-center text-text-muted py-10">Chưa có danh mục nguyên vật liệu nào.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border-base">
            <table className="min-w-full divide-y divide-border-base">
              <thead className="bg-bg-subtle/50">
                <tr>
                  {tableHeaders.map(header => (
                    <th key={header.label} className="px-5 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">
                      <div className="flex items-center">
                        {header.icon}
                        <span className="ml-1.5">{header.label}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-bg-surface divide-y divide-border-base">
                {filteredDefinitions.map(def => (
                  <tr key={def.id} className="hover:bg-bg-surface-hover transition-colors">
                    <td className="px-5 py-4 whitespace-nowrap text-sm font-medium text-text-heading">{def.name}</td>
                    <td className="px-5 py-4 whitespace-nowrap text-sm text-text-body">{def.unit}</td>
                    <td className="px-5 py-4 whitespace-nowrap text-sm text-text-body text-right">{def.price.toLocaleString('vi-VN')}</td>
                    <td className="px-5 py-4 whitespace-nowrap text-sm text-text-body">{suppliers.find(s => s.id === def.supplierId)?.name || '-'}</td>
                    <td className="px-5 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-1">
                        <Button variant="ghost" size="sm" onClick={() => openModal('edit', def)} title="Sửa" className="text-text-link hover:text-brand-primary p-1.5">
                          <EditIcon size={18}/>
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(def.id)} title="Xóa" className="text-status-danger hover:text-rose-600 p-1.5">
                          <Trash2Icon size={18}/>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {isModalOpen && currentDefinition && (
        <Modal
          isOpen={isModalOpen}
          onClose={closeModal}
          title={modalMode === 'add' ? 'Thêm Danh mục NVL' : 'Sửa Danh mục NVL'}
          size="lg"
        >
          <form onSubmit={handleSave} className="space-y-4 pt-2">
            <Input label="Tên Nguyên vật liệu*" name="name" value={currentDefinition.name || ''} onChange={handleInputChange} required />
            <Input label="Đơn vị tính*" name="unit" value={currentDefinition.unit || ''} onChange={handleInputChange} placeholder="VD: Chai, Lít, Kg, Cuộn..." required />
            <Input label="Đơn giá tham khảo (VNĐ)*" name="price" type="number" min="0" value={currentDefinition.price?.toString() || ''} onChange={handleInputChange} required />
            <Select
                label="Nhà cung cấp mặc định (tùy chọn)"
                name="supplierId"
                options={supplierOptions}
                value={currentDefinition.supplierId || ''}
                onChange={handleInputChange}
            />
            <Input isTextArea rows={2} label="Ghi chú (tùy chọn)" name="notes" value={currentDefinition.notes || ''} onChange={(e) => handleInputChange(e as any)} />
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

export default MaterialDefinitionManagementPage;