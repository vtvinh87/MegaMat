
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'warning' | 'ghost' | 'link';
  size?: 'sm' | 'md' | 'lg';
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  leftIcon,
  rightIcon,
  className = '',
  ...props
}) => {
  const baseStyles = 'font-semibold rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg-surface transition-all duration-150 ease-in-out disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center';

  const variantStyles = {
    primary: 'bg-brand-primary text-text-on-primary hover:bg-brand-primary-hover focus:ring-brand-primary-focus',
    secondary: 'bg-bg-subtle text-text-heading hover:bg-slate-200 focus:ring-slate-400 border border-border-input',
    danger: 'bg-status-danger text-white hover:bg-red-600 focus:ring-status-danger',
    warning: 'bg-status-warning text-black hover:bg-amber-600 focus:ring-status-warning',
    ghost: 'bg-transparent text-brand-primary hover:bg-blue-500/10 focus:ring-brand-primary-focus',
    link: 'bg-transparent text-text-link hover:underline focus:ring-brand-primary-focus p-0',
  };

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {leftIcon && <span className="mr-2 flex-shrink-0">{leftIcon}</span>}
      <span className="flex-grow-0">{children}</span>
      {rightIcon && <span className="ml-2 flex-shrink-0">{rightIcon}</span>}
    </button>
  );
};