import Link from "next/link";
import { cn } from "@/lib/utils";
import type { NavLinkProps } from "@/types/navigation";

export function NavLink({ item, isActive, onClick, className }: NavLinkProps) {
  const Icon = item.icon;

  const baseStyles =
    "group inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";
  
  const activeStyles = "bg-accent text-foreground ring-1 ring-ring";
  const inactiveStyles = "text-muted-foreground hover:text-foreground hover:bg-accent";

  return (
    <Link
      href={item.href}
      onClick={onClick}
      aria-current={isActive ? "page" : undefined}
      aria-label={item.ariaLabel || item.label}
      className={cn(baseStyles, isActive ? activeStyles : inactiveStyles, className)}
    >
      {Icon && (
        <Icon
          className="h-4 w-4 text-primary/90 group-hover:text-primary"
          aria-hidden="true"
        />
      )}
      <span>{item.label}</span>
      {item.badge && (
        <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
          {item.badge}
        </span>
      )}
    </Link>
  );
}