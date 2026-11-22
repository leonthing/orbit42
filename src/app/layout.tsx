import type { Metadata } from "next";
import localFont from "next/font/local";
import { Inter } from "next/font/google";
import { SITE } from "@/lib/constants";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ToastProvider } from "@/components/Toast";
import { ConfirmProvider } from "@/components/ConfirmDialog";
import "./globals.css";
import "highlight.js/styles/github-dark.css";

const pretendard = localFont({
  src: "../fonts/PretendardVariable.woff2",
  variable: "--font-pretendard",
  display: "swap",
  weight: "45 920",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: SITE.title,
    template: `%s | ${SITE.title}`,
  },
  description: SITE.description,
  keywords: [...SITE.keywords],
  alternates: {
    canonical: "/",
  },
  // 아이콘은 public/ 에 있고 favicon.ico·apple-touch-icon.png 는 루트 관례로도
  // 잡히지만, 명시해 둬야 favicon-16/32 까지 링크되고 크롤러가 확실히 집는다.
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    title: SITE.title,
    description: SITE.description,
    url: SITE.url,
    siteName: SITE.title,
    locale: "ko_KR",
    type: "website",
    images: [{ url: "/icon-512.png", width: 512, height: 512, alt: SITE.title }],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE.title,
    description: SITE.description,
    images: ["/icon-512.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

// 안드로이드 앱(TWA, 11/22 Leo): 크롬이 우리 APK 로 띄울 때만 referrer 가 android-app://org.orbit42.app —
// 첫 화면에서 보고 sessionStorage 에 남겨 앱 안 이동·새로 고침·구글 로그인 뒤에도 유지. 백그라운드에서 크롬 프로세스가 죽었다 살아나면
// sessionStorage 가 비므로 '안드로이드 + display-mode standalone'(TWA·설치형 PWA만, 일반 크롬 탭·iOS 는 아님)도 본다.
// TWA 면 저장값과 상관없이 '시스템'(저장값은 그대로 둠).
const THEME_BOOT = `(function(){try{var t=false;try{t=sessionStorage.getItem("orbit42-twa")==="1";if(!t&&(document.referrer.indexOf("android-app://org.orbit42.app")===0||(/Android/i.test(navigator.userAgent)&&window.matchMedia("(display-mode: standalone)").matches))){t=true;sessionStorage.setItem("orbit42-twa","1");}}catch(e){}if(t)document.documentElement.setAttribute("data-twa","");var m=t?"system":(localStorage.getItem("orbit42-theme")||"system");var d=m==="dark"||(m==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="ko"
      className={`${pretendard.variable} ${inter.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* 화면 모드(묶음 5): 첫 그림 전에 html.dark 를 정해 번쩍임을 막는다. 기본은 '시스템'.
            다크 색은 앱 화면(AppShell) 안에만 걸린다 — 공개 링크·로그인·랜딩·약관은 그대로(globals.css·tailwind 설정). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        <meta name="theme-color" content="#F2F2F7" />
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider>
          <ConfirmProvider>
            <ToastProvider>{children}</ToastProvider>
          </ConfirmProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
