import { cn } from "@/lib/utils";

interface Props {
  children: React.ReactNode;
  color?: string;
  className?: string;
}

export default function Badge({ children, color, className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        !color && "bg-gray-100 text-gray-700",
        className
      )}
      style={color ? { background: color, color: "#fff" } : undefined}
    >
      {children}
    </span>
  );
}
