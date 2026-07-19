/**
 * modules/tiff-converter.js
 * 100% 클라이언트 사이드 TIFF to PNG 변환기 비즈니스 로직
 * 외부 라이브러리 의존성: UTIF.js (디코딩), JSZip (ZIP 압축) - tiff-to-png.html 에서 CDN 로드
 */

// 1. 상태 관리 객체 (State)
const state = {
  queue: [],
  isConverting: false,
};

// 2. 초기화 및 이벤트 바인딩
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  bindEvents();
  renderQueue();
});

// 기존 사이트 테마 연동 (body 클래스 변경 감지 및 연동)
function initTheme() {
  const savedTheme = localStorage.getItem("portfolio-theme") || "gold";
  if (savedTheme === "teal") {
    document.body.classList.add("theme-teal");
  } else {
    document.body.classList.remove("theme-teal");
  }

  // 테마 토글 버튼 연동
  const themeBtn = document.getElementById("theme-toggle-btn");
  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      setTimeout(() => {
        const currentTheme = document.body.classList.contains("theme-teal") ? "teal" : "gold";
        localStorage.setItem("portfolio-theme", currentTheme);
      }, 50);
    });
  }
}

// 3. UI 알림 (Toast) 구현
function getOrCreateToastContainer() {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }
  return container;
}

function showToast(message, type = "success", duration = 3000) {
  const container = getOrCreateToastContainer();
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  
  const iconClass = type === "success" 
    ? "fa-check-circle" 
    : type === "warning" 
      ? "fa-exclamation-triangle" 
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
  }, duration);
}

// 4. 이벤트 핸들러 바인딩
function bindEvents() {
  const form = document.getElementById("tiff-form");
  const dropzone = document.getElementById("tiff-dropzone");
  const fileInput = document.getElementById("tiff-files");
  const resultsList = document.getElementById("tiff-results-list");

  form.addEventListener("submit", handleFormSubmit);
  
  document.getElementById("tiff-clear-all").addEventListener("click", clearAllFiles);
  document.getElementById("tiff-clear-completed").addEventListener("click", clearCompletedFiles);
  document.getElementById("tiff-download-all").addEventListener("click", downloadAllFiles);

  // 드롭존 클릭 이벤트
  dropzone.addEventListener("click", () => fileInput.click());
  dropzone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      fileInput.click();
    }
  });

  fileInput.addEventListener("click", (event) => event.stopPropagation());
  fileInput.addEventListener("change", (event) => {
    addFiles(event.target.files);
    event.target.value = "";
  });

  // 드래그 앤 드롭 이벤트 처리
  ["dragenter", "dragover"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.add("dragover");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.remove("dragover");
    });
  });

  dropzone.addEventListener("drop", (event) => {
    if (event.dataTransfer.files) {
      addFiles(event.dataTransfer.files);
    }
  });

  // 대기열 내 개별 액션 (삭제, 다운로드) 위임 이벤트
  resultsList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-tiff-action]");
    if (!button || state.isConverting) return;

    const action = button.dataset.tiffAction;
    const fileId = button.dataset.tiffId;

    if (action === "remove") removeFile(fileId);
    if (action === "download") downloadSingleFile(fileId);
  });

  // 배경 처리 셀렉트 변경 시 색상 선택기 활성화 여부 조절
  const bgSelect = document.getElementById("tiff-background");
  const customColorWrapper = document.getElementById("tiff-custom-color-wrapper");
  bgSelect.addEventListener("change", (event) => {
    if (event.target.value === "custom") {
      customColorWrapper.style.display = "block";
    } else {
      customColorWrapper.style.display = "none";
    }
  });

  // 흰색 배경 제거 체크박스 변경 시 오차 설정 토글
  const removeWhiteCheck = document.getElementById("tiff-remove-white");
  const toleranceWrapper = document.getElementById("tiff-tolerance-wrapper");
  removeWhiteCheck.addEventListener("change", (event) => {
    if (event.target.checked) {
      toleranceWrapper.style.display = "block";
    } else {
      toleranceWrapper.style.display = "none";
    }
  });
}

