"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { APP_STORE_URL } from "@/lib/constants";

/**
 * 공개 페이지의 가입·로그인 링크. 아이폰(iPad 포함) 방문자에겐 웹 가입 대신
 * App Store 로 보낸다. UA 판별은 마운트 후에 해서 서버 HTML 과 어긋나지 않게 한다.
 */
export function AppStoreAwareLink({
  href,
  iosLabel,
  children,
  ...rest
}: {
  href: string;
  /** 아이폰일 때 바꿔 보여줄 문구(없으면 그대로). */
  iosLabel?: React.ReactNode;
} & Omit<React.ComponentProps<"a">, "href">) {
  const [ios, setIos] = useState(false);
  useEffect(() => {
    const ua = navigator.userAgent;
    setIos(/iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1));
  }, []);

  if (ios) {
    return (
      <a href={APP_STORE_URL} {...rest}>
        {iosLabel ?? children}
      </a>
    );
  }
  return (
    <Link href={href} {...rest}>
      {children}
    </Link>
  );
}
