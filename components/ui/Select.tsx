import React from 'react';
import { ChevronDown } from 'lucide-react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  wrapperClassName?: string;
  options: { value: string | number; label: string }[];
  placeholder?: string;
  leftIcon?: React.ReactNode;
}

export const Select: React.FC<SelectProps> = ({ label, error, id, wrapperClassName = '', className = '', options, placeholder, leftIcon, ...props }) => {
  const baseStyles = 'block w-full py-2.5 border rounded-lg shadow-sm focus:outline-none focus:ring-2 sm:text-sm disabled:bg-slate-100/50 disabled:cursor-not-allowed appearance-none bg-bg-input text-text-body placeholder-text-muted';
  const borderStyles = error ? 'border-status-danger focus:ring-status-danger focus:border-status-danger' : 'border-border-input focus:ring-brand-primary-focus focus:border-brand-primary-focus';
  
  return (
    <div className={wrapperClassName}>
      {label && (
        <label htmlFor={id || props.name} className="block text-sm font-medium text-text-body mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-heading">
            {React.cloneElement(leftIcon as React.ReactElement<{ size?: number }>, { size: 20 })}
          </div>
        )}
        <select
          id={id || props.name}
          className={`${baseStyles} ${borderStyles} ${leftIcon ? 'pl-10 pr-8' : 'px-3 pr-8'} ${className}`}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-text-heading">
          <ChevronDown size={20}/>
        </div>
      </div>
      {error && <p className="mt-1 text-sm text-status-danger">{error}</p>}
    </div>
  );
};