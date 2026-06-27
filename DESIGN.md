---
version: 1.0
name: datagongbang-design-system
description: 데이터공방 공식 홈페이지와 RPA 도구 화면을 일관되게 만들기 위한 에이전트용 디자인 시스템 문서. 딥 네이비 기반의 프리미엄 B2B 교육 브랜드와, 흰 배경 기반의 실무 도구/콘텐츠 화면을 하나의 토큰 체계로 관리한다.
source_files:
  - index.css
  - modules/tiff-converter.css
  - modules/blog.css
  - modules/toast.css
---

# 데이터공방 DESIGN.md

## 1. Visual Theme & Atmosphere

데이터공방은 "현업을 이해하는 데이터/AI 교육 파트너"로 보여야 한다. 메인 랜딩은 깊은 네이비 배경, 로얄 골드 포인트, 글래스 패널, 실제 강의/프로필 이미지를 사용해 신뢰감과 전문성을 만든다. RPA 도구, 블로그, 개인정보 처리방침 같은 읽기/작업 중심 화면은 순백색 라이트 테마를 기본으로 하며, 세이지 틸을 실행 가능 상태와 인터랙션의 신호로 사용한다.

핵심 인상은 프리미엄, 실무적, 또렷함이다. 과장된 스타트업식 장식보다 교육 담당자와 실무자가 빠르게 판단할 수 있는 정보 구조를 우선한다.

## 2. Color Palette & Roles

### Dark Brand Theme

| Token | Hex / Value | Role |
|---|---:|---|
| `--color-brand-navy-950` | `#060B19` | 메인 홈페이지 최심부 배경 |
| `--color-brand-navy-900` | `#080E1E` | 헤더, 딥 섹션 배경 |
| `--color-brand-navy-800` | `#0D162D` | 라디얼 배경 하이라이트 |
| `--color-gold` | `#E5C158` | 메인 강조, CTA hover, 중요 숫자 |
| `--color-gold-muted` | `#C5A880` | 기본 CTA, 로고 심볼 톤 |
| `--color-gold-deep` | `#9E7D55` | 골드의 어두운 상태 |
| `--text-primary` | `#F8FAFC` | 다크 테마 제목/주요 텍스트 |
| `--text-secondary` | `#94A3B8` | 다크 테마 본문 |
| `--text-muted` | `#64748B` | 보조 설명, 푸터, 비활성 |
| `--card-bg` | `rgba(15, 23, 42, 0.55)` | 글래스 카드 배경 |
| `--card-border` | `rgba(255, 255, 255, 0.05)` | 글래스 카드 경계 |

### Light Utility Theme

| Token | Hex | Role |
|---|---:|---|
| `--color-surface` | `#FFFFFF` | RPA/블로그 기본 배경 |
| `--color-surface-soft` | `#F8FAFC` | 보조 섹션, 빈 상태, 코드 외부 |
| `--color-line` | `#E2E8F0` | 라이트 테마 카드/입력 경계 |
| `--color-line-soft` | `#F1F5F9` | 구분선, 카드 내부 경계 |
| `--color-ink-900` | `#0F172A` | 라이트 테마 제목 |
| `--color-ink-800` | `#1E293B` | 강한 본문 |
| `--color-ink-700` | `#334155` | 내비게이션/보조 제목 |
| `--color-ink-600` | `#475569` | 본문 |
| `--color-ink-500` | `#64748B` | 보조 텍스트 |
| `--color-ink-400` | `#94A3B8` | placeholder, 광고 라벨 |

### Functional Colors

| Token | Hex | Role |
|---|---:|---|
| `--color-teal` | `#00A896` | 실행 가능, 링크, 라이트 CTA |
| `--color-teal-bright` | `#02C39A` | hover, focus, active state |
| `--color-info` | `#3B82F6` | 진행 중 |
| `--color-warning` | `#F59E0B` | 주의, 대기 |
| `--color-danger` | `#EF4444` | 오류, 삭제, 필수 경고 |

## 3. Typography Rules

| Token | Family | Size | Weight | Line Height | Use |
|---|---|---:|---:|---:|---|
| `--font-title` | Outfit, Noto Sans KR, sans-serif | `clamp(1.85rem, 4.5vw, 3.25rem)` | 800 | 1.35 | 메인 히어로 |
| section title | Outfit, Noto Sans KR, sans-serif | `clamp(2rem, 4vw, 2.75rem)` | 700 | 1.25 | 섹션 제목 |
| card title | Outfit, Noto Sans KR, sans-serif | `1.25rem` | 700 | 1.35 | 카드/패널 제목 |
| body-lg | Inter, Noto Sans KR, sans-serif | `1.05rem-1.2rem` | 400 | 1.7 | 히어로 설명 |
| body-md | Inter, Noto Sans KR, sans-serif | `1rem` | 400 | 1.6 | 기본 본문 |
| body-sm | Inter, Noto Sans KR, sans-serif | `0.9rem` | 400/500 | 1.6 | 카드 설명, 보조 설명 |
| label | Inter, Noto Sans KR, sans-serif | `0.85rem` | 600 | 1.4 | 폼 라벨, 배지 |

Korean text must use `word-break: keep-all` and `overflow-wrap: break-word`. Headline letter spacing can be slightly tight in existing CSS, but new compact UI must keep `letter-spacing: 0` unless matching the existing hero/title treatment.

