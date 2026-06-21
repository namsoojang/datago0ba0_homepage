/**
 * modules/blog-handler.js
 * 데이터공방 JSON + Markdown 기반 초경량 블로그 시스템 구동 스크립트
 */

document.addEventListener("DOMContentLoaded", () => {
  // 1. 페이지 탐색 및 라우팅 판별
  const postsGrid = document.getElementById("blog-posts-grid");
  const detailArea = document.getElementById("blog-detail-content-area");

  if (postsGrid) {
    // 블로그 목록 페이지 실행
    initBlogList(postsGrid);
  } else if (detailArea) {
    // 블로그 상세 보기 페이지 실행
    initBlogDetail(detailArea);
  }
});

/**
 * ----------------------------------------------------
 * 📝 블로그 목록 페이지 제어 (blog.html)
 * ----------------------------------------------------
 */
async function initBlogList(gridEl) {
  const searchInput = document.getElementById("blog-search-input");
  const tabContainer = document.getElementById("blog-filter-tabs");
  
  let allPosts = [];
  let currentCategory = "all";
  let searchQuery = "";

  // A. posts.json 비동기 fetch
  try {
    const response = await fetch(`data/posts.json?v=${new Date().getTime()}`);
    if (!response.ok) throw new Error("블로그 데이터를 불러오는 데 실패했습니다.");
    allPosts = await response.json();
    
    // 로딩바 제거 후 렌더링
    gridEl.innerHTML = "";
    renderPosts(allPosts, gridEl);
  } catch (error) {
    console.error(error);
    gridEl.innerHTML = `
      <div class="blog-error-state">
        <i class="fas fa-exclamation-triangle"></i>
        <p>칼럼 리스트를 불러오는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.</p>
      </div>
    `;
    return;
  }

  // B. 포스트 카드 그리드 동적 렌더링 함수
  function renderPosts(posts, container) {
    if (posts.length === 0) {
      container.innerHTML = `
        <div class="blog-empty-state">
          <i class="far fa-folder-open"></i>
          <p>검색 조건에 맞는 게시글이 존재하지 않습니다.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = posts.map(post => {
      // 태그 배지 생성
      const tagsMarkup = post.tags && post.tags.length > 0 
        ? post.tags.map(t => `<span class="blog-card-tag">#${t}</span>`).join("")
        : "";

      return `
        <a href="blog-detail.html?id=${post.id}" class="blog-card" data-id="${post.id}">
          <div class="blog-card-thumb-wrapper">
            <img src="${post.thumbnail || './assets/images/logos/sketch_var7_ultrasimple_gold.png'}" class="blog-card-thumb" alt="${post.title} 썸네일" onerror="this.src='./assets/images/logos/sketch_var7_ultrasimple_gold.png'">
            <span class="blog-card-category-badge">${post.category}</span>
          </div>
          <div class="blog-card-body">
            <span class="blog-card-date"><i class="far fa-calendar-alt"></i> ${post.date}</span>
            <h3 class="blog-card-title">${post.title}</h3>
            <p class="blog-card-summary">${post.summary}</p>
            <div class="blog-card-tags">
              ${tagsMarkup}
            </div>
          </div>
          <div class="blog-card-footer">
            <span>칼럼 읽기</span>
            <i class="fas fa-arrow-right"></i>
          </div>
        </a>
      `;
    }).join("");
  }

  // C. 실시간 필터 및 검색 적용기
  function applyFilter() {
    let filtered = allPosts;

    // 카테고리 필터 적용
    if (currentCategory !== "all") {
      filtered = filtered.filter(p => p.category === currentCategory);
    }

    // 검색어 필터 적용
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.title.toLowerCase().includes(query) ||
        p.summary.toLowerCase().includes(query) ||
        (p.tags && p.tags.some(t => t.toLowerCase().includes(query)))
      );
    }

    renderPosts(filtered, gridEl);
  }

  // D. 이벤트 바인딩: 검색어 입력 (Debouncing 없이 직관적 실시간 검색 구현)
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value.trim();
      applyFilter();
    });
  }

  // E. 이벤트 바인딩: 카테고리 탭 클릭
  if (tabContainer) {
    const tabs = tabContainer.querySelectorAll(".filter-tab");
    tabs.forEach(tab => {
      tab.addEventListener("click", () => {
        tabs.forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        currentCategory = tab.dataset.category;
        applyFilter();
      });
    });
  }
}

