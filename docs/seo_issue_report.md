# Google Search Console 색인 생성 오류 보고서

## 1. 메일 원문

보낸사람: Google Search Console Team <sc-noreply@google.com>
받는사람: master
제목: 새로운 이유로 인해 datagongbang.kr 사이트의 페이지에 대한 색인이 생성되지 않습니다

Search Console에서 사이트의 페이지 일부가 다음과 같은 새로운 이유로 색인이 생성되지 않는 것을 확인했습니다.

리디렉션이 포함된 페이지
사용자가 선택한 표준이 없는 중복 페이지

의도치 않은 이유인 경우 영향을 받는 페이지의 색인이 생성되어 Google에 표시되도록 문제를 해결하는 것이 좋습니다.

색인 생성 보고서 열기: https://c.gle/AOPyDKRjvPTsAcJYU5ktq5JcoyATyHI_tpZ3z0EpVeOSVojpgJxVQD-xCbxVHDXTub8FjPAdBCBLPyzc3DISov6ODufqRwz0Kab4mLYpdyKQTRzVyza47Cq5CCScnY5o6fUCasAVxcD26dzYJ1vL7id04FJ0bxcsmjUblvCV_tycQg1_Pai_DteYiU0tSUuXiZSAaA4dFQDkvZ5IuNNG7JCC0q1zcwRdFY37wDCVWSh5ofc-e_DFgjpsmRKNg4Kf67raxNj_nAIyGwqGbNEMyfMN_Kul2BizSLhWyLln1QfCQU8dL1VQIm0_5yB_W1WWUmYr_QU4QB-3lWeyTKzvcG-U67nn930
Message type: [WNC-20237597]

---

## 2. 예상되는 문제점 및 원인 분석

▣ 리디렉션이 포함된 페이지 (Page with redirect)
- 발생 원인: sitemap.xml 파일에 등록된 메인 페이지 주소가 https://datagongbang.kr/index.html 로 되어 있습니다. 하지만 실제로 해당 주소로 접속하면 서버나 호스팅(GitHub Pages 등)의 자동 리디렉션 설정으로 인해 최종적으로 https://datagongbang.kr/ 로 이동합니다.
- 문제점: 구글봇은 sitemap.xml에 적힌 주소를 크롤링하려다가 리디렉션(301 또는 302)을 마주하게 되어, 이를 오류로 판단하고 색인 생성을 건너뛰게 됩니다.

▣ 사용자가 선택한 표준이 없는 중복 페이지 (Duplicate without user-selected canonical)
- 발생 원인 1: 메인 페이지인 index.html 헤더 영역에 대표 주소(Canonical URL)를 정의하는 태그가 누락되어 있습니다. 이로 인해 구글은 루트 주소(/)와 index.html 주소를 서로 다른 중복 페이지로 인식하게 됩니다.
- 발생 원인 2: 블로그 상세글을 동적으로 보여주는 blog-detail.html 페이지에도 canonical 태그가 없습니다. sitemap.xml에는 blog-detail.html?id=ref-03 처럼 파라미터가 포함된 개별 주소들이 들어가 있으나, 페이지 내부에서 어떤 URL이 진짜 대표 주소인지 선언하지 않아 구글이 중복 페이지로 필터링해버립니다.

---

## 3. 해결 방법 및 코드 가이드 (Codex 전달용)

### 수정 1. sitemap.xml 수정
sitemap.xml 내부의 index.html URL을 루트 URL로 변경하여 불필요한 리디렉션 경로를 제거합니다.

- 수정 전:
<loc>https://datagongbang.kr/index.html</loc>

- 수정 후:
<loc>https://datagongbang.kr/</loc>

### 수정 2. index.html 수정
index.html 헤더 영역에 도메인 루트를 표준 주소로 지정하는 canonical 태그를 주입합니다.

- 추가할 코드 위치 (head 영역 내부):
<link rel="canonical" href="https://datagongbang.kr/">

### 수정 3. blog-detail.html 수정
동적 블로그 상세 페이지에 기본 canonical 태그를 정적으로 삽입해 둡니다. (이후 자바스크립트로 파라미터를 조합해 동적 변경)

- 추가할 코드 위치 (head 영역 내부):
<link rel="canonical" id="canonical-link" href="https://datagongbang.kr/blog-detail.html">

### 수정 4. modules/blog-handler.js 수정
blog-detail.html이 동작할 때 URL의 id 파라미터를 읽어 canonical 태그의 주소를 각 포스팅 고유 주소로 실시간 업데이트해 줍니다.

- 수정 위치 (initBlogDetail 함수 내부, document.title 설정 부근):
// F. SEO 및 SNS 공유를 위한 브라우저 타이틀 & 메타 태그 동적 교체
document.title = `${postMeta.title} | 데이터공방 공식 블로그`;
const metaDesc = document.querySelector('meta[name="description"]');
if (metaDesc) {
  metaDesc.setAttribute("content", postMeta.summary);
}

// 대표 주소(canonical) 동적 업데이트 로직 추가
let canonicalLink = document.getElementById("canonical-link");
if (!canonicalLink) {
  canonicalLink = document.querySelector('link[rel="canonical"]');
}
if (canonicalLink) {
  canonicalLink.setAttribute("href", `https://datagongbang.kr/blog-detail.html?id=${postMeta.id}`);
} else {
  const newLink = document.createElement("link");
  newLink.setAttribute("rel", "canonical");
  newLink.setAttribute("id", "canonical-link");
  newLink.setAttribute("href", `https://datagongbang.kr/blog-detail.html?id=${postMeta.id}`);
  document.head.appendChild(newLink);
}
