/* modules/toast.js - 토스트 알림 기능 모듈 */

// 토스트 컨테이너가 없으면 동적으로 생성
function getOrCreateContainer() {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  return container;
}

/**
 * 전역 토스트 팝업 띄우기
 * @param {string} message - 표시할 문구
 * @param {string} type - 토스트 종류 ('success' | 'warning' | 'error')
 * @param {number} duration - 노출 시간 (ms)
 */
export function showToast(message, type = 'success', duration = 3000) {
  const container = getOrCreateContainer();
  
  // 토스트 요소 생성
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  // 아이콘 매핑
  let iconClass = 'fa-check-circle';
  if (type === 'warning') iconClass = 'fa-exclamation-triangle';
  if (type === 'error') iconClass = 'fa-times-circle';
  
  toast.innerHTML = `
    <span class="toast-icon"><i class="fas ${iconClass}"></i></span>
    <span class="toast-message">${message}</span>
  `;
  
  container.appendChild(toast);
  
  // 브라우저 렌더링 루프 후 트랜지션 적용을 위해 setTimeout 사용
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);
  
  // 지정 시간 후 삭제
  setTimeout(() => {
    toast.classList.remove('show');
    // 애니메이션이 완전히 끝난 후 DOM에서 삭제
    toast.addEventListener('transitionend', () => {
      toast.remove();
    });
  }, duration);
}
