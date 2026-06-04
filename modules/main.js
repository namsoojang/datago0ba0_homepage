/* modules/main.js - 인터랙션 및 애니메이션 제어 통합 스크립트 */

// 1. Alert 대체용 커스텀 토스트 알림 기능 (CORS 제한 방지를 위해 toast.js 코드를 통합)
function getOrCreateToastContainer() {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  return container;
}

function showToast(message, type = 'success', duration = 3000) {
  const container = getOrCreateToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let iconClass = 'fa-check-circle';
  if (type === 'warning') iconClass = 'fa-exclamation-triangle';
  if (type === 'error') iconClass = 'fa-times-circle';
  
  toast.innerHTML = `
    <span class="toast-icon"><i class="fas ${iconClass}"></i></span>
    <span class="toast-message">${message}</span>
  `;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);
  
  setTimeout(() => {
    toast.classList.remove('show');
    toast.addEventListener('transitionend', () => {
      toast.remove();
    });
  }, duration);
}

// 2. DOM 로드 후 전체 인터랙션 동작 활성화
document.addEventListener('DOMContentLoaded', () => {
  // GSAP 및 ScrollTrigger 애니메이션 안전 초기화
  try {
    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
      gsap.registerPlugin(ScrollTrigger);
      initAnimations();
    } else {
      console.warn("GSAP or ScrollTrigger is not defined. Animations will be skipped.");
    }
  } catch (err) {
    console.error("Failed to initialize GSAP animations:", err);
  }

  // 각 UI 컴포넌트 안전 초기화 (에러 격리)
  const safeInit = (initFunc, name) => {
    try {
      initFunc();
    } catch (err) {
      console.error(`Failed to initialize ${name}:`, err);
    }
  };

  safeInit(initNavigation, 'Navigation');
  safeInit(initStrengthsAccordion, 'Strengths Accordion');
  safeInit(initCurriculumTabs, 'Curriculum Tabs');
  safeInit(initReferenceFilter, 'Reference Filter');
  safeInit(initTestimonialSlider, 'Testimonial Slider');
  safeInit(initEmailCopy, 'Email Copy');
  safeInit(initThemeToggle, 'Theme Toggle');
});

/* ----------------------------------------------------
   ★ 5대 애니메이션 패턴 구현 (GSAP & ScrollTrigger)
 ---------------------------------------------------- */
