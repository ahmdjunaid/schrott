import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronDown, X } from 'lucide-react';
import { cn } from './index';

interface Option {
  id?: string;
  value?: string;
  name?: string;
  label?: string;
  subtitle?: string;
  [key: string]: any;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Select an option...",
  error,
  disabled = false
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find(opt => (opt.id || opt.value) === value);

  const updateCoords = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  };

  useLayoutEffect(() => {
    if (isOpen) {
      updateCoords();
      window.addEventListener('scroll', updateCoords, true);
      window.addEventListener('resize', updateCoords);
    }
    return () => {
      window.removeEventListener('scroll', updateCoords, true);
      window.removeEventListener('resize', updateCoords);
    };
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        const portalDropdown = document.getElementById('searchable-select-portal');
        if (portalDropdown && portalDropdown.contains(event.target as Node)) return;
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt => {
    const label = opt.name || opt.label || '';
    const subtitle = opt.subtitle || '';
    const searchStr = `${label} ${subtitle}`.toLowerCase();
    return searchStr.includes(searchTerm.toLowerCase());
  });

  const handleSelect = (optionId: string) => {
    onChange(optionId);
    setIsOpen(false);
    setSearchTerm('');
  };

  const clearSelection = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearchTerm('');
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <div
        className={cn(
          "flex h-11 w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium shadow-sm transition-all focus-within:border-primary/40 focus-within:ring-[3px] focus-within:ring-primary/10 cursor-pointer overflow-hidden",
          error && "border-red-300",
          disabled && "opacity-50 cursor-not-allowed pointer-events-none"
        )}
        onClick={() => { if (!disabled) { setIsOpen(!isOpen); if (!isOpen) setTimeout(() => inputRef.current?.focus(), 10); } }}
      >
        <div className="flex-1 truncate">
          {selectedOption ? (
            <div className="flex flex-col leading-tight">
               <span className="font-bold text-slate-900 truncate">{selectedOption.name || selectedOption.label}</span>
               {selectedOption.subtitle && <span className="text-[9px] text-slate-400 font-bold uppercase truncate">{selectedOption.subtitle}</span>}
            </div>
          ) : (
            <span className="text-slate-300 font-medium">{placeholder}</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          {selectedOption && !disabled && (
            <button onClick={clearSelection} className="hover:text-red-500 transition-colors">
              <X size={14} />
            </button>
          )}
          <ChevronDown size={18} className={cn("transition-transform duration-200", isOpen && "rotate-180")} />
        </div>
      </div>

      {isOpen && createPortal(
        <div 
          id="searchable-select-portal"
          className="fixed z-[9999] bg-white border border-slate-200 rounded-xl shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden"
          style={{
            top: coords.top + 8,
            left: coords.left,
            width: coords.width,
          }}
        >
          <div className="p-2 border-b border-slate-100 bg-slate-50/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
              <input
                ref={inputRef}
                type="text"
                className="w-full h-9 pl-9 pr-4 bg-white border border-slate-200 rounded-lg text-sm font-medium outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/30 transition-all"
                placeholder="Type to search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto custom-scrollbar p-1.5">
            {filteredOptions.length === 0 ? (
              <div className="py-8 px-4 text-center">
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] italic">No results found</p>
              </div>
            ) : (
              filteredOptions.map(option => (
                <div
                  key={option.id || option.value}
                  className={cn(
                    "px-4 py-2 rounded-lg transition-all cursor-pointer mb-0.5 last:mb-0",
                    value === (option.id || option.value) 
                      ? "bg-primary text-white shadow-sm" 
                      : "text-slate-600 hover:bg-slate-50 hover:text-primary border border-transparent"
                  )}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSelect(option.id || option.value || '');
                  }}
                >
                  <div className="flex justify-between items-center gap-3">
                    <div className="flex flex-col min-w-0">
                       <span className={cn("text-xs font-black uppercase truncate", value === (option.id || option.value) ? "text-white" : "text-slate-900")}>
                          {option.name || option.label}
                       </span>
                       {option.subtitle && (
                         <span className={cn("text-[8px] font-bold uppercase tracking-widest leading-normal", value === (option.id || option.value) ? "text-white/60" : "text-slate-400")}>
                            {option.subtitle}
                         </span>
                       )}
                    </div>
                    {option.stock !== undefined && (
                      <span className={cn(
                        "text-[8px] px-2 py-0.5 rounded border font-black uppercase tracking-tighter shrink-0",
                        value === (option.id || option.value) 
                          ? "bg-white/20 border-white/30 text-white" 
                          : "bg-slate-100 border-slate-200 text-slate-400"
                      )}>
                        {option.stock}u
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>,
        document.body
      )}
      {error && <p className="text-[10px] font-bold text-red-500 ml-1 mt-1 uppercase tracking-tight">{error}</p>}
    </div>
  );
}