// 5. 대기열 추가 및 검증
function isTiffFile(file) {
  const name = file.name.toLowerCase();
  return name.endsWith(".tif") || name.endsWith(".tiff") || file.type === "image/tiff";
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024).toLocaleString()} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function addFiles(fileList) {
  if (state.isConverting) {
    showToast("변환 작업 중에는 파일을 대기열에 추가할 수 없습니다.", "warning");
    return;
  }

  const incoming = Array.from(fileList);
  const validFiles = incoming.filter(isTiffFile);
  const rejectedCount = incoming.length - validFiles.length;
  let addedCount = 0;

  validFiles.forEach((file) => {
    const isDuplicate = state.queue.some(
      (item) => item.file.name === file.name && item.file.size === file.size
    );
    if (isDuplicate) return;

    state.queue.push({
      id: `tiff-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      file,
      status: "pending", // pending, processing, success, error
      message: "대기 중",
      progress: 0,
      outputName: "",
      outputBlob: null,
      outputUrl: "",
      outputSize: 0,
      frameCount: 1,
      convertedFrames: [] // 멀티프레임 개별 변환 데이터 보관용
    });
    addedCount += 1;
  });

  if (addedCount > 0) showToast(`${addedCount}개의 TIFF 파일을 대기열에 추가했습니다.`);
  if (rejectedCount > 0) showToast(`${rejectedCount}개의 파일은 TIFF 포맷이 아니라 제외되었습니다.`, "warning");
  
  renderQueue();
}

// 6. UI 대기열 렌더링
function renderQueue() {
  const listElement = document.getElementById("tiff-results-list");
  const countElement = document.getElementById("tiff-count");
  const startBtn = document.getElementById("tiff-start");
  const clearAllBtn = document.getElementById("tiff-clear-all");
  const clearCompletedBtn = document.getElementById("tiff-clear-completed");
  const downloadAllBtn = document.getElementById("tiff-download-all");

  const successItems = state.queue.filter((item) => item.status === "success");
  const pendingItems = state.queue.filter((item) => item.status === "pending");
  const hasItems = state.queue.length > 0;

  countElement.textContent = String(successItems.length);
  startBtn.disabled = pendingItems.length === 0 || state.isConverting;
  clearAllBtn.disabled = !hasItems || state.isConverting;
  clearCompletedBtn.disabled = successItems.length === 0 || state.isConverting;
  downloadAllBtn.disabled = successItems.length === 0;

  if (!hasItems) {
    listElement.innerHTML = `
      <div class="empty-state">
        <i class="far fa-image"></i>
        대기열이 비어 있습니다.<br>변환할 TIFF 파일을 추가해 주세요.
      </div>
    `;
    return;
  }

  listElement.innerHTML = state.queue
    .map((item) => {
      const isSuccess = item.status === "success";
      const isProcessing = item.status === "processing";
      
      let previewHtml = `<span class="tiff-thumb-icon"><i class="far fa-file-image"></i></span>`;
      if (isSuccess && item.outputUrl && item.frameCount === 1) {
        previewHtml = `<img src="${item.outputUrl}" alt="${escapeHtml(item.outputName)}">`;
      } else if (isSuccess && item.frameCount > 1) {
        previewHtml = `<span class="tiff-thumb-icon" style="color:var(--accent-teal);"><i class="fas fa-file-archive"></i></span>`;
      }

      let statusLabel = "대기";
      if (isProcessing) statusLabel = "변환 중";
      if (isSuccess) statusLabel = "완료";
      if (item.status === "error") statusLabel = "실패";

      const badgeClass = `status-${item.status}`;
      const statusText = isSuccess
        ? `${escapeHtml(item.outputName)} / ${formatBytes(item.outputSize)}`
        : escapeHtml(item.message);

      const downloadButton = isSuccess
        ? `<button class="card-btn download-btn" type="button" data-tiff-action="download" data-tiff-id="${item.id}" title="다운로드"><i class="fas fa-download"></i></button>`
        : "";
      const removeButton = isProcessing
        ? ""
        : `<button class="card-btn delete-btn" type="button" data-tiff-action="remove" data-tiff-id="${item.id}" title="삭제"><i class="far fa-trash-alt"></i></button>`;

      return `
        <article class="tiff-card ${item.status}">
          <div class="tiff-thumb">${previewHtml}</div>
          <div class="tiff-meta">
            <div class="tiff-meta-top">
              <strong class="tiff-filename" title="${escapeHtml(item.file.name)}">${escapeHtml(item.file.name)}</strong>
              <span class="badge ${badgeClass}">${statusLabel}</span>
            </div>
            <span class="tiff-size">${formatBytes(item.file.size)}</span>
            <div class="tiff-status-desc">${statusText}</div>
            <div class="progress-bar-container">
              <div class="progress-bar" style="width: ${item.progress}%"></div>
            </div>
          </div>
          <div class="card-actions">
            ${downloadButton}
            ${removeButton}
          </div>
        </article>
      `;
    })
    .join("");
}

// 7. 개별 파일 및 전체 대기열 액션
function removeFile(id) {
  const item = state.queue.find((entry) => entry.id === id);
  if (item && item.outputUrl) {
    URL.revokeObjectURL(item.outputUrl);
  }
  state.queue = state.queue.filter((entry) => entry.id !== id);
  renderQueue();
}

function clearAllFiles() {
  state.queue.forEach((item) => {
    if (item.outputUrl) URL.revokeObjectURL(item.outputUrl);
  });
  state.queue = [];
  renderQueue();
}

function clearCompletedFiles() {
  const completed = state.queue.filter((item) => item.status === "success");
  completed.forEach((item) => {
    if (item.outputUrl) URL.revokeObjectURL(item.outputUrl);
  });
  state.queue = state.queue.filter((item) => item.status !== "success");
  renderQueue();
}

function downloadSingleFile(id) {
  const item = state.queue.find((entry) => entry.id === id);
  if (!item || !item.outputUrl) return;

  const link = document.createElement("a");
  link.href = item.outputUrl;
  link.download = item.outputName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function downloadAllFiles() {
  const completed = state.queue.filter((item) => item.status === "success");
  if (completed.length === 0) return;

  completed.forEach((item) => {
    downloadSingleFile(item.id);
  });
  
  showToast(`${completed.length}개 변환 완료 파일의 다운로드를 시작합니다.`);
  trackEvent("tiff_download_all", { file_count: completed.length });
}

// 8. 폼 제출 및 핵심 변환 알고리즘 호출
async function handleFormSubmit(event) {
  event.preventDefault();
  const pendingItems = state.queue.filter((item) => item.status === "pending");
  if (pendingItems.length === 0) {
    showToast("변환할 대기 파일이 없습니다.", "warning");
    return;
  }

  state.isConverting = true;
  renderQueue();

  // 설정값 추출
  const config = {
    backgroundMode: document.getElementById("tiff-background").value,
    customBackground: document.getElementById("tiff-custom-color").value,
    removeWhite: document.getElementById("tiff-remove-white").checked,
    whiteTolerance: parseInt(document.getElementById("tiff-white-tolerance").value, 10),
    filenameSuffix: document.getElementById("tiff-suffix").value.trim(),
    resizeMode: document.getElementById("tiff-resize-mode").value,
    minLongEdge: parseInt(document.getElementById("tiff-min-edge").value, 10) || 1600,
    maxWidth: parseInt(document.getElementById("tiff-max-width").value, 10) || 2000,
    maxHeight: parseInt(document.getElementById("tiff-max-height").value, 10) || 2000,
  };

  trackEvent("tiff_convert_start", { file_count: pendingItems.length });

  for (const item of pendingItems) {
    item.status = "processing";
    item.progress = 10;
    item.message = "파일 디코딩 중...";
    renderQueue();

    try {
      // FileReader를 통해 ArrayBuffer 로드
      const arrayBuffer = await readFileAsArrayBuffer(item.file);
      item.progress = 30;
      item.message = "이미지 연산 가공 중...";
      renderQueue();

      // TIFF 디코딩 (UTIF.js 라이브러리 사용)
      const ifds = UTIF.decode(arrayBuffer);
      if (!ifds || ifds.length === 0) {
        throw new Error("TIFF 이미지 데이터를 디코딩하지 못했습니다.");
      }

      item.frameCount = ifds.length;
      const pages = [];
      const cleanName = cleanFilename(item.file.name);
      const outputStem = cleanName + config.filenameSuffix;

      // 각 프레임(페이지)별 디코딩 및 가공
      for (let i = 0; i < ifds.length; i++) {
        UTIF.decodeImage(arrayBuffer, ifds[i]);
        const rgba = UTIF.toRGBA8(ifds[i]); // Uint8ClampedArray
        const width = ifds[i].width;
        const height = ifds[i].height;

        // 픽셀 가공 처리 (흰색 배경 제거)
        if (config.removeWhite) {
          removeWhiteBackground(rgba, config.whiteTolerance);
        }

        // 캔버스 가공 (리사이즈 & 배경 처리)
        const frameBlob = await processCanvasFrame(rgba, width, height, config);
        const frameName = ifds.length > 1 
          ? `${outputStem}_page${String(i + 1).padStart(2, "0")}.png`
          : `${outputStem}.png`;

        pages.push({ blob: frameBlob, name: frameName });
        
        // 멀티프레임 진행률 업데이트 보정
        const frameProgress = 30 + Math.round((i + 1) / ifds.length * 60);
        item.progress = Math.min(90, frameProgress);
        item.message = `페이지 처리 중 (${i + 1}/${ifds.length})`;
        renderQueue();
      }

      // 결과 생성
      if (pages.length === 1) {
        // 단일 이미지인 경우 PNG
        const result = pages[0];
        item.outputBlob = result.blob;
        item.outputName = result.name;
        item.outputUrl = URL.createObjectURL(result.blob);
        item.outputSize = result.blob.size;
      } else {
        // 멀티페이지인 경우 ZIP 아카이빙 (JSZip 사용)
        item.message = "ZIP 패키지 생성 중...";
        renderQueue();
        
        const zip = new JSZip();
        pages.forEach((p) => zip.file(p.name, p.blob));
        
        const zipBlob = await zip.generateAsync({ type: "blob" });
        item.outputBlob = zipBlob;
        item.outputName = `${outputStem}_png.zip`;
        item.outputUrl = URL.createObjectURL(zipBlob);
        item.outputSize = zipBlob.size;
      }

      item.status = "success";
      item.progress = 100;
      item.message = "변환 완료";
    } catch (err) {
      console.error(err);
      item.status = "error";
      item.progress = 100;
      item.message = err.message || "변환 오류 발생";
    }

    renderQueue();
  }

  state.isConverting = false;
  renderQueue();
  showToast("TIFF 변환 작업이 모두 완료되었습니다.");
  
  const successCount = pendingItems.filter((i) => i.status === "success").length;
  const statusResult = successCount === pendingItems.length ? "성공" : (successCount > 0 ? "부분성공" : "실패");
  logRpaUsage("TIFF변환기", statusResult);

  trackEvent("tiff_convert_success", { 
    total: pendingItems.length,
    success: successCount,
    error: pendingItems.length - successCount
  });
}

// 9. 파일 로드 헬퍼 (Promise)
function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("파일을 읽는 도중 오류가 발생했습니다."));
    reader.readAsArrayBuffer(file);
  });
}

// 10. 흰색 배경 제거 알고리즘 (Pillow _remove_near_white_background 싱크)
function removeWhiteBackground(rgba, tolerance) {
  const length = rgba.length;
  for (let i = 0; i < length; i += 4) {
    const r = rgba[i];
    const g = rgba[i + 1];
    const b = rgba[i + 2];
    const a = rgba[i + 3];

    const minVal = Math.min(r, g, b);
    const whiteDistance = 255 - minVal;

    if (whiteDistance <= tolerance) {
      if (tolerance <= 0) {
        rgba[i + 3] = 0;
      } else {
        const factor = whiteDistance / tolerance;
        rgba[i + 3] = Math.round(a * factor);
      }
    }
  }
}

// 11. Canvas API를 이용한 크기 조절 & 배경 합성 가공 (Promise)
function processCanvasFrame(rgba, width, height, config) {
  return new Promise((resolve) => {
    // 1. 타깃 해상도 비율 계산
    let targetWidth = width;
    let targetHeight = height;

    if (config.resizeMode === "upscale") {
      const longEdge = Math.max(width, height);
      if (longEdge < config.minLongEdge) {
        const scale = config.minLongEdge / longEdge;
        targetWidth = Math.round(width * scale);
        targetHeight = Math.round(height * scale);
      }
    } else if (config.resizeMode === "downscale") {
      const scale = Math.min(config.maxWidth / width, config.maxHeight / height);
      if (scale < 1) {
        targetWidth = Math.round(width * scale);
        targetHeight = Math.round(height * scale);
      }
    }

    // 2. 목적 캔버스 생성
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");

    // 3. 배경색 깔아주기
    if (config.backgroundMode !== "transparent") {
      const colors = {
        white: "#ffffff",
        black: "#000000",
        custom: config.customBackground
      };
      ctx.fillStyle = colors[config.backgroundMode] || "#ffffff";
      ctx.fillRect(0, 0, targetWidth, targetHeight);
    }

    // 4. 원본 픽셀 이미지를 임시 캔버스에 그리기 (원래 크기)
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext("2d");
    const imgData = tempCtx.createImageData(width, height);
    imgData.data.set(rgba);
    tempCtx.putImageData(imgData, 0, 0);

    // 5. 임시 캔버스에서 목적 캔버스로 리사이징 드로잉
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(tempCanvas, 0, 0, targetWidth, targetHeight);

    // 6. PNG Blob으로 변환하여 반환
    canvas.toBlob((blob) => {
      resolve(blob);
    }, "image/png");
  });
}

// 12. 유틸리티 및 특수문자 제거
function cleanFilename(val) {
  // 확장자 제거 및 파일명 정제
  const stem = val.replace(/\.[^/.]+$/, "");
  return stem.replace(/[<>:"/\\|?*]/g, "_").trim() || "converted";
}

function escapeHtml(string) {
  if (!string) return "";
  return String(string)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// GA4 / GTM 이벤트 트래킹 전송 브릿지
function trackEvent(eventName, params = {}) {
  if (typeof window.gtag === "function") {
    window.gtag("event", eventName, params);
  } else {
    console.log(`[Tracking Event Log] ${eventName}`, params);
  }
}

// RPA 작동 이력 수집 헬퍼 함수
function logRpaUsage(programName, status) {
  const gasUrl = window.APP_CONFIG?.GAS_WEBAPP_URL || 'https://script.google.com/macros/s/AKfycbwPXMJA-q3BFlDhLQX_rw1BtFWp5qSewHumJ-VA4fBD_-6NrrRusoqcGTGHhjTHnIGhYA/exec';
  const fetchIP = window.APP_UTILS?.getIPAddress || (() => Promise.resolve('알 수 없음'));
  
  fetchIP()
    .then(ip => {
      const payload = {
        type: 'RPA작동로그',
        programName: programName,
        status: status,
        ip: ip
      };
      
      return fetch(gasUrl, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify(payload)
      });
    })
    .catch(err => {
      console.error('RPA 사용 로그 전송 실패:', err);
    });
}
