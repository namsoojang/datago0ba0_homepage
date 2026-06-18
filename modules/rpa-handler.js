/**
 * modules/rpa-handler.js
 * RPA 허브 포털의 Coming Soon 도구 알림 예약(대기자 리스트) 제어 스크립트
 */

// ⚠️ 배포 시 생성하신 Google Apps Script Web App URL로 교체해주셔야 작동합니다.
// 교체 방법은 docs/google-script-guide.md 문서를 참조하세요.
const GOOGLE_SHEET_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbybq4BX-vf75-UhqtGZxJelIEEbO7Ga-r-u2ynAdGyKqQ32vl5yPjkV9Mrv-FKArs6HDw/exec";

document.addEventListener("DOMContentLoaded", () => {
  initModalEvents();
});

function initModalEvents() {
  const modal = document.getElementById("rpa-modal");
  const closeBtn = document.getElementById("modal-close-btn");
  const form = document.getElementById("rpa-reserve-form");
  const emailInput = document.getElementById("reserve-email");
  const phoneInput = document.getElementById("reserve-phone");
  const toolNameInput = document.getElementById("modal-tool-name");
  const titleText = document.getElementById("modal-title-text");

  const emailError = document.getElementById("email-error");
  const phoneError = document.getElementById("phone-error");
  const submitBtn = document.getElementById("reserve-submit-btn");

  // 1. 모달 팝업 열기 트리거 바인딩 (Coming Soon 카드 클릭 시)
  const triggers = document.querySelectorAll(".reserve-trigger-btn");
  triggers.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation(); // 카드 자체 링크 이동 방지
      
      const card = btn.closest(".rpa-card");
      const toolName = card.dataset.toolName || "RPA 자동화 도구";
      
      // 모달 폼 필드 설정
      toolNameInput.value = toolName;
      titleText.innerHTML = `🔔 <span>${toolName}</span> 사전 예약`;
      
      // 폼 리셋
      form.reset();
      clearErrors();
      
      // 모달 활성화
      modal.classList.add("show");
    });
  });

  // 2. 모달 팝업 닫기
  const closeModal = () => {
    modal.classList.remove("show");
    clearErrors();
  };

  closeBtn.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  // ESC 키로 모달 닫기
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("show")) {
      closeModal();
    }
  });

  // 3. 연락처 자동 포맷터 (010-XXXX-XXXX 자동 하이픈 삽입)
  phoneInput.addEventListener("input", (e) => {
    let val = e.target.value.replace(/[^0-9]/g, ""); // 숫자 이외 제거
    if (val.length > 3 && val.length <= 7) {
      val = val.substring(0, 3) + "-" + val.substring(3);
    } else if (val.length > 7) {
      val = val.substring(0, 3) + "-" + val.substring(3, 7) + "-" + val.substring(7, 11);
    }
    e.target.value = val;
  });

  // 에러 초기화 헬퍼
  function clearErrors() {
    emailError.style.display = "none";
    phoneError.style.display = "none";
    emailInput.style.borderColor = "";
    phoneInput.style.borderColor = "";
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<i class="far fa-bell"></i> 사전 알림 신청하기`;
  }

  // 4. 폼 전송 및 Google Apps Script 연동
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearErrors();

    const email = emailInput.value.trim();
    const phone = phoneInput.value.trim();
    const toolName = toolNameInput.value;

    // A. 입력 유효성 검사 (이메일 & 전화번호 정규식)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^010-\d{3,4}-\d{4}$/; // 포맷터 기준 검사

    let hasError = false;

    if (!emailRegex.test(email)) {
      emailError.style.display = "block";
      emailInput.style.borderColor = "#f87171";
      hasError = true;
    }

    if (!phoneRegex.test(phone)) {
      phoneError.style.display = "block";
      phoneInput.style.borderColor = "#f87171";
      hasError = true;
    }

    if (hasError) return;

    // B. 전송 상태 UI 변경
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> 신청 데이터 전송 중...`;

    // C. 구글 앱스 스크립트 비동기 POST 송신
    const payload = {
      toolName: toolName,
      email: email,
      phone: phone
    };

    // GA4 분석 이벤트 트리깅
    if (typeof window.gtag === "function") {
      window.gtag("event", "rpa_reserve_submit", {
        tool_name: toolName
      });
    }

    if (GOOGLE_SHEET_WEBAPP_URL === "YOUR_GOOGLE_APPS_SCRIPT_WEBAPP_URL_HERE") {
      // 실 개발 배포 전 개발자 모드 로깅 및 테스트 모드 안내
      console.log("[RPA 알림 신청 - 테스트 모드]", payload);
      setTimeout(() => {
        showToast("사전 알림 신청이 완료되었습니다! (구글 스크립트 연동 대기 중)");
        closeModal();
      }, 1000);
      return;
    }

    try {
      // CORS 충돌 및 구글 리다이렉션으로 인한 차단을 방지하기 위해 no-cors 모드로 전송합니다.
      // no-cors 모드는 브라우저가 응답 내용을 직접 읽지 못하지만, 구글 스프레드시트 서버로의 데이터 전달 및 저장은 정상적으로 이루어집니다.
      await fetch(GOOGLE_SHEET_WEBAPP_URL, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify(payload)
      });

      // no-cors 모드에서는 응답 본문을 읽을 수 없으므로, fetch 전송이 catch 블록으로 빠지지 않고 무사히 완료되면 신청 성공으로 처리합니다.
      const modalMsg = `<strong>${toolName}</strong> 사전 알림 신청이 성공적으로 접수되었습니다.<br>도구 출시가 완료되면 입력해주신 이메일과 연락처로 신속히 알림을 전송해 드리겠습니다.`;
      
      if (typeof window.showSuccessModal === "function") {
        window.showSuccessModal("사전 알림 신청 완료", modalMsg, "확인");
      } else {
        showToast(`${toolName} 사전 알림 신청이 접수되었습니다!`);
      }
      closeModal();
    } catch (err) {
      console.error("Google Apps Script Submit Error: ", err);
      showToast("데이터 전송 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.", "error");
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<i class="far fa-bell"></i> 사전 알림 신청하기`;
    }
  });
}

// 토스트 유틸 헬퍼 (rpa-handler 독자 구동 보장)
function showToast(message, type = "success") {
  const container = document.getElementById("toast-container") || createToastContainer();
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  
  const iconClass = type === "success" 
    ? "fa-check-circle" 
    : "fa-times-circle";

  toast.innerHTML = `
    <span class="toast-icon"><i class="fas ${iconClass}"></i></span>
    <span class="toast-message">${message}</span>
  `;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add("show");
  }, 10);

  setTimeout(() => {
    toast.classList.remove("show");
    toast.addEventListener("transitionend", () => {
      toast.remove();
    });
  }, 3000);
}

function createToastContainer() {
  const container = document.createElement("div");
  container.id = "toast-container";
  document.body.appendChild(container);
  return container;
}
