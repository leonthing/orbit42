interface TimelineItem {
  year: string;
  title: string;
  description: string;
}

const TIMELINE_DATA: TimelineItem[] = [
  {
    year: "2024",
    title: "Orbit42 블로그 시작",
    description: "기술과 농업의 교차점에서 경험과 인사이트를 공유하기 시작",
  },
  {
    year: "2023",
    title: "스마트팜 프로젝트",
    description: "IoT 기반 스마트팜 데이터 파이프라인 설계 및 구축",
  },
  {
    year: "2022",
    title: "풀스택 개발",
    description: "웹 애플리케이션 개발 및 클라우드 인프라 구축",
  },
];

export function Timeline() {
  return (
    <div className="relative space-y-8 before:absolute before:left-4 before:top-2 before:h-full before:w-0.5 before:bg-charcoal-200 dark:before:bg-charcoal-700">
      {TIMELINE_DATA.map((item) => (
        <div key={item.year} className="relative pl-12">
          <div className="absolute left-2.5 top-1.5 h-3 w-3 rounded-full border-2 border-navy-500 bg-white dark:bg-charcoal-950" />
          <span className="text-sm font-semibold text-navy-600 dark:text-navy-400">
            {item.year}
          </span>
          <h3 className="mt-1 text-lg font-semibold text-charcoal-900 dark:text-charcoal-100">
            {item.title}
          </h3>
          <p className="mt-1 text-charcoal-600 dark:text-charcoal-400">
            {item.description}
          </p>
        </div>
      ))}
    </div>
  );
}
