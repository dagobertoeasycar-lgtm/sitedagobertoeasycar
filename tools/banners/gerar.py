# -*- coding: utf-8 -*-
"""Gerador dos banners da home (Auto Drive Veiculos).

Por que existe: os banners sao imagens prontas, e refazer no Photoshop a
cada mudanca de texto e caro. Aqui o layout e codigo: muda a frase, roda
de novo, sai o arquivo novo com a identidade certa.

Uso:  python gerar.py
Saida: ../../public/banners/ad-*.jpg  (1920x820, JPEG otimizado)
"""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

AQUI   = os.path.dirname(os.path.abspath(__file__))
SAIDA  = os.path.normpath(os.path.join(AQUI, "..", "..", "public", "banners"))
LOGO   = os.path.normpath(os.path.join(AQUI, "..", "..", "public", "brand", "logo-footer.png"))
FOTOS  = os.path.join(AQUI, "fotos")          # fotos do Beto entram aqui

W, H = 1920, 820
TEAL        = (1, 168, 176)
TEAL_ESCURO = (10, 125, 135)
NAVY        = (7, 17, 31)
BRANCO      = (255, 255, 255)
CINZA       = (176, 195, 208)

F = lambda nome, tam: ImageFont.truetype(os.path.join(r"C:\Windows\Fonts", nome), tam)
BLACK  = lambda t: F("ariblk.ttf", t)
BOLD   = lambda t: F("arialbd.ttf", t)
NORMAL = lambda t: F("arial.ttf", t)


def fundo():
    """Gradiente diagonal navy -> teal escuro, com faixas de luz."""
    base = Image.new("RGB", (W, H), NAVY)
    grad = Image.new("RGB", (W, H))
    px = grad.load()
    for y in range(H):
        for x in range(0, W, 4):
            t = (x / W) * 0.72 + (y / H) * 0.28
            px2 = (
                int(NAVY[0] + (TEAL_ESCURO[0] - NAVY[0]) * t),
                int(NAVY[1] + (TEAL_ESCURO[1] - NAVY[1]) * t),
                int(NAVY[2] + (TEAL_ESCURO[2] - NAVY[2]) * t),
            )
            for k in range(4):
                if x + k < W:
                    px[x + k, y] = px2
    base = grad

    # faixas diagonais de luz, como as linhas vermelhas dos banners antigos
    luz = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(luz)
    for x0, esp, op in ((-260, 3, 90), (-130, 2, 60), (W - 760, 3, 70), (W - 560, 2, 45)):
        d.line([(x0, H + 120), (x0 + 900, -120)], fill=TEAL + (op,), width=esp)
    luz = luz.filter(ImageFilter.GaussianBlur(1.4))
    base = Image.alpha_composite(base.convert("RGBA"), luz)

    # brilho teal no canto direito, onde entra a foto / o selo
    brilho = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(brilho).ellipse([W - 980, -300, W + 220, H + 300], fill=TEAL + (46,))
    brilho = brilho.filter(ImageFilter.GaussianBlur(190))
    base = Image.alpha_composite(base, brilho)

    # escurece a esquerda para o texto ficar legivel
    sombra = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ds = ImageDraw.Draw(sombra)
    for i in range(0, 1150, 6):
        a = int(150 * (1 - i / 1150))
        ds.rectangle([i, 0, i + 6, H], fill=(3, 10, 18, a))
    base = Image.alpha_composite(base, sombra)
    return base.convert("RGB")


def escrever(d, xy, texto, fonte, cor, espacamento=0):
    """Desenha texto com tracking opcional. Devolve a largura usada."""
    x, y = xy
    if not espacamento:
        d.text((x, y), texto, font=fonte, fill=cor, anchor="ls")
        return d.textlength(texto, font=fonte)
    for ch in texto:
        d.text((x, y), ch, font=fonte, fill=cor, anchor="ls")
        x += d.textlength(ch, font=fonte) + espacamento
    return x - xy[0]


