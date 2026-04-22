"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createSlot,
  createSlotFromPreset,
  deleteSlot,
  cloneSlot,
  addAvailability,
  removeAvailability,
  updateSlot,
} from "@/lib/slots";
import type {
  TimeSlot,
  Availability,
  SlotType,
  SlotMode,
  PricingModel,
} from "@/lib/slots";
import type { WorkingHours } from "@/lib/slot-availability";
import type { Calendar } from "@/lib/calendars-types";
import type { Menu } from "@/lib/menus";
import { setSlotMenus } from "@/lib/menus";
import { ShareMenu } from "@/components/ShareMenu";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";

type Row = { slot: TimeSlot; availabilities: Availability[]; menuIds: string[] };
const DAYS = [
  { key: "mon", label: "월" },
  { key: "tue", label: "화" },
  { key: "wed", label: "수" },
  { key: "thu", label: "목" },
  { key: "fri", label: "금" },
  { key: "sat", label: "토" },
  { key: "sun", label: "일" },
] as const;

export default function SlotsManager({
  username,
  initial,
  myCalendars,
  myMenus,
  locationPresets,
}: {
  username: string;
  initial: Row[];
  myCalendars: Calendar[];
  myMenus: Menu[];
  locationPresets: string[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [showNew, setShowNew] = useState(initial.length === 0);
  const [presetPending, startPresetTransition] = useTransition();
  const [presetPicker, setPresetPicker] = useState(false);

  const pickPreset = (key: "meeting" | "meal" | "coffee", label: string) => {
    startPresetTransition(async () => {
      const res = await createSlotFromPreset(key);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      if ("skipped" in res) {
        toast.info(`"${label}" 슬롯이 이미 있어서 건너뛰었어요.`);
        return;
      }
      setPresetPicker(false);
      toast.success(`"${label}" 슬롯을 만들었어요.`);
      router.refresh();
    });
  };

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-charcoal-100">타임슬롯</h1>
          <p className="mt-1 text-sm text-charcoal-500">
            내 타임 슬롯을 공유하거나 판매하여 수익을 창출하세요.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setPresetPicker((v) => !v)}
            className="rounded-lg border border-charcoal-800/60 bg-charcoal-900/40 px-3 py-2 text-xs font-medium text-charcoal-200 hover:border-charcoal-700 hover:text-white"
          >
            {presetPicker ? "닫기" : "+ 템플릿에서"}
          </button>
          {!showNew && (
            <button
              type="button"
              onClick={() => setShowNew(true)}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500"
            >
              새 슬롯 만들기
            </button>
          )}
        </div>
      </header>

      {presetPicker && (
        <section className="rounded-2xl border border-charcoal-800/60 bg-charcoal-900/30 p-5">
          <p className="mb-1 text-sm font-semibold text-charcoal-100">
            템플릿 선택
          </p>
          <p className="mb-4 text-xs text-charcoal-500">
            클릭하면 해당 기본 설정으로 슬롯 하나를 만들어요. 만든 뒤 열어서
            장소·가격 등을 조정하세요.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <PresetCard
              title="업무 미팅"
              hint="60분 · 평일 10–18 · 24h 전까지"
              meta="수동 승인 · buffer 15분"
              onClick={() => pickPreset("meeting", "업무 미팅")}
              pending={presetPending}
            />
            <PresetCard
              title="식사"
              hint="90분 · 평일 점심/저녁 + 주말 점심"
              meta="수동 승인 · buffer 30분"
              onClick={() => pickPreset("meal", "식사")}
              pending={presetPending}
            />
            <PresetCard
              title="커피챗"
              hint="30분 · 주말 10–18 · 1h 전까지"
              meta="자동 승인 · buffer 10분"
              onClick={() => pickPreset("coffee", "커피챗")}
              pending={presetPending}
            />
          </div>
        </section>
      )}

      {showNew && (
        <NewSlotForm
          username={username}
          myCalendars={myCalendars}
          myMenus={myMenus}
          locationPresets={locationPresets}
          onCancel={() => setShowNew(false)}
          onSaved={() => {
            setShowNew(false);
            router.refresh();
          }}
        />
      )}

      {initial.length === 0 && !showNew ? (
        <div className="rounded-2xl border border-dashed border-charcoal-800/60 bg-charcoal-900/20 p-12 text-center">
          <p className="text-base font-semibold text-charcoal-200">
            아직 슬롯이 없어요
          </p>
          <p className="mt-2 text-sm text-charcoal-500">
            첫 슬롯을 만들어 누군가의 궤도에 올려보세요.
          </p>
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="mt-5 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500"
          >
            새 슬롯 만들기
          </button>
        </div>
      ) : (
        initial.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-charcoal-500">
                내 슬롯 {initial.length}
              </h2>
            </div>
            <div className="space-y-3">
              {initial.map((row) => (
                <SlotCard
                  key={row.slot.id}
                  row={row}
                  username={username}
                  myCalendars={myCalendars}
                  myMenus={myMenus}
                  locationPresets={locationPresets}
                />
              ))}
            </div>
          </div>
        )
      )}
    </div>
  );
}

const INPUT =
  "w-full rounded-lg border border-charcoal-800/60 bg-charcoal-900/40 px-3 py-2 text-sm text-charcoal-100 placeholder:text-charcoal-600 focus:border-red-500/60 focus:outline-none focus:ring-1 focus:ring-red-500/40";

