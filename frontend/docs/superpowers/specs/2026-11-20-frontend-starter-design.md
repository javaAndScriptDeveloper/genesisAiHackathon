# Frontend starter for the hackathon: design

Status: approved by the user in conversation (2026-11-20). Size: project, short design.

## Intent
A ready frontend base to prepare before the hackathon. Brief and backend are unknown, so the base must be quick to adapt and keep quality high with agents working autonomously (Claude and Codex/GPT).

## Goals
- Latest Next.js + React (App Router, TypeScript strict), SCSS Modules, no Tailwind.
- Design language: minimal, in the spirit of nextjs.org / Notion / Linear. Strong defaults: tokens, typography, resets, scrollbars, focus states, reduced motion.
- Own implementations of minimal UI components (Button, Input, Textarea, Select/Dropdown, Table, Checkbox, Modal/ConfirmDialog, Tooltip, Badge, Tabs, Toast, Skeleton, Pagination, Carousel wrapper on Swiper). Visible from a `/ui-kit` page.
- Libraries: Swiper, Hugeicons (primary icons), Zod, react-hook-form, TanStack Query, sharp.
- Fonts via `next/font`: Inter (body), Unbounded (H1/display), Montserrat, Poppins (alternates), plus a Cyrillic subset.
- Corners: `corners.radius` / `corners.nested` mixins (squircle with fallback).
- Images: WebP, @2x when possible, via `next/image`; a script to convert sources.
- Mock API layer (typed, swappable for a real backend) and server-side utilities for Gemini API and Claude API.
- Agent context: AGENTS.md + CLAUDE.md split into short parts (docs/ and skills in `.claude/skills` and `.agents/skills`), including frontend quality rules. Superpowers installed for Claude and Codex.
- UI is always one light theme, no theme switch. Ukrainian only; messages kept in `messages/uk.json` structure, no language switcher.

## Non-goals
- No git init, no deploy setup, no theme switcher, no locale switcher, no admin/CRM/3D from VEZHOR.
- No project-wide builds beyond what verifies the starter itself.

## Approaches
1. Copy VEZHOR wholesale: fast, but carries domain code and rigid rules. Rejected by the user.
2. Use VEZHOR, hub-next, bc-new and LIF as references; write fresh, smaller implementations. Chosen.
3. Tailwind/shadcn base: conflicts with existing house rules. Rejected.

## Decisions
- Chosen: approach 2. Rules are inspired by VEZHOR's AGENTS.md (UX safety targets, skeletons, no emoji icons, no native validation, custom confirm dialogs), trimmed to what applies.
- Package manager: bun (my call; matches bc-new). Versions: latest stable at install time.
- API keys only in `.env.local`, used server-side; `.env.example` lists them.

## Left to the builder
Exact component APIs, token values, file naming details, and the contents of each agent skill, following the rules above.
