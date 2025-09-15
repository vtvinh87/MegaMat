
import { useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Notification, User, Order } from '../../../types';
import { ToastMessage } from '../../ToastContext';

type Props = {
  currentUser: User | null;
  currentUserOwnerId: string | null;
  allNotificationsData: Notification[];
  setAllNotificationsData: React.Dispatch<React.SetStateAction<Notification[]>>;
  allOrdersData: Order[];
  getOwnerIdForUser: (userId: string, allUsers: User[]) => string | null;
  usersData: User[];
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
};

export const useNotificationLogic = ({
  currentUser,
  currentUserOwnerId,
  allNotificationsData,
  setAllNotificationsData,
  allOrdersData,
  getOwnerIdForUser,
  usersData,
  addToast,
}: Props) => {
  const addNotification = useCallback((notificationData: Omit<Notification, 'id' | 'createdAt' | 'read' | 'ownerId'> & { showToast?: boolean }) => {
    const { showToast, ...restOfNotificationData } = notificationData;
    
    let ownerIdForNotification: string | undefined = undefined;
    if (restOfNotificationData.orderId) {
        const order = allOrdersData.find(o => o.id === restOfNotificationData.orderId);
        if (order) ownerIdForNotification = order.ownerId;
    } else if (restOfNotificationData.userId) {
        ownerIdForNotification = getOwnerIdForUser(restOfNotificationData.userId, usersData) || undefined;
    } else if (currentUserOwnerId) {
        ownerIdForNotification = currentUserOwnerId;
    }

    const newNotification: Notification = {
      ...restOfNotificationData,
      id: uuidv4(),
      createdAt: new Date(),
      read: false,
      userId: restOfNotificationData.userId || currentUser?.id, 
      userRole: restOfNotificationData.userRole || currentUser?.role, 
      ownerId: ownerIdForNotification,
    };
    setAllNotificationsData(prev => [newNotification, ...prev.slice(0, 49)].sort((a,b) => b.createdAt.getTime() - a.createdAt.getTime()));

    if (showToast) {
        addToast({ message: newNotification.message, type: newNotification.type });
    }

  }, [currentUser, currentUserOwnerId, allOrdersData, getOwnerIdForUser, usersData, setAllNotificationsData, addToast]);

  const markNotificationAsRead = useCallback((id: string) => {
    setAllNotificationsData(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, [setAllNotificationsData]);

  const clearNotifications = useCallback(() => {
    setAllNotificationsData(prev => prev.map(n => ({ ...n, read: true })));
  }, [setAllNotificationsData]);

  return {
    addNotification,
    markNotificationAsRead,
    clearNotifications,
  };
};