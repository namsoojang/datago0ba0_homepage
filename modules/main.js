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
  if (typeof gsap !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);
    initAnimations();
  }

  initNavigation();
  initCurriculumTabs();
  initReferenceFilter();
  initTestimonialSlider();
  initEmailCopy();
});

/* ----------------------------------------------------
   ★ 5대 애니메이션 패턴 구현 (GSAP & ScrollTrigger)
---------------------------------------------------- */
function initAnimations() {
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

  let currentIndex = 0;
  let autoplayTimer = null;
  const AUTOPLAY_INTERVAL = 3500; // 3.5초 간격 롤링

  // 1. 현재 인덱스 기준으로 슬라이더를 화면 정앙에 정렬
  function updateSlider() {
    const containerWidth = container.offsetWidth;
    const cardWidth = cards[0].offsetWidth;
    const cardMargin = 20; // CSS의 margin: 0 20px 기준
    const stepWidth = cardWidth + cardMargin * 2;
    
    // 카드가 정확히 컨테이너 중앙에 오도록 오프셋값 계산
    const centerOffset = (containerWidth - cardWidth) / 2 - cardMargin;
    const translateX = -(currentIndex * stepWidth) + centerOffset;

    // 트랙 위치 이동
    track.style.transform = `translateX(${translateX}px)`;

    // 활성화된 중앙 카드의 불투명도 및 크기 처리
    cards.forEach((card, idx) => {
      if (idx === currentIndex) {
        card.classList.add('active');
      } else {
        card.classList.remove('active');
      }
    });
  }

  // 2. 슬라이드 이동 함수
  function nextSlide() {
    currentIndex = (currentIndex + 1) % cards.length;
    updateSlider();
  }

  function prevSlide() {
    currentIndex = (currentIndex - 1 + cards.length) % cards.length;
    updateSlider();
  }

  // 3. 자동 롤링(Autoplay) 시작 & 정지 제어
  function startAutoplay() {
    if (autoplayTimer) clearInterval(autoplayTimer);
    autoplayTimer = setInterval(nextSlide, AUTOPLAY_INTERVAL);
  }

  function stopAutoplay() {
    if (autoplayTimer) {
      clearInterval(autoplayTimer);
      autoplayTimer = null;
    }
  }

  // 4. 수동 제어 버튼 연동
  nextBtn.addEventListener('click', () => {
    nextSlide();
    startAutoplay(); // 클릭 후 타이머 리셋
  });

  prevBtn.addEventListener('click', () => {
    prevSlide();
    startAutoplay(); // 클릭 후 타이머 리셋
  });

  // 5. 호버 시 자동 롤링 멈춤 설정 (PC용)
  container.addEventListener('mouseenter', stopAutoplay);
  container.addEventListener('mouseleave', startAutoplay);

  // 6. 모바일 터치 스와이프 기능 구현 (터치 슬라이드 대응)
  let startX = 0;
  let endX = 0;

  container.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    stopAutoplay(); // 터치 시작 시 자동 롤링 정지
  }, { passive: true });

  container.addEventListener('touchend', (e) => {
    endX = e.changedTouches[0].clientX;
    const diffX = startX - endX;

    if (Math.abs(diffX) > 50) { // 50px 이상 쓸었을 때만 반응
      if (diffX > 0) {
        nextSlide();
      } else {
        prevSlide();
      }
    }
    startAutoplay(); // 터치가 끝나면 자동 롤링 재시작
  }, { passive: true });

  // 7. 창 크기가 변해도 중앙 정렬이 풀리지 않도록 대응
  window.addEventListener('resize', updateSlider);

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