function initAnimations() {
  if (typeof gsap === 'undefined') return;
  // --- 패턴 1. Hero Entrance (GSAP Timeline) ---
  gsap.set([".hero-tag", ".hero-title span", ".hero-description", ".hero-buttons .btn", ".hero-profile-card"], {
    opacity: 0,
    y: 35
  });
  
  const heroTl = gsap.timeline({ defaults: { ease: "power3.out", duration: 0.8 } });
  
  heroTl.to(".hero-tag", { opacity: 1, y: 0, duration: 0.5 })
        .to(".hero-title span", { opacity: 1, y: 0, stagger: 0.15 }, "-=0.3")
        .to(".hero-description", { opacity: 1, y: 0, duration: 0.6 }, "-=0.4")
        .to(".hero-buttons .btn", { opacity: 1, y: 0, stagger: 0.12, duration: 0.5 }, "-=0.3")
        .to(".hero-profile-card", { opacity: 1, y: 0, duration: 0.7 }, "-=0.5");

  // --- 패턴 2. Mouse Parallax (히어로 카드 마우스 연동) ---
  const heroSection = document.querySelector(".hero-section");
  const profileCard = document.querySelector(".hero-profile-card");
  
  if (heroSection && profileCard && !window.matchMedia("(hover: none)").matches) {
    heroSection.addEventListener("mousemove", (e) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2;  // -1 to 1
      const y = (e.clientY / window.innerHeight - 0.5) * 2; // -1 to 1
      
      gsap.to(profileCard, { x: x * 18, y: y * 10, rotateY: x * 8, rotateX: -y * 8, duration: 0.8, ease: "power2.out" });
      gsap.to(".shape-1", { x: x * 40, y: y * 20, duration: 1.2, ease: "power1.out" });
      gsap.to(".shape-2", { x: -x * 30, y: -y * 15, duration: 1.5, ease: "power1.out" });
    });

    heroSection.addEventListener("mouseleave", () => {
      gsap.to(profileCard, { x: 0, y: 0, rotateY: 0, rotateX: 0, duration: 1.2, ease: "power3.out" });
      gsap.to(".shape-1", { x: 0, y: 0, duration: 1.5, ease: "power3.out" });
      gsap.to(".shape-2", { x: 0, y: 0, duration: 1.5, ease: "power3.out" });
    });
  }

  // --- 패턴 3. Scroll-triggered Reveals (강점 카드 3D 리빌) ---
  if (typeof ScrollTrigger !== 'undefined') {
    gsap.set(".strength-card", { opacity: 0, y: 60, rotateX: 18 });
    ScrollTrigger.batch(".strength-card", {
      start: "top 85%",
      once: true,
      onEnter: batch => gsap.to(batch, {
        opacity: 1,
        y: 0,
        rotateX: 0,
        duration: 0.8,
        stagger: 0.12,
        ease: "power2.out"
      })
    });

    // Biography 타임라인 연혁 부드러운 페이드인
    gsap.set(".timeline-item", { opacity: 0, x: -30 });
    ScrollTrigger.batch(".timeline-item", {
      start: "top 85%",
      once: true,
      onEnter: batch => gsap.to(batch, {
        opacity: 1,
        x: 0,
        duration: 0.6,
        stagger: 0.15,
        ease: "power2.out"
      })
    });
  } else {
    // ScrollTrigger가 로드되지 않았을 경우, 카드가 보이지 않는 버그 방지를 위해 즉시 노출
    gsap.set([".strength-card", ".timeline-item"], { opacity: 1, y: 0, rotateX: 0, x: 0 });
  }
}

/* ----------------------------------------------------
   네비게이션 헤더 및 모바일 토글 제어
---------------------------------------------------- */
function initNavigation() {
  const header = document.getElementById('header');
  const sections = document.querySelectorAll('section');
  const navLinks = document.querySelectorAll('.nav-link');
  const menuToggle = document.getElementById('menu-toggle');
  const navList = document.querySelector('.nav-links');

  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }

    let current = '';
    sections.forEach(section => {
      const sectionTop = section.offsetTop - 120;
      const sectionHeight = section.clientHeight;
      if (window.scrollY >= sectionTop && window.scrollY < sectionTop + sectionHeight) {
        current = section.getAttribute('id');
      }
    });

    navLinks.forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('href').slice(1) === current) {
        link.classList.add('active');
      }
    });
  });

  // 모바일 메뉴 토글
  if (menuToggle && navList) {
    menuToggle.addEventListener('click', () => {
      navList.classList.toggle('mobile-active');
      const icon = menuToggle.querySelector('i');
      if (navList.classList.contains('mobile-active')) {
        icon.className = 'fas fa-times';
        gsap.fromTo(".nav-links li", { opacity: 0, y: -10 }, { opacity: 1, y: 0, stagger: 0.08, duration: 0.3 });
      } else {
        icon.className = 'fas fa-bars';
      }
    });

    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        navList.classList.remove('mobile-active');
        menuToggle.querySelector('i').className = 'fas fa-bars';
      });
    });
  }
}

/* ----------------------------------------------------
   커리큘럼 탭 선택 제어 (로컬 작동 오류 디버깅 완료)
---------------------------------------------------- */
function initCurriculumTabs() {
  const tabBtns = document.querySelectorAll('.curriculum-tabs .tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');

      // 탭 버튼 활성화 상태 전환
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // 탭 본문 내용 전환
      tabContents.forEach(content => {
        content.classList.remove('active');
        if (content.getAttribute('id') === targetTab) {
          content.classList.add('active');
        }
      });
    });
  });
}

