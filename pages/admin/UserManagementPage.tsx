import React, { useState, useMemo, ChangeEvent, FormEvent, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { User, UserRole, StoreProfile } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { UserTreeNode } from '../../components/admin/UserTreeNode'; 
import { PlusCircleIcon, SearchIcon, UserCogIcon, AlertTriangleIcon, UsersIcon, HomeIcon, Edit3Icon, TrendingUpIcon } from 'lucide-react';
import { useLocation } from 'react-router-dom'; 

interface EditingUserState extends Partial<User> {
    passwordConfirmation?: string;
    storeName?: string;
    storeLogoUrl?: string;
    storePhone?: string;
    storeAddress?: string;
}

const UserManagementPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { users, addUser, updateUser, deleteUser, addNotification, findUsersByManagerId } = useData();
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

  const internalUsers = useMemo(() => users.filter(u => u.role !== UserRole.CUSTOMER), [users]);

  const toggleExpandNode = (userId: string) => {
    setExpandedNodes(prev => ({ ...prev, [userId]: !prev[userId] }));
  };

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

  // FIX: Moved openModal definition before its use in useEffect
  const openModal = (mode: 'add' | 'edit', user: Partial<User> | null = null, managerForNewUserId?: string) => {
    setModalMode(mode);
    setFormError(null);
    let effectiveManagerId: string | undefined = managerForNewUserId;
    let defaultRoleForAdd: UserRole = UserRole.STAFF; // A safe default

    if (mode === 'add') {
      const manager = managerForNewUserId ? users.find(u => u.id === managerForNewUserId) : currentUser;
      
      if (manager?.role === UserRole.CHAIRMAN) {
        defaultRoleForAdd = UserRole.OWNER;
        effectiveManagerId = manager.id; // An Owner is managed by the Chairman
      } else if (manager?.role === UserRole.OWNER) {
        defaultRoleForAdd = UserRole.MANAGER; // An Owner can add a Manager or Staff. Default to Manager.
        effectiveManagerId = manager.id;
      } else if (manager?.role === UserRole.MANAGER) {
        defaultRoleForAdd = UserRole.STAFF; // A Manager can only add Staff.
        effectiveManagerId = manager.id;
      }
      
      if (!canCurrentUserManageRole(defaultRoleForAdd)) {
          addNotification({message: "Bạn không có quyền thêm người dùng với vai trò này.", type: "error"});
          return;
      }
      setManagingUserId(effectiveManagerId || null);
      setEditingUser({ 
          name: '', username: '', password: '', passwordConfirmation: '', role: defaultRoleForAdd, phone: '', managedBy: effectiveManagerId || undefined,
          storeName: defaultRoleForAdd === UserRole.OWNER ? '' : undefined,
          kpiTargets: {}, // Initialize KPI targets
      });
  
    } else if (user) { // This is 'edit' mode
        setManagingUserId(user.managedBy || null); 
        if (!canCurrentUserManageRole(user.role, user) && !(currentUser?.id === user.id && user.role === UserRole.CHAIRMAN && users.filter(u=>u.role === UserRole.CHAIRMAN).length <=1)) {
            addNotification({message: "Bạn không có quyền sửa người dùng này.", type: "error"});
            return;
        }
        setEditingUser({ 
            ...user, 
            password: '', 
            passwordConfirmation: '',
            kpiTargets: user.kpiTargets ? { ...user.kpiTargets } : {}, // Deep copy
        });
    }
    setIsModalOpen(true);
  };
  
  useEffect(() => {
    // FIX: Corrected call to openModal with appropriate arguments. The third argument is managerId, which is null/undefined when adding an Owner.
    if (location.state?.action === 'addOwnerFromChairmanDashboard' && currentUser?.role === UserRole.CHAIRMAN) {
      openModal('add', null, currentUser.id); 
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, currentUser]);

  useEffect(() => {
    setExpandedNodes(prevExpandedNodes => {
      const newExpandedState = { ...prevExpandedNodes };
      let needsUpdate = false;

      internalUsers.forEach(user => {
        const hasChildren = findUsersByManagerId(user.id).filter(u => u.role !== UserRole.CUSTOMER).length > 0;
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
        if (!internalUsers.find(u => u.id === userId)) {
          delete newExpandedState[userId];
          needsUpdate = true;
        }
      });
      return needsUpdate ? newExpandedState : prevExpandedNodes;
    });
  }, [internalUsers, findUsersByManagerId]);

  useEffect(() => {
    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      const usersToExpand = new Set<string>();

      internalUsers.forEach(u => {
        if (u.name.toLowerCase().includes(lowerSearchTerm) || u.username.toLowerCase().includes(lowerSearchTerm)) {
          let current: User | undefined = u;
          while (current) {
            if (findUsersByManagerId(current.id).filter(u => u.role !== UserRole.CUSTOMER).length > 0) {
                 usersToExpand.add(current.id);
            }
            if (!current.managedBy) break;
            current = internalUsers.find(m => m.id === current!.managedBy);
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
  }, [searchTerm, internalUsers, findUsersByManagerId]);


  // FIX: Rewrote the entire getRoleOptionsForCurrentUser function to be a pure function that returns options without side effects.
  const getRoleOptionsForCurrentUser = (managerIdForNewUser?: string | null): { value: UserRole; label: string }[] => {
    const baseOptions = [
      { value: UserRole.STAFF, label: 'Nhân viên' },
      { value: UserRole.MANAGER, label: 'Quản lý' },
      { value: UserRole.OWNER, label: 'Chủ cửa hàng' },
      { value: UserRole.CHAIRMAN, label: 'Chủ tịch' },
    ];

    if (!currentUser) return [];
    
    // Logic for editing a user
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

    // Logic for adding a new user
    if (modalMode === 'add') {
        const manager = managerIdForNewUser ? users.find(u => u.id === managerIdForNewUser) : currentUser;
        if (!manager) return [];

        if (manager.role === UserRole.CHAIRMAN) {
            return baseOptions.filter(o => o.value === UserRole.OWNER);
        }
        if (manager.role === UserRole.OWNER) {
            return baseOptions.filter(o => o.value === UserRole.MANAGER || o.value === UserRole.STAFF);
        }
        if (manager.role === UserRole.MANAGER) {
            return baseOptions.filter(o => o.value === UserRole.STAFF);
        }
    }
    
    return []; // Return empty if no match
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
  
  const handleKpiTargetChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!editingUser) return;
    const { name, value } = e.target;
    const targetName = name as keyof NonNullable<User['kpiTargets']>;
    
    const newKpiTargets = {
        ...editingUser.kpiTargets,
        [targetName]: value === '' ? undefined : Number(value)
    };
    
    Object.keys(newKpiTargets).forEach(key => {
        if (newKpiTargets[key as keyof typeof newKpiTargets] === undefined) {
            delete newKpiTargets[key as keyof typeof newKpiTargets];
        }
    });

    setEditingUser({
        ...editingUser,
        kpiTargets: newKpiTargets,
    });
};


  const handleSaveUser = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!editingUser || !currentUser) return;

    const { name, username, password, passwordConfirmation, role, phone, managedBy, storeName, kpiTargets } = editingUser;

    if (!name?.trim() || !username?.trim() || !role) {
      setFormError('Tên, tên đăng nhập và vai trò là bắt buộc.');
      return;
    }

    if (modalMode === 'add' && !password) {
      setFormError('Mật khẩu là bắt buộc khi thêm người dùng mới.');
      return;
    }

    if (password) {
      if (password.length < 6) {
        setFormError('Mật khẩu phải có ít nhất 6 ký tự.');
        return;
      }
      if (password !== passwordConfirmation) {
        setFormError('Mật khẩu và xác nhận mật khẩu không khớp.');
        return;
      }
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
        kpiTargets: (kpiTargets && Object.keys(kpiTargets).length > 0) ? kpiTargets : undefined,
    };
    if (password) {
        (userData as User).password = password;
    }

    let storeProfilePayload: Omit<StoreProfile, 'ownerId'> | undefined = undefined;
    if (modalMode === 'add' && role === UserRole.OWNER) {
        storeProfilePayload = {
            storeName: storeName || `${name.trim()}'s Store (Mặc định)`,
            storeLogoUrl: '/default_logo.png',
            storePhone: phone?.trim() || 'Chưa có',
            storeAddress: 'Chưa có',
        };
    }

    let success = false;
    if (modalMode === 'add') {
      userData.managedBy = managingUserId || undefined;
      if (userData.role === UserRole.CHAIRMAN) userData.managedBy = undefined;

      const newUser = await addUser(userData as Omit<User, 'id'> & { managedBy?: string }, storeProfilePayload);
      success = !!newUser;
    } else if (editingUser.id) {
        const payloadForUpdate: Partial<User> & { id: string } = {
            id: editingUser.id,
            name: name.trim(),
            role: role,
            phone: phone?.trim() || undefined,
            managedBy: role === UserRole.CHAIRMAN ? undefined : managedBy,
            kpiTargets: (kpiTargets && Object.keys(kpiTargets).length > 0) ? kpiTargets : undefined,
        };
        
        if (password && password.trim()) {
            payloadForUpdate.password = password;
        }
        
        success = await updateUser(payloadForUpdate, undefined);
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
    let usersToRender = findUsersByManagerId(currentManagerId).filter(u => u.role !== UserRole.CUSTOMER);

    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      usersToRender = internalUsers.filter(u => { 
        const isDirectMatch = (u.name.toLowerCase().includes(lowerSearchTerm) || u.username.toLowerCase().includes(lowerSearchTerm));
        if (isDirectMatch) return true;

        let currentAncestor: User | undefined = u;
        while(currentAncestor?.managedBy) {
            const parent = internalUsers.find(p => p.id === currentAncestor!.managedBy);
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
            managedUsers={findUsersByManagerId(user.id).filter(u => u.role !== UserRole.CUSTOMER)}
            isExpanded={expandedNodes[user.id] || false}
            onToggleExpand={toggleExpandNode}
            searchTerm={searchTerm}
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
          (currentUser?.role === UserRole.OWNER) && (
            <Button variant="primary" onClick={() => openModal('add', null, currentUser.id)} leftIcon={<PlusCircleIcon size={18} />}>
              {'Thêm Người dùng Mới'}
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
        <Modal
          isOpen={isModalOpen}
          onClose={closeModal}
          title={modalMode === 'add' ? 'Thêm Người dùng mới' : `Sửa Người dùng: ${editingUser.name}`}
          size="lg"
        >
          <form onSubmit={handleSaveUser} className="space-y-4 pt-2 max-h-[70vh] overflow-y-auto pr-2">
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
                options={getRoleOptionsForCurrentUser(managingUserId)}
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

            { (editingUser.role === UserRole.STAFF || editingUser.role === UserRole.MANAGER) && (
              <fieldset className="border border-border-base p-3 rounded-md mt-4">
                  <legend className="text-sm font-medium text-text-muted px-1 -ml-1 flex items-center">
                      <TrendingUpIcon size={16} className="mr-1"/> Mục tiêu KPI
                  </legend>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 pt-2">
                      <Input label="Tỷ lệ đúng hạn (%)" name="onTimeRate" type="number" min="0" max="100" step="1" value={editingUser.kpiTargets?.onTimeRate ?? ''} onChange={handleKpiTargetChange} placeholder="VD: 98" />
                      <Input label="Đánh giá TB (1-5)" name="avgRating" type="number" min="1" max="5" step="0.1" value={editingUser.kpiTargets?.avgRating ?? ''} onChange={handleKpiTargetChange} placeholder="VD: 4.8" />
                      <Input label="Số đơn xử lý / kỳ" name="ordersProcessed" type="number" min="0" value={editingUser.kpiTargets?.ordersProcessed ?? ''} onChange={handleKpiTargetChange} placeholder="VD: 50" />
                      <Input label="Tiền Tip / kỳ (VND)" name="totalTipAmount" type="number" min="0" step="10000" value={editingUser.kpiTargets?.totalTipAmount ?? ''} onChange={handleKpiTargetChange} placeholder="VD: 500000" />
                  </div>
              </fieldset>
            )}
            
            {currentUser?.role === UserRole.CHAIRMAN && editingUser.role === UserRole.OWNER && (
              <fieldset className="border border-border-base p-3 rounded-md mt-4">
                <legend className="text-sm font-medium text-text-muted px-1 -ml-1 flex items-center"><HomeIcon size={16} className="mr-1"/> Thông tin Cửa hàng</legend>
                {modalMode === 'add' ? (
                  <>
                    <Input label="Tên cửa hàng*" name="storeName" value={editingUser.storeName || ''} onChange={handleInputChange} required className="mt-2"/>
                    <p className="text-xs text-text-muted mt-2">Các thông tin chi tiết khác của cửa hàng có thể được chỉnh sửa sau trong trang "Quản lý Cửa hàng".</p>
                  </>
                ) : (
                  <p className="text-sm text-text-muted p-2">
                      Để chỉnh sửa thông tin chi tiết của cửa hàng này, vui lòng truy cập trang <strong className="text-text-body">"Quản lý Cửa hàng"</strong>.
                  </p>
                )}
              </fieldset>
            )}
            
            <div className="mt-6 flex justify-end space-x-3 border-t border-border-base pt-4">
              <Button type="button" variant="secondary" onClick={closeModal}>Hủy</Button>
              <Button type="submit" variant="primary">
                {modalMode === 'add' ? 'Thêm Người dùng' : 'Lưu thay đổi'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {isDeleteConfirmOpen && userToDelete && (
        <Modal
          isOpen={isDeleteConfirmOpen}
          onClose={() => { setIsDeleteConfirmOpen(false); setUserToDelete(null); }}
          title="Xác nhận Xóa Người dùng"
          size="md"
          footerContent={
            <>
              <Button variant="secondary" onClick={() => { setIsDeleteConfirmOpen(false); setUserToDelete(null); }}>Hủy</Button>
              <Button variant="danger" onClick={confirmDeleteUser}>Xác nhận Xóa</Button>
            </>
          }
        >
          <p className="text-text-body">
            Bạn có chắc chắn muốn xóa người dùng <strong className="text-text-heading">{userToDelete.name} ({userToDelete.username})</strong>?
          </p>
          {findUsersByManagerId(userToDelete.id).length > 0 && 
            <p className="text-sm text-text-muted mt-2">
              Các nhân viên cấp dưới của người này sẽ được cập nhật người quản lý (nếu có thể). Hành động này không thể hoàn tác.
            </p>
          }
        </Modal>
      )}
    </>
  );
};

export default UserManagementPage;
