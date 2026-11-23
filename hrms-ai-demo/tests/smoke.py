"""Smoke test for the public concept demo; requires Playwright and Chromium."""
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
    b=p.chromium.launch(headless=True)
    page=b.new_page()
    errs=[]
    page.on("pageerror",lambda e:errs.append(str(e)))
    page.set_content((root/"index.html").read_text())
    page.add_style_tag(content=(root/"styles.css").read_text())
    page.add_script_tag(content=(root/"app.js").read_text())
    assert page.locator("#scenario").input_value()=="data"
    page.locator('.step-nav[data-step="applicants"]').click()
    assert page.locator("#applicantCount").inner_text()=="3"
    page.locator("#openSelectedBrief").click()
    assert page.locator("#briefQuestions li").count()==3
    page.locator('.step-nav[data-step="pipeline"]').click()
    page.locator('[data-stage-candidate="a"]').select_option("Invite to interview")
    page.locator('.step-nav[data-step="portal"]').click()
    assert page.locator("#portalStatus").inner_text()=="Interview invited"
    assert not errs,errs
    b.close()
print("PASS")
