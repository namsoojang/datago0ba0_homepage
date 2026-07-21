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
      canvas: document.getElementById('palette-analysis-canvas')
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
    const properties={background:palette.background,text:palette.text,primary:palette.primary,secondary:palette.secondary,accent:palette.accent,surface:palette.surface,muted:palette.muted,onPrimary:palette.onPrimary,accentText:palette.accent};
    Object.entries(properties).forEach(([key,value])=>el.preview.style.setProperty(`--demo-${key.replace(/[A-Z]/g,m=>'-'+m.toLowerCase())}`,value));
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
