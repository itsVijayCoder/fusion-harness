# Product Requirements Document: Developer Portfolio

**Version:** 0.9  
**Status:** Draft  
**Owner:** Architect / Engineering Lead  
**Date:** 2026-06-17  

## 1. Overview

Build a public, content-first **developer portfolio** that acts as the primary online presence for an individual software engineer. It must communicate who the developer is, what they have built, and how to contact them. The portfolio is a read-mostly marketing site with a lightweight contact flow.

### 1.1 Goal
Enable recruiters, hiring managers, peers, and potential clients to discover the developer’s work, assess relevant skills, and start a conversation within two minutes.

### 1.2 Target audience
| Segment | Primary need |
|---------|--------------|
| Recruiters / hiring managers | Quick skill match, resume download, contact CTA |
| Engineering peers | High-signal project write-ups, tooling choices |
| Potential clients | Case studies, proof of delivery, trust signals |

### 1.3 Success criteria
- Lighthouse score ≥ 95 for Performance, Accessibility, Best Practices, SEO.
- First Contentful Paint (FCP) < 1.2 s on simulated 4G.
- Time to Interactive (TTI) < 3 s.
- WCAG 2.1 AA compliant.
- Contact form reachable within one click from every page.
- Zero hard-coded biography strings inside components.

---

## 2. Functional Requirements

### 2.1 Core pages & sections
| ID | Page/section | Purpose |
|----|--------------|---------|
| F1 | **Home / Hero** | Name, role, one-line value prop, primary CTA, recent highlights |
| F2 | **Projects listing** | Filterable grid of case studies with tags, dates, thumbnails |
| F3 | **Project detail** | Long-form write-up: problem, solution, stack, outcomes, links, gallery |
| F4 | **Skills** | Grouped by category (languages, frameworks, platforms, practices) with proficiency metadata |
| F5 | **Experience** | Reverse-chronological roles, with optional logo, bullets, date ranges |
| F6 | **About / Bio** | Narrative bio, social links, downloadable résumé PDF |
| F7 | **Blog** (optional MVP) | MDX-powered posts for engineering write-ups; listing + detail pages |
| F8 | **Contact** | Form fields: name, email, subject, message; validation; success/error feedback |
| F9 | **404** | Branded not-found page with navigation home |
| F10 | **Theme toggle** | Light/dark/system mode persisted in `localStorage` |

### 2.2 Navigation & UX
- Persistent top nav on desktop, bottom-sheet/hamburger on mobile.
- Skip-to-content link for screen readers.
- Breadcrumbs only on deep pages (projects/blog detail) if IA tests show confusion.
- Every interactive element has visible focus states.
- `prefers-reduced-motion` respected for all animations.

### 2.3 Content management
- All prose, project metadata, skills, experience, and social links live in structured data files or MDX.
- No content is stored in components or props by default.
- Images are optimized at build time and referenced by relative paths.
- Résumé PDF is committed to `public/` and linked from About page.

---

## 3. Non-Functional Requirements

### 3.1 Performance
- Static site generation (SSG) with per-page pre-rendering.
- Static export capable; no runtime Node server required for the core site.
- Image optimization via framework-provided component (Next.js `Image` or equivalent).
- Lazy-loaded below-the-fold sections where measurable.
- Zero render-blocking third-party scripts on initial load.

### 3.2 Accessibility
- Semantic HTML5 landmarks (`<header>`, `<nav>`, `<main>`, `<footer>`).
- ARIA labels for icon-only controls.
- Keyboard-trappable mobile menu with ESC close.
- Color contrast ≥ 4.5:1 for body text, ≥ 3:1 for large text.
- Focus management on route change.

### 3.3 SEO
- Unique `<title>` and meta description per page.
- Open Graph / Twitter card metadata.
- Canonical URLs.
- `robots.txt` and XML sitemap generated at build time.
- JSON-LD `Person` schema on home page.
- JSON-LD `Article` schema on blog posts.

