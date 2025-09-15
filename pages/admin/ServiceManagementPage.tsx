

import React, { useState, useMemo, ChangeEvent, FormEvent } from 'react';
// FIX: Replaced useAppContext with useData and useAuth
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { ServiceItem, UserRole, InventoryItem } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { PlusCircleIcon, EditIcon, Trash2Icon, SearchIcon, SparklesIcon, TagIcon, SettingsIcon, DollarSignIcon, ClockIcon, CalendarCheck2Icon, ArchiveIcon } from 'lucide-react';

const ServiceManagementPage: React.FC = () => {
  // FIX: Replaced useAppContext with useData and useAuth
  const { services, addService, updateService, deleteService, inventory, washMethods } = useData();
  const { currentUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentService, setCurrentService] = useState<Partial<ServiceItem> | null>(null);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');

  const canManageServices = currentUser && (currentUser.role === UserRole.OWNER || currentUser.role === UserRole.MANAGER);

  const washMethodOptions = useMemo(() => washMethods.map(wm => ({ value: wm.id, label: wm.name })), [washMethods]);

  const filteredServices = useMemo(() => {
    return services.filter(service => {
        const washMethod = washMethods.find(wm => wm.id === service.washMethodId);
        return service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
               washMethod?.name.toLowerCase().includes(searchTerm.toLowerCase());
    }).sort((a,b) => a.name.localeCompare(b.name));
  }, [services, searchTerm, washMethods]);
  
  const inventoryOptions = useMemo(() => 
    inventory.map(item => ({
        value: item.id,
        label: `${item.name} (${item.unit})`
    })).sort((a,b) => a.label.localeCompare(b.label)),
  [inventory]);


  const openModal = (mode: 'add' | 'edit', service: Partial<ServiceItem> | null = null) => {
    if (!canManageServices) return;
    setModalMode(mode);
    setCurrentService(mode === 'add' ? { 
      name: '', 
      unit: 'Cái', 
      washMethodId: washMethods.length > 0 ? washMethods[0].id : '', 
      price: 0, 
      minPrice: undefined, 
      estimatedTimeHours: 1,
      customerReturnTimeHours: 2,
      requiredMaterials: [],
    } : { ...service, requiredMaterials: service?.requiredMaterials?.map(m => ({...m})) || [] });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setCurrentService(null);
  };

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    if (!currentService || !currentService.name || !currentService.unit || !currentService.washMethodId || 
        currentService.price === undefined || currentService.estimatedTimeHours === undefined || currentService.customerReturnTimeHours === undefined) {
      alert('Vui lòng điền đầy đủ thông tin dịch vụ, bao gồm tên, đơn vị, phương pháp, giá và các thông số thời gian.');
      return;
    }
    if (currentService.price <= 0) {
      alert('Giá dịch vụ phải lớn hơn 0.');
      return;
    }
    if (currentService.estimatedTimeHours < 0) {
      alert('Thời gian xử lý dự kiến không thể âm.');
      return;
    }
    if (currentService.customerReturnTimeHours < 0) {
      alert('Thời gian dự kiến trả không thể âm.');
      return;
    }
    if (currentService.customerReturnTimeHours < currentService.estimatedTimeHours) {
      alert('Thời gian dự kiến trả phải lớn hơn hoặc bằng thời gian xử lý.');
      return;
    }
    if (currentService.minPrice !== undefined && currentService.minPrice < 0) {
      alert('Giá tối thiểu không thể âm.');
      return;
    }
    // Removed incorrect validation: Giá tối thiểu không được lớn hơn giá dịch vụ.
    
    const sanitizedMaterials = currentService.requiredMaterials
        ?.map(mat => ({
            ...mat,
            quantityUsedPerUnit: Number(mat.quantityUsedPerUnit) || 0,
        }))
        .filter(mat => mat.inventoryItemId && mat.quantityUsedPerUnit > 0);

    const serviceData = {
      name: currentService.name,
      unit: currentService.unit,
      washMethodId: currentService.washMethodId,
      price: Number(currentService.price),
      minPrice: currentService.minPrice !== undefined && currentService.minPrice !== null && currentService.minPrice.toString().trim() !== '' ? Number(currentService.minPrice) : undefined,
      estimatedTimeHours: Number(currentService.estimatedTimeHours),
      customerReturnTimeHours: Number(currentService.customerReturnTimeHours),
      requiredMaterials: sanitizedMaterials,
    };

    if (modalMode === 'add') {
      addService(serviceData);
    } else if (currentService.id) {
      updateService({ ...serviceData, id: currentService.id });
    }
    closeModal();
  };
  
  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if(currentService) {
      const { name, value, type } = e.target;
      const parsedValue = type === 'number' 
        ? (value === '' ? undefined : parseFloat(value)) 
        : value;
      setCurrentService({ 
        ...currentService, 
        [name]: parsedValue
      });
    }
  };

  const handleDeleteService = (serviceId: string) => {
    if (!canManageServices) return;
    if (window.confirm('Bạn có chắc chắn muốn xóa dịch vụ này? Hành động này không thể hoàn tác.')) {
      deleteService(serviceId);
    }
  };
  
  const handleMaterialChange = (index: number, field: 'inventoryItemId' | 'quantityUsedPerUnit', value: string | number) => {
      if (!currentService || !currentService.requiredMaterials) return;
      const newMaterials = [...currentService.requiredMaterials];
      const updatedMaterial = { ...newMaterials[index], [field]: value };
      newMaterials[index] = updatedMaterial;
      setCurrentService({ ...currentService, requiredMaterials: newMaterials });
  };

  const handleAddMaterial = () => {
      if (!currentService) return;
      const defaultInventoryItem = inventoryOptions.length > 0 ? inventoryOptions[0].value : '';
      const newMaterial = { inventoryItemId: defaultInventoryItem, quantityUsedPerUnit: 0.1 };
      const updatedMaterials = [...(currentService.requiredMaterials || []), newMaterial];
      setCurrentService({ ...currentService, requiredMaterials: updatedMaterials });
  };
  
  const handleRemoveMaterial = (index: number) => {
      if (!currentService || !currentService.requiredMaterials) return;
      const updatedMaterials = currentService.requiredMaterials.filter((_, i) => i !== index);
      setCurrentService({ ...currentService, requiredMaterials: updatedMaterials });
  };
  
  const tableHeaders = [
    { label: "Tên Dịch vụ", icon: <SparklesIcon size={14}/> },
    { label: "Đơn vị", icon: <TagIcon size={14}/> },
    { label: "PP Giặt", icon: <SettingsIcon size={14}/> },
    { label: "Giá (VNĐ)", icon: <DollarSignIcon size={14}/> },
    { label: "Giá tối thiểu (VNĐ)", icon: <DollarSignIcon size={14}/> },
    { label: "TG Xử lý (giờ)", icon: <ClockIcon size={14}/> }, 
    { label: "Dự kiến trả (giờ)", icon: <CalendarCheck2Icon size={14}/> }, 
    { label: "Hành động", icon: <EditIcon size={14}/> }
  ];

  return (
    <Card 
      title="Quản lý Dịch vụ Giặt là"
      actions={ canManageServices &&
        <Button variant="primary" onClick={() => openModal('add')} leftIcon={<PlusCircleIcon size={18}/>}>Thêm Dịch vụ</Button>
      }
    >
      <Input 
        placeholder="Tìm kiếm dịch vụ theo tên, phương pháp giặt..."
        value={searchTerm}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
        className="mb-6"
        leftIcon={<SearchIcon />}
      />

      {filteredServices.length === 0 ? (
        <p className="text-center text-text-muted py-10">Không có dịch vụ nào được định nghĩa.</p>
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
              {filteredServices.map(service => (
                <tr key={service.id} className="hover:bg-bg-surface-hover dark:hover:bg-slate-700/60 transition-colors">
                  <td className="px-5 py-4 whitespace-nowrap text-sm font-medium text-text-heading">{service.name}</td>
                  <td className="px-5 py-4 whitespace-nowrap text-sm text-text-body">{service.unit}</td>
                  <td className="px-5 py-4 whitespace-nowrap text-sm text-text-body">{washMethods.find(wm => wm.id === service.washMethodId)?.name || 'N/A'}</td>
                  <td className="px-5 py-4 whitespace-nowrap text-sm text-text-body text-right">{service.price.toLocaleString('vi-VN')}</td>
                  <td className="px-5 py-4 whitespace-nowrap text-sm text-text-body text-right">{service.minPrice ? service.minPrice.toLocaleString('vi-VN') : '-'}</td>
                  <td className="px-5 py-4 whitespace-nowrap text-sm text-text-body text-center">{service.estimatedTimeHours} giờ</td>
                  <td className="px-5 py-4 whitespace-nowrap text-sm text-text-body text-center">{service.customerReturnTimeHours} giờ</td>
                  <td className="px-5 py-4 whitespace-nowrap text-sm font-medium">
                    {canManageServices && (
                      <div className="flex items-center space-x-1">
                        <Button variant="ghost" size="sm" onClick={() => openModal('edit', service)} title="Sửa" className="text-text-link hover:text-brand-primary p-1.5">
                          <EditIcon size={18}/>
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteService(service.id)} title="Xóa" className="text-status-danger hover:text-rose-600 p-1.5">
                          <Trash2Icon size={18}/>
                        </Button>
                      </div>
                    )}
                     {!canManageServices && <span className="text-xs text-text-muted italic">Không có quyền</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen && currentService && canManageServices && (
        <div className="fixed inset-0 bg-black/70 dark:bg-slate-900/80 flex items-center justify-center p-4 z-50 transition-opacity duration-300 animate-fadeIn">
          <Card 
            title={modalMode === 'add' ? 'Thêm Dịch vụ mới' : 'Sửa thông tin Dịch vụ'} 
            className="w-full max-w-2xl bg-bg-surface shadow-xl !border-border-base"
            headerClassName="!border-b !border-border-base"
          >
            <form onSubmit={handleSave} className="space-y-4 pt-2 max-h-[80vh] overflow-y-auto pr-2">
              <fieldset className="border border-border-base p-3 rounded-md">
                <legend className="text-sm font-medium px-1">Thông tin cơ bản</legend>
                <Input label="Tên Dịch vụ*" name="name" value={currentService.name || ''} onChange={handleInputChange} required className="mt-2" />
                <Input label="Đơn vị tính*" name="unit" value={currentService.unit || ''} onChange={handleInputChange} placeholder="VD: Cái, Kg, Bộ" required className="mt-3"/>
                <Select
                  label="Phương pháp giặt*"
                  name="washMethodId"
                  options={washMethodOptions}
                  value={currentService.washMethodId || ''}
                  onChange={handleInputChange}
                  required
                  wrapperClassName="mt-3"
                  disabled={washMethodOptions.length === 0}
                />
                 {washMethodOptions.length === 0 && <p className="text-xs text-text-muted mt-1">Chưa có phương pháp giặt nào. Vui lòng thêm trong trang 'Quản lý PP Giặt'.</p>}
                <Input label="Giá (VNĐ)*" name="price" type="number" min="0" step="1000" value={currentService.price ?? ''} onChange={handleInputChange} required className="mt-3"/>
                <Input label="Giá tối thiểu (VNĐ)" name="minPrice" type="number" min="0" step="1000" value={currentService.minPrice ?? ''} onChange={handleInputChange} placeholder="Để trống hoặc 0 nếu không có" className="mt-3"/>
                <Input label="Thời gian xử lý (giờ)*" name="estimatedTimeHours" type="number" min="0" step="0.5" value={currentService.estimatedTimeHours ?? ''} onChange={handleInputChange} required className="mt-3"/>
                <Input label="Thời gian dự kiến trả (giờ)*" name="customerReturnTimeHours" type="number" min="0" step="0.5" value={currentService.customerReturnTimeHours ?? ''} onChange={handleInputChange} required className="mt-3"/>
              </fieldset>

              <fieldset className="border border-border-base p-3 rounded-md">
                <legend className="text-sm font-medium px-1 flex items-center">
                  <ArchiveIcon size={14} className="mr-1.5"/> Nguyên vật liệu Yêu cầu
                </legend>
                <div className="space-y-3 mt-2">
                  {currentService.requiredMaterials?.map((material, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-end p-2 bg-bg-subtle/50 rounded-md">
                      <Select
                        label={`NVL ${index + 1}`}
                        options={inventoryOptions}
                        value={material.inventoryItemId}
                        onChange={(e) => handleMaterialChange(index, 'inventoryItemId', e.target.value)}
                        wrapperClassName="col-span-6"
                      />
                      <Input
                        label="Lượng dùng / ĐV"
                        type="number"
                        step="0.01"
                        min="0"
                        value={material.quantityUsedPerUnit.toString()}
                        onChange={(e) => handleMaterialChange(index, 'quantityUsedPerUnit', parseFloat(e.target.value))}
                        wrapperClassName="col-span-4"
                      />
                      <div className="col-span-2 flex justify-end">
                        <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveMaterial(index)} className="p-1.5 text-status-danger">
                          <Trash2Icon size={16} />
                        </Button>
                      </div>
                    </div>
                  ))}
                   <Button type="button" variant="secondary" size="sm" onClick={handleAddMaterial} leftIcon={<PlusCircleIcon size={16}/>} disabled={inventoryOptions.length === 0}>
                    Thêm NVL
                  </Button>
                  {inventoryOptions.length === 0 && <p className="text-xs text-text-muted">Chưa có vật tư nào trong kho để liên kết.</p>}
                </div>
              </fieldset>
              
              <div className="mt-6 flex justify-end space-x-3 border-t border-border-base pt-4">
                <Button type="button" variant="secondary" onClick={closeModal}>Hủy</Button>
                <Button type="submit" variant="primary">Lưu Dịch vụ</Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </Card>
  );
};

export default ServiceManagementPage;
