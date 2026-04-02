import { PROMPT_STAGES, type PromptStage, upsertPromptTemplate } from "./prompts";

export type PromptCatalogStage = PromptStage;
export type FreshnessMode = "strict" | "medium" | "narrative";
export type ModelTier = "small" | "large" | "gemini";

export type PromptCatalogItem = {
  slug: string;
  name: string;
  description: string;
  scheduleTime: string;
  scheduleTimezone: string;
  selectionWeight: number;
  selectionEnabled: boolean;
  postCategorySlug: string;
  targetLengthMin: number;
  targetLengthMax: number;
  targetLengthBand: string;
  freshnessMode: FreshnessMode;
  preferredDiscoveryModel: ModelTier;
  preferredArticleModel: Extract<ModelTier, "large">;
  preferredReviewModel: Extract<ModelTier, "small">;
  preferredRevisionModel: Extract<ModelTier, "small">;
  preferredImagePromptModel: Extract<ModelTier, "small">;
};

type CategorySeed = Omit<
  PromptCatalogItem,
  | "preferredDiscoveryModel"
  | "preferredArticleModel"
  | "preferredReviewModel"
  | "preferredRevisionModel"
  | "preferredImagePromptModel"
  | "selectionWeight"
  | "selectionEnabled"
> & {
  postCategoryName: string;
  postCategoryDescription: string;
  postCategoryParentSlug: string | null;
  audience: string;
  searchIntent: string;
  goalQuestion: string;
  bannedTopics: string[];
  voice: string;
  antiPatterns: string[];
  sourcePriority: string[];
  imageDirection: string;
  topicAngles: string[];
  closingModes: string[];
  imageScenes: string[];
};

export type PromptCatalogSyncResult = {
  categoryCount: number;
  promptCount: number;
  updatedPromptCount: number;
  syncedSlugs: string[];
};

const DEFAULT_TIMEZONE = "Asia/Seoul";

function selectionWeightForSlug(slug: string): number {
  if (["development-programming", "issues-commentary", "tech-records", "stock-flow", "crypto"].includes(slug)) {
    return 1.3;
  }
  if (slug === "daily-memo") {
    return 0.7;
  }
  return 1.0;
}

