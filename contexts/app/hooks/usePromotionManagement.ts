

import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Promotion, User, UserRole, ManagerReport } from '../../../types';

type Props = {
  currentUser: User | null;
  currentUserOwnerId: string | null;
  promotionsData: Promotion[];
  setPromotionsData: React.Dispatch<React.SetStateAction<Promotion[]>>;
  addNotification: (notification: any) => void;
  usersData: User[];
  setAcknowledgedSystemPromos: React.Dispatch<React.SetStateAction<{ [ownerId: string]: string[] }>>;
  setAcknowledgedCancelRequests: React.Dispatch<React.SetStateAction<{ [ownerId: string]: string[] }>>;
  setAcknowledgedOptOutRequests: React.Dispatch<React.SetStateAction<{ [chairmanId: string]: string[] }>>;
};

export const usePromotionManagement = ({
  currentUser,
  currentUserOwnerId,
  promotionsData,
  setPromotionsData,
  addNotification,
  usersData,
  setAcknowledgedSystemPromos,
  setAcknowledgedCancelRequests,
  setAcknowledgedOptOutRequests,
}: Props) => {

  const acknowledgeSystemPromo = useCallback((promotionId: string) => {
    if (!currentUser || currentUser.role !== UserRole.OWNER) return;
    setAcknowledgedSystemPromos(prev => ({
      ...prev,
      [currentUser.id]: [...(prev[currentUser.id] || []), promotionId],
    }));
  }, [currentUser, setAcknowledgedSystemPromos]);

  const acknowledgeCancelRequest = useCallback((promotionId: string) => {
    if (!currentUser || currentUser.role !== UserRole.OWNER) return;
    setAcknowledgedCancelRequests(prev => ({
      ...prev,
      [currentUser.id]: [...(prev[currentUser.id] || []), promotionId],
    }));
  }, [currentUser, setAcknowledgedCancelRequests]);

  const acknowledgeOptOutRequest = useCallback((promotionId: string, storeOwnerId: string) => {
    if (!currentUser || currentUser.role !== UserRole.CHAIRMAN) return;
    const requestId = `${promotionId}::${storeOwnerId}`;
    setAcknowledgedOptOutRequests(prev => {
        const existingAcks = prev[currentUser.id] || [];
        if (existingAcks.includes(requestId)) return prev; // already acknowledged
        return {
            ...prev,
            [currentUser.id]: [...existingAcks, requestId],
        };
    });
  }, [currentUser, setAcknowledgedOptOutRequests]);


  const requestPromotionOptOut = useCallback((promotionId: string, reason: string) => {
    if (!currentUser || currentUser.role !== UserRole.OWNER) {
      addNotification({ message: "Chỉ chủ cửa hàng mới có thể yêu cầu từ chối.", type: 'error', showToast: true });
      return;
    }
    setPromotionsData(prev => prev.map(p => {
      if (p.id === promotionId && p.isSystemWide) {
        const existingRequest = p.optOutRequests?.find(req => req.storeOwnerId === currentUser.id);
        if (existingRequest && existingRequest.status === 'pending') {
            addNotification({ message: "Bạn đã gửi yêu cầu cho khuyến mãi này.", type: 'warning', showToast: true });
            return p;
        }
        // Allow re-request if rejected before
        const otherRequests = p.optOutRequests?.filter(req => req.storeOwnerId !== currentUser.id) || [];
        const newRequest = { storeOwnerId: currentUser.id, reason, status: 'pending' as const };
        addNotification({ message: "Đã gửi yêu cầu từ chối tham gia đến Chủ tịch.", type: 'success', showToast: true, userId: p.ownerId });
        return { ...p, optOutRequests: [...otherRequests, newRequest] };
      }
      return p;
    }));
  }, [currentUser, setPromotionsData, addNotification]);

  const respondToOptOutRequest = useCallback((promotionId: string, storeOwnerId: string, response: 'approved' | 'rejected', rejectionReason?: string) => {
    if (!currentUser || currentUser.role !== UserRole.CHAIRMAN) {
      addNotification({ message: "Chỉ Chủ tịch mới có thể phản hồi yêu cầu.", type: 'error', showToast: true });
      return;
    }
    setPromotionsData(prev => prev.map(p => {
      if (p.id === promotionId) {
        const updatedRequests = p.optOutRequests?.map(req => 
          req.storeOwnerId === storeOwnerId && req.status === 'pending'
            ? { ...req, status: response, respondedBy: currentUser.id, respondedAt: new Date(), rejectionReason: response === 'rejected' ? rejectionReason : undefined }
            : req
        );
        
        let notificationMessage = `Chủ tịch đã ${response === 'approved' ? 'chấp thuận' : 'từ chối'} yêu cầu từ chối tham gia KM "${p.name}" của bạn.`;
        if (response === 'rejected' && rejectionReason) {
            notificationMessage += ` Lý do: "${rejectionReason}"`;
        }

        addNotification({ 
          message: notificationMessage, 
          type: 'info', 
          showToast: true,
          userId: storeOwnerId
        });
        return { ...p, optOutRequests: updatedRequests };
      }
      return p;
    }));
  }, [currentUser, setPromotionsData, addNotification]);

  const requestPromotionCancellation = useCallback((promotionId: string, reason: string) => {
    if (!currentUser || currentUser.role !== UserRole.CHAIRMAN) {
      addNotification({ message: "Chỉ Chủ tịch mới có thể yêu cầu hủy.", type: 'error', showToast: true });
      return;
    }
    let promotionOwnerId: string | undefined;
    setPromotionsData(prev => prev.map(p => {
      if (p.id === promotionId && !p.isSystemWide) {
        promotionOwnerId = p.ownerId;
        if (p.cancellationRequest?.status === 'pending') {
            addNotification({ message: "Yêu cầu hủy đã tồn tại cho khuyến mãi này.", type: 'warning', showToast: true });
            return p;
        }
        const newRequest = { requestedBy: currentUser.id, reason, status: 'pending' as const };
        return { ...p, cancellationRequest: newRequest };
      }
      return p;
    }));
    if (promotionOwnerId) {
        const promotion = promotionsData.find(p => p.id === promotionId);
        addNotification({ 
            message: `Chủ tịch đã yêu cầu hủy khuyến mãi "${promotion?.name}".`, 
            type: 'warning', 
            showToast: true,
            userId: promotionOwnerId
        });
    }
  }, [currentUser, setPromotionsData, addNotification, promotionsData]);

  const respondToCancellationRequest = useCallback((promotionId: string, response: 'approved') => { // Only approval is possible
    if (!currentUser || currentUser.role !== UserRole.OWNER) {
        addNotification({ message: "Chỉ chủ cửa hàng mới có thể phản hồi.", type: 'error', showToast: true });
        return;
    }
    let chairmanId: string | undefined;
    setPromotionsData(prev => prev.map(p => {
        if (p.id === promotionId && p.ownerId === currentUser.id && p.cancellationRequest?.status === 'pending') {
            const updatedRequest = { ...p.cancellationRequest, status: 'approved' as const, respondedAt: new Date() };
            chairmanId = p.cancellationRequest.requestedBy;
            addNotification({ message: `Đã chấp thuận hủy khuyến mãi "${p.name}". Chương trình đã được vô hiệu hóa.`, type: 'success', showToast: true });
            return { ...p, cancellationRequest: updatedRequest, status: 'inactive' };
        }
        return p;
    }));
     if (chairmanId) {
        const promotion = promotionsData.find(p => p.id === promotionId);
        addNotification({ 
            message: `${currentUser.name} đã chấp thuận yêu cầu hủy khuyến mãi "${promotion?.name}".`, 
            type: 'info', 
            showToast: true,
            userId: chairmanId
        });
    }
  }, [currentUser, setPromotionsData, addNotification, promotionsData]);

  const addPromotion = useCallback((promotionData: Omit<Promotion, 'id' | 'timesUsed' | 'ownerId' | 'status' | 'createdBy' | 'approvedBy' | 'approvedAt' | 'rejectionReason' | 'managerReports'> & { isSystemWide?: boolean, isActive?: boolean }) => {
    if (!currentUser) {
      addNotification({ message: "Lỗi: Không thể xác định người dùng.", type: 'error', showToast: true });
      return;
    }

    const { isActive, ...restOfData } = promotionData;

    const ownerId = promotionData.isSystemWide && currentUser.role === UserRole.CHAIRMAN 
      ? currentUser.id 
      : currentUserOwnerId;

    if (!ownerId) {
      addNotification({ message: "Lỗi: Không thể xác định chủ sở hữu cho khuyến mãi này.", type: 'error', showToast: true });
      return;
    }
    
    // Determine status based on user role
    const isManagerCreating = currentUser.role === UserRole.MANAGER;
    const initialStatus = isManagerCreating ? 'pending' : (isActive ? 'active' : 'inactive');

    const newPromotion: Promotion = {
        ...restOfData,
        id: uuidv4(),
        timesUsed: 0,
        ownerId: ownerId,
        createdBy: currentUser.id,
        status: initialStatus,
    };

    setPromotionsData(prev => [newPromotion, ...prev]);
    addNotification({ message: `Đã thêm khuyến mãi mới: ${newPromotion.name}`, type: 'success', showToast: true });
    
    // If a manager creates it, notify their owner
    if (isManagerCreating && currentUser.managedBy) {
      addNotification({
        message: `Quản lý "${currentUser.name}" đã tạo khuyến mãi "${newPromotion.name}" và đang chờ bạn duyệt.`,
        type: 'warning',
        userId: currentUser.managedBy, // Notify the manager's manager (the owner)
        showToast: true
      });
    }
    
    // If system-wide, notify all owners
    if (newPromotion.isSystemWide && currentUser.role === UserRole.CHAIRMAN) {
        const owners = usersData.filter(u => u.role === UserRole.OWNER);
        owners.forEach(owner => {
            addNotification({
                message: `Chủ tịch đã ban hành khuyến mãi mới toàn chuỗi: "${newPromotion.name}".`,
                type: 'info',
                userId: owner.id, // Target the notification to each owner
                showToast: true
            });
        });
    }

  }, [currentUser, currentUserOwnerId, setPromotionsData, addNotification, usersData]);

  const updatePromotion = useCallback((promotionToUpdate: Promotion) => {
    if (!currentUser) return;
    const originalPromotion = promotionsData.find(p => p.id === promotionToUpdate.id);
    if (!originalPromotion) return;

    if (
      (originalPromotion.isSystemWide && originalPromotion.ownerId === currentUser.id && currentUser.role === UserRole.CHAIRMAN) ||
      (!originalPromotion.isSystemWide && originalPromotion.ownerId === currentUserOwnerId)
    ) {
      setPromotionsData(prev => prev.map(p => p.id === promotionToUpdate.id ? promotionToUpdate : p));
      addNotification({ message: `Đã cập nhật khuyến mãi: ${promotionToUpdate.name}`, type: 'info', showToast: true });
    } else {
      addNotification({ message: "Bạn không có quyền chỉnh sửa khuyến mãi này.", type: 'error', showToast: true });
    }
  }, [currentUser, currentUserOwnerId, promotionsData, setPromotionsData, addNotification]);
  
  const deletePromotion = useCallback((promotionId: string) => {
    if (!currentUser) return;
    const promotionToDelete = promotionsData.find(p => p.id === promotionId);
    if (!promotionToDelete) return;

     if (
      (promotionToDelete.isSystemWide && promotionToDelete.ownerId === currentUser.id && currentUser.role === UserRole.CHAIRMAN) ||
      (!promotionToDelete.isSystemWide && promotionToDelete.ownerId === currentUserOwnerId)
    ) {
      setPromotionsData(prev => prev.filter(p => p.id !== promotionId));
      addNotification({ message: `Đã xóa một khuyến mãi.`, type: 'warning', showToast: true });
    } else {
       addNotification({ message: "Bạn không có quyền xóa khuyến mãi này.", type: 'error', showToast: true });
    }
  }, [currentUser, currentUserOwnerId, promotionsData, setPromotionsData, addNotification]);

  const findPromotionByCode = useCallback((code: string, forStoreOwnerId?: string, channel?: 'online' | 'instore') => {
    const targetOwnerId = forStoreOwnerId ?? currentUserOwnerId;
    if (!code) return undefined;
    
    const promotion = promotionsData.find(p => 
      p.code.toLowerCase() === code.toLowerCase() &&
      (
        // Store-specific promo for the target store
        (p.ownerId === targetOwnerId && !p.isSystemWide) ||
        // System-wide promo that the target store has NOT opted out of
        (p.isSystemWide && !p.optOutRequests?.some(req => req.storeOwnerId === targetOwnerId && req.status === 'approved'))
      )
    );

    if (!promotion) return undefined;

    // Day of week validation
    const today = new Date().getDay(); // 0 = Sunday, 1 = Monday...
    if (promotion.applicableDaysOfWeek && promotion.applicableDaysOfWeek.length > 0) {
        if (!promotion.applicableDaysOfWeek.includes(today)) {
            return undefined; // Promotion is not valid today
        }
    }

    // Channel validation
    if (channel && promotion.applicableChannels && promotion.applicableChannels.length > 0) {
        if (!promotion.applicableChannels.includes(channel)) {
            return undefined; // Not valid for this channel
        }
    }

    return promotion;
  }, [promotionsData, currentUserOwnerId]);

  const approvePromotion = useCallback((promotionId: string) => {
    if (!currentUser || (currentUser.role !== UserRole.OWNER && currentUser.role !== UserRole.CHAIRMAN)) {
      addNotification({ message: "Chỉ chủ cửa hàng hoặc chủ tịch mới có quyền duyệt khuyến mãi.", type: 'error', showToast: true });
      return;
    }

    setPromotionsData(prev => prev.map(p => {
      if (p.id === promotionId && p.status === 'pending') {
        const promoCreator = usersData.find(u => u.id === p.createdBy);
        const canApprove = (currentUser.role === UserRole.CHAIRMAN) || 
                         (currentUser.role === UserRole.OWNER && promoCreator?.managedBy === currentUser.id);

        if (canApprove) {
          addNotification({ message: `Khuyến mãi "${p.name}" đã được duyệt và kích hoạt.`, type: 'success', showToast: true, userId: p.createdBy });
          return { ...p, status: 'active', approvedBy: currentUser.id, approvedAt: new Date(), rejectionReason: undefined };
        } else {
           addNotification({ message: `Bạn không có quyền duyệt khuyến mãi này.`, type: 'error', showToast: true });
        }
      }
      return p;
    }));
  }, [currentUser, setPromotionsData, addNotification, usersData]);

  const rejectPromotion = useCallback((promotionId: string, reason: string) => {
     if (!currentUser || (currentUser.role !== UserRole.OWNER && currentUser.role !== UserRole.CHAIRMAN)) {
      addNotification({ message: "Chỉ chủ cửa hàng hoặc chủ tịch mới có quyền từ chối khuyến mãi.", type: 'error', showToast: true });
      return;
    }
     setPromotionsData(prev => prev.map(p => {
      if (p.id === promotionId && p.status === 'pending') {
        const promoCreator = usersData.find(u => u.id === p.createdBy);
        const canReject = (currentUser.role === UserRole.CHAIRMAN) || 
                        (currentUser.role === UserRole.OWNER && promoCreator?.managedBy === currentUser.id);
        if (canReject) {
            addNotification({ message: `Khuyến mãi "${p.name}" của bạn đã bị từ chối. Lý do: ${reason}`, type: 'warning', showToast: true, userId: p.createdBy });
            return { ...p, status: 'rejected', approvedBy: currentUser.id, approvedAt: new Date(), rejectionReason: reason };
        } else {
             addNotification({ message: `Bạn không có quyền từ chối khuyến mãi này.`, type: 'error', showToast: true });
        }
      }
      return p;
    }));
  }, [currentUser, setPromotionsData, addNotification, usersData]);

  const addManagerReport = useCallback((promotionId: string, reason: string) => {
    if (!currentUser || currentUser.role !== UserRole.MANAGER) {
      addNotification({ message: "Chỉ quản lý mới có thể gửi báo cáo.", type: 'error', showToast: true });
      return;
    }
    const promotion = promotionsData.find(p => p.id === promotionId);
    if (!promotion || !promotion.ownerId) return;

    const newReport: ManagerReport = {
      id: uuidv4(),
      reportedBy: currentUser.id,
      reason,
      timestamp: new Date(),
      status: 'pending',
    };

    setPromotionsData(prev => prev.map(p => {
      if (p.id === promotionId) {
        return { ...p, managerReports: [...(p.managerReports || []), newReport] };
      }
      return p;
    }));

    addNotification({ message: 'Đã gửi báo cáo cho chủ cửa hàng.', type: 'success', showToast: true });
    // Notify the owner
    addNotification({
      message: `Quản lý "${currentUser.name}" đã gửi báo cáo về KM "${promotion.name}".`,
      type: 'warning',
      userId: promotion.ownerId,
      showToast: true,
    });
  }, [currentUser, promotionsData, setPromotionsData, addNotification]);

  const resolveManagerReport = useCallback((promotionId: string, reportId: string) => {
    if (!currentUser || (currentUser.role !== UserRole.OWNER && currentUser.role !== UserRole.CHAIRMAN)) {
      addNotification({ message: "Bạn không có quyền xử lý báo cáo này.", type: 'error', showToast: true });
      return;
    }

    setPromotionsData(prev => prev.map(p => {
      if (p.id === promotionId) {
        const updatedReports = p.managerReports?.map(r => 
          r.id === reportId ? { ...r, status: 'resolved' as const } : r
        );
        return { ...p, managerReports: updatedReports };
      }
      return p;
    }));
    addNotification({ message: 'Đã đánh dấu báo cáo là đã xử lý.', type: 'info', showToast: true });
  }, [currentUser, setPromotionsData, addNotification]);


  return {
    addPromotion,
    updatePromotion,
    deletePromotion,
    findPromotionByCode,
    requestPromotionOptOut,
    respondToOptOutRequest,
    requestPromotionCancellation,
    respondToCancellationRequest,
    acknowledgeSystemPromo,
    acknowledgeCancelRequest,
    acknowledgeOptOutRequest,
    approvePromotion,
    rejectPromotion,
    addManagerReport,
    resolveManagerReport,
  };
};