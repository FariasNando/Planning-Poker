type ConfirmDialogProps = {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({ message, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/65" role="dialog" aria-modal="true" aria-label="Confirm action">
      <div className="w-[min(420px,90vw)] border border-slate-700 bg-slate-800 p-7 pb-[22px]">
        <p className="mb-[22px] text-[13px] leading-[1.6] text-slate-100">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            className="h-9 cursor-pointer border border-slate-700 bg-transparent px-3.5 text-[13px] font-bold text-slate-400 hover:bg-[#263548]"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="h-9 cursor-pointer border-0 bg-orange-500 px-3.5 text-[13px] font-bold text-white hover:bg-orange-600"
            onClick={onConfirm}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
