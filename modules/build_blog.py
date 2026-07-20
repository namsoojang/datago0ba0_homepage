"""
modules/build_blog.py
data/posts.json + data/posts/*.md 를 읽어 blog/<id>.html 정적 페이지를 생성합니다.

왜 필요한가:
  기존에는 모든 글이 blog-detail.html?id=ref-NN 한 페이지에서 클라이언트 렌더링되어,
  검색엔진이 "표준 URL 없는 중복 페이지"로 처리했습니다(Search Console 확인).
  글마다 실제 파일과 고정 canonical/og 를 갖도록 만들어 색인 가능하게 합니다.

사용법:
  python modules/build_blog.py
  글을 추가하거나 수정한 뒤 반드시 다시 실행하고, 생성된 파일을 함께 커밋하세요.
"""

import json
import re
from pathlib import Path

import markdown

ROOT = Path(__file__).resolve().parent.parent
POSTS_JSON = ROOT / "data" / "posts.json"
OUT_DIR = ROOT / "blog"
SITE = "https://datagongbang.kr"

GA_ID = "G-8H79VM0RM8"
GTM_ID = "GTM-KVV9V7QN"

# marked.js 의 gfm + breaks:true 동작과 최대한 맞춥니다.
MD_EXTENSIONS = ["tables", "fenced_code", "nl2br", "sane_lists", "attr_list"]


def to_absolute_paths(html: str) -> str:
    """
    마크다운 본문의 사이트 내부 상대 경로를 루트 절대 경로로 바꿉니다.

    생성 결과가 /blog/ 하위에 놓이므로, './assets/...' 나 'index.html#contact' 같은
    상대 경로를 그대로 두면 /blog/assets/... , /blog/index.html 로 잘못 해석되어
    이미지와 문의 링크가 모두 깨집니다.
    """
    # 본문에 남아 있는 구 블로그 URL 을 새 정적 경로로 정리
    html = re.sub(
        r'https://datagongbang\.kr/blog-detail\.html\?id=(ref-\d+)',
        rf'{SITE}/blog/\1.html',
        html,
    )

    def fix(match: re.Match) -> str:
        attr, value = match.group(1), match.group(2)
        # 외부 링크·앵커·메일·이미 절대경로인 것은 그대로 둡니다.
        if re.match(r"^(https?:|//|/|#|mailto:|tel:|data:)", value):
            return match.group(0)
        return f'{attr}="/{value.lstrip("./")}"'

    return re.sub(r'\b(src|href)="([^"]*)"', fix, html)


def thumb_url(post: dict) -> str:
    raw = (post.get("thumbnail") or "").lstrip(".").lstrip("/")
    if not raw:
        raw = "assets/images/logos/sketch_var7_ultrasimple_gold.png"
    return f"{SITE}/{raw}"