function NewSlotForm({
  onSaved,
  onCancel,
  myCalendars,
  myMenus,
  locationPresets,
  username,
}: {
  onSaved: () => void;
  onCancel: () => void;
  myCalendars: Calendar[];
  myMenus: Menu[];
  locationPresets: string[];
  username: string;
}) {
  const toast = useToast();
  const defaultCalendarId =
    myCalendars.find((c) => c.is_default)?.id ?? myCalendars[0]?.id ?? "";
  const [calendarId, setCalendarId] = useState<string>(defaultCalendarId);
  const [selectedMenus, setSelectedMenus] = useState<string[]>([]);
  const [validPreset, setValidPreset] = useState<ValidPreset>("none");
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [autoApprove, setAutoApprove] = useState(true);
  const [paymentMethod, setPaymentMethod] =
    useState<"online" | "offline">("offline");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [showOnFeed, setShowOnFeed] = useState(true);
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState(60);
  const [price, setPrice] = useState(0);
  const [capacity, setCapacity] = useState(1);
  const [slotType, setSlotType] = useState<SlotType>("1on1");
  const [locations, setLocations] = useState<string[]>([]);
  const [mode, setMode] = useState<SlotMode>("manual");
  const [pricingModel, setPricingModel] = useState<PricingModel>("fixed");

  // Auction
  const [reservePrice, setReservePrice] = useState(10000);
  const [auctionEndsAt, setAuctionEndsAt] = useState("");

  // Manual
  const [windows, setWindows] = useState<string[]>([]);
  const [newWindow, setNewWindow] = useState("");

  // Auto
  const [workingHours, setWorkingHours] = useState<WorkingHours>({
    mon: [{ start: "10:00", end: "18:00" }],
    tue: [{ start: "10:00", end: "18:00" }],
    wed: [{ start: "10:00", end: "18:00" }],
    thu: [{ start: "10:00", end: "18:00" }],
    fri: [{ start: "10:00", end: "18:00" }],
  });
  const [slotInterval, setSlotInterval] = useState(60);
  const [minNotice, setMinNotice] = useState(4);
  const [maxAdvance, setMaxAdvance] = useState(30);
  const [buffer, setBuffer] = useState(0);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return toast.error("제목을 입력하세요.");
    if (pricingModel === "auction") {
      if (windows.length === 0)
        return toast.error("경매는 시간 한 개를 지정해야 해요.");
      if (!auctionEndsAt) return toast.error("경매 종료 시간을 정해주세요.");
      const ends = new Date(auctionEndsAt);
      const slotTime = new Date(windows[0]);
      if (ends >= slotTime)
        return toast.error("경매 종료 시간은 슬롯 시간보다 앞이어야 합니다.");
    }
    const [vFrom, vUntil] = resolveValidity(validPreset, validFrom, validUntil);
    startTransition(async () => {
      const res = await createSlot({
        title: title.trim(),
        description: description.trim() || null,
        duration_min: duration,
        price_cents: pricingModel === "auction" ? 0 : Math.round(price) * 100,
        capacity,
        slot_type: slotType,
        location_detail: locations[0] ?? null,
        locations,
        mode: pricingModel === "auction" ? "manual" : mode,
        pricing_model: pricingModel,
        calendar_id: calendarId || null,
        valid_from: vFrom,
        valid_until: vUntil,
        auto_approve: autoApprove,
        payment_method: paymentMethod,
        image_urls: imageUrls,
        show_on_feed: showOnFeed,
        ...(pricingModel === "auction"
          ? {
              reserve_price_cents: Math.round(reservePrice) * 100,
              auction_ends_at: new Date(auctionEndsAt).toISOString(),
              availability_starts: [new Date(windows[0]).toISOString()],
            }
          : mode === "manual"
            ? {
                availability_starts: windows
                  .filter(Boolean)
                  .map((w) => new Date(w).toISOString()),
              }
            : {
                working_hours: workingHours,
                slot_interval_min: slotInterval,
                min_notice_hours: minNotice,
                max_advance_days: maxAdvance,
                buffer_min: buffer,
              }),
      });
      if (res.error) return toast.error(res.error);
      if (res.id && selectedMenus.length > 0) {
        await setSlotMenus(res.id, selectedMenus);
      }
      onSaved();
    });
  };

  return (
    <form
      onSubmit={submit}
      className="overflow-hidden rounded-2xl border border-charcoal-800/60 bg-charcoal-900/30"
    >
      <div className="flex items-center justify-between border-b border-charcoal-800/50 bg-charcoal-900/50 px-6 py-4">
        <div>
          <h2 className="text-base font-semibold text-charcoal-100">새 슬롯</h2>
          <p className="mt-0.5 text-xs text-charcoal-500">
            기본 정보 → 가격 → 시간 순서로 채워주세요.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="flex h-8 w-8 items-center justify-center rounded-md text-charcoal-500 hover:bg-charcoal-800/40 hover:text-charcoal-100"
          aria-label="Close"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 6l12 12M6 18L18 6" />
          </svg>
        </button>
      </div>

      <div className="space-y-8 px-6 py-6">
        {/* 캘린더 */}
        {myCalendars.length > 0 &&
          (() => {
            const selectedCal = myCalendars.find((c) => c.id === calendarId);
            const needsPublic =
              pricingModel === "fixed" && price > 0;
            const violating =
              needsPublic && !!selectedCal && selectedCal.visibility !== "public";
            return (
              <Section
                title="캘린더"
                hint="예약이 생기면 여기 캘린더에 자동으로 이벤트가 추가돼요. 공개 여부도 이 캘린더 설정을 따릅니다."
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: selectedCal?.color ?? "#6366f1" }}
                  />
                  <select
                    value={calendarId}
                    onChange={(e) => setCalendarId(e.target.value)}
                    className={INPUT}
                  >
                    {myCalendars.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {c.is_default ? " (기본)" : ""} ·{" "}
                        {c.visibility === "public"
                          ? "공개"
                          : c.visibility === "followers"
                            ? "팔로워"
                            : "비공개"}
                      </option>
                    ))}
                  </select>
                </div>
                {violating && (
                  <p className="rounded-lg border border-amber-600/40 bg-amber-600/10 px-3 py-2 text-xs text-amber-200">
                    유료 슬롯은 <strong>공개(public)</strong> 캘린더에만 만들 수 있어요. Settings에서 이 캘린더를 공개로 바꾸거나 다른 공개 캘린더를 선택해주세요.
                  </p>
                )}
                {needsPublic &&
                  !myCalendars.some((c) => c.visibility === "public") && (
                    <p className="rounded-lg border border-amber-600/40 bg-amber-600/10 px-3 py-2 text-xs text-amber-200">
                      공개 캘린더가 없어서 유료 슬롯을 만들 수 없어요.{" "}
                      <a
                        href={`/${username}/settings`}
                        className="font-semibold underline"
                      >
                        Settings
                      </a>
                      에서 공개 캘린더를 먼저 만드세요.
                    </p>
                  )}
              </Section>
            );
          })()}

        {/* 서비스 선택 */}
        <Section
          title="서비스"
          hint="예약 시 게스트가 고를 수 있는 서비스를 붙여요. Services 페이지에서 먼저 만들어두세요."
        >
          <MenuPicker
            menus={myMenus}
            selected={selectedMenus}
            onChange={setSelectedMenus}
            username={username}
          />
        </Section>

        {/* 기본 정보 */}
        <Section title="기본 정보" hint="슬롯의 제목·설명과 형식을 정해요.">
          <Field label="제목">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 30분 1:1 커피챗"
              className={INPUT}
              required
            />
          </Field>
          <Field label="설명">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="이 시간에는 무엇을 함께하나요?"
              className={INPUT}
            />
          </Field>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="소요 시간 (분)">
              <input
                type="number"
                min={5}
                step={5}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className={INPUT}
              />
            </Field>
            <Field label="정원">
              <input
                type="number"
                min={1}
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
                className={INPUT}
              />
            </Field>
            <Field label="형식">
              <select
                value={slotType}
                onChange={(e) => setSlotType(e.target.value as SlotType)}
                className={INPUT}
              >
                <option value="1on1">1:1</option>
                <option value="companion">동행</option>
                <option value="group">그룹</option>
              </select>
            </Field>
          </div>
          <Field label="장소 (여러 개 등록 가능)">
            <LocationsInput
              value={locations}
              onChange={setLocations}
              presets={locationPresets}
            />
          </Field>
        </Section>

        {/* 가격 */}
        <Section title="가격" hint="고정가로 받을지, 경매로 진행할지 선택해요.">
          <div className="grid gap-2 md:grid-cols-2">
            <PricingButton
              current={pricingModel}
              value="fixed"
              onClick={() => setPricingModel("fixed")}
              title="Fixed price"
              hint="정해진 가격으로 예약"
            />
            <PricingButton
              current={pricingModel}
              value="auction"
              onClick={() => setPricingModel("auction")}
              title="Auction"
              hint="경매로 최고가 낙찰"
            />
          </div>
          {pricingModel === "fixed" ? (
            <Field label="가격 (KRW) — 0이면 Free">
              <input
                type="number"
                min={0}
                step={1000}
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                className={INPUT}
              />
            </Field>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="시작가 (KRW)">
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={reservePrice}
                  onChange={(e) => setReservePrice(Number(e.target.value))}
                  className={INPUT}
                />
              </Field>
              <Field label="경매 종료 시간">
                <input
                  type="datetime-local"
                  value={auctionEndsAt}
                  onChange={(e) => setAuctionEndsAt(e.target.value)}
                  className={INPUT}
                  required
                />
              </Field>
            </div>
          )}
        </Section>

        {/* 시간 */}
        <Section
          title="시간"
          hint={
            pricingModel === "auction"
              ? "경매는 단 하나의 시간만 지정해요."
              : mode === "manual"
                ? "예약 가능한 시간을 직접 추가해요."
                : "Google Calendar의 빈 시간을 자동으로 불러와요."
          }
        >
          {pricingModel === "fixed" && (
            <div className="grid gap-2 md:grid-cols-2">
              <ModeButton
                current={mode}
                value="manual"
                onClick={() => setMode("manual")}
                title="Manual"
                hint="내가 직접 시간을 추가"
              />
              <ModeButton
                current={mode}
                value="auto"
                onClick={() => setMode("auto")}
                title="Auto (Google)"
                hint="빈 시간 자동 계산"
              />
            </div>
          )}

          {pricingModel === "auction" ? (
            <ManualWindows
              windows={windows}
              setWindows={(w) => {
                const next = typeof w === "function" ? w(windows) : w;
                setWindows(next.slice(-1));
              }}
              newWindow={newWindow}
              setNewWindow={setNewWindow}
              singular
            />
          ) : mode === "manual" ? (
            <ManualWindows
              windows={windows}
              setWindows={setWindows}
              newWindow={newWindow}
              setNewWindow={setNewWindow}
            />
          ) : (
            <AutoConfig
              workingHours={workingHours}
              setWorkingHours={setWorkingHours}
              slotInterval={slotInterval}
              setSlotInterval={setSlotInterval}
              minNotice={minNotice}
              setMinNotice={setMinNotice}
              maxAdvance={maxAdvance}
              setMaxAdvance={setMaxAdvance}
              buffer={buffer}
              setBuffer={setBuffer}
            />
          )}
        </Section>

        {/* 판매 기간 */}
        <Section
          title="판매 기간"
          hint="이 슬롯이 예약 가능한 기간을 정해요. 기본은 무제한."
        >
          <ValidityPicker
            preset={validPreset}
            setPreset={setValidPreset}
            from={validFrom}
            setFrom={setValidFrom}
            until={validUntil}
            setUntil={setValidUntil}
          />
        </Section>

        {/* 수락 방식 */}
        <Section
          title="수락 방식"
          hint="예약을 자동으로 확정할지, 직접 확인 후 수락할지 선택해요."
        >
          <ApprovalPicker value={autoApprove} onChange={setAutoApprove} />
        </Section>

        {/* 결제 방식 */}
        {pricingModel === "fixed" && price > 0 && (
          <Section
            title="결제 방식"
            hint="온라인 결제는 곧 지원돼요. 지금은 호스트와 직접 만나서 결제하는 방식이 기본이에요."
          >
            <PaymentMethodPicker value={paymentMethod} onChange={setPaymentMethod} />
          </Section>
        )}

        {/* 이미지 */}
        <Section
          title="이미지 (선택)"
          hint="슬롯 페이지에 함께 보일 사진을 최대 6장까지 올릴 수 있어요."
        >
          <SlotImagePicker urls={imageUrls} onChange={setImageUrls} />
        </Section>

        {/* 피드 노출 */}
        <Section
          title="피드 노출"
          hint="꺼두면 이 슬롯이 피드에 나타나지 않아요. 공개 페이지에서는 그대로 보여요."
        >
          <label className="flex items-center gap-3 rounded-lg border border-charcoal-800/60 bg-charcoal-800/10 px-4 py-3 text-sm text-charcoal-200">
            <input
              type="checkbox"
              checked={showOnFeed}
              onChange={(e) => setShowOnFeed(e.target.checked)}
              className="h-4 w-4 accent-red-500"
            />
            피드에 노출
          </label>
        </Section>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-charcoal-800/50 bg-charcoal-900/40 px-6 py-4">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-charcoal-700 px-4 py-2 text-sm text-charcoal-300 hover:border-charcoal-600 hover:text-charcoal-100"
        >
          취소
        </button>
        {(() => {
          const selectedCal = myCalendars.find((c) => c.id === calendarId);
          const blocked =
            pricingModel === "fixed" &&
            price > 0 &&
            (!selectedCal || selectedCal.visibility !== "public");
          return (
            <button
              type="submit"
              disabled={pending || blocked}
              className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
              title={blocked ? "유료 슬롯은 공개 캘린더가 필요해요." : undefined}
            >
              {pending ? "저장 중…" : "슬롯 만들기"}
            </button>
          );
        })()}
      </div>
    </form>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-charcoal-100">{title}</h3>
        {hint && <p className="mt-0.5 text-xs text-charcoal-500">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function ChoiceCard({
  active,
  onClick,
  title,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
        active
          ? "border-red-500 bg-red-500/10"
          : "border-charcoal-800/60 bg-charcoal-800/10 hover:border-charcoal-700 hover:bg-charcoal-800/30"
      }`}
    >
      <span
        aria-hidden
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
          active ? "border-red-500 bg-red-500" : "border-charcoal-600"
        }`}
      >
        {active && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
      </span>
      <span className="min-w-0">
        <span
          className={`block text-sm font-semibold ${
            active ? "text-charcoal-50" : "text-charcoal-200"
          }`}
        >
          {title}
        </span>
        <span className="mt-0.5 block text-xs text-charcoal-500">{hint}</span>
      </span>
    </button>
  );
}

