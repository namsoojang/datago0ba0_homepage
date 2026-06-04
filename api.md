# 외부 API 연동 문서 (api.md)

이 문서는 데이터공방 공식 홈페이지에 연동된 외부 API 및 제3자(Third-party) 스크립트 정보를 관리합니다.

---

## 1. Google Analytics 4 (GA4)

- **호출 주소**: `https://www.googletagmanager.com/gtag/js`
- **용도**: 웹사이트 방문자 수, 유입 경로, 세션 유지 시간, 클릭 이벤트 등 사용자 행동 데이터를 수집 및 통계 확인
- **사용된 파일 위치**: 
  - [index.html](file:///c:/Users/namso/문서/00_데이터공방/00_홈페이지/index.html) (Line 5 ~ 13)
- **파라미터 및 스크립트 예시**:
  ```html
  <!-- Google Analytics (GA4) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-XXXXXXXXXX');
  </script>
  ```
  - `G-XXXXXXXXXX` 영역은 구글 애널리틱스 관리자 페이지에서 발급받은 실제 **측정 ID (Measurement ID)**로 치환하여 사용합니다.

---

## 2. 외부 오픈소스 CDN 및 라이브러리 연동 현황

| 서비스명 | 호출 주소 | 용도 | 사용 파일 |
| :--- | :--- | :--- | :--- |
| **FontAwesome** | `https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css` | 웹 폰트 아이콘 렌더링 | `index.html` |
| **Pretendard Font** | `https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css` | 브랜드명 서체 적용 | `index.html`, `index.css` |
| **GSAP / ScrollTrigger** | `https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/...` | 스크롤 애니메이션 및 카드 인터랙션 | `index.html`, `modules/main.js` |
| **p5.js** | `https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.7.0/p5.min.js` | Hero 영역 제너레이티브 나이테 배경 렌더링 | `index.html`, `modules/main.js` |
