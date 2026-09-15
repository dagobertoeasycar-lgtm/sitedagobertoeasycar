# -*- coding: utf-8 -*-
"""Artes da AutoDrive para o WhatsApp (capa e foto de perfil).

Nao fazem parte do site: saem numa pasta fora do repositorio, porque sao
material para o Beto subir no app. O gerador fica versionado aqui para
poder refazer sem depender de editor de imagem.

Uso:  python gerar_whatsapp.py
Saida: D:\\sitedagobertoeasycar\\_artes-whatsapp\\
"""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

AQUI    = os.path.dirname(os.path.abspath(__file__))
SIMBOLO = r"D:\Sistema de avisos\IMJ\03_simbolo_carro_AD_original_teal.png"
SAIDA   = r"D:\sitedagobertoeasycar\_artes-whatsapp"

TEAL        = (1, 168, 176)
TEAL_ESCURO = (10, 125, 135)
NAVY        = (7, 17, 31)
BRANCO      = (255, 255, 255)
CINZA       = (176, 195, 208)

F = lambda nome, tam: ImageFont.truetype(os.path.join(r"C:\Windows\Fonts", nome), tam)
BLACK  = lambda t: F("ariblk.ttf", t)
BOLD   = lambda t: F("arialbd.ttf", t)


def simbolo(altura, cor=TEAL):
    """Recorta o carro+AD do PNG de fundo branco, com alfa de verdade.

    Cada pixel e uma mistura a*TEAL + (1-a)*BRANCO; o canal vermelho
    separa bem as pontas (teal R=1, branco R=255), entao da para recuperar
    o alfa exato e repintar com a cor pedida. Sem isso sobra franja clara
    quando a arte vai para fundo escuro.
    """
    im = Image.open(SIMBOLO).convert("RGB")
    px = im.load()
    w, h = im.size
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    op = out.load()
    for y in range(h):
        for x in range(w):
            r, _, _ = px[x, y]
            a = round((255 - r) * 255 / (255 - TEAL[0]))
            if a > 4:
                op[x, y] = cor + (min(255, a),)
    out = out.crop(out.getbbox())
    prop = altura / out.height
    return out.resize((round(out.width * prop), altura), Image.LANCZOS)


def fundo(W, H):
    """Gradiente diagonal navy -> teal escuro, com brilho e faixas de luz."""
    grad = Image.new("RGB", (W, H))
    px = grad.load()
    for y in range(H):
        for x in range(0, W, 3):
            t = (x / W) * 0.7 + (y / H) * 0.3
            c = tuple(int(NAVY[i] + (TEAL_ESCURO[i] - NAVY[i]) * t) for i in range(3))
            for k in range(3):
                if x + k < W:
                    px[x + k, y] = c
    base = grad.convert("RGBA")

    luz = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(luz)
    for x0, esp, op_ in ((-int(W * 0.18), 3, 80), (-int(W * 0.06), 2, 55), (int(W * 0.66), 2, 45)):
        d.line([(x0, H + H // 4), (x0 + int(W * 0.5), -H // 4)], fill=TEAL + (op_,), width=esp)
    base = Image.alpha_composite(base, luz.filter(ImageFilter.GaussianBlur(1.3)))

    brilho = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(brilho).ellipse(
        [int(W * 0.52), -H // 2, int(W * 1.25), int(H * 1.5)], fill=TEAL + (44,))
    base = Image.alpha_composite(base, brilho.filter(ImageFilter.GaussianBlur(int(H * 0.22))))
    return base.convert("RGB")


def tracking(d, xy, texto, fonte, cor, esp, centro=None):
    """Texto com espacamento entre letras. Se centro vier, centraliza em x."""
    larg = sum(d.textlength(c, font=fonte) for c in texto) + esp * (len(texto) - 1)
    x, y = xy
    if centro is not None:
        x = centro - larg / 2
    for c in texto:
        d.text((x, y), c, font=fonte, fill=cor, anchor="ls")
        x += d.textlength(c, font=fonte) + esp
    return larg


def capa(nome, W, H):
    """Capa larga. O conteudo fica numa zona central segura, porque o
    WhatsApp corta a capa de forma diferente conforme a versao do app."""
    img = fundo(W, H)
    d = ImageDraw.Draw(img)
    cx = W // 2

    # O simbolo e largo (quase 2,7:1), entao simbolo + "AUTODRIVE" estoura
    # facil a largura. Aqui o par encolhe junto ate caber na zona segura,
    # em vez de sair cortado nas beiradas.
    ZONA = W * 0.86
    escala = 1.0
    while escala > 0.4:
        sim = simbolo(int(H * 0.30 * escala))
        t_principal = BLACK(max(12, int(H * 0.175 * escala)))
        folga = int(W * 0.028 * escala)
        bloco = sim.width + folga + d.textlength("AUTODRIVE", font=t_principal)
        if bloco <= ZONA:
            break
        escala -= 0.04
    t_secundario = BOLD(int(H * 0.062))
    x0 = cx - bloco / 2
    meio = int(H * 0.46)

    img.paste(sim, (int(x0), meio - sim.height // 2 - int(H * 0.02)), sim)
    d.text((x0 + sim.width + folga, meio + int(H * 0.055)),
           "AUTODRIVE", font=t_principal, fill=BRANCO, anchor="ls")

    tracking(d, (0, int(H * 0.70)), "AUTOMÓVEIS", t_secundario, TEAL,
             esp=int(W * 0.011), centro=cx)

    linha = BOLD(int(H * 0.045))
    d.text((cx, int(H * 0.845)),
           "Vários parceiros  ·  Negociação fácil e rápida",
           font=linha, fill=CINZA, anchor="ms")

    os.makedirs(SAIDA, exist_ok=True)
    destino = os.path.join(SAIDA, nome)
    img.save(destino, "JPEG", quality=90, optimize=True)
    print(f"{nome:34s} {W}x{H}  {os.path.getsize(destino)/1024:5.0f} KB")


def perfil(nome, L=1000):
    """Foto de perfil. Aparece pequena e recortada em circulo, entao so
    simbolo e o nome, tudo dentro do circulo inscrito."""
    img = fundo(L, L)
    d = ImageDraw.Draw(img)
    cx = L // 2

    sim = simbolo(int(L * 0.30))
    img.paste(sim, (cx - sim.width // 2, int(L * 0.24)), sim)

    d.text((cx, int(L * 0.655)), "AUTODRIVE", font=BLACK(int(L * 0.125)),
           fill=BRANCO, anchor="ms")
    tracking(d, (0, int(L * 0.745)), "AUTOMÓVEIS", BOLD(int(L * 0.052)),
             TEAL, esp=int(L * 0.012), centro=cx)

    os.makedirs(SAIDA, exist_ok=True)
    destino = os.path.join(SAIDA, nome)
    img.save(destino, "JPEG", quality=92, optimize=True)
    print(f"{nome:34s} {L}x{L}  {os.path.getsize(destino)/1024:5.0f} KB")


if __name__ == "__main__":
    capa("capa-whatsapp.jpg", 1640, 856)          # 1,91:1, o corte padrao da Meta
    capa("capa-whatsapp-larga.jpg", 1920, 640)    # 3:1, para app que corta mais fino
    perfil("perfil-whatsapp.jpg")
    print("\nsaida em:", SAIDA)
