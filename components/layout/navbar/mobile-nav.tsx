"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { NavLink } from "./nav-link";
import { NAV_ITEMS, NAVBAR_CONFIG } from "@/config/navigation";

interface MobileNavProps {
  currentPath: string | null;
}

export function MobileNav({ currentPath }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleLinkClick = () => {
    setIsOpen(false);
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open navigation menu">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>

      <SheetContent side="left" className="w-80 p-0">
        <SheetHeader className="sr-only">
          <SheetTitle>Navigation menu</SheetTitle>
        </SheetHeader>

        {/* Brand header */}
        <div className="px-4 py-3">
          <Link
            href="/feed"
            onClick={handleLinkClick}
            className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:rounded-md"
            aria-label="Go to feed"
          >
            <div className="inline-flex h-8 w-8 items-center justify-center rounded-md border bg-card">
              <LayoutGrid className="h-4 w-4 text-primary" aria-hidden="true" />
            </div>
            <span className="font-semibold tracking-tight">
              {NAVBAR_CONFIG.brandName}
            </span>
            <span
              lang="ja"
              className="text-xs text-muted-foreground align-baseline"
              aria-label="Ronbun in Japanese characters"
            >
              {NAVBAR_CONFIG.brandNameJa}
            </span>
            <Badge className="border border-primary/30 text-primary">beta</Badge>
          </Link>
        </div>

        <Separator />

        {/* Navigation links */}
        <nav className="flex flex-col p-2" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              isActive={currentPath?.startsWith(item.href) ?? false}
              onClick={handleLinkClick}
              className="justify-start"
            />
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}