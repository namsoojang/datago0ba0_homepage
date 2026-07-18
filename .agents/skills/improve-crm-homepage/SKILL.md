---
name: improve-crm-homepage
description: Audit and incrementally improve the 데이터공방 website as a B2B CRM conversion funnel. Use when asked to standardize navigation across HTML pages, clarify positioning and customer journeys, improve CTA or lead forms, add trust and case-study evidence, design guide-to-consultation flows, define GA4 events, or implement the next prioritized homepage conversion improvement.
---

# 데이터공방 CRM 홈페이지 개선

데이터공방 홈페이지를 `방문 → 신뢰 → 자료 탐색 → 상담 의도 → CRM 접수` 흐름으로 개선한다. 한 번에 전면 개편하지 말고 검증 가능한 한 단계씩 변경한다.

## 시작 절차

1. 저장소 지침과 Git 상태를 확인한다.
2. `rg --files -g '*.html'`로 대상 페이지를 찾는다.
3. 모든 페이지의 로고, 전역 메뉴, CTA, 활성 상태, 모바일 메뉴를 표로 비교한다.
4. 변경 전 [메뉴 표준](references/menu-standard.md)과 [CRM 벤치마크](references/crm-benchmark.md)를 읽는다.
5. [점검표와 로드맵](references/scorecard.md)으로 다음 한 단계를 선택한다.
6. 구현 전 영향 파일과 측정 이벤트를 명시한다.
7. 구현 후 링크, HTML, JavaScript, 모바일 레이아웃과 Git diff를 검증한다.

## 작업 단위 선택

다음 우선순위에서 가장 앞선 미완료 항목 하나를 기본 작업 단위로 삼는다.

1. 전역 메뉴와 활성 상태 통일
2. 첫 화면의 대상 고객·성과·주요 CTA 명확화
3. 고객 사례와 검증 가능한 신뢰 근거 강화
4. 방문 목적별 서비스·가이드 경로 분리
5. PDF·가이드와 상담 CRM 흐름 연결
6. 문의 폼의 마찰, 동의, 라우팅과 응답 기대치 개선
7. 반대 질문을 해소하는 FAQ 추가
8. GA4 퍼널 이벤트와 성과 점검 체계 정비

사용자가 여러 항목을 요청하면 의존 관계를 설명하고 안전한 순서대로 진행한다.

## 메뉴 작업 규칙

- 전역 메뉴와 페이지 전용 보조 메뉴를 구분한다.
- 모든 마케팅 페이지에서 전역 메뉴의 이름, 순서, 목적지를 동일하게 유지한다.
- 홈 이동은 로고로 제공하고 메뉴 항목 수를 불필요하게 늘리지 않는다.
- 전역 메뉴 권장 순서는 `교육·서비스 → 성과·사례 → 업무도구 → 실무가이드 → 블로그 → 문의 CTA`이다.
- 가이드나 도구 내부의 세부 탐색은 두 번째 행, 탭, 사이드바로 제공한다.
- 현재 페이지에는 `aria-current="page"` 또는 일관된 활성 클래스를 적용한다.
- 모바일에서도 동일한 정보 순서와 CTA를 유지한다.
- 공통 컴포넌트 체계가 없는 정적 HTML에서는 먼저 메뉴 명세를 확정하고, 파일별 반복 수정을 최소 단위로 수행한다.

세부 기준은 [references/menu-standard.md](references/menu-standard.md)를 따른다.

## CRM 개선 원칙

- 제품이나 기능보다 방문자의 문제와 기대 결과를 먼저 설명한다.
- 첫 화면에는 주요 CTA 하나와 부담이 낮은 보조 CTA 하나만 둔다.
- 주장에는 실제 사례, 수치, 기관, 산출물 또는 검증 가능한 과정 근거를 붙인다.
- 검증되지 않은 고객 로고, 성과 수치와 과장된 보장은 만들지 않는다.
- PDF 다운로드를 과도한 필수 개인정보 입력으로 막지 않는다.
- 다운로드와 상담 요청을 분리하고 상담 의도가 있는 리드를 CRM에 저장한다.
- 폼은 필요한 최소 필드만 필수화하고 수집 목적, 개인정보 동의, 후속 연락 방식을 가까이 표시한다.
- CTA마다 다음 화면과 사용자가 얻게 될 결과를 구체적으로 쓴다.
- 모든 주요 행동에 측정 이벤트와 구분 속성을 설계한다.

Re:catch에서 관찰한 패턴과 데이터공방 적용 방식은 [references/crm-benchmark.md](references/crm-benchmark.md)를 읽는다.

## 구현 전 산출물

변경 전에 짧게 정리한다.

- 현재 문제와 근거
- 선택한 개선 항목
- 고객 여정에서 바뀌는 단계
- 수정할 파일
- 성공 판단 이벤트 또는 지표
- 이번 작업에서 제외할 항목

## 검증

- 모든 수정 HTML의 로컬 링크가 존재하는지 확인한다.
- 중복 `id`, 잘못된 상대경로, 누락된 활성 상태를 검사한다.
- 인라인 JavaScript는 `node --check`로 검사한다.
- 사이트맵을 수정했다면 XML 파싱을 확인한다.
- 데스크톱과 모바일에서 메뉴 줄바꿈, 오버플로, CTA 순서를 시각 확인한다.
- 폼은 필수값, 이메일 검증, 동의, 성공·실패 메시지를 확인한다.
- `git diff --check`와 변경 파일 목록을 확인한다.
- 관련 없는 기존 변경을 커밋하지 않는다.

## 완료 보고

다음을 간결하게 보고한다.

- 무엇을 바꿨는지
- CRM 퍼널에서 어떤 효과를 의도했는지
- 검증 결과
- 측정할 이벤트와 지표
- 다음 우선순위 한 가지
- 커밋과 푸시 상태
