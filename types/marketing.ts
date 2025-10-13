import { LucideIcon } from "lucide-react";

export interface StatProps {
  icon: React.ReactElement<LucideIcon>;
  label: string;
  ariaLabel?: string;
}

export interface FeatureTileProps {
  icon: React.ReactElement<LucideIcon>;
  title: string;
  description: string;
  href?: string;
}

export interface TimelineStepProps {
  number: string;
  title: string;
  bullets: string[];
}

export interface PersonaTileProps {
  icon: React.ReactElement<LucideIcon>;
  title: string;
  points: string[];
  chips?: string[];
}

export interface FaqItemProps {
  question: string;
  answer: string;
}

export interface IconTileData {
  icon: React.ReactElement<LucideIcon>;
  label: string;
}