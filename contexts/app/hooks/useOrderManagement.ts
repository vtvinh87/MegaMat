import { useCallback } from 'react';
import { Order, OrderStatus, UserRole, User, StoreProfile, Promotion, InventoryItem, PaymentStatus, LoyaltyHistoryEntry, InteractionHistoryEntry } from '../../../types';

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
  addUserInteraction: (customerId: string, interaction: Omit<InteractionHistoryEntry, 'timestamp' | 'staffUserId'> & { staffUserId?: string }) => void;
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
  addUserInteraction,
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
          const newHistoryEntry: LoyaltyHistoryEntry = {
            timestamp: new Date(),
            orderId: newOrderWithPayment.id,
            pointsChange: -Math.abs(newOrderWithPayment.loyaltyPointsRedeemed),
            reason: `Đổi điểm trừ vào đơn hàng ${newOrderWithPayment.id}`
          };
          const newHistory = [...(u.loyaltyHistory || []), newHistoryEntry];
          addNotification({
            message: `Đã sử dụng ${newOrderWithPayment.loyaltyPointsRedeemed} điểm cho khách hàng ${newOrderWithPayment.customer.name}.`,
            type: 'info',
            showToast: false // Avoid spamming toasts
          });
          return { ...u, loyaltyPoints: newPoints, loyaltyHistory: newHistory };
        }
        return u;
      }));
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

    const isNowCompletedOrReturned = (updatedOrder.status === OrderStatus.RETURNED || updatedOrder.status === OrderStatus.COMPLETED);
    const wasNotCompletedOrReturned = originalOrder && (originalOrder.status !== OrderStatus.RETURNED && originalOrder.status !== OrderStatus.COMPLETED);

    // --- NEW: Referral Program Logic ---
    if (wasNotCompletedOrReturned && isNowCompletedOrReturned) {
        const referee = usersData.find(u => u.id === updatedOrder.customer.id);
        
        const isFirstCompletedOrder = !allOrdersData.some(o => o.customer.id === updatedOrder.customer.id && (o.status === OrderStatus.RETURNED || o.status === OrderStatus.COMPLETED) && o.id !== updatedOrder.id);

        if (referee && !referee.hasReceivedReferralBonus && isFirstCompletedOrder && updatedOrder.referralCodeUsed) {
            const referrer = usersData.find(u => u.referralCode?.toLowerCase() === updatedOrder.referralCodeUsed?.toLowerCase());

            if (referrer && referrer.id !== referee.id) {
                const REWARD_POINTS = 500;

                setUsersData(prevUsers => prevUsers.map(user => {
                    if (user.id === referee.id) {
                        const newHistory: LoyaltyHistoryEntry = { timestamp: new Date(), pointsChange: REWARD_POINTS, reason: `Thưởng giới thiệu từ ${referrer.name}` };
                        addNotification({ message: `Bạn đã nhận được ${REWARD_POINTS} điểm thưởng giới thiệu!`, type: 'success', showToast: true, userId: referee.id });
                        return { ...user, loyaltyPoints: (user.loyaltyPoints || 0) + REWARD_POINTS, loyaltyHistory: [...(user.loyaltyHistory || []), newHistory], hasReceivedReferralBonus: true };
                    }
                    if (user.id === referrer.id) {
                        const newHistory: LoyaltyHistoryEntry = { timestamp: new Date(), pointsChange: REWARD_POINTS, reason: `Thưởng giới thiệu thành công: ${referee.name}` };
                        const newReferralEntry = { userId: referee.id, name: referee.name, firstOrderCompletedAt: new Date(), pointsAwarded: REWARD_POINTS };
                        addNotification({ message: `Bạn đã nhận được ${REWARD_POINTS} điểm khi giới thiệu thành công ${referee.name}!`, type: 'success', showToast: true, userId: referrer.id });
                        return { ...user, loyaltyPoints: (user.loyaltyPoints || 0) + REWARD_POINTS, loyaltyHistory: [...(user.loyaltyHistory || []), newHistory], successfulReferrals: [...(user.successfulReferrals || []), newReferralEntry] };
                    }
                    return user;
                }));
            }
        }
    }


    // Loyalty Points Accrual & Tier Upgrade Logic
    if (originalOrder && originalOrder.status !== OrderStatus.RETURNED && updatedOrder.status === OrderStatus.RETURNED) {
      const storeProfile = storeProfilesData.find(p => p.ownerId === updatedOrder.ownerId);
      
      if (storeProfile?.loyaltySettings?.enabled) {
          setUsersData(prevUsers => prevUsers.map(user => {
            if (user.id === updatedOrder.customer.id) {
              const updatedUser = { ...user };
              
              // 1. Lifetime Value & Tier Upgrade
              const tiers = storeProfile.loyaltySettings?.tiers?.sort((a, b) => b.minSpend - a.minSpend); // Descending for easy check
              if (tiers && tiers.length > 0) {
                  const newLifetimeValue = (user.lifetimeValue || 0) + updatedOrder.totalAmount;
                  const currentTierName = user.loyaltyTier || tiers[tiers.length - 1].name;
                  let newTier = tiers.find(t => newLifetimeValue >= t.minSpend);
                  if (!newTier) newTier = tiers[tiers.length - 1];
                  
                  updatedUser.lifetimeValue = newLifetimeValue;
                  updatedUser.loyaltyTier = newTier.name;

                  const currentTierIndex = tiers.findIndex(t => t.name === currentTierName);
                  const newTierIndex = tiers.findIndex(t => t.name === newTier!.name);
                  
                  if (newTierIndex < currentTierIndex) {
                    addNotification({
                        message: `Chúc mừng ${user.name}! Bạn đã được thăng hạng thành viên ${newTier.name}.`,
                        type: 'success', showToast: true, userId: user.id
                    });
                  }
              }

              // 2. Point Accrual
              const accrualRate = storeProfile.loyaltySettings?.accrualRate || 0;
              if (accrualRate > 0) {
                  const pointsToAdd = Math.floor(updatedOrder.totalAmount / accrualRate);
                  if (pointsToAdd > 0) {
                    updatedUser.loyaltyPoints = (user.loyaltyPoints || 0) + pointsToAdd;
                    const newHistoryEntry: LoyaltyHistoryEntry = {
                      timestamp: new Date(), orderId: updatedOrder.id,
                      pointsChange: pointsToAdd, reason: `Tích điểm từ đơn hàng ${updatedOrder.id}`
                    };
                    updatedUser.loyaltyHistory = [...(user.loyaltyHistory || []), newHistoryEntry];
                    addNotification({
                        message: `Khách hàng ${user.name} đã được cộng ${pointsToAdd} điểm. Tổng điểm: ${updatedUser.loyaltyPoints}.`,
                        type: 'info', showToast: true, userId: user.id
                    });
                  }
              }
              return updatedUser;
            }
            return user;
          }));
      }
    }
    
    // Automated Interaction Logging for Cancellation
    if (originalOrder && originalOrder.status !== OrderStatus.CANCELLED && updatedOrder.status === OrderStatus.CANCELLED) {
      const cancellationEntry = updatedOrder.scanHistory?.slice().reverse().find(
        entry => entry.action.toLowerCase().includes('hủy đơn hàng')
      );
      const reason = cancellationEntry?.reason || 'Không có lý do cụ thể';
      const staffId = cancellationEntry?.staffUserId || currentUser?.id || 'system';

      addUserInteraction(updatedOrder.customer.id, {
        channel: 'other',
        summary: `Hệ thống tự động ghi nhận: Đơn hàng ${updatedOrder.id} đã được hủy. Lý do: ${reason}`,
        staffUserId: staffId,
      });
    }


    setAllOrdersData(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
    addNotification({
        message: `Đơn hàng ${updatedOrder.id} đã được cập nhật.`,
        type: 'info',
        orderId: updatedOrder.id,
        showToast: true
    });
  }, [currentUser, allOrdersData, storeProfilesData, setAllInventoryData, addNotification, setAllOrdersData, setUsersData, addUserInteraction, usersData, promotionsData, setPromotionsData]);

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