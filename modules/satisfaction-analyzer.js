/**
 * modules/satisfaction-analyzer.js
 * 만족도 분석 & 보고서 생성기 비즈니스 로직 스크립트
 */

document.addEventListener("DOMContentLoaded", () => {
  initAnalyzer();
});

// 전역 상태 객체
let parsedHeaders = [];
let parsedRows = [];
let columnMappings = {}; // { colIndex: 'score' | 'text' | 'meta' | 'exclude' }
let satisfactionData = []; // 실제 로우 데이터 객체 리스트
let analysisResults = null;

/**
 * 만족도 분석기 초기화
 */
function initAnalyzer() {
  const fileInput = document.getElementById("csv-file");
  const pasteArea = document.getElementById("paste-area");
  const btnAnalyze = document.getElementById("btn-analyze");
  const btnSample = document.getElementById("btn-sample");
  
  // 탭 제어
  const tabBtns = document.querySelectorAll(".tab-btn");
  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      
      const tabTarget = btn.dataset.tab;
      document.querySelectorAll(".tab-content").forEach((content) => {
        content.classList.remove("active");
      });
      document.getElementById(`${tabTarget}-content`).classList.add("active");
    });
  });

  // 파일 업로드 이벤트
  if (fileInput) {
    fileInput.addEventListener("change", handleFileUpload);
  }

  // 붙여넣기 텍스트 분석
  if (btnAnalyze) {
    btnAnalyze.addEventListener("click", handleTextAnalyze);
  }

  // 샘플 데이터 로드
  if (btnSample) {
    btnSample.addEventListener("click", loadSampleData);
  }

  // 드래그 앤 드롭 업로드 효과
  const dropZone = document.querySelector(".file-upload-label");
  if (dropZone) {
    ["dragenter", "dragover"].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropZone.classList.add("dragover");
      }, false);
    });

    ["dragleave", "drop"].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropZone.classList.remove("dragover");
      }, false);
    });

    dropZone.addEventListener("drop", (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files.length > 0 && fileInput) {
        fileInput.files = files;
        handleFileUpload({ target: fileInput });
      }
    }, false);
  }
}

/**
 * 1. UTF-8 / CP949 인코딩 판별용 유효성 함수
 */
function isUTF8(bytes) {
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i];
    if (b <= 0x7F) {
      i += 1;
    } else if ((b & 0xE0) === 0xC0) {
      if (i + 1 >= bytes.length || (bytes[i + 1] & 0xC0) !== 0x80) return false;
      i += 2;
    } else if ((b & 0xF0) === 0xE0) {
      if (i + 2 >= bytes.length || (bytes[i + 1] & 0xC0) !== 0x80 || (bytes[i + 2] & 0xC0) !== 0x80) return false;
      i += 3;
    } else if ((b & 0xF8) === 0xF0) {
      if (i + 3 >= bytes.length || (bytes[i + 1] & 0xC0) !== 0x80 || (bytes[i + 2] & 0xC0) !== 0x80 || (bytes[i + 3] & 0xC0) !== 0x80) return false;
      i += 4;
    } else {
      return false;
    }
  }
  return true;
}

/**
 * 파일 업로드 처리 핸들러 (인코딩 자동 감지)
 */
function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  showLoading(true);

  // 1단계: ArrayBuffer로 일부를 읽어 인코딩 확인
  const reader = new FileReader();
  reader.onload = function(evt) {
    const buffer = evt.target.result;
    const bytes = new Uint8Array(buffer);
    const checkLen = Math.min(bytes.length, 10240); // 앞 10KB 검증
    const checkBytes = bytes.subarray(0, checkLen);
    
    // UTF-8 검증 결과에 따라 인코딩 결정
    const encoding = isUTF8(checkBytes) ? "utf-8" : "euc-kr";
    
    // 2단계: 결정된 인코딩으로 텍스트 파일 읽기
    const textReader = new FileReader();
    textReader.onload = function(textEvt) {
      const csvText = textEvt.target.result;
      processRawData(csvText, ",", encoding);
    };
    textReader.onerror = function() {
      showToast("파일을 읽는 중 오류가 발생했습니다.", "error");
      showLoading(false);
    };
    textReader.readAsText(file, encoding);
  };
  
  reader.onerror = function() {
    showToast("파일 헤더를 읽는 중 오류가 발생했습니다.", "error");
    showLoading(false);
  };
  reader.readAsArrayBuffer(file);
}

/**
 * 붙여넣기 텍스트 분석 핸들러
 */
function handleTextAnalyze() {
  const text = document.getElementById("paste-area").value.trim();
  if (!text) {
    showToast("붙여넣은 표 데이터가 비어 있습니다.", "error");
    return;
  }

  showLoading(true);
  
  // 구분자 자동 판별: 탭 문자가 1개 이상 들어있으면 TSV, 없으면 CSV로 판단
  const delimiter = text.includes("\t") ? "\t" : ",";
  
  setTimeout(() => {
    processRawData(text, delimiter, "clipboard");
  }, 100);
}

