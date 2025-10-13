interface ChipProps {
  children: React.ReactNode;
}

export function Chip({ children }: ChipProps) {
  return (
    <span className="inline-flex items-center rounded-md border px-2 py-1 text-[11px]">
      {children}
    </span>
  );
}