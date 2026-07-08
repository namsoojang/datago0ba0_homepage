# Google Search Console 색인 생성 오류 개선안 재검토 요청

## 검토 결론

기존 분석 방향은 대체로 맞습니다.

- `sitemap.xml`의 메인 URL이 `https://datagongbang.kr/index.html`로 되어 있어 `/`로 리디렉션될 가능성이 있음
- `index.html`에 canonical 태그가 없음
- `blog-detail.html?id=...` 상세 페이지에 canonical 선언이 없어 중복 페이지로 판단될 수 있음

다만 아래 항목까지 함께 반영하는 것이 더 안전해 보입니다.

## 주요 Findings

### P1. `blog-detail.html` canonical을 JS로만 바꾸는 것은 한계가 있음

현재 블로그 상세 페이지는 하나의 `blog-detail.html`에서 `id` 파라미터를 읽고, `modules/blog-handler.js`가 `posts.json`과 마크다운 파일을 fetch해서 본문을 렌더링합니다.

Google이 JS 렌더링을 지원하긴 하지만, canonical은 가능하면 초기 HTML에 포함되는 것이 더 안정적입니다.

다만 GitHub Pages 기반 정적 사이트라면 현실적으로 다음 방식은 유효한 보완책입니다.

- `blog-detail.html`에 기본 canonical 추가
- JS 실행 후 `id` 파라미터 기반 canonical로 즉시 교체

완전한 해결책은 글별 정적 HTML 생성입니다.

### P1. `sitemap.xml`이 현재 글 목록과 맞지 않음

현재 `data/posts.json`에는 아래 글들이 존재합니다.

- `ref-03`
- `ref-04`
- `ref-05`
- `ref-06`
- `ref-07`
- `ref-08`
- `ref-09`
- `ref-10`

하지만 `sitemap.xml`에는 현재 `ref-03`부터 `ref-06`까지만 등록되어 있습니다.

따라서 이번 작업에서 `index.html`을 `/`로 바꾸는 것뿐 아니라, 최신 블로그 글 URL도 sitemap에 반영하는 것이 필요합니다.

### P2. 내부 링크가 계속 `index.html`을 강화하고 있음

현재 여러 페이지의 헤더/nav 링크가 다음 형태를 사용합니다.

```html
<a href="index.html">
<a href="index.html#hero">
<a href="index.html#contact">
```

sitemap과 canonical에서 메인 대표 URL을 `https://datagongbang.kr/`로 정한다면, 내부 링크도 가능하면 아래처럼 통일하는 것이 좋습니다.

```html
<a href="/">
<a href="/#hero">
<a href="/#contact">
```

이렇게 하면 Google에 전달되는 내부 링크 신호도 루트 URL 기준으로 정리됩니다.

### P2. `index.html`에는 canonical뿐 아니라 `og:url`도 없음

다른 페이지들은 대체로 아래 두 태그를 함께 가지고 있습니다.

```html
<meta property="og:url" content="...">
<link rel="canonical" href="...">
```

하지만 `index.html`에는 둘 다 없습니다.

따라서 다음 두 태그를 함께 추가하는 것을 권장합니다.

```html
<meta property="og:url" content="https://datagongbang.kr/">
<link rel="canonical" href="https://datagongbang.kr/">
```

### P3. `blog-detail.html` 기본 canonical 값은 주의 필요

제안안처럼 기본 canonical을 아래처럼 넣으면,

```html
<link rel="canonical" id="canonical-link" href="https://datagongbang.kr/blog-detail.html">
```

JS 실행 전에는 모든 상세글이 같은 canonical을 가리키게 됩니다.

따라서 반드시 `modules/blog-handler.js`에서 상세글 로드 후 다음과 같이 `id` 포함 URL로 교체해야 합니다.

```text
https://datagongbang.kr/blog-detail.html?id=ref-03
```

또한 가능하면 `og:url`, `og:title`, `og:description`도 함께 동적으로 갱신하는 것이 좋습니다.

## 권장 수정 작업

### 1. `sitemap.xml` 수정

메인 페이지 URL을 아래처럼 변경합니다.

```xml
<!-- 수정 전 -->
<loc>https://datagongbang.kr/index.html</loc>

<!-- 수정 후 -->
<loc>https://datagongbang.kr/</loc>
```

