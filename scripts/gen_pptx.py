"""PDEX — Commercial Deck (9 slides, 16:9) as editable PPTX.
Dark theme with PDEX brand gradient accents.
"""
import os
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.oxml.ns import qn
from lxml import etree

OUT = "/app/frontend/public/downloads/PDEX-Apresentacao-Comercial.pptx"

# ---------- PDEX brand ----------
C_BG      = RGBColor(0x05, 0x09, 0x16)
C_PANEL   = RGBColor(0x0F, 0x17, 0x2A)
C_PANEL2  = RGBColor(0x11, 0x1C, 0x36)
C_BORDER  = RGBColor(0x1E, 0x29, 0x3B)
C_TEXT    = RGBColor(0xE2, 0xE8, 0xF0)
C_MUTED   = RGBColor(0x94, 0xA3, 0xB8)
C_CYAN    = RGBColor(0x22, 0xD3, 0xEE)
C_BLUE    = RGBColor(0x3B, 0x82, 0xF6)
C_VIOLET  = RGBColor(0x8B, 0x5C, 0xF6)
C_EMERALD = RGBColor(0x34, 0xD3, 0x99)
C_ROSE    = RGBColor(0xF4, 0x3F, 0x5E)
C_AMBER   = RGBColor(0xF5, 0x9E, 0x0B)
C_WHITE   = RGBColor(0xFF, 0xFF, 0xFF)
C_DARK    = RGBColor(0x05, 0x09, 0x16)

# 16:9 canvas
W, H = Inches(13.333), Inches(7.5)

prs = Presentation()
prs.slide_width = W
prs.slide_height = H
BLANK = prs.slide_layouts[6]

def add_bg(slide, color=C_BG):
    r = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, W, H)
    r.line.fill.background()
    r.fill.solid(); r.fill.fore_color.rgb = color
    r.shadow.inherit = False
    return r

def add_rect(slide, x, y, w, h, fill=C_PANEL, line=C_BORDER, line_w=0.75, radius=None):
    shape = slide.shapes.add_shape(
        MSO_SHAPE.ROUNDED_RECTANGLE if radius else MSO_SHAPE.RECTANGLE, x, y, w, h
    )
    if radius is not None:
        # adjust corner radius (0..0.5 of shorter side)
        shape.adjustments[0] = radius
    shape.fill.solid(); shape.fill.fore_color.rgb = fill
    shape.line.color.rgb = line
    shape.line.width = Pt(line_w)
    shape.shadow.inherit = False
    return shape

def add_text(slide, x, y, w, h, text, *, size=18, bold=False, color=C_TEXT,
             font="Calibri", align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP,
             italic=False, letter_spacing=None):
    tb = slide.shapes.add_textbox(x, y, w, h)
    tf = tb.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = 0
    tf.margin_top = tf.margin_bottom = 0
    tf.vertical_anchor = anchor
    lines = text.split("\n") if isinstance(text, str) else text
    for i, line in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        run = p.add_run()
        run.text = line
        f = run.font
        f.name = font
        f.size = Pt(size)
        f.bold = bold
        f.italic = italic
        f.color.rgb = color
        if letter_spacing is not None:
            rPr = run._r.get_or_add_rPr()
            rPr.set("spc", str(letter_spacing))  # 1/100 pt
    return tb

def add_kicker(slide, x, y, text, color=C_CYAN, size=10):
    return add_text(slide, x, y, Inches(6), Inches(0.28),
                    text.upper(), size=size, bold=True, color=color,
                    font="Consolas", letter_spacing=280)

