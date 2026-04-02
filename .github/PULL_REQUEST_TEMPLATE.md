# PR Checklist

## Summary
- What changed and why?

## Validation
- [ ] Admin image upload/edit flow tested (upload -> mode switch -> save -> reopen)
- [ ] Image metadata tested (`alt`, `caption`, `align`, `width`)
- [ ] Cover metadata tested (`coverImage`, `coverAlt`)
- [ ] Publish-time image alt fallback tested (draft vs publish)
- [ ] giscus only renders on post detail page
- [ ] Login/view endpoint rate-limit behavior validated

## README Sync (Required)
- [ ] I updated `README.md` feature tables for this PR.
- [ ] I reflected changes under:
  - `현재 동작 기능`
  - `제거됨`
  - `다음 이관 대상`
- [ ] If no feature behavior changed, I explicitly confirmed why README update is not needed.
