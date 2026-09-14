from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
ASSET_DIR = ROOT / "docs" / "runbooks" / "assets" / "sales-screenshots"


def crop_image(source: str, target: str, box: tuple[int, int, int, int]) -> None:
    with Image.open(ASSET_DIR / source) as image:
        image.convert("RGB").crop(box).save(ASSET_DIR / target, format="PNG", optimize=True)


if __name__ == "__main__":
    # WeChat DevTools: retain only the phone simulator containing the miniapp chat.
    crop_image("06-miniapp-chat-full.png", "06-miniapp-chat.png", (42, 72, 335, 680))
    # Safari: retain the admin page content and remove browser chrome/tabs.
    crop_image("07-admin-chat-full.png", "07-admin-chat.png", (210, 72, 1218, 765))
    print(ASSET_DIR)
