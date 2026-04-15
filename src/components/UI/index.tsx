import React, { ReactNode, ComponentType } from 'react';
import { createPortal } from 'react-dom';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: ComponentType<{ size: number | string; className?: string }>;
}

export function Button({ className, variant = 'primary', size = 'md', icon: Icon, children, ...props }: ButtonProps) {
  const variants = {
    primary: 'bg-primary text-white shadow-md shadow-primary/20 hover:bg-primary/95 hover:shadow-lg hover:shadow-primary/30 active:scale-95',
    secondary: 'bg-white text-slate-700 border border-slate-200 shadow-sm hover:bg-slate-50 hover:border-slate-300 active:scale-95',
    ghost: 'bg-transparent hover:bg-slate-100 text-slate-600 font-semibold',
    danger: 'bg-red-500 text-white shadow-md shadow-red-500/20 hover:bg-red-600 active:scale-95',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-8 py-3.5 text-base',
  };

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-bold transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {Icon && <Icon size={size === 'sm' ? 14 : 18} />}
      {children}
    </button>
  );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ className, label, error, ...props }: InputProps) {
  return (
    <div className="space-y-1.5 w-full">
      {label && <label className="text-sm font-semibold text-slate-500 ml-1">{label}</label>}
      <input
        className={cn(
          'flex h-11 w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm transition-all focus:border-primary/50 focus:ring-4 focus:ring-primary/5 outline-none placeholder:text-slate-300',
          error && 'border-red-300 focus:ring-red-50',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs font-medium text-red-500 ml-1 mt-1">{error}</p>}
    </div>
  );
}

interface BadgeProps {
  status?: string;
  children?: ReactNode;
}

export function Badge({ status, children }: BadgeProps) {
  const styles: Record<string, string> = {
    ACTIVE: 'bg-green-50 text-green-600',
    PAID: 'bg-green-50 text-green-600',
    PENDING: 'bg-orange-50 text-orange-600',
    PARTIAL: 'bg-blue-50 text-blue-600',
    INACTIVE: 'bg-slate-50 text-slate-500',
    ONBOARDING: 'bg-blue-50 text-blue-600',
  };

  const dots: Record<string, string> = {
    ACTIVE: 'bg-green-500',
    PAID: 'bg-green-500',
    PENDING: 'bg-orange-500',
    PARTIAL: 'bg-blue-500',
    INACTIVE: 'bg-slate-400',
    ONBOARDING: 'bg-blue-500',
  };

  const normalizedStatus = status?.toUpperCase() || 'INACTIVE';

  return (
    <span className={cn(
      'inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider leading-none border border-transparent',
      styles[normalizedStatus] || styles.INACTIVE
    )}>
      <span className={cn('w-1.5 h-1.5 rounded-full', dots[normalizedStatus] || dots.INACTIVE)} />
      {children || normalizedStatus}
    </span>
  );
}

interface CardProps {
  className?: string;
  children: ReactNode;
  title?: string;
  description?: string;
  footer?: ReactNode;
  padding?: string;
}

export function Card({ className, children, title, description, footer, padding = "p-8" }: CardProps) {
  return (
    <div className={cn('bg-white rounded-3xl border border-slate-100 shadow-sm shadow-slate-200/50 overflow-hidden', className)}>
      {(title || description) && (
        <div className="px-8 py-6">
          {title && <h3 className="text-2xl font-bold text-slate-900 leading-tight">{title}</h3>}
          {description && <p className="text-sm text-slate-500 mt-2 font-medium leading-relaxed">{description}</p>}
        </div>
      )}
      <div className={padding}>{children}</div>
      {footer && <div className="px-8 py-6 bg-slate-50 border-t border-slate-50 flex items-center">{footer}</div>}
    </div>
  );
}

interface TableProps {
  headers: string[];
  children: ReactNode;
  className?: string;
}

export function Table({ headers, children, className }: TableProps) {
  return (
    <div className={cn('overflow-x-auto rounded-3xl border border-slate-100 bg-white', className)}>
      <table className="w-full text-sm text-left border-collapse">
        <thead className="">
          <tr className="border-b border-slate-100">
            {headers.map((header, i) => (
              <th key={header + i} className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50 text-slate-600">
          {children}
        </tbody>
      </table>
    </div>
  );
}

interface AvatarProps {
  src?: string;
  fallback?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Avatar({ src, fallback, size = "md" }: AvatarProps) {
  const sizes = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-12 h-12"
  };
  
  return (
    <div className={cn("rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0", sizes[size])}>
      {src ? (
        <img src={src} alt="Avatar" className="w-full h-full object-cover" />
      ) : (
        <span className="text-sm font-bold text-slate-500 uppercase">{fallback?.slice(0, 2)}</span>
      )}
    </div>
  );
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function Modal({ isOpen, onClose, title, children, footer, className }: ModalProps) {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300" 
        onClick={onClose} 
      />
      <div className={cn(
        "relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 fade-in duration-300",
        className
      )}>
        {/* Header - Fixed */}
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between shrink-0">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{title}</h2>
          <button 
            onClick={onClose} 
            className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
          {children}
        </div>

        {/* Footer - Fixed */}
        {footer && (
          <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
