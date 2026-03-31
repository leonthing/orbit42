export default function BlogPublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[rgb(var(--bg-base))]">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        {children}
      </div>
      <footer className="border-t border-charcoal-800/40 py-6 text-center text-xs text-charcoal-600">
        Powered by{" "}
        <a
          href="https://orbit42.org"
          className="text-charcoal-400 hover:text-charcoal-300"
          target="_blank"
          rel="noopener noreferrer"
        >
          Orbit42
        </a>
      </footer>
    </div>
  );
}