### 3.4 Maintainability
- Strict `tsconfig.json` with `strict: true`.
- ESLint + Prettier pre-commit hooks.
- Component co-location (colocated tests only if project adopts testing).
- Branch protection on `main`; PRs require build + lint checks.

### 3.5 Security / Privacy
- Contact form uses rate-limited serverless function or trusted third-party provider.
- No visitor analytics without documented, privacy-preserving provider (e.g., Plausible, Fathom, Vercel Analytics).
- No secrets committed to repository.
- `noopener noreferrer` on external links.

---

## 4. Technical Architecture

### 4.1 Proposed stack
| Layer | Technology | Rationale |
|-------|------------|-----------|
| Framework | **Next.js 15 (App Router)** | Static export, file-system routing, built-in Image/SEO primitives, broad hosting support |
| Language | **TypeScript** | Type safety for config-driven content |
| Styling | **Tailwind CSS 4** | Utility-first, small runtime, design-token friendly |
| UI kit | **shadcn/ui** over **Radix UI** primitives | Accessible, unstyled headless components |
| Animation | **Framer Motion** only where essential; otherwise CSS transitions | Bundle-size conscious |
| Content | **MDX** (for long-form), **JSON** (for structured data) | Non-technical contributors can edit without touching TSX |
| Icons | **Lucide React** | Consistent, tree-shakeable |
| Fonts | System font stack or self-hosted variable font | Zero third-party font requests |
| Deployment | **Vercel** (primary) or **Cloudflare Pages** / **Netlify** for static export | Cheap/free, edge CDN, branch previews |
| Form backend | **Next.js Route Handler** + **Resend** / **Web3Forms** fallback | Keeps egress within Vercel if needed |
| Testing | **Vitest** + **React Testing Library** + **Playwright** | Unit for data validation, E2E for flows |

### 4.2 High-level routing
```
/                       Home (Hero + highlights)
/projects               Projects listing
/projects/[slug]        Project detail
/skills                 Skills matrix
/experience             Experience timeline
/about                  About + résumé download
/blog                   Blog listing (optional)
/blog/[slug]            Blog post (optional)
/contact                Contact form
/404                    Not found
```

### 4.3 Data model
```ts
// src/lib/schema.ts
export interface Person {
  name: string;
  headline: string;
  bio: string;
  location: string;
  email: string;
  resumeUrl: string;
  socials: SocialLink[];
}

export interface Project {
  slug: string;
  title: string;
  summary: string;
  publishedAt: string;
  status: 'shipped' | 'in-progress' | 'experiment';
  tags: string[];
  links: { label: string; href: string }[];
  coverImage: string;
  mdxPath?: string;
}

export interface Experience {
  id: string;
  company: string;
  role: string;
  startDate: string;
  endDate?: string;
  description: string[];
  logo?: string;
}

export interface Skill {
  name: string;
  category: 'languages' | 'frameworks' | 'platforms' | 'practices';
  level?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
}

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  tags: string[];
  readingTime?: number;
}
```

### 4.4 Proposed file structure
```
dev-portfolio/
├── public/
│   ├── resume.pdf
│   ├── images/
│   │   ├── projects/
│   │   └── profile.
│   └── favicon.svg
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── projects/
│   │   │   ├── page.tsx
│   │   │   └── [slug]/page.tsx
│   │   ├── skills/page.tsx
│   │   ├── experience/page.tsx
│   │   ├── about/page.tsx
│   │   ├── contact/page.tsx
│   │   ├── blog/
│   │   │   ├── page.tsx
│   │   │   └── [slug]/page.tsx
│   │   └── api/contact/route.ts
│   ├── components/
│   │   ├── ui/             # shadcn-style primitives
│   │   ├── layout/         # Header, Footer, Nav, Container
│   │   ├── sections/       # Hero, ProjectsGrid, SkillsList, ExperienceTimeline
│   │   └── forms/          # ContactForm
│   ├── lib/
│   │   ├── schema.ts
│   │   ├── content.ts      # loaders for JSON/MDX
│   │   ├── utils.ts
│   │   └── seo.ts          # metadata helpers
│   ├── styles/
│   │   └── globals.css
│   ├── data/
│   │   ├── person.json
│   │   ├── projects.json
│   │   ├── experience.json
│   │   └── skills.json
│   └── content/
│       ├── projects/
│       │   └── project-a.mdx
│       └── posts/
│           └── hello-world.mdx
├── tests/
│   ├── unit/
│   └── e2e/
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── postcss.config.mjs
├── vitest.config.ts
├── playwright.config.ts
└── package.json
```

