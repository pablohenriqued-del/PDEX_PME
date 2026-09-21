"""Generate high-fidelity PDF of /pricing.html via Playwright's Chromium PDF engine."""
from playwright.sync_api import sync_playwright
import os, sys

URL = os.environ.get("PDEX_URL", "http://localhost:3000") + "/pricing.html"
OUT = "/app/frontend/public/downloads/PDEX-Pricing.pdf"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 1280, "height": 1800}, device_scale_factor=2)
    page = ctx.new_page()
    page.goto(URL, wait_until="networkidle", timeout=60000)
    page.emulate_media(media="print")
    page.wait_for_timeout(1200)
    page.pdf(
        path=OUT,
        format="A4",
        print_background=True,
        prefer_css_page_size=True,
        margin={"top": "8mm", "bottom": "8mm", "left": "8mm", "right": "8mm"},
    )
    browser.close()
print(f"WROTE {OUT} size={os.path.getsize(OUT)}")
