import { cva } from 'class-variance-authority'

export { default as Button } from './Button.vue'

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[--color-ring] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-[--color-primary] text-[--color-primary-foreground] shadow hover:bg-[--color-primary]/90',
        destructive: 'bg-red-600 text-white shadow-sm hover:bg-red-700',
        outline: 'border border-[--color-border] bg-transparent shadow-sm hover:bg-[--color-secondary] hover:text-[--color-foreground]',
        secondary: 'bg-[--color-secondary] text-[--color-secondary-foreground] shadow-sm hover:bg-[--color-secondary]/80',
        ghost: 'hover:bg-[--color-secondary] hover:text-[--color-foreground]',
        link: 'text-[--color-primary] underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)