/**
 * 2. RFC 4180 호환 경량 CSV/TSV 파서
 * 큰따옴표 내 줄바꿈(개행) 및 쉼표/탭 포함 케이스 대응
 */
function parseRFC4180(text, delimiter = ",") {
  const rows = [];
  let currentRow = [];
  let currentField = "";
  let inQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];
    
    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentField += '"';
          i++; // escaped quote 건너뜀
        } else {
          inQuotes = false; // 따옴표 닫힘
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        currentRow.push(currentField);
        currentField = "";
      } else if (char === "\r" || char === "\n") {
        currentRow.push(currentField);
        currentField = "";
        
        // 빈 줄이 아니면 로우에 삽입
        if (currentRow.length > 0 && (currentRow.length > 1 || currentRow[0] !== "")) {
          rows.push(currentRow);
        }
        currentRow = [];
        
        // \r\n 윈도우 개행 대응
        if (char === "\r" && nextChar === "\n") {
          i++;
        }
      } else {
        currentField += char;
      }
    }
  }
  
  // 마지막 필드 잔여 처리
  if (currentField !== "" || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }
  
  return rows;
}

/**
 * 로 데이터 처리 메인 로직
 */
function processRawData(rawText, delimiter, sourceInfo = "") {
  try {
    const rows = parseRFC4180(rawText, delimiter);
    if (rows.length < 2) {
      showToast("데이터 행이 부족합니다. (최소 헤더 1행, 데이터 1행 필요)", "error");
      showLoading(false);
      return;
    }

    // 헤더 처리 (중복 제거 및 빈 헤더 대체)
    parsedHeaders = rows[0].map((h, index) => {
      let cleaned = h.trim();
      if (!cleaned) return `컬럼 ${index + 1}`;
      return cleaned;
    });

    // 중복 헤더 검사 및 보완
    const seenHeaders = {};
    parsedHeaders = parsedHeaders.map((h) => {
      if (seenHeaders[h]) {
        seenHeaders[h]++;
        return `${h}_${seenHeaders[h]}`;
      } else {
        seenHeaders[h] = 1;
        return h;
      }
    });

    // 데이터 바디 로드 (헤더 크기와 맞춰 자름)
    parsedRows = rows.slice(1).map((row) => {
      // 로우 길이가 헤더와 다르면 맞춤
      if (row.length < parsedHeaders.length) {
        return row.concat(Array(parsedHeaders.length - row.length).fill(""));
      }
      return row.slice(0, parsedHeaders.length);
    });

    // 로컬 스토리지에 데이터 캐싱 (기존 로드 상태 유지 대비)
    try {
      localStorage.setItem("rpa_analyzer_raw", JSON.stringify({
        headers: parsedHeaders,
        rows: parsedRows
      }));
    } catch (e) {
      console.warn("Storage quota exceeded, cache skipped.");
    }

    // 컬럼 자동 분류 수행
    autoClassifyColumns();

    // 1차 리뷰 테이블 렌더링
    renderReviewTable();
    
    // UI 상태 전환: Review 단계로 이동
    switchState("review");
    showToast(`데이터 파싱 완료 (${parsedRows.length}행 로드, 인코딩: ${sourceInfo.toUpperCase()})`);
  } catch (err) {
    console.error(err);
    showToast("데이터 해석 중 치명적인 오류가 발생했습니다.", "error");
  } finally {
    showLoading(false);
  }
}

/**
 * 3. 컬럼 자동 분류 알고리즘
 */
function autoClassifyColumns() {
  columnMappings = {};
  
  // 개인정보 감지용 키워드 (대소문자 무관)
  const privacyKeywords = [
    "이름", "성명", "성함", "휴대폰", "핸드폰", "연락처", "전화", "이메일", "email", 
    "mail", "소속", "회사", "부서", "직급", "주소", "사번", "주민번호", "생년월일", 
    "성별", "나이", "연령", "name", "tel", "phone", "addr", "gender", "age", 
    "birth", "company", "dept", "학번", "직책"
  ];

  // 점수 문항 가중치 키워드
  const scoreKeywords = [
    "만족", "추천", "이해", "도움", "강사", "교육", "운영", "내용", "난이도", "전반", "평가", "NPS", "순추천"
  ];

  // 주관식 문항 가중치 키워드
  const textKeywords = [
    "의견", "소감", "좋았던", "아쉬운", "개선", "기타", "코멘트", "comment", "feedback"
  ];

  for (let colIdx = 0; colIdx < parsedHeaders.length; colIdx++) {
    const colName = parsedHeaders[colIdx].toLowerCase();
    const values = parsedRows.map(row => row[colIdx].trim()).filter(v => v !== "");
    
    // 1. 개인정보 필터링 우선
    const isPrivacy = privacyKeywords.some(keyword => colName.includes(keyword));
    if (isPrivacy) {
      columnMappings[colIdx] = "exclude"; // 기본 분석 제외
      continue;
    }

    // 데이터 값 분석
    let numberCount = 0;
    let totalLen = 0;
    let maxVal = 0;
    let minVal = 999;
    
    values.forEach(v => {
      const num = Number(v);
      if (!isNaN(num) && v !== "") {
        numberCount++;
        if (num > maxVal) maxVal = num;
        if (num < minVal) minVal = num;
      }
      totalLen += v.length;
    });

    const numRatio = values.length > 0 ? (numberCount / values.length) : 0;
    const avgLen = values.length > 0 ? (totalLen / values.length) : 0;

    // 2. 점수 문항 조건: 응답의 70% 이상이 숫자이며, 최댓값이 10 이하, 최솟값이 0 이상인 경우
    if (numRatio >= 0.7 && values.length > 0 && maxVal <= 10 && minVal >= 0) {
      columnMappings[colIdx] = "score";
      continue;
    }

    // 3. 컬럼명 키워드 가중치 기반 분류
    const hasScoreWord = scoreKeywords.some(kw => colName.includes(kw));
    const hasTextWord = textKeywords.some(kw => colName.includes(kw));

    if (hasScoreWord && !hasTextWord && numRatio > 0.3) {
      columnMappings[colIdx] = "score";
    } else if (hasTextWord || avgLen >= 8) {
      columnMappings[colIdx] = "text";
    } else {
      columnMappings[colIdx] = "meta"; // 그 외에는 기본 메타 정보로 설정
    }
  }
}

