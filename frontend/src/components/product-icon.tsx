import {
  AudioWaveform, Bot, Box, BrainCircuit, Camera, Cloud, Cpu, Database, MessageSquare, Radio, ScanEye, ScanText,
  Server, Shield, Smartphone, Utensils, Wifi, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** Curated icon set products can pick as their "logo" (stored as the kebab-case name). */
export const PRODUCT_ICONS: Record<string, LucideIcon> = {
  box: Box, radio: Radio, "brain-circuit": BrainCircuit, server: Server, bot: Bot, "message-square": MessageSquare,
  "scan-eye": ScanEye, "audio-waveform": AudioWaveform, utensils: Utensils, "scan-text": ScanText, cpu: Cpu,
  cloud: Cloud, database: Database, smartphone: Smartphone, wifi: Wifi, shield: Shield, camera: Camera,
};

export const PRODUCT_COLORS = ["#2563eb", "#7c3aed", "#0891b2", "#16a34a", "#ea580c", "#db2777", "#0d9488", "#ca8a04", "#4f46e5", "#52525b"];

export function ProductIcon({ icon, color, size = 32, className }: { icon: string; color: string; size?: number; className?: string }) {
  const Icon = PRODUCT_ICONS[icon] ?? Box;
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-md", className)}
      style={{ width: size, height: size, backgroundColor: `${color}1a`, color }}
    >
      <Icon style={{ width: size * 0.55, height: size * 0.55 }} />
    </span>
  );
}
