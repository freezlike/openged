import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../../lib/utils';

const badgeVariants = cva('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', {
  variants: {
    variant: {
      default: 'bg-[#dbeafe] text-[#1d4ed8]',
      muted: 'bg-[#e2e8f0] text-[#334155]',
      success: 'bg-[#dcfce7] text-[#15803d]',
      warning: 'bg-[#fef3c7] text-[#b45309]',
      danger: 'bg-[#fee2e2] text-[#b91c1c]',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