### 4.5 Content pipeline
1. **Authoring:** Edit `src/data/*.json` and `src/content/**/*.mdx`.
2. **Build-time loading:** `src/lib/content.ts` reads JSON and parses MDX frontmatter/body using `gray-matter` and `@next/mdx`.
3. **Static params:** `[slug]` pages call a loader function in `generateStaticParams()`.
4. **Validation:** Zod schemas validate JSON/MDX data at import time in development and during build.

---

## 5. Implementation Approach

### Phase 1 — Skeleton & config (2–3 days)
1. Bootstrap project: `npx create-next-app@latest --typescript --tailwind --app --src-dir`.
2. Set strict `tsconfig.json`, ESLint flat config, Prettier with `prettier-plugin-tailwindcss`.
3. Install dependencies: `shadcn` init, Radix primitives, `lucide-react`, `framer-motion`, `gray-matter`, `zod`, `next-mdx-remote` or `@next/mdx`, `vitest`, `@testing-library/react`, `playwright`.
4. Configure `next.config.js` for static export:
   ```js
   const nextConfig = {
     output: 'export',
     distDir: 'dist',
     images: { unoptimized: false },
   };
   module.exports = nextConfig;
   ```
5. Add base layout, Tailwind tokens, and CSS variables for light/dark themes.

### Phase 2 — Core pages & data layer (3–4 days)
1. Define Zod schemas and TypeScript interfaces.
2. Create sample data files and one MDX project/post.
3. Implement content loaders with async `generateStaticParams()`.
4. Build page-level components: Hero, Projects listing, Project detail, Skills, Experience, About, Contact shell.
5. Wire global metadata helper in `layout.tsx`.

### Phase 3 — Interactions & polish (2–3 days)
1. Implement contact form with client-side validation via React Hook Form + Zod.
2. Add Route Handler `/api/contact` with rate limiting (`@upstash/ratelimiter` or simple token bucket) and email provider integration.
3. Add mobile nav, theme toggle, reduced-motion checks.
4. Add `robots.ts`, `sitemap.ts`, JSON-LD helpers.
5. Run Lighthouse; optimize images, bundle, and LCP.

### Phase 4 — Testing, content population & launch (2–3 days)
1. Populate real projects, skills, and experience.
2. Write unit tests for Zod validators and content loader edge cases.
3. Write Playwright E2E tests for navigation, contact validation, and 404 page.
4. Add GitHub Actions CI for typecheck, lint, test, build, Lighthouse CI.
5. Deploy to Vercel; configure custom domain and analytics opt-in.

### Milestones
| Milestone | Definition of Done |
|-----------|--------------------|
| M1 | Static site builds, home + projects list render, theme toggle works |
| M2 | All core pages render from data, contact form validates client-side |
| M3 | Contact backend sends email, Lighthouse ≥ 95, accessibility audit passed |
| M4 | Real content committed, CI green, deployed to production domain |

---

## 6. Risks & Caveats

