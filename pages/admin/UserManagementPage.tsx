import React, { useState, useMemo, ChangeEvent, FormEvent, useEffect } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { User, UserRole, StoreProfile } from '../../types'; // Added StoreProfile
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { UserTreeNode } from '../../components/admin/UserTreeNode'; 
import { PlusCircleIcon, SearchIcon, UserCogIcon, AlertTriangleIcon, UsersIcon, HomeIcon, Edit3Icon } from 'lucide-react'; // Added HomeIcon, Edit3Icon
import { useLocation } from 'react-router-dom'; 

interface EditingUserState extends Partial<User> {
    passwordConfirmation?: string;
    storeName?: string;
    storeLogoUrl?: string;
    storePhone?: string;
    storeAddress?: string;
}


const UserManagementPage: React.FC = () => {
  const { users, addUser, updateUser, deleteUser, currentUser, addNotification, findUsersByManagerId, findStoreProfileByOwnerId } = useAppContext();
  const location = useLocation(); 
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<EditingUserState | null>(null);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [formError, setFormError] = useState<string | null>(null);
  const [managingUserId, setManagingUserId] = useState<string | null>(null); 

  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  const toggleExpandNode = (userId: string) => {
    setExpandedNodes(prev => ({ ...prev, [userId]: !prev[userId] }));
  };
  
  useEffect(() => {
    if (location.state?.action === 'addOwnerFromChairmanDashboard' && currentUser?.role === UserRole.CHAIRMAN) {
      openModal('add', null, null); 
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, currentUser]);


  useEffect(() => {
    setExpandedNodes(prevExpandedNodes => {
      const newExpandedState = { ...prevExpandedNodes };
      let needsUpdate = false;

      users.forEach(user => {
        const hasChildren = findUsersByManagerId(user.id).length > 0;
        const isPrivilegedRole = user.role === UserRole.OWNER || user.role === UserRole.MANAGER || user.role === UserRole.CHAIRMAN;

        if (newExpandedState[user.id] === undefined) { 
          newExpandedState[user.id] = isPrivilegedRole && hasChildren;
          needsUpdate = true;
        } else if (newExpandedState[user.id] === true && !hasChildren) { 
          newExpandedState[user.id] = false;
          needsUpdate = true;
        }
      });

      Object.keys(newExpandedState).forEach(userId => {
        if (!users.find(u => u.id === userId)) {
          delete newExpandedState[userId];
          needsUpdate = true;
        }
      });
      return needsUpdate ? newExpandedState : prevExpandedNodes;
    });
  }, [users, findUsersByManagerId]);

  useEffect(() => {
    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      const usersToExpand = new Set<string>();

      users.forEach(u => {
        if (u.name.toLowerCase().includes(lowerSearchTerm) || u.username.toLowerCase().includes(lowerSearchTerm)) {
          let current: User | undefined = u;
          while (current) {
            if (findUsersByManagerId(current.id).length > 0) {
                 usersToExpand.add(current.id);
            }
            if (!current.managedBy) break;
            current = users.find(m => m.id === current!.managedBy);
          }
        }
      });
      
      if (usersToExpand.size > 0) {
        setExpandedNodes(prev => {
          const newExpanded = {...prev};
          let changed = false;
          usersToExpand.forEach(id => {
            if (newExpanded[id] !== true) {
              newExpanded[id] = true;
              changed = true;
            }
          });
          return changed ? newExpanded : prev;
        });
      }
    }
  }, [searchTerm, users, findUsersByManagerId]);


  const canCurrentUserManageRole = (targetRole?: UserRole, contextUser?: Partial<User> | null): boolean => {
    if (!currentUser) return false;
    const userBeingEdited = contextUser || editingUser;

    if (currentUser.role === UserRole.CHAIRMAN) {
        return targetRole === UserRole.OWNER || targetRole === UserRole.MANAGER || targetRole === UserRole.STAFF;
    }
    if (currentUser.role === UserRole.OWNER) {
        if (targetRole === UserRole.OWNER || targetRole === UserRole.CHAIRMAN) return false;
        return targetRole === UserRole.MANAGER || targetRole === UserRole.STAFF;
    }
    if (currentUser.role === UserRole.MANAGER) {
        if (targetRole !== UserRole.STAFF) return false;
        return targetRole === UserRole.STAFF;
    }
    return false;
  };

  const getRoleOptionsForCurrentUser = (managerForNewUserId?: string) => {
    const baseOptions = [
      { value: UserRole.STAFF, label: 'Nhân viên' },
      { value: UserRole.MANAGER, label: 'Quản lý' },
      { value: UserRole.OWNER, label: 'Chủ cửa hàng' },
      { value: UserRole.CHAIRMAN, label: 'Chủ tịch' },
    ];

    if (!currentUser) return [];
    
    if (modalMode === 'edit' && editingUser) {
        if (editingUser.id === currentUser.id) { 
            if (currentUser.role === UserRole.CHAIRMAN && users.filter(u=>u.role === UserRole.CHAIRMAN).length <=1) return baseOptions.filter(opt => opt.value === UserRole.CHAIRMAN); 
            if (currentUser.role === UserRole.OWNER) return baseOptions.filter(opt => opt.value === UserRole.OWNER || opt.value === UserRole.MANAGER || opt.value === UserRole.STAFF ); 
            return baseOptions.filter(opt => opt.value === currentUser.role); 
        }
        if (currentUser.role === UserRole.CHAIRMAN) return baseOptions.filter(opt => opt.value !== UserRole.CHAIRMAN); 
        if (currentUser.role === UserRole.OWNER) return baseOptions.filter(opt => opt.value === UserRole.MANAGER || opt.value === UserRole.STAFF);
        if (currentUser.role === UserRole.MANAGER) return baseOptions.filter(opt => opt.value === UserRole.STAFF);
    }

    if (modalMode === 'add') {
        const manager = managerForNewUserId ? users.find(u => u.id === managerForNewUserId) : null;
        if (currentUser.role === UserRole.CHAIRMAN) {
            if (!manager) return baseOptions.filter(opt => opt.value === UserRole.OWNER); 
            if (manager.role === UserRole.OWNER) return baseOptions.filter(opt => opt.value === UserRole.MANAGER || opt.value === UserRole.STAFF);
            if (manager.role === UserRole.MANAGER) return baseOptions.filter(opt => opt.value === UserRole.STAFF);
        }
        if (currentUser.role === UserRole.OWNER) {
            if (!manager || manager.id === currentUser.id) return baseOptions.filter(opt => opt.value === UserRole.MANAGER || opt.value === UserRole.STAFF); 
             if (manager.role === UserRole.MANAGER && manager.managedBy === currentUser.id) return baseOptions.filter(opt => opt.value === UserRole.STAFF); 
        }
        if (currentUser.role === UserRole.MANAGER) {
             if (!manager || manager.id === currentUser.id) return baseOptions.filter(opt => opt.value === UserRole.STAFF); 
        }
    }
    return [];
  };


  const openModal = (mode: 'add' | 'edit', user: User | null = null, managerIdFromTreeClick: string | null = null) => {
    setModalMode(mode);
    setFormError(null);
    
    let effectiveManagerId = managerIdFromTreeClick;
    let defaultRoleForAdd = UserRole.STAFF;
    let initialStoreProfile: Partial<StoreProfile> = {};

    if (mode === 'add') {
        setManagingUserId(effectiveManagerId); 

        if (currentUser?.role === UserRole.CHAIRMAN) {
            if (!effectiveManagerId) defaultRoleForAdd = UserRole.OWNER; 
            else {
                const manager = users.find(u => u.id === effectiveManagerId);
                if (manager?.role === UserRole.OWNER) defaultRoleForAdd = UserRole.MANAGER;
            }
        } else if (currentUser?.role === UserRole.OWNER) {
            if (!effectiveManagerId || effectiveManagerId === currentUser.id) { 
                 defaultRoleForAdd = UserRole.MANAGER;
                 effectiveManagerId = currentUser.id; 
                 setManagingUserId(currentUser.id);
            } else { 
                addNotification({message: "Chủ cửa hàng chỉ có thể thêm Nhân viên/Quản lý trực tiếp dưới quyền mình.", type:"error"});
                return;
            }
        } else if (currentUser?.role === UserRole.MANAGER) {
             if (!effectiveManagerId || effectiveManagerId === currentUser.id) { 
                defaultRoleForAdd = UserRole.STAFF;
                effectiveManagerId = currentUser.id; 
                setManagingUserId(currentUser.id);
            } else {
                addNotification({message: "Quản lý chỉ có thể thêm Nhân viên trực tiếp dưới quyền mình.", type:"error"});
                return;
            }
        }
        
        if (!canCurrentUserManageRole(defaultRoleForAdd)) {
            addNotification({message: "Bạn không có quyền thêm người dùng với vai trò này.", type: "error"});
            return;
        }
        setEditingUser({ 
            name: '', username: '', password: '', passwordConfirmation: '', role: defaultRoleForAdd, phone: '', managedBy: effectiveManagerId || undefined,
            storeName: defaultRoleForAdd === UserRole.OWNER ? '' : undefined,
            storeLogoUrl: defaultRoleForAdd === UserRole.OWNER ? '' : undefined,
            storePhone: defaultRoleForAdd === UserRole.OWNER ? '' : undefined,
            storeAddress: defaultRoleForAdd === UserRole.OWNER ? '' : undefined,
        });
    
    } else if (user) { 
        setManagingUserId(user.managedBy || null); 
        if (!canCurrentUserManageRole(user.role, user) && !(currentUser?.id === user.id && user.role === UserRole.CHAIRMAN && users.filter(u=>u.role === UserRole.CHAIRMAN).length <=1)) {
            addNotification({message: "Bạn không có quyền sửa người dùng này.", type: "error"});
            return;
        }
        if (user.role === UserRole.OWNER) {
            const profile = findStoreProfileByOwnerId(user.id);
            initialStoreProfile = profile || {};
        }
        setEditingUser({ 
            ...user, 
            password: '', 
            passwordConfirmation: '',
            storeName: initialStoreProfile.storeName,
            storeLogoUrl: initialStoreProfile.storeLogoUrl,
            storePhone: initialStoreProfile.storePhone,
            storeAddress: initialStoreProfile.storeAddress,
        });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
    setFormError(null);
    setManagingUserId(null);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (editingUser) {
      const { name, value } = e.target;
      setEditingUser({ ...editingUser, [name]: value });
    }
  };

  const handleSaveUser = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!editingUser || !currentUser) return;

    let { name, username, password, passwordConfirmation, role, phone, managedBy, storeName, storeLogoUrl, storePhone, storeAddress } = editingUser;

    if (!name?.trim() || !username?.trim() || !role) {
      setFormError('Tên, tên đăng nhập và vai trò là bắt buộc.');
      return;
    }

    if (modalMode === 'add' && !password) {
      setFormError('Mật khẩu là bắt buộc khi thêm người dùng mới.');
      return;
    }

    if (password && password !== passwordConfirmation) {
      setFormError('Mật khẩu và xác nhận mật khẩu không khớp.');
      return;
    }
    
    const managerUser = managedBy ? users.find(u => u.id === managedBy) : null;

    if (role === UserRole.CHAIRMAN && managedBy) {
        setFormError('Chủ tịch không thể bị quản lý bởi người khác.');
        return;
    }
    if (role === UserRole.OWNER && managerUser && managerUser.role !== UserRole.CHAIRMAN) {
        setFormError('Chủ cửa hàng chỉ có thể được quản lý bởi Chủ tịch.');
        return;
    }
    if (role === UserRole.MANAGER && managerUser && managerUser.role === UserRole.STAFF) {
        setFormError('Quản lý không thể bị quản lý bởi Nhân viên.');
        return;
    }
    if (role === UserRole.MANAGER && managerUser && managerUser.role === UserRole.MANAGER) {
        setFormError('Quản lý không thể quản lý một Quản lý khác trong cấu trúc này.');
        return;
    }
    if (role === UserRole.STAFF && managerUser && managerUser.role === UserRole.STAFF) {
        setFormError('Nhân viên không thể bị quản lý bởi Nhân viên khác.');
        return;
    }
    if (!canCurrentUserManageRole(role, editingUser)) {
        setFormError(`Bạn không có quyền ${modalMode === 'add' ? 'thêm' : 'cập nhật thành'} người dùng với vai trò ${role}.`);
        return;
    }
    if (role === UserRole.OWNER && modalMode === 'add' && (!storeName || !storeName.trim())) {
        setFormError('Tên cửa hàng là bắt buộc khi tạo Chủ cửa hàng mới.');
        return;
    }

    const userData: Omit<User, 'id'> & { id?: string; managedBy?: string } = {
        name: name.trim(),
        username: username.trim(),
        role,
        phone: phone?.trim() || undefined,
        managedBy: role === UserRole.CHAIRMAN ? undefined : (managedBy || undefined), 
    };
    if (password) {
        (userData as User).password = password;
    }

    let storeProfilePayload: Omit<StoreProfile, 'ownerId'> | undefined = undefined;
    if (role === UserRole.OWNER) {
        storeProfilePayload = {
            storeName: storeName || `${name.trim()}'s Store (Mặc định)`,
            storeLogoUrl: storeLogoUrl || '/default_logo.png',
            storePhone: storePhone || phone?.trim() || 'Chưa có',
            storeAddress: storeAddress || 'Chưa có',
        };
    }

    let success = false;
    if (modalMode === 'add') {
      userData.managedBy = managingUserId || undefined;
      if (userData.role === UserRole.CHAIRMAN) userData.managedBy = undefined;

      success = addUser(userData as Omit<User, 'id'> & { managedBy?: string }, storeProfilePayload);
    } else if (editingUser.id) {
      const existingOriginalUser = users.find(u => u.id === editingUser.id);
      const finalUserData: User = {
          ...(existingOriginalUser || {}), 
          ...editingUser, 
          ...userData, 
          id: editingUser.id, 
          password: password ? password : existingOriginalUser?.password, 
          managedBy: userData.managedBy, 
      };
      success = updateUser(finalUserData, storeProfilePayload);
    }

    if (success) {
      closeModal();
    } else {
        if (!formError) { 
            setFormError("Có lỗi xảy ra, không thể lưu người dùng. Vui lòng kiểm tra lại thông tin hoặc quyền hạn.");
        }
    }
  };

  const openDeleteConfirm = (user: User) => {
    if (!currentUser) return;
    if (currentUser.id === user.id) {
      addNotification({message: "Bạn không thể tự xóa chính mình.", type:"error"});
      return;
    }
    if (user.role === UserRole.CHAIRMAN && users.filter(u => u.role === UserRole.CHAIRMAN).length <= 1) {
      addNotification({message: "Không thể xóa Chủ tịch duy nhất.", type: "error"});
      return;
    }
    
    let canDelete = false;
    if (currentUser.role === UserRole.CHAIRMAN) canDelete = true;
    else if (currentUser.role === UserRole.OWNER && user.role !== UserRole.CHAIRMAN && user.role !== UserRole.OWNER) canDelete = true; 
    else if (currentUser.role === UserRole.MANAGER && user.role === UserRole.STAFF && user.managedBy === currentUser.id) canDelete = true;

    if (!canDelete) {
         addNotification({message: "Bạn không có quyền xóa người dùng này.", type: "error"});
         return;
    }

    setUserToDelete(user);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDeleteUser = () => {
    if (userToDelete) {
      deleteUser(userToDelete.id);
    }
    setIsDeleteConfirmOpen(false);
    setUserToDelete(null);
  };

  const renderUserTree = (currentManagerId: string | null, level: number): JSX.Element[] => {
    let usersToRender = findUsersByManagerId(currentManagerId);

    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      usersToRender = users.filter(u => { 
        const isDirectMatch = (u.name.toLowerCase().includes(lowerSearchTerm) || u.username.toLowerCase().includes(lowerSearchTerm));
        if (isDirectMatch) return true;

        let currentAncestor: User | undefined = u;
        while(currentAncestor?.managedBy) {
            const parent = users.find(p => p.id === currentAncestor!.managedBy);
            if (parent && expandedNodes[parent.id]) { 
                if(u.managedBy === currentManagerId) return true; 
            }
            currentAncestor = parent;
        }
        return false;
      }).filter(u => u.managedBy === currentManagerId); 
    }


    return usersToRender
      .sort((a,b) => { 
          const roleOrder = { [UserRole.CHAIRMAN]:0, [UserRole.OWNER]: 1, [UserRole.MANAGER]: 2, [UserRole.STAFF]: 3, [UserRole.CUSTOMER]: 4};
          if(roleOrder[a.role] !== roleOrder[b.role]) {
              return roleOrder[a.role] - roleOrder[b.role];
          }
          return a.name.localeCompare(b.name);
      })
      .map(user => (
        <React.Fragment key={user.id}>
          <UserTreeNode
            user={user}
            level={level}
            onAddSubordinate={(managerId, managerRole) => openModal('add', null, managerId)}
            onEdit={editUser => openModal('edit', editUser)}
            onDelete={deleteCandidate => openDeleteConfirm(deleteCandidate)}
            managedUsers={findUsersByManagerId(user.id)}
            isExpanded={expandedNodes[user.id] || false}
            onToggleExpand={toggleExpandNode}
          />
          {expandedNodes[user.id] && renderUserTree(user.id, level + 1)}
        </React.Fragment>
    ));
  };
  
  const topLevelUsers = renderUserTree(null, 0);


  return (
    <>
      <Card
        title="Quản lý Người dùng Hệ thống"
        icon={<UserCogIcon className="text-brand-primary" size={24} />}
        actions={
          (currentUser?.role === UserRole.CHAIRMAN || currentUser?.role === UserRole.OWNER) && (
            <Button variant="primary" onClick={() => openModal('add', null, currentUser?.role === UserRole.OWNER ? currentUser.id : null)} leftIcon={<PlusCircleIcon size={18} />}>
              {currentUser?.role === UserRole.CHAIRMAN ? 'Thêm Chủ Cửa hàng/Quản lý Chuỗi' : 'Thêm Người dùng Mới'}
            </Button>
          )
        }
      >
        <Input
          placeholder="Tìm kiếm theo Tên hoặc Tên đăng nhập..."
          value={searchTerm}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
          className="mb-6"
          leftIcon={<SearchIcon />}
          aria-label="Tìm kiếm người dùng"
        />

        <div role="tree" aria-label="Cây phân cấp người dùng">
          {topLevelUsers.length === 0 ? (
            searchTerm ? (
              <p className="text-center text-text-muted py-10">Không tìm thấy người dùng nào khớp với tìm kiếm.</p>
            ) : (
              <p className="text-center text-text-muted py-10">Không có người dùng nào trong hệ thống.</p>
            )
          ) : (
            <div className="space-y-1">
              {topLevelUsers}
            </div>
          )}
        </div>
      </Card>

      {isModalOpen && editingUser && (
        <div className="fixed inset-0 bg-black/70 dark:bg-slate-900/80 flex items-center justify-center p-4 z-50 transition-opacity duration-300 animate-fadeIn" role="dialog" aria-modal="true" aria-labelledby="user-modal-title">
          <Card
            titleId="user-modal-title"
            title={modalMode === 'add' ? 'Thêm Người dùng mới' : `Sửa Người dùng: ${editingUser.name}`}
            className="w-full max-w-lg bg-bg-surface shadow-xl !border-border-base"
            headerClassName="!border-b !border-border-base"
          >
            <form onSubmit={handleSaveUser} className="space-y-4 pt-2 max-h-[80vh] overflow-y-auto pr-2">
              {formError && (
                <div className="bg-status-danger-bg border border-status-danger text-status-danger-text px-3 py-2 rounded-md text-sm flex items-center" role="alert">
                  <AlertTriangleIcon size={18} className="mr-2"/>{formError}
                </div>
              )}
              <fieldset className="border border-border-base p-3 rounded-md">
                <legend className="text-sm font-medium text-text-muted px-1 -ml-1">Thông tin Tài khoản</legend>
                <Input label="Tên đầy đủ*" name="name" value={editingUser.name || ''} onChange={handleInputChange} required />
                <Input 
                  label="Tên đăng nhập (username)*" 
                  name="username" 
                  value={editingUser.username || ''} 
                  onChange={handleInputChange} 
                  required 
                  disabled={modalMode === 'edit'}
                  className="mt-3"
                />
                <Input 
                  label={modalMode === 'add' ? "Mật khẩu*" : "Mật khẩu mới (để trống nếu không đổi)"} 
                  name="password" 
                  type="password" 
                  value={editingUser.password || ''} 
                  onChange={handleInputChange} 
                  autoComplete="new-password"
                  className="mt-3"
                />
                {(modalMode === 'add' || editingUser.password) && (
                  <Input 
                      label="Xác nhận mật khẩu*" 
                      name="passwordConfirmation" 
                      type="password" 
                      value={editingUser.passwordConfirmation || ''} 
                      onChange={handleInputChange} 
                      autoComplete="new-password"
                      className="mt-3"
                  />
                )}
                <Select
                  label="Vai trò*"
                  name="role"
                  options={getRoleOptionsForCurrentUser(managingUserId || undefined)}
                  value={editingUser.role || ''}
                  onChange={handleInputChange}
                  required
                  disabled={modalMode === 'edit' && editingUser.id === currentUser?.id && editingUser.role === UserRole.CHAIRMAN && users.filter(u=>u.role===UserRole.CHAIRMAN).length <=1}
                  wrapperClassName="mt-3"
                />
                {currentUser?.role === UserRole.CHAIRMAN && modalMode === 'edit' && editingUser.id !== currentUser?.id && editingUser.role !== UserRole.CHAIRMAN && (
                  <Select
                      label="Quản lý bởi"
                      name="managedBy"
                      options={[
                          { value: '', label: 'Không có (Người dùng gốc của Chủ tịch)' }, 
                          ...users
                              .filter(u => u.id !== editingUser.id && (u.role === UserRole.CHAIRMAN || (u.role === UserRole.OWNER && editingUser.role !== UserRole.OWNER) || (u.role === UserRole.MANAGER && editingUser.role === UserRole.STAFF) ) )
                              .map(u => ({ value: u.id, label: `${u.name} (${u.role})`}))
                      ]}
                      value={editingUser.managedBy || ''}
                      onChange={handleInputChange}
                      wrapperClassName="mt-3"
                  />
                )}
                <Input label="Số điện thoại" name="phone" value={editingUser.phone || ''} onChange={handleInputChange} className="mt-3" />
              </fieldset>
              
              {/* Store Profile Fields - only for Chairman managing Owner */}
              {currentUser?.role === UserRole.CHAIRMAN && editingUser.role === UserRole.OWNER && (
                <fieldset className="border border-border-base p-3 rounded-md mt-4">
                  <legend className="text-sm font-medium text-text-muted px-1 -ml-1 flex items-center"><HomeIcon size={16} className="mr-1"/> Thông tin Cửa hàng</legend>
                  <Input label="Tên cửa hàng*" name="storeName" value={editingUser.storeName || ''} onChange={handleInputChange} required={modalMode === 'add'} className="mt-2"/>
                  <Input label="URL Logo cửa hàng" name="storeLogoUrl" value={editingUser.storeLogoUrl || ''} onChange={handleInputChange} placeholder="/logo_cuahang.png" className="mt-3"/>
                  <Input label="SĐT cửa hàng" name="storePhone" value={editingUser.storePhone || ''} onChange={handleInputChange} className="mt-3"/>
                  <Input label="Địa chỉ cửa hàng" name="storeAddress" value={editingUser.storeAddress || ''} onChange={handleInputChange} className="mt-3"/>
                </fieldset>
              )}
              
              <div className="mt-6 flex justify-end space-x-3 border-t border-border-base pt-4">
                <Button type="button" variant="secondary" onClick={closeModal}>Hủy</Button>
                <Button type="submit" variant="primary">
                  {modalMode === 'add' ? 'Thêm Người dùng' : 'Lưu thay đổi'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {isDeleteConfirmOpen && userToDelete && (
         <div className="fixed inset-0 bg-black/70 dark:bg-slate-900/80 flex items-center justify-center p-4 z-[60] animate-fadeIn" role="alertdialog" aria-modal="true" aria-labelledby="delete-confirm-title">
            <Card titleId="delete-confirm-title" title="Xác nhận Xóa Người dùng" className="w-full max-w-md bg-bg-surface shadow-xl !border-border-base">
                <p className="text-text-body mb-4">Bạn có chắc chắn muốn xóa người dùng <strong className="text-text-heading">{userToDelete.name} ({userToDelete.username})</strong>? <br/>
                {findUsersByManagerId(userToDelete.id).length > 0 && "Các nhân viên cấp dưới của người này sẽ được cập nhật người quản lý (nếu có thể)."} Hành động này không thể hoàn tác.</p>
                <div className="flex justify-end space-x-3">
                    <Button variant="secondary" onClick={() => { setIsDeleteConfirmOpen(false); setUserToDelete(null); }}>Hủy</Button>
                    <Button variant="danger" onClick={confirmDeleteUser}>Xác nhận Xóa</Button>
                </div>
            </Card>
         </div>
      )}
    </>
  );
};

export default UserManagementPage;