const CATEGORY_SEEDS: CategorySeed[] = [
  {
    slug: "development-programming",
    name: "개발과 프로그래밍",
    description: "현재 개발 실무 화두, 에이전트 워크플로, 도구 변화, 배포와 관측성을 다루는 카테고리",
    scheduleTime: "09:00",
    scheduleTimezone: DEFAULT_TIMEZONE,
    postCategorySlug: "개발과-프로그래밍",
    postCategoryName: "개발과 프로그래밍",
    postCategoryDescription: "개발 워크플로와 프로그래밍 실무를 다루는 글",
    postCategoryParentSlug: "동그리의-기록",
    targetLengthMin: 3400,
    targetLengthMax: 4200,
    targetLengthBand: "3400~4200",
    freshnessMode: "medium",
    audience: "실무 개발자, 테크 리드, 개발 생산성에 민감한 팀",
    searchIntent: "지금 개발 현장에서 실제로 중요한 변화가 무엇인지 이해하고 싶다.",
    goalQuestion: "이 변화가 왜 지금 중요하고, 팀의 개발 방식에 어떤 영향을 주는가?",
    bannedTopics: ["입문 튜토리얼", "근거 없는 생산성 찬양", "실전 맥락 없는 기능 나열"],
    voice: "실무 메모와 편집자 해설이 섞인 단정한 톤",
    antiPatterns: ["도입부를 매번 질문형으로 시작", "모든 글을 도구 비교표로 마무리", "과장된 미래 예측"],
    sourcePriority: ["공식 문서", "공식 릴리스 노트", "주요 엔지니어링 블로그", "컨퍼런스 발표"],
    imageDirection: "개발 환경, 팀 협업, 배포 화면, 코드와 운영 맥락이 함께 보이는 9패널 콜라주",
    topicAngles: ["MCP와 에이전트 도입", "IDE/CLI 워크플로 변화", "배포 자동화", "관측성과 디버깅"],
    closingModes: ["실무 체크리스트", "팀 단위 적용 포인트", "다음 분기 관찰 포인트"],
    imageScenes: ["developer at IDE", "terminal and agent workflow", "code review panel", "deployment dashboard", "logs and observability", "team standup", "architecture sketch", "automation pipeline", "focused desktop setup"],
  },
  {
    slug: "travel-records",
    name: "여행과 기록",
    description: "한국 여행의 장면, 동선, 계절감, 현장 경험을 기록 중심으로 다루는 카테고리",
    scheduleTime: "10:00",
    scheduleTimezone: DEFAULT_TIMEZONE,
    postCategorySlug: "여행과-기록",
    postCategoryName: "여행과 기록",
    postCategoryDescription: "한국 여행의 장면과 기록을 다루는 글",
    postCategoryParentSlug: "동그리의-기록",
    targetLengthMin: 3200,
    targetLengthMax: 3800,
    targetLengthBand: "3200~3800",
    freshnessMode: "strict",
    audience: "한국 여행 동선을 찾는 독자, 기록형 여행을 좋아하는 독자",
    searchIntent: "지금 가볼 만한 장소와 그 장소를 경험하는 방식이 궁금하다.",
    goalQuestion: "왜 지금 이 장소를 읽을 가치가 있고, 어떤 동선으로 경험하면 좋은가?",
    bannedTopics: ["비현실적인 1일 완전정복 코스", "확인되지 않은 운영시간 단정", "감상 없는 장소 나열"],
    voice: "현장형 기록과 안내가 섞인 담백한 톤",
    antiPatterns: ["모든 글을 교통-맛집-숙박 순서로 고정", "과하게 관광 홍보처럼 쓰기", "장면 없는 건조한 정보문"],
    sourcePriority: ["공식 관광 사이트", "지자체/기관 페이지", "공식 전시·운영 공지", "현장 방문 맥락"],
    imageDirection: "한국 여행의 계절감, 이동, 장소 디테일, 기록 장면이 살아 있는 9패널 콜라주",
    topicAngles: ["현재 계절 동선", "산책형 기록", "지역 공간의 분위기", "방문 타이밍과 포인트"],
    closingModes: ["방문 팁 요약", "추천 동선 정리", "기록 포인트 정리"],
    imageScenes: ["street in Korea", "seasonal landmark", "public transport access", "walking route", "quiet cafe stop", "local market", "landscape detail", "traveler notebook", "evening street mood"],
  },
  {
    slug: "daily-memo",
    name: "일상과 메모",
    description: "메모 습관, 루틴, 기록 시스템, 생활 도구를 다루는 에세이형 카테고리",
    scheduleTime: "10:30",
    scheduleTimezone: DEFAULT_TIMEZONE,
    postCategorySlug: "일상과-메모",
    postCategoryName: "일상과 메모",
    postCategoryDescription: "메모와 루틴, 생활 기록을 다루는 글",
    postCategoryParentSlug: "동그리의-기록",
    targetLengthMin: 3000,
    targetLengthMax: 3400,
    targetLengthBand: "3000~3400",
    freshnessMode: "narrative",
    audience: "메모 습관을 만들고 싶은 독자, 기록 시스템을 다듬고 싶은 실무자",
    searchIntent: "지속 가능한 메모 습관과 기록 도구 사용법을 찾고 있다.",
    goalQuestion: "이 기록 방식이 실제 일상에서 어떻게 굴러가고, 왜 오래 유지되는가?",
    bannedTopics: ["근거 없는 자기계발 훈계", "만능 루틴처럼 단정", "감정 없는 기능 비교"],
    voice: "생활 에세이와 실용 메모가 섞인 차분한 톤",
    antiPatterns: ["모든 글을 아침 루틴으로 시작", "도구 목록만 나열", "결론에서 과장된 삶의 변화 약속"],
    sourcePriority: ["실사용 맥락", "공식 제품 문서", "업데이트 공지", "행동 습관 연구의 일반 원칙"],
    imageDirection: "메모 도구, 책상, 손글씨, 디지털 노트가 어우러진 9패널 콜라주",
    topicAngles: ["메모 루틴", "도구 정리", "기록 습관", "생활 생산성"],
    closingModes: ["내일 바로 적용할 한 가지", "유지하기 쉬운 버전", "도구 선택 기준"],
    imageScenes: ["paper notebook", "digital notes app", "morning desk", "highlighted text", "calendar and checklist", "pen and keyboard", "quiet room", "capture quick memo", "weekly review board"],
  },
  {
    slug: "mystery-legends",
    name: "미스터리와 전설",
    description: "세계의 전설, 미스터리, 다큐멘터리적 사건 재평가를 다루는 서사형 카테고리",
    scheduleTime: "11:00",
    scheduleTimezone: DEFAULT_TIMEZONE,
    postCategorySlug: "미스테리아-스토리",
    postCategoryName: "미스테리아 스토리",
    postCategoryDescription: "미스터리와 역사 문화를 엮어 맥락을 정리하는 기록",
    postCategoryParentSlug: "세상의-기록",
    targetLengthMin: 3600,
    targetLengthMax: 4500,
    targetLengthBand: "3600~4500",
    freshnessMode: "narrative",
    audience: "사건 재구성과 전설의 문화적 의미를 함께 읽고 싶은 독자",
    searchIntent: "잘 알려진 미스터리를 더 입체적으로 이해하고 싶다.",
    goalQuestion: "확인된 사실과 전승, 현대 해석은 어디서 갈리고 왜 아직도 이 이야기가 남아 있는가?",
    bannedTopics: ["공포 연출만 강조", "근거 없는 초자연 단정", "충격 요약만 반복"],
    voice: "다큐멘터리 해설과 이야기의 몰입감을 함께 가진 톤",
    antiPatterns: ["모든 글을 연표만으로 전개", "증거-이론-결론 순서를 고정", "결말을 억지로 단정"],
    sourcePriority: ["공식 기록물", "재판/수사 자료", "박물관·아카이브", "다큐·학술 정리"],
    imageDirection: "사건 현장, 기록, 증거, 지도, 현대 재해석이 겹치는 9패널 콜라주",
    topicAngles: ["사건 재구성", "전승과 사실의 간극", "현대 다큐 해석", "남아 있는 의문"],
    closingModes: ["열린 결론", "현재 남는 질문", "왜 아직 회자되는가"],
    imageScenes: ["archival documents", "case board", "historic location", "map with markers", "evidence close-up", "witness silhouette", "newspaper clipping", "documentary frame", "night landscape"],
  },
  {
    slug: "history-culture",
    name: "역사와 문화",
    description: "오늘 날짜와 연결되는 세계의 역사·문화 사건을 현재 감각으로 읽는 카테고리",
    scheduleTime: "11:30",
    scheduleTimezone: DEFAULT_TIMEZONE,
    postCategorySlug: "미스테리아-스토리",
    postCategoryName: "미스테리아 스토리",
    postCategoryDescription: "미스터리와 역사 문화를 엮어 맥락을 정리하는 기록",
    postCategoryParentSlug: "세상의-기록",
    targetLengthMin: 3200,
    targetLengthMax: 3800,
    targetLengthBand: "3200~3800",
    freshnessMode: "narrative",
    audience: "오늘 날짜와 연결된 역사적 의미를 알고 싶은 독자",
    searchIntent: "오늘과 연결해 읽을 수 있는 역사·문화 사건이 궁금하다.",
    goalQuestion: "오늘 이 날짜에 어떤 일이 있었고, 그 사건은 지금 왜 다시 읽을 가치가 있는가?",
    bannedTopics: ["연표 암기식 서술", "근거 없는 민족주의·국가주의 강조", "현재 의미 없는 사실 나열"],
    voice: "역사 해설과 현재적 의미 부여가 섞인 정리형 톤",
    antiPatterns: ["모든 글을 위인전처럼 구성", "배경-사건-영향 삼단 구조를 고정", "현재 연결 없이 마무리"],
    sourcePriority: ["공식 역사기관", "박물관·기념재단", "신뢰 가능한 백과·아카이브", "학술/역사 자료"],
    imageDirection: "역사적 순간, 유물, 공간, 기록 이미지가 이어지는 9패널 콜라주",
    topicAngles: ["오늘의 사건", "문화적 전환점", "역사적 장소", "현재까지 남은 의미"],
    closingModes: ["오늘 다시 읽는 이유", "지금 남은 질문", "현재 문화와의 연결"],
    imageScenes: ["historic site", "artifact close-up", "painting or poster", "archival photo", "timeline clue", "museum interior", "map or route", "cultural performance", "today reflection shot"],
  },
  {
    slug: "issues-commentary",
    name: "이슈와 해설",
    description: "현재 이슈를 A/B/C 세 인물이 대화하며 해설하는 카테고리",
    scheduleTime: "12:00",
    scheduleTimezone: DEFAULT_TIMEZONE,
    postCategorySlug: "동그리의-생각",
    postCategoryName: "동그리의 생각",
    postCategoryDescription: "이슈를 동그리 관점으로 정리하는 해설 기록",
    postCategoryParentSlug: "세상의-기록",
    targetLengthMin: 3300,
    targetLengthMax: 4200,
    targetLengthBand: "3300~4200",
    freshnessMode: "strict",
    audience: "뉴스는 봤지만 맥락과 관점 차이를 정리하고 싶은 독자",
    searchIntent: "현재 이슈를 한쪽 주장만이 아니라 여러 시각으로 이해하고 싶다.",
    goalQuestion: "이 이슈의 핵심 쟁점은 무엇이며, 각 관점은 무엇을 놓치거나 강조하는가?",
    bannedTopics: ["근거 없는 확정적 정치 주장", "출처 없는 속보 재가공", "관점이 하나뿐인 해설"],
    voice: "대화형이지만 논점을 분명히 정리하는 해설 톤",
    antiPatterns: ["A/B/C를 형식적으로만 등장", "세 인물이 같은 말만 반복", "결론을 너무 빨리 확정"],
    sourcePriority: ["공식 발표", "주요 보도기관", "정책 문서", "실적·공시·기관 자료"],
    imageDirection: "뉴스룸, 문서, 대화, 화면, 쟁점 키워드가 섞인 9패널 콜라주",
    topicAngles: ["정책 변화", "경제 이슈", "플랫폼 변화", "산업 쟁점"],
    closingModes: ["A/B/C 관점 차이 정리", "앞으로 볼 체크포인트", "독자가 봐야 할 다음 신호"],
    imageScenes: ["roundtable discussion", "news screen", "document stack", "economic chart background", "person taking notes", "policy briefing", "city/business scene", "three-person composition", "headline wall"],
  },
  {
    slug: "tech-records",
    name: "기술의 기록",
    description: "신기술을 설명하고 현재 적용 맥락과 향후 1~3년 방향을 정리하는 카테고리",
    scheduleTime: "12:30",
    scheduleTimezone: DEFAULT_TIMEZONE,
    postCategorySlug: "삶을-유용하게",
    postCategoryName: "삶을 유용하게",
    postCategoryDescription: "유용한 기술과 정보를 합친 실용 기록",
    postCategoryParentSlug: "기술의-기록",
    targetLengthMin: 3400,
    targetLengthMax: 4300,
    targetLengthBand: "3400~4300",
    freshnessMode: "medium",
    audience: "새 기술을 빠르게 파악하고 적용 맥락까지 보고 싶은 독자",
    searchIntent: "이 기술이 정확히 무엇이고, 어디까지 실제로 쓰이며, 앞으로 어디로 갈지 알고 싶다.",
    goalQuestion: "이 기술의 현재 수준과 실제 도입 경로, 단기 전망은 무엇인가?",
    bannedTopics: ["마케팅 문구 복붙", "근거 없는 범용 혁신 선언", "세부 기술 설명 없는 미래예측"],
    voice: "브리핑과 실무 메모가 섞인 선명한 톤",
    antiPatterns: ["정의-장점-단점만 반복", "모든 글을 시장 전망으로 마무리", "비슷한 사례를 재탕"],
    sourcePriority: ["공식 발표", "제품 문서", "기술 보고서", "연구/실증 사례"],
    imageDirection: "실험실, 디바이스, 대시보드, 산업 현장 맥락이 섞인 9패널 콜라주",
    topicAngles: ["현재 적용", "기술 구조", "산업 연결", "향후 1~3년 전망"],
    closingModes: ["도입 판단 기준", "관찰 포인트", "현실적인 전망 정리"],
    imageScenes: ["device prototype", "robotics or hardware", "dashboard UI", "lab scene", "factory or field use", "data visualization", "team briefing", "close-up component", "future workflow"],
  },
  {
    slug: "stock-flow",
    name: "주식의 흐름",
    description: "현재 트렌드가 되는 종목을 재무, CEO, 방향성, 리스크까지 분석하는 카테고리",
    scheduleTime: "13:00",
    scheduleTimezone: DEFAULT_TIMEZONE,
    postCategorySlug: "주식의-흐름",
    postCategoryName: "주식의 흐름",
    postCategoryDescription: "현재 주목 종목을 분석하는 글",
    postCategoryParentSlug: "시장의-기록",
    targetLengthMin: 4000,
    targetLengthMax: 4500,
    targetLengthBand: "4000~4500",
    freshnessMode: "strict",
    audience: "현재 주목받는 종목을 길게 읽고 판단하려는 투자자",
    searchIntent: "이 종목의 최근 서사, 실적, 경영진 방향, 리스크를 한 번에 이해하고 싶다.",
    goalQuestion: "이 종목이 지금 왜 시장의 중심에 있고, 숫자와 방향성은 어디를 가리키는가?",
    bannedTopics: ["매수·매도 단정", "목표가 예언", "출처 없는 재무 수치"],
    voice: "기업 분석 리포트와 시장 해설이 섞인 밀도 높은 톤",
    antiPatterns: ["모든 글을 재무제표 해설로만 구성", "CEO 찬양/비난 일변도", "차트 설명만 반복"],
    sourcePriority: ["공식 공시", "실적 발표", "IR 자료", "CEO 인터뷰/발언", "주요 보도기관"],
    imageDirection: "기업, 시장, 제품, 실적 맥락이 함께 보이는 9패널 콜라주",
    topicAngles: ["실적", "CEO 전략", "시장 기대", "리스크와 밸류에이션"],
    closingModes: ["관찰 포인트 정리", "리스크 체크", "향후 분기 변수"],
    imageScenes: ["executive portrait style", "earnings slide", "product shot", "market mood", "office tower", "investor presentation", "operations floor", "industry context", "strategy board"],
  },
  {
    slug: "crypto",
    name: "크립토",
    description: "오늘 또는 이번 주 트렌드가 되는 암호화폐와 체인 서사를 분석하는 카테고리",
    scheduleTime: "13:30",
    scheduleTimezone: DEFAULT_TIMEZONE,
    postCategorySlug: "크립토의-흐름",
    postCategoryName: "크립토의 흐름",
    postCategoryDescription: "암호화폐와 체인 트렌드를 분석하는 글",
    postCategoryParentSlug: "시장의-기록",
    targetLengthMin: 3000,
    targetLengthMax: 3600,
    targetLengthBand: "3000~3600",
    freshnessMode: "strict",
    audience: "암호화폐 흐름을 내러티브와 리스크까지 함께 보고 싶은 독자",
    searchIntent: "왜 지금 이 코인이나 체인이 주목받는지 빠르게 이해하고 싶다.",
    goalQuestion: "지금 시장이 이 자산에 주목하는 이유와 구조적 리스크는 무엇인가?",
    bannedTopics: ["가격 예언", "근거 없는 급등 전망", "프로젝트 홍보문"],
    voice: "시장 서사와 기술 배경을 같이 짚는 요약형 톤",
    antiPatterns: ["토큰 가격만 집착", "모든 글을 온체인 지표 열거로 끝내기", "리스크 누락"],
    sourcePriority: ["공식 프로젝트 블로그", "재단/체인 공지", "주요 보도기관", "시장 리포트"],
    imageDirection: "체인 생태계, 인터페이스, 커뮤니티, 네트워크 이미지를 섞은 9패널 콜라주",
    topicAngles: ["서사 변화", "체인 업데이트", "생태계 확장", "리스크"],
    closingModes: ["다음 체크포인트", "리스크 정리", "시장 서사 한 줄 요약"],
    imageScenes: ["crypto wallet UI", "network visual", "developer ecosystem", "community event", "payment use case", "security motif", "market screen", "chain branding mood", "future finance scene"],
  },
  {
    slug: "culture-space",
    name: "문화와 공간",
    description: "최신 전시, 미술관, 문화공간, 장소 경험을 다루는 카테고리",
    scheduleTime: "14:00",
    scheduleTimezone: DEFAULT_TIMEZONE,
    postCategorySlug: "문화와-공간",
    postCategoryName: "문화와 공간",
    postCategoryDescription: "전시와 문화 공간을 다루는 글",
    postCategoryParentSlug: "정보의-기록",
    targetLengthMin: 3200,
    targetLengthMax: 3800,
    targetLengthBand: "3200~3800",
    freshnessMode: "strict",
    audience: "지금 갈 만한 전시와 공간 경험을 찾는 독자",
    searchIntent: "현재 기준으로 가치 있는 전시나 문화 공간을 알고 싶다.",
    goalQuestion: "이 공간이 지금 왜 좋고, 실제로 어떤 순서로 경험하면 좋은가?",
    bannedTopics: ["운영 정보 추정", "작품 목록만 나열", "공간 경험 없는 보도자료 요약"],
    voice: "공간 감각과 관람 정보가 균형 잡힌 톤",
    antiPatterns: ["모든 글을 전시 개요-티켓-교통 순서로 고정", "형용사 남발", "현장감 없는 추상평"],
    sourcePriority: ["공식 전시 페이지", "미술관/공간 공식 안내", "기관 공지", "현장 맥락"],
    imageDirection: "전시 공간, 작품 디테일, 관람 동선이 살아 있는 9패널 콜라주",
    topicAngles: ["최신 전시", "공간 경험", "도시 속 문화 장소", "관람 포인트"],
    closingModes: ["관람 전 체크", "추천 동선", "누가 좋아할지 정리"],
    imageScenes: ["gallery interior", "artwork detail", "entrance facade", "visitor walking", "signage", "quiet corner", "city neighborhood around venue", "ticket or map desk", "evening museum mood"],
  },
  {
    slug: "festivals",
    name: "축제",
    description: "최신 축제 일정과 핵심 정보를 다루는 카테고리",
    scheduleTime: "14:30",
    scheduleTimezone: DEFAULT_TIMEZONE,
    postCategorySlug: "축제와-현장",
    postCategoryName: "축제와 현장",
    postCategoryDescription: "축제 정보와 현장 운영 가이드를 합쳐 정리하는 기록",
    postCategoryParentSlug: "정보의-기록",
    targetLengthMin: 3200,
    targetLengthMax: 3800,
    targetLengthBand: "3200~3800",
    freshnessMode: "strict",
    audience: "최신 축제 정보와 방문 타이밍을 찾는 독자",
    searchIntent: "현재 열리거나 곧 열리는 축제의 핵심 일정과 포인트를 알고 싶다.",
    goalQuestion: "이 축제가 지금 왜 주목할 만하고, 방문 전에 어떤 사실을 먼저 확인해야 하는가?",
    bannedTopics: ["먼 미래 행사 추측", "확인되지 않은 일정·요금 단정", "실용 포인트 없는 홍보문"],
    voice: "최신 일정 중심의 실용 정보형 톤",
    antiPatterns: ["행사 소개만 하고 실제 준비 포인트 누락", "뻔한 축제 묘사 반복", "모든 글이 같은 소제목 구조"],
    sourcePriority: ["공식 축제 홈페이지", "지자체 공지", "관광기관 안내", "운영 안내 문서"],
    imageDirection: "축제 현장, 무대, 표지, 사람 흐름, 야간 분위기가 섞인 9패널 콜라주",
    topicAngles: ["최신 일정", "핵심 프로그램", "방문 타이밍", "준비 포인트"],
    closingModes: ["가장 먼저 확인할 것", "방문 추천 시간", "현장 체크리스트"],
    imageScenes: ["festival gate", "main stage", "crowd movement", "food stalls", "night lights", "public transport sign", "map or schedule board", "local street mood", "performance scene"],
  },
  {
    slug: "field-guide",
    name: "행사 현장",
    description: "행사 현장 팁, 교통, 숙박, 동선, 음식까지 실전 가이드를 다루는 카테고리",
    scheduleTime: "15:00",
    scheduleTimezone: DEFAULT_TIMEZONE,
    postCategorySlug: "축제와-현장",
    postCategoryName: "축제와 현장",
    postCategoryDescription: "축제 정보와 현장 운영 가이드를 합쳐 정리하는 기록",
    postCategoryParentSlug: "정보의-기록",
    targetLengthMin: 3300,
    targetLengthMax: 4000,
    targetLengthBand: "3300~4000",
    freshnessMode: "strict",
    audience: "행사 현장에 실제로 가기 전에 동선과 준비를 정리하려는 독자",
    searchIntent: "교통, 숙박, 혼잡도, 맛집, 이동 순서를 현실적으로 알고 싶다.",
    goalQuestion: "현장에 실제로 갔을 때 시간을 덜 버리고 더 잘 움직이려면 무엇을 알아야 하는가?",
    bannedTopics: ["확인되지 않은 셔틀 정보 단정", "맛집 광고", "교통 동선 없는 피상적 소개"],
    voice: "현장 노하우를 압축해서 전달하는 실전형 톤",
    antiPatterns: ["모든 글을 교통-숙박-맛집 고정 순서", "맛집 리스트만 길게 나열", "현장 리스크 누락"],
    sourcePriority: ["공식 행사 안내", "교통기관 안내", "지자체 교통 공지", "현장 운영 정보"],
    imageDirection: "현장 동선, 교통, 숙박, 음식, 혼잡도 힌트가 보이는 9패널 콜라주",
    topicAngles: ["교통 전략", "혼잡 회피", "숙박 선택", "현장 루트"],
    closingModes: ["현장 준비 요약", "교통 우선순위", "방문 전 체크리스트"],
    imageScenes: ["station platform", "wayfinding signs", "hotel district", "street food close-up", "crowd flow", "event entrance", "walking route map", "rest area", "night return trip"],
  },
];

