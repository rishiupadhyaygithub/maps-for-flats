"use client";

interface Props {
  showMetro: boolean;
  onToggleMetro: () => void;
}

export default function CivicLayers({ showMetro, onToggleMetro }: Props) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <button
        onClick={onToggleMetro}
        className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full border font-medium transition-colors ${
          showMetro
            ? "bg-violet-600 text-white border-violet-600"
            : "border-gray-200 text-gray-500 hover:bg-gray-50"
        }`}
      >
        🚇 Metro lines
      </button>
    </div>
  );
}
