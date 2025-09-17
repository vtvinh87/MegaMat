import React, { useState, useMemo, ChangeEvent, FormEvent, useCallback } from 'react';
// FIX: Replaced useAppContext with useData and useAuth
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { StoreProfile, UserRole, User } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { SearchIcon, EditIcon, HomeIcon, SaveIcon, PlusCircleIcon, Trash2Icon, AlertTriangleIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface EditingProfileState extends Partial<StoreProfile> {
  reason?: string;
}

const StoreManagementPage: React.FC = () => {
  // FIX: Replaced useAppContext with useData and useAuth
  const { storeProfiles, users, updateStoreProfile, addUser, deleteStoreAndOwner } = useData();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  
  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<EditingProfileState | null>(null);

  // Add Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newStoreData, setNewStoreData] = useState({
    storeName: '', storeAddress: '', storePhone: '', storeLogoUrl: '',
    ownerName: '', ownerUsername: '', ownerPassword: '', ownerPasswordConfirm: '', ownerPhone: ''
  });
  
  // Delete Modal State
  const [profileToDelete, setProfileToDelete] = useState<StoreProfile | null>(null);
  const [deleteReason, setDeleteReason] = useState('');

  const [formError, setFormError] = useState('');

  const getOwnerName = useCallback((ownerId: string) => {
    const owner = users.find(u => u.id === ownerId);
    return owner ? owner.name : 'Không rõ';
  }, [users]);

  const filteredStores = useMemo(() => {
    return storeProfiles.filter(profile =>
      profile.storeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getOwnerName(profile.ownerId).toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => a.storeName.localeCompare(b.storeName));
  }, [storeProfiles, searchTerm, users, getOwnerName]);

  if (currentUser?.role !== UserRole.CHAIRMAN) {
    navigate('/admin/dashboard');
    return null;
  }

  // --- MODAL HANDLERS ---
  const openEditModal = (profile: StoreProfile) => {
    setEditingProfile({ ...profile, reason: '' });
    setIsEditModalOpen(true);
    setFormError('');
  };

  const openAddModal = () => {
    setNewStoreData({
        storeName: '', storeAddress: '', storePhone: '', storeLogoUrl: '',
        ownerName: '', ownerUsername: '', ownerPassword: '', ownerPasswordConfirm: '', ownerPhone: ''
    });
    setIsAddModalOpen(true);
    setFormError('');
  };

  const openDeleteModal = (profile: StoreProfile) => {
    setProfileToDelete(profile);
    setDeleteReason('');
  };

  const closeModal = () => {
    setIsEditModalOpen(false);
    setIsAddModalOpen(false);
    setProfileToDelete(null);
    setEditingProfile(null);
    setFormError('');
  };

  // --- ACTION HANDLERS ---
  const handleEditInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (editingProfile) {
      setEditingProfile({ ...editingProfile, [e.target.name]: e.target.value });
    }
  };
  
  const handleAddInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setNewStoreData({ ...newStoreData, [e.target.name]: e.target.value });
  };


  const handleSaveEdit = (e: FormEvent) => {
    e.preventDefault();
    if (!editingProfile || !editingProfile.ownerId) {
      setFormError('Lỗi: không thể cập nhật vì thiếu thông tin cửa hàng.');
      return;
    }
    const { reason, ...profileData } = editingProfile;
    if (!reason?.trim()) {
      setFormError('Lý do chỉnh sửa là bắt buộc.');
      return;
    }
    updateStoreProfile({ ...profileData, ownerId: editingProfile.ownerId }, reason);
    closeModal();
  };

  const handleSaveAdd = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    const { storeName, ownerName, ownerUsername, ownerPassword, ownerPasswordConfirm, ownerPhone, storeAddress, storePhone, storeLogoUrl } = newStoreData;
    if (!storeName || !ownerName || !ownerUsername || !ownerPassword) {
      setFormError('Tên cửa hàng, Tên chủ sở hữu, Tên đăng nhập và Mật khẩu là bắt buộc.');
      return;
    }
    if (ownerPassword.length < 6) {
      setFormError('Mật khẩu phải có ít nhất 6 ký tự.');
      return;
    }
    if (ownerPassword !== ownerPasswordConfirm) {
      setFormError('Mật khẩu và xác nhận mật khẩu không khớp.');
      return;
    }

    const ownerData: Omit<User, 'id'> & { managedBy?: string } = {
      name: ownerName,
      username: ownerUsername,
      password: ownerPassword,
      phone: ownerPhone,
      role: UserRole.OWNER,
      managedBy: currentUser?.id,
    };

    const storeData: Omit<StoreProfile, 'ownerId'> = {
      storeName,
      storeAddress: storeAddress || undefined,
      storePhone: storePhone || undefined,
      storeLogoUrl: storeLogoUrl || undefined,
    };

    const success = await addUser(ownerData, storeData);
    if (success) {
      closeModal();
    } else {
      setFormError('Tên đăng nhập đã tồn tại. Vui lòng chọn tên khác.');
    }
  };
  
  const handleConfirmDelete = () => {
      if (!profileToDelete) return;
      if(!deleteReason.trim()){
          alert("Vui lòng nhập lý do xóa.");
          return;
      }
      deleteStoreAndOwner(profileToDelete.ownerId, deleteReason);
      closeModal();
  };

  const tableHeaders = ["Tên Cửa hàng", "Chủ sở hữu", "SĐT Cửa hàng", "Địa chỉ", "Hành động"];

  return (
    <>
      <Card
        title="Quản lý Cửa hàng"
        icon={<HomeIcon className="text-brand-primary" size={24} />}
        actions={
          <Button onClick={openAddModal} leftIcon={<PlusCircleIcon size={18} />} variant="primary">
            Thêm Cửa hàng Mới
          </Button>
        }
      >
        <Input
          placeholder="Tìm kiếm theo Tên cửa hàng hoặc Tên chủ sở hữu..."
          value={searchTerm}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
          className="mb-6"
          leftIcon={<SearchIcon />}
        />

        {filteredStores.length === 0 ? (
          <p className="text-center text-text-muted py-10">Không có cửa hàng nào được tìm thấy.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border-base">
            <table className="min-w-full divide-y divide-border-base">
              <thead className="bg-bg-subtle/50">
                <tr>
                  {tableHeaders.map(header => (
                     <th key={header} className="px-5 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-bg-surface divide-y divide-border-base">
                {filteredStores.map(profile => (
                  <tr key={profile.ownerId} className="hover:bg-bg-surface-hover transition-colors">
                    <td className="px-5 py-4 whitespace-nowrap text-sm font-medium text-text-heading">{profile.storeName}</td>
                    <td className="px-5 py-4 whitespace-nowrap text-sm text-text-body">{getOwnerName(profile.ownerId)}</td>
                    <td className="px-5 py-4 whitespace-nowrap text-sm text-text-body">{profile.storePhone || '-'}</td>
                    <td className="px-5 py-4 text-sm text-text-body truncate max-w-xs">{profile.storeAddress || '-'}</td>
                    <td className="px-5 py-4 whitespace-nowrap text-sm font-medium space-x-1">
                      <Button variant="ghost" size="sm" onClick={() => openEditModal(profile)} title="Sửa thông tin cửa hàng" className="text-text-link hover:text-brand-primary p-1.5">
                        <EditIcon size={18} />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openDeleteModal(profile)} title="Xóa cửa hàng" className="text-status-danger hover:text-rose-600 p-1.5">
                        <Trash2Icon size={18} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      
      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 animate-fadeIn">
          <Card title="Thêm Cửa hàng và Chủ sở hữu" className="w-full max-w-lg bg-bg-surface shadow-xl">
            <form onSubmit={handleSaveAdd} className="space-y-4 max-h-[80vh] overflow-y-auto pr-2">
              {formError && <p className="text-sm text-status-danger flex items-center"><AlertTriangleIcon size={16} className="mr-1.5"/>{formError}</p>}
              <fieldset className="border p-3 rounded-md border-border-base">
                <legend className="text-sm font-medium px-1">Thông tin Cửa hàng</legend>
                <Input label="Tên Cửa hàng*" name="storeName" value={newStoreData.storeName} onChange={handleAddInputChange} required />
                <Input label="Địa chỉ" name="storeAddress" value={newStoreData.storeAddress} onChange={handleAddInputChange} className="mt-2"/>
                <Input label="SĐT Cửa hàng" name="storePhone" value={newStoreData.storePhone} onChange={handleAddInputChange} className="mt-2"/>
                <Input label="URL Logo" name="storeLogoUrl" value={newStoreData.storeLogoUrl} onChange={handleAddInputChange} className="mt-2"/>
              </fieldset>
               <fieldset className="border p-3 rounded-md border-border-base">
                <legend className="text-sm font-medium px-1">Thông tin Tài khoản Chủ sở hữu</legend>
                <Input label="Tên đầy đủ*" name="ownerName" value={newStoreData.ownerName} onChange={handleAddInputChange} required />
                <Input label="Tên đăng nhập*" name="ownerUsername" value={newStoreData.ownerUsername} onChange={handleAddInputChange} required className="mt-2"/>
                <Input label="SĐT Chủ sở hữu" name="ownerPhone" value={newStoreData.ownerPhone} onChange={handleAddInputChange} className="mt-2"/>
                <Input label="Mật khẩu*" name="ownerPassword" type="password" value={newStoreData.ownerPassword} onChange={handleAddInputChange} required className="mt-2"/>
                <Input label="Xác nhận Mật khẩu*" name="ownerPasswordConfirm" type="password" value={newStoreData.ownerPasswordConfirm} onChange={handleAddInputChange} required className="mt-2"/>
              </fieldset>
              <div className="mt-6 flex justify-end space-x-3 border-t border-border-base pt-4">
                <Button type="button" variant="secondary" onClick={closeModal}>Hủy</Button>
                <Button type="submit" variant="primary" leftIcon={<PlusCircleIcon size={16}/>}>Thêm Cửa hàng</Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && editingProfile && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 animate-fadeIn">
          <Card title={`Chỉnh sửa: ${editingProfile.storeName}`} className="w-full max-w-lg bg-bg-surface shadow-xl">
            <form onSubmit={handleSaveEdit} className="space-y-4">
              {formError && <p className="text-sm text-status-danger flex items-center"><AlertTriangleIcon size={16} className="mr-1.5"/>{formError}</p>}
              <Input label="Tên Cửa hàng*" name="storeName" value={editingProfile.storeName} onChange={handleEditInputChange} required />
              <Input label="URL Logo" name="storeLogoUrl" value={editingProfile.storeLogoUrl || ''} onChange={handleEditInputChange} />
              <Input label="SĐT Cửa hàng" name="storePhone" value={editingProfile.storePhone || ''} onChange={handleEditInputChange} />
              <Input label="Địa chỉ Cửa hàng" name="storeAddress" value={editingProfile.storeAddress || ''} onChange={handleEditInputChange} />
              <Input label="Lý do chỉnh sửa*" name="reason" value={editingProfile.reason || ''} onChange={handleEditInputChange} required isTextArea/>
              <div className="mt-6 flex justify-end space-x-3 border-t border-border-base pt-4">
                <Button type="button" variant="secondary" onClick={closeModal}>Hủy</Button>
                <Button type="submit" variant="primary" leftIcon={<SaveIcon size={16}/>}>Lưu thay đổi</Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {profileToDelete && (
         <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 animate-fadeIn">
             <Card title="Xác nhận Xóa Cửa hàng" className="w-full max-w-md bg-bg-surface shadow-xl">
                 <p className="text-text-body mb-2">Bạn có chắc chắn muốn xóa vĩnh viễn cửa hàng <strong className="text-text-heading">{profileToDelete.storeName}</strong>?</p>
                 <p className="text-sm text-status-danger mb-4">Hành động này sẽ xóa cả tài khoản của Chủ sở hữu và TẤT CẢ nhân viên thuộc cửa hàng này. Hành động này không thể hoàn tác.</p>
                 <Input label="Lý do xóa*" value={deleteReason} onChange={e => setDeleteReason(e.target.value)} required isTextArea/>
                 <div className="mt-6 flex justify-end space-x-3">
                     <Button variant="secondary" onClick={closeModal}>Hủy</Button>
                     <Button variant="danger" onClick={handleConfirmDelete} disabled={!deleteReason.trim()}>Xác nhận Xóa</Button>
                 </div>
             </Card>
         </div>
      )}
    </>
  );
};

export default StoreManagementPage;