function joinBullets(items: string[]) {
  return items.map((item) => `- ${item}`).join("\n");
}

async function resolveCategoryId(db: D1Database, slug: string) {
  const row = await db
    .prepare("SELECT id FROM categories WHERE slug = ?1 LIMIT 1")
    .bind(slug)
    .first<{ id: string }>();

  return row?.id ?? null;
}

function buildFactRules(seed: CategorySeed) {
  if (seed.freshnessMode === "strict") {
    return [
      "Use the most recent reliable information available as of today.",
      "Prioritize official, primary, or near-primary sources before any secondary commentary.",
      "If a date, price, route, lineup, opening hour, or rule cannot be verified, do not state it as settled fact.",
      "If a festival, event, or exhibition schedule is not confirmed, tell the reader to recheck before booking.",
    ];
  }

  if (seed.freshnessMode === "medium") {
    return [
      "Use current information where it materially changes the reader's understanding.",
      "Prefer official docs, release notes, product announcements, and high-signal reporting.",
      "Do not invent metrics, adoption claims, or rollout details that are not supported.",
    ];
  }

  return [
    "Separate confirmed facts from legend, interpretation, memory, or present-day meaning.",
    "Do not inflate uncertainty into certainty.",
    "If the article becomes more reflective, keep the factual layer clearly intact.",
  ];
}

