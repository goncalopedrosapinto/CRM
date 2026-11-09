# Gera docs/folha-negocio.pdf: a Folha de Negócio (motas novas, demos e usadas) com campos preenchíveis.
# Mesmo aspeto do acordo de venda das usadas. Os nomes dos campos são os que a app preenche (index.html, FOLHA_*).
# Uso: python3 docs/fontes/folha_negocio.py   (precisa de reportlab e das fontes Carlito: fonts-crosextra-carlito)
import os
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import Color, black, white

AQUI = os.path.dirname(os.path.abspath(__file__))
SAIDA = os.path.join(AQUI, '..', 'folha-negocio.pdf')
FONTES = '/usr/share/fonts/truetype/crosextra/'
pdfmetrics.registerFont(TTFont('Carlito', FONTES + 'Carlito-Regular.ttf'))
pdfmetrics.registerFont(TTFont('Carlito-Bold', FONTES + 'Carlito-Bold.ttf'))

# dados da empresa (iguais aos do acordo de venda)
EMPRESA = 'Caetano Baviera Portugal, S.A.'
LOJA = 'Caetano BMW Motorrad Aveiro'
LOJA_MORADA = 'Quinta do Simão - Esgueira, EN 109 - Apartado 3019'
LOJA_CP_TEL = '3801-903 Aveiro · Tel. (+351) 234 305 150'
SEDE = ['Sede Social - Rua do Barreiro, 547 - Madalena,',
        '4409-513 Vila Nova de Gaia - Cap. Social - 35.650.000€',
        'Matr. C.R.C. V. N. Gaia e NIPC 517 304 406']

W, H = 595.28, 841.89
X0, X1 = 30, 565.28
CINZA_BARRA = Color(.85098, .85098, .85098)
CINZA_LINHA = Color(.478431, .478431, .478431)
CINZA_TXT = Color(.419608, .419608, .419608)

c = canvas.Canvas(SAIDA, pagesize=(W, H))
c.setTitle('Folha de Negócio')
c.setAuthor(EMPRESA)
c.setSubject('Folha de Negócio - Viaturas Novas, Demonstração e Usadas')
c.setCreator('Baviera Control')
form = c.acroForm


def barra(y, titulo, titulo2=None, x2=None):
    """Barra cinzenta de secção com o topo em y; devolve a linha de base da 1.ª fila."""
    c.setFillColor(CINZA_BARRA)
    c.rect(X0, y - 14, X1 - X0, 14, stroke=0, fill=1)
    c.setFillColor(black)
    c.setFont('Carlito-Bold', 9)
    c.drawString(X0 + 4, y - 10, titulo)
    if titulo2:
        c.drawString(x2 + 4, y - 10, titulo2)
    c.setStrokeColor(black)
    c.setLineWidth(1.4)
    c.line(X0, y, X1, y)
    return y - 14 - 16


def campo(nome, rotulo, x, base, fim, tam=8, multilinha=False, altura=12):
    """Rótulo + linha + campo de texto (sem borda) por cima da linha."""
    c.setFillColor(black)
    c.setFont('Carlito', 8.5)
    c.drawString(x, base, rotulo)
    lx = x + pdfmetrics.stringWidth(rotulo, 'Carlito', 8.5) + 4
    c.setStrokeColor(CINZA_LINHA)
    c.setLineWidth(.5)
    c.line(lx, base - 2, fim, base - 2)
    form.textfield(name=nome, tooltip=rotulo.rstrip(':'), x=lx, y=base - 2, width=fim - lx, height=altura,
                   borderWidth=0, borderColor=None, fillColor=None, textColor=black, forceBorder=False,
                   fontName='Helvetica', fontSize=tam, maxlen=0, fieldFlags='multiline' if multilinha else '')
    c.setStrokeColor(black)


def caixa(nome, rotulo, x, base):
    """Caixa de marcar + rótulo; devolve o x a seguir ao rótulo."""
    form.checkbox(name=nome, tooltip=rotulo, x=x, y=base - 1.6, size=9, buttonStyle='check', borderWidth=.8,
                  borderColor=black, fillColor=white, textColor=black, forceBorder=True, fieldFlags='')
    c.setFillColor(black)
    c.setFont('Carlito', 8.5)
    c.drawString(x + 13, base, rotulo)
    return x + 13 + pdfmetrics.stringWidth(rotulo, 'Carlito', 8.5)


def fila_caixas(itens, base, x=X0 + 4, fim=X1 - 4):
    """Caixas espalhadas por igual na largura."""
    larg = [13 + pdfmetrics.stringWidth(r, 'Carlito', 8.5) for _, r in itens]
    folga = (fim - x - sum(larg)) / max(1, len(itens) - 1)
    for (nome, r), l in zip(itens, larg):
        caixa(nome, r, x, base)
        x += l + folga


