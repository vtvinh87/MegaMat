
import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { User, UserRole, VariableCost, VariableCostInput, FixedCostItem, FixedCostUpdateHistoryEntry } from '../../../types';

type Props = {
  currentUser: User | null;
  currentUserOwnerId: string | null;
  allVariableCostsData: VariableCost[];
  setAllVariableCostsData: React.Dispatch<React.SetStateAction<VariableCost[]>>;
  allFixedCostsData: FixedCostItem[];
  setAllFixedCostsData: React.Dispatch<React.SetStateAction<FixedCostItem[]>>;
  fixedCostsUpdateHistoryData: FixedCostUpdateHistoryEntry[];
  setFixedCostsUpdateHistoryData: React.Dispatch<React.SetStateAction<FixedCostUpdateHistoryEntry[]>>;
  addNotification: (notification: any) => void;
};

export const useFinancialManagement = ({
  currentUser,
  currentUserOwnerId,
  allVariableCostsData,
  setAllVariableCostsData,
  allFixedCostsData,
  setAllFixedCostsData,
  fixedCostsUpdateHistoryData,
  setFixedCostsUpdateHistoryData,
  addNotification,
}: Props) => {
  const addVariableCost = useCallback((costData: VariableCostInput) => {
    if (!currentUserOwnerId) {
        addNotification({ message: "Lỗi: Không thể xác định cửa hàng để thêm chi phí.", type: 'error', showToast: true });
        return;
    }
    const newCost: VariableCost = {
        ...costData,
        id: uuidv4(),
        ownerId: currentUserOwnerId,
        enteredBy: currentUser!.role,
        history: [{ timestamp: new Date(), action: 'created', changedBy: currentUser!.role }]
    };
    setAllVariableCostsData(prev => [newCost, ...prev]);
    addNotification({ message: `Đã thêm chi phí mới: ${newCost.description}`, type: 'success', showToast: true });
  }, [currentUser, currentUserOwnerId, addNotification, setAllVariableCostsData]);

  const updateVariableCost = useCallback((costId: string, updates: Partial<VariableCostInput>, reason: string, updatedBy: UserRole) => {
    setAllVariableCostsData(prev => prev.map(cost => {
        if (cost.id === costId) {
            const updatedCost: VariableCost = {
                ...cost,
                ...updates,
                lastUpdatedBy: updatedBy,
                history: [
                    ...cost.history,
                    {
                        timestamp: new Date(),
                        action: 'updated',
                        changedBy: updatedBy,
                        reason,
                        previousValues: { description: cost.description, amount: cost.amount, date: cost.date, category: cost.category }
                    }
                ]
            };
            addNotification({ message: `Đã cập nhật chi phí: ${updatedCost.description}`, type: 'info', showToast: true });
            return updatedCost;
        }
        return cost;
    }));
  }, [addNotification, setAllVariableCostsData]);

  const deleteVariableCost = useCallback((costId: string, reason: string, deletedBy: UserRole) => {
    const costToDelete = allVariableCostsData.find(c => c.id === costId);
    if (costToDelete) {
         setAllVariableCostsData(prev => prev.filter(c => c.id !== costId));
         addNotification({ message: `Đã xóa chi phí "${costToDelete.description}". Lý do: ${reason}`, type: 'warning', showToast: true});
    }
  }, [allVariableCostsData, addNotification, setAllVariableCostsData]);
  
  const updateFixedCosts = useCallback((updatedFixedCostItems: Omit<FixedCostItem, 'ownerId'>[], reason: string, changedBy: UserRole, targetOwnerIdParam?: string) => {
    const targetOwnerId = targetOwnerIdParam || currentUserOwnerId;
    if (!targetOwnerId) {
        addNotification({ message: "Không thể cập nhật chi phí cố định: không xác định được cửa hàng.", type: 'error', showToast: true });
        return;
    }

    const previousValues = allFixedCostsData.filter(fc => fc.ownerId === targetOwnerId);
    
    const newFixedCostsForOwner = updatedFixedCostItems.map(fc => ({...fc, id: fc.id || uuidv4(), ownerId: targetOwnerId}));
    const otherOwnersCosts = allFixedCostsData.filter(fc => fc.ownerId !== targetOwnerId);

    setAllFixedCostsData([...otherOwnersCosts, ...newFixedCostsForOwner]);
    
    const historyEntry: FixedCostUpdateHistoryEntry = {
        timestamp: new Date(),
        reason,
        changedBy,
        previousValues,
        ownerId: targetOwnerId,
    };
    setFixedCostsUpdateHistoryData(prev => [historyEntry, ...prev]);
    addNotification({ message: `Đã cập nhật chi phí cố định cho cửa hàng.`, type: 'success', showToast: true });
  }, [currentUserOwnerId, allFixedCostsData, addNotification, setAllFixedCostsData, setFixedCostsUpdateHistoryData]);

  return {
    addVariableCost,
    updateVariableCost,
    deleteVariableCost,
    updateFixedCosts,
  };
};