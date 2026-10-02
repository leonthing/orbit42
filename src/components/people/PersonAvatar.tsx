import Image from "next/image";
import { personInitial, type OrbitPerson } from "@/lib/people-types";

/**
 * 사람 아바타. 회원이면 프로필 사진, 아니면 그 사람의 고유색 위에 이니셜.
 * 색은 사람을 구분하는 언어라 사진이 있어도 테두리 그림자로 남긴다.
 */
export function PersonAvatar({
  person,
  size = 40,
  className = "",
}: {
  person: Pick<OrbitPerson, "name" | "color" | "member">;
  size?: number;
  className?: string;
}) {
  const url = person.member?.avatarUrl;
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold text-white ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, Math.round(size * 0.4)),
        background: person.color,
      }}
    >
      {url ? (
        <Image src={url} alt={person.name} fill sizes={`${size}px`} className="object-cover" unoptimized />
      ) : (
        personInitial(person.name)
      )}
    </span>
  );
}
