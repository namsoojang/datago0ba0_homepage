# 깃허브·배포 가이드 캡쳐 현황

STEP 03·04 가이드는 화면 캡쳐 없이도 완결되도록 작성했습니다. 아래는 현재 반영된 캡쳐와, 추가하면 좋은 항목입니다.

## 촬영·정리 원칙

- 화면 전체가 아니라 **선택해야 할 영역만** 잘라 담습니다.
- 캡쳐에 사용자명, 이메일, 사업자 정보, 실제 데이터가 보이면 **가리고 저장**합니다.
- 실습용 더미 계정과 더미 저장소(`survey-dashboard` 등)로 촬영합니다.
- 저장 위치는 `assets/images/guide/github/`입니다.
- **파일명은 영문 소문자와 하이픈만 사용합니다.** 한글이나 `&` 같은 기호가 들어가면 배포 후 주소가 인코딩되어 깨질 수 있습니다. 가이드 본문에서 수강생에게 안내하는 규칙과 동일하게 적용합니다.
- 본문 삽입 형식은 `![설명](../assets/images/guide/github/파일명.png)`입니다. 웹 페이지가 경로를 자동 보정하고, PDF 빌드도 같은 경로를 읽습니다.

## 반영 완료

| 파일명 | 내용 | 삽입 위치 |
|---|---|---|
| `gh-new-repo.png` | 저장소 생성 화면 전체 (이름, visibility, README, .gitignore) | STEP 03 · 4.1 저장소 만들기 |
| `gh-visibility.png` | Choose visibility 드롭다운을 펼쳐 Public/Private 설명이 보이는 화면 | STEP 03 · 4.2 Public과 Private의 차이 |
| `cf-workers-pages-create.png` | Compute > Workers & Pages 경로와 Create application 버튼 | STEP 04 · 3.1 |
| `cf-pages-get-started.png` | Worker 화면 하단의 `Looking to deploy Pages? Get started` 링크 | STEP 04 · 3.2 |
| `cf-import-git-repo.png` | Import an existing Git repository 선택 화면 | STEP 04 · 3.3 |
| `cf-repo-permissions.png` | All repositories / Only select repositories 권한 선택 화면 | STEP 04 · 3.4 |
| `cf-select-repository.png` | 3단계 마법사와 저장소 목록 화면 | STEP 04 · 3.5 |
| `cf-build-settings.png` | Set up builds and deployments 화면. Framework preset None, Build command 비어 있는 상태 | STEP 04 · 4. 첫 배포 |
| `cf-deployed-url.png` | 브라우저 주소창의 `*.pages.dev` (원본은 본문이 전부 마스킹되어 주소창만 잘라 사용) | STEP 04 · 4. 첫 배포 |

## 추가하면 좋은 항목

| 우선순위 | 파일명 | 무엇을 | 삽입 위치 |
|---|---|---|---|
| 중간 | `cf-deploy-success.png` | 배포 성공 로그(`Success! Deployment complete`)와 발급된 주소 | STEP 04 · 4. 로그 읽는 법 아래 |
| 중간 | `gh-repo-after-push.png` | 푸시가 끝나 파일 목록이 올라온 저장소 화면 | STEP 03 · 8. 체크리스트 직전 |
| 낮음 | `gh-2fa.png` | 2단계 인증 설정 화면 | STEP 03 · 3. GitHub 가입하기 |

## 넣은 뒤 확인

- [ ] 홈페이지에서 이미지가 깨지지 않고 표시된다
- [ ] 캡쳐에 개인정보나 실제 데이터가 남아 있지 않다
- [ ] `python modules/make_guide_pdf.py github-start cloudflare-pages`로 PDF를 다시 생성해 이미지가 페이지를 넘어가지 않는지 확인했다