/* ----------------------------------------------------
   기존 강의와의 차별점 아코디언 UI 제어
---------------------------------------------------- */
function initStrengthsAccordion() {
  const items = document.querySelectorAll('.strengths-accordion .accordion-item');

  items.forEach(item => {
    const header = item.querySelector('.accordion-header');
    if (!header) return;

    header.addEventListener('click', () => {
      const isActive = item.classList.contains('active');

      // 모든 아코디언 active 끄기 (하나씩만 열리는 구조)
      items.forEach(i => i.classList.remove('active'));

      // 클릭한 아코디언 상태 반전
      if (!isActive) {
        item.classList.add('active');
      }
    });
  });
}

/* ----------------------------------------------------
   레퍼런스 카테고리 필터링 제어 (로컬 작동 오류 디버깅 완료)
---------------------------------------------------- */
function initReferenceFilter() {
  const filterBtns = document.querySelectorAll('.ref-tab-btn');
  const logoItems = document.querySelectorAll('.logo-grid .logo-item');

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = btn.getAttribute('data-ref-cat');

      // 활성화 버튼 교체
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // 로고 그리드 필터링 페이드 애니메이션 적용
      logoItems.forEach(item => {
        const itemCat = item.getAttribute('data-cat');
        if (cat === 'all' || itemCat === cat) {
          item.style.display = 'flex';
          gsap.fromTo(item, { opacity: 0, scale: 0.95 }, { opacity: 1, scale: 1, duration: 0.3, ease: "power2.out" });
        } else {
          item.style.display = 'none';
        }
      });
    });
  });
}