function buildEditorialStrategy(seed: CategorySeed) {
  return [
    `You are the lead editor for the Cloudflare category "${seed.name}".`,
    "",
    "[CATEGORY IDENTITY]",
    `- Category slug: ${seed.slug}`,
    `- Public post category slug: ${seed.postCategorySlug}`,
    `- Category description: ${seed.description}`,
    `- Primary audience: ${seed.audience}`,
    `- Search intent: ${seed.searchIntent}`,
    `- Core question: ${seed.goalQuestion}`,
    "",
    "[LENGTH]",
    `- All final articles in this category must stay within ${seed.targetLengthMin} to ${seed.targetLengthMax} Korean characters.` ,
    `- Preferred band: ${seed.targetLengthBand} Korean characters.`,
    "",
    "[MODEL ROUTING]",
    "- preferred_discovery_model = gemini",
    "- preferred_article_model = large",
    "- preferred_review_model = small",
    "- preferred_revision_model = small",
    "- preferred_image_prompt_model = small",
    "- Strategy is category-level guidance and must not trigger an extra per-post strategy API call.",
    "",
    "[VOICE]",
    `- Tone: ${seed.voice}`,
    "- The article must feel human, specific, and alive rather than templated or generic.",
    "- Keep SEO+GEO strong, but never at the cost of rhythm or readability.",
    "",
    "[RECENCY AND FACTS]",
    ...buildFactRules(seed).map((line) => `- ${line}`),
    "",
    "[ALLOWED ANGLES]",
    joinBullets(seed.topicAngles),
    "",
    "[DO NOT COVER]",
    joinBullets(seed.bannedTopics),
    "",
    "[ANTI-PATTERN RULES]",
    joinBullets(seed.antiPatterns),
    "",
    "[SOURCE PRIORITY]",
    joinBullets(seed.sourcePriority),
    "",
    "[IMAGE DIRECTION]",
    `- ${seed.imageDirection}`,
    "- The cover image must be a 3x3 collage with nine distinct panels.",
    "",
    "[CLOSING MODES]",
    joinBullets(seed.closingModes),
  ].join("\n");
}

