import React from 'react';
import { User, UserRole } from '../../types';
import { useAppContext } from '../../contexts/AppContext';
import { Button } from '../ui/Button';
import { EditIcon, Trash2Icon, PlusCircleIcon, User as UserLucideIcon, KeyIcon, PhoneIcon, BriefcaseIcon, ChevronDownIcon, ChevronRightIcon } from 'lucide-react';

interface UserTreeNodeProps {
  user: User;
  level: number;
  onAddSubordinate: (managerId: string, managerRole: UserRole) => void;
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
  managedUsers: User[];
  isExpanded: boolean;
  onToggleExpand: (userId: string) => void;
}

export const UserTreeNode: React.FC<UserTreeNodeProps> = ({
  user,
  level,
  onAddSubordinate,
  onEdit,
  onDelete,
  managedUsers,
  isExpanded,
  onToggleExpand,
}) => {
  const { currentUser, users: allUsers } = useAppContext();

  const canCurrentUserEditThisUser = () => {
    if (!currentUser) return false;
    if (currentUser.id === user.id) return true; 
    
    if (currentUser.role === UserRole.CHAIRMAN) return true; 
    if (currentUser.role === UserRole.OWNER) {
        let managerToCheck: User | undefined = user;
        while(managerToCheck?.managedBy) {
            if (managerToCheck.managedBy === currentUser.id) return user.role === UserRole.MANAGER || user.role === UserRole.STAFF;
            managerToCheck = allUsers.find(u => u.id === managerToCheck!.managedBy);
            if(managerToCheck?.role === UserRole.CHAIRMAN) return false; 
        }
        return false;
    }
    if (currentUser.role === UserRole.MANAGER) {
      return user.role === UserRole.STAFF && user.managedBy === currentUser.id;
    }
    return false;
  };

  const canCurrentUserDeleteThisUser = () => {
    if (!currentUser || currentUser.id === user.id) return false; 
    if (user.role === UserRole.CHAIRMAN && allUsers.filter(u => u.role === UserRole.CHAIRMAN).length <= 1) return false;
    
    if (currentUser.role === UserRole.CHAIRMAN) return user.role !== UserRole.CHAIRMAN; 
    if (currentUser.role === UserRole.OWNER) {
        let managerToCheck: User | undefined = user;
        while(managerToCheck?.managedBy) {
            if (managerToCheck.managedBy === currentUser.id) return user.role === UserRole.MANAGER || user.role === UserRole.STAFF;
            managerToCheck = allUsers.find(u => u.id === managerToCheck!.managedBy);
             if(managerToCheck?.role === UserRole.CHAIRMAN) return false;
        }
        return false;
    }
    if (currentUser.role === UserRole.MANAGER) {
      return user.role === UserRole.STAFF && user.managedBy === currentUser.id;
    }
    return false;
  };

  const canThisUserHaveSubordinates = user.role === UserRole.CHAIRMAN || user.role === UserRole.OWNER || user.role === UserRole.MANAGER;
  
  const canAddSubordinateToThisUser = 
    currentUser &&
    canThisUserHaveSubordinates && 
    (
      currentUser.role === UserRole.CHAIRMAN || 
      (currentUser.role === UserRole.OWNER && (user.id === currentUser.id || user.managedBy === currentUser.id && user.role === UserRole.MANAGER )) || 
      (currentUser.role === UserRole.MANAGER && user.id === currentUser.id) 
    );

  const userInfoMarginClass = (managedUsers.length > 0 || (level > 0 && !managedUsers.length))
    ? `ml-[calc(0.25rem+16px+0.25rem)]` // This calc is for: button margin-right (mr-1 -> 0.25rem) + icon size (16px) + some space (0.25rem)
    : 'ml-0';

  const mainDivClasses = ['py-2', 'group'];
  if (level > 0) {
    mainDivClasses.push(`ml-${level * 4}`, 'pl-3', 'border-l-2', 'border-border-base', 'dark:border-slate-700');
  }

  return (
    <div
      className={mainDivClasses.join(' ')}
      role="treeitem"
      aria-expanded={managedUsers.length > 0 ? isExpanded : undefined}
      aria-level={level + 1}
      aria-label={user.name}
    >
      <div className="p-3 rounded-lg shadow-sm hover:shadow-md transition-all duration-150 flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0 bg-bg-surface dark:bg-slate-800 border border-border-base dark:border-slate-700">
        <div className="flex-grow">
          <div className="flex items-center mb-1">
            {managedUsers.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => onToggleExpand(user.id)} className="mr-1 p-1" aria-label={`${isExpanded ? 'Thu gọn' : 'Mở rộng'} ${user.name}`}>
                {isExpanded ? <ChevronDownIcon size={16} /> : <ChevronRightIcon size={16} />}
              </Button>
            )}
            <span className="font-semibold text-text-heading dark:text-slate-100 text-base mr-2">{user.name}</span>
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full
              ${user.role === UserRole.CHAIRMAN ? 'bg-red-100 text-red-700 dark:bg-red-700/30 dark:text-red-300' :
                user.role === UserRole.OWNER ? 'bg-purple-100 text-purple-700 dark:bg-purple-700/30 dark:text-purple-300' :
                user.role === UserRole.MANAGER ? 'bg-sky-100 text-sky-700 dark:bg-sky-700/30 dark:text-sky-300' :
                'bg-emerald-100 text-emerald-700 dark:bg-emerald-700/30 dark:text-emerald-300'}`}>
              {user.role}
            </span>
          </div>
          <div className={`text-xs text-text-muted dark:text-slate-400 space-y-0.5 sm:space-y-0 sm:flex sm:space-x-3 ${userInfoMarginClass} sm:ml-0`}>
            <span className="flex items-center"><KeyIcon size={12} className="mr-1" />{user.username}</span>
            {user.phone && <span className="flex items-center"><PhoneIcon size={12} className="mr-1" />{user.phone}</span>}
            {user.managedBy && (
                <span className="flex items-center">
                    <BriefcaseIcon size={12} className="mr-1" />QL: {allUsers.find(u=>u.id === user.managedBy)?.name || 'Không rõ'}
                </span>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-1.5 mt-2 sm:mt-0 self-start sm:self-center">
          {canAddSubordinateToThisUser && (
            <Button variant="ghost" size="sm" onClick={() => onAddSubordinate(user.id, user.role)} title="Thêm cấp dưới" className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 p-1.5">
              <PlusCircleIcon size={18} />
            </Button>
          )}
          {canCurrentUserEditThisUser() ? (
            <Button variant="ghost" size="sm" onClick={() => onEdit(user)} title="Sửa" className="text-text-link hover:text-brand-primary p-1.5">
              <EditIcon size={18} />
            </Button>
          ) : (
             <Button variant="ghost" size="sm" title="Không có quyền sửa" className="text-text-muted cursor-not-allowed p-1.5" disabled>
                <EditIcon size={18} />
            </Button>
          )}
          {canCurrentUserDeleteThisUser() ? (
            <Button variant="ghost" size="sm" onClick={() => onDelete(user)} title="Xóa" className="text-status-danger hover:text-rose-600 p-1.5">
              <Trash2Icon size={18} />
            </Button>
          ) : (
             <Button variant="ghost" size="sm" title="Không có quyền xóa" className="text-text-muted cursor-not-allowed p-1.5" disabled>
                <Trash2Icon size={18} />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};