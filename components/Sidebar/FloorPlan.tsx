"use client";

import { useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";

interface Props {
  images: string[];
}

export default function FloorPlan({ images }: Props) {
  const [lightbox, setLightbox] = useState<string | null>(null);

  if (!images.length) {
    return (
      <div className="flex items-center justify-center h-24 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 text-sm">
        No floor plan available
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        {images.map((src, i) => (
          <button
            key={i}
            onClick={() => setLightbox(src)}
            className="relative aspect-[4/3] rounded-lg overflow-hidden border border-gray-200 hover:border-blue-400 transition-colors group"
          >
            <Image
              src={src}
              alt={`Floor plan ${i + 1}`}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-200"
              unoptimized
            />
          </button>
        ))}
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 bg-black/80 z-[9999] flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-1"
            onClick={() => setLightbox(null)}
          >
            <X size={24} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="Floor plan"
            className="max-h-[90vh] max-w-full rounded-xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