/**
 * 리뷰 테이블 렌더링 (수동 컬럼 분류 조정 UI 포함)
 */
function renderReviewTable() {
  const container = document.getElementById("review-table-container");
  if (!container) return;

  let html = `
    <table class="review-table">
      <thead>
        <tr>
          <th style="width: 30%;">컬럼 이름 (문항명)</th>
          <th style="width: 25%;">분류 설정</th>
          <th style="width: 45%;">데이터 샘플</th>
        </tr>
      </thead>
      <tbody>
  `;

  parsedHeaders.forEach((header, idx) => {
    const currentMapping = columnMappings[idx] || "meta";
    
    // 샘플 2개 가져오기
    const samples = parsedRows
      .slice(0, 2)
      .map(row => row[idx])
      .filter(v => v !== undefined)
      .map(v => v.length > 30 ? v.substring(0, 28) + "..." : v);
    
    const sampleText = samples.length > 0 
      ? samples.map(s => `<code>${escapeHtml(s)}</code>`).join(" / ") 
      : `<span class="empty-text">(데이터 없음)</span>`;

    html += `
      <tr>
        <td class="col-header-name"><strong>${escapeHtml(header)}</strong></td>
        <td>
          <select class="column-type-select" data-col-idx="${idx}">
            <option value="score" ${currentMapping === "score" ? "selected" : ""}>📊 점수 문항 (만족도)</option>
            <option value="text" ${currentMapping === "text" ? "selected" : ""}>✍️ 주관식 문항</option>
            <option value="meta" ${currentMapping === "meta" ? "selected" : ""}>ℹ️ 메타 정보 (그룹용)</option>
            <option value="exclude" ${currentMapping === "exclude" ? "selected" : ""}>🚫 분석 제외 (개인정보)</option>
          </select>
        </td>
        <td class="col-sample-data">${sampleText}</td>
      </tr>
    `;
  });

  html += `
      </tbody>
    </table>
  `;

  container.innerHTML = html;

  // 이벤트 바인딩: 사용자가 드롭다운 설정을 변경하면 상태 업데이트
  const selects = container.querySelectorAll(".column-type-select");
  selects.forEach(select => {
    select.addEventListener("change", (e) => {
      const idx = parseInt(e.target.dataset.colIdx);
      const val = e.target.value;
      columnMappings[idx] = val;
    });
  });

  // 최종 분석 버튼 이벤트 바인딩
  const btnRunAnalysis = document.getElementById("btn-run-analysis");
  if (btnRunAnalysis) {
    btnRunAnalysis.onclick = runFinalAnalysis;
  }
}

/**
 * 최종 만족도 분석 실행 및 결과 생성
 */
