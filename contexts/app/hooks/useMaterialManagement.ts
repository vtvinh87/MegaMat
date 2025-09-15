
import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { UserRole, MaterialOrder, MaterialItemDefinition, MaterialOrderItemDetail } from '../../../types';

type Props = {
  currentUserOwnerId: string | null;
  materialItemDefinitionsData: MaterialItemDefinition[];
  setMaterialItemDefinitionsData: React.Dispatch<React.SetStateAction<MaterialItemDefinition[]>>;
  allMaterialOrdersData: MaterialOrder[];
  setAllMaterialOrdersData: React.Dispatch<React.SetStateAction<MaterialOrder[]>>;
  addNotification: (notification: any) => void;
};

export const useMaterialManagement = ({
  currentUserOwnerId,
  materialItemDefinitionsData,
  setMaterialItemDefinitionsData,
  allMaterialOrdersData,
  setAllMaterialOrdersData,
  addNotification,
}: Props) => {
  const addMaterialOrder = useCallback((orderData: { items: Array<{ materialItemDefinitionId: string; quantity: number; itemNotes?: string }>; createdBy: UserRole; notes?: string; }) => {
    if (!currentUserOwnerId) {
        addNotification({ message: "Không thể tạo đơn đặt NVL vì không xác định được cửa hàng.", type: "error", showToast: true });
        return;
    }
    let totalAmount = 0;
    const itemsWithSnapshots: MaterialOrderItemDetail[] = orderData.items.map(item => {
        const def = materialItemDefinitionsData.find(d => d.id === item.materialItemDefinitionId);
        const price = def?.price || 0;
        totalAmount += price * item.quantity;
        return {
            id: uuidv4(),
            materialItemDefinitionId: item.materialItemDefinitionId,
            nameSnapshot: def?.name || 'Lỗi NVL',
            unitSnapshot: def?.unit || 'Lỗi',
            unitPriceSnapshot: price,
            quantity: item.quantity,
            itemNotes: item.itemNotes
        };
    });

    const newOrder: MaterialOrder = {
        id: `MAT-${uuidv4().slice(0, 6).toUpperCase()}`,
        items: itemsWithSnapshots,
        createdBy: orderData.createdBy,
        status: 'Chờ duyệt',
        createdAt: new Date(),
        notes: orderData.notes,
        totalAmount,
        ownerId: currentUserOwnerId
    };
    setAllMaterialOrdersData(prev => [newOrder, ...prev]);
    addNotification({ message: `Đã tạo đơn đặt NVL mới ${newOrder.id}.`, type: 'success', showToast: true });
  }, [currentUserOwnerId, materialItemDefinitionsData, addNotification, setAllMaterialOrdersData]);

  const approveMaterialOrder = useCallback((orderId: string, approvedBy: UserRole, notes?: string) => {
    setAllMaterialOrdersData(prev => prev.map(o => {
        if (o.id === orderId) {
            addNotification({ message: `Đơn đặt NVL ${orderId} đã được duyệt.`, type: 'success', showToast: true });
            return { ...o, status: 'Đã duyệt', approvedBy, notes: notes || o.notes };
        }
        return o;
    }));
  }, [setAllMaterialOrdersData, addNotification]);

  const rejectMaterialOrder = useCallback((orderId: string, rejectedBy: UserRole, reason: string) => {
    setAllMaterialOrdersData(prev => prev.map(o => {
        if (o.id === orderId) {
            addNotification({ message: `Đơn đặt NVL ${orderId} đã bị từ chối.`, type: 'warning', showToast: true });
            return { ...o, status: 'Đã hủy', approvedBy: rejectedBy, notes: `Lý do từ chối: ${reason}` };
        }
        return o;
    }));
  }, [setAllMaterialOrdersData, addNotification]);

  const addMaterialItemDefinition = useCallback((definition: Omit<MaterialItemDefinition, 'id'>) => {
    const newDef = { ...definition, id: uuidv4() };
    setMaterialItemDefinitionsData(prev => [newDef, ...prev]);
    addNotification({ message: `Đã thêm danh mục NVL mới: ${newDef.name}`, type: 'success', showToast: true });
  }, [setMaterialItemDefinitionsData, addNotification]);

  const updateMaterialItemDefinition = useCallback((definitionToUpdate: MaterialItemDefinition) => {
    setMaterialItemDefinitionsData(prev => prev.map(d => d.id === definitionToUpdate.id ? definitionToUpdate : d));
    addNotification({ message: `Đã cập nhật danh mục NVL: ${definitionToUpdate.name}`, type: 'info', showToast: true });
  }, [setMaterialItemDefinitionsData, addNotification]);
  
  const deleteMaterialItemDefinition = useCallback((definitionId: string) => {
    setMaterialItemDefinitionsData(prev => prev.filter(d => d.id !== definitionId));
    addNotification({ message: 'Đã xóa một danh mục NVL.', type: 'warning', showToast: true });
  }, [setMaterialItemDefinitionsData, addNotification]);

  return {
    addMaterialOrder,
    approveMaterialOrder,
    rejectMaterialOrder,
    addMaterialItemDefinition,
    updateMaterialItemDefinition,
    deleteMaterialItemDefinition,
  };
};