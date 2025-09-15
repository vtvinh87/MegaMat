
import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Order, User, ServiceRating, StaffRating, Tip } from '../../../types';

type Props = {
  allOrdersData: Order[];
  serviceRatingsData: ServiceRating[];
  setServiceRatingsData: React.Dispatch<React.SetStateAction<ServiceRating[]>>;
  staffRatingsData: StaffRating[];
  setStaffRatingsData: React.Dispatch<React.SetStateAction<StaffRating[]>>;
  tipsData: Tip[];
  setTipsData: React.Dispatch<React.SetStateAction<Tip[]>>;
  addNotification: (notification: any) => void;
  findUserById: (userId: string) => User | undefined;
};

export const useFeedbackManagement = ({
  allOrdersData,
  setServiceRatingsData,
  setStaffRatingsData,
  setTipsData,
  addNotification,
  findUserById,
}: Props) => {

  const addServiceRating = useCallback((ratingData: Omit<ServiceRating, 'id' | 'createdAt' | 'ownerId'>) => {
    const order = allOrdersData.find(o => o.id === ratingData.orderId);
    if (!order) {
        addNotification({message: "Lỗi: Không tìm thấy đơn hàng để thêm đánh giá.", type: 'error'});
        return;
    }
    const newRating: ServiceRating = { ...ratingData, id: uuidv4(), createdAt: new Date(), ownerId: order.ownerId };
    setServiceRatingsData(prev => [newRating, ...prev]);
  }, [allOrdersData, setServiceRatingsData, addNotification]);
  
  const addStaffRating = useCallback((ratingData: Omit<StaffRating, 'id' | 'createdAt' | 'ownerId'>) => {
    const order = allOrdersData.find(o => o.id === ratingData.orderId);
    if (!order) {
        addNotification({message: "Lỗi: Không tìm thấy đơn hàng để thêm đánh giá nhân viên.", type: 'error'});
        return;
    }
    const newRating: StaffRating = { ...ratingData, id: uuidv4(), createdAt: new Date(), ownerId: order.ownerId };
    setStaffRatingsData(prev => [newRating, ...prev]);
  }, [allOrdersData, setStaffRatingsData, addNotification]);

  const createTip = useCallback((tipData: Omit<Tip, 'id' | 'createdAt' | 'status' | 'ownerId'>): Tip | null => {
     const order = allOrdersData.find(o => o.id === tipData.orderId);
    if (!order) {
        addNotification({message: "Lỗi: Không tìm thấy đơn hàng để tạo tip.", type: 'error'});
        return null;
    }
    const newTip: Tip = { ...tipData, id: uuidv4(), createdAt: new Date(), status: 'completed', ownerId: order.ownerId };
    setTipsData(prev => [newTip, ...prev]);
    return newTip;
  }, [allOrdersData, setTipsData, addNotification]);

  const getStaffForOrderActions = useCallback((orderId: string): { pickupStaff?: User, returnStaff?: User, processingStaff?: User[] } => {
    const order = allOrdersData.find(o => o.id === orderId);
    if (!order || !order.scanHistory) return {};
    
    let pickupStaff: User | undefined;
    let returnStaff: User | undefined;
    const processingStaffSet = new Set<User>();

    order.scanHistory.forEach(scan => {
        if (scan.staffUserId) {
            const staffUser = findUserById(scan.staffUserId);
            if (staffUser) {
                if (scan.staffRoleInAction === 'pickup' && !pickupStaff) {
                    pickupStaff = staffUser;
                } else if (scan.staffRoleInAction === 'return') {
                    returnStaff = staffUser;
                } else if (scan.staffRoleInAction === 'processing') {
                    processingStaffSet.add(staffUser);
                }
            }
        }
    });
    
    return { pickupStaff, returnStaff, processingStaff: Array.from(processingStaffSet) };
  }, [allOrdersData, findUserById]);

  return {
    addServiceRating,
    addStaffRating,
    createTip,
    getStaffForOrderActions,
  };
};