| ID | Risk | Impact | Mitigation |
|----|------|--------|------------|
| R1 | **Scope creep from optional blog/CMS** | Delays MVP | Mark blog as post-MVP; ship after core pages launch. |
| R2 | **Next.js static export constraints** | Dynamic API routes and image optimization are limited in pure static export. | Use `output: 'export'` plus hosted Next.js (server) for `/api/contact`; otherwise use third-party form endpoint and unoptimized image export if required. |
| R3 | **Image quality/large bundle** | Poor Lighthouse score | Enforce `.webp`/`.avif` source images, explicit width/height on `<Image>`, lazy below-fold. |
| R4 | **Content update friction** | PRs required for every typo | Accept for MVP because portfolio content changes rarely; consider moving MDX content to a GIT-based CMS (e.g., Tina, Decap) later. |
| R5 | **Email deliverability** | Contact form emails land in spam | Use well-known transactional provider (Resend / Postmark / SendGrid); set SPF/DKIM for custom domain. |
| R6 | **Reduced-motion users** | Animations cause accessibility issues | Gate Framer Motion behind `useReducedMotion()`; keep essential content visible without animation. |
| R7 | **Third-party dependency churn** | shadcn/Radix/Tailwind 4 API changes during setup | Pin versions in `package.json`; lockfile committed; schedule dependency review monthly. |
| R8 | **Resume PDF gets stale** | Downloaded CV differs from site content | Add build check verifying `resume.pdf` date matches latest experience end date, or generate PDF from JSON at build time (stretch). |

---

## 7. Tests & Checks

### 7.1 Automated checks (CI/CD)
Every pull request runs:
```bash
npm run typecheck
npm run lint
npm run format:check
npm run test:unit
npm run test:e2e
npm run build
```

### 7.2 Unit tests
- Validate Zod parsing for `Person`, `Project`, `Experience`, and `Skill` schemas with valid/invalid payloads.
- Validate Markdown/MDX frontmatter extraction and date parsing.
- Verify helpers for sorting (projects by date, experience reverse-chronological).

### 7.3 End-to-end tests (Playwright)
- Navigate every top-level route and assert page title.
- Toggle mobile menu and verify all links reachable.
- Submit contact form with invalid email and assert error message.
- Submit contact form with valid payload and assert success state (mock provider in E2E).
- Verify theme preference persists across reload.
- Verify 404 page renders for unknown project/blog slugs.

### 7.4 Performance & quality checks
- `lighthouse-ci` assertions:
  - Performance ≥ 95
  - Accessibility ≥ 95
  - Best-Practices ≥ 95
  - SEO ≥ 95
- `next-bundle-analyzer` review if any JS chunk exceeds 150 kB gzipped.
- Manual axe DevTools scan on each page.
- Manual keyboard-only navigation smoke test.

### 7.5 Content validation script
Add `scripts/validate-content.ts` run in CI before build:
```bash
npx tsx scripts/validate-content.ts
```
It checks:
- All referenced images exist in `public/`.
- All MDX files have required frontmatter.
- No duplicate project or blog slugs.
- All external URLs return 200-299 (rate-limited to avoid CI flakiness).

---

## 8. Open Questions / Decisions Needed

1. Does the developer want a blog at MVP, or post-launch?
2. Preferred contact backend: serverless route + Resend vs. third-party form host (Web3Forms, Formspree)?
3. Is a custom domain available, and should DNS/SSL be configured before launch?
4. Are there existing brand assets (logo, color palette, résumé PDF) to reuse?
5. Should the résumé PDF be hand-uploaded or auto-generated from JSON at build time?

---

## 9. Final Response Recommendations

- Keep the portfolio **content-first and static-first**: edit data/MDX, not components.
- Treat the **blog as optional** and ship it only after core pages meet Lighthouse and accessibility targets.
- Decide the **contact backend early**; it affects the static-export vs. hosted-Next.js decision.
- Gate all motion behind `prefers-reduced-motion` and audit with keyboard-only navigation before launch.
- Use **Lighthouse CI and Playwright** as quality gates in pull requests.
- Review this PRD with the product/owner to resolve the open questions before Phase 2 begins.