function runFinalAnalysis() {
  showLoading(true);

  setTimeout(() => {
    try {
      // 1. 결과 데이터 초기화
      const orderedResults = [];
      const scoreCols = [];
      const textCols = [];
      const metaCols = [];
      
      parsedHeaders.forEach((h, idx) => {
        const mapping = columnMappings[idx];
        if (mapping === "score") scoreCols.push({ index: idx, name: h });
        else if (mapping === "text") textCols.push({ index: idx, name: h });
        else if (mapping === "meta") metaCols.push({ index: idx, name: h });
      });

      if (scoreCols.length === 0 && textCols.length === 0) {
        showToast("분석 대상 컬럼이 지정되지 않았습니다. 점수 또는 주관식을 최소 1개 지정하세요.", "error");
        showLoading(false);
        return;
      }

      const responseCount = parsedRows.length;

      // NPS 전체 대표 산정용 문항 선정 (컬럼명에 '추천', 'nps' 등이 들어간 첫 문항 또는 첫 번째 점수 문항)
      let npsCol = scoreCols.find(c => {
        const name = c.name.toLowerCase();
        return name.includes("추천") || name.includes("nps") || name.includes("순추천");
      });

      // 만약 NPS 전용 문항이 없으면 첫번째 만족도 문항으로 대체
      if (!npsCol && scoreCols.length > 0) {
        npsCol = scoreCols[0];
      }

      // 전체 헤더 순서대로 돌면서 순서가 보존된 orderedResults 생성
      parsedHeaders.forEach((h, idx) => {
        const mapping = columnMappings[idx];
        
        if (mapping === "score") {
          const rawScores = parsedRows
            .map(row => Number(row[idx]))
            .filter(v => !isNaN(v) && v !== null && v !== undefined && v !== 0); // 0점 제외 처리(일반적으로 미응답/결측치 처리)

          if (rawScores.length > 0) {
            // 해당 문항의 스케일 자동 인지 (최댓값 판단)
            const localMax = Math.max(...rawScores);
            const scale = localMax <= 5 ? 5 : 10;
            
            let sum = 0;
            let pCount = 0; // 긍정 수
            let dCount = 0; // 부정 수
            const frequencies = {};

            // 주파수 맵 초기화
            const maxLimit = scale === 5 ? 5 : 10;
            for (let i = 1; i <= maxLimit; i++) frequencies[i] = 0;
            if (scale === 10) frequencies[0] = 0;

            rawScores.forEach(val => {
              sum += val;
              const rounded = Math.round(val);
              if (frequencies[rounded] !== undefined) {
                frequencies[rounded]++;
              }
              
              if (scale === 5) {
                if (val >= 4) pCount++;
                if (val <= 2) dCount++;
              } else {
                if (val >= 8) pCount++;
                if (val <= 6) dCount++;
              }
            });

            const avg = sum / rawScores.length;
            const pRate = (pCount / rawScores.length) * 100;
            const dRate = (dCount / rawScores.length) * 100;

            // 중앙값(Median) 계산
            const sorted = [...rawScores].sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

            // 문항 개별 NPS 계산
            let localNps = null;
            let npsPromoters = 0;
            let npsDetractors = 0;
            
            rawScores.forEach(val => {
              if (scale === 5) {
                if (val === 5) npsPromoters++;
                if (val <= 3) npsDetractors++;
              } else {
                if (val >= 9) npsPromoters++;
                if (val <= 6) npsDetractors++;
              }
            });

            const npsPromoterRatio = (npsPromoters / rawScores.length) * 100;
            const npsDetractorRatio = (npsDetractors / rawScores.length) * 100;
            localNps = parseFloat((npsPromoterRatio - npsDetractorRatio).toFixed(1));

            orderedResults.push({
              type: "score",
              index: idx,
              name: h,
              scale: scale,
              responseCount: rawScores.length,
              average: parseFloat(avg.toFixed(2)),
              median: parseFloat(median.toFixed(2)),
              positiveRate: parseFloat(pRate.toFixed(1)),
              detractorRate: parseFloat(dRate.toFixed(1)),
              frequencies: frequencies,
              nps: localNps
            });
          }
        } else if (mapping === "text") {
          const responses = parsedRows
            .map(row => row[idx].trim())
            .filter(v => v !== "");
          
          orderedResults.push({
            type: "text",
            index: idx,
            name: h,
            responses: responses
          });
        }
      });

      // 2. 전체 요약 지표 산출
      let totalScoreSum = 0;
      let totalScoreCount = 0;
      let positiveCount = 0; // 긍정 응답 개수
      let totalValidScores = 0; // 전체 응답 수 * 점수 컬럼 수
      
      const scoreResults = orderedResults.filter(r => r.type === "score");
      
      scoreResults.forEach((q) => {
        const qSum = q.average * q.responseCount;
        totalScoreSum += qSum;
        totalScoreCount += q.responseCount;
        const pCount = Math.round((q.positiveRate / 100) * q.responseCount);
        positiveCount += pCount;
        totalValidScores += q.responseCount;
      });

      const overallAverage = totalScoreCount > 0 ? (totalScoreSum / totalScoreCount) : 0;
      const overallPositiveRate = totalValidScores > 0 ? (positiveCount / totalValidScores) * 100 : 0;

      // 전체 대표 NPS 연동 계산
      let globalNps = {
        value: null,
        colName: null,
        scale: "미지정",
        promoters: 0,
        detractors: 0
      };

      if (npsCol) {
        const npsMatch = scoreResults.find(r => r.index === npsCol.index);
        if (npsMatch) {
          const rawScores = parsedRows
            .map(row => Number(row[npsCol.index]))
            .filter(v => !isNaN(v) && v !== null && v !== undefined && v !== 0);

          if (rawScores.length > 0) {
            let npsPromoters = 0;
            let npsDetractors = 0;
            rawScores.forEach(val => {
              if (npsMatch.scale === 5) {
                if (val === 5) npsPromoters++;
                if (val <= 3) npsDetractors++;
              } else {
                if (val >= 9) npsPromoters++;
                if (val <= 6) npsDetractors++;
              }
            });

            const npsPromoterRatio = (npsPromoters / rawScores.length) * 100;
            const npsDetractorRatio = (npsDetractors / rawScores.length) * 100;
            globalNps = {
              value: npsMatch.nps,
              colName: npsCol.name,
              scale: `${npsMatch.scale}점 척도`,
              promoters: parseFloat(npsPromoterRatio.toFixed(1)),
              detractors: parseFloat(npsDetractorRatio.toFixed(1))
  };
          }
        }
      }

      // 전역 결과 캐싱
      analysisResults = {
        responseCount: responseCount,
        scoreQuestionCount: scoreResults.length,
        textQuestionCount: orderedResults.filter(r => r.type === "text").length,
        overallAverage: parseFloat(overallAverage.toFixed(2)),
        overallPositiveRate: parseFloat(overallPositiveRate.toFixed(1)),
        nps: globalNps,
        orderedResults: orderedResults
      };

      // 3. 결과 대시보드 그리기
      renderDashboard();
      switchState("result");
      showToast("분석 보고서 생성이 완료되었습니다!");
    } catch (err) {
      console.error(err);
      showToast("분석 처리 도중 에러가 발생했습니다.", "error");
    } finally {
      showLoading(false);
    }
  }, 200);
}