/* ----------------------------------------------------
   ★ 수강생 후기 3차원 중앙 포커스형 슬라이더 (자동/터치 지원)
---------------------------------------------------- */
function initTestimonialSlider() {
  const container = document.querySelector('.testimonials-slider-container');
  const track = document.getElementById('testimonials-track');
  const cards = document.querySelectorAll('.testimonial-card');
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  
  if (!container || !track || cards.length === 0) return;

  // 0. 무한 루프를 위해 자바스크립트로 앞뒤 복제(Clone) 노드 자동 생성
  const originalLength = cards.length;
  const cloneCount = 2; // 양옆 힌트 카드들을 넉넉히 보여주기 위해 앞뒤로 2개씩 배치

  // 뒤쪽 2개 복제하여 앞에 붙임
  for (let i = 0; i < cloneCount; i++) {
    const cardToClone = cards[originalLength - 1 - i];
    const clone = cardToClone.cloneNode(true);
    clone.classList.add('clone');
    track.insertBefore(clone, track.firstChild);
  }

  // 앞쪽 2개 복제하여 뒤에 붙임
  for (let i = 0; i < cloneCount; i++) {
    const cardToClone = cards[i];
    const clone = cardToClone.cloneNode(true);
    clone.classList.add('clone');
    track.appendChild(clone);
  }

  // 복제 카드 생성 후 전체 리스트 새로 조회
  const allCards = track.querySelectorAll('.testimonial-card');

  // 첫 번째 원본 카드의 실제 배열 인덱스는 복제 개수인 cloneCount(2)
  let currentIndex = cloneCount;
  let autoplayTimer = null;
  let isTransitioning = false;
  const AUTOPLAY_INTERVAL = 4000; // 4초 간격 자동 롤링

  // 1. 현재 인덱스 기준으로 슬라이더를 화면 중앙에 정렬
  function updateSlider(offsetMove = 0, isDragging = false) {
    const containerWidth = container.offsetWidth;
    const card = allCards[currentIndex];
    if (!card) return;

    const cardWidth = card.offsetWidth;
    const style = window.getComputedStyle(card);
    const marginLeft = parseFloat(style.marginLeft) || 0;
    const marginRight = parseFloat(style.marginRight) || 0;
    const stepWidth = cardWidth + marginLeft + marginRight;
    
    // 카드가 정확히 컨테이너 중앙에 오도록 오프셋값 계산
    const centerOffset = (containerWidth - cardWidth) / 2 - marginLeft;
    let translateX = -(currentIndex * stepWidth) + centerOffset;

    // 드래그 중인 경우 실시간 위치 오프셋 가산
    if (isDragging) {
      track.style.transition = 'none';
      translateX += offsetMove;
    }

    track.style.transform = `translateX(${translateX}px)`;

    // 활성화된 중앙 카드의 불투명도 및 크기 처리 (클론이 아닌 원본 기준으로 인덱스 판별)
    if (!isDragging) {
      let activeOrigIdx = (currentIndex - cloneCount) % originalLength;
      if (activeOrigIdx < 0) activeOrigIdx += originalLength;

      allCards.forEach((c, idx) => {
        let cOrigIdx = (idx - cloneCount) % originalLength;
        if (cOrigIdx < 0) cOrigIdx += originalLength;

        // 중앙에 놓여진 활성화 카드에만 active 클래스 할당
        if (idx === currentIndex) {
          c.classList.add('active');
        } else {
          c.classList.remove('active');
        }
      });
    }
  }

  // 2. 슬라이드 이동 함수 (순간 이동이 끝난 후 본래 인덱스로 자연스럽게 전환)
  function nextSlide() {
    if (isTransitioning) return;
    isTransitioning = true;
    currentIndex++;
    
    track.style.transition = 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)';
    updateSlider();

    // 트랜지션 완료 시간(600ms) 대기 후 인덱스 순간이동(Jump) 보정
    setTimeout(() => {
      if (currentIndex >= originalLength + cloneCount) {
        track.style.transition = 'none';
        currentIndex = cloneCount; // 복제된 영역에서 원래 첫 카드로 Snap
        updateSlider();
      }
      isTransitioning = false;
    }, 600);
  }

  // 3. 이전 슬라이드 이동 함수
  function prevSlide() {
    if (isTransitioning) return;
    isTransitioning = true;
    currentIndex--;
    
    track.style.transition = 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)';
    updateSlider();

    setTimeout(() => {
      if (currentIndex < cloneCount) {
        track.style.transition = 'none';
        currentIndex = originalLength + cloneCount - 1; // 복제된 영역에서 원래 마지막 카드로 Snap
        updateSlider();
      }
      isTransitioning = false;
    }, 600);
  }

  // 4. 자동 롤링(Autoplay) 시작 & 정지 제어
  function startAutoplay() {
    stopAutoplay();
    autoplayTimer = setInterval(nextSlide, AUTOPLAY_INTERVAL);
  }

  function stopAutoplay() {
    if (autoplayTimer) {
      clearInterval(autoplayTimer);
      autoplayTimer = null;
    }
  }

  // 5. 수동 제어 버튼 연동
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      nextSlide();
      startAutoplay(); // 클릭 후 타이머 리셋
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      prevSlide();
      startAutoplay(); // 클릭 후 타이머 리셋
    });
  }

  // 6. 호버 시 자동 롤링 멈춤 설정 (PC용)
  container.addEventListener('mouseenter', stopAutoplay);
  container.addEventListener('mouseleave', startAutoplay);

  // 7. 모바일 터치 스와이프 기능 고도화 (실시간 피드백 + 드래그)
  // 7. 모바일 터치 스와이프 및 데스크탑 마우스 드래그 기능 (실시간 피드백 + 드래그)
  let startX = 0;
  let currentX = 0;
  let isDragging = false;
  let isTouching = false;

  // 이미지 및 링크의 기본 드래그 방지
  track.querySelectorAll('img, a').forEach(el => {
    el.addEventListener('dragstart', (e) => e.preventDefault());
  });

  // 모바일 터치 이벤트
  container.addEventListener('touchstart', (e) => {
    if (isTransitioning) return;
    isTouching = true;
    startX = e.touches[0].clientX;
    currentX = startX;
    isDragging = true;
    stopAutoplay(); // 터치 시작 시 자동 롤링 정지
  }, { passive: true });

  container.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    currentX = e.touches[0].clientX;
    const diffX = currentX - startX;
    updateSlider(diffX, true); // 실시간 피드백
  }, { passive: true });

  container.addEventListener('touchend', (e) => {
    if (!isDragging) return;
    isDragging = false;
    const diffX = currentX - startX;

    track.style.transition = 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)';

    if (Math.abs(diffX) > 60) {
      if (diffX < 0) {
        nextSlide();
      } else {
        prevSlide();
      }
    } else {
      updateSlider();
    }
    
    startX = 0;
    currentX = 0;
    startAutoplay();
    
    // 모바일 터치 완료 후 에뮬레이션 마우스 이벤트 방지용 플래그 리셋
    setTimeout(() => {
      isTouching = false;
    }, 300);
  }, { passive: true });

  // 데스크탑 마우스 드래그 이벤트
  container.addEventListener('mousedown', (e) => {
    if (isTransitioning || isTouching) return;
    if (e.button !== 0) return; // 마우스 왼쪽 버튼만 허용
    
    startX = e.clientX;
    currentX = startX;
    isDragging = true;
    container.classList.add('active-drag');
    stopAutoplay();
  });

  container.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    currentX = e.clientX;
    const diffX = currentX - startX;
    updateSlider(diffX, true);
  });

  const handleMouseUp = () => {
    if (!isDragging) return;
    isDragging = false;
    container.classList.remove('active-drag');
    const diffX = currentX - startX;

    track.style.transition = 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)';

    if (Math.abs(diffX) > 60) {
      if (diffX < 0) {
        nextSlide();
      } else {
        prevSlide();
      }
    } else {
      updateSlider();
    }

    startX = 0;
    currentX = 0;
    startAutoplay();
  };

  container.addEventListener('mouseup', handleMouseUp);
  container.addEventListener('mouseleave', handleMouseUp);

  // 8. 창 크기가 변해도 중앙 정렬이 풀리지 않도록 대응
  window.addEventListener('resize', () => {
    updateSlider();
  });

  // 초기 실행 및 첫 카드 활성화
  updateSlider();
  startAutoplay();
}