def add_pill(slide, x, y, text, color=C_MUTED, fill=C_PANEL2):
    r = add_rect(slide, x, y, Inches(2.3), Inches(0.32), fill=fill, line=C_BORDER, radius=0.5)
    add_text(slide, x, y-Inches(0.02), Inches(2.3), Inches(0.36), text,
             size=9, bold=True, color=color, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    return r

def add_logo(slide, x, y):
    box = add_rect(slide, x, y, Inches(0.42), Inches(0.42), fill=C_CYAN, radius=0.25)
    box.line.fill.background()
    add_text(slide, x, y, Inches(0.42), Inches(0.42), "P",
             size=18, bold=True, color=C_DARK, font="Consolas",
             align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    add_text(slide, x+Inches(0.55), y+Inches(0.04), Inches(2), Inches(0.36),
             "PDEX", size=16, bold=True, color=C_TEXT, letter_spacing=80)

def add_footer(slide, i, n):
    add_text(slide, Inches(0.5), H-Inches(0.42), Inches(6), Inches(0.3),
             "PDEX · PME · ERP · Sem Limites", size=9, color=C_MUTED)
    add_text(slide, W-Inches(1.5), H-Inches(0.42), Inches(1), Inches(0.3),
             f"{i:02d} / {n:02d}", size=9, color=C_MUTED, align=PP_ALIGN.RIGHT, font="Consolas")

def add_progress(slide, i, n):
    bar_w = W - Inches(1.0)
    add_rect(slide, Inches(0.5), H-Inches(0.6), bar_w, Emu(38100),
             fill=C_PANEL, line=C_PANEL, radius=0.5)
    fill_w = int(bar_w * (i/n))
    p = add_rect(slide, Inches(0.5), H-Inches(0.6), fill_w, Emu(38100),
                 fill=C_CYAN, line=C_CYAN, radius=0.5)
    p.line.fill.background()

def add_accent_bar(slide, x, y, w=Inches(0.9), color=C_CYAN):
    b = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, x, y, w, Emu(38100))
    b.line.fill.background()
    b.fill.solid(); b.fill.fore_color.rgb = color
    return b

def gradient_headline(slide, x, y, w, parts):
    """parts: list of (text, color, bold)."""
    tb = slide.shapes.add_textbox(x, y, w, Inches(1.4))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = 0
    tf.margin_top = tf.margin_bottom = 0
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.LEFT
    for text, color, bold in parts:
        run = p.add_run()
        run.text = text
        f = run.font
        f.size = Pt(40)
        f.bold = bold
        f.color.rgb = color
        f.name = "Calibri"
    return tb

N_SLIDES = 9

# ============================================================
# SLIDE 1 — COVER
# ============================================================
s = prs.slides.add_slide(BLANK)
add_bg(s)
# ambient orbs
o1 = add_rect(s, Inches(-2), Inches(-1.5), Inches(6), Inches(6), fill=RGBColor(0x0A,0x1A,0x40), radius=0.5)
o1.line.fill.background()
o2 = add_rect(s, Inches(9), Inches(3.5), Inches(6), Inches(6), fill=RGBColor(0x1A,0x0F,0x38), radius=0.5)
o2.line.fill.background()

add_logo(s, Inches(0.5), Inches(0.4))
add_pill(s, Inches(2.4), Inches(0.44), "● Apresentação Comercial", color=C_EMERALD)

add_kicker(s, Inches(0.5), Inches(2.4), "PDEX · PME · ERP · SEM LIMITES")

# Big headline
tb = s.shapes.add_textbox(Inches(0.5), Inches(2.85), Inches(12), Inches(2.2))
tf = tb.text_frame; tf.word_wrap = True
tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
p = tf.paragraphs[0]; p.alignment = PP_ALIGN.LEFT
for text, color, bold in [
    ("O ERP ", C_TEXT, True),
    ("completo ", C_CYAN, True),
    ("para PMEs\nbrasileiras.", C_TEXT, True),
]:
    r = p.add_run(); r.text = text; r.font.size = Pt(60); r.font.bold = bold; r.font.color.rgb = color; r.font.name = "Calibri"

add_text(s, Inches(0.5), Inches(5.05), Inches(11), Inches(1.0),
         "CRM, Vendas, Fiscal, Financeiro, Estoque e Multi-empresa em uma única plataforma.\n"
         "Cadastro em 5 minutos. Sem instalação. Compatível com a Reforma Tributária 2027.",
         size=15, color=C_MUTED)

# CTA button
btn = add_rect(s, Inches(0.5), Inches(6.1), Inches(2.6), Inches(0.55),
               fill=C_BLUE, line=C_BLUE, radius=0.35)
btn.line.fill.background()
add_text(s, Inches(0.5), Inches(6.1), Inches(2.6), Inches(0.55),
         "Solicitar demonstração  →", size=13, bold=True, color=C_DARK,
         align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)

btn2 = add_rect(s, Inches(3.25), Inches(6.1), Inches(1.6), Inches(0.55),
                fill=C_BG, line=C_BORDER, radius=0.35)
add_text(s, Inches(3.25), Inches(6.1), Inches(1.6), Inches(0.55),
         "Ver planos", size=12, bold=True, color=C_TEXT,
         align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)

add_footer(s, 1, N_SLIDES)
add_progress(s, 1, N_SLIDES)

# ============================================================
# SLIDE 2 — PROBLEMA
# ============================================================
s = prs.slides.add_slide(BLANK); add_bg(s)
add_logo(s, Inches(0.5), Inches(0.4))
add_kicker(s, Inches(0.5), Inches(1.15), "O PROBLEMA")

tb = s.shapes.add_textbox(Inches(0.5), Inches(1.5), Inches(12.3), Inches(1.4))
tf = tb.text_frame; tf.word_wrap = True
p = tf.paragraphs[0]; p.alignment = PP_ALIGN.LEFT
for text, color, bold in [("Gestão fragmentada custa ", C_TEXT, True),
                          ("40% do faturamento ", C_CYAN, True),
                          ("da sua PME.", C_TEXT, True)]:
    r = p.add_run(); r.text = text; r.font.size = Pt(34); r.font.bold = bold; r.font.color.rgb = color; r.font.name = "Calibri"

add_text(s, Inches(0.5), Inches(2.55), Inches(12), Inches(0.5),
         "7 em cada 10 pequenas empresas ainda operam com planilhas, WhatsApp e sistemas que não conversam.",
         size=13, color=C_MUTED)

# Two cards
card_y = Inches(3.15); card_w = Inches(6.05); card_h = Inches(3.5)
add_rect(s, Inches(0.5), card_y, card_w, card_h, fill=C_PANEL, radius=0.06)
add_rect(s, Inches(6.75), card_y, card_w, card_h, fill=C_PANEL, radius=0.06)

add_kicker(s, Inches(0.75), card_y+Inches(0.2), "HOJE", color=C_ROSE)
add_kicker(s, Inches(7.00), card_y+Inches(0.2), "COM PDEX", color=C_EMERALD)

pains = [
    ("✕", "Vendas perdidas no WhatsApp", "Leads somem, follow-up manual, zero previsibilidade.", C_ROSE),
    ("✕", "Planilhas desatualizadas", "Estoque e caixa que ninguém confia.", C_ROSE),
    ("✕", "ERP legado caro e travado", "R$ 3.000/mês, implantação de 6 meses.", C_ROSE),
    ("✕", "Impostos sem controle", "Reforma 2027 chegando e ninguém preparado.", C_ROSE),
]
gains = [
    ("✓", "Pipeline visual e automatizado", "Todo lead capturado, acompanhado e convertido.", C_EMERALD),
    ("✓", "Dashboard em tempo real", "KPIs de vendas, financeiro e estoque num só painel.", C_EMERALD),
    ("✓", "Preço justo, ativação em 1 dia", "A partir de R$ 99/mês. Sem taxa de setup.", C_EMERALD),
    ("✓", "Fiscal pronto para o futuro", "Motor tributário com CBS + IBS já configurado.", C_EMERALD),
]

def pain_row(slide, x, y, mark, title, desc, color):
    add_rect(slide, x, y+Inches(0.05), Inches(0.32), Inches(0.32), fill=C_BG, line=color, radius=0.5)
    add_text(slide, x, y+Inches(0.05), Inches(0.32), Inches(0.32), mark,
             size=13, bold=True, color=color, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    add_text(slide, x+Inches(0.5), y-Inches(0.04), Inches(5.2), Inches(0.32), title,
             size=13, bold=True, color=C_TEXT)
    add_text(slide, x+Inches(0.5), y+Inches(0.22), Inches(5.2), Inches(0.4), desc,
             size=11, color=C_MUTED)

for i, (mk, t, d, c) in enumerate(pains):
    pain_row(s, Inches(0.75), card_y+Inches(0.65)+i*Inches(0.68), mk, t, d, c)
for i, (mk, t, d, c) in enumerate(gains):
    pain_row(s, Inches(7.00), card_y+Inches(0.65)+i*Inches(0.68), mk, t, d, c)

add_footer(s, 2, N_SLIDES); add_progress(s, 2, N_SLIDES)

# ============================================================
# SLIDE 3 — SOLUÇÃO (6 módulos)
# ============================================================
s = prs.slides.add_slide(BLANK); add_bg(s)
add_logo(s, Inches(0.5), Inches(0.4))
add_kicker(s, Inches(0.5), Inches(1.15), "A SOLUÇÃO")

tb = s.shapes.add_textbox(Inches(0.5), Inches(1.5), Inches(12.3), Inches(1.2))
tf = tb.text_frame; tf.word_wrap = True
p = tf.paragraphs[0]; p.alignment = PP_ALIGN.LEFT
for text, color, bold in [("Uma plataforma. ", C_TEXT, True),
                          ("Seis módulos. ", C_CYAN, True),
                          ("Zero fricção.", C_TEXT, True)]:
    r = p.add_run(); r.text = text; r.font.size = Pt(34); r.font.bold = bold; r.font.color.rgb = color; r.font.name = "Calibri"

add_text(s, Inches(0.5), Inches(2.55), Inches(12), Inches(0.4),
         "Do lead ao balancete — tudo integrado, mobile-first, com auditoria e LGPD nativos.",
         size=13, color=C_MUTED)

mods = [
    ("CRM", "CRM & Pipeline", "Kanban visual, captura via landing, atribuição automática e conversão em pedido com 1 clique.", C_CYAN),
    ("VDA", "Vendas & Catálogo", "Produtos, preços, descontos, comissões e pedidos com impostos calculados na hora.", C_BLUE),
    ("FIS", "Fiscal & Reforma", "ICMS/PIS/COFINS/ISS/IPI hoje, CBS+IBS para 2027. Exporta SPED e CSV.", C_VIOLET),
    ("FIN", "Financeiro", "Dashboard executivo, metas de faturamento, contas a receber e relatórios do contador.", C_EMERALD),
    ("EST", "Estoque", "Controle multi-depósito, alertas de mínimo e movimentações auditadas.", C_AMBER),
    ("MT",  "Multi-empresa", "Uma conta, várias filiais/CNPJs. Isolamento total dos dados por tenant.", C_ROSE),
]
gx, gy = Inches(0.5), Inches(3.15)
cw, ch = Inches(4.05), Inches(1.75)
gap = Inches(0.13)
for i, (tag, title, desc, col) in enumerate(mods):
    r, c = divmod(i, 3)
    x = gx + c*(cw+gap); y = gy + r*(ch+gap)
    add_rect(s, x, y, cw, ch, fill=C_PANEL, radius=0.06)
    # icon
    ic = add_rect(s, x+Inches(0.22), y+Inches(0.22), Inches(0.75), Inches(0.5), fill=C_BG, line=col, radius=0.25)
    add_text(s, x+Inches(0.22), y+Inches(0.22), Inches(0.75), Inches(0.5), tag,
             size=11, bold=True, color=col, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE, font="Consolas")
    add_text(s, x+Inches(0.22), y+Inches(0.8), cw-Inches(0.45), Inches(0.35), title,
             size=14, bold=True, color=C_TEXT)
    add_text(s, x+Inches(0.22), y+Inches(1.15), cw-Inches(0.45), Inches(0.6), desc,
             size=10, color=C_MUTED)

add_footer(s, 3, N_SLIDES); add_progress(s, 3, N_SLIDES)

# ============================================================
# SLIDE 4 — DIFERENCIAIS (tabela + KPI)
# ============================================================
s = prs.slides.add_slide(BLANK); add_bg(s)
add_logo(s, Inches(0.5), Inches(0.4))
add_kicker(s, Inches(0.5), Inches(1.15), "POR QUE PDEX")

tb = s.shapes.add_textbox(Inches(0.5), Inches(1.5), Inches(12.3), Inches(1.0))
tf = tb.text_frame; tf.word_wrap = True
p = tf.paragraphs[0]; p.alignment = PP_ALIGN.LEFT
for text, color, bold in [("Feito para a PME ", C_TEXT, True),
                          ("brasileira de verdade.", C_CYAN, True)]:
    r = p.add_run(); r.text = text; r.font.size = Pt(30); r.font.bold = bold; r.font.color.rgb = color; r.font.name = "Calibri"

# KPI row
kpis = [
    ("Ativação",       "5 min",     "setup em 1 dia útil"),
    ("Módulos",        "6 + APIs",  "CRM · VDA · FIS · FIN · EST · MT"),
    ("Uptime",         "99,9%",     "infra managed 24/7"),
    ("LGPD & SOC-2",   "Nativo",    "audit log em cada mutação"),
]
kw = (W - Inches(1.0) - Inches(0.3)*3) / 4
ky = Inches(2.55); kh = Inches(1.35)
for i, (lb, val, dl) in enumerate(kpis):
    x = Inches(0.5) + i*(kw+Inches(0.3))
    add_rect(s, x, ky, kw, kh, fill=C_PANEL, radius=0.08)
    add_text(s, x+Inches(0.25), ky+Inches(0.15), kw, Inches(0.28), lb.upper(),
             size=9, bold=True, color=C_MUTED, letter_spacing=180)
    add_text(s, x+Inches(0.25), ky+Inches(0.4), kw, Inches(0.55), val,
             size=26, bold=True, color=C_TEXT)
    add_text(s, x+Inches(0.25), ky+Inches(0.98), kw, Inches(0.3), dl,
             size=10, color=C_EMERALD, font="Consolas")

# Comparison table
ty = Inches(4.15)
tbl_rows = [
    ("Critério",       "Planilhas",       "ERP legado",       "PDEX"),
    ("Preço mensal",   "R$ 0 (oculto)",   "R$ 1.500 – 5.000", "A partir de R$ 99"),
    ("Implantação",    "Infinito",        "3 – 6 meses",      "1 dia"),
    ("Mobile-first",   "Não",             "Parcial",          "Sim, bottom-nav"),
    ("Multi-empresa",  "Não",             "Custo extra",      "Incluso no Pro"),
    ("Reforma 2027",   "—",               "Roadmap",          "Já configurado"),
    ("LGPD & Audit",   "—",               "Add-on",           "Nativo"),
]
n_rows = len(tbl_rows)
cols_w = [Inches(3.2), Inches(3.0), Inches(3.0), Inches(3.13)]
row_h = Inches(0.34)
add_rect(s, Inches(0.5), ty, sum(cols_w, Inches(0)), row_h*n_rows+Inches(0.1), fill=C_PANEL, radius=0.04)
for ri, row in enumerate(tbl_rows):
    for ci, cell in enumerate(row):
        cx = Inches(0.5) + sum(cols_w[:ci], Inches(0)) + Inches(0.15)
        cy = ty + Inches(0.05) + ri*row_h
        if ri == 0:
            add_text(s, cx, cy, cols_w[ci], row_h, cell.upper(),
                     size=9, bold=True, color=C_MUTED, letter_spacing=140)
        else:
            hi = (ci == 3)
            add_text(s, cx, cy, cols_w[ci], row_h, cell,
                     size=11, bold=hi, color=C_EMERALD if hi else C_TEXT if ci==0 else C_MUTED)

add_footer(s, 4, N_SLIDES); add_progress(s, 4, N_SLIDES)

# ============================================================
# SLIDE 5 — RESULTADOS + QUOTES
# ============================================================
s = prs.slides.add_slide(BLANK); add_bg(s)
add_logo(s, Inches(0.5), Inches(0.4))
add_kicker(s, Inches(0.5), Inches(1.15), "RESULTADOS")

tb = s.shapes.add_textbox(Inches(0.5), Inches(1.5), Inches(12.3), Inches(1.0))
tf = tb.text_frame; tf.word_wrap = True
p = tf.paragraphs[0]; p.alignment = PP_ALIGN.LEFT
for text, color, bold in [("Impacto real em ", C_TEXT, True),
                          ("90 dias.", C_CYAN, True)]:
    r = p.add_run(); r.text = text; r.font.size = Pt(30); r.font.bold = bold; r.font.color.rgb = color; r.font.name = "Calibri"

k2 = [
    ("Conversão de lead",     "+38%", "pipeline sem furos"),
    ("Tempo de fechamento",   "−42%", "follow-up automático"),
    ("Erros fiscais",         "−73%", "motor tributário"),
    ("Horas do contador",     "−60%", "SPED/CSV prontos"),
]
kw = (W - Inches(1.0) - Inches(0.3)*3) / 4
ky = Inches(2.55); kh = Inches(1.35)
for i, (lb, val, dl) in enumerate(k2):
    x = Inches(0.5) + i*(kw+Inches(0.3))
    add_rect(s, x, ky, kw, kh, fill=C_PANEL, radius=0.08)
    add_text(s, x+Inches(0.25), ky+Inches(0.15), kw, Inches(0.28), lb.upper(),
             size=9, bold=True, color=C_MUTED, letter_spacing=160)
    add_text(s, x+Inches(0.25), ky+Inches(0.4), kw, Inches(0.55), val,
             size=28, bold=True, color=C_CYAN)
    add_text(s, x+Inches(0.25), ky+Inches(1.02), kw, Inches(0.3), dl,
             size=10, color=C_EMERALD, font="Consolas")

# quotes
qy = Inches(4.2); qh = Inches(2.3); qw = Inches(6.05)
def quote(slide, x, y, text, name, role, initials):
    add_rect(slide, x, y, qw, qh, fill=C_PANEL, radius=0.07)
    add_text(slide, x+Inches(0.3), y+Inches(0.2), qw-Inches(0.5), Inches(0.3),
             "★ ★ ★ ★ ★", size=11, color=C_AMBER)
    add_text(slide, x+Inches(0.3), y+Inches(0.55), qw-Inches(0.5), Inches(1.2),
             f"“{text}”", size=12, italic=True, color=C_TEXT)
    # avatar
    a = add_rect(slide, x+Inches(0.3), y+qh-Inches(0.65), Inches(0.42), Inches(0.42), fill=C_CYAN, radius=0.5)
    a.line.fill.background()
    add_text(slide, x+Inches(0.3), y+qh-Inches(0.65), Inches(0.42), Inches(0.42), initials,
             size=11, bold=True, color=C_DARK, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    add_text(slide, x+Inches(0.82), y+qh-Inches(0.68), qw-Inches(1), Inches(0.28), name,
             size=12, bold=True, color=C_TEXT)
    add_text(slide, x+Inches(0.82), y+qh-Inches(0.42), qw-Inches(1), Inches(0.28), role,
             size=10, color=C_MUTED)

quote(s, Inches(0.5), qy,
      "Saímos de 3 planilhas + WhatsApp para o PDEX em uma semana. Nosso ticket médio subiu 22% no primeiro mês.",
      "Renata Campos", "Diretora Comercial · Distribuidora BR", "RC")
quote(s, Inches(6.75), qy,
      "Multi-empresa nativo salvou a operação de 3 filiais. Hoje tenho um dashboard consolidado sem depender do TI.",
      "Marcos Almeida", "CEO · Grupo Vitta Comércio", "MA")

add_footer(s, 5, N_SLIDES); add_progress(s, 5, N_SLIDES)

# ============================================================
# SLIDE 6 — COMO FUNCIONA (jornada)
# ============================================================
s = prs.slides.add_slide(BLANK); add_bg(s)
add_logo(s, Inches(0.5), Inches(0.4))
add_kicker(s, Inches(0.5), Inches(1.15), "COMO FUNCIONA")

tb = s.shapes.add_textbox(Inches(0.5), Inches(1.5), Inches(12.3), Inches(1.0))
tf = tb.text_frame; tf.word_wrap = True
p = tf.paragraphs[0]; p.alignment = PP_ALIGN.LEFT
for text, color, bold in [("Do cadastro ao ", C_TEXT, True),
                          ("primeiro pedido em 24h.", C_CYAN, True)]:
    r = p.add_run(); r.text = text; r.font.size = Pt(30); r.font.bold = bold; r.font.color.rgb = color; r.font.name = "Calibri"

steps = [
    ("1", "Cadastro instantâneo", "Onboarding wizard cria o tenant, importa produtos e usuários por CSV."),
    ("2", "Landing pública ativa", "Formulário integrado ao CRM captura leads do site direto no pipeline."),
    ("3", "Vendedores online",    "App mobile e web, com bottom-nav e swipe drawer para uso em campo."),
    ("4", "Pedidos e Fiscal",     "Impostos calculados no ato. Emissão via provedor conectado (Focus/devnota)."),
    ("5", "Financeiro & Metas",   "Dashboard executivo com metas mensais e alertas em tempo real."),
    ("6", "Contador plugado",     "Perfil read-only exporta SPED, CSV e relatórios sem tocar em nada."),
]
sx, sy = Inches(0.5), Inches(2.7); sw = Inches(6.05); sh = Inches(1.35); gp = Inches(0.15)
for i, (n, t, d) in enumerate(steps):
    r, c = divmod(i, 2)
    x = sx + c*(sw+gp); y = sy + r*(sh+gp)
    add_rect(s, x, y, sw, sh, fill=C_PANEL, radius=0.06)
    circ = add_rect(s, x+Inches(0.25), y+Inches(0.28), Inches(0.55), Inches(0.55), fill=C_CYAN, radius=0.5)
    circ.line.fill.background()
    add_text(s, x+Inches(0.25), y+Inches(0.28), Inches(0.55), Inches(0.55), n,
             size=18, bold=True, color=C_DARK, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    add_text(s, x+Inches(0.95), y+Inches(0.22), sw-Inches(1.2), Inches(0.35), t,
             size=13, bold=True, color=C_TEXT)
    add_text(s, x+Inches(0.95), y+Inches(0.58), sw-Inches(1.2), Inches(0.7), d,
             size=10, color=C_MUTED)

add_footer(s, 6, N_SLIDES); add_progress(s, 6, N_SLIDES)

# ============================================================
# SLIDE 7 — SEGURANÇA & COMPLIANCE
# ============================================================
s = prs.slides.add_slide(BLANK); add_bg(s)
add_logo(s, Inches(0.5), Inches(0.4))
add_kicker(s, Inches(0.5), Inches(1.15), "SEGURANÇA · COMPLIANCE")

tb = s.shapes.add_textbox(Inches(0.5), Inches(1.5), Inches(12.3), Inches(1.0))
tf = tb.text_frame; tf.word_wrap = True
p = tf.paragraphs[0]; p.alignment = PP_ALIGN.LEFT
for text, color, bold in [("Dados isolados, ", C_TEXT, True),
                          ("auditados e criptografados.", C_CYAN, True)]:
    r = p.add_run(); r.text = text; r.font.size = Pt(30); r.font.bold = bold; r.font.color.rgb = color; r.font.name = "Calibri"

sec = [
    ("🔒", "Multi-tenant seguro", "Row-level isolation por tenant_id. Sua empresa nunca cruza com outra."),
    ("📜", "Audit Log SOC-2",     "Cada login, mutação e export gera evento com IP e device."),
    ("🛡", "LGPD nativo",         "Consent, anonimização e portabilidade de dados em 1 clique."),
    ("🔑", "JWT + RBAC",          "4 perfis (Super-admin, Admin, Vendedor, Contador) com middleware."),
    ("☁", "Backup diário",        "Snapshots automáticos e restore point-in-time."),
    ("✉", "Email transacional",   "Convites e alertas via Resend com DKIM/SPF configurados."),
]
gx, gy = Inches(0.5), Inches(2.65)
cw, ch = Inches(4.05), Inches(1.7); gap = Inches(0.13)
for i, (icon, t, d) in enumerate(sec):
    r, c = divmod(i, 3)
    x = gx + c*(cw+gap); y = gy + r*(ch+gap)
    add_rect(s, x, y, cw, ch, fill=C_PANEL, radius=0.06)
    ic = add_rect(s, x+Inches(0.25), y+Inches(0.25), Inches(0.5), Inches(0.5), fill=C_BG, line=C_CYAN, radius=0.3)
    add_text(s, x+Inches(0.25), y+Inches(0.25), Inches(0.5), Inches(0.5), icon,
             size=18, color=C_CYAN, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    add_text(s, x+Inches(0.25), y+Inches(0.82), cw-Inches(0.5), Inches(0.35), t,
             size=13, bold=True, color=C_TEXT)
    add_text(s, x+Inches(0.25), y+Inches(1.15), cw-Inches(0.5), Inches(0.5), d,
             size=10, color=C_MUTED)

add_footer(s, 7, N_SLIDES); add_progress(s, 7, N_SLIDES)

# ============================================================
# SLIDE 8 — PLANOS
# ============================================================
s = prs.slides.add_slide(BLANK); add_bg(s)
add_logo(s, Inches(0.5), Inches(0.4))
add_kicker(s, Inches(0.5), Inches(1.15), "INVESTIMENTO")

tb = s.shapes.add_textbox(Inches(0.5), Inches(1.5), Inches(12.3), Inches(1.0))
tf = tb.text_frame; tf.word_wrap = True
p = tf.paragraphs[0]; p.alignment = PP_ALIGN.LEFT
for text, color, bold in [("Planos que ", C_TEXT, True),
                          ("acompanham seu crescimento.", C_CYAN, True)]:
    r = p.add_run(); r.text = text; r.font.size = Pt(30); r.font.bold = bold; r.font.color.rgb = color; r.font.name = "Calibri"

plans = [
    ("STARTER",  "R$ 99",  "/mês", "Para começar sem dor.",
     ["3 usuários", "1 empresa (CNPJ)", "CRM + Vendas + Estoque", "Landing pública", "Suporte por email"], C_MUTED, False),
    ("PRO — MAIS ESCOLHIDO", "R$ 299", "/mês", "O ERP completo da sua PME.",
     ["10 usuários", "Até 3 empresas (multi-tenant)", "Fiscal completo + Reforma 2027", "Dashboard financeiro + Metas",
      "Perfil Contador + SPED/CSV", "Suporte prioritário"], C_CYAN, True),
    ("BUSINESS", "R$ 799", "/mês", "Para operações que escalam.",
     ["Usuários ilimitados", "Empresas ilimitadas", "Integrações (WhatsApp, ML, Shopee)",
      "Audit Log avançado + LGPD advanced", "SLA 99,9% + SSO/SAML", "CSM dedicado"], C_VIOLET, False),
]
py = Inches(2.6); pw = Inches(4.05); ph = Inches(4.2); pgap = Inches(0.15)
for i, (tag, price, per, desc, feats, col, featured) in enumerate(plans):
    x = Inches(0.5) + i*(pw+pgap)
    card = add_rect(s, x, py, pw, ph, fill=C_PANEL, radius=0.06)
    if featured:
        card.line.color.rgb = col
        card.line.width = Pt(1.5)
    add_text(s, x+Inches(0.25), py+Inches(0.2), pw-Inches(0.4), Inches(0.3), tag,
             size=10, bold=True, color=col, letter_spacing=180)
    add_text(s, x+Inches(0.25), py+Inches(0.55), pw-Inches(0.4), Inches(0.7), price,
             size=34, bold=True, color=C_TEXT)
    add_text(s, x+Inches(0.25), py+Inches(1.25), pw-Inches(0.4), Inches(0.3), per,
             size=11, color=C_MUTED)
    add_text(s, x+Inches(0.25), py+Inches(1.55), pw-Inches(0.4), Inches(0.35), desc,
             size=11, color=C_MUTED)
    for j, f in enumerate(feats):
        add_text(s, x+Inches(0.25), py+Inches(2.0)+j*Inches(0.32), pw-Inches(0.4), Inches(0.3),
                 f"✓  {f}", size=11, color=C_TEXT)

add_text(s, Inches(0.5), Inches(6.95), Inches(12.3), Inches(0.3),
         "Todos os planos com 14 dias grátis · sem cartão de crédito · cancele quando quiser.",
         size=11, color=C_MUTED, align=PP_ALIGN.CENTER)

add_footer(s, 8, N_SLIDES); add_progress(s, 8, N_SLIDES)

# ============================================================
# SLIDE 9 — CTA FINAL
# ============================================================
s = prs.slides.add_slide(BLANK); add_bg(s)
o1 = add_rect(s, Inches(-2), Inches(-1.5), Inches(6), Inches(6), fill=RGBColor(0x0A,0x1A,0x40), radius=0.5); o1.line.fill.background()
o2 = add_rect(s, Inches(9), Inches(3.5), Inches(6), Inches(6), fill=RGBColor(0x1A,0x0F,0x38), radius=0.5); o2.line.fill.background()

add_logo(s, Inches(0.5), Inches(0.4))
add_kicker(s, Inches(0.5), Inches(2.2), "VAMOS COMEÇAR", color=C_CYAN)

tb = s.shapes.add_textbox(Inches(0.5), Inches(2.6), Inches(12.3), Inches(2.4))
tf = tb.text_frame; tf.word_wrap = True
p = tf.paragraphs[0]; p.alignment = PP_ALIGN.CENTER
for text, color, bold in [("Pare de perder\n", C_TEXT, True),
                          ("tempo e vendas.", C_CYAN, True)]:
    r = p.add_run(); r.text = text; r.font.size = Pt(58); r.font.bold = bold; r.font.color.rgb = color; r.font.name = "Calibri"

add_text(s, Inches(0.5), Inches(5.05), Inches(12.3), Inches(0.6),
         "Ative o PDEX hoje e veja seu primeiro pedido saindo em 24 horas.",
         size=15, color=C_MUTED, align=PP_ALIGN.CENTER)

# CTA buttons
btn_y = Inches(5.85)
btn = add_rect(s, Inches(4.35), btn_y, Inches(2.4), Inches(0.55), fill=C_BLUE, line=C_BLUE, radius=0.35); btn.line.fill.background()
add_text(s, Inches(4.35), btn_y, Inches(2.4), Inches(0.55), "Iniciar teste grátis  →",
         size=13, bold=True, color=C_DARK, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
btn2 = add_rect(s, Inches(6.9), btn_y, Inches(2.1), Inches(0.55), fill=C_BG, line=C_BORDER, radius=0.35)
add_text(s, Inches(6.9), btn_y, Inches(2.1), Inches(0.55), "Falar com vendas",
         size=12, bold=True, color=C_TEXT, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)

add_text(s, Inches(0.5), Inches(6.7), Inches(12.3), Inches(0.4),
         "pdex.com.br  ·  contato@pdex.com.br  ·  Feito no Brasil",
         size=10, color=C_MUTED, align=PP_ALIGN.CENTER)

add_footer(s, 9, N_SLIDES); add_progress(s, 9, N_SLIDES)

# ============================================================
prs.save(OUT)
print(f"WROTE {OUT} size={os.path.getsize(OUT)}")
