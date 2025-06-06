
import React, { useState, useMemo, ChangeEvent } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { InventoryItem } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { PlusCircleIcon, EditIcon, SearchIcon, AlertTriangleIcon, Archive, Hash, CheckSquare, Sliders, Tag } from 'lucide-react';
// Removed uuidv4 import as context will handle ID generation

const InventoryManagementPage: React.FC = () => {
  const { inventory, addInventoryItem, updateInventoryItem } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState<Partial<InventoryItem> | null>(null);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');

  const filteredInventory = useMemo(() => {
    return inventory.filter(item =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.unit.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a,b) => a.name.localeCompare(b.name));
  }, [inventory, searchTerm]);

  const openModal = (mode: 'add' | 'edit', item: Partial<InventoryItem> | null = null) => {
    setModalMode(mode);
    setCurrentItem(mode === 'add' ? { name: '', quantity: 0, unit: '', lowStockThreshold: 5 } : { ...item });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setCurrentItem(null);
  };

  const handleSave = () => {
    if (!currentItem || !currentItem.name || !currentItem.unit || currentItem.quantity === undefined || currentItem.lowStockThreshold === undefined) {
      alert('Tên, đơn vị tính, số lượng, và ngưỡng báo tồn là bắt buộc.');
      return;
    }
    
    if (modalMode === 'add') {
      const newItemPayload: Omit<InventoryItem, 'id' | 'ownerId'> = {
        name: currentItem.name!,
        quantity: Number(currentItem.quantity) || 0,
        unit: currentItem.unit!,
        lowStockThreshold: Number(currentItem.lowStockThreshold) || 0,
      };
      addInventoryItem(newItemPayload);
    } else if (currentItem.id) {
      // Ensure all necessary fields are present for an update
      const itemToUpdate: InventoryItem = {
        id: currentItem.id!,
        ownerId: currentItem.ownerId!, // ownerId must be present for update
        name: currentItem.name!,
        quantity: Number(currentItem.quantity) || 0,
        unit: currentItem.unit!,
        lowStockThreshold: Number(currentItem.lowStockThreshold) || 0,
      };
      updateInventoryItem(itemToUpdate);
    }
    closeModal();
  };
  
  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if(currentItem) {
        const { name, value, type } = e.target;
        setCurrentItem({ ...currentItem, [name]: type === 'number' ? parseFloat(value) : value });
    }
  };
  
  const tableHeaders = [
    { label: "Tên vật tư", icon: <Archive size={14}/> },
    { label: "Số lượng", icon: <Hash size={14}/> },
    { label: "Đơn vị", icon: <Tag size={14}/> }, 
    { label: "Ngưỡng báo tồn", icon: <Sliders size={14}/> },
    { label: "Trạng thái", icon: <CheckSquare size={14}/> },
    { label: "Hành động", icon: <EditIcon size={14}/> }
  ];

  return (
    <Card 
      title="Quản lý Tồn kho"
      actions={
        <Button variant="primary" onClick={() => openModal('add')} leftIcon={<PlusCircleIcon size={18}/>}>Thêm vật tư</Button>
      }
    >
      <Input 
        placeholder="Tìm kiếm vật tư..."
        value={searchTerm}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
        className="mb-6"
        leftIcon={<SearchIcon />}
      />

      {filteredInventory.length === 0 ? (
        <p className="text-center text-text-muted py-10">Chưa có vật tư nào trong kho.</p>
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
              {filteredInventory.map(item => (
                <tr key={item.id} className={`${item.quantity <= item.lowStockThreshold ? 'bg-status-warning-bg/50 dark:bg-amber-800/30' : ''} hover:bg-bg-surface-hover dark:hover:bg-slate-700/60 transition-colors`}>
                  <td className="px-5 py-4 whitespace-nowrap text-sm font-medium text-text-heading">{item.name}</td>
                  <td className="px-5 py-4 whitespace-nowrap text-sm text-text-body">{item.quantity}</td>
                  <td className="px-5 py-4 whitespace-nowrap text-sm text-text-body">{item.unit}</td>
                  <td className="px-5 py-4 whitespace-nowrap text-sm text-text-body">{item.lowStockThreshold}</td>
                  <td className="px-5 py-4 whitespace-nowrap text-sm">
                    {item.quantity <= item.lowStockThreshold ? 
                      <span className="text-status-warning-text dark:text-amber-300 font-semibold flex items-center">
                        <AlertTriangleIcon size={16} className="mr-1.5"/>Sắp hết
                      </span> : 
                      <span className="text-status-success-text dark:text-emerald-300">Còn hàng</span>
                    }
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap text-sm font-medium">
                    <Button variant="ghost" size="sm" onClick={() => openModal('edit', item)} title="Sửa" className="text-text-link hover:text-brand-primary p-1.5">
                      <EditIcon size={18}/>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen && currentItem && (
        <div className="fixed inset-0 bg-black/70 dark:bg-slate-900/80 flex items-center justify-center p-4 z-50 transition-opacity duration-300 animate-fadeIn">
          <Card 
            title={modalMode === 'add' ? 'Thêm Vật tư mới' : 'Sửa thông tin Vật tư'} 
            className="w-full max-w-lg bg-bg-surface shadow-xl !border-border-base"
            headerClassName="!border-b !border-border-base"
          >
            <div className="space-y-4 pt-2">
              <Input label="Tên vật tư*" name="name" value={currentItem.name || ''} onChange={handleInputChange} />
              <Input label="Số lượng*" name="quantity" type="number" min="0" value={currentItem.quantity === undefined ? '' : currentItem.quantity} onChange={handleInputChange} />
              <Input label="Đơn vị tính*" name="unit" value={currentItem.unit || ''} onChange={handleInputChange} />
              <Input label="Ngưỡng báo tồn*" name="lowStockThreshold" type="number" min="0" value={currentItem.lowStockThreshold === undefined ? '' : currentItem.lowStockThreshold} onChange={handleInputChange} />
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

export default InventoryManagementPage;
    