"use client";

import { memo, useState, useCallback } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";

const GEO_URL =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

const COLORS = {
  visited: "#f59e0b",
  visitedHover: "#fbbf24",
  wishlist: "#6366f1",
  wishlistHover: "#818cf8",
  default: "#1e293b",
  defaultHover: "#334155",
  stroke: "#0a0a0f",
};

function WorldMap({
  visitedCodes,
  wishlistCodes,
  onCountryClick,
  countryMap,
}: {
  visitedCodes: Set<string>;
  wishlistCodes: Set<string>;
  onCountryClick: (geoName: string) => void;
  countryMap: Record<string, string>;
}) {
  const [tooltipContent, setTooltipContent] = useState("");

  const getFill = useCallback(
    (geoName: string) => {
      const code = countryMap[geoName];
      if (!code) return COLORS.default;
      if (visitedCodes.has(code)) return COLORS.visited;
      if (wishlistCodes.has(code)) return COLORS.wishlist;
      return COLORS.default;
    },
    [visitedCodes, wishlistCodes, countryMap]
  );

  const getHoverFill = useCallback(
    (geoName: string) => {
      const code = countryMap[geoName];
      if (!code) return COLORS.defaultHover;
      if (visitedCodes.has(code)) return COLORS.visitedHover;
      if (wishlistCodes.has(code)) return COLORS.wishlistHover;
      return COLORS.defaultHover;
    },
    [visitedCodes, wishlistCodes, countryMap]
  );

  return (
    <div className="relative aspect-[2/1] w-full">
      <ComposableMap
        projectionConfig={{
          rotate: [-10, 0, 0],
          scale: 180,
        }}
        style={{ width: "100%", height: "100%" }}
      >
        <ZoomableGroup>
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const geoName = geo.properties.name as string;
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={getFill(geoName)}
                    stroke={COLORS.stroke}
                    strokeWidth={0.5}
                    onClick={() => onCountryClick(geoName)}
                    onMouseEnter={() => {
                      setTooltipContent(geoName);
                    }}
                    onMouseLeave={() => {
                      setTooltipContent("");
                    }}
                    style={{
                      default: { outline: "none" },
                      hover: {
                        fill: getHoverFill(geoName),
                        outline: "none",
                        cursor: "pointer",
                      },
                      pressed: { outline: "none" },
                    }}
                  />
                );
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>

      {/* Tooltip */}
      {tooltipContent && (
        <div className="pointer-events-none absolute bottom-4 left-4 rounded-lg bg-charcoal-900/90 px-3 py-1.5 text-sm text-charcoal-200 backdrop-blur-sm">
          {tooltipContent}
        </div>
      )}
    </div>
  );
}

export default memo(WorldMap);
