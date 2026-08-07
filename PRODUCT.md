# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Solo founders and very small startup teams (including single-person use on personal projects). Users organize work into workspaces containing boards, lists, and cards — the core job is tracking and moving project work through stages, alone or with a small team.

## Product Purpose

Taskmaster is a Trello-style task and board management app: workspaces with members, boards, lists (columns), and cards, supporting labels, checklists, attachments, comments/activity, custom fields, and invitations. It is a personal/learning project (not positioned as a competitive alternative to Trello/Asana), built to demonstrate full-stack product craft.

## Positioning

No competitive differentiation claim is asserted (personal/learning project, confirmed by user). Planned direction: AI-enhanced task/project management aimed at solo founders and small teams — the specific AI capabilities are not yet defined (see Capabilities and Constraints).

## Operating Context

Multi-user, workspace-based: users create/join workspaces, invite members with roles (admin/member/guest), and collaborate on boards within a workspace. Auth via Supabase (Google OAuth, incl. Google One Tap). Real-time collaboration is present in the codebase (recent work on live member/card updates via caching and store updates).

## Capabilities and Constraints

Confirmed (from existing code): workspaces, workspace members/roles, boards, lists, cards, labels, checklists, attachments, custom fields, comments/activity, voting, notifications, invitations, templates, search (boards/cards/workspaces), starred boards, board recents. Supabase Postgres with Row Level Security as the data/security model.

Undecided / explicitly open: the "AI enhancements" direction mentioned by the user is a stated future intent, not yet scoped — no specific AI features are confirmed. Do not invent AI feature specifics; treat as an open capability until the user defines it.

## Brand Commitments

Name "Taskmaster" is confirmed and kept. No logo, palette, or visual identity is locked in — current shadcn-style neutral theme (CSS variable tokens in `app/globals.css`, `tailwind.config.js`) is a placeholder, fully open for a future design pass.

## Evidence on Hand

No real user content, testimonials, case studies, or demo data found. `project details/functionality.txt` and `project details/database_structure.txt` document the intended feature set and schema — treat as internal spec, not user-facing evidence. Future design work must not fabricate testimonials, customer logos, or usage metrics.

## Product Principles

- Solo-friendly by default: features must work well for a single user, not just teams.
- Workspace/board/list/card is the durable mental model; do not introduce competing organizational concepts without cause.
- Real-time collaboration (live updates across members) is a core expectation, not a nice-to-have.
- Personal/learning project: prioritize craft and clarity over competitive feature-parity claims.
- Any AI-enhanced capability must earn its place with a clear, concrete job — no generic "AI-powered" framing.

## Accessibility & Inclusion

No product-specific accessibility requirement established yet.