def esc(text: str) -> str:
    return (
        str(text)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def render_page(post: dict, body_html: str) -> str:
    url = f"{SITE}/blog/{post['id']}.html"
    title = esc(post["title"])
    summary = esc(post["summary"])
    image = thumb_url(post)
    tags = post.get("tags") or []
    tag_markup = " ".join(f'<span class="post-tag">#{esc(t)}</span>' for t in tags)

    # BlogPosting 구조화 데이터: 화면에 실제로 표시되는 값만 사용합니다.
    ld = {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "headline": post["title"],
        "description": post["summary"],
        "image": image,
        "datePublished": post["date"],
        "dateModified": post["date"],
        "author": {"@type": "Person", "name": "장남수", "url": f"{SITE}/"},
        "publisher": {
            "@type": "Organization",
            "name": "데이터공방",
            "logo": {
                "@type": "ImageObject",
                "url": f"{SITE}/assets/images/logos/sketch_var7_ultrasimple_gold.png",
            },
        },
        "mainEntityOfPage": {"@type": "WebPage", "@id": url},
        "keywords": ", ".join(tags),
    }
    ld_json = json.dumps(ld, ensure_ascii=False, separators=(",", ":"))

    return f"""<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id={GA_ID}"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){{dataLayer.push(arguments);}}
    gtag('js', new Date());
    gtag('config', '{GA_ID}');
  </script>

  <!-- Google Tag Manager -->
  <script>(function(w,d,s,l,i){{w[l]=w[l]||[];w[l].push({{'gtm.start':
  new Date().getTime(),event:'gtm.js'}});var f=d.getElementsByTagName(s)[0],
  j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
  'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
  }})(window,document,'script','dataLayer','{GTM_ID}');</script>
  <!-- End Google Tag Manager -->

  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title} | 데이터공방</title>

  <meta name="description" content="{summary}">
  <meta name="robots" content="index, follow">
  <meta name="naver-site-verification" content="6b1811d6074cc78b96b89f616ba7cc1278f1666f" />
  <meta name="google-site-verification" content="Oc6kBZ-qy21JGaAiEqgg8tZzyi-uIToJVG_DXRJmL0k" />

  <link rel="canonical" href="{url}">
  <meta property="og:url" content="{url}">
  <meta property="og:title" content="{title}">
  <meta property="og:description" content="{summary}">
  <meta property="og:image" content="{image}">
  <meta property="og:type" content="article">
  <meta property="article:published_time" content="{post['date']}">

  <script type="application/ld+json">{ld_json}</script>

  <link rel="icon" type="image/png" href="/assets/images/logos/sketch_var7_ultrasimple_gold.png">
  <link rel="stylesheet" href="/index.css?v=1.4">
  <link rel="stylesheet" href="/modules/toast.css?v=1.2">
  <link rel="stylesheet" href="/modules/blog.css?v=1.3">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <link rel="stylesheet" as="style" crossorigin href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css" />
</head>
<body class="rpa-light-theme">
  <!-- Google Tag Manager (noscript) -->
  <noscript><iframe src="https://www.googletagmanager.com/ns.html?id={GTM_ID}"
  height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
  <!-- End Google Tag Manager (noscript) -->

  <div id="bg-canvas-container"></div>

  <header id="header">
    <div class="container nav-container">
      <a href="/index.html" class="logo" aria-label="데이터공방 홈">
        <img class="logo-symbol brand-logo-img" id="header-logo-img" src="/assets/images/logos/sketch_var7_ultrasimple_gold.png" alt="데이터공방 로고" width="26" height="26">
        <span>데이터<strong>공방</strong></span>
      </a>
      <nav aria-label="주요 메뉴">
        <ul class="nav-links" id="primary-navigation">
          <li><a href="/index.html#curriculum" class="nav-link">교육·서비스</a></li>
          <li><a href="/index.html#references" class="nav-link">성과·사례</a></li>
          <li><a href="/rpa.html" class="nav-link">업무도구</a></li>
          <li><a href="/guide/index.html" class="nav-link">실무가이드</a></li>
          <li><a href="/blog.html" class="nav-link active" aria-current="page">블로그</a></li>
          <li><a href="/index.html#contact" class="nav-link nav-cta">교육·협업 문의</a></li>
        </ul>
      </nav>
      <button type="button" class="menu-toggle" id="menu-toggle" aria-label="메뉴 열기" aria-expanded="false" aria-controls="primary-navigation">
        <i class="fas fa-bars"></i>
      </button>
    </div>
  </header>

  <main class="converter-section">
    <div class="blog-detail-container">
      <a href="/blog.html" class="blog-back-link">
        <i class="fas fa-arrow-left"></i> 블로그 목록으로 돌아가기
      </a>

      <article class="blog-detail-card" id="blog-detail-content-area">
        <header class="post-header">
          <div class="post-meta-top">
            <span class="post-detail-category">{esc(post['category'])}</span>
            <span class="post-detail-date"><i class="far fa-calendar-alt"></i> {esc(post['date'])}</span>
          </div>
          <h1 class="post-detail-title">{title}</h1>
          <div class="post-detail-tags">{tag_markup}</div>
        </header>

        <section class="post-body-contentmarkdown markdown-body">
{body_html}
        </section>
      </article>

      <section class="blog-cta-panel">
        <div class="cta-glow-effect"></div>
        <div class="blog-cta-content">
          <h3>🏢 우리 부서 맞춤형 자동화 워크숍이 필요하신가요?</h3>
          <p>임직원들의 단순 수작업 엑셀 취합 업무, 파이썬 분석, RPA 구축을 직무 로데이터 맞춤 교육과 현장 디버깅 실습으로 해결해 드립니다. 지금 커리큘럼 설계 및 무료 견적 상담을 받아보세요.</p>
          <a href="/index.html#contact" class="btn btn-primary blog-cta-btn" data-consult-source="blog_{post['id']}">
            <i class="far fa-envelope"></i> 사내 교육 및 출강 상담 신청하기
          </a>
        </div>
      </section>

      <div style="text-align: center; margin-top: 32px;">
        <a href="/blog.html" class="blog-back-link" style="margin-bottom: 0;">
          <i class="fas fa-list"></i> 전체 칼럼 목록 보기
        </a>
      </div>
    </div>
  </main>

  <footer>
    <div class="container">
      <div class="footer-logo">
        <img class="logo-symbol brand-logo-img" id="footer-logo-img" src="/assets/images/logos/sketch_var7_ultrasimple_gold.png" alt="데이터공방 로고" width="26" height="26">
        <span>데이터<strong>공방</strong></span>
      </div>
      <p>&copy; 2026 DATAGOONGBANG. All rights reserved. | 대표 장남수 | 사업자등록번호: 407-11-62561 | <a href="/rpa.html" style="text-decoration:underline; opacity:0.8; margin-left:5px;">무료 RPA 도구</a> | <a href="/privacy.html" style="text-decoration:underline; opacity:0.8; margin-left:5px;">개인정보처리방침</a></p>
    </div>
  </footer>

  <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.7.0/p5.min.js"></script>
  <script src="/modules/main.js?v=1.4"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-python.min.js"></script>
  <script>
    document.querySelectorAll('[data-consult-source]').forEach(function (el) {{
      el.addEventListener('click', function () {{
        if (typeof window.trackCRMEvent === 'function') {{
          window.trackCRMEvent('click_team_consultation', {{ source_guide: el.dataset.consultSource }});
        }}
      }});
    }});
  </script>
</body>
</html>
"""


def update_sitemap(posts: list) -> None:
    """
    sitemap.xml 의 BLOG:START ~ BLOG:END 구간을 posts.json 기준으로 다시 씁니다.
    글을 추가할 때 sitemap 갱신을 잊는 실수를 막기 위해 빌드에 묶어 둡니다.
    """
    path = ROOT / "sitemap.xml"
    xml = path.read_text(encoding="utf-8")

    start, end = "<!-- BLOG:START", "<!-- BLOG:END -->"
    if start not in xml or end not in xml:
        print("  [경고] sitemap.xml 에서 BLOG 마커를 찾지 못해 건너뜁니다.")
        return

    entries = []
    for post in sorted(posts, key=lambda p: p["date"], reverse=True):
        entries.append(
            "  <url>\n"
            f"    <loc>{SITE}/blog/{post['id']}.html</loc>\n"
            f"    <lastmod>{post['date']}</lastmod>\n"
            "    <changefreq>monthly</changefreq>\n"
            "    <priority>0.7</priority>\n"
            "  </url>"
        )

    head = xml.split(start)[0]
    tail = xml.split(end, 1)[1]
    marker = (
        start
        + " - 이 구간은 modules/build_blog.py 가 posts.json 기준으로 자동 생성합니다."
        " 직접 수정하지 마세요. -->\n"
        + "\n".join(entries)
        + "\n  "
        + end
    )
    path.write_text(head + marker + tail, encoding="utf-8")
    print(f"  sitemap.xml 갱신: 블로그 {len(entries)}건")


def main():
    posts = json.loads(POSTS_JSON.read_text(encoding="utf-8"))
    OUT_DIR.mkdir(exist_ok=True)

    generated = []
    for post in posts:
        md_path = ROOT / post["contentPath"]
        if not md_path.exists():
            print(f"  [건너뜀] 본문 없음: {post['contentPath']}")
            continue

        md_text = md_path.read_text(encoding="utf-8")
        body = markdown.markdown(md_text, extensions=MD_EXTENSIONS)
        body = to_absolute_paths(body)

        out_path = OUT_DIR / f"{post['id']}.html"
        out_path.write_text(render_page(post, body), encoding="utf-8")
        generated.append(post["id"])
        print(f"  생성: blog/{post['id']}.html")

    update_sitemap([p for p in posts if p["id"] in generated])

    print(f"\n총 {len(generated)}개 글 생성 완료.")
    return generated


if __name__ == "__main__":
    main()
