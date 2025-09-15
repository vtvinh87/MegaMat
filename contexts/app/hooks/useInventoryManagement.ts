
import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { InventoryItem } from '../../../types';

type Props = {
  currentUserOwnerId: string | null;
  allInventoryData: InventoryItem[];
  setAllInventoryData: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
  addNotification: (notification: any) => void;
};

export const useInventoryManagement = ({
  currentUserOwnerId,
  allInventoryData,
  setAllInventoryData,
  addNotification,
}: Props) => {
  const addInventoryItem = useCallback((item: Omit<InventoryItem, 'id' | 'ownerId'>) => {
    if (!currentUserOwnerId) {
        addNotification({ message: "Lỗi: Không thể xác định cửa hàng để thêm vật tư.", type: 'error', showToast: true });
        return;
    }
    const newItem: InventoryItem = { ...item, id: uuidv4(), ownerId: currentUserOwnerId };
    setAllInventoryData(prev => [newItem, ...prev]);
    addNotification({ message: `Đã thêm vật tư mới: ${newItem.name}`, type: 'success', showToast: true });
  }, [currentUserOwnerId, setAllInventoryData, addNotification]);

  const updateInventoryItem = useCallback((itemToUpdate: InventoryItem) => {
    setAllInventoryData(prev => prev.map(i => i.id === itemToUpdate.id ? itemToUpdate : i));
    addNotification({ message: `Đã cập nhật vật tư: ${itemToUpdate.name}`, type: 'info', showToast: true });
  }, [setAllInventoryData, addNotification]);

  return {
    addInventoryItem,
    updateInventoryItem,
  };
};