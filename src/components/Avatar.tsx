import Image from "next/image";

export function Avatar({
  url,
  name,
  size = 40,
  className = "",
}: {
  url: string | null | undefined;
  name: string;
  size?: number;
  className?: string;
}) {
  const letter = (name || "?").charAt(0).toUpperCase();
  const base =
    "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-navy-500 to-navy-400 font-bold text-white";
  const style: React.CSSProperties = {
    width: size,
    height: size,
    fontSize: Math.max(10, Math.round(size * 0.38)),
  };
  if (url) {
    return (
      <span className={`${base} ${className}`} style={style}>
        <Image
          src={url}
          alt={name}
          fill
          sizes={`${size}px`}
          className="object-cover"
          unoptimized
        />
      </span>
    );
  }
  return (
    <span className={`${base} ${className}`} style={style}>
      {letter}
    </span>
  );
}
