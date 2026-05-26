"use client";

import type { AmenityType } from "@/lib/types";
import { AMENITY_ICONS, AMENITY_COLORS } from "@/lib/utils";

const ALL_TYPES: AmenityType[] = [
  "metro",
  "hospital",
  "school",
  "supermarket",
  "restaurant",
  "park",
  "pharmacy",
  "bank",
  "gym",
];

const LABELS: Record<AmenityType, string> = {
  metro: "Metro",
  hospital: "Hospital",
  school: "School",
  supermarket: "Market",
  restaurant: "Restaurant",
  park: "Park",
  pharmacy: "Pharmacy",
  bank: "Bank",
  gym: "Gym",
};

interface Props {
  active: AmenityType[];
  onChange: (types: AmenityType[]) => void;
}

export default function AmenitiesToggle({ active, onChange }: Props) {
  function toggle(type: AmenityType) {
    const next = active.includes(type)
      ? active.filter((t) => t !== type)
      : [...active, type];
    onChange(next);
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {ALL_TYPES.map((type) => {
        const on = active.includes(type);
        const color = AMENITY_COLORS[type];
        return (
          <button
            key={type}
            onClick={() => toggle(type)}
            className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border transition-all"
            style={{
              background: on ? color : "transparent",
              borderColor: color,
              color: on ? "#fff" : color,
            }}
          >
            <span>{AMENITY_ICONS[type]}</span>
            <span>{LABELS[type]}</span>
          </button>
        );
      })}
    </div>
  );
}