function PricingButton({
  current,
  value,
  onClick,
  title,
  hint,
}: {
  current: PricingModel;
  value: PricingModel;
  onClick: () => void;
  title: string;
  hint: string;
}) {
  return (
    <ChoiceCard active={current === value} onClick={onClick} title={title} hint={hint} />
  );
}

function ModeButton({
  current,
  value,
  onClick,
  title,
  hint,
}: {
  current: SlotMode;
  value: SlotMode;
  onClick: () => void;
  title: string;
  hint: string;
}) {
  return (
    <ChoiceCard active={current === value} onClick={onClick} title={title} hint={hint} />
  );
}

function ManualWindows({
  windows,
  setWindows,
  newWindow,
  setNewWindow,
  singular = false,
}: {
  windows: string[];
  setWindows: (w: string[] | ((w: string[]) => string[])) => void;
  newWindow: string;
  setNewWindow: (v: string) => void;
  singular?: boolean;
}) {
  return (
    <div className="rounded-lg border border-charcoal-800/60 bg-charcoal-900/30 p-4">
      <p className="mb-3 text-xs font-medium text-charcoal-400">
        {singular ? "경매 시간" : `추가한 시간 (${windows.length})`}
      </p>
      <div className="flex gap-2">
        <input
          type="datetime-local"
          value={newWindow}
          onChange={(e) => setNewWindow(e.target.value)}
          className={`${INPUT} flex-1`}
        />
        <button
          type="button"
          onClick={() => {
            if (!newWindow) return;
            setWindows((w) => [...w, newWindow]);
            setNewWindow("");
          }}
          className="shrink-0 rounded-lg border border-charcoal-700 px-4 py-2 text-sm font-medium text-charcoal-200 hover:border-charcoal-600 hover:text-charcoal-100"
        >
          추가
        </button>
      </div>
      {windows.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {windows.map((w, i) => (
            <li
              key={i}
              className="flex items-center justify-between rounded-md bg-charcoal-800/40 px-3 py-2 text-xs text-charcoal-200"
            >
              <span className="tabular-nums">
                {new Date(w).toLocaleString("ko-KR", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  weekday: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <button
                type="button"
                onClick={() => setWindows((arr) => arr.filter((_, j) => j !== i))}
                aria-label="Remove"
                className="flex h-6 w-6 items-center justify-center rounded text-charcoal-500 hover:bg-charcoal-800 hover:text-red-400"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AutoConfig({
  workingHours,
  setWorkingHours,
  slotInterval,
  setSlotInterval,
  minNotice,
  setMinNotice,
  maxAdvance,
  setMaxAdvance,
  buffer,
  setBuffer,
}: {
  workingHours: WorkingHours;
  setWorkingHours: (w: WorkingHours) => void;
  slotInterval: number;
  setSlotInterval: (n: number) => void;
  minNotice: number;
  setMinNotice: (n: number) => void;
  maxAdvance: number;
  setMaxAdvance: (n: number) => void;
  buffer: number;
  setBuffer: (n: number) => void;
}) {
  const toggleDay = (key: (typeof DAYS)[number]["key"]) => {
    const next = { ...workingHours };
    if (next[key]?.length) {
      delete next[key];
    } else {
      next[key] = [{ start: "10:00", end: "18:00" }];
    }
    setWorkingHours(next);
  };

  const updateRange = (
    key: (typeof DAYS)[number]["key"],
    side: "start" | "end",
    val: string,
  ) => {
    const next = { ...workingHours };
    const cur = next[key]?.[0] ?? { start: "10:00", end: "18:00" };
    next[key] = [{ ...cur, [side]: val }];
    setWorkingHours(next);
  };

  return (
    <div className="space-y-5 rounded-lg border border-charcoal-800/60 bg-charcoal-900/30 p-4">
      <div>
        <p className="mb-3 text-xs font-medium text-charcoal-400">요일별 근무 시간</p>
        <div className="space-y-1.5">
          {DAYS.map((d) => {
            const range = workingHours[d.key];
            const enabled = !!range && range.length > 0;
            return (
              <div
                key={d.key}
                className="flex items-center gap-3 rounded-md px-2 py-1.5"
              >
                <button
                  type="button"
                  onClick={() => toggleDay(d.key)}
                  className={`flex h-8 w-10 shrink-0 items-center justify-center rounded-md text-xs font-bold transition-colors ${
                    enabled
                      ? "bg-red-600 text-white"
                      : "bg-charcoal-800/60 text-charcoal-500 hover:bg-charcoal-800"
                  }`}
                >
                  {d.label}
                </button>
                {enabled && range ? (
                  <div className="flex flex-1 items-center gap-2 text-xs text-charcoal-300">
                    <input
                      type="time"
                      value={range[0]?.start ?? "10:00"}
                      onChange={(e) => updateRange(d.key, "start", e.target.value)}
                      className="rounded-md border border-charcoal-800/60 bg-charcoal-900/40 px-2 py-1.5 text-charcoal-100"
                    />
                    <span className="text-charcoal-600">—</span>
                    <input
                      type="time"
                      value={range[0]?.end ?? "18:00"}
                      onChange={(e) => updateRange(d.key, "end", e.target.value)}
                      className="rounded-md border border-charcoal-800/60 bg-charcoal-900/40 px-2 py-1.5 text-charcoal-100"
                    />
                  </div>
                ) : (
                  <span className="text-xs text-charcoal-600">쉬는 날</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Field label="슬롯 간격 (분)">
          <input
            type="number"
            min={5}
            step={5}
            value={slotInterval}
            onChange={(e) => setSlotInterval(Number(e.target.value))}
            className={INPUT}
          />
        </Field>
        <Field label="최소 예고 (시간)">
          <input
            type="number"
            min={0}
            value={minNotice}
            onChange={(e) => setMinNotice(Number(e.target.value))}
            className={INPUT}
          />
        </Field>
        <Field label="최대 사전 예약 (일)">
          <input
            type="number"
            min={1}
            max={365}
            value={maxAdvance}
            onChange={(e) => setMaxAdvance(Number(e.target.value))}
            className={INPUT}
          />
        </Field>
        <Field label="버퍼 (분)">
          <input
            type="number"
            min={0}
            value={buffer}
            onChange={(e) => setBuffer(Number(e.target.value))}
            className={INPUT}
          />
        </Field>
      </div>

      <p className="text-xs text-charcoal-500">
        Google Calendar 빈 시간을 읽어와 위 근무 시간 안에서 자동으로 예약 가능 시간을 생성해요. 캘린더 연결이 필요합니다.
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-charcoal-400">{label}</span>
      {children}
    </label>
  );
}

function PresetCard({
  title,
  hint,
  meta,
  onClick,
  pending,
}: {
  title: string;
  hint: string;
  meta: string;
  onClick: () => void;
  pending: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="group flex h-full flex-col items-start gap-1.5 rounded-xl border border-charcoal-800/60 bg-charcoal-900/40 p-4 text-left transition-colors hover:border-red-500/60 hover:bg-red-500/5 disabled:opacity-60"
    >
      <p className="text-sm font-semibold text-charcoal-100 group-hover:text-red-300">
        {title}
      </p>
      <p className="text-[11px] leading-relaxed text-charcoal-400">{hint}</p>
      <p className="mt-auto pt-2 text-[10px] uppercase tracking-wider text-charcoal-600">
        {meta}
      </p>
    </button>
  );
}

function LocationsInput({
  value,
  onChange,
  presets,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  presets: string[];
}) {
  const [typing, setTyping] = useState("");
  const lower = (s: string) => s.trim().toLowerCase();
  const add = (raw: string) => {
    const v = raw.trim();
    if (!v) return;
    if (value.some((x) => lower(x) === lower(v))) return;
    onChange([...value, v]);
    setTyping("");
  };
  const remove = (i: number) => {
    onChange(value.filter((_, idx) => idx !== i));
  };
  const suggested = presets.filter(
    (p) => !value.some((x) => lower(x) === lower(p)),
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-charcoal-800/60 bg-charcoal-900/40 px-2 py-1.5">
        {value.map((v, i) => (
          <span
            key={`${v}-${i}`}
            className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:text-red-300"
          >
            {v}
            <button
              type="button"
              onClick={() => remove(i)}
              className="text-red-400 hover:text-red-200"
              aria-label={`${v} 제거`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={typing}
          onChange={(e) => setTyping(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(typing);
            } else if (
              e.key === "Backspace" &&
              typing === "" &&
              value.length > 0
            ) {
              remove(value.length - 1);
            }
          }}
          onBlur={() => add(typing)}
          placeholder={value.length === 0 ? "예: 강남 / 여의도 / Online" : ""}
          className="min-w-[100px] flex-1 bg-transparent py-1 text-sm text-charcoal-100 placeholder:text-charcoal-600 focus:outline-none"
        />
      </div>

      {suggested.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider text-charcoal-500">
            프리셋
          </span>
          {suggested.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => add(p)}
              className="rounded-full border border-charcoal-800/60 bg-charcoal-900/40 px-2.5 py-0.5 text-[11px] text-charcoal-300 hover:border-red-500/40 hover:text-red-300"
            >
              + {p}
            </button>
          ))}
        </div>
      )}

      <p className="text-[11px] text-charcoal-500">
        게스트가 예약할 때 이 중에서 만날 장소를 골라요. 등록한 장소가 설정의{" "}
        <b>장소별 이동시간</b> 프리셋과 매칭되면 인접 일정과의 버퍼가 자동
        최적화돼요.
      </p>
    </div>
  );
}

function SlotCard({
  row,
  username,
  myCalendars,
  myMenus,
  locationPresets,
}: {
  row: Row;
  username: string;
  myCalendars: Calendar[];
  myMenus: Menu[];
  locationPresets: string[];
}) {
  const cal = myCalendars.find((c) => c.id === row.slot.calendar_id);
  const attachedMenus = row.menuIds
    .map((id) => myMenus.find((m) => m.id === id))
    .filter((m): m is Menu => !!m);
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [pending, startTransition] = useTransition();
  const [newWindow, setNewWindow] = useState("");
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);

  const publicUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/${username}/s/${row.slot.slug}`
      : `/${username}/s/${row.slot.slug}`;

  const toggleActive = () =>
    startTransition(async () => {
      await updateSlot(row.slot.id, { active: !row.slot.active });
      router.refresh();
    });

  const remove = async () => {
    const ok = await confirm({
      title: "슬롯을 삭제할까요?",
      body: `"${row.slot.title}" 슬롯과 관련된 가용 시간이 모두 사라져요.`,
      confirmLabel: "삭제",
      danger: true,
    });
    if (!ok) return;
    startTransition(async () => {
      await deleteSlot(row.slot.id);
      toast.success("슬롯을 삭제했어요.");
      router.refresh();
    });
  };

  const clone = () => {
    startTransition(async () => {
      const res = await cloneSlot(row.slot.id);
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("복제했어요.");
      router.refresh();
    });
  };

  const addWindow = () => {
    if (!newWindow) return;
    startTransition(async () => {
      const res = await addAvailability(row.slot.id, new Date(newWindow).toISOString());
      if (res.error) return toast.error(res.error);
      setNewWindow("");
      router.refresh();
    });
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const priceLabel =
    row.slot.price_cents === 0
      ? "Free"
      : `₩${(row.slot.price_cents / 100).toLocaleString("ko-KR")}`;

  return (
    <div className="overflow-hidden rounded-xl border border-charcoal-800/60 bg-charcoal-900/30">
      <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-semibold text-charcoal-100">
              {row.slot.title}
            </h2>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                row.slot.active
                  ? "bg-emerald-600/20 text-emerald-400"
                  : "bg-charcoal-700/40 text-charcoal-500"
              }`}
            >
              {row.slot.active ? "ACTIVE" : "OFF"}
            </span>
            <span className="rounded-full bg-charcoal-800/60 px-2 py-0.5 text-[10px] font-medium uppercase text-charcoal-400">
              {row.slot.mode}
            </span>
            <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-300">
              {priceLabel}
            </span>
            {cal && (
              <span className="inline-flex items-center gap-1 rounded-full border border-charcoal-800/60 bg-charcoal-800/40 px-2 py-0.5 text-[10px] font-medium text-charcoal-300">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: cal.color }}
                />
                {cal.name}
                <span className="text-charcoal-500">
                  ·{" "}
                  {cal.visibility === "public"
                    ? "공개"
                    : cal.visibility === "followers"
                      ? "팔로워"
                      : "비공개"}
                </span>
              </span>
            )}
          </div>
          <p className="mt-1.5 text-xs text-charcoal-500">
            {row.slot.duration_min}분 · {row.slot.slot_type}
            {row.slot.location_detail && ` · ${row.slot.location_detail}`}
          </p>
          {row.slot.description && (
            <p className="mt-2 line-clamp-2 text-sm text-charcoal-300">
              {row.slot.description}
            </p>
          )}
          {attachedMenus.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {attachedMenus.map((m) => (
                <span
                  key={m.id}
                  className="inline-flex items-center gap-1 rounded-md bg-charcoal-800/40 px-2 py-0.5 text-[10px] text-charcoal-700 dark:text-charcoal-200"
                >
                  {m.name}
                  <span className="text-charcoal-500">
                    {m.price_cents === 0
                      ? "· Free"
                      : `· ₩${(m.price_cents / 100).toLocaleString("ko-KR")}`}
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1 sm:shrink-0">
          <Link
            href={`/${username}/s/${row.slot.slug}`}
            className="rounded-md border border-charcoal-800 px-2.5 py-1.5 text-xs text-charcoal-400 hover:border-charcoal-700 hover:text-charcoal-100"
            title="공개 페이지 열기"
          >
            보기
          </Link>
          <button
            type="button"
            onClick={copy}
            className="rounded-md border border-charcoal-800 px-2.5 py-1.5 text-xs text-charcoal-400 hover:border-charcoal-700 hover:text-charcoal-100"
          >
            {copied ? "복사됨" : "링크"}
          </button>
          <ShareMenu
            url={publicUrl}
            title={row.slot.title}
            text={`${row.slot.title} — Orbit42 에서 예약하세요`}
            compact
          />
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className={`rounded-md border px-2.5 py-1.5 text-xs ${
              editing
                ? "border-red-500/60 bg-red-500/10 text-red-200"
                : "border-charcoal-800 text-charcoal-400 hover:border-charcoal-700 hover:text-charcoal-100"
            }`}
          >
            {editing ? "닫기" : "수정"}
          </button>
          <button
            type="button"
            onClick={toggleActive}
            disabled={pending}
            className="rounded-md border border-charcoal-800 px-2.5 py-1.5 text-xs text-charcoal-400 hover:border-charcoal-700 hover:text-charcoal-100"
          >
            {row.slot.active ? "Pause" : "활성화"}
          </button>
          <button
            type="button"
            onClick={clone}
            disabled={pending}
            className="rounded-md border border-charcoal-800 px-2.5 py-1.5 text-xs text-charcoal-400 hover:border-charcoal-700 hover:text-charcoal-100"
            title="복제"
          >
            복제
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="rounded-md border border-charcoal-800 px-2.5 py-1.5 text-xs text-charcoal-500 hover:border-red-500/60 hover:text-red-400"
            title="삭제"
          >
            삭제
          </button>
        </div>
      </div>

      {editing && (
        <div className="border-t border-charcoal-800/40 bg-charcoal-950/40 px-5 py-5">
          <EditSlotForm
            slot={row.slot}
            myCalendars={myCalendars}
            myMenus={myMenus}
            locationPresets={locationPresets}
            initialMenuIds={row.menuIds}
            username={username}
            onDone={() => {
              setEditing(false);
              router.refresh();
            }}
            onCancel={() => setEditing(false)}
          />
        </div>
      )}

      {row.slot.mode === "manual" ? (
        <div className="border-t border-charcoal-800/40 bg-charcoal-950/30 px-5 py-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-medium text-charcoal-400">
              예약 가능한 시간{" "}
              <span className="text-charcoal-600">({row.availabilities.length})</span>
            </p>
          </div>
          <div className="flex gap-2">
            <input
              type="datetime-local"
              value={newWindow}
              onChange={(e) => setNewWindow(e.target.value)}
              className="flex-1 rounded-md border border-charcoal-800/60 bg-charcoal-900/40 px-3 py-2 text-sm text-charcoal-100 focus:border-red-500/60 focus:outline-none"
            />
            <button
              type="button"
              onClick={addWindow}
              disabled={pending || !newWindow}
              className="shrink-0 rounded-md bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50"
            >
              + 추가
            </button>
          </div>
          {row.availabilities.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {row.availabilities.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between rounded-md bg-charcoal-800/40 px-3 py-2 text-xs"
                >
                  <span className="tabular-nums text-charcoal-200">
                    {new Date(a.start_at).toLocaleString("ko-KR", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      weekday: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    <span className="ml-2 text-charcoal-500">
                      {a.booked_count}/{a.capacity}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      startTransition(async () => {
                        await removeAvailability(a.id);
                        router.refresh();
                      })
                    }
                    aria-label="Remove"
                    className="flex h-6 w-6 items-center justify-center rounded text-charcoal-500 hover:bg-charcoal-800 hover:text-red-400"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="border-t border-charcoal-800/40 bg-charcoal-950/30 px-5 py-4 text-xs text-charcoal-500">
          Auto 모드 — Google Calendar 빈 시간을 기반으로 예약 가능 시간이 자동 생성돼요. 근무 시간 편집은 곧 Settings에서 지원될 예정입니다.
        </div>
      )}
    </div>
  );
}

function EditSlotForm({
  slot,
  myCalendars,
  myMenus,
  locationPresets,
  initialMenuIds,
  username,
  onDone,
  onCancel,
}: {
  slot: TimeSlot;
  myCalendars: Calendar[];
  myMenus: Menu[];
  locationPresets: string[];
  initialMenuIds: string[];
  username: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(slot.title);
  const [description, setDescription] = useState(slot.description ?? "");
  const [duration, setDuration] = useState(slot.duration_min);
  const [price, setPrice] = useState(slot.price_cents / 100);
  const [capacity, setCapacity] = useState(slot.capacity);
  const [slotType, setSlotType] = useState<SlotType>(slot.slot_type);
  const [locations, setLocations] = useState<string[]>(() => {
    const init = slot.locations && slot.locations.length > 0
      ? slot.locations
      : slot.location_detail
        ? [slot.location_detail]
        : [];
    return init;
  });
  const [calendarId, setCalendarId] = useState<string>(slot.calendar_id ?? "");
  const [selectedMenus, setSelectedMenus] = useState<string[]>(initialMenuIds);
  const [validPreset, setValidPreset] = useState<ValidPreset>(
    slot.valid_from || slot.valid_until ? "custom" : "none",
  );
  const [validFrom, setValidFrom] = useState<string>(
    slot.valid_from ? toLocalInput(slot.valid_from) : "",
  );
  const [validUntil, setValidUntil] = useState<string>(
    slot.valid_until ? toLocalInput(slot.valid_until) : "",
  );
  const [autoApprove, setAutoApprove] = useState<boolean>(slot.auto_approve);
  const [paymentMethod, setPaymentMethod] = useState<"online" | "offline">(
    slot.payment_method ?? "offline",
  );
  const [imageUrls, setImageUrls] = useState<string[]>(slot.image_urls ?? []);
  const [showOnFeed, setShowOnFeed] = useState<boolean>(
    slot.show_on_feed ?? true,
  );
  const toast = useToast();

  const isAuction = slot.pricing_model === "auction";
  const selectedCal = myCalendars.find((c) => c.id === calendarId);
  const needsPublic = !isAuction && price > 0;
  const violating = needsPublic && !!selectedCal && selectedCal.visibility !== "public";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return toast.error("제목을 입력하세요.");
    if (violating) {
      return toast.error("유료 슬롯은 공개 캘린더에만 만들 수 있어요.");
    }
    const [vFrom, vUntil] = resolveValidity(validPreset, validFrom, validUntil);
    startTransition(async () => {
      const res = await updateSlot(slot.id, {
        title: title.trim(),
        description: description.trim() || null,
        duration_min: duration,
        price_cents: isAuction ? 0 : Math.round(price) * 100,
        capacity,
        slot_type: slotType,
        location_detail: locations[0] ?? null,
        locations,
        calendar_id: calendarId || null,
        valid_from: vFrom,
        valid_until: vUntil,
        auto_approve: autoApprove,
        payment_method: paymentMethod,
        image_urls: imageUrls,
        show_on_feed: showOnFeed,
      });
      if (res && "error" in res && res.error) return toast.error(res.error);
      await setSlotMenus(slot.id, selectedMenus);
      toast.success("저장했어요.");
      onDone();
    });
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-charcoal-100">슬롯 수정</h3>
        <p className="text-[11px] text-charcoal-500">
          모드({slot.mode}) / 가격 유형({slot.pricing_model})은 고정이에요.
        </p>
      </div>

      {myCalendars.length > 0 && (
        <div className="space-y-2">
          <label className="block text-xs font-medium text-charcoal-400">
            캘린더
          </label>
          <div className="flex items-center gap-2">
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: selectedCal?.color ?? "#6366f1" }}
            />
            <select
              value={calendarId}
              onChange={(e) => setCalendarId(e.target.value)}
              className={INPUT}
            >
              {myCalendars.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.is_default ? " (기본)" : ""} ·{" "}
                  {c.visibility === "public"
                    ? "공개"
                    : c.visibility === "followers"
                      ? "팔로워"
                      : "비공개"}
                </option>
              ))}
            </select>
          </div>
          {violating && (
            <p className="rounded-lg border border-amber-600/40 bg-amber-600/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-200">
              유료 슬롯은 <strong>공개</strong> 캘린더에만 올릴 수 있어요.
            </p>
          )}
        </div>
      )}

      <Field label="제목">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={INPUT}
          required
        />
      </Field>
      <Field label="설명">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className={INPUT}
        />
      </Field>
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="소요 시간 (분)">
          <input
            type="number"
            min={5}
            step={5}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className={INPUT}
          />
        </Field>
        <Field label="정원">
          <input
            type="number"
            min={1}
            value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value))}
            className={INPUT}
          />
        </Field>
        <Field label="형식">
          <select
            value={slotType}
            onChange={(e) => setSlotType(e.target.value as SlotType)}
            className={INPUT}
          >
            <option value="1on1">1:1</option>
            <option value="companion">동행</option>
            <option value="group">그룹</option>
          </select>
        </Field>
      </div>
      {!isAuction && (
        <Field label="가격 (KRW) — 0이면 Free">
          <input
            type="number"
            min={0}
            step={1000}
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
            className={INPUT}
          />
        </Field>
      )}
      <Field label="장소 (여러 개 등록 가능)">
        <LocationsInput
          value={locations}
          onChange={setLocations}
          presets={locationPresets}
        />
      </Field>

      <div>
        <p className="mb-2 text-xs font-medium text-charcoal-400">메뉴 / 스킬</p>
        <MenuPicker
          menus={myMenus}
          selected={selectedMenus}
          onChange={setSelectedMenus}
          username={username}
        />
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-charcoal-400">판매 기간</p>
        <ValidityPicker
          preset={validPreset}
          setPreset={setValidPreset}
          from={validFrom}
          setFrom={setValidFrom}
          until={validUntil}
          setUntil={setValidUntil}
        />
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-charcoal-400">수락 방식</p>
        <ApprovalPicker value={autoApprove} onChange={setAutoApprove} />
      </div>

      {!isAuction && price > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-charcoal-400">결제 방식</p>
          <PaymentMethodPicker
            value={paymentMethod}
            onChange={setPaymentMethod}
          />
        </div>
      )}

      <div>
        <p className="mb-2 text-xs font-medium text-charcoal-400">
          이미지 (선택)
        </p>
        <SlotImagePicker urls={imageUrls} onChange={setImageUrls} />
      </div>

      <label className="flex items-center gap-3 rounded-lg border border-charcoal-800/60 bg-charcoal-800/10 px-4 py-3 text-sm text-charcoal-200">
        <input
          type="checkbox"
          checked={showOnFeed}
          onChange={(e) => setShowOnFeed(e.target.checked)}
          className="h-4 w-4 accent-red-500"
        />
        <span>
          <span className="block">피드에 노출</span>
          <span className="block text-[11px] font-normal text-charcoal-500">
            꺼두면 이 슬롯이 피드에 올라가지 않아요.
          </span>
        </span>
      </label>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-charcoal-700 px-4 py-2 text-sm text-charcoal-300 hover:border-charcoal-600 hover:text-charcoal-100"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={pending || violating}
          className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
        >
          {pending ? "저장 중…" : "저장"}
        </button>
      </div>
    </form>
  );
}

function MenuPicker({
  menus,
  selected,
  onChange,
  username,
}: {
  menus: Menu[];
  selected: string[];
  onChange: (ids: string[]) => void;
  username: string;
}) {
  if (menus.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-charcoal-800/60 bg-charcoal-900/20 px-3 py-4 text-center text-xs text-charcoal-500">
        등록된 서비스가 없어요.{' '}
        <a
          href={`/${username}/services`}
          className="font-semibold text-red-500 hover:underline"
        >
          Services 페이지
        </a>
        에서 먼저 만들어주세요.
      </p>
    );
  }
  const toggle = (id: string) => {
    onChange(
      selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id],
    );
  };
  const grouped = new Map<string, Menu[]>();
  for (const m of menus) {
    const key = m.category?.trim() || '기타';
    const list = grouped.get(key) ?? [];
    list.push(m);
    grouped.set(key, list);
  }
  return (
    <div className="space-y-3">
      {Array.from(grouped.entries()).map(([cat, items]) => (
        <div key={cat}>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-charcoal-500">
            {cat}
          </p>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {items.map((m) => {
              const active = selected.includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggle(m.id)}
                  className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition-colors ${
                    active
                      ? 'border-red-500 bg-red-500/10'
                      : 'border-charcoal-800/60 bg-charcoal-800/10 hover:border-charcoal-700'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        active ? 'border-red-500 bg-red-500' : 'border-charcoal-600'
                      }`}
                    >
                      {active && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </span>
                    <span className="truncate text-sm text-charcoal-100">{m.name}</span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-charcoal-400">
                    {m.price_cents === 0
                      ? 'Free'
                      : `₩${(m.price_cents / 100).toLocaleString('ko-KR')}`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}


type ValidPreset = "none" | "1m" | "3m" | "6m" | "1y" | "custom";

function resolveValidity(
  preset: ValidPreset,
  from: string,
  until: string,
): [string | null, string | null] {
  if (preset === "none") return [null, null];
  if (preset === "custom") {
    return [
      from ? new Date(from).toISOString() : null,
      until ? new Date(until).toISOString() : null,
    ];
  }
  const months = preset === "1m" ? 1 : preset === "3m" ? 3 : preset === "6m" ? 6 : 12;
  const end = new Date();
  end.setMonth(end.getMonth() + months);
  return [null, end.toISOString()];
}

function ValidityPicker({
  preset,
  setPreset,
  from,
  setFrom,
  until,
  setUntil,
}: {
  preset: ValidPreset;
  setPreset: (p: ValidPreset) => void;
  from: string;
  setFrom: (v: string) => void;
  until: string;
  setUntil: (v: string) => void;
}) {
  const presets: { value: ValidPreset; label: string }[] = [
    { value: "none", label: "무제한" },
    { value: "1m", label: "1개월" },
    { value: "3m", label: "3개월" },
    { value: "6m", label: "6개월" },
    { value: "1y", label: "1년" },
    { value: "custom", label: "직접 지정" },
  ];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => setPreset(p.value)}
            className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              preset === p.value
                ? "bg-red-600 text-white"
                : "bg-charcoal-800/40 text-charcoal-700 hover:text-charcoal-900 dark:text-charcoal-300 dark:hover:text-charcoal-100"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {preset === "custom" && (
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-charcoal-500">
              시작 (선택)
            </span>
            <input
              type="datetime-local"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className={INPUT}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-charcoal-500">
              종료 (선택)
            </span>
            <input
              type="datetime-local"
              value={until}
              onChange={(e) => setUntil(e.target.value)}
              className={INPUT}
            />
          </label>
        </div>
      )}
      {preset !== "none" && preset !== "custom" && (
        <p className="text-xs text-charcoal-500">
          오늘부터 앞으로 {preset === "1m" ? "1개월" : preset === "3m" ? "3개월" : preset === "6m" ? "6개월" : "1년"} 동안만 예약할 수 있어요.
        </p>
      )}
    </div>
  );
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function ApprovalPicker({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="grid gap-2 md:grid-cols-2">
      <ChoiceCard
        active={value}
        onClick={() => onChange(true)}
        title="자동 수락"
        hint="예약이 들어오면 바로 확정돼요."
      />
      <ChoiceCard
        active={!value}
        onClick={() => onChange(false)}
        title="직접 확인"
        hint="호스트가 수락해야 확정돼요."
      />
    </div>
  );
}

function PaymentMethodPicker({
  value,
  onChange,
}: {
  value: "online" | "offline";
  onChange: (v: "online" | "offline") => void;
}) {
  return (
    <div className="grid gap-2 md:grid-cols-2">
      <ChoiceCard
        active={value === "offline"}
        onClick={() => onChange("offline")}
        title="호스트에게 직접 결제"
        hint="만나서 현장 결제 (현금/계좌이체 등 호스트가 안내)"
      />
      <ChoiceCard
        active={value === "online"}
        onClick={() => onChange("online")}
        title="온라인 결제 (준비 중)"
        hint="토스페이먼츠 연동 후 활성화 예정"
      />
    </div>
  );
}

function SlotImagePicker({
  urls,
  onChange,
}: {
  urls: string[];
  onChange: (next: string[]) => void;
}) {
  const toast = useToast();
  const [uploading, setUploading] = useState(false);
  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const { uploadSlotImages } = await import("@/lib/slot-media");
      const fd = new FormData();
      Array.from(files).forEach((f) => fd.append("files", f));
      const res = await uploadSlotImages(fd);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      onChange([...urls, ...res.urls].slice(0, 6));
    } finally {
      setUploading(false);
    }
  };
  const removeAt = (i: number) => {
    onChange(urls.filter((_, idx) => idx !== i));
  };
  return (
    <div className="space-y-3">
      {urls.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {urls.map((url, i) => (
            <div
              key={url}
              className="group relative aspect-square overflow-hidden rounded-lg bg-charcoal-800/40"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt=""
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => removeAt(i)}
                aria-label="Remove image"
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      {urls.length < 6 && (
        <label className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-charcoal-700 bg-charcoal-800/20 px-4 py-6 text-sm text-charcoal-400 hover:border-charcoal-600 hover:text-charcoal-200">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
            disabled={uploading}
          />
          {uploading ? "업로드 중…" : "+ 사진 추가"}
        </label>
      )}
    </div>
  );
}
