"""Generate high-fidelity One-Page A4 PDF of /pricing-onepage.html.
Uses zero @page margin from the HTML itself (already A4-sized), so we
tell Chromium NOT to add any margin and force a single page.
"""
from playwright.sync_api import sync_playwright
import os

URL = os.environ.get("PDEX_URL", "http://localhost:3000") + "/pricing-onepage.html"
OUT = "/app/frontend/public/downloads/PDEX-Pricing.pdf"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 794, "height": 1123}, device_scale_factor=2)
    page = ctx.new_page()
    page.goto(URL, wait_until="networkidle", timeout=60000)
    # Wait for fonts
    page.evaluate("document.fonts.ready")
    page.wait_for_timeout(800)
    page.pdf(
        path=OUT,
        format="A4",
        print_background=True,
        prefer_css_page_size=True,
        margin={"top": "0", "bottom": "0", "left": "0", "right": "0"},
        page_ranges="1",
    )
    browser.close()
print(f"WROTE {OUT} size={os.path.getsize(OUT)}")
