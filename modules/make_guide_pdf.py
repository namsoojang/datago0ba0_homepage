import os
import sys
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib import colors

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
