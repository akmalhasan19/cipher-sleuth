# Baseline & Foundation Notes

- Branch: `main`
- Baseline checks run before major logic refactor:
  - `npm run lint` (no errors, warnings only)
  - `npm run build` (success)

## Notes

- Lint-blocking errors in `app/components/reviews-section.tsx` were fixed.
- Remaining lint output consists of non-blocking Next.js image optimization warnings (`<img>` usage).
- Modular foundation folders are now in place under:
  - `app/lib/validation`
  - `app/lib/agents`
  - `app/lib/scoring`
  - `app/lib/report`
  - `app/lib/db`