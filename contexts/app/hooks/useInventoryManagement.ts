import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { InventoryItem, InventoryUpdateHistoryEntry, User, InventoryAdjustmentRequest, UserRole } from '../../../types';

type Props = {
  currentUser: User | null;
  currentUserOwnerId: string | null;
  allInventoryData: InventoryItem[];
  setAllInventoryData: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
  addNotification: (notification: any) => void;
  inventoryAdjustmentRequests: InventoryAdjustmentRequest[];
  setInventoryAdjustmentRequests: React.Dispatch<React.SetStateAction<InventoryAdjustmentRequest[]>>;
  usersData: User[];
  setAcknowledgedRejectedRequestsData: React.Dispatch<React.SetStateAction<string[]>>;
};

export const useInventoryManagement = ({
  currentUser,
  currentUserOwnerId,
  allInventoryData,
  setAllInventoryData,
  addNotification,
  inventoryAdjustmentRequests,
  setInventoryAdjustmentRequests,
  usersData,
  setAcknowledgedRejectedRequestsData,
}: Props) => {
  const addInventoryItem = useCallback((item: Omit<InventoryItem, 'id' | 'ownerId'>) => {
    if (!currentUserOwnerId) {
        addNotification({ message: "Lỗi: Không thể xác định cửa hàng để thêm vật tư.", type: 'error', showToast: true });
        return;
    }
    const newItem: InventoryItem = { ...item, id: uuidv4(), ownerId: currentUserOwnerId, history: [] };
    setAllInventoryData(prev => [newItem, ...prev]);
    addNotification({ message: `Đã thêm vật tư mới: ${newItem.name}`, type: 'success', showToast: true });
  }, [currentUserOwnerId, setAllInventoryData, addNotification]);

  // This function is now deprecated in favor of the approval workflow
  const updateInventoryItem = useCallback((itemToUpdate: InventoryItem, reason: string) => {
     addNotification({ message: "Hành động không được hỗ trợ, vui lòng sử dụng quy trình phê duyệt.", type: 'error', showToast: true });
  }, [addNotification]);

  const requestInventoryAdjustment = useCallback((itemId: string, requestedQuantity: number, reason: string) => {
    if (!currentUser) {
      addNotification({ message: "Lỗi: Không thể xác định người dùng.", type: 'error', showToast: true });
      return;
    }
    const item = allInventoryData.find(i => i.id === itemId);
    if (!item) {
      addNotification({ message: "Lỗi: Không tìm thấy vật tư để yêu cầu thay đổi.", type: 'error', showToast: true });
      return;
    }

    const newRequest: InventoryAdjustmentRequest = {
      id: uuidv4(),
      inventoryItemId: item.id,
      inventoryItemName: item.name,
      requestedByUserId: currentUser.id,
      reason,
      currentQuantity: item.quantity,
      requestedQuantity,
      status: 'pending',
      createdAt: new Date(),
      ownerId: item.ownerId,
    };

    setInventoryAdjustmentRequests(prev => [newRequest, ...prev]);
    addNotification({ message: `Đã gửi yêu cầu điều chỉnh cho "${item.name}".`, type: 'success', showToast: true });

    // FIX: Correctly find managers and owners of the item's store.
    // The User type does not have an 'ownerId' property. We need to traverse the management chain.
    const findOwnerIdForUser = (userId: string): string | null => {
        let user = usersData.find(u => u.id === userId);
        while (user) {
            if (user.role === UserRole.OWNER) return user.id;
            if (!user.managedBy || user.role === UserRole.CHAIRMAN) return null;
            user = usersData.find(u => u.id === user.managedBy);
        }
        return null;
    };

    const managersAndOwners = usersData.filter(u => {
        const userOwnerId = findOwnerIdForUser(u.id);
        if ( (u.role === UserRole.OWNER && u.id === item.ownerId) || (u.role === UserRole.MANAGER && userOwnerId === item.ownerId) ) {
            return true;
        }
        return false;
    });

    managersAndOwners.forEach(manager => {
        addNotification({
            message: `${currentUser.name} đã yêu cầu điều chỉnh tồn kho cho "${item.name}".`,
            type: 'warning',
            userId: manager.id,
            showToast: true,
        });
    });

  }, [currentUser, allInventoryData, setInventoryAdjustmentRequests, addNotification, usersData]);

  const approveInventoryAdjustment = useCallback((requestId: string) => {
    if (!currentUser) {
        addNotification({ message: "Lỗi: Không thể xác định người duyệt.", type: 'error', showToast: true });
        return;
    }
    const request = inventoryAdjustmentRequests.find(r => r.id === requestId);
    if (!request) {
        addNotification({ message: "Lỗi: Không tìm thấy yêu cầu.", type: 'error', showToast: true });
        return;
    }

    // 1. Update Inventory Item
    setAllInventoryData(prev => prev.map(item => {
        if (item.id === request.inventoryItemId) {
            const historyEntry: InventoryUpdateHistoryEntry = {
                requestedAt: request.createdAt,
                respondedAt: new Date(),
                requestedByUserId: request.requestedByUserId,
                respondedByUserId: currentUser.id,
                reason: request.reason,
                previousQuantity: request.currentQuantity,
                newQuantity: request.requestedQuantity,
                status: 'approved',
            };
            return {
                ...item,
                quantity: request.requestedQuantity,
                history: [...(item.history || []), historyEntry],
            };
        }
        return item;
    }));

    // 2. Update Request Status
    setInventoryAdjustmentRequests(prev => prev.map(r => 
        r.id === requestId 
        ? { ...r, status: 'approved', respondedByUserId: currentUser.id, respondedAt: new Date() } 
        : r
    ));

    // 3. Notify
    addNotification({ message: `Đã duyệt yêu cầu điều chỉnh cho "${request.inventoryItemName}".`, type: 'success', showToast: true });
    addNotification({ 
        message: `Yêu cầu điều chỉnh tồn kho cho "${request.inventoryItemName}" của bạn đã được duyệt.`, 
        type: 'info', 
        userId: request.requestedByUserId,
        showToast: true 
    });

  }, [currentUser, inventoryAdjustmentRequests, setAllInventoryData, setInventoryAdjustmentRequests, addNotification]);

  const rejectInventoryAdjustment = useCallback((requestId: string, rejectionReason: string) => {
    if (!currentUser) {
        addNotification({ message: "Lỗi: Không thể xác định người từ chối.", type: 'error', showToast: true });
        return;
    }
     const request = inventoryAdjustmentRequests.find(r => r.id === requestId);
    if (!request) {
        addNotification({ message: "Lỗi: Không tìm thấy yêu cầu.", type: 'error', showToast: true });
        return;
    }
    
    // 1. Add rejected entry to inventory history
    setAllInventoryData(prev => prev.map(item => {
        if (item.id === request.inventoryItemId) {
            const historyEntry: InventoryUpdateHistoryEntry = {
                requestedAt: request.createdAt,
                respondedAt: new Date(),
                requestedByUserId: request.requestedByUserId,
                respondedByUserId: currentUser.id,
                reason: request.reason, // Request reason
                previousQuantity: request.currentQuantity,
                newQuantity: request.requestedQuantity, // The proposed (rejected) quantity
                status: 'rejected',
                rejectionReason: rejectionReason, // Rejection reason
            };
            return {
                ...item,
                history: [...(item.history || []), historyEntry],
            };
        }
        return item;
    }));
    
    // 2. Update Request Status
    setInventoryAdjustmentRequests(prev => prev.map(r => 
        r.id === requestId 
        ? { ...r, status: 'rejected', respondedByUserId: currentUser.id, respondedAt: new Date(), rejectionReason } 
        : r
    ));

    // 3. Notify
    addNotification({ message: `Đã từ chối yêu cầu cho "${request.inventoryItemName}".`, type: 'warning', showToast: true });
    addNotification({ 
        message: `Yêu cầu điều chỉnh tồn kho cho "${request.inventoryItemName}" của bạn đã bị từ chối. Lý do: ${rejectionReason}`, 
        type: 'error', 
        userId: request.requestedByUserId,
        showToast: true 
    });
  }, [currentUser, inventoryAdjustmentRequests, setAllInventoryData, setInventoryAdjustmentRequests, addNotification]);

  const acknowledgeRejectedRequest = useCallback((requestId: string) => {
    setAcknowledgedRejectedRequestsData(prev => {
        if (prev.includes(requestId)) {
            return prev;
        }
        return [...prev, requestId];
    });
  }, [setAcknowledgedRejectedRequestsData]);

  const acknowledgeAllRejectedRequestsForItem = useCallback((itemId: string) => {
    if (!currentUser) return;
    
    const requestIdsToAcknowledge = inventoryAdjustmentRequests
      .filter(req => 
        req.inventoryItemId === itemId &&
        req.status === 'rejected' &&
        req.requestedByUserId === currentUser.id
      )
      .map(req => req.id);

    if (requestIdsToAcknowledge.length > 0) {
      setAcknowledgedRejectedRequestsData(prev => {
        const newAcks = new Set([...prev, ...requestIdsToAcknowledge]);
        return Array.from(newAcks);
      });
      addNotification({ message: 'Đã ẩn cảnh báo cho vật tư này.', type: 'info', showToast: true });
    }
  }, [currentUser, inventoryAdjustmentRequests, setAcknowledgedRejectedRequestsData, addNotification]);


  return {
    addInventoryItem,
    updateInventoryItem, // Kept for compatibility, but should not be used for quantity changes.
    requestInventoryAdjustment,
    approveInventoryAdjustment,
    rejectInventoryAdjustment,
    acknowledgeRejectedRequest,
    acknowledgeAllRejectedRequestsForItem,
  };
};