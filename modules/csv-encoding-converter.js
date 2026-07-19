(() => {
  'use strict';

  const MAX_FILE_SIZE = 100 * 1024 * 1024;
  const PREVIEW_LIMIT = 12000;
  const state = { file: null, bytes: null, text: '', encoding: '', delimiter: ',', analysis: null };

  const el = {};

  document.addEventListener('DOMContentLoaded', () => {
    Object.assign(el, {
      dropzone: document.getElementById('csv-dropzone'),
      fileInput: document.getElementById('csv-file'),
      fileSummary: document.getElementById('csv-file-summary'),
      encoding: document.getElementById('csv-source-encoding'),
      delimiter: document.getElementById('csv-delimiter'),
      analyze: document.getElementById('csv-analyze'),
      download: document.getElementById('csv-download'),
      reset: document.getElementById('csv-reset'),
      status: document.getElementById('csv-status'),
      metrics: document.getElementById('csv-metrics'),
      checks: document.getElementById('csv-checks'),
      preview: document.getElementById('csv-preview')
    });

    if (!el.dropzone) return;
    bindEvents();
  });

  function bindEvents() {
    el.dropzone.addEventListener('click', () => el.fileInput.click());
    el.dropzone.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        el.fileInput.click();
      }
    });
    ['dragenter', 'dragover'].forEach(type => el.dropzone.addEventListener(type, event => {
      event.preventDefault();
      el.dropzone.classList.add('is-dragging');
    }));
    ['dragleave', 'drop'].forEach(type => el.dropzone.addEventListener(type, event => {
      event.preventDefault();
      el.dropzone.classList.remove('is-dragging');
    }));
    el.dropzone.addEventListener('drop', event => selectFile(event.dataTransfer.files[0]));
    el.fileInput.addEventListener('change', () => selectFile(el.fileInput.files[0]));
    el.encoding.addEventListener('change', analyzeSelectedFile);
    el.delimiter.addEventListener('change', analyzeSelectedFile);
    el.analyze.addEventListener('click', analyzeSelectedFile);
    el.download.addEventListener('click', downloadConvertedFile);
    el.reset.addEventListener('click', resetTool);
  }

  async function selectFile(file) {
    if (!file) return;
    if (!/\.(csv|txt)$/i.test(file.name)) return setStatus('CSV 또는 TXT 파일만 선택할 수 있습니다.', 'error');
    if (file.size > MAX_FILE_SIZE) return setStatus('파일 크기는 100MB 이하만 지원합니다.', 'error');

    resetResults();
    try {
      state.file = file;
      state.bytes = new Uint8Array(await file.arrayBuffer());
      el.fileSummary.innerHTML = `<strong>${escapeHtml(file.name)}</strong><br>${formatBytes(file.size)} · 파일 내용은 이 브라우저에서만 읽습니다.`;
      el.fileSummary.classList.add('is-visible');
      el.analyze.disabled = false;
      el.reset.disabled = false;
      if (window.trackCRMEvent) window.trackCRMEvent('tool_file_selected', { tool_name: 'csv_encoding_converter', file_size_band: sizeBand(file.size) });
      analyzeSelectedFile();
    } catch (error) {
      setStatus('파일을 읽지 못했습니다. 다른 파일로 다시 시도해 주세요.', 'error');
    }
  }

  function analyzeSelectedFile() {
    if (!state.bytes) return;
    try {
      const requested = el.encoding.value;
      const detected = requested === 'auto' ? detectEncoding(state.bytes) : requested;
      const decoded = decodeBytes(state.bytes, detected);
      const delimiter = el.delimiter.value === 'auto' ? detectDelimiter(decoded.text) : delimiterValue(el.delimiter.value);
      const analysis = analyzeCsv(decoded.text, delimiter);

      state.text = decoded.text;
      state.encoding = detected;
      state.delimiter = delimiter;
      state.analysis = analysis;

      renderAnalysis(decoded, analysis);
      el.download.disabled = false;
      if (window.trackCRMEvent) window.trackCRMEvent('tool_analysis_completed', {
        tool_name: 'csv_encoding_converter',
        detected_encoding: detected,
        warning_count_band: countBand(analysis.warnings.length)
      });
    } catch (error) {
      el.download.disabled = true;
      setStatus('선택한 인코딩으로 파일을 읽을 수 없습니다. 다른 원본 인코딩을 선택해 주세요.', 'error');
    }
  }

  function detectEncoding(bytes) {
    if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return 'utf-8';
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      return 'utf-8';
    } catch (_) {
      return 'euc-kr';
    }
  }

  function decodeBytes(bytes, encoding) {
    const hasBom = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
    const decoder = new TextDecoder(encoding, { fatal: false });
    let text = decoder.decode(bytes);
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    return { text, hasBom, replacementCount: (text.match(/\uFFFD/g) || []).length };
  }

  function detectDelimiter(text) {
    const sample = text.slice(0, 10000);
    const candidates = [',', '\t', ';', '|'];
    let best = ',';
    let bestScore = -1;
    candidates.forEach(candidate => {
      const rows = parseCsv(sample, candidate).slice(0, 10);
      if (!rows.length) return;
      const counts = rows.map(row => row.length);
      const mode = counts.sort((a, b) => counts.filter(v => v === a).length - counts.filter(v => v === b).length).pop();
      const score = mode > 1 ? counts.filter(v => v === mode).length * mode : 0;
      if (score > bestScore) { best = candidate; bestScore = score; }
    });
    return best;
  }

  function parseCsv(text, delimiter, rowLimit = Infinity) {
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;
    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      if (char === '"') {
        if (quoted && text[index + 1] === '"') { cell += '"'; index += 1; }
        else quoted = !quoted;
      } else if (char === delimiter && !quoted) {
        row.push(cell); cell = '';
      } else if ((char === '\n' || char === '\r') && !quoted) {
        if (char === '\r' && text[index + 1] === '\n') index += 1;
        row.push(cell); rows.push(row); row = []; cell = '';
        if (rows.length >= rowLimit) break;
      } else {
        cell += char;
      }
    }
    if (row.length || cell) { row.push(cell); rows.push(row); }
    return rows;
  }

  function analyzeCsv(text, delimiter) {
    const rows = parseCsv(text, delimiter);
    const headers = rows[0] || [];
    const expected = headers.length;
    const irregularRows = [];
    const formulaCells = [];
    rows.slice(1).forEach((row, rowIndex) => {
      if (row.length !== expected) irregularRows.push(rowIndex + 2);
      row.forEach((value, columnIndex) => {
        if (/^[=+\-@]/.test(value.trim())) formulaCells.push(`${rowIndex + 2}행 ${columnIndex + 1}열`);
      });
    });
    const normalizedHeaders = headers.map(value => value.trim().toLowerCase());
    const emptyHeaders = headers.reduce((count, value) => count + (value.trim() ? 0 : 1), 0);
    const duplicateHeaders = [...new Set(normalizedHeaders.filter((value, index) => value && normalizedHeaders.indexOf(value) !== index))];
    const warnings = [];
    if (irregularRows.length) warnings.push(`열 개수가 다른 행 ${irregularRows.length}개`);
    if (emptyHeaders) warnings.push(`빈 열 이름 ${emptyHeaders}개`);
    if (duplicateHeaders.length) warnings.push(`중복 열 이름 ${duplicateHeaders.length}개`);
    if (formulaCells.length) warnings.push(`Excel 수식으로 실행될 수 있는 셀 ${formulaCells.length}개`);
    return { rows, headers, expected, irregularRows, formulaCells, emptyHeaders, duplicateHeaders, warnings };
  }

  function renderAnalysis(decoded, analysis) {
    const encodingLabel = state.encoding === 'euc-kr' ? 'CP949/EUC-KR 계열' : (decoded.hasBom ? 'UTF-8 BOM' : 'UTF-8');
    setStatus(`${encodingLabel}로 읽었습니다. 미리보기를 확인한 뒤 UTF-8 BOM 파일로 내려받으세요.`, analysis.warnings.length ? '' : 'success');
    el.metrics.innerHTML = metric('행', Math.max(analysis.rows.length - 1, 0)) + metric('열', analysis.expected) + metric('주의', analysis.warnings.length) + metric('깨진 문자', decoded.replacementCount);

    const checks = [];
    checks.push(checkItem(decoded.replacementCount ? 'error' : 'ok', decoded.replacementCount ? `대체 문자(�) ${decoded.replacementCount}개가 있습니다. 다른 인코딩도 확인하세요.` : '깨진 대체 문자가 발견되지 않았습니다.'));
    checks.push(checkItem(analysis.irregularRows.length ? 'warning' : 'ok', analysis.irregularRows.length ? `열 개수가 다른 행: ${summarize(analysis.irregularRows)}` : '확인한 모든 행의 열 개수가 같습니다.'));
    checks.push(checkItem(analysis.emptyHeaders || analysis.duplicateHeaders.length ? 'warning' : 'ok', analysis.emptyHeaders || analysis.duplicateHeaders.length ? `열 이름 확인 필요: 빈 이름 ${analysis.emptyHeaders}개, 중복 이름 ${analysis.duplicateHeaders.length}개` : '빈 열 이름과 중복 열 이름이 없습니다.'));
    checks.push(checkItem(analysis.formulaCells.length ? 'warning' : 'ok', analysis.formulaCells.length ? `Excel 수식 위험 셀 ${analysis.formulaCells.length}개: ${summarize(analysis.formulaCells)}` : 'Excel 수식으로 실행될 수 있는 값이 발견되지 않았습니다.'));
    el.checks.innerHTML = checks.join('');
    el.preview.value = state.text.slice(0, PREVIEW_LIMIT);
    document.getElementById('csv-preview-count').textContent = state.text.length > PREVIEW_LIMIT ? `앞 ${PREVIEW_LIMIT.toLocaleString()}자 표시` : '전체 표시';
  }

  function downloadConvertedFile() {
    if (!state.file || !state.text) return;
    const safeText = state.text.replace(/^\uFEFF/, '');
    const blob = new Blob(['\uFEFF', safeText], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${state.file.name.replace(/\.(csv|txt)$/i, '')}_utf8_bom.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setStatus('UTF-8 BOM CSV 파일을 만들었습니다. 원본 파일은 변경되지 않았습니다.', 'success');
    if (window.trackCRMEvent) window.trackCRMEvent('tool_converted_file_downloaded', { tool_name: 'csv_encoding_converter', output_encoding: 'utf-8-bom' });
  }

  function resetTool() {
    state.file = null; state.bytes = null; state.text = ''; state.analysis = null;
    el.fileInput.value = '';
    el.fileSummary.classList.remove('is-visible');
    el.encoding.value = 'auto'; el.delimiter.value = 'auto';
    el.analyze.disabled = true; el.download.disabled = true; el.reset.disabled = true;
    resetResults();
    setStatus('CSV 또는 TXT 파일을 선택하면 자동으로 분석합니다.');
  }

  function resetResults() { el.metrics.innerHTML = ''; el.checks.innerHTML = ''; el.preview.value = ''; }
  function setStatus(message, type = '') { el.status.className = `csv-status${type ? ` is-${type}` : ''}`; el.status.textContent = message; }
  function metric(label, value) { return `<div class="csv-metric"><strong>${Number(value).toLocaleString()}</strong><span>${label}</span></div>`; }
  function checkItem(type, text) { const icon = type === 'ok' ? 'fa-check-circle' : type === 'error' ? 'fa-times-circle' : 'fa-exclamation-triangle'; return `<li class="${type}"><i class="fas ${icon}"></i><span>${escapeHtml(text)}</span></li>`; }
  function summarize(values) { return values.slice(0, 5).join(', ') + (values.length > 5 ? ` 외 ${values.length - 5}개` : ''); }
  function delimiterValue(value) { return value === 'tab' ? '\t' : value; }
  function formatBytes(bytes) { return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)}KB` : `${(bytes / 1024 / 1024).toFixed(1)}MB`; }
  function sizeBand(bytes) { if (bytes < 1024 * 1024) return 'under_1mb'; if (bytes < 10 * 1024 * 1024) return '1mb_to_10mb'; return 'over_10mb'; }
  function countBand(count) { return count === 0 ? '0' : count < 4 ? '1_to_3' : '4_plus'; }
  function escapeHtml(value) { const div = document.createElement('div'); div.textContent = String(value); return div.innerHTML; }
})();
