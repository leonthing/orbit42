import type { Metadata } from "next";
import { getPlaces, getMapStats } from "./actions";
import type { Place, MapStats } from "./actions";
import MapView from "./MapView";

export const metadata: Metadata = { title: "Map" };

export default async function MapPage() {
  let places: Place[];
  let stats: MapStats;

  try {
    [places, stats] = await Promise.all([getPlaces(), getMapStats()]);
  } catch {
    places = [];
    stats = {
      visitedCount: 0,
      wishlistCount: 0,
      visitedCountries: [],
      wishlistCountries: [],
    };
  }

  return <MapView places={places} stats={stats} />;
}
