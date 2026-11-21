# UX and accessibility

- Every page answers: who uses it, why they came, the primary action. No generic template UI.
- Hit targets ≥ 4.4rem for icon-only and touch actions; give text links padding.
- Semantic HTML, labels for every field, visible focus, keyboard operable, sufficient contrast, reduced motion.
- No browser-native validation (`noValidate`); explicit accessible error messages.
- Loading → skeleton shaped like the final content; never blank or flash an empty state before data.
- Skeletons are mandatory for any data that can load slowly or switch: pagination, tabs, filters, search, refetch (react-query `isFetching`/`isPlaceholderData`). Show them during every switch, not only the first load, and keep the same layout (fixed columns, same row count and heights) so nothing jumps.
- Destructive → `ConfirmDialog`. Success/failure feedback → Toast.
- Dialogs with a form focus the first editable field immediately.
- Never remount/re-key a control the user is typing in; keep inputs local/uncontrolled; debounce URL-driven updates.
- Hide complexity: simple workflows first; UI and UX designed together, not CRUD first and pretty later.
- Check mobile (360px) and keyboard for every new screen; look at the rendered page.
