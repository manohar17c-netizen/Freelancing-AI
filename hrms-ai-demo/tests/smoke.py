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
    assert page.locator("#companyName").input_value() == "Nexcruit"
    for scenario in ("product", "sales", "data"):
        page.locator("#scenario").select_option(scenario)
        assert page.locator("#companyName").input_value() == "Nexcruit"
    page.locator("#startTour").click()
    assert page.locator("#tourTitle").inner_text() == "Guided demo · 1 of 8"
    page.locator("#nextStep").click()
    assert "Adjust a skill weight" in page.locator("#tourHint").inner_text()
    page.locator("#nextStep").click()
    assert page.locator("#applicantCount").inner_text()=="3"
    page.locator("#openSelectedBrief").click()
    assert page.locator("#briefQuestions li").count()==3
    assert "weighted average" in page.locator("#briefRationale").inner_text()
    assert page.locator("#briefGaps li").count() == 5
    page.locator('#nextStep').click()
    page.locator('[data-stage-candidate="a"]').select_option("Invite to interview")
    page.locator("#interviewSlot").select_option("Tuesday at 10:00 UTC")
    page.get_by_role("button", name="Save sample booking").click()
    page.locator("#nextStep").click()
    assert page.locator("#portalStatus").inner_text()=="Interview invited"
    assert "Tuesday at 10:00 UTC" in page.locator("#portalInterview").inner_text()
    assert page.locator("#tourTitle").inner_text() == "Guided demo · 6 of 8"
    page.locator("#exitTour").click()
    assert page.locator("#tourPanel").is_hidden()
    page.locator('.step-nav[data-step="pipeline"]').click()
    page.locator('[data-stage-candidate="a"]').select_option("On hold")
    page.locator('.step-nav[data-step="portal"]').click()
    assert page.locator("#portalInterview").is_hidden()
    page.locator('.step-nav[data-step="onboarding"]').click()
    assert page.locator("#onboardingEmployee").is_hidden()
    page.locator('.step-nav[data-step="pipeline"]').click()
    page.locator('[data-stage-candidate="a"]').select_option("Hired")
    page.locator('.step-nav[data-step="onboarding"]').click()
    page.locator("#onboardingTasks input").first.check()
    assert page.locator("#onboardingProgress").inner_text() == "1 of 3 tasks complete"
    page.locator("#nextStep").click()
    assert page.locator("#employeeGoal").input_value() == "Improve platform reliability and team execution"
    page.locator("#goalStatus").select_option("On track")
    page.locator("#checkinFeedback").fill("Reviewed the sample reliability plan.")
    page.get_by_role("button", name="Save check-in").click()
    assert "Reviewed the sample reliability plan." in page.locator("#checkinHistory").inner_text()
    page.locator("#resetDemo").click()
    page.locator('.step-nav[data-step="performance"]').click()
    assert page.locator("#performanceEmployee").is_hidden()
    assert not errs,errs
    b.close()
print("PASS")
