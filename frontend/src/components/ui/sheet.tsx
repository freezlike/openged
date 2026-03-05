import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

import { cn } from '../../lib/utils';

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

export function SheetPortal(props: DialogPrimitive.DialogPortalProps) {
  return <DialogPrimitive.Portal {...props} />;
}

export function SheetOverlay({ className, ...props }: DialogPrimitive.DialogOverlayProps) {
  return (
    <DialogPrimitive.Overlay
      className={cn('fixed inset-0 z-50 bg-black/35 backdrop-blur-[1px]', className)}
      {...props}
    />
  );
}

export function SheetContent({
  className,
  children,
  side = 'right',
  ...props
}: DialogPrimitive.DialogContentProps & {
  side?: 'top' | 'right' | 'bottom' | 'left';
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <DialogPrimitive.Content
        className={cn(
          'fixed z-50 gap-4 bg-white p-5 shadow-2xl transition ease-in-out',
          side === 'right' && 'inset-y-0 right-0 h-full w-full max-w-xl border-l border-[#e2e8f0]',
          side === 'left' && 'inset-y-0 left-0 h-full w-full max-w-xl border-r border-[#e2e8f0]',
          side === 'top' && 'inset-x-0 top-0 border-b border-[#e2e8f0]',
          side === 'bottom' && 'inset-x-0 bottom-0 border-t border-[#e2e8f0]',
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-[#2563eb]/40">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </SheetPortal>
  );
}

export function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col space-y-1.5 text-left', className)} {...props} />;
}

export function SheetTitle({ className, ...props }: DialogPrimitive.DialogTitleProps) {
  return <DialogPrimitive.Title className={cn('text-base font-semibold text-[#0f172a]', className)} {...props} />;
}

export function SheetDescription({ className, ...props }: DialogPrimitive.DialogDescriptionProps) {
  return <DialogPrimitive.Description className={cn('text-sm text-[#475569]', className)} {...props} />;
}
