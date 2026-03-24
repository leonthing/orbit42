"use client";

import { useState, useTransition } from "react";
import {
  createTransaction,
  deleteTransaction,
  createAsset,
  updateAsset,
  deleteAsset,
} from "./actions";

// ---------- Types ----------

interface Transaction {
  id: string;
  type: "income" | "expense";
  amount: number;
  description: string;
  category: string;
  date: string;
  business_id: string | null;
}

interface Asset {
  id: string;
  name: string;
  type: "cash" | "bank" | "investment" | "real_estate" | "other";
  value: number;
  memo: string;
}

type AssetType = Asset["type"];

const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  cash: "현금",
  bank: "은행",
  investment: "투자",
  real_estate: "부동산",
  other: "기타",
};

const CATEGORIES = [
  "급여",
  "매출",
  "투자수익",
  "식비",
  "교통",
  "주거",
  "통신",
  "보험",
  "세금",
  "기타",
];

function formatWon(amount: number): string {
  return "₩" + amount.toLocaleString("ko-KR");
}

// ---------- Component ----------

export default function FinanceDashboard({
  initialTransactions,
  initialAssets,
}: {
  initialTransactions: Transaction[];
  initialAssets: Asset[];
}) {
  const [transactions, setTransactions] =
    useState<Transaction[]>(initialTransactions);
  const [assets, setAssets] = useState<Asset[]>(initialAssets);
  const [isPending, startTransition] = useTransition();

  // Transaction form state
  const [showTxForm, setShowTxForm] = useState(false);
  const [txType, setTxType] = useState<"income" | "expense">("expense");
  const [txAmount, setTxAmount] = useState("");
  const [txDesc, setTxDesc] = useState("");
  const [txCategory, setTxCategory] = useState("기타");
  const [txDate, setTxDate] = useState(
    new Date().toISOString().slice(0, 10),
  );

  // Asset form state
  const [showAssetForm, setShowAssetForm] = useState(false);
  const [assetName, setAssetName] = useState("");
  const [assetType, setAssetType] = useState<AssetType>("bank");
  const [assetValue, setAssetValue] = useState("");
  const [assetMemo, setAssetMemo] = useState("");

  // Edit asset state
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<AssetType>("bank");
  const [editValue, setEditValue] = useState("");
  const [editMemo, setEditMemo] = useState("");

  // ---------- Handlers ----------

  function handleAddTransaction() {
    const amount = parseInt(txAmount, 10);
    if (!amount || !txDesc.trim()) return;

    startTransition(async () => {
      const created = await createTransaction({
        type: txType,
        amount,
        description: txDesc.trim(),
        category: txCategory,
        date: txDate,
      });
      setTransactions((prev) => [created, ...prev]);
      setTxAmount("");
      setTxDesc("");
      setTxCategory("기타");
      setShowTxForm(false);
    });
  }

  function handleDeleteTransaction(id: string) {
    startTransition(async () => {
      await deleteTransaction(id);
      setTransactions((prev) => prev.filter((t) => t.id !== id));
    });
  }

  function handleAddAsset() {
    const value = parseInt(assetValue, 10);
    if (!assetName.trim() || isNaN(value)) return;

    startTransition(async () => {
      const created = await createAsset({
        name: assetName.trim(),
        type: assetType,
        value,
        memo: assetMemo.trim(),
      });
      setAssets((prev) => [created, ...prev]);
      setAssetName("");
      setAssetValue("");
      setAssetMemo("");
      setShowAssetForm(false);
    });
  }

  function startEditAsset(asset: Asset) {
    setEditingAssetId(asset.id);
    setEditName(asset.name);
    setEditType(asset.type);
    setEditValue(String(asset.value));
    setEditMemo(asset.memo ?? "");
  }

  function handleUpdateAsset() {
    if (!editingAssetId) return;
    const value = parseInt(editValue, 10);
    if (!editName.trim() || isNaN(value)) return;

    startTransition(async () => {
      const updated = await updateAsset(editingAssetId!, {
        name: editName.trim(),
        type: editType,
        value,
        memo: editMemo.trim(),
      });
      setAssets((prev) =>
        prev.map((a) => (a.id === editingAssetId ? updated : a)),
      );
      setEditingAssetId(null);
    });
  }

  function handleDeleteAsset(id: string) {
    startTransition(async () => {
      await deleteAsset(id);
      setAssets((prev) => prev.filter((a) => a.id !== id));
    });
  }

  // ---------- Shared styles ----------

  const inputClass =
    "w-full rounded-lg border border-charcoal-700 bg-charcoal-800/50 px-3 py-2 text-sm text-charcoal-100 placeholder-charcoal-500 focus:border-navy-500 focus:outline-none";
  const btnPrimary =
    "rounded-lg bg-navy-600 px-4 py-2 text-sm font-medium text-white hover:bg-navy-500 disabled:opacity-50";
  const btnSecondary =
    "rounded-lg border border-charcoal-700 px-4 py-2 text-sm font-medium text-charcoal-300 hover:bg-charcoal-800/60";

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* ---------- Assets Section ---------- */}
      <div className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/40">
        <div className="flex items-center justify-between border-b border-charcoal-800/40 px-5 py-3">
          <h2 className="text-sm font-semibold text-charcoal-200">자산 관리</h2>
          <button
            onClick={() => setShowAssetForm((v) => !v)}
            className="text-xs font-medium text-navy-400 hover:text-navy-300"
          >
            {showAssetForm ? "취소" : "+ 자산 추가"}
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Add asset form */}
          {showAssetForm && (
            <div className="space-y-3 rounded-lg border border-charcoal-700/50 bg-charcoal-800/30 p-4">
              <input
                type="text"
                placeholder="자산명"
                value={assetName}
                onChange={(e) => setAssetName(e.target.value)}
                className={inputClass}
              />
              <select
                value={assetType}
                onChange={(e) => setAssetType(e.target.value as AssetType)}
                className={inputClass}
              >
                {(Object.entries(ASSET_TYPE_LABELS) as [AssetType, string][]).map(
                  ([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ),
                )}
              </select>
              <input
                type="number"
                placeholder="금액 (원)"
                value={assetValue}
                onChange={(e) => setAssetValue(e.target.value)}
                className={inputClass}
              />
              <input
                type="text"
                placeholder="메모 (선택)"
                value={assetMemo}
                onChange={(e) => setAssetMemo(e.target.value)}
                className={inputClass}
              />
              <button
                onClick={handleAddAsset}
                disabled={isPending}
                className={btnPrimary + " w-full"}
              >
                {isPending ? "저장 중..." : "추가"}
              </button>
            </div>
          )}

          {/* Asset list */}
          {assets.length === 0 && !showAssetForm ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-sm text-charcoal-600">등록된 자산이 없습니다</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {assets.map((asset) =>
                editingAssetId === asset.id ? (
                  <li
                    key={asset.id}
                    className="space-y-2 rounded-lg border border-charcoal-700/50 bg-charcoal-800/30 p-3"
                  >
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className={inputClass}
                    />
                    <select
                      value={editType}
                      onChange={(e) =>
                        setEditType(e.target.value as AssetType)
                      }
                      className={inputClass}
                    >
                      {(
                        Object.entries(ASSET_TYPE_LABELS) as [AssetType, string][]
                      ).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className={inputClass}
                    />
                    <input
                      type="text"
                      placeholder="메모"
                      value={editMemo}
                      onChange={(e) => setEditMemo(e.target.value)}
                      className={inputClass}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleUpdateAsset}
                        disabled={isPending}
                        className={btnPrimary + " flex-1"}
                      >
                        저장
                      </button>
                      <button
                        onClick={() => setEditingAssetId(null)}
                        className={btnSecondary + " flex-1"}
                      >
                        취소
                      </button>
                    </div>
                  </li>
                ) : (
                  <li
                    key={asset.id}
                    className="flex flex-col gap-2 rounded-lg border border-charcoal-800/40 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-charcoal-200">
                        {asset.name}
                      </p>
                      <p className="truncate text-xs text-charcoal-500">
                        {ASSET_TYPE_LABELS[asset.type] ?? asset.type}
                        {asset.memo ? ` · ${asset.memo}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <span className="text-sm font-semibold text-charcoal-200">
                        {formatWon(Number(asset.value))}
                      </span>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => startEditAsset(asset)}
                          className="text-xs text-charcoal-500 hover:text-charcoal-300"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handleDeleteAsset(asset.id)}
                          className="text-xs text-red-400 hover:text-red-300"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  </li>
                ),
              )}
            </ul>
          )}
        </div>
      </div>

      {/* ---------- Transactions Section ---------- */}
      <div className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/40">
        <div className="flex items-center justify-between border-b border-charcoal-800/40 px-5 py-3">
          <h2 className="text-sm font-semibold text-charcoal-200">최근 거래</h2>
          <button
            onClick={() => setShowTxForm((v) => !v)}
            className="text-xs font-medium text-navy-400 hover:text-navy-300"
          >
            {showTxForm ? "취소" : "+ 거래 추가"}
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Add transaction form */}
          {showTxForm && (
            <div className="space-y-3 rounded-lg border border-charcoal-700/50 bg-charcoal-800/30 p-4">
              {/* Type toggle */}
              <div className="flex rounded-lg border border-charcoal-700 overflow-hidden">
                <button
                  onClick={() => setTxType("income")}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    txType === "income"
                      ? "bg-emerald-600/20 text-emerald-400"
                      : "text-charcoal-400 hover:text-charcoal-300"
                  }`}
                >
                  수입
                </button>
                <button
                  onClick={() => setTxType("expense")}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    txType === "expense"
                      ? "bg-red-600/20 text-red-400"
                      : "text-charcoal-400 hover:text-charcoal-300"
                  }`}
                >
                  지출
                </button>
              </div>

              <input
                type="number"
                placeholder="금액 (원)"
                value={txAmount}
                onChange={(e) => setTxAmount(e.target.value)}
                className={inputClass}
              />
              <input
                type="text"
                placeholder="설명"
                value={txDesc}
                onChange={(e) => setTxDesc(e.target.value)}
                className={inputClass}
              />
              <select
                value={txCategory}
                onChange={(e) => setTxCategory(e.target.value)}
                className={inputClass}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={txDate}
                onChange={(e) => setTxDate(e.target.value)}
                className={inputClass}
              />
              <button
                onClick={handleAddTransaction}
                disabled={isPending}
                className={btnPrimary + " w-full"}
              >
                {isPending ? "저장 중..." : "추가"}
              </button>
            </div>
          )}

          {/* Transaction list */}
          {transactions.length === 0 && !showTxForm ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-sm text-charcoal-600">등록된 거래가 없습니다</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {transactions.map((tx) => (
                <li
                  key={tx.id}
                  className="flex flex-col gap-2 rounded-lg border border-charcoal-800/40 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-charcoal-200">
                      {tx.description}
                    </p>
                    <p className="text-xs text-charcoal-500">
                      {tx.category} · {tx.date}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <span
                      className={`text-sm font-semibold ${
                        tx.type === "income"
                          ? "text-emerald-400"
                          : "text-red-400"
                      }`}
                    >
                      {tx.type === "income" ? "+" : "-"}
                      {formatWon(Number(tx.amount))}
                    </span>
                    <button
                      onClick={() => handleDeleteTransaction(tx.id)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      삭제
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
