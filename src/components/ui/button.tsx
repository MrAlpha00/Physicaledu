import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border border-transparent text-sm font-bold uppercase tracking-[0.08em] transition-all duration-150 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt",
  {
    variants: {
      variant: {
        default: "bg-navy text-chalk hover:bg-navy-deep hover:-translate-y-0.5",
        lime: "bg-lime text-navy hover:bg-[#d7ff83] hover:-translate-y-0.5",
        cobalt: "bg-cobalt text-white hover:bg-[#2853cf] hover:-translate-y-0.5",
        outline:
          "border-navy/25 bg-transparent text-navy hover:border-navy hover:bg-navy/5",
        secondary: "bg-secondary text-secondary-foreground hover:bg-chalk-dark",
        ghost: "text-navy hover:bg-navy/8",
        destructive: "bg-coral-dark text-white hover:bg-[#a93a27]",
        link: "border-transparent text-cobalt underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-7 text-base",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