/**
 * NPS 점수 스타일링 헬퍼 (라이트 모드 고정형)
 */
function getNpsStyle(nps) {
  if (nps === null || nps === undefined) {
    return "background: rgba(71, 85, 105, 0.08); color: #64748b; border: 1px solid rgba(71, 85, 105, 0.25);";
  }
  const val = Number(nps);
  
  if (val >= 70) {
    return "background: rgba(16, 185, 129, 0.1); color: #047857; border: 1px solid rgba(16, 185, 129, 0.25);";
  }
  if (val >= 30) {
    return "background: rgba(59, 130, 246, 0.1); color: #1d4ed8; border: 1px solid rgba(59, 130, 246, 0.25);";
  }
  if (val < 0) {
    return "background: rgba(239, 68, 68, 0.1); color: #b91c1c; border: 1px solid rgba(239, 68, 68, 0.25);";
  }
  return "background: rgba(245, 158, 11, 0.1); color: #b45309; border: 1px solid rgba(245, 158, 11, 0.25);";
}

/**
 * 분석 결과 대시보드 렌더링
 */
function renderDashboard() {
  if (!analysisResults) return;

  const res = analysisResults;

  // 1. 요약 카드 채우기
  document.getElementById("stat-responses").innerText = `${res.responseCount}명`;
  document.getElementById("stat-score-cnt").innerText = `${res.scoreQuestionCount}개`;
  document.getElementById("stat-average").innerText = `${res.overallAverage} / 5.00`; // 기본 표시
  document.getElementById("stat-positive-rate").innerText = `${res.overallPositiveRate}%`;

  // NPS 카드 상세 매핑
  const npsCard = document.getElementById("nps-card-container");
  if (npsCard) {
    if (res.nps.value !== null) {
      document.getElementById("stat-nps-val").innerText = res.nps.value;
      document.getElementById("stat-nps-label").innerText = `NPS (${res.nps.scale})`;
      document.getElementById("stat-nps-col").innerText = `기준 문항: ${res.nps.colName}`;
    } else {
      document.getElementById("stat-nps-val").innerText = "-";
      document.getElementById("stat-nps-label").innerText = "NPS (미산출)";
      document.getElementById("stat-nps-col").innerText = "점수/추천 문항이 감지되지 않았습니다.";
    }
  }

  // 2. 단일 컨테이너 결과 순서대로 렌더링
  const resultsContainer = document.getElementById("analysis-results-list");
  if (resultsContainer) {
    if (res.orderedResults.length === 0) {
      resultsContainer.innerHTML = `<p class="empty-list-msg">분석된 설문 문항이 없습니다.</p>`;
    } else {
      let html = "";
      res.orderedResults.forEach((item) => {
        if (item.type === "score") {
          // 객관식 (점수형) 카드 빌드
          const q = item;
          
          let barSegmentsHtml = "";
          let labelItems = [];
          
          if (q.scale === 5) {
            // 5점 척도 가로 누적 바 세그먼트 생성 (1~5점 순으로 배치)
            const colors = {
              1: "score-color-1",
              2: "score-color-2",
              3: "score-color-3",
              4: "score-color-4",
              5: "score-color-5"
            };
            
            for (let val = 1; val <= 5; val++) {
              const count = q.frequencies[val] || 0;
              const pct = q.responseCount > 0 ? ((count / q.responseCount) * 100).toFixed(1) : 0;
              
              if (count > 0) {
                labelItems.push(`<span class="rating-legend-item rating-color-${val}">${val}점: ${count}명(${pct}%)</span>`);
                barSegmentsHtml += `
                  <div class="bar-segment ${colors[val]}" style="width: 0%;" data-pct="${pct}" title="${val}점: ${count}명 (${pct}%)"></div>
                `;
              }
            }
          } else {
            // 10점 척도 가로 누적 바 세그먼트 생성 (부정, 중립, 긍정 그룹화)
            const pCount = (q.frequencies[8] || 0) + (q.frequencies[9] || 0) + (q.frequencies[10] || 0);
            const mCount = q.frequencies[7] || 0;
            const dCount = q.responseCount - pCount - mCount;

            const pPct = q.responseCount > 0 ? ((pCount / q.responseCount) * 100).toFixed(1) : 0;
            const mPct = q.responseCount > 0 ? ((mCount / q.responseCount) * 100).toFixed(1) : 0;
            const dPct = q.responseCount > 0 ? ((dCount / q.responseCount) * 100).toFixed(1) : 0;
            
            if (dCount > 0) {
              labelItems.push(`<span class="rating-legend-item rating-bad">부정(0-6점): ${dCount}명(${dPct}%)</span>`);
              barSegmentsHtml += `
                <div class="bar-segment score-color-1" style="width: 0%;" data-pct="${dPct}" title="부정(0-6점): ${dCount}명 (${dPct}%)"></div>
              `;
            }
            if (mCount > 0) {
              labelItems.push(`<span class="rating-legend-item rating-mid">중립(7점): ${mCount}명(${mPct}%)</span>`);
              barSegmentsHtml += `
                <div class="bar-segment score-color-3" style="width: 0%;" data-pct="${mPct}" title="중립(7점): ${mCount}명 (${mPct}%)"></div>
              `;
            }
            if (pCount > 0) {
              labelItems.push(`<span class="rating-legend-item rating-good">긍정(8-10점): ${pCount}명(${pPct}%)</span>`);
              barSegmentsHtml += `
                <div class="bar-segment score-color-5" style="width: 0%;" data-pct="${pPct}" title="긍정(8-10점): ${pCount}명 (${pPct}%)"></div>
              `;
            }
          }
          
          const labelsHtml = labelItems.length > 0
            ? `<div class="cumulative-legend">${labelItems.join('<span class="legend-separator">|</span>')}</div>`
            : "";

          const npsStyle = getNpsStyle(q.nps);
          const warningBadge = q.detractorRate >= 20 
            ? `<span class="badge-warning">⚠️ 개선 필요 (부정률 ${q.detractorRate}%)</span>` 
            : "";

          html += `
            <div class="question-card">
              <div class="q-card-header">
                <h4 class="q-title">${escapeHtml(q.name)}</h4>
                ${warningBadge}
              </div>
              <div class="q-stats-grid">
                <div class="q-stat-item">
                  <span class="q-stat-label">평균 점수</span>
                  <span class="q-stat-value">${q.average} / ${q.scale}.00</span>
                </div>
                <div class="q-stat-item">
                  <span class="q-stat-label">중앙값</span>
                  <span class="q-stat-value">${q.median}</span>
                </div>
                <div class="q-stat-item">
                  <span class="q-stat-label">긍정 비율</span>
                  <span class="q-stat-value text-gold">${q.positiveRate}%</span>
                </div>
                <div class="q-stat-item">
                  <span class="q-stat-label">응답 인원</span>
                  <span class="q-stat-value">${q.responseCount}명</span>
                </div>
              </div>
              
              <!-- 누적 막대그래프 영역 -->
              <div class="cumulative-visual-box" style="margin-bottom: 16px;">
                ${labelsHtml}
                <div style="display: flex; align-items: center; gap: 12px; margin-top: 8px;">
                  <div class="bar-track cumulative-track" style="flex: 1; display: flex; height: 12px; border-radius: 6px; overflow: hidden; background: #f1f5f9;">
                    ${barSegmentsHtml}
                  </div>
                  <span class="nps-badge" style="${npsStyle} font-size: 0.78rem; padding: 2px 8px; border-radius: 6px; font-weight: 700; white-space: nowrap;">NPS ${q.nps !== null ? q.nps : "-"}</span>
                </div>
              </div>

              <!-- 객관식 점수별 상세 분포 (details 아코디언 형태로 숨김 보존) -->
              <details class="pt-1" style="border-top: 1px dashed #f1f5f9; padding-top: 12px;">
                <summary style="font-size: 0.8rem; color: #64748b; cursor: pointer; user-select: none; font-weight: 600; outline: none; display: flex; align-items: center; gap: 4px;">
                  상세 점수 분포 보기 <i class="fas fa-chevron-down" style="font-size: 0.7rem; transition: transform 0.2s;"></i>
                </summary>
                <div class="space-y-1" style="margin-top: 12px;">
                  ${Object.keys(q.frequencies).sort((a,b) => b-a).map(score => {
                    const count = q.frequencies[score] || 0;
                    const pct = q.responseCount > 0 ? ((count / q.responseCount) * 100).toFixed(1) : 0;
                    return `
                      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 6px; font-size: 0.78rem;">
                        <span style="width: 40px; color: #64748b; font-weight: 600; text-align: right;">${score}점</span>
                        <div class="bar-track" style="flex: 1; height: 6px; background: #f1f5f9; border-radius: 3px; overflow: hidden;">
                          <div class="bar-fill score-color-${scale === 5 ? score : (score >= 8 ? 5 : (score === 7 ? 3 : 1))}" style="width: ${pct}%; height: 100%;"></div>
                        </div>
                        <span style="width: 100px; text-align: right; color: #475569; font-weight: 600;">${pct}% (${count}명)</span>
                      </div>
                    `;
                  }).join("")}
                </div>
              </details>
            </div>
          `;
        } else if (item.type === "text") {
          // 주관식 카드 빌드 (아코디언 구조 유지)
          const t = item;
          let responsesHtml = "";
          
          if (t.responses.length === 0) {
            responsesHtml = `<li class="no-comment-msg">제출된 주관식 의견이 없습니다.</li>`;
          } else {
            t.responses.forEach((resp) => {
              responsesHtml += `
                <li class="comment-item">
                  <span class="comment-bullet"><i class="fas fa-quote-left"></i></span>
                  <span class="comment-text">${escapeHtml(resp)}</span>
                </li>
              `;
            });
          }

          html += `
            <div class="accordion-item" style="border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #ffffff; margin-bottom: 20px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
              <button class="accordion-header" onclick="toggleAccordion(this)" style="width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 18px 24px; background: #f8fafc; border: none; font-family: inherit; font-size: 1rem; font-weight: 700; color: #334155; cursor: pointer; transition: background 0.2s ease;">
                <span>✍️ ${escapeHtml(t.name)} (${t.responses.length}건)</span>
                <i class="fas fa-chevron-down" style="transition: transform 0.2s ease;"></i>
              </button>
              <div class="accordion-body" style="max-height: 0; overflow-y: auto; padding: 0 24px; transition: all 0.3s ease;">
                <ul class="comment-list-ul" style="list-style: none; padding: 0; margin: 0;">
                  ${responsesHtml}
                </ul>
              </div>
            </div>
          `;
        }
      });
      
      resultsContainer.innerHTML = html;

      // 시각화 애니메이션 효과: 약간의 딜레이 후 %만큼 차오르도록 설정
      setTimeout(() => {
        const segments = resultsContainer.querySelectorAll(".bar-segment");
        segments.forEach((seg) => {
          const targetPct = seg.dataset.pct;
          seg.style.width = `${targetPct}%`;
        });
      }, 100);
    }
  }

  // 버튼 이벤트 할당
  const btnCopyReport = document.getElementById("btn-copy-report");
  const btnDownloadCSV = document.getElementById("btn-download-csv");
  const btnReset = document.getElementById("btn-reset");
  
  if (btnCopyReport) btnCopyReport.onclick = copyReportSummary;
  if (btnDownloadCSV) btnDownloadCSV.onclick = downloadResultCSV;
  if (btnReset) btnReset.onclick = resetAnalyzer;
}