def pilula(d, x, y, texto, fonte, preenchida=True, icone=None):
    pad_x, alt = 38, 74
    larg = d.textlength(texto, font=fonte) + pad_x * 2 + (34 if icone else 0)
    caixa = [x, y, x + larg, y + alt]
    if preenchida:
        d.rounded_rectangle(caixa, radius=12, fill=TEAL_ESCURO)
        cor_txt = BRANCO
    else:
        d.rounded_rectangle(caixa, radius=12, outline=BRANCO, width=2)
        cor_txt = BRANCO
    tx = x + pad_x
    if icone:
        d.ellipse([tx, y + alt / 2 - 11, tx + 22, y + alt / 2 + 11], outline=cor_txt, width=2)
        tx += 34
    d.text((tx, y + alt / 2 + 1), texto, font=fonte, fill=cor_txt, anchor="lm")
    return larg


def selo(img, texto_cima, texto_baixo):
    """Selo circular grande do lado direito (quando nao ha foto)."""
    cx, cy, r = W - 470, H // 2 - 20, 210
    camada = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(camada)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, 255, 255, 12))
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=TEAL + (255,), width=6)
    d.ellipse([cx - r + 26, cy - r + 26, cx + r - 26, cy + r - 26], outline=(255, 255, 255, 70), width=2)
    img = Image.alpha_composite(img.convert("RGBA"), camada).convert("RGB")
    d = ImageDraw.Draw(img)
    d.text((cx, cy - 34), texto_cima, font=BLACK(118), fill=BRANCO, anchor="mm")
    escrever(d, (cx - d.textlength(texto_baixo, font=BOLD(31)) / 2 - 3 * (len(texto_baixo) - 1) / 2, cy + 74),
             texto_baixo, BOLD(31), TEAL, espacamento=3)
    return img


