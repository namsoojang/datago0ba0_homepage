/**
 * modules/rpa-handler.js
 * RPA 허브 포털의 Coming Soon 도구 알림 예약(대기자 리스트) 제어 스크립트
 */

// ⚠️ 배포 시 생성하신 Google Apps Script Web App URL로 교체해주셔야 작동합니다.
// 교체 방법은 docs/google-script-guide.md 문서를 참조하세요.
const GOOGLE_SHEET_WEBAPP_URL = window.APP_CONFIG?.GAS_WEBAPP_URL || "https://script.google.com/macros/s/AKfycbwPXMJA-q3BFlDhLQX_rw1BtFWp5qSewHumJ-VA4fBD_-6NrrRusoqcGTGHhjTHnIGhYA/exec";

// 전역 유틸리티 IP 수집기 참조
const getIPAddress = window.APP_UTILS?.getIPAddress || (() => Promise.resolve('알 수 없음'));

/**
 * 허니팟 검사. 사람에게 보이지 않는 필드가 채워졌다면 봇으로 간주합니다.
 * 봇에게 차단 사실을 알리지 않기 위해 호출부에서는 조용히 종료합니다.
 */
function isHoneypotTriggered(form) {
  const honeypot = form.querySelector(".hp-field");
  if (honeypot && honeypot.value.trim() !== "") {
    console.warn("Honeypot triggered — 제출을 무시합니다.");
    return true;
  }
  return false;
}

/**
 * 유입 출처 컨텍스트를 수집합니다.
 * modules/main.js 의 handleFormSubmit() 과 동일한 키를 사용해,
 * 어떤 콘텐츠가 리드를 만들었는지 시트에서 일관되게 집계할 수 있게 합니다.
 */
function getSourceContext() {
  return {
    source_page: window.location.pathname || '/',
    source_url: window.location.href.split('#')[0],
    referrer: document.referrer || 'direct',
    submitted_at: new Date().toISOString()
  };
}

/**
 * 구글 앱스 스크립트로 리드를 전송하고 실제 저장 여부를 검증합니다.
 *
 * 과거에는 CORS 우회를 위해 no-cors 모드를 사용했으나, 이 경우 브라우저가 응답을
 * 읽지 못해 서버가 실패해도 성공으로 처리되어 리드 유실을 탐지할 수 없었습니다.
 * modules/main.js 의 handleFormSubmit() 과 동일하게 cors 모드로 전송하고
 * 응답을 검증합니다. (동일 엔드포인트가 이미 cors 로 정상 동작 중)
 *
 * @returns {Promise<void>} 저장 성공 시 resolve, 실패 시 Error 를 throw
 */
