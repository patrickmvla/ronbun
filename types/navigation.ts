import type { LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon?: LucideIcon;
  badge?: string;
  ariaLabel?: string;
}

export interface NavLinkProps {
  item: NavItem;
  isActive: boolean;
  onClick?: () => void;
  className?: string;
}