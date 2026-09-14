from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs" / "runbooks" / "assets" / "sales-guide"
FONT_PATH = Path("/Applications/MATLAB_R2025a.app/toolbox/shared/mlreportgen/dom/resources/fonts/NotoSansCJKjp-Regular.otf")

NAVY = "#17365D"
BLUE = "#2E74B5"
LIGHT = "#E8EEF5"
PALE = "#F5F8FC"
INK = "#172033"
MUTED = "#5B6575"
GREEN = "#2F7D4A"
GREEN_LIGHT = "#E8F5EC"
AMBER = "#A06A00"
AMBER_LIGHT = "#FFF4CE"
WHITE = "#FFFFFF"
LINE = "#D5DFEA"


def font(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT_PATH), size=size)


def wrap(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    lines: list[str] = []
    for explicit_line in text.split("\n"):
        current = ""
        for ch in explicit_line:
            candidate = current + ch
            if current and draw.textbbox((0, 0), candidate, font=fnt)[2] > max_width:
                lines.append(current)
                current = ch
            else:
                current = candidate
        if current:
            lines.append(current)
    return lines


def center_text(draw, box, text, fnt, fill=INK, spacing=8):
    x0, y0, x1, y1 = box
    lines = wrap(draw, text, fnt, x1 - x0 - 24)
    heights = [draw.textbbox((0, 0), line, font=fnt)[3] for line in lines]
    total = sum(heights) + spacing * max(0, len(lines) - 1)
    y = y0 + (y1 - y0 - total) / 2
    for line, h in zip(lines, heights):
        w = draw.textbbox((0, 0), line, font=fnt)[2]
        draw.text((x0 + (x1 - x0 - w) / 2, y), line, font=fnt, fill=fill)
        y += h + spacing


def header(draw, kicker, title, subtitle=""):
    draw.text((90, 56), kicker, font=font(28), fill=BLUE)
    draw.text((90, 104), title, font=font(52), fill=NAVY)
    if subtitle:
        draw.text((92, 176), subtitle, font=font(27), fill=MUTED)


def arrow(draw, start, end, color=BLUE, width=8):
    draw.line([start, end], fill=color, width=width)
    x, y = end
    draw.polygon([(x, y), (x - 24, y - 14), (x - 24, y + 14)], fill=color)


def save(img: Image.Image, name: str):
    OUT.mkdir(parents=True, exist_ok=True)
    img.save(OUT / name, optimize=True)


def role_overview():
    img = Image.new("RGB", (1600, 900), WHITE)
    d = ImageDraw.Draw(img)
    header(d, "一张图先看懂", "销售不是只拉客，也不是只回消息", "一个销售，从认识客户一直跟到成交和售后")

    center = (800, 510)
    d.ellipse((650, 360, 950, 660), fill=NAVY)
    center_text(d, (670, 395, 930, 625), "销售\n客户总负责人", font(34), WHITE, 12)

    cards = [
        ((90, 330, 500, 520), "线下拉客", "拜访、介绍、扫码绑定", AMBER_LIGHT, AMBER),
        ((1100, 330, 1510, 520), "线上聊天", "答问题、问需求、推下一步", LIGHT, BLUE),
        ((355, 680, 765, 850), "成交跟进", "报价、异议、下单", GREEN_LIGHT, GREEN),
        ((835, 680, 1245, 850), "交付售后", "订单、物流、问题协调", PALE, NAVY),
    ]
    for box, title, subtitle, fill, accent in cards:
        d.rounded_rectangle(box, radius=28, fill=fill, outline=accent, width=3)
        x0, y0, x1, y1 = box
        center_text(d, (x0 + 20, y0 + 18, x1 - 20, y0 + 88), title, font(36), accent)
        center_text(d, (x0 + 20, y0 + 82, x1 - 20, y1 - 16), subtitle, font(27), INK)

    arrow(d, (500, 425), (650, 470), AMBER)
    arrow(d, (1100, 425), (950, 470), BLUE)
    arrow(d, (685, 680), (730, 640), GREEN)
    arrow(d, (915, 680), (870, 640), NAVY)
    save(img, "01-sales-role-overview.png")


def offline_flow():
    img = Image.new("RGB", (1600, 900), WHITE)
    d = ImageDraw.Draw(img)
    header(d, "线下怎么拉客", "别只让客户扫个码就走", "现场至少做完：问需求、登录绑定、约好下一步")

    steps = [
        ("1", "先聊天", "问现在怎么买、哪里麻烦"),
        ("2", "问清需求", "商品、规格、数量、时间"),
        ("3", "给个方向", "介绍合适商品和服务"),
        ("4", "客户扫码", "用你的专属二维码"),
        ("5", "完成登录", "只扫码不登录不算绑定"),
        ("6", "约下一步", "报价、样品或下次拜访"),
    ]
    x = 75
    for i, (num, title, detail) in enumerate(steps):
        box = (x, 330, x + 225, 650)
        d.rounded_rectangle(box, radius=24, fill=PALE if i % 2 == 0 else LIGHT, outline=LINE, width=3)
        d.ellipse((x + 73, 355, x + 153, 435), fill=BLUE)
        center_text(d, (x + 73, 355, x + 153, 435), num, font(36), WHITE)
        center_text(d, (x + 16, 455, x + 209, 525), title, font(32), NAVY)
        center_text(d, (x + 18, 525, x + 207, 625), detail, font(24), INK)
        if i < len(steps) - 1:
            arrow(d, (x + 225, 490), (x + 250, 490), BLUE, 5)
        x += 250

    d.rounded_rectangle((270, 720, 1330, 830), radius=24, fill=AMBER_LIGHT)
    center_text(d, (295, 730, 1305, 820), "记住：客户扫完码，还要授权手机号并登录；最后一定说清楚你什么时候再联系。", font(29), AMBER)
    save(img, "02-offline-acquisition-flow.png")


def online_chat():
    img = Image.new("RGB", (1600, 900), WHITE)
    d = ImageDraw.Draw(img)
    header(d, "线上消息怎么回", "别只说“收到”“稍等”", "每次回复都要给客户一个答案、一个动作，或者一个明确时间")

    phone = (95, 260, 760, 840)
    d.rounded_rectangle(phone, radius=45, fill=PALE, outline=NAVY, width=5)
    d.rounded_rectangle((270, 275, 585, 300), radius=10, fill=NAVY)

    bubbles = [
        ((135, 340, 520, 430), "客户：这个螺丝有 M8×40 吗？", WHITE, INK),
        ((300, 455, 715, 575), "销售：有的。我再确认一下材质、数量和希望到货时间，避免给您配错。", LIGHT, NAVY),
        ((135, 600, 520, 690), "客户：304，不锈钢，500 个。", WHITE, INK),
        ((300, 715, 715, 815), "销售：收到。我在今天 16:00 前把价格和交期发给您。", GREEN_LIGHT, GREEN),
    ]
    for box, text, fill, color in bubbles:
        d.rounded_rectangle(box, radius=24, fill=fill, outline=LINE, width=2)
        center_text(d, (box[0] + 18, box[1] + 10, box[2] - 18, box[3] - 10), text, font(24), color)

    rules = [
        ("① 先确认你理解的问题", "复述客户要什么"),
        ("② 把缺的信息问全", "规格、数量、时间、地点"),
        ("③ 能答就直接答", "不能答就说清楚去核对什么"),
        ("④ 给一个明确时间", "什么时候报价、什么时候更新"),
        ("⑤ 记下下一步", "别等客户再次催你"),
    ]
    y = 280
    for title, detail in rules:
        d.rounded_rectangle((840, y, 1510, y + 100), radius=22, fill=WHITE, outline=LINE, width=3)
        d.text((875, y + 15), title, font=font(29), fill=NAVY)
        d.text((875, y + 57), detail, font=font(23), fill=MUTED)
        y += 115
    save(img, "03-online-chat-guide.png")


def pipeline():
    img = Image.new("RGB", (1600, 900), WHITE)
    d = ImageDraw.Draw(img)
    header(d, "客户怎么一直跟", "每个客户都要有“现在到哪一步”和“下一步什么时候”", "没有下一步的客户，最容易被忘掉")

    stages = [
        ("新线索", "刚扫码/刚认识", "先问基本需求"),
        ("需求明确", "规格数量清楚", "核价、推荐商品"),
        ("已报价", "等客户决定", "围绕异议跟进"),
        ("重点机会", "时间明确、可能成交", "优先协调资源"),
        ("已成交", "已经下单", "盯交付和复购"),
        ("暂缓/失单", "延期或拒绝", "记原因和再联系条件"),
    ]
    colors = [LIGHT, "#DCEAF7", "#CDE3F5", AMBER_LIGHT, GREEN_LIGHT, PALE]
    x = 85
    widths = [1430, 1430, 1430, 1430, 1430, 1430]
    for i, ((title, status, action), width) in enumerate(zip(stages, widths)):
        y0 = 270 + i * 92
        d.rounded_rectangle((x, y0, x + width, y0 + 75), radius=20, fill=colors[i], outline=LINE, width=2)
        d.text((x + 30, y0 + 17), title, font=font(30), fill=NAVY)
        d.text((x + 285, y0 + 19), status, font=font(25), fill=INK)
        action_x = x + 1020
        d.text((action_x, y0 + 19), action, font=font(24), fill=GREEN if i == 4 else BLUE)

    d.rounded_rectangle((1040, 770, 1515, 855), radius=22, fill=NAVY)
    center_text(d, (1060, 780, 1495, 845), "每次聊完：写下下一步和时间", font(26), WHITE)
    save(img, "04-customer-followup-pipeline.png")


if __name__ == "__main__":
    role_overview()
    offline_flow()
    online_chat()
    pipeline()
    print(OUT)
