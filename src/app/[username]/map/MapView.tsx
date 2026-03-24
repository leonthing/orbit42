"use client";

import { useState, useTransition, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import type { Place, MapStats } from "./actions";
import { addPlace, updatePlace, deletePlace } from "./actions";

const WorldMap = dynamic(() => import("./WorldMap"), { ssr: false });

// Country name -> ISO alpha-3 mapping (comprehensive)
const COUNTRY_MAP: Record<string, string> = {
  Afghanistan: "AFG", Albania: "ALB", Algeria: "DZA", Angola: "AGO",
  Argentina: "ARG", Armenia: "ARM", Australia: "AUS", Austria: "AUT",
  Azerbaijan: "AZE", Bahamas: "BHS", Bangladesh: "BGD", Belarus: "BLR",
  Belgium: "BEL", Belize: "BLZ", Benin: "BEN", Bhutan: "BTN",
  Bolivia: "BOL", "Bosnia and Herz.": "BIH", "Bosnia and Herzegovina": "BIH",
  Botswana: "BWA", Brazil: "BRA", Brunei: "BRN", Bulgaria: "BGR",
  "Burkina Faso": "BFA", Burundi: "BDI", Cambodia: "KHM", Cameroon: "CMR",
  Canada: "CAN", "Central African Rep.": "CAF", "Central African Republic": "CAF",
  Chad: "TCD", Chile: "CHL", China: "CHN", Colombia: "COL",
  "Congo": "COG", "Dem. Rep. Congo": "COD", "Costa Rica": "CRI",
  "Côte d'Ivoire": "CIV", "Ivory Coast": "CIV", Croatia: "HRV",
  Cuba: "CUB", Cyprus: "CYP", Czechia: "CZE", "Czech Republic": "CZE",
  Denmark: "DNK", Djibouti: "DJI", "Dominican Rep.": "DOM",
  "Dominican Republic": "DOM", Ecuador: "ECU", Egypt: "EGY",
  "El Salvador": "SLV", "Eq. Guinea": "GNQ", "Equatorial Guinea": "GNQ",
  Eritrea: "ERI", Estonia: "EST", Eswatini: "SWZ", Ethiopia: "ETH",
  Fiji: "FJI", Finland: "FIN", France: "FRA", Gabon: "GAB",
  Gambia: "GMB", Georgia: "GEO", Germany: "DEU", Ghana: "GHA",
  Greece: "GRC", Guatemala: "GTM", Guinea: "GIN", "Guinea-Bissau": "GNB",
  Guyana: "GUY", Haiti: "HTI", Honduras: "HND", Hungary: "HUN",
  Iceland: "ISL", India: "IND", Indonesia: "IDN", Iran: "IRN",
  Iraq: "IRQ", Ireland: "IRL", Israel: "ISR", Italy: "ITA",
  Jamaica: "JAM", Japan: "JPN", Jordan: "JOR", Kazakhstan: "KAZ",
  Kenya: "KEN", "North Korea": "PRK", "South Korea": "KOR",
  Korea: "KOR", Kuwait: "KWT", Kyrgyzstan: "KGZ", Laos: "LAO",
  Latvia: "LVA", Lebanon: "LBN", Lesotho: "LSO", Liberia: "LBR",
  Libya: "LBY", Lithuania: "LTU", Luxembourg: "LUX", Madagascar: "MDG",
  Malawi: "MWI", Malaysia: "MYS", Mali: "MLI", Mauritania: "MRT",
  Mexico: "MEX", Moldova: "MDA", Mongolia: "MNG", Montenegro: "MNE",
  Morocco: "MAR", Mozambique: "MOZ", Myanmar: "MMR", Namibia: "NAM",
  Nepal: "NPL", Netherlands: "NLD", "New Zealand": "NZL", Nicaragua: "NIC",
  Niger: "NER", Nigeria: "NGA", "North Macedonia": "MKD", Norway: "NOR",
  Oman: "OMN", Pakistan: "PAK", Palestine: "PSE", Panama: "PAN",
  "Papua New Guinea": "PNG", Paraguay: "PRY", Peru: "PER",
  Philippines: "PHL", Poland: "POL", Portugal: "PRT", Qatar: "QAT",
  Romania: "ROU", Russia: "RUS", Rwanda: "RWA", "Saudi Arabia": "SAU",
  "S. Sudan": "SSD", "South Sudan": "SSD",
  Senegal: "SEN", Serbia: "SRB", "Sierra Leone": "SLE", Singapore: "SGP",
  Slovakia: "SVK", Slovenia: "SVN", "Solomon Is.": "SLB",
  "Solomon Islands": "SLB", Somalia: "SOM", "South Africa": "ZAF",
  Spain: "ESP", "Sri Lanka": "LKA", Sudan: "SDN", Suriname: "SUR",
  Sweden: "SWE", Switzerland: "CHE", Syria: "SYR", Taiwan: "TWN",
  Tajikistan: "TJK", Tanzania: "TZA", Thailand: "THA", "Timor-Leste": "TLS",
  Togo: "TGO", "Trinidad and Tobago": "TTO", Tunisia: "TUN",
  Turkey: "TUR", Turkmenistan: "TKM", Uganda: "UGA", Ukraine: "UKR",
  "United Arab Emirates": "ARE", "United Kingdom": "GBR",
  "United States of America": "USA", "United States": "USA",
  Uruguay: "URY", Uzbekistan: "UZB", Venezuela: "VEN", Vietnam: "VNM",
  "W. Sahara": "ESH", "Western Sahara": "ESH", Yemen: "YEM",
  Zambia: "ZMB", Zimbabwe: "ZWE",
  "Fr. S. Antarctic Lands": "ATF", Falkland: "FLK", "Falkland Is.": "FLK",
  "Fr. Guiana": "GUF", "New Caledonia": "NCL", Vanuatu: "VUT",
  "Puerto Rico": "PRI", Greenland: "GRL", Antarctica: "ATA",
};

// Reverse: code -> name
const CODE_TO_NAME: Record<string, string> = {};
for (const [name, code] of Object.entries(COUNTRY_MAP)) {
  if (!CODE_TO_NAME[code]) CODE_TO_NAME[code] = name;
}

// All countries for the selector (sorted)
const ALL_COUNTRIES = Object.entries(COUNTRY_MAP)
  .filter(([name]) => !["Ivory Coast", "Czech Republic", "Central African Republic", "Dominican Republic", "Equatorial Guinea", "South Sudan", "Solomon Islands", "Western Sahara", "Bosnia and Herzegovina", "Korea", "United States"].includes(name))
  .map(([name, code]) => ({ name, code }))
  .sort((a, b) => a.name.localeCompare(b.name));

const TOTAL_UN_COUNTRIES = 195;

export default function MapView({
  places: initialPlaces,
  stats: initialStats,
}: {
  places: Place[];
  stats: MapStats;
}) {
  const [isPending, startTransition] = useTransition();
  const [places, setPlaces] = useState(initialPlaces);
  const [stats, setStats] = useState(initialStats);
  const [activeTab, setActiveTab] = useState<"visited" | "wishlist">("visited");
  const [selectedCountry, setSelectedCountry] = useState<{
    name: string;
    code: string;
  } | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Derive visited/wishlist sets from places
  const visitedCodes = useMemo(
    () => new Set(places.filter((p) => p.type === "visited").map((p) => p.country_code)),
    [places]
  );
  const wishlistCodes = useMemo(
    () => new Set(places.filter((p) => p.type === "wishlist").map((p) => p.country_code)),
    [places]
  );

  const handleCountryClick = useCallback((geoName: string) => {
    const code = COUNTRY_MAP[geoName];
    if (!code) return;
    setSelectedCountry({ name: geoName, code });
  }, []);

  const handleQuickAdd = useCallback(
    async (type: "visited" | "wishlist") => {
      if (!selectedCountry) return;
      startTransition(async () => {
        try {
          const newPlace = await addPlace({
            name: selectedCountry.name,
            country_code: selectedCountry.code,
            country_name: selectedCountry.name,
            type,
          });
          setPlaces((prev) => [newPlace, ...prev]);
          // Update stats
          setStats((prev) => {
            const visited = new Set(prev.visitedCountries);
            const wishlist = new Set(prev.wishlistCountries);
            if (type === "visited") visited.add(selectedCountry.code);
            else wishlist.add(selectedCountry.code);
            return {
              visitedCount: visited.size,
              wishlistCount: wishlist.size,
              visitedCountries: Array.from(visited),
              wishlistCountries: Array.from(wishlist),
            };
          });
        } catch (e) {
          console.error(e);
        }
      });
    },
    [selectedCountry]
  );

  const handleRemoveCountry = useCallback(
    async (code: string) => {
      const toRemove = places.filter((p) => p.country_code === code);
      startTransition(async () => {
        try {
          await Promise.all(toRemove.map((p) => deletePlace(p.id)));
          setPlaces((prev) => prev.filter((p) => p.country_code !== code));
          setStats((prev) => ({
            visitedCount: prev.visitedCountries.filter((c) => c !== code).length,
            wishlistCount: prev.wishlistCountries.filter((c) => c !== code).length,
            visitedCountries: prev.visitedCountries.filter((c) => c !== code),
            wishlistCountries: prev.wishlistCountries.filter((c) => c !== code),
          }));
          setSelectedCountry(null);
        } catch (e) {
          console.error(e);
        }
      });
    },
    [places]
  );

  const handleDeletePlace = useCallback(async (id: string) => {
    startTransition(async () => {
      try {
        await deletePlace(id);
        setPlaces((prev) => {
          const updated = prev.filter((p) => p.id !== id);
          // Recalc stats
          const visited = new Set(updated.filter((p) => p.type === "visited").map((p) => p.country_code));
          const wishlist = new Set(updated.filter((p) => p.type === "wishlist").map((p) => p.country_code));
          setStats({
            visitedCount: visited.size,
            wishlistCount: wishlist.size,
            visitedCountries: Array.from(visited),
            wishlistCountries: Array.from(wishlist),
          });
          return updated;
        });
      } catch (e) {
        console.error(e);
      }
    });
  }, []);

  const countryStatus = useCallback(
    (code: string): "visited" | "wishlist" | null => {
      if (visitedCodes.has(code)) return "visited";
      if (wishlistCodes.has(code)) return "wishlist";
      return null;
    },
    [visitedCodes, wishlistCodes]
  );

  const filteredPlaces = places.filter((p) => p.type === activeTab);
  const uniqueCountries = new Set([...stats.visitedCountries, ...stats.wishlistCountries]).size;
  const worldPercent = ((stats.visitedCount / TOTAL_UN_COUNTRIES) * 100).toFixed(1);

  return (
    <div className="space-y-6">
      {/* Map */}
      <div className="relative overflow-hidden rounded-xl border border-charcoal-800/60 bg-charcoal-900/40">
        <WorldMap
          visitedCodes={visitedCodes}
          wishlistCodes={wishlistCodes}
          onCountryClick={handleCountryClick}
          countryMap={COUNTRY_MAP}
        />

        {/* Country side panel */}
        {selectedCountry && (
          <div className="absolute inset-x-0 bottom-0 max-h-[60%] overflow-y-auto border-t border-charcoal-800/60 bg-charcoal-900/95 p-4 backdrop-blur-sm sm:inset-x-auto sm:right-0 sm:top-0 sm:h-full sm:max-h-full sm:w-72 sm:border-l sm:border-t-0 sm:p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-charcoal-100">
                {selectedCountry.name}
              </h3>
              <button
                onClick={() => setSelectedCountry(null)}
                className="text-charcoal-500 hover:text-charcoal-300"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="mt-1 text-xs text-charcoal-500">{selectedCountry.code}</p>

            {/* Status */}
            <div className="mt-4">
              {countryStatus(selectedCountry.code) === "visited" && (
                <span className="inline-block rounded-full bg-amber-500/20 px-3 py-1 text-xs font-medium text-amber-400">
                  방문함
                </span>
              )}
              {countryStatus(selectedCountry.code) === "wishlist" && (
                <span className="inline-block rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-medium text-indigo-400">
                  가고 싶다
                </span>
              )}
              {!countryStatus(selectedCountry.code) && (
                <span className="text-sm text-charcoal-500">아직 등록되지 않음</span>
              )}
            </div>

            {/* Quick actions */}
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => handleQuickAdd("visited")}
                disabled={isPending}
                className="rounded-lg bg-amber-600/20 px-3 py-1.5 text-xs font-medium text-amber-400 transition hover:bg-amber-600/30 disabled:opacity-50"
              >
                방문함
              </button>
              <button
                onClick={() => handleQuickAdd("wishlist")}
                disabled={isPending}
                className="rounded-lg bg-indigo-600/20 px-3 py-1.5 text-xs font-medium text-indigo-400 transition hover:bg-indigo-600/30 disabled:opacity-50"
              >
                가고 싶다
              </button>
              {countryStatus(selectedCountry.code) && (
                <button
                  onClick={() => handleRemoveCountry(selectedCountry.code)}
                  disabled={isPending}
                  className="rounded-lg bg-red-600/20 px-3 py-1.5 text-xs font-medium text-red-400 transition hover:bg-red-600/30 disabled:opacity-50"
                >
                  제거
                </button>
              )}
            </div>

            {/* Places in this country */}
            {places.filter((p) => p.country_code === selectedCountry.code).length > 0 && (
              <div className="mt-5 space-y-2">
                <h4 className="text-xs font-medium uppercase text-charcoal-500">
                  등록된 장소
                </h4>
                {places
                  .filter((p) => p.country_code === selectedCountry.code)
                  .map((p) => (
                    <div
                      key={p.id}
                      className="rounded-lg border border-charcoal-800/40 bg-charcoal-800/30 p-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-charcoal-200">
                          {p.city || p.country_name}
                        </span>
                        <span
                          className={`text-xs ${
                            p.type === "visited"
                              ? "text-amber-400"
                              : "text-indigo-400"
                          }`}
                        >
                          {p.type === "visited" ? "방문" : "위시"}
                        </span>
                      </div>
                      {p.visit_date && (
                        <p className="mt-1 text-xs text-charcoal-500">
                          {p.visit_date}
                        </p>
                      )}
                      {p.memo && (
                        <p className="mt-1 text-xs text-charcoal-400">
                          {p.memo}
                        </p>
                      )}
                    </div>
                  ))}
              </div>
            )}

            {/* Add city */}
            <AddCityForm
              countryCode={selectedCountry.code}
              countryName={selectedCountry.name}
              onAdd={(place) => {
                setPlaces((prev) => [place, ...prev]);
                setStats((prev) => {
                  const visited = new Set(prev.visitedCountries);
                  const wishlist = new Set(prev.wishlistCountries);
                  if (place.type === "visited") visited.add(place.country_code);
                  else wishlist.add(place.country_code);
                  return {
                    visitedCount: visited.size,
                    wishlistCount: wishlist.size,
                    visitedCountries: Array.from(visited),
                    wishlistCountries: Array.from(wishlist),
                  };
                });
              }}
            />
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="방문한 나라"
          value={stats.visitedCount}
          color="text-amber-400"
          bgColor="bg-amber-500/10"
        />
        <StatCard
          label="가고 싶은 나라"
          value={stats.wishlistCount}
          color="text-indigo-400"
          bgColor="bg-indigo-500/10"
        />
        <StatCard
          label="세계 방문률"
          value={`${worldPercent}%`}
          color="text-charcoal-200"
          bgColor="bg-charcoal-800/30"
        />
        <StatCard
          label="총 등록 국가"
          value={uniqueCountries}
          color="text-charcoal-200"
          bgColor="bg-charcoal-800/30"
        />
      </div>

      {/* Place list */}
      <div className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/40">
        {/* Tabs + Add button */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-charcoal-800/40 px-4 py-3 sm:px-5">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab("visited")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                activeTab === "visited"
                  ? "bg-amber-500/15 text-amber-400"
                  : "text-charcoal-400 hover:text-charcoal-200"
              }`}
            >
              방문함 ({places.filter((p) => p.type === "visited").length})
            </button>
            <button
              onClick={() => setActiveTab("wishlist")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                activeTab === "wishlist"
                  ? "bg-indigo-500/15 text-indigo-400"
                  : "text-charcoal-400 hover:text-charcoal-200"
              }`}
            >
              가고 싶다 ({places.filter((p) => p.type === "wishlist").length})
            </button>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="rounded-lg bg-navy-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-navy-500"
          >
            {showAddForm ? "취소" : "+ 추가"}
          </button>
        </div>

        {/* Add form */}
        {showAddForm && (
          <AddPlaceForm
            type={activeTab}
            onAdd={(place) => {
              setPlaces((prev) => [place, ...prev]);
              setStats((prev) => {
                const visited = new Set(prev.visitedCountries);
                const wishlist = new Set(prev.wishlistCountries);
                if (place.type === "visited") visited.add(place.country_code);
                else wishlist.add(place.country_code);
                return {
                  visitedCount: visited.size,
                  wishlistCount: wishlist.size,
                  visitedCountries: Array.from(visited),
                  wishlistCountries: Array.from(wishlist),
                };
              });
              setShowAddForm(false);
            }}
          />
        )}

        {/* List */}
        <div className="divide-y divide-charcoal-800/30">
          {filteredPlaces.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-charcoal-500">
              {activeTab === "visited"
                ? "아직 방문한 나라가 없습니다"
                : "아직 가고 싶은 나라가 없습니다"}
            </p>
          )}
          {filteredPlaces.map((place) => (
            <PlaceRow
              key={place.id}
              place={place}
              isPending={isPending}
              onUpdate={(id, data) => {
                startTransition(async () => {
                  const updated = await updatePlace(id, data);
                  setPlaces((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
                });
              }}
              onDelete={() => handleDeletePlace(place.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
  bgColor,
}: {
  label: string;
  value: number | string;
  color: string;
  bgColor: string;
}) {
  return (
    <div
      className={`rounded-xl border border-charcoal-800/60 ${bgColor} px-4 py-3`}
    >
      <p className="text-xs text-charcoal-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function AddPlaceForm({
  type,
  onAdd,
}: {
  type: "visited" | "wishlist";
  onAdd: (place: Place) => void;
}) {
  const [search, setSearch] = useState("");
  const [selectedCode, setSelectedCode] = useState("");
  const [selectedName, setSelectedName] = useState("");
  const [city, setCity] = useState("");
  const [date, setDate] = useState("");
  const [memo, setMemo] = useState("");
  const [isPending, startTransition] = useTransition();
  const [showDropdown, setShowDropdown] = useState(false);

  const filtered = search.trim()
    ? ALL_COUNTRIES.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase())
      ).slice(0, 8)
    : [];

  const handleSubmit = () => {
    if (!selectedCode) return;
    startTransition(async () => {
      try {
        const place = await addPlace({
          name: selectedName,
          country_code: selectedCode,
          country_name: selectedName,
          city: city || null,
          type,
          visit_date: date || null,
          memo: memo || null,
        });
        onAdd(place);
        setSearch("");
        setSelectedCode("");
        setSelectedName("");
        setCity("");
        setDate("");
        setMemo("");
      } catch (e) {
        console.error(e);
      }
    });
  };

  return (
    <div className="border-b border-charcoal-800/40 px-5 py-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Country search */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search country..."
            value={selectedCode ? selectedName : search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedCode("");
              setSelectedName("");
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            className="w-full rounded-lg border border-charcoal-800/60 bg-charcoal-800/30 px-3 py-2 text-sm text-charcoal-100 placeholder-charcoal-600 outline-none focus:border-navy-600"
          />
          {showDropdown && filtered.length > 0 && !selectedCode && (
            <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-charcoal-800/60 bg-charcoal-900 shadow-lg">
              {filtered.map((c) => (
                <button
                  key={c.code}
                  onClick={() => {
                    setSelectedCode(c.code);
                    setSelectedName(c.name);
                    setSearch(c.name);
                    setShowDropdown(false);
                  }}
                  className="block w-full px-3 py-2 text-left text-sm text-charcoal-200 hover:bg-charcoal-800/50"
                >
                  {c.name}{" "}
                  <span className="text-charcoal-500">{c.code}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* City */}
        <input
          type="text"
          placeholder="City (optional)"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="rounded-lg border border-charcoal-800/60 bg-charcoal-800/30 px-3 py-2 text-sm text-charcoal-100 placeholder-charcoal-600 outline-none focus:border-navy-600"
        />

        {/* Date */}
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-charcoal-800/60 bg-charcoal-800/30 px-3 py-2 text-sm text-charcoal-100 placeholder-charcoal-600 outline-none focus:border-navy-600"
        />

        {/* Memo */}
        <input
          type="text"
          placeholder="Memo (optional)"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          className="rounded-lg border border-charcoal-800/60 bg-charcoal-800/30 px-3 py-2 text-sm text-charcoal-100 placeholder-charcoal-600 outline-none focus:border-navy-600"
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={!selectedCode || isPending}
        className="mt-3 rounded-lg bg-navy-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-navy-500 disabled:opacity-50"
      >
        {isPending ? "추가 중..." : "추가"}
      </button>
    </div>
  );
}

function AddCityForm({
  countryCode,
  countryName,
  onAdd,
}: {
  countryCode: string;
  countryName: string;
  onAdd: (place: Place) => void;
}) {
  const [open, setOpen] = useState(false);
  const [city, setCity] = useState("");
  const [type, setType] = useState<"visited" | "wishlist">("visited");
  const [date, setDate] = useState("");
  const [memo, setMemo] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    startTransition(async () => {
      try {
        const place = await addPlace({
          name: city || countryName,
          country_code: countryCode,
          country_name: countryName,
          city: city || null,
          type,
          visit_date: date || null,
          memo: memo || null,
        });
        onAdd(place);
        setCity("");
        setDate("");
        setMemo("");
        setOpen(false);
      } catch (e) {
        console.error(e);
      }
    });
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-4 w-full rounded-lg border border-dashed border-charcoal-700 py-2 text-xs text-charcoal-500 transition hover:border-charcoal-600 hover:text-charcoal-400"
      >
        + 도시 추가
      </button>
    );
  }

  return (
    <div className="mt-4 space-y-2">
      <input
        type="text"
        placeholder="City name"
        value={city}
        onChange={(e) => setCity(e.target.value)}
        className="w-full rounded-lg border border-charcoal-800/60 bg-charcoal-800/30 px-3 py-1.5 text-sm text-charcoal-100 placeholder-charcoal-600 outline-none focus:border-navy-600"
      />
      <div className="flex gap-2">
        <button
          onClick={() => setType("visited")}
          className={`flex-1 rounded-lg px-2 py-1 text-xs font-medium transition ${
            type === "visited"
              ? "bg-amber-500/20 text-amber-400"
              : "bg-charcoal-800/30 text-charcoal-500"
          }`}
        >
          방문함
        </button>
        <button
          onClick={() => setType("wishlist")}
          className={`flex-1 rounded-lg px-2 py-1 text-xs font-medium transition ${
            type === "wishlist"
              ? "bg-indigo-500/20 text-indigo-400"
              : "bg-charcoal-800/30 text-charcoal-500"
          }`}
        >
          가고 싶다
        </button>
      </div>
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="w-full rounded-lg border border-charcoal-800/60 bg-charcoal-800/30 px-3 py-1.5 text-sm text-charcoal-100 outline-none focus:border-navy-600"
      />
      <input
        type="text"
        placeholder="Memo"
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        className="w-full rounded-lg border border-charcoal-800/60 bg-charcoal-800/30 px-3 py-1.5 text-sm text-charcoal-100 placeholder-charcoal-600 outline-none focus:border-navy-600"
      />
      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={isPending}
          className="rounded-lg bg-navy-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-navy-500 disabled:opacity-50"
        >
          {isPending ? "..." : "추가"}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="rounded-lg px-3 py-1.5 text-xs text-charcoal-500 hover:text-charcoal-300"
        >
          취소
        </button>
      </div>
    </div>
  );
}

function PlaceRow({
  place,
  isPending,
  onUpdate,
  onDelete,
}: {
  place: Place;
  isPending: boolean;
  onUpdate: (id: string, data: { city?: string; visit_date?: string; memo?: string; type?: "visited" | "wishlist" }) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [city, setCity] = useState(place.city || "");
  const [visitDate, setVisitDate] = useState(place.visit_date || "");
  const [memo, setMemo] = useState(place.memo || "");
  const [type, setType] = useState<"visited" | "wishlist">(place.type as "visited" | "wishlist");

  const handleSave = () => {
    onUpdate(place.id, {
      city: city || undefined,
      visit_date: visitDate || undefined,
      memo: memo || undefined,
      type,
    });
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="px-5 py-3 space-y-2 bg-charcoal-800/20">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-charcoal-100">{place.country_name}</span>
          <div className="flex gap-1">
            <button
              onClick={() => setType(type === "visited" ? "wishlist" : "visited")}
              className={`rounded px-2 py-0.5 text-[10px] font-medium ${
                type === "visited" ? "bg-amber-500/15 text-amber-400" : "bg-indigo-500/15 text-indigo-400"
              }`}
            >
              {type === "visited" ? "방문함" : "가고 싶다"}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="도시"
            className="rounded-lg border border-charcoal-700 bg-charcoal-800/50 px-2.5 py-1.5 text-xs text-charcoal-100 placeholder:text-charcoal-600 focus:border-navy-500 focus:outline-none"
          />
          <input
            type="date"
            value={visitDate}
            onChange={(e) => setVisitDate(e.target.value)}
            className="rounded-lg border border-charcoal-700 bg-charcoal-800/50 px-2.5 py-1.5 text-xs text-charcoal-100 focus:border-navy-500 focus:outline-none"
          />
        </div>
        <input
          type="text"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="메모"
          className="w-full rounded-lg border border-charcoal-700 bg-charcoal-800/50 px-2.5 py-1.5 text-xs text-charcoal-100 placeholder:text-charcoal-600 focus:border-navy-500 focus:outline-none"
        />
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={onDelete}
            disabled={isPending}
            className="text-xs text-charcoal-500 hover:text-red-400"
          >
            삭제
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => setEditing(false)}
              className="rounded-lg px-3 py-1 text-xs text-charcoal-500 hover:text-charcoal-300"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={isPending}
              className="rounded-lg bg-navy-600 px-3 py-1 text-xs font-medium text-white hover:bg-navy-500 disabled:opacity-40"
            >
              저장
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex cursor-pointer items-center justify-between px-5 py-3 hover:bg-charcoal-800/30"
      onClick={() => setEditing(true)}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-charcoal-100">{place.country_name}</span>
          {place.city && <span className="text-xs text-charcoal-500">{place.city}</span>}
        </div>
        <div className="mt-0.5 flex items-center gap-3">
          {place.visit_date && <span className="text-xs text-charcoal-500">{place.visit_date}</span>}
          {place.memo && <span className="truncate text-xs text-charcoal-400">{place.memo}</span>}
        </div>
      </div>
      <svg className="h-4 w-4 shrink-0 text-charcoal-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
      </svg>
    </div>
  );
}
