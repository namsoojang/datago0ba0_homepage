# 데이터공방 디자인 시스템 가이드 (Design System Guide)

본 가이드는 데이터공방(DATAGO0BA0) 공식 홈페이지의 비주얼 일관성과 프리미엄 브랜드 이미지를 유지하기 위해 정의된 디자인 시스템 사양서입니다.

---

## 1. 색상 시스템 (Color Palette)

데이터공방의 브랜드 가치인 **"전문성(대기업 HRD 신뢰)"**과 **"실무 실천성(AI/Data 기술력)"**을 균형 있게 표현하기 위해 두 가지 포인트 테마 컬러 시스템을 제공합니다.

### 1) 기본 배경 (Backgrounds)
* **메인 딥블루 (Deep Navy)**: `#060B19`
  - 깊고 신뢰감 있는 분위기를 자아내며, 컨텐츠 카드 요소가 돋보이도록 하는 바탕 컬러입니다.
* **배경 그라데이션 (Radial Gradient)**:
  - `radial-gradient(circle at 50% 30%, #0d162d 0%, #060b19 70%)`
  - 화면 중앙 상단에서 퍼져나가는 부드러운 하이라이트 효과로 공간감을 선사합니다.

### 2) A안 - 로얄 골드 테마 (Royal Gold) (현재 기본 활성화)
명품 제안서와 같은 클래식하고 차분하며 고급스러운 교육 전문가의 가치를 상징합니다.
* **대표 골드 (Primary Gold)**: `#C5A880` (RGB: `197, 168, 128`)
* **포인트 골드 (Accent Gold)**: `#E5C158` (RGB: `229, 193, 88`)
* **어두운 골드 (Dark Gold)**: `#9E7D55`

### 3) B안 - 세이지 틸 테마 (Sage Teal) (테마 스위처로 전환 가능)
지적이고 트렌디하며 데이터 사이언스 및 인공지능(AI/AX) 기술 혁신의 역동성을 보여줍니다.
* **대표 틸 (Primary Teal)**: `#00A896` (RGB: `0, 168, 150`)
* **포인트 틸 (Accent Teal)**: `#02C39A` (RGB: `2, 195, 154`)
* **어두운 틸 (Dark Teal)**: `#028090`

### 4) 중성 색상 (Neutrals)
* **기본 본문 텍스트 (Primary Text)**: `#F8FAFC`
* **보조 텍스트 (Secondary Text)**: `#94A3B8`
* **비활성/설명 텍스트 (Muted Text)**: `#64748B`

---

## 2. 타이포그래피 (Typography)

| 적용 대상 | 글꼴 패밀리 (Font Family) | 두께 (Weight) | 특징 |
| :--- | :--- | :--- | :--- |
| **영문 타이틀, 숫자 지표** | `'Outfit'` | 700, 800 | 모던하고 볼드한 기하학적 폰트 |
| **국문 제목 및 본문** | `'Noto Sans KR'`, `'Inter'` | 400, 500, 700 | 깔끔하고 정돈된 가독성 중심 폰트 |

### 자간 및 가독성 규칙
* 한글 줄바꿈 시 글자가 어설프게 잘리지 않도록 글로벌 단위(`*`)로 `word-break: keep-all; overflow-wrap: break-word;`를 준수합니다.
* 타이틀 자간(Letter-spacing)은 `-0.02em`에서 `-0.03em`으로 음수 값을 부여하여 밀도감 있는 visual을 제공합니다.

---

## 3. UI 및 글래스모피즘 토큰 (UI Components & Glassmorphism)

데이터공방의 카드 요소들은 은은하게 반투명하면서 빛나는 현대적 **글래스모피즘** 양식을 따릅니다.
* **카드 배경 (Card BG)**: `rgba(15, 23, 42, 0.55)` (어두운 반투명 유리 느낌)
* **배경 블러 (Backdrop Filter)**: `blur(16px)`
* **테두리 보더 (Card Border)**: `rgba(255, 255, 255, 0.05)`
* **호버 테두리 (Hover Border)**: `rgba(var(--accent-teal-rgb), 0.4)` (테마 포인트 컬러로 빛남)
* **글로우 효과 (Shadow Glow)**: `0 0 25px rgba(var(--accent-teal-rgb), 0.25)`

---

## 4. 모션 및 인터랙션 토큰 (Motion & Interaction)

1. **Hero Entrance (페이드인 타임라인)**:
   - GSAP 타임라인을 사용하여 `.hero-tag`, `.hero-title span`, `.hero-description`, `.hero-buttons`, `.hero-profile-card` 순서대로 각각 0.12초~0.15초의 Stagger 딜레이를 두고 아래에서 위로 부드럽게 연출합니다 (`duration: 0.8s`, `ease: power3.out`).
2. **입체 마우스 패럴랙스 (Mouse Parallax)**:
   - 데스크탑 마우스 이동에 따라 히어로 카드 및 배경 그래픽 요소가 대칭 이동합니다.
   - 카드 최대 기울기: `rotateY: x * 8deg`, `rotateX: -y * 8deg`.
3. **후기 슬라이더 드래그 동작 (Drag Swipe)**:
   - 데스크탑 마우스 및 모바일 터치를 모두 지원합니다.
   - 스와이프 트리거 임계값: 좌우 드래그 이동 거리가 **60px**을 초과할 때 슬라이드가 이동하며, 미만일 경우 원래 위치로 스냅 백(탄성 복구)합니다.
4. **테마 실시간 스위칭**:
   - `body`에 `theme-teal` 클래스가 토글될 때, `transition: background-color 0.4s ease, color 0.3s ease;`를 통해 부드럽게 배경색과 하이라이트 글로우 색상이 물듭니다.