/**
 * 주관식 답변 아코디언 토글 헬퍼
 */
window.toggleAccordion = function(element) {
  element.classList.toggle("active");
  const body = element.nextElementSibling;
  const icon = element.querySelector("i");
  
  if (body.style.maxHeight) {
    body.style.maxHeight = null;
    body.style.padding = "0 20px";
    icon.style.transform = "rotate(0deg)";
  } else {
    body.style.maxHeight = body.scrollHeight + 100 + "px";
    body.style.padding = "16px 20px";
    icon.style.transform = "rotate(180deg)";
  }
};

/**
 * 4. 보고서용 요약 텍스트 클립보드 복사
 */
/**
 * 4. 보고서용 요약 텍스트 클립보드 복사
 */
function copyReportSummary() {
  if (!analysisResults) return;

  const res = analysisResults;
  
  const scoreQuestions = res.orderedResults.filter(r => r.type === "score");
  const textQuestions = res.orderedResults.filter(r => r.type === "text");

  // 성적 정렬
  const sortedQ = [...scoreQuestions].sort((a, b) => b.average - a.average);
  const topQuestions = sortedQ.slice(0, 2);
  const bottomQuestions = sortedQ.slice(-2).reverse();

  let text = `만족도 분석 요약 보고서\n`;
  text += `========================\n\n`;
  text += `- 총 응답 수: ${res.responseCount}명\n`;
  text += `- 만족도 점수 문항: ${res.scoreQuestionCount}개\n`;
  text += `- 주관식 의견 문항: ${res.textQuestionCount}개\n`;
  text += `- 전체 문항 평균 만족도: ${res.overallAverage.toFixed(2)} / 5.00 기준\n`;
  text += `- 전체 긍정 응답률 (4점 이상): ${res.overallPositiveRate}%\n`;
  
  if (res.nps.value !== null) {
    text += `- 순추천지수(NPS) [${res.nps.scale}]: ${res.nps.value} (추천 ${res.nps.promoters}%, 비추천 ${res.nps.detractors}%)\n`;
    text += `  └ 기준 문항: ${res.nps.colName}\n`;
  }
  text += `\n`;

  if (topQuestions.length > 0) {
    text += `■ 우수 항목 (상위 만족도)\n`;
    topQuestions.forEach((q, i) => {
      text += `  ${i + 1}. ${q.name} (평균: ${q.average}점, 긍정률: ${q.positiveRate}%)\n`;
    });
    text += `\n`;
  }

  if (bottomQuestions.length > 0 && bottomQuestions[0].index !== topQuestions[0].index) {
    text += `■ 취약 및 개선 필요 항목 (하위 만족도)\n`;
    bottomQuestions.forEach((q, i) => {
      text += `  ${i + 1}. ${q.name} (평균: ${q.average}점, 긍정률: ${q.positiveRate}%)\n`;
    });
    text += `\n`;
  }

  if (textQuestions.length > 0) {
    text += `■ 주요 주관식 피드백 샘플\n`;
    textQuestions.forEach((t) => {
      text += `  * ${t.name}:\n`;
      const samples = t.responses.slice(0, 3);
      if (samples.length === 0) {
        text += `    - 등록된 의견 없음\n`;
      } else {
        samples.forEach(s => {
          text += `    - "${s}"\n`;
        });
      }
    });
  }

  navigator.clipboard.writeText(text).then(() => {
    showToast("보고서 요약 텍스트가 클립보드에 복사되었습니다!");
  }).catch(() => {
    showToast("복사 중 에러가 발생했습니다.", "error");
  });
}