def foto_recortada(caminho, altura):
    """Recorta a foto no rosto/busto, sem alterar o rosto - so enquadramento."""
    im = Image.open(caminho).convert("RGB")
    # enquadra o terco superior, onde esta o rosto, em proporcao 3:4
    lado = min(im.width, int(im.height * 0.62))
    cx = im.width // 2
    topo = int(im.height * 0.02)
    caixa = (max(0, cx - lado // 2), topo, min(im.width, cx + lado // 2), min(im.height, topo + int(lado * 1.28)))
    im = im.crop(caixa)
    prop = altura / im.height
    return im.resize((int(im.width * prop), altura), Image.LANCZOS)


def banner(nome, olho, linhas, sub, badges=None, selo_txt=None, foto=None):
    img = fundo()

    if selo_txt:
        img = selo(img, *selo_txt)

    if foto and os.path.exists(foto):
        f = foto_recortada(foto, 700)
        mold = Image.new("RGBA", (f.width + 16, f.height + 16), (0, 0, 0, 0))
        ImageDraw.Draw(mold).rounded_rectangle([0, 0, f.width + 15, f.height + 15], radius=26, outline=TEAL + (255,), width=5)
        px_, py_ = W - f.width - 150, (H - f.height) // 2
        cantos = Image.new("L", f.size, 0)
        ImageDraw.Draw(cantos).rounded_rectangle([0, 0, f.width, f.height], radius=20, fill=255)
        img.paste(f, (px_, py_), cantos)
        img = Image.alpha_composite(img.convert("RGBA"), Image.new("RGBA", (W, H), (0, 0, 0, 0)))
        img.alpha_composite(mold, (px_ - 8, py_ - 8))
        img = img.convert("RGB")

    d = ImageDraw.Draw(img)
    x = 108

    logo = Image.open(LOGO).convert("RGBA")
    lw = 300
    logo = logo.resize((lw, round(logo.height * lw / logo.width)), Image.LANCZOS)
    img.paste(logo, (x, 72), logo)

    # O carrossel do site tem largura maxima de 840px e no celular cai para
    # ~375px. Tudo o que for menor que ~30px aqui simplesmente some la.
    # Por isso o titulo e grande e nao ha faixa de selos pequenos: o que
    # precisa ser lido esta no titulo.
    escrever(d, (x, 268), olho, BOLD(27), TEAL, espacamento=6)

    y = 372 if len(linhas) == 3 else 424
    for texto, destaque in linhas:
        d.text((x, y), texto, font=BLACK(92), fill=(TEAL if destaque else BRANCO), anchor="ls")
        y += 104

    y += (-38 if len(linhas) == 3 else 6)
    d.text((x, y), sub, font=NORMAL(34), fill=CINZA, anchor="ls")

    y += 54
    larg = pilula(d, x, y, "VER ESTOQUE", BOLD(26), True)
    pilula(d, x + larg + 20, y, "FALE NO WHATSAPP", BOLD(26), False, icone=True)

    os.makedirs(SAIDA, exist_ok=True)
    destino = os.path.join(SAIDA, nome)
    img.save(destino, "JPEG", quality=82, optimize=True, progressive=True)
    kb = os.path.getsize(destino) / 1024
    print(f"{nome:28s} {img.size[0]}x{img.size[1]}  {kb:6.0f} KB")
    return destino


BANNERS = [
    dict(
        nome="ad-01-parceiros.jpg",
        olho="VÁRIOS PARCEIROS, UM SÓ ATENDIMENTO",
        linhas=[("VÁRIOS MODELOS", False), ("PARA TODOS", False), ("OS GOSTOS.", True)],
        sub="Estoque atualizado todo dia, de vários parceiros, num lugar só.",
        badges=["Periciados", "Procedência conferida", "Documentação acompanhada"],
        selo_txt=("+100", "VEÍCULOS"),
    ),
    dict(
        nome="ad-02-garantia.jpg",
        olho="VEÍCULOS DE PARCEIROS LOJISTAS",
        linhas=[("GARANTIA DE", False), ("90 DIAS E", False), ("LAUDO CAUTELAR.", True)],
        sub="Você leva o carro com garantia do lojista e a papelada acompanhada.",
        badges=["Garantia de 90 dias", "Laudo cautelar", "Transferência acompanhada"],
        selo_txt=("90", "DIAS"),
    ),
    dict(
        nome="ad-03-negociacao.jpg",
        olho="DO PRIMEIRO CONTATO À CHAVE NA MÃO",
        linhas=[("NEGOCIAÇÃO", False), ("FÁCIL", False), ("E RÁPIDA.", True)],
        sub="Fale direto no WhatsApp e receba as opções que cabem no seu bolso.",
        badges=["Resposta rápida", "Crédito online", "Sem enrolação"],
        selo_txt=("24h", "NO WHATSAPP"),
    ),
    dict(
        nome="ad-04-particulares.jpg",
        olho="TAMBÉM INTERMEDIAMOS COM PARTICULARES",
        linhas=[("COMPRE DE", False), ("PARTICULAR", False), ("COM SEGURANÇA.", True)],
        sub="Veículo periciado, procedência conferida e documentação do começo ao fim.",
        badges=["Periciado antes do negócio", "Procedência conferida", "Transferência acompanhada"],
        selo_txt=("100%", "ACOMPANHADO"),
    ),
]

# Banners com o rosto do Beto: so entram se a foto existir em tools/banners/fotos/
BANNERS_COM_FOTO = [
    dict(
        arquivo="beto-01.jpg",
        nome="ad-05-quem-atende.jpg",
        olho="QUEM ATENDE VOCÊ",
        linhas=[("TEM NOME", False), ("E ROSTO.", True)],
        sub="Atendimento direto com quem entende do assunto, do começo ao fim.",
        badges=["Atendimento direto", "Negociação transparente"],
    ),
    dict(
        arquivo="beto-02.jpg",
        nome="ad-06-confianca.jpg",
        olho="AUTO DRIVE VEÍCULOS",
        linhas=[("SEU PRÓXIMO", False), ("CARRO COMEÇA", False), ("NUMA CONVERSA.", True)],
        sub="Chame no WhatsApp e diga o que você procura. O resto a gente resolve.",
        badges=["Resposta rápida", "Sem compromisso"],
    ),
    dict(
        arquivo="beto-03.jpg",
        nome="ad-07-experiencia.jpg",
        olho="EXPERIÊNCIA DE QUEM VIVE DISSO",
        linhas=[("A GENTE CUIDA", False), ("DE CADA", False), ("DETALHE.", True)],
        sub="Perícia, procedência e documentação acompanhada em cada negócio.",
        badges=["Periciados", "Documentação acompanhada"],
    ),
]

if __name__ == "__main__":
    print("--- banners sem foto ---")
    for b in BANNERS:
        banner(**b)

    print("--- banners com o rosto do Beto ---")
    achou = False
    for b in BANNERS_COM_FOTO:
        caminho = os.path.join(FOTOS, b.pop("arquivo"))
        if os.path.exists(caminho):
            achou = True
            banner(foto=caminho, **b)
    if not achou:
        print(f"  nenhuma foto encontrada em {FOTOS}")
        print("  coloque beto-01.jpg, beto-02.jpg e beto-03.jpg ali e rode de novo.")