function buildTopicPrompt(seed: CategorySeed) {
  const factRules = buildFactRules(seed).map((line) => `- ${line}`).join("\n");
  return [
    `You are selecting topics for the Cloudflare category "${seed.name}".`,
    `Target audience: ${seed.audience}`,
    `Search intent: ${seed.searchIntent}`,
    `Preferred article length band: ${seed.targetLengthBand} Korean characters.`,
    "",
    "[TOPIC RULES]",
    `- Only suggest topics that match this category identity: ${seed.description}`,
    `- Focus angles:\n${joinBullets(seed.topicAngles)}`,
    `- Ban these topic types:\n${joinBullets(seed.bannedTopics)}`,
    "- Avoid topics that would force a generic explainer with no concrete reader value.",
    "- Each topic should feel timely, specific, and worth publishing today.",
    "",
    "[FACT AND RECENCY RULES]",
    factRules,
    "",
    "[OUTPUT]",
    "Return exactly 5 topic candidates.",
    "For each candidate return:",
    "1. title",
    "2. main_keyword",
    "3. angle",
    "4. why_now",
    "5. fact_checks_to_verify",
    "",
    "Use clean Korean. Do not return explanations outside the candidates.",
  ].join("\n");
}

function buildArticlePrompt(seed: CategorySeed) {
  const factRules = buildFactRules(seed).map((line) => `- ${line}`).join("\n");
  return [
    `You are writing a Cloudflare post for the category "${seed.name}".`,
    `Category slug: ${seed.slug}`,
    `Public post category slug: ${seed.postCategorySlug}`,
    `Audience: ${seed.audience}`,
    `Search intent: ${seed.searchIntent}`,
    `Core question: ${seed.goalQuestion}`,
    "",
    "[MANDATORY LENGTH RULE]",
    `- The final Korean body must be between ${seed.targetLengthMin} and ${seed.targetLengthMax} characters.`,
    `- Aim for the preferred band ${seed.targetLengthBand}.`,
    "- If the draft is shorter than the lower bound, deepen the reporting and context instead of padding.",
    "- If the draft is longer than the upper bound, cut repetition before cutting substance.",
    "",
    "[EDITORIAL RULES]",
    `- Tone: ${seed.voice}`,
    "- Maintain strong SEO+GEO, but never let the structure feel copy-pasted.",
    "- Do not lock the article into a fixed heading order.",
    "- Do not reuse the same introduction style every time.",
    "- Vary sentence length and paragraph density naturally.",
    "- Use the main keyword naturally. Never keyword-stuff.",
    "- Keep the article readable, concrete, and human.",
    "",
    "[FACT AND RECENCY RULES]",
    factRules,
    "",
    "[WHAT THIS CATEGORY SHOULD INCLUDE]",
    joinBullets(seed.topicAngles),
    "",
    "[WHAT THIS CATEGORY MUST AVOID]",
    joinBullets(seed.bannedTopics),
    "",
    "[ANTI-PATTERN RULES]",
    joinBullets(seed.antiPatterns),
    "",
    "[ENDING OPTIONS]",
    `- Close using one of these modes depending on the article: ${seed.closingModes.join(", ")}.`,
    "- Do not use stock conclusions or generic wrap-up language.",
    "",
    "[OUTPUT]",
    "Return the full article only.",
    "Do not include notes, process commentary, or JSON.",
  ].join("\n");
}

