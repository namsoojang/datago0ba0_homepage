(() => {
  'use strict';

  const MAX_FILE_SIZE = 50 * 1024 * 1024;
  const MAX_ROWS = 200000;
  const state = { file:null, bytes:null, text:'', headers:[], rows:[], delimiter:',', encoding:'', mapping:{}, report:null };
  const el = {};

  document.addEventListener('DOMContentLoaded', () => {
    ['dropzone','file','file-summary','encoding','delimiter','consent-value','read','reset','map-panel','name-column','phone-column','email-column','business-column','id-column','consent-column','run','result-panel','output-panel','status','metrics','format-issues','duplicate-issues','preview-head','preview-body','download-clean','download-mask','copy-phone','copy-email','mask-name','mask-phone','mask-email','mask-id'].forEach(key => {
      el[toCamel(key)] = document.getElementById(`crm-${key}`);
    });
    if (!el.dropzone) return;
    bindEvents();
  });

  function bindEvents() {
    el.dropzone.addEventListener('click', () => el.file.click());
    el.dropzone.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); el.file.click(); } });
    ['dragenter','dragover'].forEach(type => el.dropzone.addEventListener(type, event => { event.preventDefault(); el.dropzone.classList.add('is-dragging'); }));
    ['dragleave','drop'].forEach(type => el.dropzone.addEventListener(type, event => { event.preventDefault(); el.dropzone.classList.remove('is-dragging'); }));
    el.dropzone.addEventListener('drop', event => selectFile(event.dataTransfer.files[0]));
    el.file.addEventListener('change', () => selectFile(el.file.files[0]));
    el.encoding.addEventListener('change', readSelectedFile);
    el.delimiter.addEventListener('change', readSelectedFile);
    el.read.addEventListener('click', readSelectedFile);
    el.reset.addEventListener('click', resetTool);
    el.run.addEventListener('click', runAudit);
    el.downloadClean.addEventListener('click', () => downloadCsv(false));
    el.downloadMask.addEventListener('click', () => downloadCsv(true));
    el.copyPhone.addEventListener('click', () => copyContacts('phone'));
    el.copyEmail.addEventListener('click', () => copyContacts('email'));
  }

  async function selectFile(file) {
    if (!file) return;
    if (!/\.(csv|txt)$/i.test(file.name)) return setStatus('CSV 또는 TXT 파일만 선택할 수 있습니다.','error');
    if (file.size > MAX_FILE_SIZE) return setStatus('파일 크기는 50MB 이하만 지원합니다.','error');
    try {
      state.file = file;
      state.bytes = new Uint8Array(await file.arrayBuffer());
      el.fileSummary.innerHTML = `<strong>${escapeHtml(file.name)}</strong><br>${formatBytes(file.size)} · 파일 내용은 이 브라우저에서만 처리합니다.`;
      el.fileSummary.classList.add('is-visible');
      el.read.disabled = false; el.reset.disabled = false;
      if (window.trackCRMEvent) window.trackCRMEvent('tool_file_selected',{tool_name:'crm_list_checker',file_size_band:sizeBand(file.size)});
      readSelectedFile();
    } catch (_) { setStatus('파일을 읽지 못했습니다. 다른 파일로 다시 시도해 주세요.','error'); }
  }

  function readSelectedFile() {
    if (!state.bytes) return;
    try {
      const requested = el.encoding.value;
      state.encoding = requested === 'auto' ? detectEncoding(state.bytes) : requested;
      state.text = decodeBytes(state.bytes,state.encoding);
      state.delimiter = el.delimiter.value === 'auto' ? detectDelimiter(state.text) : delimiterValue(el.delimiter.value);
      const parsed = parseCsv(state.text,state.delimiter,MAX_ROWS + 2);
      if (parsed.length < 2) throw new Error('EMPTY');
      if (parsed.length > MAX_ROWS + 1) throw new Error('TOO_MANY_ROWS');
      state.headers = parsed[0].map((value,index) => value.trim() || `열_${index + 1}`);
      state.rows = parsed.slice(1).filter(row => row.some(value => value.trim() !== '')).map(row => fitRow(row,state.headers.length));
      state.report = null;
      populateMappings();
      el.mapPanel.classList.remove('crm-hidden');
      el.resultPanel.classList.add('crm-hidden'); el.outputPanel.classList.add('crm-hidden');
      setStatus(`${encodingLabel(state.encoding)} · ${delimiterLabel(state.delimiter)} · ${state.rows.length.toLocaleString()}행을 읽었습니다.`,'success');
    } catch (error) {
      const message = error.message === 'TOO_MANY_ROWS' ? `한 번에 최대 ${MAX_ROWS.toLocaleString()}행까지 지원합니다.` : '파일 구조를 읽지 못했습니다. 인코딩과 구분자를 바꿔 확인해 주세요.';
      setStatus(message,'error');
      el.mapPanel.classList.add('crm-hidden');
    }
  }

  function populateMappings() {
    const specs = [
      ['nameColumn','name'],['phoneColumn','phone'],['emailColumn','email'],['businessColumn','business'],['idColumn','id'],['consentColumn','consent']
    ];
    specs.forEach(([elementKey,type]) => {
      const select = el[elementKey];
      select.innerHTML = '<option value="">선택 안 함</option>' + state.headers.map((header,index) => `<option value="${index}">${escapeHtml(header)}</option>`).join('');
      const suggested = suggestColumn(state.headers,state.rows,type);
      select.value = suggested < 0 ? '' : String(suggested);
    });
  }

  function runAudit() {
    state.mapping = {
      name:indexValue(el.nameColumn), phone:indexValue(el.phoneColumn), email:indexValue(el.emailColumn), business:indexValue(el.businessColumn), id:indexValue(el.idColumn), consent:indexValue(el.consentColumn)
    };
    if ([state.mapping.name,state.mapping.phone,state.mapping.email].every(value => value < 0)) return setStatus('이름·전화번호·이메일 중 하나 이상을 선택해 주세요.','error');
    state.report = auditRows(state.headers,state.rows,state.mapping);
    renderReport();
    el.resultPanel.classList.remove('crm-hidden'); el.outputPanel.classList.remove('crm-hidden');
    setStatus(`점검 완료: 정상 ${state.report.counts.normal.toLocaleString()}건, 확인 필요 ${(state.report.counts.warning + state.report.counts.error).toLocaleString()}건입니다.`,'success');
    if (window.trackCRMEvent) window.trackCRMEvent('tool_analysis_completed',{tool_name:'crm_list_checker',row_count_band:rowBand(state.rows.length),issue_count_band:countBand(state.report.counts.warning + state.report.counts.error)});
    el.resultPanel.scrollIntoView({behavior:'smooth',block:'start'});
  }

  function auditRows(headers,rows,mapping) {
    const records = rows.map((row,index) => buildRecord(row,index,mapping));
    const signatureLast = new Map();
    records.forEach(record => signatureLast.set(record.signature,record.index));
    const exactDuplicateIndexes = new Set(records.filter(record => signatureLast.get(record.signature) !== record.index).map(record => record.index));
    const candidateMaps = {id:new Map(),business:new Map(),phone:new Map(),email:new Map(),nameLast4:new Map()};
    records.forEach(record => {
      addCandidate(candidateMaps.id,record.keys.id,record.index);
      addCandidate(candidateMaps.business,record.keys.business,record.index);
      addCandidate(candidateMaps.phone,record.keys.phone,record.index);
      addCandidate(candidateMaps.email,record.keys.email,record.index);
      addCandidate(candidateMaps.nameLast4,record.keys.nameLast4,record.index);
    });
    const candidateGroups = [];
    Object.entries(candidateMaps).forEach(([type,map]) => map.forEach((indexes,key) => {
      if (indexes.length > 1 && !indexes.slice(0,-1).every(index => exactDuplicateIndexes.has(index))) candidateGroups.push({type,key,indexes});
    }));
    const candidateIndexSet = new Set(candidateGroups.flatMap(group => group.indexes));
    records.forEach(record => {
      if (exactDuplicateIndexes.has(record.index)) record.issues.push({level:'warning',message:'완전히 동일한 중복 행 — 정리본에서 마지막 행만 유지'});
      else if (candidateIndexSet.has(record.index)) record.issues.push({level:'warning',message:'일부 값이 같은 중복 후보 — 자동 삭제하지 않음'});
      record.level = record.issues.some(issue => issue.level === 'error') ? 'error' : record.issues.length ? 'warning' : 'normal';
    });
    const counts = {normal:0,warning:0,error:0,empty:0,exact:exactDuplicateIndexes.size,candidates:candidateGroups.length};
    records.forEach(record => { counts[record.level] += 1; counts.empty += record.emptyCount; });
    const cleanRecords = records.filter(record => !exactDuplicateIndexes.has(record.index));
    return {records,cleanRecords,exactDuplicateIndexes,candidateGroups,counts,headers,mapping};
  }

  function buildRecord(row,index,mapping) {
    const cleaned = row.slice();
    const issues = [];
    let emptyCount = 0;
    if (mapping.name >= 0) {
      const original = row[mapping.name]; const value = normalizeName(original); cleaned[mapping.name] = value;
      if (!value) { issues.push({level:'warning',message:'이름이 비어 있음'}); emptyCount += 1; }
      else if (!isPlausibleName(value)) issues.push({level:'warning',message:'이름 형식 확인 필요'});
    }
    if (mapping.phone >= 0) {
      const original = row[mapping.phone]; const value = normalizePhone(original); cleaned[mapping.phone] = value.formatted;
      if (!original.trim()) { issues.push({level:'warning',message:'전화번호가 비어 있음'}); emptyCount += 1; }
      else if (!value.valid) issues.push({level:'error',message:'전화번호 형식 오류'});
    }
    if (mapping.email >= 0) {
      const original = row[mapping.email]; const value = normalizeEmail(original); cleaned[mapping.email] = value;
      if (!value) { issues.push({level:'warning',message:'이메일이 비어 있음'}); emptyCount += 1; }
      else if (!isValidEmail(value)) issues.push({level:'error',message:'이메일 형식 오류'});
    }
    if (mapping.business >= 0) cleaned[mapping.business] = normalizeBusiness(row[mapping.business]);
    const idDigits = mapping.id >= 0 ? onlyDigits(row[mapping.id]) : '';
    const normalizedName = mapping.name >= 0 ? canonical(cleaned[mapping.name]) : '';
    const phoneDigits = mapping.phone >= 0 ? normalizePhone(row[mapping.phone]).digits : '';
    const email = mapping.email >= 0 ? normalizeEmail(row[mapping.email]) : '';
    const businessDigits = mapping.business >= 0 ? onlyDigits(row[mapping.business]) : '';
    const signature = cleaned.map(exactCanonical).join('\u001f');
    return {index,row,cleaned,issues,emptyCount,signature,level:'normal',keys:{id:idDigits.length >= 10 ? idDigits : '',business:businessDigits.length === 10 ? businessDigits : '',phone:phoneDigits.length >= 9 ? phoneDigits : '',email:isValidEmail(email) ? email : '',nameLast4:normalizedName && phoneDigits.length >= 4 ? `${normalizedName}|${phoneDigits.slice(-4)}` : ''}};
  }

  function renderReport() {
    const {counts,records,candidateGroups} = state.report;
    el.metrics.innerHTML = metric('전체',records.length) + metric('정상',counts.normal) + metric('주의',counts.warning,'warning') + metric('오류',counts.error,'error') + metric('완전 중복',counts.exact,'warning') + metric('중복 후보',counts.candidates,'warning');
    const formatItems = records.flatMap(record => record.issues.filter(issue => !issue.message.includes('중복')).map(issue => ({...issue,row:record.index + 2}))).slice(0,100);
    el.formatIssues.innerHTML = formatItems.length ? formatItems.map(item => `<li>${item.row}행 · ${escapeHtml(item.message)}</li>`).join('') : '<li class="ok">이름·전화번호·이메일에서 확인할 형식 오류가 없습니다.</li>';
    const duplicateItems = [];
    if (counts.exact) duplicateItems.push(`<li>완전히 동일한 중복 ${counts.exact}행은 정리본에서 마지막 행만 유지합니다.</li>`);
    candidateGroups.slice(0,100).forEach(group => duplicateItems.push(`<li>${candidateTypeLabel(group.type)} 일치 · 원본 ${group.indexes.map(index => index + 2).join(', ')}행 · 자동 삭제하지 않음</li>`));
    el.duplicateIssues.innerHTML = duplicateItems.length ? duplicateItems.join('') : '<li class="ok">완전 중복과 주요 중복 후보가 없습니다.</li>';
    renderPreview(state.report.cleanRecords.slice(0,30));
  }

  function renderPreview(records) {
    const visibleIndexes = state.headers.map((_,index) => index).slice(0,8);
    el.previewHead.innerHTML = `<tr><th>상태</th>${visibleIndexes.map(index => `<th>${escapeHtml(state.headers[index])}</th>`).join('')}</tr>`;
    el.previewBody.innerHTML = records.map(record => `<tr><td>${record.level === 'normal' ? '정상' : '확인'}</td>${visibleIndexes.map(index => `<td title="${escapeAttr(previewValue(record.cleaned[index],index))}">${escapeHtml(previewValue(record.cleaned[index],index))}</td>`).join('')}</tr>`).join('');
  }

  function previewValue(value,index) { return index === state.mapping.id && value ? maskId(value) : value; }

  function downloadCsv(masked) {
    if (!state.report) return;
    const rows = state.report.cleanRecords.map(record => record.cleaned.map((value,index) => masked ? maskByColumn(value,index) : value));
    const csv = serializeCsv([state.headers,...rows]);
    const suffix = masked ? 'masked' : 'cleaned';
    saveBlob('\uFEFF' + csv,`${baseName()}_${suffix}.csv`);
    if (window.trackCRMEvent) window.trackCRMEvent(masked ? 'tool_masked_file_downloaded' : 'tool_cleaned_file_downloaded',{tool_name:'crm_list_checker',row_count_band:rowBand(rows.length)});
  }

  function maskByColumn(value,index) {
    if (index === state.mapping.name && el.maskName.checked) return maskName(value);
    if (index === state.mapping.phone && el.maskPhone.checked) return maskPhone(value);
    if (index === state.mapping.email && el.maskEmail.checked) return maskEmail(value);
    if (index === state.mapping.id && el.maskId.checked) return maskId(value);
    return value;
  }

  async function copyContacts(type) {
    if (!state.report) return;
    const index = type === 'phone' ? state.mapping.phone : state.mapping.email;
    if (index < 0) return setStatus(`${type === 'phone' ? '전화번호' : '이메일'} 컬럼을 먼저 선택해 주세요.`,'error');
    const consentIndex = state.mapping.consent;
    if (consentIndex < 0 && !window.confirm('수신동의 컬럼이 선택되지 않았습니다. 광고성 정보 전송 전 적법한 사전 동의를 별도로 확인했나요?')) return;
    const allowed = consentValues();
    const values = state.report.cleanRecords.filter(record => consentIndex < 0 || allowed.has(canonical(record.cleaned[consentIndex]))).map(record => {
      if (type === 'phone') { const phone = normalizePhone(record.cleaned[index]); return phone.valid && phone.digits.startsWith('010') ? phone.formatted : ''; }
      const email = normalizeEmail(record.cleaned[index]); return isValidEmail(email) ? email : '';
    }).filter(Boolean);
    const unique = [...new Set(values)];
    if (!unique.length) return setStatus('복사할 유효한 연락처가 없습니다.','error');
    try { await navigator.clipboard.writeText(unique.join('\n')); }
    catch (_) { const area=document.createElement('textarea'); area.value=unique.join('\n'); document.body.appendChild(area); area.select(); document.execCommand('copy'); area.remove(); }
    setStatus(`${type === 'phone' ? '휴대전화 번호' : '이메일 주소'} ${unique.length.toLocaleString()}개를 복사했습니다.`,'success');
    if (window.trackCRMEvent) window.trackCRMEvent('tool_contact_list_copied',{tool_name:'crm_list_checker',contact_type:type,consent_filter:consentIndex >= 0 ? 'applied' : 'not_mapped'});
  }

  function suggestColumn(headers,rows,type) {
    const patterns = {
      name:/(^|[^a-z])(이름|성명|고객명|담당자|name)([^a-z]|$)/i, phone:/(전화|휴대|핸드폰|연락처|mobile|phone|tel)/i, email:/(이메일|메일주소|e-?mail)/i,
      business:/(사업자|사업자등록|법인번호|business)/i, id:/(주민|외국인|등록번호|resident|rrn)/i, consent:/(수신.?동의|광고.?동의|마케팅.?동의|opt.?in|consent)/i
    };
    const headerIndex = headers.findIndex(header => patterns[type].test(header));
    if (headerIndex >= 0) return headerIndex;
    const sample = rows.slice(0,30);
    if (type === 'phone') return bestSampleColumn(headers,sample,value => normalizePhone(value).valid);
    if (type === 'email') return bestSampleColumn(headers,sample,value => isValidEmail(normalizeEmail(value)));
    return -1;
  }

  function bestSampleColumn(headers,rows,test) {
    let best=-1,bestRatio=.65;
    headers.forEach((_,index) => { const values=rows.map(row => row[index]).filter(value => value && value.trim()); if (!values.length) return; const ratio=values.filter(test).length/values.length; if (ratio>bestRatio) { best=index; bestRatio=ratio; } });
    return best;
  }

  function parseCsv(text,delimiter,rowLimit=Infinity) { const rows=[]; let row=[],cell='',quoted=false; for(let i=0;i<text.length;i+=1){const char=text[i]; if(char==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i+=1;}else quoted=!quoted;}else if(char===delimiter&&!quoted){row.push(cell);cell='';}else if((char==='\n'||char==='\r')&&!quoted){if(char==='\r'&&text[i+1]==='\n')i+=1;row.push(cell);rows.push(row);row=[];cell='';if(rows.length>=rowLimit)break;}else cell+=char;} if(row.length||cell){row.push(cell);rows.push(row);} return rows; }
  function detectEncoding(bytes){if(bytes.length>=3&&bytes[0]===0xef&&bytes[1]===0xbb&&bytes[2]===0xbf)return'utf-8';try{new TextDecoder('utf-8',{fatal:true}).decode(bytes);return'utf-8';}catch(_){return'euc-kr';}}
  function decodeBytes(bytes,encoding){let text=new TextDecoder(encoding,{fatal:false}).decode(bytes);return text.charCodeAt(0)===0xfeff?text.slice(1):text;}
  function detectDelimiter(text){const candidates=[',','\t',';','|'];let best=',',score=-1;candidates.forEach(candidate=>{const rows=parseCsv(text.slice(0,15000),candidate,12);const counts=rows.map(row=>row.length);const current=counts.length?Math.max(...counts)*counts.filter(value=>value===counts[0]).length:0;if(counts[0]>1&&current>score){best=candidate;score=current;}});return best;}
  function normalizeName(value){return String(value||'').trim().replace(/\s+/g,' ');}
  function isPlausibleName(value){return value.length<=80&&!/[0-9@]/.test(value);}
  function normalizeEmail(value){return String(value||'').trim().toLowerCase().replace(/\s+/g,'');}
  function isValidEmail(value){return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)&&!value.includes('..');}
  function normalizePhone(value){let digits=onlyDigits(value);if(digits.startsWith('82')&&digits.length>=11)digits='0'+digits.slice(2);let formatted=String(value||'').trim(),valid=false;if(/^01[016789]\d{7,8}$/.test(digits)){formatted=digits.length===11?`${digits.slice(0,3)}-${digits.slice(3,7)}-${digits.slice(7)}`:`${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6)}`;valid=true;}else if(/^02\d{7,8}$/.test(digits)){formatted=digits.length===10?`${digits.slice(0,2)}-${digits.slice(2,6)}-${digits.slice(6)}`:`${digits.slice(0,2)}-${digits.slice(2,5)}-${digits.slice(5)}`;valid=true;}else if(/^0[3-6][1-5]\d{7,8}$/.test(digits)||/^1[5-8]\d{6}$/.test(digits)){formatted=digits.length===8?`${digits.slice(0,4)}-${digits.slice(4)}`:digits.length===11?`${digits.slice(0,3)}-${digits.slice(3,7)}-${digits.slice(7)}`:`${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6)}`;valid=true;}return{digits,formatted,valid};}
  function normalizeBusiness(value){const digits=onlyDigits(value);return digits.length===10?`${digits.slice(0,3)}-${digits.slice(3,5)}-${digits.slice(5)}`:String(value||'').trim();}
  function maskName(value){const text=String(value||'');if(text.length<=1)return'*';if(text.length===2)return text[0]+'*';return text[0]+'*'.repeat(Math.max(1,text.length-2))+text.slice(-1);}
  function maskPhone(value){const phone=normalizePhone(value);return phone.valid?phone.formatted.replace(/-(\d{3,4})-/,'-****-'):String(value||'').replace(/\d(?=\d{4})/g,'*');}
  function maskEmail(value){const email=normalizeEmail(value);const [local,domain]=email.split('@');if(!domain)return value;return `${local.slice(0,Math.min(2,local.length))}${'*'.repeat(Math.max(1,local.length-2))}@${domain}`;}
  function maskId(value){const digits=onlyDigits(value);return digits.length>6?`${digits.slice(0,6)}-${'*'.repeat(digits.length-6)}`:'*'.repeat(Math.max(1,String(value||'').length));}
  function serializeCsv(rows){return rows.map(row=>row.map(csvCell).join(',')).join('\r\n');}
  function csvCell(value){let text=String(value??'');if(/^[=+@]/.test(text)||(/^-/ .test(text)&&!/^-\d+(\.\d+)?$/.test(text)))text="'"+text;return /[",\r\n]/.test(text)?`"${text.replace(/"/g,'""')}"`:text;}
  function saveBlob(text,filename){const blob=new Blob([text],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=filename;document.body.appendChild(anchor);anchor.click();anchor.remove();URL.revokeObjectURL(url);setStatus(`${filename} 파일을 만들었습니다.`,'success');}
  function resetTool(){state.file=null;state.bytes=null;state.text='';state.headers=[];state.rows=[];state.report=null;el.file.value='';el.fileSummary.classList.remove('is-visible');el.read.disabled=true;el.reset.disabled=true;el.mapPanel.classList.add('crm-hidden');el.resultPanel.classList.add('crm-hidden');el.outputPanel.classList.add('crm-hidden');setStatus('CSV 고객명단을 선택해 주세요.');}
  function addCandidate(map,key,index){if(!key)return;if(!map.has(key))map.set(key,[]);map.get(key).push(index);}
  function fitRow(row,length){return Array.from({length},(_,index)=>String(row[index]??''));}
  function indexValue(select){return select.value===''?-1:Number(select.value);}
  function canonical(value){return String(value||'').trim().toLowerCase().replace(/\s+/g,'');}
  function exactCanonical(value){return String(value||'').trim().toLowerCase().replace(/\s+/g,' ');}
  function onlyDigits(value){return String(value||'').replace(/\D/g,'');}
  function consentValues(){return new Set(el.consentValue.value.split(',').map(canonical).filter(Boolean));}
  function metric(label,value,type=''){return `<div class="crm-metric ${type}"><strong>${Number(value).toLocaleString()}</strong><span>${label}</span></div>`;}
  function candidateTypeLabel(type){return({id:'식별번호',business:'사업자번호(동일 회사 가능)',phone:'전화번호 전체',email:'이메일 전체',nameLast4:'이름+전화번호 끝 4자리'})[type]||type;}
  function delimiterValue(value){return value==='tab'?'\t':value;}
  function delimiterLabel(value){return value==='\t'?'탭 구분':value===','?'쉼표 구분':`${value} 구분`;}
  function encodingLabel(value){return value==='euc-kr'?'CP949/EUC-KR':'UTF-8';}
  function baseName(){return state.file?state.file.name.replace(/\.(csv|txt)$/i,''):'crm-list';}
  function formatBytes(bytes){return bytes<1024*1024?`${(bytes/1024).toFixed(1)}KB`:`${(bytes/1024/1024).toFixed(1)}MB`;}
  function sizeBand(bytes){return bytes<1024*1024?'under_1mb':bytes<10*1024*1024?'1mb_to_10mb':'over_10mb';}
  function rowBand(count){return count<1000?'under_1k':count<10000?'1k_to_10k':count<100000?'10k_to_100k':'over_100k';}
  function countBand(count){return count===0?'0':count<10?'1_to_9':count<100?'10_to_99':'100_plus';}
  function setStatus(message,type=''){el.status.className=`crm-status${type?` is-${type}`:''}`;el.status.textContent=message;}
  function toCamel(value){return value.replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase());}
  function escapeHtml(value){const div=document.createElement('div');div.textContent=String(value);return div.innerHTML;}
  function escapeAttr(value){return escapeHtml(value).replace(/"/g,'&quot;');}

  window.CRM_LIST_CHECKER_TEST = {parseCsv,normalizeName,normalizeEmail,isValidEmail,normalizePhone,normalizeBusiness,maskName,maskPhone,maskEmail,maskId,auditRows,serializeCsv};
})();