# ---------- cabeçalho (BMW Motorrad à esquerda, Caetano à direita, como no Excel) ----------
c.drawImage(os.path.join(AQUI, 'logo-bmw-motorrad.png'), 32, 772, width=44, height=44)
c.drawImage(os.path.join(AQUI, 'logo-caetano.png'), 417.28, 779.89, width=148, height=31.59551)
c.setFont('Carlito-Bold', 17)
c.drawCentredString(W / 2, 791.89, 'FOLHA DE NEGÓCIO')
c.setFillColor(CINZA_TXT)
c.setFont('Carlito', 9)
c.drawCentredString(W / 2, 779.89, 'Viaturas Novas, Demonstração e Usadas  ·  BMW Motorrad')
c.setFillColor(black)

TOPO = 763.89
y = TOPO
# ---------- negócio ----------
b = barra(y, 'DADOS DO NEGÓCIO')
campo('vendedor', 'Vendedor:', 34, b, 236.9)
campo('n_bizagi', 'Nº Bizagi:', 246.9, b, 419.4)
campo('data', 'Data:', 429.4, b, 561.28)
y = b - 8
# ---------- cliente ----------
b = barra(y, 'CLIENTE')
campo('cliente_nome', 'Nome:', 34, b, 561.28)
b -= 19
campo('cliente_morada', 'Morada:', 34, b, 561.28)
b -= 19
campo('cliente_empresa', 'Empresa:', 34, b, 561.28)
b -= 19
campo('cliente_nif', 'NIF:', 34, b, 170)
campo('cliente_contacto', 'Contacto:', 180, b, 330)
campo('cliente_email', 'E-mail:', 340, b, 561.28)
b -= 19
c.setFont('Carlito', 8.5)
c.drawString(34, b, 'Recolha de Consentimento (RGPD):')
xx = 34 + pdfmetrics.stringWidth('Recolha de Consentimento (RGPD):', 'Carlito', 8.5) + 12
xx = caixa('rgpd_sim', 'Sim', xx, b) + 18
caixa('rgpd_nao', 'Não', xx, b)
y = b - 8
# ---------- tipo de venda ----------
b = barra(y, 'TIPO DE VENDA')
xx = caixa('tv_novo', 'Novo', 34, b) + 20
xx = caixa('tv_demo', 'Demo', xx, b) + 20
caixa('tv_usado', 'Usado', xx, b)
campo('viatura_matricula', 'Matrícula:', 200, b, 370)
campo('viatura_data_matricula', 'Data da Matrícula:', 380, b, 561.28)
y = b - 8
# ---------- origem ----------
b = barra(y, 'ORIGEM DO NEGÓCIO')
fila_caixas([('or_stand', 'Stand'), ('or_recomendacao', 'Recomendação'), ('or_lead', 'Lead'), ('or_bsc', 'BSC')], b, fim=380)
b -= 19
fila_caixas([('or_angariacao', 'Angariação'), ('or_apv', 'APV'), ('or_eventos', 'Eventos'), ('or_cliente_atual', 'Cliente Atual')], b, fim=380)
y = b - 8
# ---------- negócio + financiamento ----------
XD = 352
b = barra(y, 'INFORMAÇÕES DE NEGÓCIO', 'TIPO DE FINANCIAMENTO', XD)
topo_cols = y - 14
campo('n_proposta', 'Nº Proposta:', 34, b, XD - 8)
b1 = b - 19
campo('modelo', 'Modelo:', 34, b1, XD - 8)
b1 -= 19
campo('valor_fatura', 'Valor Fatura (€):', 34, b1, 186)
campo('sinal', 'Sinal (€):', 196, b1, XD - 8)
b1 -= 19
campo('encomenda', 'Encomenda:', 34, b1, XD - 8)
b1 -= 19
c.setFont('Carlito', 8.5)
c.drawString(34, b1, 'Faturação:')
xx = 34 + pdfmetrics.stringWidth('Faturação:', 'Carlito', 8.5) + 10
xx = caixa('fat_empresa', 'Empresa', xx, b1) + 14
xx = caixa('fat_dec_utilizador', 'Dec. Utilizador', xx, b1) + 14
caixa('fat_particular', 'Particular', xx, b1)
fins = [('fin_pp', 'PP'), ('fin_f_ext', 'F. Ext'), ('fin_f_bmw', 'F BMW'), ('fin_gap', 'GAP'), ('fin_protecao_credito', 'Proteção de Crédito')]
bf = b
for i, (nome, r) in enumerate(fins):
    caixa(nome, r, XD + 8 + (i % 2) * 100, bf)
    if i % 2:
        bf -= 19