function buildImagePrompt(seed: CategorySeed) {
  return [
    `Create a single final cover image for the Cloudflare category "${seed.name}".`,
    `Visual direction: ${seed.imageDirection}`,
    "",
    "[FORMAT]",
    "- 3x3 collage",
    "- single final cover image",
    "- label the composition internally as Panel 1 through Panel 9",
    "- no text overlay",
    "- no logo",
    "- cinematic documentary realism",
    "- cohesive color grading across all panels",
    "",
    "[SCENE GUIDE]",
    joinBullets(seed.imageScenes.map((scene, index) => `Panel ${index + 1}: ${scene}`)),
    "",
    "[RULES]",
    "- Each panel must contribute a different angle of the same article theme.",
    "- Avoid repeating the same shot type across too many panels.",
    "- Make the image specific to the category and topic, not generic wallpaper.",
    `- The image must visually support articles in the ${seed.targetLengthBand} Korean-character depth range by showing breadth, context, and detail.`,
    "",
    "Return one final English image prompt only.",
  ].join("\n");
}

function buildPromptByStage(seed: CategorySeed, stage: PromptCatalogStage) {
  if (stage === "editorial_strategy") {
    return buildEditorialStrategy(seed);
  }

  if (stage === "topic_discovery") {
    return buildTopicPrompt(seed);
  }

  if (stage === "article_generation") {
    return buildArticlePrompt(seed);
  }

  return buildImagePrompt(seed);
}