/**
 * ----------------------------------------------------
 * 📖 블로그 상세 보기 페이지 제어 (blog-detail.html)
 * ----------------------------------------------------
 */
async function initBlogDetail(detailEl) {
  // A. URL Query Parameter에서 id 획득
  const urlParams = new URLSearchParams(window.location.search);
  const postId = urlParams.get("id");

  if (!postId) {
    renderError(detailEl, "잘못된 접근입니다. 게시글 ID가 지정되지 않았습니다.");
    return;
  }

  // B. posts.json에서 포스트 메타데이터 탐색
  try {
    const listResponse = await fetch(`data/posts.json?v=${new Date().getTime()}`);
    if (!listResponse.ok) throw new Error("블로그 메타데이터 로드 실패");
    const posts = await listResponse.json();
    
    const postMeta = posts.find(p => p.id === postId);
    if (!postMeta) {
      renderError(detailEl, "해당 포스팅을 찾을 수 없습니다. 삭제되었거나 존재하지 않는 글입니다.");
      return;
    }

    // C. 마크다운 본문 파일 fetch
    const mdResponse = await fetch(`${postMeta.contentPath}?v=${new Date().getTime()}`);
    if (!mdResponse.ok) throw new Error("마크다운 본문 파일을 로드하는 데 실패했습니다.");
    const markdownText = await mdResponse.text();

    // D. 마크다운 파싱 및 본문 렌더링
    if (typeof marked === "undefined") {
      throw new Error("Marked.js 라이브러리가 로드되지 않았습니다.");
    }

    // marked 옵션 설정 (테이블/개행 완벽 호환 보장)
    marked.setOptions({
      breaks: true,
      gfm: true
    });

    const bodyHtml = marked.parse(markdownText);

    // 상세 상세 화면 드로잉
    detailEl.innerHTML = `
      <header class="post-header">
        <div class="post-meta-top">
          <span class="post-detail-category">${postMeta.category}</span>
          <span class="post-detail-date"><i class="far fa-calendar-alt"></i> ${postMeta.date}</span>
        </div>
        <h1 class="post-detail-title">${postMeta.title}</h1>
        <div class="post-detail-tags">
          ${postMeta.tags ? postMeta.tags.map(t => `<span class="post-tag">#${t}</span>`).join(" ") : ""}
        </div>
      </header>
      
      <!-- 마크다운 변환된 본문 본체 -->
      <section class="post-body-contentmarkdown markdown-body">
        ${bodyHtml}
      </section>
    `;

    // E. Prism.js 코드 블록 하이라이팅 강제 재수행
    if (typeof Prism !== "undefined") {
      Prism.highlightAll();
    }

    // F. SEO 및 SNS 공유를 위한 브라우저 타이틀 & 메타 태그 동적 교체
    document.title = `${postMeta.title} | 데이터공방 공식 블로그`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute("content", postMeta.summary);
    }

  } catch (error) {
    console.error(error);
    renderError(detailEl, `포스팅을 렌더링하는 동안 오류가 발생했습니다. (${error.message})`);
  }

  // 에러 메시지 렌더러
  function renderError(container, msg) {
    container.innerHTML = `
      <div class="blog-error-state" style="text-align:center; padding: 40px 20px;">
        <i class="fas fa-exclamation-triangle" style="font-size:2.5rem; color:#f87171; margin-bottom:16px;"></i>
        <p style="color:#475569; font-size:1.1rem; line-height:1.6;">${msg}</p>
        <a href="blog.html" class="btn btn-secondary" style="margin-top:20px; display:inline-block; padding: 10px 20px; border-radius:6px;">블로그 목록으로 돌아가기</a>
      </div>
    `;
  }
}
