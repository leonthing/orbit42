import Link from "next/link";
import { buttonClasses } from "@/components/PendingButton";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-charcoal-600">404</h1>
        <p className="mt-4 text-charcoal-400">페이지를 찾을 수 없습니다</p>
        <Link href="/" className={`mt-6 ${buttonClasses({ variant: "primary", size: "md" })}`}>
          홈으로
        </Link>
      </div>
    </div>
  );
}
