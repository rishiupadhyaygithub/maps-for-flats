"use client";

import { useEffect, useRef } from "react";
import type { Listing, Amenity, AmenityType } from "@/lib/types";
import type { OfficeLocation } from "./OfficeSearch";
import { priceMarkerColor, AMENITY_COLORS, AMENITY_ICONS, formatPrice, CITIES, type CitySlug } from "@/lib/utils";

interface Props {
  city: CitySlug;
  listings: Listing[];
  amenities: Amenity[];
  selectedListing: Listing | null;
  onSelectListing: (listing: Listing) => void;
  onDeselect: () => void;
  visibleAmenityTypes: AmenityType[];
  officeLocation: OfficeLocation | null;
  officeRadius: number;
  showMetro: boolean;
}

export default function MapView({
  city,
  listings,
  amenities,
  selectedListing,
  onSelectListing,
  onDeselect,
  visibleAmenityTypes,
  officeLocation,
  officeRadius,
  showMetro,
}: Props) {
  const mapRef          = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef  = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersLayerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const amenityLayerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const officeLayerRef  = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const metroLayerRef   = useRef<any>(null);

  // Keep stable ref so map click handler always has latest callback
  const onDeselectRef = useRef(onDeselect);
  onDeselectRef.current = onDeselect;

  // ── Init map once ─────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((mapRef.current as any)._leaflet_id) return;
    if (mapInstanceRef.current) return;

    let destroyed = false;

    import("leaflet").then(async (L) => {
      if (destroyed || !mapRef.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((mapRef.current as any)._leaflet_id) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Lx: any = L;

      // Fix webpack broken default icon paths
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (Lx.Icon.Default.prototype as any)._getIconUrl;
      Lx.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const cityConfig = CITIES[city] ?? CITIES.mumbai;
      const map = Lx.map(mapRef.current, {
        center: cityConfig.center,
        zoom: cityConfig.zoom,
        zoomControl: true,
      });

      Lx.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      // Click on blank map → deselect listing + clear amenities
      map.on("click", () => onDeselectRef.current());

      mapInstanceRef.current = map;
      // Order matters — lower layers first
      metroLayerRef.current   = Lx.layerGroup().addTo(map);
      markersLayerRef.current = Lx.layerGroup().addTo(map);
      amenityLayerRef.current = Lx.layerGroup().addTo(map);
      officeLayerRef.current  = Lx.layerGroup().addTo(map);
    });

    return () => {
      destroyed = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersLayerRef.current = null;
        amenityLayerRef.current = null;
        officeLayerRef.current  = null;
        metroLayerRef.current   = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sync listing markers ──────────────────────────────────────
  useEffect(() => {
    if (!markersLayerRef.current) return;

    import("leaflet").then((L) => {
      if (!markersLayerRef.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Lx: any = L;

      markersLayerRef.current.clearLayers();

      listings.forEach((listing) => {
        const color    = priceMarkerColor(listing.price, listing.price_unit);
        const label    = formatPrice(listing.price, listing.price_unit);
        const bhkLabel = listing.bhk ? `${listing.bhk}BHK · ` : "";
        const isSelected = selectedListing?.id === listing.id;
        const isApprox   = !listing.location_exact;

        const icon = Lx.divIcon({
          className: "",
          html: `<div style="
            background:${color};color:#fff;
            padding:3px 8px;border-radius:12px;
            font-size:11px;font-weight:700;white-space:nowrap;
            box-shadow:0 2px 8px rgba(0,0,0,0.4);
            border:${isSelected ? "2.5px solid #fff" : isApprox ? "1.5px dashed rgba(255,255,255,0.6)" : "1.5px solid rgba(255,255,255,0.3)"};
            transform:${isSelected ? "scale(1.22)" : "scale(1)"};
            opacity:${isApprox && !isSelected ? "0.82" : "1"};
          ">${isSelected ? bhkLabel : ""}${label}</div>`,
          iconAnchor: [0, 0],
        });

        Lx.marker([listing.lat, listing.lng], { icon })
          .on("click", (e: any) => {          // eslint-disable-line @typescript-eslint/no-explicit-any
            // Stop event reaching the map "click" handler so we don't immediately deselect
            Lx.DomEvent.stopPropagation(e);
            onSelectListing(listing);
          })
          .addTo(markersLayerRef.current);
      });

      // Fit bounds to current result set
      if (listings.length > 0 && mapInstanceRef.current) {
        const bounds = Lx.latLngBounds(listings.map((l: Listing) => [l.lat, l.lng]));
        mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listings, selectedListing]);

  // ── Sync amenity markers ──────────────────────────────────────
  useEffect(() => {
    if (!amenityLayerRef.current) return;

    import("leaflet").then((L) => {
      if (!amenityLayerRef.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Lx: any = L;

      amenityLayerRef.current.clearLayers();

      amenities
        .filter((a) => visibleAmenityTypes.includes(a.type))
        .forEach((amenity) => {
          const color = AMENITY_COLORS[amenity.type] ?? "#6b7280";
          const icon  = AMENITY_ICONS[amenity.type]  ?? "📍";

          const markerIcon = Lx.divIcon({
            className: "",
            html: `<div style="
              background:${color};border-radius:50%;
              width:28px;height:28px;
              display:flex;align-items:center;justify-content:center;
              font-size:14px;box-shadow:0 2px 4px rgba(0,0,0,0.3);
            ">${icon}</div>`,
            iconAnchor: [14, 14],
          });

          Lx.marker([amenity.lat, amenity.lng], { icon: markerIcon })
            .on("click", (e: any) => Lx.DomEvent.stopPropagation(e)) // eslint-disable-line @typescript-eslint/no-explicit-any
            .bindPopup(`<strong>${amenity.name}</strong><br/>${amenity.distance_m ?? "?"}m away`)
            .addTo(amenityLayerRef.current);
        });
    });
  }, [amenities, visibleAmenityTypes]);

  // ── Pan to selected listing ───────────────────────────────────
  useEffect(() => {
    if (!selectedListing || !mapInstanceRef.current) return;
    mapInstanceRef.current.setView(
      [selectedListing.lat, selectedListing.lng],
      15,
      { animate: true }
    );
  }, [selectedListing]);

  // ── Re-centre when city changes ──────────────────────────────
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const cfg = CITIES[city] ?? CITIES.mumbai;
    mapInstanceRef.current.setView(cfg.center, cfg.zoom, { animate: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city]);

  // ── Office pin + radius circle ────────────────────────────────
  useEffect(() => {
    if (!officeLayerRef.current) return;

    import("leaflet").then((L) => {
      if (!officeLayerRef.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Lx: any = L;

      officeLayerRef.current.clearLayers();

      if (!officeLocation) return;

      // Radius circle
      Lx.circle([officeLocation.lat, officeLocation.lng], {
        radius: officeRadius,
        color: "#7c3aed",
        fillColor: "#7c3aed",
        fillOpacity: 0.08,
        weight: 2,
        dashArray: "6 4",
      }).addTo(officeLayerRef.current);

      // Office pin
      const officeIcon = Lx.divIcon({
        className: "",
        html: `<div style="
          background:#7c3aed;color:#fff;
          width:36px;height:36px;border-radius:50% 50% 50% 0;
          transform:rotate(-45deg);
          box-shadow:0 3px 10px rgba(124,58,237,0.5);
          border:3px solid #fff;
          display:flex;align-items:center;justify-content:center;
        "><span style="transform:rotate(45deg);font-size:16px;">💼</span></div>`,
        iconAnchor: [18, 36],
      });

      Lx.marker([officeLocation.lat, officeLocation.lng], { icon: officeIcon })
        .on("click", (e: any) => Lx.DomEvent.stopPropagation(e)) // eslint-disable-line @typescript-eslint/no-explicit-any
        .bindPopup(`<strong>${officeLocation.name}</strong><br/>Your office`)
        .addTo(officeLayerRef.current);

      // Pan to office
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setView([officeLocation.lat, officeLocation.lng], 13, { animate: true });
      }
    });
  }, [officeLocation, officeRadius]);

  // ── Metro lines + stations ────────────────────────────────────
  useEffect(() => {
    if (!metroLayerRef.current) return;
    import("leaflet").then((L) => {
      if (!metroLayerRef.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Lx: any = L;
      metroLayerRef.current.clearLayers();
      if (!showMetro) return;

      // Lines — city-specific file
      fetch(`/data/metro_lines_${city}.geojson`)
        .then((r) => r.json())
        .then((geojson) => {
          if (!metroLayerRef.current) return;
          Lx.geoJSON(geojson, {
            style: (feature: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
              color:     feature.properties.color,
              weight:    feature.properties.status === "open" ? 4 : 3,
              opacity:   feature.properties.status === "open" ? 0.9 : 0.5,
              dashArray: feature.properties.status === "open" ? "" : "8 5",
            }),
            onEachFeature: (feature: any, layer: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
              const p = feature.properties;
              const statusBadge = p.status === "open"
                ? `<span style="color:#16a34a">● Open since ${p.open_year}</span>`
                : p.status === "under_construction"
                ? `<span style="color:#d97706">● Under construction (${p.open_year})</span>`
                : `<span style="color:#6b7280">● Planned (${p.open_year})</span>`;
              layer.bindPopup(`<strong>${p.name}</strong><br/>${statusBadge}`);
              layer.on("click", (e: any) => Lx.DomEvent.stopPropagation(e)); // eslint-disable-line @typescript-eslint/no-explicit-any
            },
          }).addTo(metroLayerRef.current);
        });

      // Stations — city-specific file
      fetch(`/data/metro_stations_${city}.json`)
        .then((r) => r.json())
        .then((stations: Array<{ name: string; lat: number; lng: number; lines: string[] }>) => {
          if (!metroLayerRef.current) return;
          stations.forEach((s) => {
            const icon = Lx.divIcon({
              className: "",
              html: `<div style="
                background:#7c3aed;border-radius:50%;
                width:10px;height:10px;
                border:2px solid white;
                box-shadow:0 1px 4px rgba(0,0,0,0.4);
              "></div>`,
              iconAnchor: [5, 5],
            });
            Lx.marker([s.lat, s.lng], { icon })
              .on("click", (e: any) => Lx.DomEvent.stopPropagation(e)) // eslint-disable-line @typescript-eslint/no-explicit-any
              .bindPopup(`<strong>🚇 ${s.name}</strong><br/>Lines: ${s.lines.join(", ") || "–"}`)
              .addTo(metroLayerRef.current);
          });
        });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMetro, city]);

  return <div ref={mapRef} className="w-full h-full" />;
}
