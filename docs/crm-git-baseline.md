# CRM 홈페이지 개선 Git 기준선

확인일: 2026-07-18

## 확인 결과

| 대상 | 브랜치·커밋 | 상태 |
|---|---|---|
| GitHub `origin/main` | `6d70423` | 최신 가이드 구조 포함 |
| GitHub `origin/review/codex` | `6d70423` | `main`과 동일 |
| 메인 Worktree `0_홈페이지` | `main` / `6d70423` | 원격과 일치 |
| Codex Worktree `0_홈페이지_codex` | `review/codex` / `dd00188` | 원격보다 1커밋 뒤 |
| 임시 Worktree `/tmp/0_homepage_codex` | `review/codex` / `dd00188` | 원격보다 1커밋 뒤 |

## 미커밋 변경 분류

### 메인 Worktree

23개 파일이 수정으로 표시되지만 `git diff --ignore-cr-at-eol --quiet`가 성공한다. 실제 콘텐츠 차이가 아니라 CRLF/LF 줄바꿈 차이이므로 CRM 작업에 포함하지 않는다.

### Codex Worktree

- 미스테이징 수정은 줄바꿈 차이이다.
- 스테이징 영역에는 이미지·문서·가이드 삭제와 HTML·설정 수정 등 실제 차이가 남아 있다.
- 소유와 목적이 확인되지 않았으므로 스테이징 취소, 복원, 커밋 또는 삭제하지 않는다.
- `.agents/skills/improve-crm-homepage/`와 `docs/crm-homepage-improvement-plan.md`는 이번 CRM 계획 작업에서 새로 만든 파일이다.

### 임시 Worktree

PDF 수정과 Rules & Skills 가이드 삭제가 스테이징되어 있다. 목적을 확인하기 전까지 사용하거나 정리하지 않는다.

## Worktree 주의사항

저장소에는 동일한 `review/codex` 브랜치를 가리키는 비정상·임시 Worktree 기록이 함께 존재한다. CRM 구현 작업에서 기존 Codex Worktree의 브랜치를 직접 이동하거나 강제 갱신하지 않는다.

다음 단계부터는 `origin/review/codex` 최신 커밋에서 깨끗한 임시 복제본을 만들고, 해당 단계 파일만 커밋한 뒤 GitHub `review/codex`로 푸시한다. 사용자 소유 변경이 있는 Worktree는 읽기 전용 기준으로 취급한다.

## 배포 기준

- 저장소 루트의 `CNAME`은 `datagongbang.kr`이다.
- 별도 GitHub Actions, Netlify, Vercel, Firebase 또는 Sites 배포 설정 파일은 확인되지 않았다.
- 정적 HTML·CSS·JavaScript 루트 구조와 CNAME은 GitHub Pages 배포 정황과 일치한다.
- 로컬 파일만으로 GitHub Pages 설정 화면의 publishing source를 확정할 수는 없다.
- 운영 기준은 `main`을 서버 배포 브랜치로 유지하고 `review/codex` 검증 후 `main`에 병합한다.

## 안전한 작업·배포 순서

1. `origin/review/codex` 최신 커밋에서 깨끗한 임시 복제본을 만든다.
2. 계획의 한 단계만 구현한다.
3. HTML, JavaScript, 링크, 모바일 화면과 diff를 검증한다.
4. 해당 단계 파일만 커밋한다.
5. GitHub `review/codex`에 푸시한다.
6. 검토가 끝나면 `review/codex`를 `main`에 fast-forward 또는 안전 병합한다.
7. GitHub Pages 반영과 실제 URL을 확인한다.

## 현재 CRM 기준점 커밋 대상

다음 파일만 독립 커밋한다.

- `.agents/skills/improve-crm-homepage/SKILL.md`
- `.agents/skills/improve-crm-homepage/agents/openai.yaml`
- `.agents/skills/improve-crm-homepage/references/*.md`
- `docs/crm-homepage-improvement-plan.md`
- `docs/crm-git-baseline.md`

홈페이지 HTML, CSS, JavaScript, PDF와 기존 스테이징 파일은 포함하지 않는다.