/**
 * 5. 분석 결과 CSV 다운로드 (주관식 포함 및 UTF-8 BOM 지원)
 */
function downloadResultCSV() {
  if (!analysisResults) return;

  const res = analysisResults;

  // 헤더 로우 정의
  let csvContent = "구분,문항명,척도,응답 수,평균 점수,중앙값,긍정 응답률(%),부정 응답률(%),주관식 응답 내용\n";

  res.orderedResults.forEach((item) => {
    const cleanedName = item.name.replace(/"/g, '""');
    if (item.type === "score") {
      csvContent += `"점수형","${cleanedName}","${item.scale}점 척도",${item.responseCount},${item.average},${item.median},${item.positiveRate},${item.detractorRate},""\n`;
    } else if (item.type === "text") {
      // 각 응답별 내부 줄바꿈은 공백으로 치환해 셀 내의 줄바꿈과 혼동되지 않도록 처리합니다.
      const processedResponses = item.responses.map(r => ` - ${r.replace(/\r?\n/g, ' ')}`).join('\n');
      const escapedText = processedResponses.replace(/"/g, '""');
      csvContent += `"주관식","${cleanedName}","-",${item.responses.length},"","","","","${escapText}"\n`;
    }
  });

  // UTF-8 BOM(Excel 한글 깨짐 방지용) 데이터 조합
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  
  const today = new Date().toISOString().substring(0, 10);
  link.setAttribute("href", url);
  link.setAttribute("download", `만족도_분석_결과_${today}.csv`);
  link.style.visibility = "hidden";
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  showToast("분석 결과 CSV 파일이 다운로드되었습니다.");
}

/**
 * 초기 입력 상태로 되돌리기
 */
function resetAnalyzer() {
  parsedHeaders = [];
  parsedRows = [];
  columnMappings = {};
  satisfactionData = [];
  analysisResults = null;

  document.getElementById("csv-file").value = "";
  document.getElementById("paste-area").value = "";
  
  const container = document.getElementById("review-table-container");
  if (container) container.innerHTML = "";

  switchState("ready");
  showToast("상태가 초기화되었습니다.");
}

/**
 * 샘플 데이터 탑재 및 분석 데모 구동
 */
function loadSampleData() {
  const sampleCSV = `이름,이메일,소속,교육 만족도,강사 전문성,교육 내용 실무 도움,추천 의향(NPS),개선점 및 건의사항
홍길동,hong@test.com,A사,5,5,4,5,교육 인프라가 쾌적해서 집중이 아주 잘 되었습니다.
김철수,kim@test.com,B사,4,5,4,4,실습 시간이 조금만 더 길었으면 좋겠습니다.
이영희,lee@test.com,C사,5,4,5,5,강사님이 질문에 친절하고 상세하게 답변해주셔서 좋았습니다.
박민수,park@test.com,A사,3,3,3,3,이론 설명 부분이 조금 길고 지루하게 느껴졌습니다.
최지우,choi@test.com,D사,5,5,5,5,업무 자동화에 직접 활용할 수 있는 알찬 예제였습니다. 강추합니다!
정민호,jung@test.com,E사,4,4,3,2,난이도가 다소 높았으나 전반적으로 유익했습니다.
강지혜,kang@test.com,B사,5,5,5,5,다음 심화 과정도 반드시 개설해 주셨으면 좋겠습니다.`;

  showLoading(true);
  
  setTimeout(() => {
    processRawData(sampleCSV, ",", "sample_demo");
  }, 300);
}

/**
 * UI 상태 스위치 헬퍼
 */
function switchState(state) {
  const sections = ["ready", "review", "result"];
  sections.forEach((s) => {
    const el = document.getElementById(`section-${s}`);
    if (el) {
      if (s === state) {
        el.classList.add("show");
      } else {
        el.classList.remove("show");
      }
    }
  });
}

/**
 * 로딩 화면 제어 헬퍼
 */
function showLoading(isLoading) {
  const loader = document.getElementById("loading-overlay");
  if (loader) {
    if (isLoading) {
      loader.classList.add("show");
    } else {
      loader.classList.remove("show");
    }
  }
}

/**
 * HTML 이스케이프 유틸
 */
function escapeHtml(str) {
  if (typeof str !== "string") return str;
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * 토스트 알림 자체 컴포넌트 구현
 */
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
