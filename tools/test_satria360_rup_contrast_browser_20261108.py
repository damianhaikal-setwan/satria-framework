"""Cek kontras warna nomor RUP pada kartu SATRIA 360 dalam kedua tema."""
from pathlib import Path
import re

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "index.html").read_text(encoding="utf-8")
CSS_PATHS = re.findall(r'<link\s+rel="stylesheet"\s+href="(\./[^"]+)"', HTML)
CSS = "\n".join((ROOT / path.removeprefix("./")).read_text(encoding="utf-8") for path in CSS_PATHS)
# Jangan memanggil layanan font eksternal saat tes berjalan.
CSS = re.sub(r'@import\s+url\([^;]+;', '', CSS)


def rgb_hex(rgb):
    values = [int(v.strip()) for v in rgb.removeprefix("rgb(").removesuffix(")").split(",")]
    return "#" + "".join(f"{part:02x}" for part in values)


def contrast(foreground, background):
    def luminance(color):
        values = [int(color[i:i+2], 16) / 255 for i in (1, 3, 5)]
        linear = [v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in values]
        return sum(weight * value for weight, value in zip((0.2126, 0.7152, 0.0722), linear))

    lighter, darker = sorted((luminance(foreground), luminance(background)), reverse=True)
    return (lighter + 0.05) / (darker + 0.05)


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(
        headless=True,
        executable_path="/usr/bin/chromium",
        args=["--no-sandbox", "--disable-dev-shm-usage"],
    )
    page = browser.new_page()
    page.route("**/*", lambda route: route.abort())
    # CSS dari index.html digunakan sesuai urutan aplikasi sesungguhnya.
    # Tidak membutuhkan data pribadi, autentikasi, atau jaringan.
    page.set_content(
        '<!doctype html><html data-theme="light"><head><style>' + CSS + '</style></head>'
        '<body><div id="main"><div class="s4-main-360">'
        '<div class="s4-hero"><div class="s4-kicker">SATRIA 360°</div></div>'
        '<div class="s4-panel"><div class="s4-rowcard"><div>'
        '<div class="s4-kicker">RUP 65859208</div>'
        '<h4>Pemenang belum ditetapkan valid</h4>'
        '</div></div></div></div></div></body></html>'
    )
    assert len(CSS_PATHS) >= 20, "Stylesheet aplikasi belum lengkap"
    for theme, expected_color in (("light", "#4338ca"), ("dark", "#d9f99d")):
        page.locator("html").evaluate("(el, value) => el.setAttribute('data-theme', value)", theme)
        colors = page.evaluate("""() => {
          const card = document.querySelector('.s4-rowcard');
          return {
            text: getComputedStyle(card.querySelector('.s4-kicker')).color,
            card: getComputedStyle(card).backgroundColor,
            hero: getComputedStyle(document.querySelector('.s4-hero .s4-kicker')).color
          };
        }""")
        text, bg = rgb_hex(colors["text"]), rgb_hex(colors["card"])
        ratio = contrast(text, bg)
        assert text == expected_color, (theme, colors)
        assert ratio >= 4.5, (theme, ratio, colors)
        assert rgb_hex(colors["hero"]) == "#bef264", (theme, colors)
        print(f"PASS {theme}: RUP {text} / latar {bg} = {ratio:.2f}:1; header tidak berubah")
    browser.close()
