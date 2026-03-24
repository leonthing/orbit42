"use client";

import { useState } from "react";
import BusinessList from "./BusinessList";
import type { Business } from "./actions";

export default function BusinessPage({ businesses }: { businesses: Business[] }) {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-charcoal-100">Business</h1>
          <p className="mt-1 text-sm text-charcoal-500">사업체 및 프로젝트 관리</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="rounded-lg bg-navy-600 px-4 py-2 text-sm font-medium text-white hover:bg-navy-500"
        >
          + 새 사업체
        </button>
      </div>

      <BusinessList businesses={businesses} showFormExternal={showForm} onFormClose={() => setShowForm(false)} />
    </div>
  );
}
