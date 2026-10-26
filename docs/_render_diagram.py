from PIL import Image, ImageDraw, ImageFont

S = 2  # render at 2x and downsample for crisp printed output
W, H = 760 * S, 820 * S
img = Image.new("RGB", (W, H), "white")
d = ImageDraw.Draw(img)

FONT_DIR = r"C:\Windows\Fonts"
REG = f"{FONT_DIR}\\segoeui.ttf"
SEMI = f"{FONT_DIR}\\seguisb.ttf"
BOLD = f"{FONT_DIR}\\segoeuib.ttf"


def font(path, size):
    return ImageFont.truetype(path, size * S)


def box(x, y, w, h, fill, outline):
    d.rounded_rectangle(
        [x * S, y * S, (x + w) * S, (y + h) * S],
        radius=4 * S,
        fill=fill,
        outline=outline,
        width=max(1, int(1.5 * S)),
    )


def center(text, cx, y, fnt, fill):
    bbox = d.textbbox((0, 0), text, font=fnt)
    tw = bbox[2] - bbox[0]
    d.text(((cx * S) - tw / 2, y * S), text, font=fnt, fill=fill)


def arrow(x, y_from, y_to):
    x *= S
    d.line([(x, y_from * S), (x, y_to * S)], fill="#222222", width=int(2.2 * S))
    tip = [(x, (y_to - 12) * S), (x - 6 * S, (y_to - 1) * S), (x + 6 * S, (y_to - 1) * S)]
    d.polygon(tip, fill="#222222")


# System
box(230, 20, 300, 88, "#1f74bd", "#155a94")
center("MINDPULSE", 380, 50, font(BOLD, 27), "white")

# Backend
arrow(380, 190, 112)
box(160, 190, 440, 132, "#f6d5c6", "#cf9d86")
center("BACKEND", 380, 205, font(BOLD, 20), "#a93226")
for text, y in [
    ("• API Endpoints", 245),
    ("• Video-Session & Emotion Logic", 272),
]:
    center(text, 380, y, font(SEMI, 17), "#222222")
center("Django REST · APITestCase · unittest.mock", 380, 300, font(REG, 13), "#5b4b45")

# Web
arrow(380, 400, 322)
box(160, 400, 440, 160, "#fdf3c4", "#d8c56f")
center("WEB FRONTEND", 380, 416, font(BOLD, 20), "#b7950b")
for text, y in [
    ("• React Components (Admin)", 457),
    ("• React Components (Doctor)", 484),
    ("• Form Validation & Service Modules", 511),
]:
    center(text, 380, y, font(SEMI, 17), "#222222")
center("Jest · React Testing Library · jest-dom", 380, 538, font(REG, 13), "#5f5730")

# Mobile
arrow(380, 630, 560)
box(160, 630, 440, 160, "#d5e8d0", "#8fbd82")
center("MOBILE FRONTEND", 380, 646, font(BOLD, 20), "#2e7d32")
for text, y in [
    ("• Patient & Doctor Screens", 687),
    ("• Assessment, MindPlant & Timer Logic", 714),
    ("• State & Persistence (mocked storage)", 741),
]:
    center(text, 380, y, font(SEMI, 17), "#222222")
center("Jest · @react-native/jest-preset · AsyncStorage mock", 380, 768, font(REG, 13), "#345b35")

# Downsample for print
img = img.resize((760, 820), Image.LANCZOS)
img.save("unit-testing-diagram.png", "PNG")
print("wrote unit-testing-diagram.png")
