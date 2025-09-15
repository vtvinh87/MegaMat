import React, { useState, useMemo, ChangeEvent, FormEvent } from 'react';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { WashMethodDefinition, UserRole } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { PlusCircleIcon, EditIcon, Trash2Icon, SearchIcon, DropletsIcon, FileTextIcon, SettingsIcon } from 'lucide-react';

const WashMethodManagementPage: React.FC = () => {
  const { washMethods, addWashMethod, updateWashMethod, deleteWashMethod } = useData();
  const { currentUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentMethod, setCurrentMethod] = useState<Partial<WashMethodDefinition> | null>(null);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');

  const canManage = currentUser && (currentUser.role === UserRole.OWNER || currentUser.role === UserRole.MANAGER);

  const filteredMethods = useMemo(() => {
    return washMethods.filter(method =>
      method.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      method.description?.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a,b) => a.name.localeCompare(b.name));
  }, [washMethods, searchTerm]);

  const openModal = (mode: 'add' | 'edit', method: Partial<WashMethodDefinition> | null = null) => {
    if (!canManage) return;
    setModalMode(mode);
    setCurrentMethod(mode === 'add' ? { name: '', description: '' } : { ...method });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setCurrentMethod(null);
  };

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    if (!currentMethod || !currentMethod.name?.trim()) {
      alert('Tên phương pháp giặt là bắt buộc.');
      return;
    }

    const methodData = {
      name: currentMethod.name,
      description: currentMethod.description,
    };

    if (modalMode === 'add') {
      addWashMethod(methodData);
    } else if (currentMethod.id) {
      updateWashMethod({ ...currentMethod, ...methodData } as WashMethodDefinition);
    }
    closeModal();
  };
  
  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if(currentMethod) {
      setCurrentMethod({ ...currentMethod, [e.target.name]: e.target.value });
    }
  };

  const handleDelete = (methodId: string) => {
    if (!canManage) return;
    // You might want to add a check here to see if the wash method is used in any services
    if (window.confirm('Bạn có chắc chắn muốn xóa phương pháp này? Nó có thể đang được sử dụng trong các dịch vụ.')) {
      deleteWashMethod(methodId);
    }
  };

  const tableHeaders = [
    { label: "Tên Phương pháp", icon: <DropletsIcon size={14}/> },
    { label: "Mô tả", icon: <FileTextIcon size={14}/> },
    { label: "Hành động", icon: <SettingsIcon size={14}/> }
  ];

  return (
    <Card 
      title="Quản lý Phương pháp Giặt"
      actions={ canManage &&
        <Button variant="primary" onClick={() => openModal('add')} leftIcon={<PlusCircleIcon size={18}/>}>Thêm Phương pháp</Button>
      }
    >
      <Input 
        placeholder="Tìm kiếm phương pháp giặt..."
        value={searchTerm}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
        className="mb-6"
        leftIcon={<SearchIcon />}
      />

      {filteredMethods.length === 0 ? (
        <p className="text-center text-text-muted py-10">Không có phương pháp giặt nào được định nghĩa.</p>
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
              {filteredMethods.map(method => (
                <tr key={method.id} className="hover:bg-bg-surface-hover transition-colors">
                  <td className="px-5 py-4 whitespace-nowrap text-sm font-medium text-text-heading">{method.name}</td>
                  <td className="px-5 py-4 text-sm text-text-body">{method.description || '-'}</td>
                  <td className="px-5 py-4 whitespace-nowrap text-sm font-medium">
                    {canManage && (
                      <div className="flex items-center space-x-1">
                        <Button variant="ghost" size="sm" onClick={() => openModal('edit', method)} title="Sửa" className="text-text-link hover:text-brand-primary p-1.5">
                          <EditIcon size={18}/>
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(method.id)} title="Xóa" className="text-status-danger hover:text-rose-600 p-1.5">
                          <Trash2Icon size={18}/>
                        </Button>
                      </div>
                    )}
                     {!canManage && <span className="text-xs text-text-muted italic">Không có quyền</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen && currentMethod && canManage && (
        <Modal
          isOpen={isModalOpen}
          onClose={closeModal}
          title={modalMode === 'add' ? 'Thêm Phương pháp Giặt' : 'Sửa Phương pháp Giặt'}
          size="lg"
        >
          <form onSubmit={handleSave} className="space-y-4 pt-2">
            <Input label="Tên Phương pháp*" name="name" value={currentMethod.name || ''} onChange={handleInputChange} required />
            <Input isTextArea rows={3} label="Mô tả" name="description" value={currentMethod.description || ''} onChange={handleInputChange} />
            <div className="mt-6 flex justify-end space-x-3 border-t border-border-base pt-4">
              <Button type="button" variant="secondary" onClick={closeModal}>Hủy</Button>
              <Button type="submit" variant="primary">Lưu</Button>
            </div>
          </form>
        </Modal>
      )}
    </Card>
  );
};

export default WashMethodManagementPage;
