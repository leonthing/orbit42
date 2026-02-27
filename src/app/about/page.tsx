import { Metadata } from "next";
import { Timeline } from "@/components/about/Timeline";
import { SITE } from "@/lib/constants";

export const metadata: Metadata = {
  title: "About",
  description: `${SITE.author}에 대해`,
};

export default function AboutPage() {
  return (
    <div className="space-y-8">
      <section>
        <h1 className="mb-4 text-3xl font-bold text-charcoal-900 dark:text-charcoal-100">
          About
        </h1>
        <div className="prose dark:prose-invert">
          <p>
            안녕하세요, <strong>{SITE.author}</strong>입니다.
          </p>
          <p>
            기술과 농업의 교차점에서 다양한 프로젝트를 진행하고 있습니다. 스마트팜,
            웹 개발, DevOps 등 여러 분야에 관심을 갖고 탐험하며 배운 것들을 이
            블로그에 기록합니다.
          </p>
          <p>
            새로운 기술을 배우고, 문제를 해결하고, 경험을 나누는 것을 좋아합니다.
            궁금한 점이 있으면 편하게 연락해주세요.
          </p>
        </div>
      </section>

      <section>
        <h2 className="mb-6 text-2xl font-bold text-charcoal-900 dark:text-charcoal-100">
          Journey
        </h2>
        <Timeline />
      </section>
    </div>
  );
}
