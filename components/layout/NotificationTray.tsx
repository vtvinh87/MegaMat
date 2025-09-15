
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { BellIcon, XIcon, CheckCircleIcon, InfoIcon, AlertTriangleIcon, AlertCircleIcon, MailOpenIcon, CheckCheckIcon, BuildingIcon } from 'lucide-react';
import { Button } from '../ui/Button';
import { Notification, User, UserRole } from '../../types';

const NotificationIcon: React.FC<{type: Notification['type']}> = ({ type }) => {
  switch (type) {
    case 'success': return <CheckCircleIcon className="text-status-success h-5 w-5" />;
    case 'info': return <InfoIcon className="text-status-info h-5 w-5" />;
    case 'warning': return <AlertTriangleIcon className="text-status-warning h-5 w-5" />;
    case 'error': return <AlertCircleIcon className="text-status-danger h-5 w-5" />;
    case 'rating_prompt': return <StarIcon className="text-yellow-500 h-5 w-5" />
    default: return <InfoIcon className="text-text-muted h-5 w-5" />;
  }
};

const StarIcon: React.FC<{className?: string}> = ({className}) => ( // Simple Star Icon for rating_prompt
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
);


export const NotificationTray: React.FC = () => {
  const { 
    notifications: allNotifications, 
    markNotificationAsRead, 
    orders: allOrders,
    users,
    getOwnerIdForUser,
    storeProfiles,
  } = useData();
  const { currentUser } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const trayRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Helper to find all users managed by a specific user, recursively.
  const getAllSubordinateIds = useCallback((managerId: string, allUsers: User[]): string[] => {
    const subordinates = new Set<string>();
    const queue: string[] = [managerId]; 
    const visitedInQueue = new Set<string>([managerId]);

    let head = 0;
    while(head < queue.length) {
        const currentManagerIdInQueue = queue[head++];
        allUsers.forEach(u => {
            if (u.managedBy === currentManagerIdInQueue) {
                if (!subordinates.has(u.id)) {
                    subordinates.add(u.id);
                    if ((u.role === UserRole.MANAGER || u.role === UserRole.OWNER) && !visitedInQueue.has(u.id)) {
                        queue.push(u.id);
                        visitedInQueue.add(u.id);
                    }
                }
            }
        });
    }
    return Array.from(subordinates);
  }, []);


  const displayedNotifications = useMemo(() => {
    // 1. Logged-in customer view: Sees notifications for their orders.
    if (currentUser?.role === UserRole.CUSTOMER) {
      return allNotifications.filter(n => {
        if (!n.orderId) return false;
        const order = allOrders.find(o => o.id === n.orderId);
        return order?.customer.id === currentUser.id;
      }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } 
    
    // 2. Logged-in admin/staff user view.
    else if (currentUser) {
      // CHAIRMAN sees all notifications.
      if (currentUser.role === UserRole.CHAIRMAN) {
          return allNotifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }
      
      // For OWNER, MANAGER, STAFF:
      // A user sees notifications for themselves and anyone they manage within their store's context.
      const relevantUserIds = new Set<string>([currentUser.id]);
      const subordinates = getAllSubordinateIds(currentUser.id, users);
      subordinates.forEach(id => relevantUserIds.add(id));
      
      const currentUserOwnerId = getOwnerIdForUser(currentUser.id, users);

      return allNotifications.filter(n => {
        // Notification is relevant if...
        // 1. It's explicitly linked to a user in their hierarchy.
        if (n.userId && relevantUserIds.has(n.userId)) {
          return true;
        }
        
        // 2. It's a system notification for their specific store.
        // A system notification is one without a specific userId but with an ownerId.
        if (!n.userId && n.ownerId && n.ownerId === currentUserOwnerId) {
            return true;
        }
        
        // 3. Fallback for older/global system notifications for OWNERs.
        // These are notifications without a userId or ownerId.
        if (!n.userId && !n.ownerId && currentUser.role === UserRole.OWNER) {
             return true;
        }

        return false;
      }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    
    // 3. Default view (not logged in)
    // Show only very generic system notifications (those without userId and ownerId).
    return allNotifications.filter(n => !n.userId && !n.ownerId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [allNotifications, currentUser, allOrders, users, getAllSubordinateIds, getOwnerIdForUser]);

  const unreadCount = useMemo(() => displayedNotifications.filter(n => !n.read).length, [displayedNotifications]);

  const handleMarkAllDisplayedAsRead = () => {
    displayedNotifications.forEach(notification => {
      if (!notification.read) {
        markNotificationAsRead(notification.id);
      }
    });
  };


  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        trayRef.current && !trayRef.current.contains(event.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);


  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-5 right-5 bg-brand-primary text-text-on-primary p-3.5 rounded-full shadow-xl hover:bg-brand-primary-hover focus:outline-none focus:ring-2 focus:ring-brand-primary-focus focus:ring-offset-2 z-50 transition-transform hover:scale-105 active:scale-95"
        aria-label={`Thông báo ${unreadCount > 0 ? `(${unreadCount} chưa đọc)` : ''}`}
        aria-expanded={isOpen}
        aria-controls="notification-tray"
      >
        <BellIcon size={24} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-status-danger text-white text-xs font-semibold rounded-full h-5 w-5 flex items-center justify-center border-2 border-white">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          id="notification-tray"
          ref={trayRef}
          className="fixed bottom-20 right-5 w-80 md:w-96 max-h-[calc(100vh-6rem)] bg-bg-surface rounded-xl shadow-2xl z-50 border border-border-base flex flex-col transition-all duration-300 ease-out transform-gpu"
          role="dialog"
          aria-modal="true"
          aria-labelledby="notification-tray-title"
        >
          <div className="flex justify-between items-center p-4 border-b border-border-base">
            <h3 id="notification-tray-title" className="font-semibold text-text-heading">Thông báo</h3>
            <div className="flex items-center space-x-2">
              {displayedNotifications.some(n => !n.read) && ( // Only show if there are unread items in the current view
                <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleMarkAllDisplayedAsRead} 
                    className="text-xs text-brand-primary hover:bg-blue-500/10 px-2 py-1"
                    title="Đánh dấu tất cả đã đọc"
                >
                  <CheckCheckIcon size={14} className="mr-1"/> Đánh dấu đã đọc
                </Button>
              )}
              <button 
                onClick={() => setIsOpen(false)} 
                className="text-text-muted hover:text-text-body p-1 rounded-md hover:bg-bg-surface-hover"
                aria-label="Đóng thông báo"
                >
                <XIcon size={20} />
              </button>
            </div>
          </div>
          {displayedNotifications.length === 0 ? (
            <p className="p-6 text-center text-text-muted">Không có thông báo mới.</p>
          ) : (
            <div className="overflow-y-auto flex-grow">
              {displayedNotifications.map(notification => (
                <div
                  key={notification.id}
                  className={`p-3.5 border-b border-border-base flex items-start space-x-3 transition-colors 
                    ${notification.read ? 'opacity-70' : 'bg-blue-500/5'}`}
                >
                  <div className="flex-shrink-0 pt-0.5">
                    <NotificationIcon type={notification.type} />
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm ${notification.read ? 'text-text-muted' : 'text-text-body font-medium'}`}>
                      {notification.message}
                    </p>
                     {currentUser?.role === UserRole.CHAIRMAN && notification.ownerId && (
                      <span className="text-xs text-purple-500 mt-1 block flex items-center">
                          <BuildingIcon size={12} className="mr-1.5 flex-shrink-0" />
                          {storeProfiles.find(p => p.ownerId === notification.ownerId)?.storeName || users.find(u => u.id === notification.ownerId)?.name || `ID ${notification.ownerId.slice(-4)}`}
                      </span>
                    )}
                    <p className="text-xs text-text-muted opacity-80 mt-0.5">
                      {new Date(notification.createdAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}
                    </p>
                  </div>
                  {!notification.read && (
                    <button
                      onClick={() => markNotificationAsRead(notification.id)}
                      title="Đánh dấu đã đọc"
                      className="text-xs text-brand-primary hover:underline flex-shrink-0 self-center"
                      aria-label={`Đánh dấu đã đọc thông báo: ${notification.message}`}
                    >
                      Đã đọc
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}