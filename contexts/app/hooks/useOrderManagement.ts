
import { useCallback } from 'react';
import { Order, OrderStatus, UserRole, User, StoreProfile, Promotion, InventoryItem, PaymentStatus } from '../../../types';

type Props = {
  currentUser: User | null;
  allOrdersData: Order[];
  setAllOrdersData: React.Dispatch<React.SetStateAction<Order[]>>;
  addNotification: (notification: any) => void;
  storeProfilesData: StoreProfile[];
  usersData: User[];
  setUsersData: React.Dispatch<React.SetStateAction<User[]>>;
  promotionsData: Promotion[];
  setPromotionsData: React.Dispatch<React.SetStateAction<Promotion[]>>;
  allInventoryData: InventoryItem[];
  setAllInventoryData: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
};

export const useOrderManagement = ({
  currentUser,
  allOrdersData,
  setAllOrdersData,
  addNotification,
  storeProfilesData,
  usersData,
  setUsersData,
  promotionsData,
  setPromotionsData,
  allInventoryData,
  setAllInventoryData,
}: Props) => {
  const addOrder = useCallback((order: Order) => {
    
    const newOrderWithPayment: Order = {
        ...order,
        paymentStatus: PaymentStatus.UNPAID,
    };

    // Loyalty Points Redemption Logic
    if (newOrderWithPayment.loyaltyPointsRedeemed && newOrderWithPayment.loyaltyPointsRedeemed > 0) {
      setUsersData(prevUsers => prevUsers.map(u => {
        if (u.id === newOrderWithPayment.customer.id) {
          const newPoints = Math.max(0, (u.loyaltyPoints || 0) - (newOrderWithPayment.loyaltyPointsRedeemed || 0));
          return { ...u, loyaltyPoints: newPoints };
        }
        return u;
      }));
      addNotification({
        message: `Đã sử dụng ${newOrderWithPayment.loyaltyPointsRedeemed} điểm cho khách hàng ${newOrderWithPayment.customer.name}.`,
        type: 'info',
        showToast: false // Avoid spamming toasts
      });
    }
    
    // Promotion Usage Tracking Logic
    if (newOrderWithPayment.appliedPromotionId) {
      const promotionToUpdate = promotionsData.find(p => p.id === newOrderWithPayment.appliedPromotionId);
      if (promotionToUpdate) {
        const updatedPromotion: Promotion = {
          ...promotionToUpdate,
          timesUsed: promotionToUpdate.timesUsed + 1,
          usedByCustomerIds: promotionToUpdate.usageLimitPerCustomer
            ? [...(promotionToUpdate.usedByCustomerIds || []), newOrderWithPayment.customer.id]
            : promotionToUpdate.usedByCustomerIds,
        };
        setPromotionsData(prev => prev.map(p => p.id === updatedPromotion.id ? updatedPromotion : p));
      }
    }


    setAllOrdersData(prev => [newOrderWithPayment, ...prev]);
    addNotification({
        message: `Đơn hàng mới ${newOrderWithPayment.id} cho KH ${newOrderWithPayment.customer.name} đã được tạo.`,
        type: 'success',
        orderId: newOrderWithPayment.id,
        showToast: true
    });
  }, [setAllOrdersData, setUsersData, addNotification, promotionsData, setPromotionsData]);
  
  const updateOrder = useCallback((updatedOrder: Order) => {
    const originalOrder = allOrdersData.find(o => o.id === updatedOrder.id);

    // --- Automatic Inventory Depletion Logic ---
    if (originalOrder && originalOrder.status === OrderStatus.PENDING && updatedOrder.status === OrderStatus.PROCESSING) {
        const deductions = new Map<string, number>();
        updatedOrder.items.forEach(item => {
            item.serviceItem.requiredMaterials?.forEach(mat => {
                const totalToDeduct = mat.quantityUsedPerUnit * item.quantity;
                const currentDeduction = deductions.get(mat.inventoryItemId) || 0;
                deductions.set(mat.inventoryItemId, currentDeduction + totalToDeduct);
            });
        });

        if (deductions.size > 0) {
            setAllInventoryData(prevInventory => {
                const newInventory = [...prevInventory];
                deductions.forEach((amount, id) => {
                    const itemIndex = newInventory.findIndex(invItem => invItem.id === id);
                    if (itemIndex > -1) {
                        const originalItem = newInventory[itemIndex];
                        const newQuantity = originalItem.quantity - amount;
                        newInventory[itemIndex] = { ...originalItem, quantity: newQuantity };

                        // Trigger low-stock notification only when it crosses the threshold
                        if (newQuantity <= originalItem.lowStockThreshold && originalItem.quantity > originalItem.lowStockThreshold) {
                             addNotification({
                                 message: `Tồn kho thấp: ${originalItem.name} chỉ còn ${newQuantity.toFixed(2)} ${originalItem.unit}.`,
                                 type: 'warning',
                                 showToast: true,
                             });
                        }
                    }
                });
                return newInventory;
            });
             addNotification({
                message: `Đã tự động trừ tồn kho NVL cho đơn hàng ${updatedOrder.id}.`,
                type: 'info',
                showToast: false // This is a background action, no need to spam toasts
            });
        }
    }


    // Loyalty Points Accrual Logic
    if (originalOrder && originalOrder.status !== OrderStatus.RETURNED && updatedOrder.status === OrderStatus.RETURNED) {
      const storeProfile = storeProfilesData.find(p => p.ownerId === updatedOrder.ownerId);
      if (storeProfile?.loyaltySettings?.enabled && storeProfile.loyaltySettings.accrualRate > 0) {
        const pointsToAdd = Math.floor(updatedOrder.totalAmount / storeProfile.loyaltySettings.accrualRate);
        if (pointsToAdd > 0) {
          setUsersData(prevUsers => prevUsers.map(u => {
            if (u.id === updatedOrder.customer.id) {
              const newPoints = (u.loyaltyPoints || 0) + pointsToAdd;
              addNotification({
                message: `Khách hàng ${u.name} đã được cộng ${pointsToAdd} điểm. Tổng điểm: ${newPoints}.`,
                type: 'info',
                showToast: true
              });
              return { ...u, loyaltyPoints: newPoints };
            }
            return u;
          }));
        }
      }
    }

    setAllOrdersData(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
    addNotification({
        message: `Đơn hàng ${updatedOrder.id} đã được cập nhật.`,
        type: 'info',
        orderId: updatedOrder.id,
        showToast: true
    });
  }, [allOrdersData, storeProfilesData, setAllInventoryData, addNotification, setAllOrdersData, setUsersData]);

  const deleteOrder = useCallback((orderId: string, reason: string, deletedBy: UserRole) => {
    const orderToDelete = allOrdersData.find(o => o.id === orderId);
    if (orderToDelete) {
        const updatedOrder: Order = {
            ...orderToDelete,
            status: OrderStatus.DELETED_BY_ADMIN,
            scanHistory: [
                ...(orderToDelete.scanHistory || []),
                {
                    timestamp: new Date(),
                    action: 'Đơn hàng đã bị xóa',
                    scannedBy: deletedBy,
                    staffUserId: currentUser?.id,
                    reason: reason
                }
            ]
        };
        setAllOrdersData(prev => prev.map(o => o.id === orderId ? updatedOrder : o));
        addNotification({
            message: `Đơn hàng ${orderId} đã được xóa. Lý do: ${reason}`,
            type: 'warning',
            orderId: orderId,
            userRole: deletedBy,
            showToast: true
        });
    }
  }, [allOrdersData, currentUser, addNotification, setAllOrdersData]);

  const findOrder = useCallback((idOrPhone: string) => allOrdersData.find(o => o.id.toUpperCase() === idOrPhone.toUpperCase() || o.customer.phone === idOrPhone), [allOrdersData]);

  return {
    addOrder,
    updateOrder,
    deleteOrder,
    findOrder,
  };
};
