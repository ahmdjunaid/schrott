import toast from 'react-hot-toast';
import { AlertTriangle, XCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '../components/UI';

interface ConfirmToastProps {
  message: string;
  onConfirm: () => void;
  onCancel?: () => void;
  t: any;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning';
}

const ConfirmToast = ({ 
  message, 
  onConfirm, 
  onCancel, 
  t, 
  confirmText = "Confirm", 
  cancelText = "Cancel",
  variant = 'danger'
}: ConfirmToastProps) => {
  return (
    <div className={cn(
      "max-w-md w-full bg-slate-900 shadow-2xl rounded-2xl pointer-events-auto flex flex-col overflow-hidden border border-slate-800 animate-in fade-in slide-in-from-top-5 duration-300",
      t.visible ? 'opacity-100' : 'opacity-0'
    )}>
      <div className="p-5 flex gap-4">
        <div className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-lg",
          variant === 'danger' ? "bg-rose-500/20 text-rose-500" : "bg-amber-500/20 text-amber-500"
        )}>
          {variant === 'danger' ? <XCircle size={24} strokeWidth={2.5} /> : <AlertTriangle size={24} strokeWidth={2.5} />}
        </div>
        <div className="flex-1 pt-1">
          <p className="text-sm font-black text-white italic leading-tight tracking-tight uppercase">Confirmation Required</p>
          <p className="text-[11px] font-bold text-slate-400 mt-1 leading-relaxed uppercase tracking-widest">{message}</p>
        </div>
      </div>
      <div className="flex border-t border-slate-800 py-2 px-3 bg-slate-950/50 gap-2">
        <button
          onClick={() => {
            if (onCancel) onCancel();
            toast.dismiss(t.id);
          }}
          className="flex-1 px-4 py-2.5 rounded-xl text-[10px] font-black text-slate-400 uppercase tracking-widest hover:bg-slate-800 hover:text-white transition-all active:scale-95"
        >
          {cancelText}
        </button>
        <button
          onClick={() => {
            onConfirm();
            toast.dismiss(t.id);
          }}
          className={cn(
            "flex-1 px-4 py-2.5 rounded-xl text-[10px] font-black text-white uppercase tracking-widest transition-all active:scale-95 shadow-lg",
            variant === 'danger' ? "bg-rose-600 hover:bg-rose-500 shadow-rose-900/40" : "bg-primary hover:bg-primary-hover shadow-primary/40"
          )}
        >
          {confirmText}
        </button>
      </div>
    </div>
  );
};

export const confirmToast = (
  message: string, 
  onConfirm: () => void, 
  options: { 
    onCancel?: () => void; 
    confirmText?: string; 
    cancelText?: string;
    variant?: 'danger' | 'warning';
  } = {}
) => {
  toast.custom(
    (t) => (
      <ConfirmToast 
        message={message} 
        onConfirm={onConfirm} 
        onCancel={options.onCancel} 
        t={t} 
        confirmText={options.confirmText}
        cancelText={options.cancelText}
        variant={options.variant}
      />
    ),
    {
      duration: Infinity,
      position: 'top-center'
    }
  );
};
