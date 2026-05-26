"use client";

interface Props {
  lat: number;
  lng: number;
}

// Google Maps embed — no API key required for this embed form
export default function StreetView({ lat, lng }: Props) {
  const src = `https://maps.google.com/maps?q=${lat},${lng}&layer=c&z=15&output=embed`;

  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-100">
      <iframe
        src={src}
        width="100%"
        height="240"
        style={{ border: 0 }}
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        title="Area view"
      />
      <div className="px-3 py-1.5 text-xs text-gray-400 flex items-center gap-1">
        <span>🗺️</span>
        <span>Google Maps — click and drag to explore street level</span>
      </div>
    </div>
  );
}
