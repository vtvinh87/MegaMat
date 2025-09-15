import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { WashMethodDefinition } from '../../../types';

type Props = {
  currentUserOwnerId: string | null;
  washMethodsData: WashMethodDefinition[];
  setWashMethodsData: React.Dispatch<React.SetStateAction<WashMethodDefinition[]>>;
  addNotification: (notification: any) => void;
};

export const useWashMethodManagement = ({
  currentUserOwnerId,
  setWashMethodsData,
  addNotification,
}: Props) => {
  const addWashMethod = useCallback((methodData: Omit<WashMethodDefinition, 'id' | 'ownerId'>) => {
    if (!currentUserOwnerId) {
        addNotification({ message: "Lỗi: Không thể xác định cửa hàng để thêm phương pháp giặt.", type: 'error', showToast: true });
        return;
    }
    const newMethod: WashMethodDefinition = { ...methodData, id: uuidv4(), ownerId: currentUserOwnerId };
    setWashMethodsData(prev => [...prev, newMethod]);
    addNotification({ message: `Đã thêm phương pháp giặt mới: ${newMethod.name}`, type: 'success', showToast: true });
  }, [currentUserOwnerId, setWashMethodsData, addNotification]);
  
  const updateWashMethod = useCallback((methodToUpdate: WashMethodDefinition) => {
    setWashMethodsData(prev => prev.map(m => m.id === methodToUpdate.id ? methodToUpdate : m));
    addNotification({ message: `Đã cập nhật phương pháp giặt: ${methodToUpdate.name}`, type: 'info', showToast: true });
  }, [setWashMethodsData, addNotification]);

  const deleteWashMethod = useCallback((methodId: string) => {
    // Note: Add logic here to check if the method is in use by any service if needed.
    setWashMethodsData(prev => prev.filter(m => m.id !== methodId));
    addNotification({ message: `Đã xóa một phương pháp giặt.`, type: 'warning', showToast: true });
  }, [setWashMethodsData, addNotification]);

  return {
    addWashMethod,
    updateWashMethod,
    deleteWashMethod,
  };
};
