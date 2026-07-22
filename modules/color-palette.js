(() => {
  'use strict';

  const MAX_FILE_SIZE = 15 * 1024 * 1024;
  const state = { file: null, imageUrl: '', colors: [], primaryIndex: 0, variants: [], variantIndex: 0 };
  const el = {};

  document.addEventListener('DOMContentLoaded', () => {
    Object.assign(el, {
      dropzone: document.getElementById('palette-dropzone'), file: document.getElementById('palette-file'), empty: document.getElementById('palette-empty-state'),
      image: document.getElementById('palette-image-preview'), reselect: document.getElementById('palette-reselect'), analyze: document.getElementById('palette-analyze'),
      status: document.getElementById('palette-file-status'), extracted: document.getElementById('palette-extracted'), results: document.getElementById('palette-results'),
      variants: document.getElementById('palette-variants'), roles: document.getElementById('palette-role-list'), preview: document.getElementById('palette-ui-preview'),
      contrastSummary: document.getElementById('palette-contrast-summary'), checks: document.getElementById('palette-contrast-checks'), css: document.getElementById('palette-css-output'),
      prompt: document.getElementById('palette-prompt-output'), copyCss: document.getElementById('copy-palette-css'), copyPrompt: document.getElementById('copy-palette-prompt'),
      canvas: document.getElementById('palette-analysis-canvas'), pptDeck: document.getElementById('palette-ppt-deck'), pptDownload: document.getElementById('download-palette-pptx')
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
    el.reselect.addEventListener('click', () => el.file.click());
    el.analyze.addEventListener('click', analyzeImage);
    el.copyCss.addEventListener('click', () => copyOutput(el.css.textContent, 'CSS 변수를 복사했습니다.', 'css'));
    el.copyPrompt.addEventListener('click', () => copyOutput(el.prompt.textContent, 'AI 제작 프롬프트를 복사했습니다.', 'prompt'));
    el.pptDownload.addEventListener('click', downloadPptx);
  }

  function selectFile(file) {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) return setStatus('JPG, PNG 또는 WebP 이미지만 선택할 수 있습니다.', 'error');
    if (file.size > MAX_FILE_SIZE) return setStatus('이미지 크기는 15MB 이하만 지원합니다.', 'error');
    if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);
    state.file = file; state.imageUrl = URL.createObjectURL(file); state.colors = [];
    el.image.src = state.imageUrl; el.dropzone.classList.add('has-image'); el.reselect.disabled = false; el.analyze.disabled = false;
    el.results.hidden = true; el.extracted.innerHTML = '<div class="palette-placeholder">색상 분석 버튼을 눌러주세요.</div>';
    setStatus(`${file.name} · ${formatBytes(file.size)} · 이미지는 이 브라우저에서만 처리됩니다.`, 'success');
    track('tool_file_selected', { file_size_band: sizeBand(file.size) });
  }

  async function analyzeImage() {
    if (!state.file) return;
    el.analyze.disabled = true; el.analyze.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 색상 분석 중';
    try {
      const image = await loadImage(state.imageUrl);
      state.colors = extractColors(image, 5);
      if (state.colors.length < 3) throw new Error('색상을 충분히 구분하지 못했습니다.');
      state.primaryIndex = choosePrimary(state.colors);
      renderExtracted(); buildVariants(); renderResults();
      el.results.hidden = false; setStatus('대표색을 찾았습니다. 메인 색상을 바꾸거나 추천 팔레트를 선택해 보세요.', 'success');
      el.results.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      track('tool_analysis_completed', { extracted_color_count: state.colors.length });
    } catch (error) {
      setStatus('이미지 색상을 분석하지 못했습니다. 다른 이미지로 다시 시도해 주세요.', 'error');
    } finally {
      el.analyze.disabled = false; el.analyze.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i> 다시 분석하기';
    }
  }

  function loadImage(url) { return new Promise((resolve,reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = url; }); }

  function extractColors(image, count) {
    const max = 720; const scale = Math.min(1, max / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale)); const height = Math.max(1, Math.round(image.naturalHeight * scale));
    el.canvas.width = width; el.canvas.height = height;
    const context = el.canvas.getContext('2d', { willReadFrequently: true }); context.drawImage(image, 0, 0, width, height);
    const data = context.getImageData(0, 0, width, height).data; const samples = []; const stride = Math.max(1, Math.floor(Math.sqrt((width * height) / 12000)));
    for (let y = 0; y < height; y += stride) for (let x = 0; x < width; x += stride) {
      const index = (y * width + x) * 4; if (data[index + 3] < 210) continue;
      const rgb = [data[index],data[index+1],data[index+2]]; const hsl = rgbToHsl(rgb); const center = 1 - Math.min(1, Math.hypot((x/width)-.5,(y/height)-.5)/.71);
      samples.push({ rgb, weight: .72 + hsl[1] * .58 + center * .24 });
    }
    if (!samples.length) return [];
    let centers = [samples.reduce((best,item) => item.weight > best.weight ? item : best).rgb.slice()];
    while (centers.length < count) {
      let best = null; let bestScore = -1;
      samples.forEach(sample => { const distance = Math.min(...centers.map(center => colorDistance(sample.rgb,center))); const score = distance * sample.weight; if (score > bestScore) { best = sample; bestScore = score; } });
      centers.push(best.rgb.slice());
    }
    let groups = [];
    for (let iteration = 0; iteration < 12; iteration += 1) {
      groups = centers.map(() => ({ sum:[0,0,0], weight:0, count:0 }));
      samples.forEach(sample => { let nearest = 0; let nearestDistance = Infinity; centers.forEach((center,index) => { const distance = colorDistance(sample.rgb,center); if (distance < nearestDistance) { nearest=index; nearestDistance=distance; } }); const group=groups[nearest]; group.sum[0]+=sample.rgb[0]*sample.weight; group.sum[1]+=sample.rgb[1]*sample.weight; group.sum[2]+=sample.rgb[2]*sample.weight; group.weight+=sample.weight; group.count+=1; });
      centers = centers.map((center,index) => groups[index].weight ? groups[index].sum.map(value => Math.round(value/groups[index].weight)) : center);
    }
    const total = groups.reduce((sum,group) => sum+group.count,0);
    return centers.map((rgb,index) => ({ rgb, hex:rgbToHex(rgb), share:groups[index].count/total, hsl:rgbToHsl(rgb) })).sort((a,b) => b.share-a.share);
  }

  function choosePrimary(colors) {
    let bestIndex=0,bestScore=-1;
    colors.forEach((color,index) => { const [h,s,l]=color.hsl; const usable=1-Math.min(1,Math.abs(l-.52)*1.35); const score=color.share*.9+s*.75+usable*.35+(index===0?-.08:0); if(score>bestScore){bestScore=score;bestIndex=index;} });
    return bestIndex;
  }

  function renderExtracted() {
    el.extracted.innerHTML = state.colors.map((color,index) => `<button type="button" class="extracted-color${index===state.primaryIndex?' is-primary':''}" data-color-index="${index}" aria-label="${color.hex}을 메인 컬러로 선택"><span class="extracted-color-swatch" style="background:${color.hex}"></span>${index===state.primaryIndex?'<span class="extracted-primary-label">메인</span>':''}<span class="extracted-color-info"><strong>${color.hex}</strong><small>이미지 약 ${Math.round(color.share*100)}%</small></span></button>`).join('');
    el.extracted.querySelectorAll('.extracted-color').forEach(button => button.addEventListener('click', () => {
      state.primaryIndex = Number(button.dataset.colorIndex); state.variantIndex=0; renderExtracted(); buildVariants(); renderResults();
      track('palette_primary_changed', { selected_hex:state.colors[state.primaryIndex].hex });
    }));
  }

  function buildVariants() {
    const primary=state.colors[state.primaryIndex].hex; const primaryHsl=hexToHsl(primary); const originalSecondary=findDistinctColor(primary,false); const originalAccent=findDistinctColor(primary,true);
    state.variants=[
      makePalette('원본 중심','이미지의 색감을 가장 잘 유지',primary,originalSecondary,originalAccent),
      makePalette('차분한 B2B','신뢰감 있는 뉴트럴 조합',primary,hslToHex([primaryHsl[0],Math.min(primaryHsl[1]*.42,.35),.72]),hslToHex([(primaryHsl[0]+38)%360,Math.min(.62,primaryHsl[1]+.12),.54])),
      makePalette('선명한 강조','CTA가 눈에 띄는 보색 조합',primary,hslToHex([(primaryHsl[0]+24)%360,Math.min(.5,primaryHsl[1]*.72),.68]),hslToHex([(primaryHsl[0]+180)%360,Math.max(.62,primaryHsl[1]),.5]))
    ];
  }

  function findDistinctColor(primary,accent) {
    const primaryRgb=hexToRgb(primary); const candidates=state.colors.filter((_,index)=>index!==state.primaryIndex);
    candidates.sort((a,b)=>{ const score=color=>colorDistance(color.rgb,primaryRgb)*(accent?(.45+color.hsl[1]):1)*(.55+color.share); return score(b)-score(a); });
    return candidates[0]?.hex || primary;
  }

  function makePalette(name,description,primary,secondary,accent) {
    const primaryHsl=hexToHsl(primary); const background=primaryHsl[2]<.18?'#F8FAFC':hslToHex([primaryHsl[0],Math.min(.12,primaryHsl[1]*.12),.975]);
    const surface=hslToHex([primaryHsl[0],Math.min(.18,primaryHsl[1]*.22),.93]); const text=bestText(background,'body'); const muted=mixColors(text,background,.42); const onPrimary=bestText(primary,'button');
    return { name,description,primary,secondary,accent,background,surface,text,muted,onPrimary,accentText:bestText(surface,'body') };
  }

  function renderResults() {
    renderVariants(); const palette=state.variants[state.variantIndex]; renderRoles(palette); renderPreview(palette); renderAccessibility(palette); renderExports(palette);
  }

  function renderVariants() {
    el.variants.innerHTML=state.variants.map((palette,index)=>`<button type="button" class="palette-variant" role="tab" aria-selected="${index===state.variantIndex}" data-variant-index="${index}"><span class="variant-swatches">${['primary','secondary','accent','background','surface','text'].map(role=>`<span style="background:${palette[role]}"></span>`).join('')}</span><span class="variant-copy"><strong>${palette.name}</strong><small>${palette.description}</small></span></button>`).join('');
    el.variants.querySelectorAll('.palette-variant').forEach(button=>button.addEventListener('click',()=>{ state.variantIndex=Number(button.dataset.variantIndex); renderResults(); track('palette_variant_selected',{variant_name:state.variants[state.variantIndex].name}); }));
  }

  function renderRoles(palette) {
    const roles=[['메인','primary','주요 버튼과 핵심 제목'],['보조','secondary','카드와 보조 요소'],['포인트','accent','중요 CTA와 강조'],['배경','background','넓은 화면 배경'],['표면','surface','카드와 패널'],['본문','text','제목과 긴 문장']];
    el.roles.innerHTML=roles.map(([label,key,use])=>`<div class="palette-role-item"><span class="palette-role-swatch" style="background:${palette[key]}"></span><span class="palette-role-copy"><strong>${label} 컬러</strong><small>${use}</small></span><button type="button" class="palette-role-hex" data-copy-color="${palette[key]}" aria-label="${label} 컬러 ${palette[key]} 복사">${palette[key]}</button></div>`).join('');
    el.roles.querySelectorAll('[data-copy-color]').forEach(button=>button.addEventListener('click',()=>copyOutput(button.dataset.copyColor,'색상값을 복사했습니다.','hex')));
  }

  function renderPreview(palette) {
    const properties={background:palette.background,text:palette.text,primary:palette.primary,secondary:palette.secondary,accent:palette.accent,surface:palette.surface,muted:palette.muted,onPrimary:palette.onPrimary,accentText:palette.accentText};
    // UI 미리보기와 PPT 템플릿이 같은 --demo-* 변수를 참조하므로 두 컨테이너에 함께 주입합니다.
    [el.preview,el.pptDeck].filter(Boolean).forEach(target=>{
      Object.entries(properties).forEach(([key,value])=>target.style.setProperty(`--demo-${key.replace(/[A-Z]/g,m=>'-'+m.toLowerCase())}`,value));
    });
  }

  function renderAccessibility(palette) {
    const tests=[['본문 / 배경',palette.text,palette.background,4.5],['메인 버튼',palette.onPrimary,palette.primary,4.5],['메인 / 배경',palette.primary,palette.background,3],['포인트 / 표면',palette.accent,palette.surface,3]];
    let passes=0; el.checks.innerHTML=tests.map(([label,foreground,background,target])=>{ const ratio=contrastRatio(foreground,background); const pass=ratio>=target; if(pass)passes+=1; return `<span class="contrast-check ${pass?'pass':'warn'}"><i class="fas ${pass?'fa-check':'fa-exclamation'}"></i> ${label} ${ratio.toFixed(1)}:1</span>`; }).join('');
    el.contrastSummary.textContent=`${passes}/${tests.length} 조합 통과`;
  }

  function renderExports(palette) {
    el.css.textContent=`:root {\n  --color-primary: ${palette.primary};\n  --color-secondary: ${palette.secondary};\n  --color-accent: ${palette.accent};\n  --color-background: ${palette.background};\n  --color-surface: ${palette.surface};\n  --color-text: ${palette.text};\n  --color-muted: ${palette.muted};\n  --color-on-primary: ${palette.onPrimary};\n}`;
    el.prompt.textContent=`${palette.name} 컬러 시스템을 적용한다. 메인 컬러 ${palette.primary}은 주요 CTA와 핵심 제목에 사용하고, 보조 컬러 ${palette.secondary}는 카드와 보조 요소에 사용한다. 포인트 컬러 ${palette.accent}는 가장 중요한 행동과 강조에만 제한적으로 적용한다. 전체 배경은 ${palette.background}, 카드 표면은 ${palette.surface}, 본문은 ${palette.text}를 사용한다. 넓은 영역에는 배경과 표면 컬러를 중심으로 사용하고 본문과 버튼의 명도 대비를 유지한다.`;
  }

  /* ----------------------------------------------------
     PPT 템플릿(.pptx) 생성
     화면 미리보기와 같은 3장(표지·목차·본문) 구성을 좌표로 옮깁니다.
  ---------------------------------------------------- */
  const PPTX_CDN='https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js';
  // 맑은 고딕은 Windows 전 버전과 Mac용 Office 에 기본 탑재된 유일한 한글 폰트라,
  // 받는 사람 PC 에서 폰트가 대체되어 레이아웃이 깨질 일이 없습니다.
  const PPT_FONT='Malgun Gothic';
  const PPT_TOC=[['01','추진 배경','왜 지금 이 과제인가'],['02','현황 분석','업무 흐름과 병목 구간'],['03','개선 방안','자동화 적용 범위'],['04','기대 효과','시간·비용 절감 추정'],['05','실행 계획','일정과 담당 역할']];
  const PPT_BULLETS=['부서별 자료 취합에 주당 12시간이 소요됩니다.','양식이 달라 매번 재가공이 필요합니다.','오류가 생겨도 원인 추적이 어렵습니다.'];
  const PPT_CARDS=[['12시간','주당 반복 업무'],['4개 부서','양식 불일치'],['27%','재작업 비율']];
  const PPT_STEPS=[['01','현황 진단','반복 업무 유형과 소요 시간을 조사합니다.'],['02','우선순위 선정','효과와 난이도를 기준으로 과제를 고릅니다.'],['03','자동화 구축','도구를 도입하고 업무 절차를 재설계합니다.'],['04','정착·확산','교육과 운영 가이드를 배포합니다.']];
  const PPT_COLUMNS=[['적용 범위',['부서별 자료 취합 자동화','보고서 양식 표준화','오류 검증 절차 자동화']],['기대 효과',['연 600시간 업무 절감','재작업 비율 27% 감소','담당자 업무 만족도 개선']],['필요 자원',['실무 담당 2인 배치','자동화 도구 라이선스','실무자 교육 4시간']]];
  const PPT_TABLE_HEAD=['구분','주요 활동','담당','완료 목표'];
  const PPT_TABLE_ROWS=[['1단계','업무 현황 조사와 과제 선정','기획전략팀','2026. 08.'],['2단계','자동화 도구 도입과 시범 적용','정보시스템팀','2026. 10.'],['3단계','전사 확산과 실무자 교육','기획전략팀','2026. 12.'],['4단계','운영 안정화와 효과 측정','전 부서','2027. 03.']];
  let pptxLoader=null;

  // 약 1MB 라이브러리이므로 페이지 로드가 아니라 버튼을 누른 시점에 내려받습니다.
  function loadPptxGen() {
    if (window.PptxGenJS) return Promise.resolve(window.PptxGenJS);
    if (pptxLoader) return pptxLoader;
    pptxLoader=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src=PPTX_CDN; script.async=true;
      script.onload=()=>window.PptxGenJS?resolve(window.PptxGenJS):reject(new Error('PptxGenJS 로드 실패'));
      script.onerror=()=>{ pptxLoader=null; reject(new Error('PptxGenJS 로드 실패')); };
      document.head.appendChild(script);
    });
    return pptxLoader;
  }

  async function downloadPptx() {
    const palette=state.variants[state.variantIndex];
    if (!palette) return;
    const button=el.pptDownload; const original=button.innerHTML;
    button.disabled=true; button.innerHTML='<i class="fas fa-spinner fa-spin"></i> PPT 만드는 중';
    try {
      const PptxGenJS=await loadPptxGen();
      const deck=new PptxGenJS();
      deck.layout='LAYOUT_16x9';
      buildCoverSlide(deck,palette); buildTocSlide(deck,palette); buildBodySlide(deck,palette);
      buildProcessSlide(deck,palette); buildDiagramSlide(deck,palette); buildTableSlide(deck,palette);
      await deck.writeFile({ fileName:`데이터공방_PPT템플릿_${palette.name}.pptx` });
      if (window.showToast) window.showToast('PPT 템플릿을 내려받았습니다.');
      track('palette_ppt_downloaded',{variant_name:palette.name});
    } catch (error) {
      if (window.showToast) window.showToast('PPT 템플릿을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.','error');
    } finally {
      button.disabled=false; button.innerHTML=original;
    }
  }

  function pptText(value) { return String(value).replace('#',''); }
  function pptFont(options) { return Object.assign({ fontFace:PPT_FONT },options); }

  // 표지: 메인 컬러를 전면에 깔고 하단에 정보 밴드를 두는 컨설팅 보고서 표지 구성입니다.
  function buildCoverSlide(deck,palette) {
    const slide=deck.addSlide(); slide.background={ color:pptText(palette.primary) };
    const onPrimarySoft=mixColors(palette.onPrimary,palette.primary,0.3);
    slide.addShape(deck.ShapeType.rect,{ x:0.9,y:1.62,w:0.62,h:0.055,fill:{color:pptText(palette.accent)} });
    slide.addText('2026 상반기 실적 보고',pptFont({ x:0.9,y:1.85,w:7,h:0.3,fontSize:11,bold:true,charSpacing:1.6,color:pptText(onPrimarySoft) }));
    slide.addText('업무 자동화 추진 결과 보고서',pptFont({ x:0.9,y:2.2,w:7.6,h:0.85,fontSize:32,bold:true,charSpacing:-0.8,color:pptText(palette.onPrimary) }));
    slide.addText('반복 업무 축소를 통한 생산성 개선 방안',pptFont({ x:0.9,y:3.12,w:7.6,h:0.35,fontSize:13,color:pptText(onPrimarySoft) }));
    // 하단 정보 밴드(높이 20%)
    slide.addShape(deck.ShapeType.rect,{ x:0,y:4.5,w:10,h:1.13,fill:{color:pptText(palette.background)} });
    slide.addText('기획전략팀',pptFont({ x:0.9,y:4.5,w:4,h:1.13,fontSize:11,valign:'middle',margin:0,color:pptText(palette.muted) }));
    slide.addText('2026. 07.',pptFont({ x:5,y:4.5,w:4.1,h:1.13,fontSize:11,align:'right',valign:'middle',margin:0,color:pptText(palette.muted) }));
  }

  // 목차·본문 공통 머리말: 제목 + 우측 문서 라벨 + 포인트색이 물린 얇은 구분선
  function buildDocHeader(deck,slide,palette,title,charSpacing) {
    slide.addText(title,pptFont({ x:0.9,y:0.5,w:4.4,h:0.42,fontSize:19,bold:true,valign:'middle',margin:0,charSpacing,color:pptText(palette.text) }));
    slide.addText('전략 보고서',pptFont({ x:5.5,y:0.5,w:3.6,h:0.42,fontSize:10,align:'right',valign:'middle',margin:0,color:pptText(palette.muted) }));
    slide.addShape(deck.ShapeType.rect,{ x:0.9,y:1.02,w:8.2,h:0.035,fill:{color:pptText(palette.primary)} });
    slide.addShape(deck.ShapeType.rect,{ x:0.9,y:1.02,w:0.74,h:0.035,fill:{color:pptText(palette.accent)} });
  }

  // 번호형 소제목 + 리드 문장 (모든 본문 슬라이드 공통)
  function buildSectionIntro(slide,palette,heading,lead) {
    slide.addText(heading,pptFont({ x:0.9,y:1.2,w:8.2,h:0.3,fontSize:13,bold:true,margin:0,color:pptText(palette.primary) }));
    slide.addText(lead,pptFont({ x:0.9,y:1.53,w:8.2,h:0.3,fontSize:10,margin:0,color:pptText(palette.muted) }));
  }

  // 하단 결론 스트립
  function buildConclusion(deck,slide,palette,text) {
    slide.addShape(deck.ShapeType.rect,{ x:0.9,y:4.35,w:8.2,h:0.58,fill:{color:pptText(palette.surface)} });
    slide.addShape(deck.ShapeType.rect,{ x:0.9,y:4.35,w:0.07,h:0.58,fill:{color:pptText(palette.accent)} });
    slide.addText(text,pptFont({ x:1.15,y:4.35,w:7.8,h:0.58,fontSize:11,bold:true,valign:'middle',margin:0,color:pptText(palette.text) }));
  }

  function buildPageNumber(deck,slide,palette,number) {
    slide.addText(number,pptFont({ x:8.1,y:5.05,w:1,h:0.3,fontSize:9,bold:true,align:'right',margin:0,color:pptText(palette.muted) }));
  }

  function buildTocSlide(deck,palette) {
    const slide=deck.addSlide(); slide.background={ color:pptText(palette.background) };
    buildDocHeader(deck,slide,palette,'CONTENTS',2.5);
    PPT_TOC.forEach(([number,title,description],index)=>{
      const y=1.42+index*0.66;
      slide.addShape(deck.ShapeType.ellipse,{ x:0.9,y:y+0.06,w:0.38,h:0.38,fill:{color:pptText(palette.primary)} });
      slide.addText(number,pptFont({ x:0.9,y:y+0.06,w:0.38,h:0.38,fontSize:10,bold:true,align:'center',valign:'middle',margin:0,color:pptText(palette.onPrimary) }));
      slide.addText(title,pptFont({ x:1.45,y,w:2.4,h:0.5,fontSize:13,bold:true,valign:'middle',margin:0,color:pptText(palette.text) }));
      slide.addText(description,pptFont({ x:3.95,y,w:5.15,h:0.5,fontSize:10.5,valign:'middle',margin:0,color:pptText(palette.muted) }));
      if (index<PPT_TOC.length-1) slide.addShape(deck.ShapeType.rect,{ x:0.9,y:y+0.53,w:8.2,h:0.008,fill:{color:pptText(palette.surface)} });
    });
    buildPageNumber(deck,slide,palette,'02');
  }

  function buildBodySlide(deck,palette) {
    const slide=deck.addSlide(); slide.background={ color:pptText(palette.background) };
    buildDocHeader(deck,slide,palette,'현황 분석',-0.5);
    buildSectionIntro(slide,palette,'1. 업무 흐름과 병목 구간','부서별 자료 취합 과정에서 반복 작업이 어디에 집중되는지 정리했습니다.');
    // 왼쪽 불릿과 오른쪽 지표 카드를 같은 행에 맞춥니다.
    PPT_BULLETS.forEach((line,index)=>{
      const y=2.0+index*0.66;
      slide.addShape(deck.ShapeType.rect,{ x:0.92,y:y+0.24,w:0.09,h:0.09,fill:{color:pptText(palette.accent)} });
      slide.addText(line,pptFont({ x:1.15,y,w:3.95,h:0.56,fontSize:10.5,valign:'middle',margin:0,color:pptText(palette.text) }));
    });
    PPT_CARDS.forEach(([value,label],index)=>{
      const y=2.0+index*0.66;
      slide.addShape(deck.ShapeType.rect,{ x:5.3,y,w:3.8,h:0.56,fill:{color:pptText(palette.surface)} });
      slide.addShape(deck.ShapeType.rect,{ x:5.3,y,w:0.07,h:0.56,fill:{color:pptText(palette.primary)} });
      slide.addText(value,pptFont({ x:5.55,y,w:1.6,h:0.56,fontSize:12,bold:true,valign:'middle',margin:0,color:pptText(palette.text) }));
      slide.addText(label,pptFont({ x:7.1,y,w:1.85,h:0.56,fontSize:9.5,align:'right',valign:'middle',margin:0,color:pptText(palette.muted) }));
    });
    buildConclusion(deck,slide,palette,'자동화 적용 시 연간 약 600시간의 업무 시간 절감이 가능합니다.');
    buildPageNumber(deck,slide,palette,'03');
  }

  // 프로세스: 화살표(쉐브론) 4단계
  function buildProcessSlide(deck,palette) {
    const slide=deck.addSlide(); slide.background={ color:pptText(palette.background) };
    buildDocHeader(deck,slide,palette,'추진 프로세스',-0.5);
    buildSectionIntro(slide,palette,'2. 4단계 실행 절차','조사에서 정착까지 단계별로 무엇을 하는지 정리했습니다.');
    PPT_STEPS.forEach(([number,title,description],index)=>{
      const x=0.9+index*1.96;
      slide.addShape(deck.ShapeType.chevron,{ x,y:2.05,w:2.25,h:0.72,fill:{color:pptText(palette.primary)} });
      slide.addText(`${number}  ${title}`,pptFont({ x:x+0.12,y:2.05,w:1.85,h:0.72,fontSize:11,bold:true,align:'center',valign:'middle',margin:0,color:pptText(palette.onPrimary) }));
      slide.addText(description,pptFont({ x,y:2.95,w:2.05,h:0.8,fontSize:9.5,align:'center',margin:0,color:pptText(palette.muted) }));
    });
    buildConclusion(deck,slide,palette,'1~2단계는 3개월 내 완료하고, 3단계부터 전사로 넓혀 갑니다.');
    buildPageNumber(deck,slide,palette,'04');
  }

  // 다이어그램: 머리띠가 있는 3단 비교 카드
  function buildDiagramSlide(deck,palette) {
    const slide=deck.addSlide(); slide.background={ color:pptText(palette.background) };
    buildDocHeader(deck,slide,palette,'개선 방안',-0.5);
    buildSectionIntro(slide,palette,'3. 적용 범위와 필요 자원','무엇을 바꾸고, 무엇을 얻고, 무엇이 필요한지 나눠 보았습니다.');
    PPT_COLUMNS.forEach(([title,items],index)=>{
      const x=0.9+index*2.85;
      slide.addShape(deck.ShapeType.rect,{ x,y:2.05,w:2.5,h:0.48,fill:{color:pptText(palette.primary)} });
      slide.addText(title,pptFont({ x,y:2.05,w:2.5,h:0.48,fontSize:11.5,bold:true,align:'center',valign:'middle',margin:0,color:pptText(palette.onPrimary) }));
      slide.addShape(deck.ShapeType.rect,{ x,y:2.53,w:2.5,h:1.6,fill:{color:pptText(palette.surface)} });
      items.forEach((item,row)=>{
        const y=2.68+row*0.48;
        slide.addShape(deck.ShapeType.rect,{ x:x+0.18,y:y+0.16,w:0.08,h:0.08,fill:{color:pptText(palette.accent)} });
        slide.addText(item,pptFont({ x:x+0.36,y,w:2,h:0.4,fontSize:9.5,valign:'middle',margin:0,color:pptText(palette.text) }));
      });
    });
    buildConclusion(deck,slide,palette,'담당 2인과 교육 4시간만 확보되면 올해 안에 적용할 수 있습니다.');
    buildPageNumber(deck,slide,palette,'05');
  }

  // 표: 머리행에 메인 컬러를 쓴 기본 일정표
  function buildTableSlide(deck,palette) {
    const slide=deck.addSlide(); slide.background={ color:pptText(palette.background) };
    buildDocHeader(deck,slide,palette,'실행 계획',-0.5);
    buildSectionIntro(slide,palette,'4. 단계별 일정과 담당','단계마다 담당 조직과 완료 목표 시점을 명확히 했습니다.');
    const border=[{ pt:1,color:pptText(palette.surface) }];
    const head=PPT_TABLE_HEAD.map(text=>({ text,options:{ bold:true,color:pptText(palette.onPrimary),fill:{color:pptText(palette.primary)},align:'center' } }));
    const rows=PPT_TABLE_ROWS.map(cells=>cells.map((text,column)=>({
      text,options:{ color:pptText(column===0?palette.text:palette.muted),bold:column===0,align:column===1?'left':'center' }
    })));
    slide.addTable([head,...rows],{
      x:0.9,y:2.05,w:8.2,colW:[1.4,3.8,1.5,1.5],rowH:0.42,
      fontFace:PPT_FONT,fontSize:10,valign:'middle',border,margin:6
    });
    buildConclusion(deck,slide,palette,'2027년 1분기까지 효과 측정을 마치고 차기 과제를 선정합니다.');
    buildPageNumber(deck,slide,palette,'06');
  }

  async function copyOutput(text,message,type) { try { await navigator.clipboard.writeText(text); if(window.showToast) window.showToast(message); track('palette_output_copied',{output_type:type}); } catch(_) { if(window.showToast) window.showToast('복사하지 못했습니다. 직접 선택해 복사해 주세요.','error'); } }
  function setStatus(message,type='') { el.status.textContent=message; el.status.className=`palette-file-status${type?' is-'+type:''}`; }
  function track(name,params={}) { if(window.trackCRMEvent) window.trackCRMEvent(name,{tool_name:'image_color_palette',...params}); }
  function sizeBand(bytes) { if(bytes<1024*1024)return'under_1mb'; if(bytes<5*1024*1024)return'1_to_5mb'; return'5_to_15mb'; }
  function formatBytes(bytes) { return bytes<1024*1024?`${Math.max(1,Math.round(bytes/1024))}KB`:`${(bytes/(1024*1024)).toFixed(1)}MB`; }
  function colorDistance(a,b) { const dr=a[0]-b[0],dg=a[1]-b[1],db=a[2]-b[2]; return Math.sqrt(2*dr*dr+4*dg*dg+3*db*db); }
  function rgbToHex(rgb) { return '#'+rgb.map(value=>Math.max(0,Math.min(255,Math.round(value))).toString(16).padStart(2,'0')).join('').toUpperCase(); }
  function hexToRgb(hex) { const value=hex.replace('#',''); return [parseInt(value.slice(0,2),16),parseInt(value.slice(2,4),16),parseInt(value.slice(4,6),16)]; }
  function rgbToHsl([r,g,b]) { r/=255;g/=255;b/=255;const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;let h=0;const l=(max+min)/2;const s=d===0?0:d/(1-Math.abs(2*l-1));if(d){if(max===r)h=60*(((g-b)/d)%6);else if(max===g)h=60*((b-r)/d+2);else h=60*((r-g)/d+4);}return[(h+360)%360,s,l]; }
  function hexToHsl(hex) { return rgbToHsl(hexToRgb(hex)); }
  function hslToHex([h,s,l]) { h=((h%360)+360)%360;s=Math.max(0,Math.min(1,s));l=Math.max(0,Math.min(1,l));const c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs((h/60)%2-1)),m=l-c/2;let rgb;if(h<60)rgb=[c,x,0];else if(h<120)rgb=[x,c,0];else if(h<180)rgb=[0,c,x];else if(h<240)rgb=[0,x,c];else if(h<300)rgb=[x,0,c];else rgb=[c,0,x];return rgbToHex(rgb.map(v=>(v+m)*255)); }
  function mixColors(a,b,ratio) { const ar=hexToRgb(a),br=hexToRgb(b); return rgbToHex(ar.map((value,index)=>value*(1-ratio)+br[index]*ratio)); }
  function luminance(hex) { return hexToRgb(hex).map(v=>{v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4);}).reduce((sum,v,index)=>sum+v*[.2126,.7152,.0722][index],0); }
  function contrastRatio(a,b) { const l1=luminance(a),l2=luminance(b); return (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05); }
  function bestText(background,mode) { const dark='#0F172A',light='#FFFFFF'; if(mode==='body') return contrastRatio(dark,background)>=4.5?dark:light; return contrastRatio(light,background)>=contrastRatio(dark,background)?light:dark; }
})();
