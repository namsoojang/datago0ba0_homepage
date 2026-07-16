/**
 * modules/config.js
 * 외부 API 및 Google Apps Script Web App URL 통합 관리 설정 파일
 */
window.APP_CONFIG = {
  // 구글 스프레드시트 연동용 Apps Script Web App URL
  GAS_WEBAPP_URL: "https://script.google.com/macros/s/AKfycbzbPLLNTIV9c1Ef-Uzd0AeomCWQXUSQY-McEvLBfqekbPgG8gVrFFg_vTACKpkz6qZNIg/exec",
  
  // 외부 API 주소 정의
  API: {
    IPIFY: "https://api.ipify.org?format=json",
    IPINFO: "https://ipinfo.io/json"
  }
};
