import os
import sys
import re
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, HRFlowable, Image, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from PIL import Image as PILImage


class NumberedCanvas(canvas.Canvas):
    """
    총 페이지 수를 동적으로 계산하여 하단에 '- Page X of Y -' 번호를 정밀 정렬해 출력하고,
    2페이지부터는 상단에 세련된 실시간 런닝 헤더 라인을 렌더링하는 고품격 캔버스
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_elements(num_pages)
            super().showPage()
        super().save()

    def draw_page_elements(self, page_count):
        # 1페이지(표지 겸 인트로)는 헤더와 하단 번호를 생략
        if self._pageNumber == 1:
            return
            
        self.saveState()
        self.setFont("KoreanFont", 8.5)
        self.setFillColor(colors.HexColor('#64748B'))
        
        # 런닝 헤더 드로잉
        self.drawString(54, 745, "데이터공방 실무 가이드라인  ▷  Antigravity IDE 설치 및 연동 가이드")
        self.setStrokeColor(colors.HexColor('#CBD5E1'))
        self.setLineWidth(0.5)
        self.line(54, 737, 558, 737)
        
        # 하단 중앙 페이지 넘버 드로잉
        page_str = f"- {self._pageNumber} / {page_count} -"
        self.drawCentredString(306, 36, page_str)
        self.restoreState()


def setup_font():
    # Windows와 WSL/Linux에서 사용 가능한 한글 폰트를 순서대로 탐색한다.
    candidates = [
        (r"C:\Windows\Fonts\malgun.ttf", None),
        (r"/mnt/c/Windows/Fonts/malgun.ttf", None),
        (r"C:\Windows\Fonts\gulim.ttc", 0),
        (r"/mnt/c/Windows/Fonts/gulim.ttc", 0),
        (r"/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc", 0),
    ]
    for font_path, subfont_index in candidates:
        if os.path.exists(font_path):
            kwargs = {} if subfont_index is None else {"subfontIndex": subfont_index}
            pdfmetrics.registerFont(TTFont("KoreanFont", font_path, **kwargs))
            return
    raise FileNotFoundError("한글 폰트를 찾지 못했습니다. 맑은 고딕 또는 Noto Sans CJK를 설치하세요.")


def md_to_html(text):
    """
    마크다운 텍스트 내의 볼드와 인라인 코드를 리포트랩 Paragraph가 인식할 수 있는
    HTML 서식으로 지능적으로 매핑해 주는 컨버터
    """
    # HTML 특수기호 안전 처리 (Reportlab Paragraph 파싱 오류 차단)
    text = text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    
    # 1. 인라인 코드 `code` -> <b><font color="#028090">code</font></b>
    text = re.sub(r'`([^`]+)`', r'<b><font color="#028090">\1</font></b>', text)
    
    # 2. 볼드 **bold** -> <b>bold</b>
    text = re.sub(r'\*\*([^*]+)\*\*', r'<b>\1</b>', text)
    
    # 3. 링크 (https://...) -> <font color="#028090"><u>https://...</u></font>
    text = re.sub(r'\((https?://[^)]+)\)', r'(<font color="#028090"><u>\1</u></font>)', text)
    
    # 원래의 HTML 엔티티 치환물 중 태그 괄호는 복원
    text = text.replace('&lt;b&gt;', '<b>').replace('&lt;/b&gt;', '</b>')
    text = text.replace('&lt;font color="#028090"&gt;', '<font color="#028090">').replace('&lt;/font&gt;', '</font>')
    text = text.replace('&lt;u&gt;', '<u>').replace('&lt;/u&gt;', '</u>')
    
    return text


def build_pdf():
    setup_font()

    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    pdf_path = os.path.join(project_root, "docs", "antigravity_guide.pdf")
    
    # 런닝 헤더 간격(상단 72pt) 및 여백 조정으로 레이아웃 안정성 확보 (가로 영역 = 504pt)
    doc = SimpleDocTemplate(
        pdf_path, 
        pagesize=letter, 
        leftMargin=54, 
        rightMargin=54, 
        topMargin=72, 
        bottomMargin=54
    )
    
    styles = getSampleStyleSheet()
    
    # 프로페셔널 타이포그래피 스타일 재정의
    title_style = ParagraphStyle(
        'KoTitle',
        parent=styles['Title'],
        fontName='KoreanFont',
        fontSize=24,
        leading=30,
        textColor=colors.HexColor('#0F172A'),
        alignment=0, # 좌측 정렬로 세련되게 세팅
        spaceAfter=12
    )
    
    meta_style = ParagraphStyle(
        'KoMeta',
        parent=styles['Normal'],
        fontName='KoreanFont',
        fontSize=9,
        leading=14,
        textColor=colors.HexColor('#64748B'),
        spaceAfter=25
    )
    
    h1_style = ParagraphStyle(
        'KoH1',
        parent=styles['Heading1'],
        fontName='KoreanFont',
        fontSize=14,
        leading=19,
        textColor=colors.HexColor('#028090'),
        spaceBefore=16,
        spaceAfter=10,
        keepWithNext=True # 소제목이 페이지 하단에 덩그러니 남는 현상 방지
    )
    
    h2_style = ParagraphStyle(
        'KoH2',
        parent=styles['Heading2'],
        fontName='KoreanFont',
        fontSize=11.5,
        leading=16,
        textColor=colors.HexColor('#1E293B'),
        spaceBefore=12,
        spaceAfter=6,
        keepWithNext=True
    )
    
    body_style = ParagraphStyle(
        'KoBody',
        parent=styles['Normal'],
        fontName='KoreanFont',
        fontSize=9.5,
        leading=15.5,
        textColor=colors.HexColor('#334155'),
        spaceAfter=8
    )
    
    # 내어쓰기(Indent)가 완벽히 적용되는 리스트 스타일 정의
    list_style = ParagraphStyle(
        'KoList',
        parent=styles['Normal'],
        fontName='KoreanFont',
        fontSize=9.5,
        leading=15,
        textColor=colors.HexColor('#475569'),
        leftIndent=15,
        firstLineIndent=-12,
        spaceAfter=5
    )

    story = []
    
    md_path = os.path.join(project_root, "docs", "antigravity_guide.md")
    if not os.path.exists(md_path):
        print("ERROR: 원본 마크다운 가이드 파일이 존재하지 않습니다.")
        return

    with open(md_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # 인트로 및 메타 데이터 취합을 위한 버퍼링
    title_text = ""
    meta_info = []
    intro_lines = []
    
    parsing_stage = 0  # 0: 타이틀 및 인트로 파싱, 1: 본문 파싱
    h1_count = 0  # 페이지 나눔을 위한 변수
    
    for line in lines:
        stripped = line.strip()
        
        # 1. 인트로 단계 파싱
        if parsing_stage == 0:
            if stripped.startswith("# "):
                title_text = stripped[2:]
                continue
            if stripped.startswith(("부제:", "초판:", "공식 문서 검증:", "기획·검수:")):
                meta_info.append(stripped)
                continue
            if stripped == "---":
                # 표지/인트로 파싱 마감 및 최초 페이지 브레이크 적재 준비
                parsing_stage = 1
                continue
            if stripped:
                intro_lines.append(stripped)
            continue
            
        # 2. 본문 단계 파싱
        if not stripped:
            continue
            
        # 수동 구분선 처리 시 페이지 나눔
        if stripped == "---":
            story.append(PageBreak())
            continue
            
        # 이미지 태그 처리 (![alt](path)) -> 테이블 내 중앙 배치 기법 적용
        img_match = re.match(r'^!\[(.*?)\]\((.*?)\)$', stripped)
        if img_match:
            alt_text = img_match.group(1)
            rel_img_path = img_match.group(2)
            
            base_dir = os.path.dirname(os.path.dirname(md_path))
            clean_path = rel_img_path.lstrip('./').replace('../', '')
            full_img_path = os.path.join(base_dir, clean_path)
            
            if os.path.exists(full_img_path):
                try:
                    # 최대 가용 크기 정의 (가로 400pt, 세로 240pt 방어막 스케일링)
                    max_w = 400
                    max_h = 240
                    
                    with PILImage.open(full_img_path) as pil_img:
                        orig_w, orig_h = pil_img.size
                    
                    target_w = max_w
                    target_h = int((orig_h / orig_w) * target_w)
                    
                    if target_h > max_h:
                        target_h = max_h
                        target_w = int((orig_w / orig_h) * target_h)
                    
                    img_flowable = Image(full_img_path, width=target_w, height=target_h)
                    
                    # 1x1 투명 테이블을 활용하여 이미지를 정확하게 수평 중앙 정렬
                    img_table = Table([[img_flowable]], colWidths=[504])
                    img_table.setStyle(TableStyle([
                        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
                        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                        ('TOPPADDING', (0,0), (-1,-1), 10),
                        ('BOTTOMPADDING', (0,0), (-1,-1), 10),
                    ]))
                    story.append(img_table)
                except Exception as e:
                    print(f"WARNING: 이미지 처리 중 오류 - {e}")
            continue

        # 표준 Markdown 2단계 제목
        if stripped.startswith("## "):
            html_text = md_to_html(stripped[3:])
            story.append(Paragraph(html_text, h1_style))
            story.append(Spacer(1, 5))
            continue

        # 표준 Markdown 3단계 제목
        if stripped.startswith("### "):
            html_text = md_to_html(stripped[4:])
            story.append(Paragraph(html_text, h2_style))
            story.append(Spacer(1, 4))
            continue

        # 인용문
        if stripped.startswith("> "):
            story.append(Paragraph("※ " + md_to_html(stripped[2:]), list_style))
            continue

        # 코드 펜스는 구분 기호만 생략하고 내부 명령은 본문으로 출력한다.
        if stripped.startswith("```"):
            continue

        # Markdown 표 구분 행은 생략한다. 데이터 행은 가독성 있는 텍스트로 변환한다.
        if re.match(r'^\|?[\s:|-]+\|?$', stripped):
            continue
        if stripped.startswith("|") and stripped.endswith("|"):
            cells = [cell.strip() for cell in stripped.strip("|").split("|")]
            story.append(Paragraph(" · ".join(md_to_html(cell) for cell in cells), list_style))
            continue
            
        # 숫자 및 블릿 리스트 아이템 (1., 2., -, * 등)
        list_match = re.match(r'^([\-*\u25b7\u25b6]|[0-9]+\.|- \[[ xX]\])\s+(.*)$', stripped)
        if list_match:
            bullet = list_match.group(1)
            content = list_match.group(2)
            html_text = f"{bullet}  {md_to_html(content)}"
            story.append(Paragraph(html_text, list_style))
            continue
            
        # 일반 본문 텍스트
        html_text = md_to_html(stripped)
        story.append(Paragraph(html_text, body_style))

    # 표지 페이지 구성 조립
    cover_story = []
    cover_story.append(Spacer(1, 40))
    cover_story.append(Paragraph(title_text, title_style))
    
    # 구분선 삽입
    cover_story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#028090'), spaceBefore=8, spaceAfter=8))
    
    # 메타 정보 텍스트 결합
    meta_text = "  |  ".join(meta_info)
    cover_story.append(Paragraph(meta_text, meta_style))
    cover_story.append(Spacer(1, 10))
    
    # 가이드북 인트로 텍스트 추가
    for intro_line in intro_lines:
        cover_story.append(Paragraph(md_to_html(intro_line), body_style))
        cover_story.append(Spacer(1, 5))
        
    cover_story.append(PageBreak())
    
    # 전체 문서 흐름 연결
    story = cover_story + story

    # PDF 빌드 실행 (NumberedCanvas 캔버스메이커 장착)
    doc.build(story, canvasmaker=NumberedCanvas)
    print("SUCCESS: antigravity_guide.pdf 빌드 성공")


if __name__ == "__main__":
    build_pdf()
