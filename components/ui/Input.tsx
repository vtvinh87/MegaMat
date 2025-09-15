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
  ({ label, error, id, wrapperClassName = '', className = '', leftIcon, rightIcon, isTextArea = false, rows = 3, value, ...props }, ref) => {
    const baseStyles = 'block w-full py-2.5 border rounded-lg shadow-sm focus:outline-none focus:ring-2 sm:text-sm disabled:bg-slate-100/50 disabled:cursor-not-allowed bg-bg-input text-text-body placeholder-text-muted';
    const borderStyles = error ? 'border-status-danger focus:ring-status-danger focus:border-status-danger' : 'border-border-input focus:ring-brand-primary-focus focus:border-brand-primary-focus';
    const paddingStyles = `${leftIcon ? 'pl-10' : 'px-3'} ${rightIcon && !isTextArea ? 'pr-10' : (isTextArea ? 'px-3' : 'pr-3')}`;

    const InputElement = isTextArea ? 'textarea' : 'input';
    const inputId = id || props.name;

    // This is the definitive fix. We explicitly intercept the `value` prop.
    // If it's null or undefined, we pass an empty string '' to the underlying input.
    // This guarantees the input is ALWAYS controlled and never receives an undefined value.
    // We also ensure numbers are converted to strings.
    const finalValue = (value === null || value === undefined) ? '' : String(value);

    return (
      <div className={wrapperClassName}>
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-text-body mb-1">
            {label}
          </label>
        )}
        <div className="relative">
          {!isTextArea && leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-heading">
              {React.cloneElement(leftIcon as React.ReactElement<{ size?: number }>, { size: 20 })}
            </div>
          )}
          <InputElement
            id={inputId}
            className={`${baseStyles} ${borderStyles} ${paddingStyles} ${className}`}
            rows={isTextArea ? rows : undefined}
            ref={ref as any}
            value={finalValue} // Use the sanitized value
            {...props} // Spread the rest of the props
          />
          {!isTextArea && rightIcon && (
            <label 
              htmlFor={inputId}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-text-heading cursor-pointer"
            >
               {React.cloneElement(rightIcon as React.ReactElement<{ size?: number }>, { size: 20 })}
            </label>
          )}
        </div>
        {error && <p className="mt-1 text-sm text-status-danger">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';