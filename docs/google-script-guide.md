# 구글 스프레드시트 연동 (Google Apps Script 배포) 가이드

데이터공방 홈페이지의 **RPA 사전 알림 신청(대기자 리스트)** 폼에서 수집된 정보(신청 일시, 도구명, 이메일, 연락처)를 구글 스프레드시트에 자동으로 저장하기 위한 구글 앱스 스크립트(Google Apps Script) 설정 및 배포 방법입니다.

---

## 1단계. 기존 구글 스프레드시트 열기
1. 기존 홈페이지 문의를 수집하고 있는 구글 스프레드시트([링크](https://docs.google.com/spreadsheets/d/1v4mfxFicunKG56UTME8Ib-6ZHL89UzQgslBHpUoAW08/edit?pli=1&gid=1638968832#gid=1638968832))를 엽니다.
2. 탭을 수동으로 추가하실 필요가 없습니다. 스크립트가 작동 시 시트 내에 `"RPA 사전예약"`이라는 이름의 탭이 없으면 **자동으로 탭을 신설하고 열 머리글을 추가**하도록 설계되었습니다.

---

## 2단계. 앱스 스크립트(Apps Script) 편집기 수정
1. 스프레드시트 상단 메뉴에서 **확장 프로그램** > **Apps Script**를 클릭합니다.
2. 기존에 작성되어 있던 `doPost(e)` 함수 및 전체 코드를 지우고, 아래의 **통합 병합 스크립트 코드**를 복사하여 덮어씁니다.
   - 이 코드는 기존의 "홈페이지 일반/교육 문의" 접수(이메일 알림 포함)와 "RPA 사전예약" 접수를 전송되는 데이터 종류에 따라 자동으로 분류해 각각 다른 탭에 누적해 줍니다.

```javascript
/**
 * [통합 버전 v9.2] 홈페이지 문의 접수 & RPA 사전예약 & 다운로드 로그 & RPA 도구 작동 로그를 "문의raw" 시트 하나로 통합 수집하고, 가이드북 신청 시 사용자 자동 메일 회신을 지원하는 스크립트
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000); // 동시 접속 시 데이터 누락 방지를 위한 락 설정 (30초 대기)
  } catch (f) {
    return ContentService.createTextOutput(JSON.stringify({ "success": false, "message": "서버 트래픽 과부하로 처리가 지연되었습니다." }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  try {
    // 스프레드시트 ID 명시로 안정성 100% 확보
    var doc = SpreadsheetApp.openById("1v4mfxFicunKG56UTME8Ib-6ZHL89UzQgslBHpUoAW08");
    
    // 모든 데이터를 "문의raw" 단일 시트에 통합 수집
    var sheet = doc.getSheetByName("문의raw");
    if (!sheet) {
      sheet = doc.insertSheet("문의raw");
      sheet.appendRow([
        "날짜", 
        "문의 타입", 
        "회사명", 
        "성함 / 직책", 
        "연락처", 
        "이메일", 
        "예상인원", 
        "교육주제", 
        "희망시기", 
        "문의 및 요청사항", 
        "진행상태",
        "답신일시",
        "답신내용",
        "진행기록"
      ]);
    }
    
    var data = JSON.parse(e.postData.contents);
    var timestamp = new Date();
    
    // 한국 표준시(KST) 포맷 변환
    var formattedDate = Utilities.formatDate(timestamp, "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");
    
    var type = data.type || "간편 문의";
    var company = data.company || "";
    var name = data.name || "";
    var phone = data.phone || "";
    var email = data.email || "";
    var headcount = data.headcount || "";
    var topic = data.topic || "";
    var timing = data.timing || "";
    var message = data.message || "";
    
    // ----------------------------------------------------
    // [RPA 사전예약 수집 연동 보정] (data.toolName이 온 경우)
    // ----------------------------------------------------
    if (data.toolName) {
      type = "RPA 사전예약";
      message = "신청 도구명: " + data.toolName;
    }
    
    // ----------------------------------------------------
    // [아이디어 제안 수접 연동 보정] (data.type === "자동화 아이디어 제안"인 경우)
    // ----------------------------------------------------
    else if (data.type === "자동화 아이디어 제안") {
      type = "아이디어 제안";
    }

    // ----------------------------------------------------
    // [가이드북 다운로드 수집 연동 보정]
    // ----------------------------------------------------
    else if (data.type === "안티그래비티 가이드북 다운로드") {
      type = "다운로드 로그";
    }

    var status = "접수대기"; 
    var replyDate = "";
    var replyContent = "";
    var progressLog = "";

    // "문의raw" 시트에 A~N열 구조로 통합 누적
    sheet.appendRow([
      formattedDate, 
      type, 
      company, 
      name, 
      phone, 
      email, 
      headcount, 
      topic, 
      timing, 
      message, 
      status,
      replyDate,
      replyContent,
      progressLog
    ]);

    // ----------------------------------------------------
    // [알림 처리 1] 운영자 실시간 메일 발송
    // ----------------------------------------------------
    var adminEmail = "contact@datagongbang.kr";
    var subject = "[데이터공방] " + type + " 접수 알림 (" + name + " 님)";
    var emailBody = "홈페이지를 통해 새로운 데이터가 등록되었습니다.\n\n" +
                    "------------------------------------\n" +
                    "■ 분류: " + type + "\n" +
                    "■ 일시: " + formattedDate + "\n" +
                    "■ 회사명: " + company + "\n" +
                    "■ 성함/직책: " + name + "\n" +
                    "■ 이메일: " + email + "\n" +
                    "■ 연락처: " + phone + "\n";

    if (type === "교육 견적 요청") {
      emailBody += "■ 예상인원: " + headcount + "\n" +
                   "■ 교육주제: " + topic + "\n" +
                   "■ 희망시기: " + timing + "\n";
    }
    
    emailBody += "■ 상세 내용:\n" + message + "\n" +
                 "------------------------------------\n\n" +
                 "▶ 상세 내용은 구글 스프레드시트 '문의raw' 시트에서 확인하실 수 있습니다.";

    GmailApp.sendEmail(adminEmail, subject, emailBody);

    // ----------------------------------------------------
    // [알림 처리 2] 신청자 메일 자동 회신 (가이드북 다운로드 링크 제공)
    // ----------------------------------------------------
    if (data.type === "안티그래비티 가이드북 다운로드" && email) {
      var userSubject = "[데이터공방] 요청하신 Antigravity IDE 실무 가이드북 다운로드 링크입니다.";
      var userBody = "안녕하세요, " + name + " 님.\n\n" +
                     "데이터공방을 찾아주시고 Antigravity IDE 가이드북을 신청해 주셔서 감사합니다.\n\n" +
                     "신청하신 Antigravity IDE 실무 가이드북 (클로드코드, Codex 연동까지) PDF 다운로드 링크를 아래와 같이 전해드립니다.\n\n" +
                     "▶ 가이드북 PDF 다운로드 링크: https://datagongbang.kr/docs/antigravity_guide.pdf?v=20260718 \n\n" +
                     "본 가이드가 작게나마 도움이 되어, 설치 및 운영에 활용하실 수 있으면 좋겠습니다.\n" +
                     "사용하시다 어려운 점이나 추가 사내 교육 관련 문의가 필요하시면 언제든 이 메일로 답장해 주세요.\n\n" +
                     "감사합니다.\n" +
                     "데이터공방 드림";
      
      GmailApp.sendEmail(email, userSubject, userBody);
    }

    return ContentService.createTextOutput(JSON.stringify({ "success": true, "message": "접수 완료" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ "success": false, "message": error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}
```

4. 상단의 **프로젝트 저장** 아이콘(디스켓 모양)을 눌러 저장합니다.

---

## 3단계. 웹 앱(Web App)으로 배포하기
1. 편집기 우측 상단의 주황색 **배포** 버튼을 클릭하고 **새 배포**를 선택합니다.
2. 유형 선택(톱니바퀴 아이콘)에서 **웹 앱**을 선택합니다.
3. 설정 창에서 아래와 같이 지정합니다:
   * **설명**: `데이터공방 RPA 사전알림 수집 API`
   * **웹 앱을 실행할 사용자**: `나 (본인의 구글 계정)`
   * **액세스 권한이 있는 사용자**: **웹의 모든 사용자 (Anyone)** (⚠️ 필수: 비로그인 외부 유저의 데이터를 저장해야 하므로 반드시 '모든 사용자'로 지정해야 합니다.)
4. **배포** 버튼을 누릅니다.
5. 최초 배포 시, 구글 계정 액세스 승인 팝업이 뜹니다.
   * **액세스 승인(Authorize Access)** 클릭 후 자신의 계정을 선택합니다.
   * "Google에서 이 앱을 검증하지 않았습니다" 경고 창이 뜨면, 좌측 하단의 **고급(Advanced)**을 누르고 **`제목 없는 프로젝트(이동)`** 링크를 클릭한 후 **허용(Allow)**을 클릭합니다.
6. 배포가 완료되면 화면에 **웹 앱 URL**이 생성됩니다. 이 URL을 **복사**합니다.

---

## 4단계. 홈페이지 자바스크립트 코드 수정
1. 내보내진 홈페이지 폴더의 [modules/rpa-handler.js](file:///c:/Users/장남수/Documents/00_데이터공방/0_홈페이지/modules/rpa-handler.js) 파일을 엽니다.
2. 파일 최상단 7번째 라인에 있는 `GOOGLE_SHEET_WEBAPP_URL` 상수에 복사해 둔 URL을 입력합니다.

```javascript
// 수정 전
const GOOGLE_SHEET_WEBAPP_URL = "YOUR_GOOGLE_APPS_SCRIPT_WEBAPP_URL_HERE";

// 수정 후 (복사한 주소 대입)
const GOOGLE_SHEET_WEBAPP_URL = "https://script.google.com/macros/s/AKfycb..._본인의_배포_ID/exec";
```

3. 파일을 저장하고 웹에 배포하면 모든 연동 작업이 정상 완료됩니다.
