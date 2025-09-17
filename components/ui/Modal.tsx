import React, { useEffect, useRef, ReactNode } from 'react';
import { XIcon } from 'lucide-react';
import { Card } from './Card';
import { Button } from './Button';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footerContent?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';
  titleIcon?: ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footerContent,
  size = 'md',
  titleIcon,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Optional: Focus trapping logic can be added here
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 transition-opacity duration-300 animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={onClose}
    >
      <Card
        ref={modalRef}
        title={title}
        icon={titleIcon}
        titleId="modal-title"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
        className={`w-full ${sizeClasses[size]} bg-bg-surface shadow-xl !border-border-base flex flex-col max-h-[90vh]`}
        headerClassName="!border-b !border-border-base flex-shrink-0"
        contentClassName="flex-grow min-h-0"
        actions={
          <Button variant="ghost" size="sm" onClick={onClose} className="p-2 -mr-2" aria-label="Đóng modal">
            <XIcon size={24} />
          </Button>
        }
      >
        {children}
        {footerContent && (
          <div className="mt-6 flex justify-end space-x-3 border-t border-border-base pt-4 flex-shrink-0">
            {footerContent}
          </div>
        )}
      </Card>
    </div>
  );
};