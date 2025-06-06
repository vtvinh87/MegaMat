
import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement & HTMLTextAreaElement> {
  label?: string;
  error?: string;
  wrapperClassName?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  isTextArea?: boolean;
  rows?: number;
}

export const Input = React.forwardRef<HTMLInputElement | HTMLTextAreaElement, InputProps>(
  ({ label, error, id, wrapperClassName = '', className = '', leftIcon, rightIcon, isTextArea = false, rows = 3, ...props }, ref) => {
    const baseStyles = 'block w-full py-2.5 border rounded-lg shadow-sm focus:outline-none focus:ring-2 sm:text-sm disabled:bg-slate-100 dark:disabled:bg-slate-700/50 disabled:cursor-not-allowed bg-bg-input dark:bg-bg-subtle text-text-body dark:text-slate-100 placeholder-text-muted dark:placeholder-slate-500';
    const borderStyles = error ? 'border-status-danger focus:ring-status-danger focus:border-status-danger' : 'border-border-input focus:ring-brand-primary-focus focus:border-brand-primary-focus';
    const paddingStyles = `${leftIcon ? 'pl-10' : 'px-3'} ${rightIcon && !isTextArea ? 'pr-10' : (isTextArea ? 'px-3' : 'pr-3')}`;

    const InputElement = isTextArea ? 'textarea' : 'input';

    return (
      <div className={wrapperClassName}>
        {label && (
          <label htmlFor={id || props.name} className="block text-sm font-medium text-text-body dark:text-slate-300 mb-1">
            {label}
          </label>
        )}
        <div className="relative">
          {!isTextArea && leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
              {React.cloneElement(leftIcon as React.ReactElement<{ size?: number }>, { size: 20 })}
            </div>
          )}
          <InputElement
            id={id || props.name}
            className={`${baseStyles} ${borderStyles} ${paddingStyles} ${className}`}
            rows={isTextArea ? rows : undefined}
            ref={ref as any} // Type assertion needed here due to union type of ref
            {...props}
          />
          {!isTextArea && rightIcon && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-text-muted">
               {React.cloneElement(rightIcon as React.ReactElement<{ size?: number }>, { size: 20 })}
            </div>
          )}
        </div>
        {error && <p className="mt-1 text-sm text-status-danger dark:text-rose-400">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';