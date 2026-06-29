/**
 * modules/utils.js
 * 홈페이지 전반에 사용되는 공통 유틸리티 비즈니스 로직
 */
window.APP_UTILS = {
  /**
   * 타임아웃 및 폴백이 포함된 IP 주소 조회 비동기 함수
   */
  getIPAddress: () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);

    // 전역 설정이 정의되지 않았을 경우를 대비한 기본값 설정
    const config = window.APP_CONFIG || {};
    const ipifyUrl = config.API?.IPIFY || 'https://api.ipify.org?format=json';
    const ipinfoUrl = config.API?.IPINFO || 'https://ipinfo.io/json';

    return fetch(ipifyUrl, { signal: controller.signal })
      .then(res => res.json())
      .then(ipData => {
        clearTimeout(timeoutId);
        return ipData.ip;
      })
      .catch(err => {
        clearTimeout(timeoutId);
        console.warn('Primary IP fetch (ipify) failed, trying fallback (ipinfo)...', err);
        
        const backupController = new AbortController();
        const backupTimeoutId = setTimeout(() => backupController.abort(), 1500);
        
        return fetch(ipinfoUrl, { signal: backupController.signal })
          .then(res => res.json())
          .then(backupData => {
            clearTimeout(backupTimeoutId);
            return backupData.ip || '알 수 없음';
          })
          .catch(backupErr => {
            clearTimeout(backupTimeoutId);
            console.error('All IP fetches failed:', backupErr);
            return '알 수 없음';
          });
      });
  }
};
