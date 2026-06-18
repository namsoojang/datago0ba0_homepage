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
 * [통합 버전] 홈페이지 문의 접수 & RPA 사전예약 데이터를 자동 분기하여 수집하는 스크립트
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
    var doc = SpreadsheetApp.getActiveSpreadsheet();
    var data = JSON.parse(e.postData.contents);
    var timestamp = new Date();
    
    // 한국 표준시(KST) 포맷 변환
    var formattedDate = Utilities.formatDate(timestamp, "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");
    
    // ----------------------------------------------------
    // [분기 1] RPA 사전예약 수집 (data.toolName이 전송된 경우)
    // ----------------------------------------------------
    if (data.toolName) {
      var rpaSheet = doc.getSheetByName("RPA 사전예약");
      // 탭이 없으면 자동으로 생성
      if (!rpaSheet) {
        rpaSheet = doc.insertSheet("RPA 사전예약");
        rpaSheet.appendRow(["신청 일시", "도구명", "이메일 주소", "연락처"]);
      }
      
      // RPA 신청 데이터 누적 (A: 신청일시, B: 도구명, C: 이메일, D: 연락처)
      rpaSheet.appendRow([
        formattedDate,
        data.toolName,
        data.email || "",
        data.phone || ""
      ]);

      return ContentService.createTextOutput(JSON.stringify({ "success": true, "message": "RPA 사전예약 신청 완료" }))
        .setMimeType(ContentService.MimeType.JSON)
        .setHeader("Access-Control-Allow-Origin", "*"); // CORS 제약 해결 헤더 추가
    } 
    // ----------------------------------------------------
    // [분기 2] 자동화 아이디어 제안 수집 (data.type === "자동화 아이디어 제안"인 경우)
    // ----------------------------------------------------
    else if (data.type === "자동화 아이디어 제안") {
      var suggestSheet = doc.getSheetByName("아이디어 제안");
      // 탭이 없으면 자동으로 생성
      if (!suggestSheet) {
        suggestSheet = doc.insertSheet("아이디어 제안");
        suggestSheet.appendRow(["제출 일시", "이메일 주소", "연락처", "제안 내용"]);
      }

      // 제안 데이터 누적 (A: 제출일시, B: 이메일, C: 연락처, D: 제안내용)
      suggestSheet.appendRow([
        formattedDate,
        data.email || "",
        data.phone || "",
        data.message || ""
      ]);

      // 운영자 메일로 실시간 알림 발송
      var adminEmail = "contact@datagongbang.kr";
      var subject = "[데이터공방] 새로운 자동화 아이디어 제안 접수";
      
      var emailBody = "홈페이지를 통해 새로운 자동화 아이디어 제안이 등록되었습니다.\n\n" +
                      "------------------------------------\n" +
                      "■ 제안 일시: " + formattedDate + "\n" +
                      "■ 이메일: " + (data.email || "") + "\n" +
                      "■ 연락처: " + (data.phone || "") + "\n\n" +
                      "■ 제안 내용:\n" + (data.message || "") + "\n" +
                      "------------------------------------\n\n" +
                      "▶ 등록된 내용은 구글 스프레드시트 관리 대장의 '아이디어 제안' 탭에서 확인하실 수 있습니다.";

      GmailApp.sendEmail(adminEmail, subject, emailBody);

      return ContentService.createTextOutput(JSON.stringify({ "success": true, "message": "아이디어 제안 접수 완료" }))
        .setMimeType(ContentService.MimeType.JSON)
        .setHeader("Access-Control-Allow-Origin", "*");
    }
    // ----------------------------------------------------
    // [분기 3] 기존 홈페이지 문의 수집 (기존 로직 보존)
    // ----------------------------------------------------
    else {
      // 첫 번째 시트를 문의 내역 탭으로 지정
      var sheet = doc.getSheetByName("홈페이지 문의") || doc.getSheets()[0];
      
      var type = data.type || "간편 문의";
      var company = data.company || "";
      var name = data.name || "";
      var phone = data.phone || "";
      var email = data.email || "";
      var headcount = data.headcount || "";
      var topic = data.topic || "";
      var timing = data.timing || "";
      var message = data.message || "";
      
      var status = "접수대기"; 
      var replyDate = "";
      var replyContent = "";
      var progressLog = "";

      // A~N열 데이터 매핑
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

      // 운영자 메일로 실시간 알림 발송
      var adminEmail = "contact@datagongbang.kr";
      var subject = "[데이터공방] 홈페이지 " + type + " 접수 알림 (" + name + " 님)";
      
      var emailBody = "홈페이지를 통해 새로운 문의가 등록되었습니다.\n\n" +
                      "------------------------------------\n" +
                      "■ 문의 종류: " + type + "\n" +
                      "■ 접수 일시: " + formattedDate + "\n\n";
                      
      if (type === "교육 견적 요청") {
        emailBody += "■ 회사/기관명: " + company + "\n" +
                     "■ 성함/직책: " + name + "\n" +
                     "■ 연락처: " + phone + "\n" +
                     "■ 이메일: " + email + "\n" +
                     "■ 예상인원: " + headcount + "\n" +
                     "■ 교육주제: " + topic + "\n" +
                     "■ 희망시기: " + timing + "\n" +
                     "■ 추가 요청사항:\n" + message + "\n";
      } else {
        emailBody += "■ 성함/직책: " + name + "\n" +
                     "■ 연락처: " + phone + "\n" +
                     "■ 이메일: " + email + "\n" +
                     "■ 문의내용:\n" + message + "\n";
      }
      
      emailBody += "------------------------------------\n\n" +
                   "▶ 등록된 상세 내용은 구글 스프레드시트 관리 대장에서 확인하실 수 있습니다.";

      GmailApp.sendEmail(adminEmail, subject, emailBody);

      return ContentService.createTextOutput(JSON.stringify({ "success": true, "message": "접수 완료" }))
        .setMimeType(ContentService.MimeType.JSON)
        .setHeader("Access-Control-Allow-Origin", "*"); // CORS 제약 해결 헤더 추가
    }

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ "success": false, "message": error.toString() }))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeader("Access-Control-Allow-Origin", "*");
  } finally {
    lock.releaseLock(); // 락 해제
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