async function submitLeadToGAS(payload) {
  const response = await fetch(GOOGLE_SHEET_WEBAPP_URL, {
    method: "POST",
    mode: "cors",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Network response was not ok (${response.status})`);
  }

  const data = await response.json();
  if (!data.success) {
    throw new Error(data.message || "서버가 저장 실패를 반환했습니다.");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initModalEvents();
  initSuggestModalEvents();
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

    if (isHoneypotTriggered(form)) return;

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
    const ip = await getIPAddress();
    const payload = {
      toolName: toolName,
      email: email,
      phone: phone,
      ip: ip,
      ...getSourceContext()
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
      // 서버가 실제로 저장에 성공했음을 확인한 뒤에만 완료로 처리합니다.
      await submitLeadToGAS(payload);

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

/**
 * 💡 원하는 자동화 기능 제안 모달 제어 및 데이터 수집 핸들러
 */
function initSuggestModalEvents() {
  const modal = document.getElementById("suggest-modal");
  const openBtn = document.getElementById("suggest-open-btn");
  const triggerCard = document.getElementById("suggest-trigger-card");
  const closeBtn = document.getElementById("suggest-close-btn");
  const form = document.getElementById("rpa-suggest-form");
  
  const messageInput = document.getElementById("suggest-message");
  const emailInput = document.getElementById("suggest-email");
  const phoneInput = document.getElementById("suggest-phone");
  const submitBtn = document.getElementById("suggest-submit-btn");

  const messageError = document.getElementById("suggest-message-error");
  const emailError = document.getElementById("suggest-email-error");
  const phoneError = document.getElementById("suggest-phone-error");

  if (!modal || !form) return;

  // 1. 모달 팝업 열기 (카드 클릭 또는 버튼 클릭 시)
  const openModal = (e) => {
    e.preventDefault();
    form.reset();
    clearErrors();
    modal.classList.add("show");
  };

  if (openBtn) openBtn.addEventListener("click", openModal);
  if (triggerCard) {
    // 카드 자체를 클릭해도 모달이 열리도록 하되, 버튼 클릭과 이벤트 겹치지 않게 조절
    triggerCard.addEventListener("click", (e) => {
      if (e.target !== openBtn && !openBtn.contains(e.target)) {
        openModal(e);
      }
    });
  }

  // 2. 모달 팝업 닫기
  const closeModal = () => {
    modal.classList.remove("show");
    clearErrors();
  };

  if (closeBtn) closeBtn.addEventListener("click", closeModal);
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

  // 에러 메시지 초기화 헬퍼
  function clearErrors() {
    if (messageError) messageError.style.display = "none";
    if (emailError) emailError.style.display = "none";
    if (phoneError) phoneError.style.display = "none";
    
    messageInput.style.borderColor = "";
    emailInput.style.borderColor = "";
    phoneInput.style.borderColor = "";
    
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<i class="fas fa-paper-plane"></i> 아이디어 제안 제출하기`;
  }

  // 4. 폼 전송 핸들러
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearErrors();

    if (isHoneypotTriggered(form)) return;

    const message = messageInput.value.trim();
    const email = emailInput.value.trim();
    const phone = phoneInput.value.trim();

    // 유효성 검사
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^010-\d{3,4}-\d{4}$/;

    let hasError = false;

    if (message.length < 10) {
      if (messageError) {
        messageError.innerText = "상세한 분석을 위해 10자 이상 작성해 주세요.";
        messageError.style.display = "block";
      }
      messageInput.style.borderColor = "#f87171";
      hasError = true;
    }

    if (!emailRegex.test(email)) {
      if (emailError) emailError.style.display = "block";
      emailInput.style.borderColor = "#f87171";
      hasError = true;
    }

    // 휴대폰 번호는 선택 항목이므로 입력되었을 때만 형식 검사
    if (phone && !phoneRegex.test(phone)) {
      if (phoneError) phoneError.style.display = "block";
      phoneInput.style.borderColor = "#f87171";
      hasError = true;
    }

    if (hasError) return;

    // 전송 상태 UI
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> 제안 전송 중...`;

    const ip = await getIPAddress();
    // 폼 데이터 페이로드 구성 (기존 구글 Apps Script의 '홈페이지 문의 분기'와 완벽 호환되도록 구성)
    const payload = {
      type: "자동화 아이디어 제안",
      name: "아이디어 제안자",
      email: email,
      phone: phone || "미입력",
      message: message,
      ip: ip,
      ...getSourceContext()
    };

    // GA4 분석 이벤트 트리깅
    if (typeof window.gtag === "function") {
      window.gtag("event", "rpa_suggest_submit", {
        message_length: message.length
      });
    }

    if (GOOGLE_SHEET_WEBAPP_URL === "YOUR_GOOGLE_APPS_SCRIPT_WEBAPP_URL_HERE") {
      console.log("[RPA 아이디어 제안 - 테스트 모드]", payload);
      setTimeout(() => {
        showToast("제안이 제출되었습니다! (구글 스크립트 연동 대기 중)");
        closeModal();
      }, 1000);
      return;
    }

    try {
      // 서버가 실제로 저장에 성공했음을 확인한 뒤에만 완료로 처리합니다.
      await submitLeadToGAS(payload);

      const successMsg = `업무 자동화 아이디어 제안을 성공적으로 접수했습니다.<br>보내주신 의견을 신중히 검토하여, 빠른 시일 내에 유용한 도구로 출시하겠습니다. 소중한 의견 감사합니다!`;
      
      if (typeof window.showSuccessModal === "function") {
        window.showSuccessModal("아이디어 제안 완료", successMsg, "확인");
      } else {
        showToast("아이디어 제안이 정상적으로 제출되었습니다!");
      }
      closeModal();
    } catch (err) {
      console.error("Google Apps Script Submit Error: ", err);
      showToast("전송 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.", "error");
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<i class="fas fa-paper-plane"></i> 아이디어 제안 제출하기`;
    }
  });
}