/* ----------------------------------------------------
   이메일 주소 복사하기 및 토스트 호출
---------------------------------------------------- */
function initEmailCopy() {
  const copyBtn = document.getElementById('copy-email-btn');
  const emailText = document.getElementById('email-text');

  if (copyBtn && emailText) {
    copyBtn.addEventListener('click', () => {
      const email = emailText.innerText;
      
      navigator.clipboard.writeText(email).then(() => {
        showToast('이메일 주소가 클립보드에 복사되었습니다.', 'success');
      }).catch(err => {
        showToast('주소 복사에 실패했습니다. 직접 복사해주세요.', 'error');
        console.error('클립보드 복사 에러:', err);
      });
    });
  }
}

/* ----------------------------------------------------
   테마 전환 토글 제어 및 설정 저장
---------------------------------------------------- */
function initThemeToggle() {
  const toggleBtn = document.getElementById('theme-toggle-btn');
  if (!toggleBtn) return;

  // 페이지 로드 시 기존 테마 값 로드 및 강제 바인딩
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'teal') {
    document.body.classList.add('theme-teal');
  }

  toggleBtn.addEventListener('click', () => {
    const isTeal = document.body.classList.contains('theme-teal');
    if (isTeal) {
      document.body.classList.remove('theme-teal');
      localStorage.setItem('theme', 'gold');
      showToast('로얄 골드 & 딥 네이비 테마로 변경되었습니다.', 'success');
    } else {
      document.body.classList.add('theme-teal');
      localStorage.setItem('theme', 'teal');
      showToast('세이지 틸 & 딥 네이비 테마로 변경되었습니다.', 'success');
    }
  });
}