그리고 `data/posts.json` 기준으로 누락된 블로그 상세 URL을 추가합니다.

```xml
<loc>https://datagongbang.kr/blog-detail.html?id=ref-07</loc>
<loc>https://datagongbang.kr/blog-detail.html?id=ref-08</loc>
<loc>https://datagongbang.kr/blog-detail.html?id=ref-09</loc>
<loc>https://datagongbang.kr/blog-detail.html?id=ref-10</loc>
```

### 2. `index.html` 수정

`head` 영역에 canonical과 `og:url`을 추가합니다.

```html
<meta property="og:url" content="https://datagongbang.kr/">
<link rel="canonical" href="https://datagongbang.kr/">
```

### 3. `blog-detail.html` 수정

`head` 영역에 기본 canonical과 기본 `og:url`을 추가합니다.

```html
<meta property="og:url" id="og-url" content="https://datagongbang.kr/blog-detail.html">
<link rel="canonical" id="canonical-link" href="https://datagongbang.kr/blog-detail.html">
```

### 4. `modules/blog-handler.js` 수정

`initBlogDetail` 함수 내부에서 `postMeta`를 찾은 뒤, 또는 `document.title`과 meta description을 업데이트하는 위치에서 canonical과 OG 메타를 함께 갱신합니다.

예시:

```js
const canonicalUrl = `https://datagongbang.kr/blog-detail.html?id=${postMeta.id}`;

document.title = `${postMeta.title} | 데이터공방 공식 블로그`;

const metaDesc = document.querySelector('meta[name="description"]');
if (metaDesc) {
  metaDesc.setAttribute("content", postMeta.summary);
}

let canonicalLink = document.getElementById("canonical-link") || document.querySelector('link[rel="canonical"]');
if (canonicalLink) {
  canonicalLink.setAttribute("href", canonicalUrl);
} else {
  canonicalLink = document.createElement("link");
  canonicalLink.setAttribute("rel", "canonical");
  canonicalLink.setAttribute("id", "canonical-link");
  canonicalLink.setAttribute("href", canonicalUrl);
  document.head.appendChild(canonicalLink);
}

let ogUrl = document.getElementById("og-url") || document.querySelector('meta[property="og:url"]');
if (ogUrl) {
  ogUrl.setAttribute("content", canonicalUrl);
} else {
  ogUrl = document.createElement("meta");
  ogUrl.setAttribute("property", "og:url");
  ogUrl.setAttribute("id", "og-url");
  ogUrl.setAttribute("content", canonicalUrl);
  document.head.appendChild(ogUrl);
}

const ogTitle = document.querySelector('meta[property="og:title"]');
if (ogTitle) {
  ogTitle.setAttribute("content", postMeta.title);
}

const ogDesc = document.querySelector('meta[property="og:description"]');
if (ogDesc) {
  ogDesc.setAttribute("content", postMeta.summary);
}
```

### 5. 내부 링크 정규화 검토

가능하면 사이트 내부의 홈 링크를 아래 기준으로 통일합니다.

```html
<!-- 기존 -->
<a href="index.html">
<a href="index.html#hero">
<a href="index.html#contact">

<!-- 권장 -->
<a href="/">
<a href="/#hero">
<a href="/#contact">
```

단, 로컬 파일 직접 열기 방식으로 테스트하는 경우 `/` 링크가 불편할 수 있으므로 GitHub Pages 배포 기준으로 판단해야 합니다.

## 최종 의견

기존 해결안은 맞는 방향입니다.

다만 Search Console의 중복/리디렉션 신호를 더 확실히 줄이려면 아래를 함께 반영하는 것이 좋습니다.

1. sitemap의 메인 URL을 `/`로 변경
2. sitemap에 최신 블로그 글 `ref-07`~`ref-10` 추가
3. `index.html`에 canonical과 `og:url` 추가
4. `blog-detail.html`에 기본 canonical과 `og:url` 추가
5. JS에서 상세글별 canonical과 OG 메타 동적 갱신
6. 가능하면 내부 링크의 `index.html` 사용을 `/` 기준으로 정규화

Gemini 쪽에서 이 개선안에 이슈가 없는지 재검토 후 작업 진행하면 좋겠습니다.
