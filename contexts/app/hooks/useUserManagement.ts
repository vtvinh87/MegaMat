
import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { User, UserRole, StoreProfile, StoreUpdateHistoryEntry } from '../../../types';
import { simpleHash } from '../utils';

type Props = {
  currentUser: User | null;
  usersData: User[];
  setUsersData: React.Dispatch<React.SetStateAction<User[]>>;
  storeProfilesData: StoreProfile[];
  setStoreProfilesData: React.Dispatch<React.SetStateAction<StoreProfile[]>>;
  storeUpdateHistoryData: StoreUpdateHistoryEntry[];
  setStoreUpdateHistoryData: React.Dispatch<React.SetStateAction<StoreUpdateHistoryEntry[]>>;
  setAllInventoryData: React.Dispatch<React.SetStateAction<any[]>>;
  setAllOrdersData: React.Dispatch<React.SetStateAction<any[]>>;
  addNotification?: (notification: any) => void;
};

export const useUserManagement = ({
  currentUser,
  usersData,
  setUsersData,
  storeProfilesData,
  setStoreProfilesData,
  storeUpdateHistoryData,
  setStoreUpdateHistoryData,
  setAllInventoryData,
  setAllOrdersData,
  addNotification = () => {},
}: Props) => {

  const getOwnerIdForUser = useCallback((userId: string, allUsers: User[]): string | null => {
    let currentUserToCheck = allUsers.find(u => u.id === userId);
    if (!currentUserToCheck) return null;

    if (currentUserToCheck.role === UserRole.CHAIRMAN) return null;
    if (currentUserToCheck.role === UserRole.OWNER) return currentUserToCheck.id;

    while (currentUserToCheck && currentUserToCheck.managedBy) {
      const manager = allUsers.find(u => u.id === currentUserToCheck!.managedBy);
      if (!manager) return null; 
      if (manager.role === UserRole.OWNER) return manager.id;
      if (manager.role === UserRole.CHAIRMAN) return null; 
      currentUserToCheck = manager;
    }
    return null;
  }, []);

  const getCurrentUserOwnerId = useCallback((): string | null => {
    if (!currentUser) return null;
    return getOwnerIdForUser(currentUser.id, usersData);
  }, [currentUser, usersData, getOwnerIdForUser]);

  const findUserById = useCallback((userId: string) => usersData.find(u => u.id === userId), [usersData]);

  const findUsersByManagerId = useCallback((managerId: string | null): User[] => {
    return usersData.filter(user => user.managedBy == managerId);
  }, [usersData]);
  
  const updateStoreProfile = useCallback((profileData: Partial<StoreProfile> & { ownerId: string }, reason: string) => {
      let previousValues: Partial<Omit<StoreProfile, 'ownerId'>> = {};
      const existingProfile = storeProfilesData.find(p => p.ownerId === profileData.ownerId);

      setStoreProfilesData(prev => prev.map(p => {
          if (p.ownerId === profileData.ownerId) {
              previousValues = {
                  storeName: p.storeName,
                  storeLogoUrl: p.storeLogoUrl,
                  storePhone: p.storePhone,
                  storeAddress: p.storeAddress
              };
              return { ...p, ...profileData };
          }
          return p;
      }));

      const historyEntry: StoreUpdateHistoryEntry = {
          timestamp: new Date(),
          reason,
          changedBy: currentUser!.role,
          ownerId: profileData.ownerId,
          previousValues
      };
      setStoreUpdateHistoryData(prev => [historyEntry, ...prev]);

      addNotification({ message: `Đã cập nhật thông tin cửa hàng.`, type: 'info', showToast: true });
  }, [storeProfilesData, currentUser, addNotification, setStoreProfilesData, setStoreUpdateHistoryData]);

  const addUser = useCallback(async (userData: Omit<User, 'id'> & { managedBy?: string }, storeProfileData?: Omit<StoreProfile, 'ownerId'>): Promise<User | null> => {
    if (usersData.some(u => u.username.toLowerCase() === userData.username.toLowerCase())) {
        addNotification({ message: `Tên đăng nhập "${userData.username}" đã tồn tại.`, type: 'error', showToast: true });
        return null;
    }

    const hashedPassword = await simpleHash(userData.password);
    const newUserId = uuidv4();
    const lastName = userData.name.split(' ').pop()?.toUpperCase() || 'USER';

    const newUser: User = {
        ...userData,
        id: newUserId,
        password: hashedPassword,
        referralCode: userData.role === UserRole.CUSTOMER ? `MEGA${lastName.substring(0,3)}${newUserId.slice(-3)}` : undefined,
    };

    setUsersData(prev => [...prev, newUser]);
    
    if (newUser.role === UserRole.OWNER && storeProfileData) {
        const newProfile: StoreProfile = {
            ...storeProfileData,
            ownerId: newUserId,
        };
        setStoreProfilesData(prev => [...prev, newProfile]);
    }

    if (newUser.role === UserRole.CUSTOMER) {
      addNotification({ 
        message: `Tài khoản của bạn đã được tạo với SĐT ${newUser.phone}. Mật khẩu mặc định của bạn là "123123". Vui lòng đổi mật khẩu sau khi đăng nhập lần đầu.`, 
        type: 'success', 
        showToast: true
      });
    } else {
      addNotification({ message: `Đã thêm người dùng mới: ${newUser.name}`, type: 'success', showToast: true });
    }
    
    return newUser;
  }, [usersData, addNotification, setUsersData, setStoreProfilesData]);

  const updateUser = useCallback(async (userData: Partial<User> & { id: string }, storeProfileData?: Partial<Omit<StoreProfile, 'ownerId'>>): Promise<boolean> => {
    // Tạo một bản sao có thể thay đổi của các thông tin cập nhật.
    const updates = { ...userData };

    // Xác thực tính duy nhất của username nếu nó đang được thay đổi.
    if (updates.username && usersData.some(u => u.username.toLowerCase() === updates.username!.toLowerCase() && u.id !== updates.id)) {
        addNotification({ message: `Tên đăng nhập "${updates.username}" đã tồn tại.`, type: 'error', showToast: true });
        return false;
    }
    
    // Xử lý cập nhật mật khẩu một cách an toàn.
    // Chỉ mã hóa và bao gồm mật khẩu nếu một mật khẩu mới, không rỗng được cung cấp.
    // FIX: The call to simpleHash was missing its argument. It should be passed updates.password.
    if (updates.password && updates.password.trim()) {
        updates.password = await simpleHash(updates.password);
    } else {
        // Nếu mật khẩu là rỗng, không xác định, hoặc chỉ chứa khoảng trắng, XÓA nó khỏi đối tượng cập nhật.
        // Đây là bước quan trọng để ngăn chặn việc ghi đè lên mật khẩu hợp lệ hiện có.
        delete updates.password;
    }

    setUsersData(prevUsers =>
        prevUsers.map(user => {
            if (user.id === updates.id) {
                // Áp dụng các thay đổi đã được làm sạch vào người dùng hiện có.
                const updatedUser = { ...user, ...updates };
                addNotification({ message: `Đã cập nhật người dùng: ${updatedUser.name}`, type: 'info', showToast: true });

                // Xử lý cập nhật hồ sơ cửa hàng liên quan cho chủ sở hữu.
                if (updatedUser.role === UserRole.OWNER && storeProfileData) {
                    updateStoreProfile({ ...storeProfileData, ownerId: updatedUser.id }, "Cập nhật thông tin người dùng chủ sở hữu.");
                }
                
                return updatedUser;
            }
            return user;
        })
    );
    
    return true;
}, [usersData, setUsersData, addNotification, updateStoreProfile]);
  
  const deleteUser = useCallback((userId: string) => {
    const userToDelete = usersData.find(u => u.id === userId);
    if (!userToDelete) return;
    
    const subordinates = usersData.filter(u => u.managedBy === userId);
    const newManagerId = userToDelete.managedBy;

    setUsersData(prev => {
        const remainingUsers = prev.filter(u => u.id !== userId);
        return remainingUsers.map(u => {
            if (subordinates.some(sub => sub.id === u.id)) {
                return { ...u, managedBy: newManagerId };
            }
            return u;
        });
    });
    
    if (userToDelete.role === UserRole.OWNER) {
        setStoreProfilesData(prev => prev.filter(p => p.ownerId !== userId));
    }

    addNotification({ message: `Đã xóa người dùng: ${userToDelete.name}`, type: 'warning', showToast: true });
  }, [usersData, addNotification, setUsersData, setStoreProfilesData]);

  const deleteStoreAndOwner = useCallback((ownerId: string, reason: string) => {
    const ownerToDelete = usersData.find(u => u.id === ownerId && u.role === UserRole.OWNER);
    if (!ownerToDelete) {
        addNotification({ message: 'Không tìm thấy chủ sở hữu để xóa.', type: 'error', showToast: true });
        return;
    }

    const usersToDelete = new Set<string>([ownerId]);
    const queue = [ownerId];
    while (queue.length > 0) {
        const managerId = queue.shift()!;
        usersData.forEach(u => {
            if (u.managedBy === managerId) {
                usersToDelete.add(u.id);
                queue.push(u.id);
            }
        });
    }
    
    setUsersData(prev => prev.filter(u => !usersToDelete.has(u.id)));
    setStoreProfilesData(prev => prev.filter(p => p.ownerId !== ownerId));
    setAllInventoryData(prev => prev.filter(i => i.ownerId !== ownerId));
    setAllOrdersData(prev => prev.filter(o => o.ownerId !== ownerId));

    addNotification({ message: `Đã xóa cửa hàng của ${ownerToDelete.name} và tất cả nhân viên liên quan. Lý do: ${reason}`, type: 'warning', showToast: true });
  }, [usersData, addNotification, setUsersData, setStoreProfilesData, setAllInventoryData, setAllOrdersData]);
  
  const findStoreProfileByOwnerId = useCallback((ownerId: string) => storeProfilesData.find(p => p.ownerId === ownerId), [storeProfilesData]);

  return {
    findUserById,
    findUsersByManagerId,
    getOwnerIdForUser,
    getCurrentUserOwnerId,
    addUser,
    updateUser,
    deleteUser,
    updateStoreProfile,
    findStoreProfileByOwnerId,
    deleteStoreAndOwner,
  };
};