bf -= 19
campo('subvencao_taxa', 'Subvenção Taxa:', XD + 8, bf, 561.28)
fim_cols = min(b1, bf) - 8
c.setStrokeColor(black)
c.setLineWidth(.8)
c.line(XD, topo_cols, XD, fim_cols)
y = fim_cols
# ---------- seguro ----------
b = barra(y, 'SEGURO')
campo('seguro_data_carta', 'Data de emissão da carta:', 34, b, 290)
campo('seguro_mat_anterior', 'Matrícula da viatura anterior:', 300, b, 561.28)
y = b - 8
# ---------- retoma ----------
b = barra(y, 'INFORMAÇÕES DE RETOMA')
campo('retoma_modelo', 'Modelo:', 34, b, 236.9)
campo('retoma_matricula', 'Matrícula:', 246.9, b, 370)
campo('retoma_ano', 'Ano:', 380, b, 450)
campo('retoma_kms', 'Km:', 460, b, 561.28)
b -= 19
campo('retoma_valor', 'Valor dado ao cliente (€):', 34, b, 290)
campo('retoma_valor_comercio', 'Valor dado pelo comércio (€):', 300, b, 561.28)
y = b - 8
# ---------- assinaturas (de baixo para cima) e observações no espaço que sobra ----------
BASE_QUADRO = 91.49
ASS_TOPO = BASE_QUADRO + 66
obs_topo = y
c.setFillColor(CINZA_BARRA)
c.rect(X0, obs_topo - 14, X1 - X0, 14, stroke=0, fill=1)
c.setFillColor(black)
c.setFont('Carlito-Bold', 9)
c.drawString(X0 + 4, obs_topo - 10, 'OBSERVAÇÕES')
c.setLineWidth(1.4)
c.line(X0, obs_topo, X1, obs_topo)
c.setStrokeColor(Color(.784314, .784314, .784314))
c.setLineWidth(.4)
ly = obs_topo - 14 - 14
linhas = []
while ly > ASS_TOPO + 8:
    c.line(34, ly, 561.28, ly)
    linhas.append(ly)
    ly -= 14
form.textfield(name='observacoes', tooltip='Observações', x=34, y=linhas[-1], width=561.28 - 34,
               height=obs_topo - 14 - 2 - linhas[-1], borderWidth=0, borderColor=None, fillColor=None, textColor=black,
               forceBorder=False, fontName='Helvetica', fontSize=9, maxlen=0, fieldFlags='multiline')
c.setStrokeColor(black)
c.setFillColor(CINZA_BARRA)
c.rect(X0, ASS_TOPO - 14, X1 - X0, 14, stroke=0, fill=1)
c.setFillColor(black)
c.setFont('Carlito-Bold', 9)
c.drawString(X0 + 4, ASS_TOPO - 10, 'ASSINATURAS')
c.setLineWidth(1.4)
c.line(X0, ASS_TOPO, X1, ASS_TOPO)
for x0, x1, rot in [(70, 260, 'Vendedor'), (335, 525, 'Chefe de Vendas')]:
    c.setStrokeColor(CINZA_LINHA)
    c.setLineWidth(.6)
    c.line(x0, BASE_QUADRO + 16, x1, BASE_QUADRO + 16)
    c.setFont('Carlito-Bold', 8.5)
    c.drawCentredString((x0 + x1) / 2, BASE_QUADRO + 6, rot)
# quadro
c.setStrokeColor(black)
c.setLineWidth(1.2)
c.rect(X0, BASE_QUADRO, X1 - X0, TOPO - BASE_QUADRO, stroke=1, fill=0)
c.setLineWidth(2.2)
c.line(X1, TOPO, X1, BASE_QUADRO)
c.line(X0, BASE_QUADRO, X1, BASE_QUADRO)
# ---------- rodapé ----------
c.setFillColor(CINZA_TXT)
for i, (neg, txt) in enumerate([('Empresa', EMPRESA), ('Marc. Oficina', '808 919 970'), ('Internet', 'caetano.pt/bmw')]):
    yy = 50 - 8 * i
    c.setFont('Carlito-Bold', 6.6)
    c.drawString(30, yy, neg)
    c.setFont('Carlito', 6.6)
    c.drawString(30 + pdfmetrics.stringWidth(neg + ' ', 'Carlito-Bold', 6.6), yy, txt)
c.setFillColor(Color(.227451, .227451, .227451))
c.setFont('Carlito-Bold', 7)
c.drawCentredString(W / 2, 50, LOJA)
c.setFont('Carlito', 6.6)
c.drawCentredString(W / 2, 42, LOJA_MORADA)
c.drawCentredString(W / 2, 34, LOJA_CP_TEL)
c.setFillColor(CINZA_TXT)
for i, t in enumerate(SEDE):
    c.drawRightString(X1, 50 - 8 * i, t)
c.showPage()
c.save()
print('gerado', os.path.abspath(SAIDA))
