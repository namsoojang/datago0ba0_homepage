# GA4 CRM 퍼널 이벤트 명세

개인정보(이름, 이메일, 전화번호, 회사명, 자유 입력 내용)는 이벤트 속성으로 보내지 않는다.

| 이벤트 | 발생 시점 | 속성 |
|---|---|---|
| `click_global_nav` | 전역 메뉴 클릭 | `nav_item`, `source_page` |
| `view_guide_hub` | 가이드 허브 조회 | `source_page` |
| `select_guide_step` | 단계별 웹 가이드 선택 | `step`, `guide_name`, `source_page` |
| `download_guide_pdf` | PDF 링크 클릭 | `guide_name`, `source_page` |
| `click_team_consultation` | 가이드 문맥의 상담 CTA 클릭 | `source_guide`, `source_page` |
| `submit_contact_form` | 서버가 성공을 응답한 폼 제출 | `inquiry_type`, `source_page` |

## 점검 절차

1. GA4 DebugView 또는 Tag Assistant를 연다.
2. 메뉴, 가이드 단계, PDF, 상담 CTA를 각각 한 번 클릭한다.
3. 이벤트가 한 번만 나타나고 `source_page`가 현재 경로인지 확인한다.
4. 테스트 문의를 제출하고 성공 응답 이후에만 `submit_contact_form`이 발생하는지 확인한다.
5. 이벤트 속성에 입력한 개인정보가 포함되지 않는지 확인한다.

권장 퍼널은 `가이드 조회 → 단계 선택 또는 PDF 다운로드 → 상담 CTA → 문의 제출`이다.
