import { useEffect, useRef, useState } from 'react';
import {
  Cookie,
  Activity,
  Gamepad2,
  MapPin,
  Award,
  Sparkles,
  Camera,
  Dumbbell,
  GraduationCap,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { PHOTO_FALLBACKS } from './photoFallbacks';

type Hobby = {
  icon: typeof Cookie;
  title: string;
  desc: string;
  color: string;
};

type Card = {
  id: number;
  icon: typeof Cookie;
  title: string;
  tagline: string;
  color: string;
  situation: string;
  action: string;
  result: string;
  evidence: { label: string; icon: typeof Camera }[];
  photos: string[];
};

function App() {
  const hobbies: Hobby[] = [
    {
      icon: Cookie,
      title: '맛있는 빵과 디저트 먹기',
      desc: '달콤한 건 언제나 옳아요. 맛있는 빵과 디저트를 찾아다니는 걸 좋아해요.',
      color: 'amber',
    },
    {
      icon: Activity,
      title: '달리는 운동 하기',
      desc: '바람을 맞으며 달리는 순간. 머리를 비우고 몸을 움직이는 걸 좋아해요.',
      color: 'emerald',
    },
    {
      icon: Gamepad2,
      title: '게임',
      desc: '몰입해서 즐기는 시간. 새로운 세계를 탐험하고 문제를 풀어가는 게 즐거워요.',
      color: 'sky',
    },
  ];

  // NOTE: 아래 cards 배열(특히 photos 필드)은 인수인계 지침에 따라 수정하지 않았습니다.
  const cards: Card[] = [
    {
      id: 1,
      icon: Cookie,
      title: '맛있는 빵과 디저트 먹기',
      tagline: '달콤함을 찾아 떠나는 미식 탐험',
      color: 'amber',
      situation:
        '주변에 단 것과 빵을 좋아하는 사람이 많았어요. 자연스럽게 빵과 디저트에 관심이 생기기 시작했어요.',
      action:
        '여러 빵집을 직접 찾아다니며 다양한 빵을 먹어보고, 리뷰를 남기며 맛있는 가게를 발굴했어요.',
      result:
        '새로운 가게와 음식에 도전하는 것을 두려워하지 않게 되었고, 디저트를 진심으로 좋아하게 되었어요.',
      evidence: [{ label: '3장의 빵 사진', icon: Camera }],
      photos: [
        'public/images/hobby/KakaoTalk_20260910_200316721.jpg',
        'public/images/hobby/KakaoTalk_20260910_200316721_01.jpg',
        'public/images/hobby/KakaoTalk_20260910_200316721_02.jpg',
      ],
    },
    {
      id: 2,
      icon: Activity,
      title: '달리는 운동 하기',
      tagline: '꾸준히 몸을 움직이는 건강한 습관',
      color: 'emerald',
      situation:
        '실내나 사무 생활만 하면 몸이 금방 굳고 무기력해졌어요. 체력이 떨어지는 걸 실감했어요.',
      action:
        '이를 해결하기 위해 주기적으로 스피닝과 러닝을 시작했어요. 일주일에 몇 번은 꼭 몸을 움직여요.',
      result:
        '주변 또래에 비해 체력과 기운이 좋아졌어요. 운동이 습관이 되고, 활력이 일상에 더해졌어요.',
      evidence: [{ label: '헬스장 스피닝 수업 수강 중', icon: Dumbbell }],
      photos: ['public/images/hobby/KakaoTalk_20260913_231302573.jpg'],
    },
    {
      id: 3,
      icon: Gamepad2,
      title: '게임',
      tagline: '게임에서 시작된 IT의 꿈',
      color: 'sky',
      situation:
        '미디어와 게임 산업이 빠르게 발전하는 상황이었어요. 자연스럽게 다양한 게임을 접하게 되었어요.',
      action:
        '여러 게임을 직접 시작해 즐기면서, 게임이 만들어지고 운영되는 과정에 점점 더 관심이 생겼어요.',
      result:
        '그 관심이 IT 쪽으로 이어져, 현재 SKT 알레프 뉴딜 교육을 수강하며 관련 분야를 배우고 있어요.',
      evidence: [{ label: '현재 SKT 알레프 뉴딜 교육 수강 중', icon: GraduationCap }],
      photos: [
        'public/images/hobby/명일방주_2026-09-12_오후_7_40_50.png',
      ],
    },
  ];

  const introColorMap: Record<string, { bg: string; text: string; ring: string; hover: string; focusRing: string }> = {
    amber: { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-200', hover: 'group-hover:bg-amber-100', focusRing: 'focus-visible:ring-amber-400' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200', hover: 'group-hover:bg-emerald-100', focusRing: 'focus-visible:ring-emerald-400' },
    sky: { bg: 'bg-sky-50', text: 'text-sky-700', ring: 'ring-sky-200', hover: 'group-hover:bg-sky-100', focusRing: 'focus-visible:ring-sky-400' },
  };

  const detailColorMap: Record<
    string,
    { bg: string; text: string; ring: string; accent: string; border: string; soft: string; focusRing: string }
  > = {
    amber: { bg: 'bg-amber-500', text: 'text-amber-700', ring: 'ring-amber-200', accent: 'bg-amber-50', border: 'border-amber-200', soft: 'text-amber-700', focusRing: 'focus-visible:ring-amber-400' },
    emerald: { bg: 'bg-emerald-500', text: 'text-emerald-700', ring: 'ring-emerald-200', accent: 'bg-emerald-50', border: 'border-emerald-200', soft: 'text-emerald-700', focusRing: 'focus-visible:ring-emerald-400' },
    sky: { bg: 'bg-sky-500', text: 'text-sky-700', ring: 'ring-sky-200', accent: 'bg-sky-50', border: 'border-sky-200', soft: 'text-sky-700', focusRing: 'focus-visible:ring-sky-400' },
  };

  // 사진 근거: 전체 사진을 평탄화된 하나의 목록으로 관리해 방향키 이동/라이트박스에 사용
  const allPhotos = cards.flatMap((card) =>
    card.photos.map((photo, i) => ({
      photo,
      title: card.title,
      index: i,
      color: detailColorMap[card.color],
    }))
  );

  // 사진 경로가 깨져서 로드에 실패(onError)하면, 왼쪽 위부터 순서대로
  // PHOTO_FALLBACKS(업로드된 실제 사진 5장)로 채워 넣기 위한 헬퍼
  const handlePhotoError = (idx: number) => (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    img.onerror = null; // 대체 이미지도 실패할 경우 무한 루프 방지
    img.src = PHOTO_FALLBACKS[idx % PHOTO_FALLBACKS.length];
  };

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const photoRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const openLightbox = (idx: number, trigger: HTMLButtonElement) => {
    lastTriggerRef.current = trigger;
    setLightboxIndex(idx);
  };

  const closeLightbox = () => {
    setLightboxIndex(null);
    lastTriggerRef.current?.focus();
  };

  // 사진 배치가 원본 비율 기반이므로, 방향키는 화면상 가장 가까운 사진으로 이동합니다.
  const handlePhotoGridKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
    let nextIdx: number | null = null;
    if (['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      e.preventDefault();
      const current = photoRefs.current[idx];
      const currentRect = current?.getBoundingClientRect();

      if (currentRect) {
        const currentX = currentRect.left + currentRect.width / 2;
        const currentY = currentRect.top + currentRect.height / 2;
        const candidates = photoRefs.current.flatMap((el, candidateIdx) => {
          if (!el || candidateIdx === idx) return [];
          const rect = el.getBoundingClientRect();
          const dx = rect.left + rect.width / 2 - currentX;
          const dy = rect.top + rect.height / 2 - currentY;
          let primaryDistance: number;
          let secondaryDistance: number;

          if (e.key === 'ArrowRight' && dx > 1) {
            primaryDistance = dx;
            secondaryDistance = Math.abs(dy);
          } else if (e.key === 'ArrowLeft' && dx < -1) {
            primaryDistance = Math.abs(dx);
            secondaryDistance = Math.abs(dy);
          } else if (e.key === 'ArrowDown' && dy > 1) {
            primaryDistance = dy;
            secondaryDistance = Math.abs(dx);
          } else if (e.key === 'ArrowUp' && dy < -1) {
            primaryDistance = Math.abs(dy);
            secondaryDistance = Math.abs(dx);
          } else {
            return [];
          }

          return [{ idx: candidateIdx, score: primaryDistance + secondaryDistance * 1.5 }];
        }).sort((a, b) => a.score - b.score);

        nextIdx = candidates[0]?.idx ?? (
          e.key === 'ArrowRight' || e.key === 'ArrowDown'
            ? (idx + 1) % allPhotos.length
            : (idx - 1 + allPhotos.length) % allPhotos.length
        );
      }
    } else if (e.key === 'Home') {
      nextIdx = 0;
    } else if (e.key === 'End') {
      nextIdx = allPhotos.length - 1;
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openLightbox(idx, e.currentTarget);
      return;
    }
    if (nextIdx !== null) {
      e.preventDefault();
      photoRefs.current[nextIdx]?.focus();
    }
  };

  // 라이트박스가 열리면 닫기 버튼으로 포커스 이동, Esc로 닫기, 좌우 화살표로 사진 전환
  useEffect(() => {
    if (lightboxIndex === null) return;
    closeButtonRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeLightbox();
      } else if (e.key === 'ArrowRight') {
        setLightboxIndex((cur) => (cur === null ? cur : (cur + 1) % allPhotos.length));
      } else if (e.key === 'ArrowLeft') {
        setLightboxIndex((cur) => (cur === null ? cur : (cur - 1 + allPhotos.length) % allPhotos.length));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightboxIndex]);

  return (
    <div className="min-h-screen bg-stone-50 text-stone-800 font-sans overflow-x-hidden">
      {/* 넓은 화면에서 좌우 빈 공간을 채우는 장식 — 브라우저 폭이 줄면 자동으로 줄어들다 사라짐 */}
      <div
        aria-hidden="true"
        className="fixed inset-y-0 left-0 -z-10 overflow-hidden pointer-events-none"
        style={{ width: 'max(0px, calc((100vw - 72rem) / 2))' }}
      >
        <div className="absolute top-[8%] left-1/2 -translate-x-1/2 w-64 h-64 rounded-full bg-amber-200 blur-3xl opacity-[0.18]" />
        <div className="absolute top-[42%] left-1/2 -translate-x-1/2 w-72 h-72 rounded-full bg-emerald-200 blur-3xl opacity-[0.18]" />
        <div className="absolute top-[78%] left-1/2 -translate-x-1/2 w-56 h-56 rounded-full bg-sky-200 blur-3xl opacity-[0.18]" />
      </div>
      <div
        aria-hidden="true"
        className="fixed inset-y-0 right-0 -z-10 overflow-hidden pointer-events-none"
        style={{ width: 'max(0px, calc((100vw - 72rem) / 2))' }}
      >
        <div className="absolute top-[14%] left-1/2 -translate-x-1/2 w-56 h-56 rounded-full bg-sky-200 blur-3xl opacity-[0.18]" />
        <div className="absolute top-[48%] left-1/2 -translate-x-1/2 w-72 h-72 rounded-full bg-amber-200 blur-3xl opacity-[0.18]" />
        <div className="absolute top-[82%] left-1/2 -translate-x-1/2 w-64 h-64 rounded-full bg-emerald-200 blur-3xl opacity-[0.18]" />
      </div>

      {/* Hero — compact */}
      <header className="relative overflow-hidden bg-gradient-to-b from-white to-stone-50">
        <div className="absolute inset-0 opacity-[0.07]">
          <div className="absolute top-4 left-1/4 w-40 h-40 rounded-full bg-amber-300 blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-56 h-56 rounded-full bg-sky-200 blur-3xl" />
        </div>
        <div className="relative max-w-6xl mx-auto px-6 pt-6 pb-4 text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-100 text-xs text-stone-600 mb-3">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Personal Profile
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-stone-900 mb-1.5">
            안녕하세요, 저를 간단히 소개할게요
          </h1>
          <p className="text-sm text-stone-600 max-w-xl mx-auto">
            타인에게 내 취미가 무엇인지 소개하기 위한 웹사이트
          </p>
        </div>
      </header>

      {/* 공개 범위 */}
      <section className="max-w-6xl mx-auto px-6 pt-3 pb-1">
        <div className="grid gap-2.5 lg:grid-cols-2">
          <VisibilityPanel
            title="공개할 것"
            description="사람들과 나누고 싶은 정보"
            items={['취미', '취향', '근황']}
            tone="public"
          />
          <VisibilityPanel
            title="공개하지 않을 것"
            description="개인적인 보호가 필요한 정보"
            items={['민감 정보', '불호', '소속 기관']}
            tone="private"
          />
        </div>
      </section>

      {/* 소개 — Hobby intro cards */}
      <section className="max-w-6xl mx-auto px-6 pt-2 pb-2">
        <div className="flex items-center gap-2 mb-2">
          <h2 className="text-sm font-bold text-stone-900">제가 좋아하는 것들</h2>
          <span className="text-xs text-stone-600">이런 것들이 저를 즐겁게 해요</span>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-3">
          {hobbies.map((hobby, i) => {
            const Icon = hobby.icon;
            const c = introColorMap[hobby.color];
            return (
              <div
                key={i}
                tabIndex={0}
                role="group"
                aria-label={`${hobby.title}: ${hobby.desc}`}
                className={`group bg-white rounded-xl p-3.5 shadow-sm ring-1 ${c.ring} transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 cursor-pointer outline-none focus-visible:ring-2 ${c.focusRing} focus-visible:shadow-md focus-visible:-translate-y-0.5`}
              >
                <div className="flex items-center gap-2.5 mb-1.5">
                  <div className={`w-9 h-9 rounded-lg ${c.bg} ${c.hover} group-focus-visible:bg-opacity-100 flex items-center justify-center transition-colors duration-300 flex-shrink-0`}>
                    <Icon className={`w-5 h-5 ${c.text}`} />
                  </div>
                  <h3 className="text-sm font-bold text-stone-900 leading-tight">{hobby.title}</h3>
                </div>
                <p className="text-xs text-stone-600 leading-snug">{hobby.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 활동 + 근거 — SAR cards */}
      <section className="max-w-6xl mx-auto px-6 pt-2 pb-3">
        <div className="flex items-center gap-2 mb-2">
          <h2 className="text-sm font-bold text-stone-900">상황 · 행동 · 결과로 보는 저</h2>
          <span className="text-xs text-stone-600">각 항목에는 근거도 함께 남겼어요</span>
        </div>
        <div className="space-y-2.5">
          {cards.map((card) => {
            const c = detailColorMap[card.color];
            const Icon = card.icon;
            return (
              <div
                key={card.id}
                tabIndex={0}
                role="group"
                aria-label={`${card.title}. 상황: ${card.situation} 행동: ${card.action} 결과: ${card.result}`}
                className={`bg-white rounded-xl shadow-sm ring-1 ring-stone-200 overflow-hidden transition-shadow duration-300 hover:shadow-md cursor-pointer outline-none focus-visible:ring-2 ${c.focusRing} focus-visible:shadow-md`}
              >
                <div className="flex flex-col lg:flex-row">
                  {/* Card title */}
                  <div className={`lg:w-44 flex-shrink-0 px-4 py-3 ${c.accent} lg:border-r ${c.border} flex lg:flex-col items-center lg:items-start gap-2.5 lg:gap-1.5`}>
                    <div className={`w-9 h-9 rounded-lg ${c.bg} flex items-center justify-center flex-shrink-0`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <span className={`text-[10px] font-bold ${c.text} px-1.5 py-0.5 rounded-full ${c.accent} border ${c.border}`}>
                        {card.id} / 3
                      </span>
                      <h3 className="text-sm font-bold text-stone-900 leading-tight mt-0.5">{card.title}</h3>
                      <p className={`text-xs ${c.soft} leading-tight`}>{card.tagline}</p>
                    </div>
                  </div>

                  {/* SAR columns */}
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-3">
                    <CompactSar label="상황" num="01" text={card.situation} color={c} isFirst />
                    <CompactSar label="행동" num="02" text={card.action} color={c} />
                    <CompactSar label="결과" num="03" text={card.result} color={c} />
                  </div>

                  {/* Evidence */}
                  <div className="lg:w-40 flex-shrink-0 px-4 py-3 bg-stone-50 border-t lg:border-t-0 lg:border-l border-stone-200 flex flex-col justify-center gap-1.5">
                    <span className="text-xs font-semibold text-stone-700 flex items-center gap-1">
                      <Award className="w-3.5 h-3.5 text-stone-600" />
                      근거
                    </span>
                    {card.evidence.map((ev, i) => {
                      const EvIcon = ev.icon;
                      return (
                        <span
                          key={i}
                          className={`inline-flex items-center gap-1 text-xs ${c.text} bg-white px-2 py-1 rounded-full ring-1 ${c.ring} w-fit`}
                        >
                          <EvIcon className="w-3.5 h-3.5" />
                          {ev.label}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 사진 근거 — 버튼화: Tab 포커스, 방향키 이동, 클릭/Enter로 확대 */}
      <section className="max-w-6xl mx-auto px-6 py-4">
        <div className="flex items-center gap-1.5 mb-3 text-sm text-stone-600">
          <Camera className="w-4 h-4" />
          <span>사진 근거</span>
          <span className="text-xs text-stone-600">(탭으로 이동, 방향키로 탐색, Enter로 확대)</span>
        </div>
        <div className="columns-2 sm:columns-3 lg:columns-5 gap-3 sm:gap-4">
          {allPhotos.map((item, idx) => (
            <button
              key={idx}
              type="button"
              ref={(el) => (photoRefs.current[idx] = el)}
              onClick={(e) => openLightbox(idx, e.currentTarget)}
              onKeyDown={(e) => handlePhotoGridKeyDown(e, idx)}
              aria-label={`${item.title} 사진 ${item.index + 1}, 확대해서 보기`}
              className={`relative inline-block w-full mb-3 sm:mb-4 break-inside-avoid rounded-lg overflow-hidden group cursor-pointer ring-1 ring-stone-200 outline-none focus-visible:ring-2 ${item.color.focusRing} focus-visible:ring-offset-2`}
            >
              <img
                src={item.photo}
                onError={handlePhotoError(idx)}
                alt={`${item.title} 사진 ${item.index + 1}`}
                loading="lazy"
                className="block w-full h-auto object-contain bg-stone-100"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity" />
              <div className="absolute bottom-2 left-2 text-xs font-medium opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity">
                <span className={`px-1.5 py-0.5 rounded ${item.color.text} bg-white/90`}>{item.title}</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* 라이트박스 */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`${allPhotos[lightboxIndex].title} 사진 확대 보기`}
          onClick={closeLightbox}
        >
          <button
            ref={closeButtonRef}
            type="button"
            onClick={closeLightbox}
            aria-label="닫기"
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <X className="w-6 h-6" />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxIndex((idx) => (idx === null ? idx : (idx - 1 + allPhotos.length) % allPhotos.length));
            }}
            aria-label="이전 사진"
            className="absolute left-3 sm:left-6 text-white/80 hover:text-white p-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <ChevronLeft className="w-8 h-8" />
          </button>

          <figure className="max-w-3xl max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
            <img
              src={allPhotos[lightboxIndex].photo}
              onError={handlePhotoError(lightboxIndex)}
              alt={`${allPhotos[lightboxIndex].title} 사진 ${allPhotos[lightboxIndex].index + 1}`}
              className="max-w-full max-h-[75vh] object-contain rounded-lg mx-auto"
            />
            <figcaption className="text-center text-white/90 text-sm mt-3">
              {allPhotos[lightboxIndex].title}
            </figcaption>
          </figure>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxIndex((idx) => (idx === null ? idx : (idx + 1) % allPhotos.length));
            }}
            aria-label="다음 사진"
            className="absolute right-3 sm:right-6 text-white/80 hover:text-white p-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <ChevronRight className="w-8 h-8" />
          </button>
        </div>
      )}

      <Footer />
    </div>
  );
}

export default App;

function VisibilityPanel({
  title,
  description,
  items,
  tone,
}: {
  title: string;
  description: string;
  items: string[];
  tone: 'public' | 'private';
}) {
  const isPublic = tone === 'public';
  return (
    <div
      tabIndex={0}
      role="group"
      aria-label={`${title}: ${items.join(', ')}`}
      className={`rounded-xl px-4 py-2.5 cursor-pointer transition-shadow duration-300 hover:shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-stone-400 focus-visible:ring-offset-2 ${isPublic ? 'bg-emerald-50 ring-1 ring-emerald-200' : 'bg-stone-100 ring-1 ring-stone-200'}`}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h2 className={`text-sm font-bold ${isPublic ? 'text-emerald-800' : 'text-stone-700'}`}>{title}</h2>
        <span className={`text-xs ${isPublic ? 'text-emerald-700' : 'text-stone-600'}`}>{description}</span>
        <div className="flex flex-wrap gap-1.5 ml-auto">
          {items.map((item) => (
            <span
              key={item}
              className={`px-2 py-1 rounded-full text-xs font-medium ${isPublic ? 'bg-white text-emerald-700 ring-1 ring-emerald-200' : 'bg-white text-stone-600 ring-1 ring-stone-200'}`}
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function CompactSar({
  label,
  num,
  text,
  color,
  isFirst,
}: {
  label: string;
  num: string;
  text: string;
  color: { text: string };
  isFirst?: boolean;
}) {
  return (
    <div className={`px-3.5 py-2.5 ${!isFirst ? 'sm:border-l border-stone-100' : ''} border-t sm:border-t-0 border-stone-100`}>
      <div className="flex items-baseline gap-1.5 mb-1">
        <span className={`text-base font-bold ${color.text}`}>{num}</span>
        <span className="text-xs font-bold text-stone-900">{label}</span>
      </div>
      <p className="text-xs text-stone-600 leading-snug">{text}</p>
    </div>
  );
}

function Footer() {
  return (
    <footer className="bg-stone-100 border-t border-stone-200">
      <div className="max-w-6xl mx-auto px-6 py-5 text-center">
        <div className="flex items-center justify-center gap-2 text-stone-600 mb-1">
          <MapPin className="w-3.5 h-3.5" />
          <span className="text-xs">Personal Profile</span>
        </div>
        <p className="text-xs text-stone-600">배우고, 적응하며, 결과물을 만들어가는 중</p>
      </div>
    </footer>
  );
}
