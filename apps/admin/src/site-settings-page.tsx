import { cloneSiteSettings, type SiteSettings } from "@cloudflare-blog/shared";
import { RotateCcw, Save } from "lucide-react";
import { useEffect, useState } from "react";

import { Input } from "./components/ui/input";
import { Textarea } from "./components/ui/textarea";
import { getAdminSiteSettings, updateAdminSiteSettings } from "./lib/api";
import { Button, ErrorMessage, LoadingPanel, ShellCard } from "./ui";

function SectionIntro(props: { title: string; description: string }) {
  return (
    <div className="space-y-1">
      <h3 className="text-xl font-semibold tracking-tight text-[var(--color-ink)]">{props.title}</h3>
      <p className="text-sm leading-7 text-[var(--color-soft-ink)]">{props.description}</p>
    </div>
  );
}

function SuccessMessage(props: { message: string | null }) {
  return props.message ? (
    <div className="rounded-[24px] border border-emerald-200/80 bg-[linear-gradient(135deg,rgba(236,253,245,0.98),rgba(240,253,250,0.96))] px-4 py-3 text-sm font-medium text-emerald-700 shadow-sm">
      {props.message}
    </div>
  ) : null;
}

export function SiteSettingsPage() {
  const [form, setForm] = useState<SiteSettings>(cloneSiteSettings());
  const [savedForm, setSavedForm] = useState<SiteSettings>(cloneSiteSettings());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    void getAdminSiteSettings()
      .then((settings) => {
        const normalized = cloneSiteSettings(settings);
        setForm(normalized);
        setSavedForm(cloneSiteSettings(settings));
        setError(null);
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, []);

  const handleReset = () => {
    setForm(cloneSiteSettings(savedForm));
    setSuccess(null);
    setError(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const nextSettings = await updateAdminSiteSettings(form);
      const normalized = cloneSiteSettings(nextSettings);
      setForm(normalized);
      setSavedForm(cloneSiteSettings(nextSettings));
      setSuccess("공개 블로그 설정을 저장했습니다.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "사이트 설정 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingPanel message="공개 블로그 설정을 불러오는 중입니다." />;
  }

  return (
    <ShellCard
      title="사이트 설정"
      description="현재 제목과 소개 문구를 그대로 불러오고, 홈/소개/검색 화면의 제목과 소개 문구를 관리자에서 직접 편집할 수 있게 했습니다."
      actions={
        <>
          <Button type="button" variant="outline" onClick={handleReset}>
            <RotateCcw className="h-4 w-4" />
            마지막 저장값으로 되돌리기
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? "저장 중..." : "설정 저장"}
          </Button>
        </>
      }
    >
      <div className="grid gap-8">
        <ErrorMessage message={error} />
        <SuccessMessage message={success} />

        <section className="grid gap-5 rounded-[28px] border border-black/6 bg-white/70 p-5 shadow-sm">
          <SectionIntro
            title="브랜딩"
            description="블로그 이름, 부제, 검색엔진 설명처럼 사이트 전반에 반복 노출되는 문구입니다."
          />
          <div className="grid gap-4 xl:grid-cols-2">
            <label className="block">
              <span className="field-label">블로그 제목</span>
              <Input
                value={form.branding.siteTitle}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    branding: { ...current.branding, siteTitle: event.target.value },
                  }))
                }
              />
            </label>
            <label className="block">
              <span className="field-label">보조 제목</span>
              <Input
                value={form.branding.siteAltName}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    branding: { ...current.branding, siteAltName: event.target.value },
                  }))
                }
              />
            </label>
            <label className="block">
              <span className="field-label">작성자 표기</span>
              <Input
                value={form.branding.siteAuthor}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    branding: { ...current.branding, siteAuthor: event.target.value },
                  }))
                }
              />
            </label>
            <label className="block">
              <span className="field-label">헤더 한 줄 소개</span>
              <Input
                value={form.branding.siteTagline}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    branding: { ...current.branding, siteTagline: event.target.value },
                  }))
                }
              />
            </label>
          </div>
          <label className="block">
            <span className="field-label">기본 SEO 설명</span>
            <Textarea
              rows={3}
              value={form.branding.siteDescription}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  branding: { ...current.branding, siteDescription: event.target.value },
                }))
              }
            />
          </label>
        </section>

        <section className="grid gap-5 rounded-[28px] border border-black/6 bg-white/70 p-5 shadow-sm">
          <SectionIntro
            title="사이드바 소개"
            description="메인 화면 오른쪽 소개 박스에 들어가는 제목과 설명입니다."
          />
          <label className="block">
            <span className="field-label">사이드바 제목</span>
            <Input
              value={form.sidebar.title}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  sidebar: { ...current.sidebar, title: event.target.value },
                }))
              }
            />
          </label>
          <label className="block">
            <span className="field-label">사이드바 설명</span>
            <Textarea
              rows={4}
              value={form.sidebar.description}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  sidebar: { ...current.sidebar, description: event.target.value },
                }))
              }
            />
          </label>
        </section>

        <section className="grid gap-5 rounded-[28px] border border-black/6 bg-white/70 p-5 shadow-sm">
          <SectionIntro
            title="홈 화면"
            description="메인 소개 문구와 인기 글/최신 글 섹션 제목을 조정합니다."
          />
          <div className="grid gap-4 xl:grid-cols-2">
            <label className="block">
              <span className="field-label">홈 눈썹 제목</span>
              <Input
                value={form.home.eyebrow}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    home: { ...current.home, eyebrow: event.target.value },
                  }))
                }
              />
            </label>
            <label className="block">
              <span className="field-label">홈 메인 제목</span>
              <Input
                value={form.home.title}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    home: { ...current.home, title: event.target.value },
                  }))
                }
              />
            </label>
          </div>
          <label className="block">
            <span className="field-label">홈 소개글</span>
            <Textarea
              rows={4}
              value={form.home.description}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  home: { ...current.home, description: event.target.value },
                }))
              }
            />
          </label>
          <div className="grid gap-4 xl:grid-cols-2">
            <label className="block">
              <span className="field-label">인기 글 섹션 제목</span>
              <Input
                value={form.home.featuredTitle}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    home: { ...current.home, featuredTitle: event.target.value },
                  }))
                }
              />
            </label>
            <label className="block">
              <span className="field-label">최신 글 섹션 제목</span>
              <Input
                value={form.home.latestTitle}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    home: { ...current.home, latestTitle: event.target.value },
                  }))
                }
              />
            </label>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <label className="block">
              <span className="field-label">인기 글 섹션 설명</span>
              <Textarea
                rows={3}
                value={form.home.featuredDescription}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    home: { ...current.home, featuredDescription: event.target.value },
                  }))
                }
              />
            </label>
            <label className="block">
              <span className="field-label">최신 글 섹션 설명</span>
              <Textarea
                rows={3}
                value={form.home.latestDescription}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    home: { ...current.home, latestDescription: event.target.value },
                  }))
                }
              />
            </label>
          </div>
        </section>

        <section className="grid gap-5 rounded-[28px] border border-black/6 bg-white/70 p-5 shadow-sm">
          <SectionIntro
            title="검색 화면"
            description="검색 페이지 상단 소개 문구와 검색창 플레이스홀더를 관리합니다."
          />
          <div className="grid gap-4 xl:grid-cols-2">
            <label className="block">
              <span className="field-label">검색 눈썹 제목</span>
              <Input
                value={form.search.eyebrow}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    search: { ...current.search, eyebrow: event.target.value },
                  }))
                }
              />
            </label>
            <label className="block">
              <span className="field-label">검색 메인 제목</span>
              <Input
                value={form.search.title}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    search: { ...current.search, title: event.target.value },
                  }))
                }
              />
            </label>
          </div>
          <label className="block">
            <span className="field-label">검색 소개글</span>
            <Textarea
              rows={4}
              value={form.search.description}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  search: { ...current.search, description: event.target.value },
                }))
              }
            />
          </label>
          <label className="block">
            <span className="field-label">검색창 예시 문구</span>
            <Input
              value={form.search.placeholder}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  search: { ...current.search, placeholder: event.target.value },
                }))
              }
            />
          </label>
        </section>

        <section className="grid gap-5 rounded-[28px] border border-black/6 bg-white/70 p-5 shadow-sm">
          <SectionIntro
            title="소개 화면"
            description="소개 페이지 상단과 본문 핵심 설명, 카테고리 안내 문구를 편집합니다."
          />
          <div className="grid gap-4 xl:grid-cols-2">
            <label className="block">
              <span className="field-label">소개 눈썹 제목</span>
              <Input
                value={form.about.eyebrow}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    about: { ...current.about, eyebrow: event.target.value },
                  }))
                }
              />
            </label>
            <label className="block">
              <span className="field-label">소개 메인 제목</span>
              <Input
                value={form.about.title}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    about: { ...current.about, title: event.target.value },
                  }))
                }
              />
            </label>
          </div>
          <label className="block">
            <span className="field-label">소개 페이지 설명</span>
            <Textarea
              rows={4}
              value={form.about.description}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  about: { ...current.about, description: event.target.value },
                }))
              }
            />
          </label>
          <div className="grid gap-4 xl:grid-cols-2">
            <label className="block">
              <span className="field-label">핵심 안내 제목</span>
              <Input
                value={form.about.featureTitle}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    about: { ...current.about, featureTitle: event.target.value },
                  }))
                }
              />
            </label>
            <label className="block">
              <span className="field-label">카테고리 섹션 제목</span>
              <Input
                value={form.about.categoriesTitle}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    about: { ...current.about, categoriesTitle: event.target.value },
                  }))
                }
              />
            </label>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <label className="block">
              <span className="field-label">핵심 안내 설명</span>
              <Textarea
                rows={4}
                value={form.about.featureDescription}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    about: { ...current.about, featureDescription: event.target.value },
                  }))
                }
              />
            </label>
            <label className="block">
              <span className="field-label">카테고리 섹션 설명</span>
              <Textarea
                rows={4}
                value={form.about.categoriesDescription}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    about: { ...current.about, categoriesDescription: event.target.value },
                  }))
                }
              />
            </label>
          </div>
        </section>
      </div>
    </ShellCard>
  );
}
