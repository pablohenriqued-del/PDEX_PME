"""Render page 1 of the PDF as a JPEG so we can visually inspect."""
from playwright.sync_api import sync_playwright
import os
PDF = "/app/frontend/public/downloads/PDEX-Pricing.pdf"
OUT = "/app/frontend/public/downloads/PDEX-Pricing-preview.jpg"
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    ctx = b.new_context(viewport={"width": 900, "height": 1300}, device_scale_factor=2)
    pg = ctx.new_page()
    pg.goto("file://" + PDF, wait_until="load")
    pg.wait_for_timeout(2000)
    pg.screenshot(path=OUT, quality=70, full_page=False, type="jpeg")
    b.close()
print(f"WROTE {OUT} size={os.path.getsize(OUT)}")