## 4. Layout Principles

| Token | Value | Role |
|---|---:|---|
| `--max-width` | `1200px` | 기본 콘텐츠 컨테이너 |
| `.container` gutter | `24px` | 모바일/데스크톱 좌우 여백 |
| `--nav-height` | `80px` | 고정 헤더 높이 |
| `--space-section` | `120px` | 메인 랜딩 섹션 상하 패딩 |
| `--space-16` | `64px` | 섹션 내부 큰 간격 |
| `--space-8` | `32px` | 카드/패널 기본 패딩 |
| `--space-6` | `24px` | 컨테이너/카드 중간 간격 |

메인 랜딩은 넓은 섹션 리듬과 이미지/카드의 교차 구조를 사용한다. 도구 화면은 작업 효율을 위해 2컬럼 패널 또는 3컬럼 카드 그리드를 사용하되, 모바일에서는 1컬럼으로 무조건 접는다.

## 5. Component Stylings

### Buttons

Primary buttons use 8px radius, 14px/28px padding, 600 weight, icon plus label. Dark brand theme primary is gold. Light utility theme primary is teal. Hover moves up `translateY(-2px)` and uses glow/shadow.

Secondary buttons are transparent or white with a clear 1px border. Destructive actions use `--color-danger`; do not style destructive actions with gold or teal.

### Cards & Panels

Dark landing cards use glassmorphism: `--card-bg`, `--card-border`, `backdrop-filter: blur(16px)`, `--border-radius-md` (16px). Image wrappers and compact controls use `--border-radius-sm` (8px). Large editorial containers can use `--border-radius-lg` (24px), but repeated cards should stay at 16px or below.

Light cards use white backgrounds, `#E2E8F0` borders, and restrained shadows. Blog cards and RPA cards should not rely only on shadow; keep borders visible.

### Forms

Inputs are 44px high, 8px radius, inherited font, and a visible focus ring. Labels are 0.85rem / 600. Required indicators use `--color-danger`. Browser-local tools should clearly distinguish disabled, ready, processing, success, and error states with both color and text.

### Badges

Use small rectangular badges with 4px to 6px radius. `실행 가능` and active categories use teal; `준비 중` uses muted gray/ink; high-value marketing badges may use gold.

### Navigation

Header is fixed and 80px tall, shrinking to 70px when scrolled. Desktop nav uses text links with an underline active state. Mobile uses the existing menu toggle. New pages should keep Home/About/Why Us/Curriculum/References/Contact/RPA/Blog ordering unless there is a product reason to change it.

## 6. Depth & Motion

Use motion to clarify state, not to decorate every element. Existing patterns:

- Hero entrance and scroll reveals through GSAP.
- Card hover lift: `translateY(-2px)` for buttons, `translateY(-6px)` for cards.
- Background p5/canvas and blurred shapes stay behind content and must not reduce text contrast.
- Respect `prefers-reduced-motion` when adding new motion-heavy components.

Shadows:

- `--shadow-sm`: buttons and light hover states.
- `--shadow-lg`: glass cards and modals.
- `--shadow-glow`: primary accent hover only.

## 7. Responsive Behavior

Breakpoints already used in the project:

- `768px`: cards and blog grids collapse to one column.
- `992px`: converter panels change from one column to two columns.
- `1024px`: RPA cards become three columns.

Touch targets should be at least 44px high. Inline styles for width, padding, border radius, and colors should be avoided in new work; add reusable classes or tokens instead.

## 8. Do's and Don'ts

Do:

- Use actual photos, logos, book covers, tool states, and screenshots where they help trust.
- Prefer the semantic CSS aliases in `:root` for new UI.
- Use gold for the premium education brand and teal for tools, execution, active states, and links.
- Keep B2B information dense but scannable.
- Keep Korean line breaks natural with `word-break: keep-all`.

Don't:

- Mix gold and teal as equal competing primary CTAs on one screen.
- Add new npm dependencies for styling without approval.
- Create new one-off hex colors when an existing token works.
- Put cards inside cards or make whole page sections look like floating cards.
- Use decorative gradient blobs/orbs beyond the existing subtle background system.
- Use pill buttons as the default CTA style; this site uses 8px rectangular buttons.

## 9. Agent Prompt Guide

When building a new 데이터공방 page, follow this brief:

> Build in the 데이터공방 design system. Use a dark navy/gold premium brand surface for marketing or instructor credibility pages, and a white/teal utility surface for tools, blog, and reading workflows. Use Outfit for titles, Inter/Noto Sans KR for body, 1200px containers, 8px buttons, 16px cards, visible borders, and restrained hover lift. Avoid new colors and inline styles; use `DESIGN.md` and the CSS variables in `index.css`.

## 10. Open Decisions

These need owner/user decision before broad refactoring:

1. Primary accent policy: keep the current split of gold for premium education and teal for tools, or return the entire site to teal.
2. Font loading policy: continue Google Fonts/CDN loading, or self-host fonts for speed and privacy.
3. Inline style cleanup depth: leave existing inline styles for stability, or migrate them into reusable classes page by page.
4. Preview catalog: create an `design-preview.html` visual catalog like awesome-design-md examples, or keep `DESIGN.md` plus live pages as the source of truth.
