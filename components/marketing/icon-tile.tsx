interface IconTileProps {
  children: React.ReactNode;
  label?: string;
}

export function IconTile({ children, label }: IconTileProps) {
  return (
    <div
      className="group flex h-16 w-16 items-center justify-center rounded-md border bg-card/90 ring-1 ring-transparent transition-all hover:-translate-y-0.5 hover:ring-primary/30"
      role="presentation"
      aria-label={label}
    >
      <div className="rounded-md bg-accent p-2 ring-1 ring-ring">{children}</div>
    </div>
  );
}