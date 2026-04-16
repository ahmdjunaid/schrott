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
    primary: 'bg-primary text-white shadow-sm hover:bg-primary-hover active:scale-[0.98]',
    secondary: 'bg-white text-slate-700 border border-slate-200 shadow-sm hover:bg-slate-50 hover:border-slate-300 active:scale-[0.98]',
    ghost: 'bg-transparent hover:bg-slate-100/80 text-slate-600',
    danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700 active:scale-[0.98]',
  };

  const sizes = {
    sm: 'px-3.5 py-2 text-xs',
    md: 'px-6 py-2.5 text-sm',
    lg: 'px-8 py-3.5 text-base',
  };

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none tracking-tight',
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
      {label && <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">{label}</label>}
      <input
        className={cn(
          'flex h-11 w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm transition-all focus:border-primary/40 focus:ring-[3px] focus:ring-primary/10 outline-none placeholder:text-slate-300',
          error && 'border-red-300 focus:ring-red-500/10',
          className
        )}
        {...props}
      />
      {error && <p className="text-[10px] font-bold text-red-500 ml-1 mt-1 uppercase tracking-tight">{error}</p>}
    </div>
  );
}

interface BadgeProps {
  status?: string;
  children?: ReactNode;
  className?: string;
}

export function Badge({ status, children, className }: BadgeProps) {
  const normalizedStatus = status?.toUpperCase() || 'INACTIVE';
  
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-black tracking-widest leading-none border uppercase',
      normalizedStatus === 'ACTIVE' || normalizedStatus === 'PAID' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
      normalizedStatus === 'PENDING' ? 'bg-amber-50 text-amber-700 border-amber-100' :
      normalizedStatus === 'PARTIAL' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :
      'bg-slate-50 text-slate-600 border-slate-200',
      className
    )}>
      <span className={cn('w-1 h-1 rounded-full', 
        normalizedStatus === 'ACTIVE' || normalizedStatus === 'PAID' ? 'bg-emerald-500' :
        normalizedStatus === 'PENDING' ? 'bg-amber-500' :
        normalizedStatus === 'PARTIAL' ? 'bg-indigo-500' :
        'bg-slate-400'
      )} />
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

export function Card({ className, children, title, description, footer, padding = "p-6" }: CardProps) {
  return (
    <div className={cn('bg-white rounded-xl border border-slate-200 shadow-sm shadow-slate-200/40 overflow-hidden', className)}>
      {(title || description) && (
        <div className="px-6 py-5 border-b border-slate-50 bg-slate-50/30">
          {title && <h3 className="text-lg font-bold text-slate-900 tracking-tight">{title}</h3>}
          {description && <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">{description}</p>}
        </div>
      )}
      <div className={padding}>{children}</div>
      {footer && <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center">{footer}</div>}
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
    <div className={cn('overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm', className)}>
      <table className="w-full text-sm text-left border-collapse">
        <thead>
          <tr className="bg-slate-50/80 border-b border-slate-200">
            {headers.map((header, i) => (
              <th key={header + i} className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-slate-600">
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
  className?: string;
}

export function Avatar({ src, fallback, size = "md", className }: AvatarProps) {
  const sizes = {
    sm: "w-8 h-8 text-[10px]",
    md: "w-10 h-10 text-xs",
    lg: "w-12 h-12 text-sm"
  };
  
  return (
    <div className={cn("rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center overflow-hidden shrink-0", sizes[size], className)}>
      {src ? (
        <img src={src} alt="Avatar" className="w-full h-full object-cover" />
      ) : (
        <span className="font-black text-indigo-600 uppercase">{fallback?.slice(0, 2)}</span>
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
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-6">
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" 
        onClick={onClose} 
      />
      <div className={cn(
        "relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[95vh] flex flex-col overflow-hidden animate-in zoom-in-95 fade-in duration-300",
        className
      )}>
        {/* Header - Fixed */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">{title}</h2>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="p-6 sm:p-8 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/30">
          {children}
        </div>

        {/* Footer - Fixed */}
        {footer && (
          <div className="px-6 py-4 bg-white border-t border-slate-100 flex justify-end gap-3 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({ currentPage, totalPages, onPageChange, className }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div className={cn("flex items-center justify-between px-6 py-4 bg-slate-50/30 border-t border-slate-100", className)}>
      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
        Page <span className="text-slate-900">{currentPage}</span> of {totalPages}
      </div>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-2 rounded-lg hover:bg-white hover:shadow-sm disabled:opacity-30 disabled:pointer-events-none transition-all text-slate-400 hover:text-primary border border-transparent hover:border-slate-200"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        
        {pages.map(page => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={cn(
              "w-8 h-8 rounded-lg text-[10px] font-black transition-all border",
              currentPage === page
                ? "bg-primary text-white border-primary shadow-md shadow-primary/20 scale-110 z-10"
                : "bg-white text-slate-400 border-slate-200 hover:border-primary/40 hover:text-primary"
            )}
          >
            {page}
          </button>
        ))}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-2 rounded-lg hover:bg-white hover:shadow-sm disabled:opacity-30 disabled:pointer-events-none transition-all text-slate-400 hover:text-primary border border-transparent hover:border-slate-200"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
