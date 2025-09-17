
import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  titleClassName?: string;
  contentClassName?: string;
  headerClassName?: string;
  titleId?: string; // Added for accessibility
  onClick?: (e: React.MouseEvent) => void; // Added for Modal
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ children, className = '', title, icon, actions, titleClassName, contentClassName, headerClassName, titleId, onClick }, ref) => {
    return (
      <div ref={ref} onClick={onClick} className={`bg-bg-surface shadow-md rounded-xl border border-border-base transition-all duration-200 ${className}`}>
        {(title || icon || actions) && (
          <div className={`px-5 py-4 border-b border-border-base/70 sm:px-6 flex justify-between items-center ${headerClassName}`}>
            <div className="flex items-center min-w-0"> {/* Group for icon and title */}
              {icon && <span className="flex-shrink-0">{icon}</span>} {/* Icon itself */}
              {title && <h3 id={titleId} className={`text-lg font-semibold text-text-heading ${titleClassName || ''} ${icon ? 'ml-2' : ''}`}>{title}</h3>} {/* Title with margin if icon exists and id for aria-labelledby */}
            </div>
            {actions && <div className="flex-shrink-0">{actions}</div>}
          </div>
        )}
        <div className={`flex-grow min-h-0 p-5 sm:p-6 overflow-y-auto ${contentClassName}`}>
          {children}
        </div>
      </div>
    );
  }
);

Card.displayName = 'Card';