function toCatalogItem(seed: CategorySeed): PromptCatalogItem {
  return {
    slug: seed.slug,
    name: seed.name,
    description: seed.description,
    scheduleTime: seed.scheduleTime,
    scheduleTimezone: seed.scheduleTimezone,
    selectionWeight: selectionWeightForSlug(seed.slug),
    selectionEnabled: true,
    postCategorySlug: seed.postCategorySlug,
    targetLengthMin: seed.targetLengthMin,
    targetLengthMax: seed.targetLengthMax,
    targetLengthBand: seed.targetLengthBand,
    freshnessMode: seed.freshnessMode,
    preferredDiscoveryModel: "gemini",
    preferredArticleModel: "large",
    preferredReviewModel: "small",
    preferredRevisionModel: "small",
    preferredImagePromptModel: "small",
  };
}

export function listPromptCatalog(): PromptCatalogItem[] {
  return CATEGORY_SEEDS.map(toCatalogItem);
}

async function ensurePromptCategory(db: D1Database, seed: CategorySeed) {
  const now = new Date().toISOString();
  const scheduleTimezone = seed.scheduleTimezone ?? DEFAULT_TIMEZONE;
  const existing = await db
    .prepare("SELECT id FROM prompt_categories WHERE slug = ?1 LIMIT 1")
    .bind(seed.slug)
    .first<{ id: string }>();

  if (existing?.id) {
    await db
      .prepare(
        `
          UPDATE prompt_categories
          SET name = ?2,
              description = ?3,
              status = 'active',
              schedule_time = ?4,
              schedule_timezone = ?5,
              selection_weight = ?6,
              selection_enabled = 1,
              updated_at = ?7
          WHERE id = ?1
        `,
      )
      .bind(
        existing.id,
        seed.name,
        seed.description,
        seed.scheduleTime,
        scheduleTimezone,
        selectionWeightForSlug(seed.slug),
        now,
      )
      .run();
    return existing.id;
  }

  const id = crypto.randomUUID();
  await db
    .prepare(
      `
        INSERT INTO prompt_categories (
          id,
          slug,
          name,
          description,
          status,
          schedule_time,
          schedule_timezone,
          selection_weight,
          selection_enabled,
          created_at,
          updated_at
        ) VALUES (?1, ?2, ?3, ?4, 'active', ?5, ?6, ?7, 1, ?8, ?9)
      `,
    )
    .bind(
      id,
      seed.slug,
      seed.name,
      seed.description,
      seed.scheduleTime,
      scheduleTimezone,
      selectionWeightForSlug(seed.slug),
      now,
      now,
    )
    .run();

  return id;
}

