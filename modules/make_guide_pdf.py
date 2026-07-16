import os
import sys
import re
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, HRFlowable, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib import colors
from PIL import Image as PILImage


def setup_font():
    # 윈도우 시스템 기본 한글 폰트(맑은 고딕) 경로 탐색 및 등록
    font_path = r"C:\Windows\Fonts\malgun.ttf"
    if not os.path.exists(font_path):
        # 맑은 고딕이 없는 경우 백업으로 굴림 폰트 탐색
        font_path = r"C:\Windows\Fonts\gulim.ttc"
        if not os.path.exists(font_path):
            print("ERROR: 한글 폰트 파일을 찾을 수 없습니다. 시스템 폰트를 확인해주세요.")
            sys.exit(1)
        # TTC(TrueType Collection) 포맷인 경우 첫 번째 인덱스 지정
        pdfmetrics.registerFont(TTFont("KoreanFont", font_path, subfontIndex=0))
    else:
        pdfmetrics.registerFont(TTFont("KoreanFont", font_path))

def build_pdf():
    setup_font()
    
    # 문서 템플릿 설정 (여백 상하좌우 54pt = 0.75인치)
    pdf_path = r"c:\Users\장남수\Documents\00_데이터공방\0_홈페이지\docs\antigravity_guide.pdf"
    doc = SimpleDocTemplate(pdf_path, pagesize=letter, leftMargin=54, rightMargin=54, topMargin=54, bottomMargin=54)
    
    styles = getSampleStyleSheet()
    
    # 한글 폰트 전용 스타일 재정의
    title_style = ParagraphStyle(
        'KoTitle',
        parent=styles['Title'],
        fontName='KoreanFont',
        fontSize=22,
        leading=28,
        textColor=colors.HexColor('#0B0D19'),
        spaceAfter=20
    )
    
    h1_style = ParagraphStyle(
        'KoH1',
        parent=styles['Heading1'],
        fontName='KoreanFont',
        fontSize=15,
        leading=20,
        textColor=colors.HexColor('#02C39A'),
        spaceBefore=14,
        spaceAfter=10
    )
    
    h2_style = ParagraphStyle(
        'KoH2',
        parent=styles['Heading2'],
        fontName='KoreanFont',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor('#0B0D19'),
        spaceBefore=10,
        spaceAfter=8
    )
    
    body_style = ParagraphStyle(
        'KoBody',
        parent=styles['Normal'],
        fontName='KoreanFont',
        fontSize=10,
        leading=15,
        textColor=colors.HexColor('#2C2D35'),
        spaceAfter=6
    )

    story = []
    
    md_path = r"c:\Users\장남수\Documents\00_데이터공방\0_홈페이지\docs\antigravity_guide.md"
    if not os.path.exists(md_path):
        print("ERROR: 원본 마크다운 가이드 파일이 존재하지 않습니다.")
        return

    with open(md_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    in_list = False
    
    for line in lines:
        stripped = line.strip()
        
        # 빈 줄 처리
        if not stripped:
            story.append(Spacer(1, 8))
            continue
            
        # 페이지 구분선 처리
        if stripped == "---":
            story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#E2E8F0'), spaceBefore=10, spaceAfter=15))
            continue
            
        # 이미지 태그 처리 (![alt](path))
        img_match = re.match(r'^!\[(.*?)\]\((.*?)\)$', stripped)
        if img_match:
            alt_text = img_match.group(1)
            rel_img_path = img_match.group(2)
            
            # docs/ 폴더 기준 상대경로를 절대경로로 변환
            base_dir = os.path.dirname(os.path.dirname(md_path))
            clean_path = rel_img_path.lstrip('./').replace('../', '')
            full_img_path = os.path.join(base_dir, clean_path)
            
            if os.path.exists(full_img_path):
                try:
                    # PIL을 활용해 원본 이미지 크기 획득 후 letter 폭(가로 최대 504pt)에 맞춰 종횡비 보존 스케일링
                    with PILImage.open(full_img_path) as pil_img:
                        orig_w, orig_h = pil_img.size
                    
                    target_w = 400
                    target_h = int((orig_h / orig_w) * target_w)
                    
                    story.append(Spacer(1, 10))
                    story.append(Image(full_img_path, width=target_w, height=target_h))
                    story.append(Spacer(1, 10))
                except Exception as e:
                    print(f"WARNING: 이미지 처리 중 오류 발생 - {e}")
            else:
                print(f"WARNING: 이미지 파일을 찾을 수 없습니다 - {full_img_path}")
            continue

        # 대제목 (# )
        if stripped.startswith("# "):
            text = stripped[2:]
            story.append(Paragraph(text, title_style))
            story.append(Spacer(1, 10))
            continue
            
        # 대분류 (▣ )
        if stripped.startswith("▣ "):
            text = stripped
            story.append(Paragraph(text, h1_style))
            continue
            
        # 중분류 (■ )
        if stripped.startswith("■ "):
            text = stripped
            story.append(Paragraph(text, h2_style))
            continue
            
        # 리스트 아이템
        if stripped.startswith("- ") or stripped.startswith("* "):
            text = stripped
            story.append(Paragraph(text, body_style))
            continue
            
        # 일반 본문 텍스트
        story.append(Paragraph(stripped, body_style))
        
    # PDF 문서 빌드
    doc.build(story)
    print("SUCCESS: antigravity_guide.pdf 빌드 성공")

if __name__ == "__main__":
    build_pdf()
