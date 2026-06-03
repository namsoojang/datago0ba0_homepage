/* modules/main.js - 인터랙션 및 애니메이션 제어 메인 스크립트 */
import { showToast } from './toast.js';

document.addEventListener('DOMContentLoaded', () => {
  // 1. GSAP 라이브러리 및 플러그인 로드 확인
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
  // FOUC(Flash Of Unstyled Content) 방지용 gsap.set 선행 처리
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
      
      // 카드와 배경 도형들을 각각 다른 값으로 parallax 적용해 깊이감 형성
      gsap.to(profileCard, { x: x * 18, y: y * 10, rotateY: x * 8, rotateX: -y * 8, duration: 0.8, ease: "power2.out" });
      gsap.to(".shape-1", { x: x * 40, y: y * 20, duration: 1.2, ease: "power1.out" });
      gsap.to(".shape-2", { x: -x * 30, y: -y * 15, duration: 1.5, ease: "power1.out" });
    });

    // 마우스가 영역을 벗어나면 원래대로 스무스 복귀
    heroSection.addEventListener("mouseleave", () => {
      gsap.to(profileCard, { x: 0, y: 0, rotateY: 0, rotateX: 0, duration: 1.2, ease: "power3.out" });
      gsap.to(".shape-1", { x: 0, y: 0, duration: 1.5, ease: "power3.out" });
      gsap.to(".shape-2", { x: 0, y: 0, duration: 1.5, ease: "power3.out" });
    });
  }

  // --- 패턴 3. Scroll-triggered Reveals (강점 카드 3D 리빌) ---
  gsap.set(".strength-card", { opacity: 0, y: 60, rotateX: 18 });
  
  ScrollTrigger.batch(".strength-card", {
    start: "top 85%", // 카드의 상단이 화면의 85% 지점을 넘어가면 실행
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

  // Biography 타임라인 연혁 요소도 부드러운 페이드인 적용
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
   네비게이션 헤더 스크롤 제어
---------------------------------------------------- */
function initNavigation() {
  const header = document.getElementById('header');
  const sections = document.querySelectorAll('section');
  const navLinks = document.querySelectorAll('.nav-link');
  const menuToggle = document.getElementById('menu-toggle');
  const navList = document.querySelector('.nav-links');

  // 스크롤 시 헤더 축소 및 배경 제어
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }

    // 스크롤 위치에 따라 메뉴 엑티브 스타일 갱신
    let current = '';
    sections.forEach(section => {
      const sectionTop = section.offsetTop - 100;
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

  // 모바일 햄버거 메뉴 토글
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

    // 링크 클릭 시 모바일 메뉴 닫기
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        navList.classList.remove('mobile-active');
        menuToggle.querySelector('i').className = 'fas fa-bars';
      });
    });
  }
}

/* ----------------------------------------------------
   커리큘럼 탭 선택 제어
---------------------------------------------------- */
function initCurriculumTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
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
   레퍼런스 카테고리 필터링 제어
---------------------------------------------------- */
function initReferenceFilter() {
  const filterBtns = document.querySelectorAll('.ref-tab-btn');
  const logoItems = document.querySelectorAll('.logo-item');

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
          gsap.fromTo(item, { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.35, ease: "power2.out" });
        } else {
          item.style.display = 'none';
        }
      });
    });
  });
}

/* ----------------------------------------------------
   수강생 후기 슬라이더 (캐러셀)
---------------------------------------------------- */
function initTestimonialSlider() {
  const track = document.getElementById('testimonials-track');
  const cards = document.querySelectorAll('.testimonial-card');
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  
  if (!track || cards.length === 0) return;

  let currentIndex = 0;

  function updateSlider() {
    gsap.to(track, {
      x: `-${currentIndex * 100}%`,
      duration: 0.5,
      ease: "power2.out"
    });
  }

  nextBtn.addEventListener('click', () => {
    currentIndex = (currentIndex + 1) % cards.length;
    updateSlider();
  });

  prevBtn.addEventListener('click', () => {
    currentIndex = (currentIndex - 1 + cards.length) % cards.length;
    updateSlider();
  });

  // 스와이프나 자동 롤링 추가 시 확장 가능 구역
}

/* ----------------------------------------------------
   이메일 주소 복사하기 및 토스트 알림 호출
---------------------------------------------------- */
function initEmailCopy() {
  const copyBtn = document.getElementById('copy-email-btn');
  const emailText = document.getElementById('email-text');

  if (copyBtn && emailText) {
    copyBtn.addEventListener('click', () => {
      const email = emailText.innerText;
      
      // 클립보드에 이메일 주소 복사
      navigator.clipboard.writeText(email).then(() => {
        // 성공 시 커스텀 토스트 알림 호출 (Green 성공 타입)
        showToast('이메일 주소가 클립보드에 복사되었습니다.', 'success');
      }).catch(err => {
        // 실패 시 에러 토스트 호출 (Red 에러 타입)
        showToast('주소 복사에 실패했습니다. 직접 복사해주세요.', 'error');
        console.error('클립보드 복사 에러:', err);
      });
    });
  }
}
