import React, { useEffect, useState } from 'react';
// FIX: Imported StarIcon to handle the 'rating_prompt' toast type.
import { CheckCircleIcon, XCircleIcon, AlertTriangleIcon, InfoIcon, XIcon, StarIcon } from 'lucide-react';
import { ToastMessage } from '../../contexts/ToastContext';

interface ToastProps {
  toast: ToastMessage;
  onDismiss: () => void;
}

// FIX: Added 'rating_prompt' icon definition.
const ICONS: Record<ToastMessage['type'], React.ReactNode> = {
  success: <CheckCircleIcon className="text-status-success" size={20} />,
  error: <XCircleIcon className="text-status-danger" size={20} />,
  warning: <AlertTriangleIcon className="text-status-warning-text" size={20} />,
  info: <InfoIcon className="text-status-info" size={20} />,
  rating_prompt: <StarIcon className="text-yellow-500" size={20} />,
};

// FIX: Added 'rating_prompt' background and border color definition.
const BG_COLORS: Record<ToastMessage['type'], string> = {
    success: 'bg-status-success-bg border-status-success',
    error: 'bg-status-danger-bg border-status-danger',
    warning: 'bg-status-warning-bg border-status-warning',
    info: 'bg-status-info-bg border-status-info',
    rating_prompt: 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-500',
};

export const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  const [isExiting, setIsExiting] = useState(false);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(onDismiss, 300); // Match animation duration
  };

  return (
    <div
      className={`
        flex items-start w-full p-4 rounded-lg shadow-lg border-l-4 transition-all duration-300 ease-in-out transform
        ${BG_COLORS[toast.type]}
        ${isExiting ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'} animate-fadeIn
      `}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex-shrink-0 mr-3 mt-0.5">
        {ICONS[toast.type]}
      </div>
      <div className="flex-grow text-sm font-medium text-text-body">
        {toast.message}
      </div>
      <button
        onClick={handleDismiss}
        className="ml-3 flex-shrink-0 p-1 rounded-md text-text-muted hover:bg-black/10 transition-colors"
        aria-label="Đóng thông báo"
      >
        <XIcon size={16} />
      </button>
    </div>
  );
};