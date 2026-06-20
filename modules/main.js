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

// 1-2. 화면 중앙 대형 완료 안내 모달 팝업 기능 (GTM/GA4 완료 이벤트 보완)
window.showSuccessModal = function(title, message, buttonText = "확인") {
  // 기존 모달이 있다면 중복 방지를 위해 제거
  const existingModal = document.getElementById('center-success-modal');
  if (existingModal) {
    existingModal.remove();
  }

  // 모달 마크업 동적 생성 (Modern Glassmorphic + SVG 애니메이션 효과 + CTA 버튼 추가)
  const modalHtml = `
    <div id="center-success-modal" class="center-modal-overlay">
      <div class="center-modal-content">
        <div class="center-modal-icon">
          <svg class="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
            <circle class="checkmark__circle" cx="26" cy="26" r="25" fill="none"/>
            <path class="checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
          </svg>
        </div>
        <h3 class="center-modal-title">${title}</h3>
        <p class="center-modal-message">${message}</p>
        <p class="modal-support-text" style="font-size: 0.75rem; color: #64748b; line-height: 1.4; margin: 12px 0 16px; text-align: center; opacity: 0.8;">
          ☕ 데이터공방의 무료 도구가 도움이 되셨다면,<br>하단의 <strong>쿠팡 배너 클릭</strong>이나 <strong>사내 교육 문의</strong>로 운영을 응원해 주세요!
        </p>
        <div class="modal-btn-group">
          <button class="center-modal-btn btn-close-modal">${buttonText}</button>
          <button class="center-modal-btn btn-edu-modal">사내 교육 문의</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  
  const modal = document.getElementById('center-success-modal');
  const closeBtn = modal.querySelector('.btn-close-modal');
  const eduBtn = modal.querySelector('.btn-edu-modal');
  
  // 강제 Reflow 유도 후 active 클래스 부여하여 CSS 트랜지션 트리깅
  requestAnimationFrame(() => {
    modal.classList.add('active');
  });

  const closeModal = () => {
    modal.classList.remove('active');
    setTimeout(() => {
      modal.remove();
    }, 300); // CSS transition 시간 0.3s에 맞춰 언마운트
  };

  closeBtn.addEventListener('click', closeModal);
  
  if (eduBtn) {
    eduBtn.addEventListener('click', () => {
      closeModal();
      // 메인 홈 페이지 판단 로직 (경로명 검사)
      const isHomePage = window.location.pathname.includes('index.html') || 
                         window.location.pathname === '/' || 
                         window.location.pathname.endsWith('/') || 
                         !window.location.pathname.includes('.html');
      
      if (isHomePage) {
        const contactSection = document.getElementById('contact');
        if (contactSection) {
          contactSection.scrollIntoView({ behavior: 'smooth' });
        }
      } else {
        // 서브 페이지인 경우 메인 홈의 문의 영역으로 이동
        window.location.href = 'index.html#contact';
      }
    });
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });
};

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
  safeInit(initTestimonialSlider, 'Testimonial Slider');
  safeInit(initContactTracking, 'Contact Tracking');
  safeInit(initThemeToggle, 'Theme Toggle');
  safeInit(initHeroCanvas, 'Hero Canvas Background');
  safeInit(initLogoFallback, 'Logo Fallback');
  safeInit(initLogoSliders, 'Logo Sliders Drag & Scroll');
  safeInit(initContactForm, 'Contact Form Widgets');
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

      // GTM 데이터 레이어 송신
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        'event': 'select_curriculum_tab',
        'tab_name': targetTab
      });

      // GA4 직접 이벤트 송신
      if (typeof gtag === 'function') {
        gtag('event', 'select_curriculum_tab', {
          'tab_name': targetTab
        });
      }

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
      // 데스크탑 해상도(>=1024px)에서는 아코디언 토글 동작을 무시함
      if (window.innerWidth >= 1024) return;

      const isActive = item.classList.contains('active');

      // 모든 아코디언 active 끄기 (하나씩만 열리는 구조)
      items.forEach(i => i.classList.remove('active'));

      // 클릭한 아코디언 상태 반전
      if (!isActive) {
        item.classList.add('active');
      }
    });
  });

  // 데스크탑 화면으로 복귀 시 잔여 active 클래스를 정리하여 레이아웃 무결성 보호
  window.addEventListener('resize', () => {
    if (window.innerWidth >= 1024) {
      items.forEach(i => i.classList.remove('active'));
    }
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
   연락처 채널 클릭 추적 및 이메일 복사 기능 (GA4 직접 연동)
---------------------------------------------------- */
function initContactTracking() {
  const copyBtn = document.getElementById('copy-email-btn');
  const emailText = document.getElementById('email-text');
  const kakaotalkCard = document.getElementById('kakaotalk-card');
  const naverBlogCard = document.getElementById('naver-blog-card');
  const linkedinCard = document.getElementById('linkedin-card');

  // 1. 이메일 복사 클릭 추적
  if (copyBtn && emailText) {
    copyBtn.addEventListener('click', () => {
      const email = emailText.innerText;
      
      navigator.clipboard.writeText(email).then(() => {
        // GTM 데이터 레이어 송신
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
          'event': 'click_contact_channel',
          'channel_type': 'email',
          'action_type': 'copy'
        });

        // GA4 직접 이벤트 송신
        if (typeof gtag === 'function') {
          gtag('event', 'click_contact_channel', {
            'channel_type': 'email',
            'action_type': 'copy'
          });
        }
        showToast('이메일 주소가 클립보드에 복사되었습니다.', 'success');
      }).catch(err => {
        showToast('주소 복사에 실패했습니다. 직접 복사해주세요.', 'error');
        console.error('클립보드 복사 에러:', err);
      });
    });
  }

  // 2. 카카오톡 오픈채팅 클릭 추적
  if (kakaotalkCard) {
    kakaotalkCard.addEventListener('click', () => {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        'event': 'click_contact_channel',
        'channel_type': 'kakaotalk',
        'action_type': 'click'
      });

      if (typeof gtag === 'function') {
        gtag('event', 'click_contact_channel', {
          'channel_type': 'kakaotalk',
          'action_type': 'click'
        });
      }
    });
  }

  // 3. 네이버 블로그 클릭 추적
  if (naverBlogCard) {
    naverBlogCard.addEventListener('click', () => {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        'event': 'click_contact_channel',
        'channel_type': 'naver_blog',
        'action_type': 'click'
      });

      if (typeof gtag === 'function') {
        gtag('event', 'click_contact_channel', {
          'channel_type': 'naver_blog',
          'action_type': 'click'
        });
      }
    });
  }

  // 4. 링크드인 클릭 추적
  if (linkedinCard) {
    linkedinCard.addEventListener('click', () => {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        'event': 'click_contact_channel',
        'channel_type': 'linkedin',
        'action_type': 'click'
      });

      if (typeof gtag === 'function') {
        gtag('event', 'click_contact_channel', {
          'channel_type': 'linkedin',
          'action_type': 'click'
        });
      }
    });
  }
}


/* ----------------------------------------------------
   테마 전환 토글 제어 및 설정 저장
---------------------------------------------------- */
function isWhiteThemePage() {
  const href = window.location.href.toLowerCase();
  return href.includes('satisfaction-analyzer') || 
         href.includes('tiff-to-png') || 
         href.includes('rpa') || 
         href.includes('blog') ||
         href.includes('message-delivery');
}

function initThemeToggle() {
  const toggleBtn = document.getElementById('theme-toggle-btn');
  const headerLogo = document.getElementById('header-logo-img');
  const footerLogo = document.getElementById('footer-logo-img');

  const updateLogoSource = (theme) => {
    if (!headerLogo || !footerLogo) return;
    if (theme === 'teal') {
      headerLogo.src = './assets/images/logos/sketch_var7_ultrasimple_teal.png';
      footerLogo.src = './assets/images/logos/sketch_var7_ultrasimple_teal.png';
      if (heroP5Instance && typeof heroP5Instance.updateColor === 'function') {
        heroP5Instance.updateColor('#02C39A');
      }
    } else {
      headerLogo.src = './assets/images/logos/sketch_var7_ultrasimple_gold.png';
      footerLogo.src = './assets/images/logos/sketch_var7_ultrasimple_gold.png';
      if (heroP5Instance && typeof heroP5Instance.updateColor === 'function') {
        heroP5Instance.updateColor('#E5C158');
      }
    }
  };

  // 페이지 로드 시 기존 테마 값 로드 및 강제 바인딩
  const savedTheme = localStorage.getItem('theme');

  if (isWhiteThemePage()) {
    // 화이트 테마 고정 페이지의 경우, 틸 테마 클래스를 강제로 제거하고 라이트 테마 클래스 강제 적용
    document.body.classList.remove('theme-teal');
    document.body.classList.add('rpa-light-theme');
    updateLogoSource('gold');
    // 플로팅 단추가 남아있다면 감춤 처리
    if (toggleBtn) {
      toggleBtn.style.display = 'none';
    }
    return;
  }

  if (!toggleBtn) return; // 아래 토글 버튼 리스너는 토글 버튼이 있는 페이지(홈페이지)에서만 작동

  if (savedTheme === 'teal') {
    document.body.classList.add('theme-teal');
    updateLogoSource('teal');
  } else {
    updateLogoSource('gold');
  }

  toggleBtn.addEventListener('click', () => {
    const isTeal = document.body.classList.contains('theme-teal');

    // GA4 & GTM 데이터 레이어 송신
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      'event': 'toggle_theme',
      'selected_theme': isTeal ? 'gold' : 'teal'
    });

    if (isTeal) {
      document.body.classList.remove('theme-teal');
      localStorage.setItem('theme', 'gold');
      updateLogoSource('gold');
      showToast('로얄 골드 & 딥 네이비 테마로 변경되었습니다.', 'success');
    } else {
      document.body.classList.add('theme-teal');
      localStorage.setItem('theme', 'teal');
      updateLogoSource('teal');
      showToast('세이지 틸 & 딥 네이비 테마로 변경되었습니다.', 'success');
    }
  });
}

/* ----------------------------------------------------
   ★ Hero 영역 p5.js 실시간 마우스 추종 백그라운드 구현 (인스턴스 모드)
 ---------------------------------------------------- */
let heroP5Instance = null;

function initHeroCanvas() {
  const container = document.getElementById('bg-canvas-container');
  if (!container || typeof p5 === 'undefined') return;

  const savedTheme = localStorage.getItem('theme') || 'gold';
  let initialColor = (savedTheme === 'teal') ? '#02C39A' : '#E5C158';
  if (isWhiteThemePage()) {
    initialColor = '#E5C158';
  }

  let heroSketch = (p) => {
    let particles = [];
    let width, height;
    let colorAccent = initialColor;

    p.setup = () => {
      width = container.offsetWidth;
      height = container.offsetHeight;
      let canvas = p.createCanvas(width, height);
      canvas.parent('bg-canvas-container');

      // 기기 및 해상도 사양에 따른 렌더링 부하 최적화 (모바일 60개, 데스크탑 130개)
      const targetCount = (window.innerWidth < 1024) ? 60 : 130;
      for (let i = 0; i < targetCount; i++) {
        particles.push(new HeroParticle(p));
      }
    };

    p.draw = () => {
      p.clear();
      
      for (let particle of particles) {
        particle.update(p);
        particle.display(p, colorAccent);
      }
    };

    p.windowResized = () => {
      width = container.offsetWidth;
      height = container.offsetHeight;
      p.resizeCanvas(width, height);

      // 화면 리사이즈 대응 및 반응형 파티클 수 재설정
      const targetCount = (window.innerWidth < 1024) ? 60 : 130;
      if (particles.length !== targetCount) {
        particles = [];
        for (let i = 0; i < targetCount; i++) {
          particles.push(new HeroParticle(p));
        }
      }
    };

    p.updateColor = (newColor) => {
      colorAccent = newColor;
    };
  };

  class HeroParticle {
    constructor(p) {
      this.reset(p);
    }

    reset(p) {
      this.angle = p.random(p.TWO_PI);
      this.radius = p.random(50, p.min(p.width, p.height) * 0.65);
      
      this.x = p.width / 2 + p.cos(this.angle) * this.radius;
      this.y = p.height / 2 + p.sin(this.angle) * this.radius;
      
      this.prevX = this.x;
      this.prevY = this.y;
      
      this.speed = p.random(0.6, 2.2);
      this.life = p.random(80, 180);
      this.maxLife = this.life;
    }

    update(p) {
      this.prevX = this.x;
      this.prevY = this.y;

      let centerX = p.width / 2;
      let centerY = p.height / 2;
      let dx = this.x - centerX;
      let dy = this.y - centerY;
      let r = p.sqrt(dx*dx + dy*dy);

      // 나이테 동심원 곡률 + Perlin 노이즈 합성 기법
      let orbitAngle = p.atan2(dy, dx) + p.HALF_PI * 0.45;
      let noiseAngle = p.noise(this.x * 0.004, this.y * 0.004, p.frameCount * 0.008) * p.TWO_PI;
      let finalAngle = p.lerp(orbitAngle, noiseAngle, 0.22);

      // 마우스가 Hero 섹션 캔버스 바운드 내에 있을 시 유도력(Attraction) 작용
      if (p.mouseX > 0 && p.mouseX < p.width && p.mouseY > 0 && p.mouseY < p.height) {
        let dMouse = p.dist(p.mouseX, p.mouseY, this.x, this.y);
        if (dMouse < 220) {
          let pull = p.map(dMouse, 0, 220, 0.25, 0);
          let angleMouse = p.atan2(p.mouseY - this.y, p.mouseX - this.x);
          this.x += p.cos(angleMouse) * pull * 4.5;
          this.y += p.sin(angleMouse) * pull * 4.5;
        }
      }

      this.x += p.cos(finalAngle) * this.speed;
      this.y += p.sin(finalAngle) * this.speed;

      // 중심 방향 흐름 보정
      if (r > 10) {
        this.x -= (dx / r) * 0.22;
        this.y -= (dy / r) * 0.22;
      }

      this.life--;

      if (this.life <= 0 || this.x < 0 || this.x > p.width || this.y < 0 || this.y > p.height) {
        this.reset(p);
      }
    }

    display(p, colorAccent) {
      let alpha = p.map(this.life, 0, this.maxLife, 0, 150);
      let c = p.color(colorAccent);
      
      p.stroke(p.red(c), p.green(c), p.blue(c), alpha);
      p.strokeWeight(p.random(0.6, 1.8));
      p.line(this.prevX, this.prevY, this.x, this.y);

      // 4% 확률로 헤드 노드 포인트 활성 글로우 효과 부여
      if (p.random(1) < 0.04) {
        p.fill(255, alpha + 60);
        p.noStroke();
        p.ellipse(this.x, this.y, p.random(1.5, 3.5));
      }
    }
  }

  heroP5Instance = new p5(heroSketch);
}

/* ----------------------------------------------------
   로고 이미지 부재 시 카테고리별 이모지 폴백 기능
---------------------------------------------------- */
function initLogoFallback() {
  const logoImgs = document.querySelectorAll('.logo-item img.logo-symbol');
  logoImgs.forEach(img => {
    // 이미 에러가 나 완료된 경우 즉시 폴백 적용
    if (img.complete && img.naturalWidth === 0) {
      triggerFallback(img);
    } else {
      img.addEventListener('error', function() {
        triggerFallback(this);
      });
    }
  });

  function triggerFallback(imgElement) {
    const parent = imgElement.closest('.logo-item');
    if (!parent) return;

    const container = imgElement.closest('.logo-slider-container');
    const cat = container ? container.getAttribute('data-cat') : 'building';

    let emoji = '🏢'; // 기본 대기업 (building)
    if (cat === 'government') emoji = '🏛️';
    if (cat === 'university') emoji = '🎓';

    const emojiEl = document.createElement('span');
    emojiEl.className = 'logo-emoji';
    emojiEl.textContent = emoji;

    // img 요소를 logo-emoji 스팬 요소로 대체
    parent.replaceChild(emojiEl, imgElement);
  }
}

/* ----------------------------------------------------
   드래그 및 터치 스크롤 조절형 무한 루프 로고 슬라이더 (JS기반, 관성 피드백 내장)
---------------------------------------------------- */
function initLogoSliders() {
  const tracks = document.querySelectorAll('.logo-slider-track');
  
  tracks.forEach(track => {
    let isDragging = false;
    let startX = 0;
    let currentX = 0;
    let lastX = 0;
    let dragVelocity = 0;
    let currentVelocity = 0;
    
    // 트랙별 슬라이더 이동 방향 설정
    const isLeft = track.classList.contains('track-left') || !track.classList.contains('track-right');
    const targetSpeed = isLeft ? -0.8 : 0.8;
    currentVelocity = targetSpeed;
    
    let trackWidth = track.scrollWidth;
    let halfWidth = trackWidth / 2;

    const updateDimensions = () => {
      trackWidth = track.scrollWidth;
      halfWidth = trackWidth / 2;
    };
    
    window.addEventListener('resize', updateDimensions);
    // 이미지 렌더링 지연을 극복하기 위한 타임아웃 보정 갱신
    setTimeout(updateDimensions, 500);
    setTimeout(updateDimensions, 1500);

    // 초기 오프셋 셋업 (우측 흐름 트랙은 미리 한 사이클 밀어둠)
    if (!isLeft) {
      currentX = -halfWidth;
    }
    track.style.transform = `translateX(${currentX}px)`;

    let animationFrameId;

    function renderLoop() {
      if (isDragging) {
        // 드래그 중인 경우 프레임간 이동 거리로 실시간 관성 속도(V) 계산
        dragVelocity = currentX - lastX;
        lastX = currentX;
      } else {
        // 드래그를 놓은 후 현재 속도를 기본 스피드로 부드럽게 감속/수렴시킴 (Inertia decay)
        currentVelocity = currentVelocity * 0.95 + targetSpeed * 0.05;
        currentX += currentVelocity;

        // 왼쪽 흐름 무한 리셋
        if (currentX < -halfWidth) {
          currentX += halfWidth;
        }
        // 오른쪽 흐름 무한 리셋
        if (currentX > 0) {
          currentX -= halfWidth;
        }

        track.style.transform = `translateX(${currentX}px)`;
      }
      animationFrameId = requestAnimationFrame(renderLoop);
    }

    // 루프 애니메이션 최초 구동
    animationFrameId = requestAnimationFrame(renderLoop);

    // 이미지 및 텍스트의 기본 브라우저 드래그 동작 차단 (드래그 먹통 방지)
    track.querySelectorAll('img, span, div').forEach(el => {
      el.addEventListener('dragstart', (e) => e.preventDefault());
    });

    const startDrag = (clientX) => {
      isDragging = true;
      startX = clientX;
      lastX = currentX;
      dragVelocity = 0;
    };

    const moveDrag = (clientX) => {
      if (!isDragging) return;
      const dx = clientX - startX;
      startX = clientX;
      currentX += dx;

      // 드래그 중에도 무한 반복 루프 경계 처리
      if (currentX < -halfWidth) {
        currentX += halfWidth;
      } else if (currentX > 0) {
        currentX -= halfWidth;
      }

      track.style.transform = `translateX(${currentX}px)`;
    };

    const endDrag = () => {
      if (!isDragging) return;
      isDragging = false;
      // 드래그를 놓는 순간의 속도를 기준으로 관성 운동 시작 (최대 속도 30으로 제한)
      const maxVel = 30;
      currentVelocity = Math.max(-maxVel, Math.min(maxVel, dragVelocity));
    };

    // 마우스 드래그 이벤트 리스너
    track.addEventListener('mousedown', (e) => {
      e.preventDefault(); // 텍스트 선택 등 방지
      startDrag(e.clientX);
    });

    window.addEventListener('mousemove', (e) => {
      moveDrag(e.clientX);
    });

    window.addEventListener('mouseup', () => {
      endDrag();
    });

    // 모바일 터치 스와이프 이벤트 리스너
    track.addEventListener('touchstart', (e) => {
      startDrag(e.touches[0].clientX);
    }, { passive: true });

    track.addEventListener('touchmove', (e) => {
      moveDrag(e.touches[0].clientX);
    }, { passive: true });

    track.addEventListener('touchend', () => {
      endDrag();
    });
  });
}

/* ----------------------------------------------------
   간편 문의 및 교육 견적 요청 폼 위젯 핸들러
---------------------------------------------------- */
function initContactForm() {
  const tabBtns = document.querySelectorAll('.contact-form-widget .form-tab-btn');
  const forms = document.querySelectorAll('.contact-form-widget .contact-form');

  // 1. 탭 전환 기능
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetForm = btn.getAttribute('data-form-tab');

      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      forms.forEach(form => {
        form.classList.remove('active');
        if (form.getAttribute('id') === `${targetForm}-contact-form`) {
          form.classList.add('active');
        }
      });

      // GA4 & GTM 이벤트 전송
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        'event': 'toggle_contact_form_tab',
        'tab_name': targetForm
      });

      if (typeof gtag === 'function') {
        gtag('event', 'toggle_contact_form_tab', {
          'tab_name': targetForm
        });
      }
    });
  });

  // 2. 비동기 Form 전송 처리
  const generalForm = document.getElementById('general-contact-form');
  const estimateForm = document.getElementById('estimate-contact-form');

  if (generalForm) {
    generalForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleFormSubmit(generalForm, 'general');
    });
  }

  if (estimateForm) {
    estimateForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleFormSubmit(estimateForm, 'estimate');
    });
  }

  function handleFormSubmit(form, type) {
    const submitBtn = form.querySelector('.submit-btn');
    const submitText = submitBtn.querySelector('span');
    const submitIcon = submitBtn.querySelector('i');

    const originalText = submitText.innerText;
    const originalIconClass = submitIcon.className;

    // UI 상태 로딩으로 변경
    submitBtn.disabled = true;
    submitText.innerText = '전송 중...';
    submitIcon.className = 'fas fa-spinner fa-spin';

    // FormData를 일반 Object로 매핑
    const formData = new FormData(form);
    const payload = {};
    formData.forEach((value, key) => {
      payload[key] = value;
    });

    // 문의 타입 속성 강제 지정
    payload['type'] = type === 'general' ? '간편 문의' : '교육 견적 요청';

    const formUrl = form.getAttribute('action') || 'https://script.google.com/macros/s/AKfycbzAszHTXbVl4eInbK0OnIm0iLUAfEwo9_I7kQn_mKTd4DGeT2nMhqq8B4IawmvQyfQSHw/exec';

    fetch(formUrl, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(payload)
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then(data => {
      if (data.success) {
        // 성공 처리
        form.reset();

        // GA4 / GTM 이벤트 송신
        window.dataLayer = window.dataLayer || [];
        const eventName = type === 'general' ? 'submit_general_contact' : 'submit_estimate_request';
        
        const eventParams = {
          'event_category': 'Contact',
          'event_label': type === 'general' ? 'General Inquiry' : 'Estimate Request'
        };

        if (type === 'estimate') {
          eventParams['company'] = payload['company'] || '';
          eventParams['headcount'] = payload['headcount'] || '';
          eventParams['topic'] = payload['topic'] || '';
          eventParams['timing'] = payload['timing'] || '';
        }

        window.dataLayer.push({
          'event': eventName,
          ...eventParams
        });

        if (typeof gtag === 'function') {
          gtag('event', eventName, eventParams);
        }

        // 알림 메시지 정의
        const successTitle = type === 'general' ? '문의 접수 완료' : '견적 요청 접수 완료';
        const successMsg = type === 'general'
          ? '문의가 정상적으로 전송되었습니다.<br>확인 후 입력해주신 연락처로 신속하게 연락드리겠습니다.'
          : '교육 견적 요청이 정상적으로 접수되었습니다.<br>1~2일 내에 맞춤형 제안서와 함께 메일로 회신해 드리겠습니다.';

        window.showSuccessModal(successTitle, successMsg, '확인');
      } else {
        // 실패 처리
        const errMsg = data.message || '전송 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
        showToast(errMsg, 'error');
      }
    })
    .catch(error => {
      console.error('Form submission error:', error);
      showToast('네트워크 오류가 발생했습니다. 연결 상태를 확인하고 다시 시도해 주세요.', 'error');
    })
    .finally(() => {
      // UI 상태 복구
      submitBtn.disabled = false;
      submitText.innerText = originalText;
      submitIcon.className = originalIconClass;
    });
  }
}
