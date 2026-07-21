# 실무 가이드 운영 메모

이 문서는 홈페이지 방문자가 아닌 콘텐츠 관리자와 유지보수 담당자를 위한 내부 운영 문서입니다. 가이드 허브의 모든 가이드에 공통으로 적용합니다.

## 단일 원본

각 가이드는 `docs/`의 Markdown 원고 하나를 단일 원본으로 사용합니다.

| 가이드 | 원본 Markdown | 웹 페이지 | PDF | 빌드 키 |
|---|---|---|---|---|
| STEP 01 Antigravity 실무 시작 | `docs/antigravity_guide.md` | `guide/antigravity/index.html` | `docs/antigravity_guide.pdf` | `antigravity` |
| STEP 02 Rules & Skills 설계 | `docs/antigravity_rules_and_skills_guide.md` | `guide/antigravity-rules-skills/index.html` | `docs/antigravity_rules_and_skills_guide.pdf` | 별도 관리 |
| STEP 03 깃허브 처음 시작하기 | `docs/github_start_guide.md` | `guide/github-start/index.html` | `docs/github_start_guide.pdf` | `github-start` |
| STEP 04 내 대시보드 배포하기 | `docs/cloudflare_pages_deploy_guide.md` | `guide/cloudflare-pages/index.html` | `docs/cloudflare_pages_deploy_guide.pdf` | `cloudflare-pages` |

- 홈페이지: 각 웹 페이지가 원본 Markdown을 `fetch`로 읽어 `marked`로 렌더링하고, `h2` 제목으로 좌측 목차를 자동 생성합니다. 본문 문장을 HTML에 복사해 두지 않습니다.
- PDF: 동일한 Markdown 원고에서 생성합니다.
- 이미지: `assets/images/guide/`에서 공동 사용합니다.
- 사실 검증: 각 절의 공식 근거 링크를 기준으로 정기 점검합니다.
- 버전 관리: 작성일과 공식 문서 검증일을 분리해 기록합니다.

내비게이션, CTA, 다운로드 폼처럼 표현 계층에만 필요한 요소는 홈페이지 템플릿에 둡니다.

## PDF 생성

`modules/make_guide_pdf.py`는 빌드 키를 인자로 받습니다.

```
python modules/make_guide_pdf.py                      # 인자 없으면 antigravity 한 건만
python modules/make_guide_pdf.py github-start         # 특정 가이드
python modules/make_guide_pdf.py all                  # 등록된 전체
```

새 가이드를 추가할 때는 스크립트 상단의 `GUIDES` 딕셔너리에 `빌드 키: (원본 md, 출력 pdf, 런닝 헤더 문구)`를 등록합니다.

## 홈페이지 전용 도식

Markdown 안에서 `<!-- PDF-SKIP-START -->`와 `<!-- PDF-SKIP-END -->`로 감싼 구간은 **홈페이지에서만 렌더링되고 PDF 빌드에서는 제외**됩니다. 흐름도 같은 HTML 도식을 여기에 넣습니다.

PDF 독자가 내용을 놓치지 않도록 **도식 바로 뒤에 같은 내용을 요약한 문장이나 표를 반드시 함께 둡니다.**

## 배포 전 확인

- [ ] 수정한 가이드의 공식 문서 검증일을 갱신한다.
- [ ] 홈페이지에서 제목, 표, 이미지와 내부 링크를 확인한다.
- [ ] PDF를 다시 생성하고 페이지 잘림과 한글 폰트를 확인한다.
- [ ] `guide/index.html`의 카드와 각 가이드의 상호 링크를 확인한다.
- [ ] 웹 페이지의 `fetch` 캐시 버전(`?v=...`)을 원고 수정일에 맞춰 올린다.
- [ ] `sitemap.xml`의 수정일을 갱신한다.