async function ensurePostCategory(db: D1Database, seed: CategorySeed) {
  const now = new Date().toISOString();
  const parentId = seed.postCategoryParentSlug
    ? await resolveCategoryId(db, seed.postCategoryParentSlug)
    : null;
  const existing = await db
    .prepare("SELECT id FROM categories WHERE slug = ?1 LIMIT 1")
    .bind(seed.postCategorySlug)
    .first<{ id: string }>();

  if (existing?.id) {
    await db
      .prepare(
        `
          UPDATE categories
          SET name = ?2,
              description = ?3,
              parent_id = ?4,
              updated_at = ?5
          WHERE id = ?1
        `,
      )
      .bind(existing.id, seed.postCategoryName, seed.postCategoryDescription, parentId, now)
      .run();
    return existing.id;
  }

  const id = crypto.randomUUID();
  await db
    .prepare(
      `
        INSERT INTO categories (id, slug, name, description, parent_id, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
      `,
    )
    .bind(id, seed.postCategorySlug, seed.postCategoryName, seed.postCategoryDescription, parentId, now, now)
    .run();

  return id;
}

export async function syncPromptCatalog(db: D1Database, slugs?: string[]): Promise<PromptCatalogSyncResult> {
  const slugFilter = slugs?.length ? new Set(slugs) : null;
  const targets = slugFilter ? CATEGORY_SEEDS.filter((seed) => slugFilter.has(seed.slug)) : CATEGORY_SEEDS;

  let categoryCount = 0;
  let promptCount = 0;
  let updatedPromptCount = 0;

  for (const seed of targets) {
    await ensurePromptCategory(db, seed);
    await ensurePostCategory(db, seed);
    categoryCount += 1;

    for (const stage of PROMPT_STAGES) {
      const template = await upsertPromptTemplate(db, {
        categorySlug: seed.slug,
        stage,
        content: buildPromptByStage(seed, stage),
      });

      promptCount += 1;
      if (template) {
        updatedPromptCount += 1;
      }
    }
  }

  return {
    categoryCount,
    promptCount,
    updatedPromptCount,
    syncedSlugs: targets.map((seed) => seed.slug),
  };
}
