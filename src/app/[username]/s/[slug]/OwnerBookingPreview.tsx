"use client";

import { useEffect, useState } from "react";
import { refreshBookableOptions } from "@/lib/slots";
import type { BookableOption } from "@/lib/slots";
import { SlotDatePreview } from "@/components/SlotDatePicker";

type Props = {
  slotId: string;
  options: BookableOption[];
  locations: string[];
};

/** Owner-only preview of the booking flow — shows the location picker
 * so the host can verify per-location availability without creating a
 * real booking. */
export default function OwnerBookingPreview({
  slotId,
  options: initialOptions,
  locations,
}: Props) {
  const [selected, setSelected] = useState<string>(locations[0] ?? "");
  const [options, setOptions] = useState<BookableOption[]>(initialOptions);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (locations.length <= 1) return;
    if (!selected) return;
    if (selected === (locations[0] ?? "")) {
      setOptions(initialOptions);
      return;
    }
    let canceled = false;
    setPending(true);
    refreshBookableOptions(slotId, selected)
      .then((next) => {
        if (!canceled) setOptions(next);
      })
      .finally(() => {
        if (!canceled) setPending(false);
      });
    return () => {
      canceled = true;
    };
  }, [selected, slotId, locations, initialOptions]);

  return (
    <div className="mt-4 space-y-4">
      <p className="text-xs text-charcoal-500">
        본인은 예약할 수 없지만, 게스트에게 노출되는 시간을 미리 확인할 수 있어요.
      </p>

      {locations.length >= 1 && (
        <div className="rounded-lg border border-charcoal-800/60 bg-charcoal-900/40 p-4">
          <p className="mb-2 text-xs font-semibold text-charcoal-200">
            어디서 만날까요? (게스트가 보는 선택)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {locations.map((loc) => {
              const active = selected === loc;
              return (
                <button
                  key={loc}
                  type="button"
                  onClick={() => setSelected(loc)}
                  disabled={pending || locations.length === 1}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? "border-red-500 bg-red-500/15 text-red-700 dark:text-red-300"
                      : "border-charcoal-800/60 bg-charcoal-800/20 text-charcoal-300 hover:border-charcoal-700"
                  }`}
                >
                  📍 {loc}
                </button>
              );
            })}
          </div>
          {locations.length > 1 && (
            <p className="mt-2 text-[11px] text-charcoal-500">
              선택한 위치 기준으로 가능한 시간이 재계산돼요.
              {pending && " · 시간 다시 계산 중…"}
            </p>
          )}
        </div>
      )}

      {options.length === 0 ? (
        <p className="rounded-lg border border-charcoal-800/60 bg-charcoal-900/30 px-4 py-6 text-center text-sm text-charcoal-500">
          {selected
            ? `${selected} 에서 만날 수 있는 시간이 없어요.`
            : "예약 가능한 시간이 없어요."}
        </p>
      ) : (
        <SlotDatePreview options={options} />
      )}
    </div>
  );
}
