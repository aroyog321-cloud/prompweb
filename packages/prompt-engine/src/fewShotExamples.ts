export const FEW_SHOT_EXAMPLES = `### Example 1 — Writing task (content-creator mode, expert level)     
INPUT: "Write a blog post about coffee."

OUTPUT:
# Role
Act as a world-class coffee connoisseur and lifestyle blogger with 10+
years of experience writing for specialty-coffee publications.

# Context
I am launching a boutique organic coffee brand targeting Gen-Z urban  
professionals who value sustainability over convenience. The post will appear
on our blog and feed into our email nurture sequence.

# Objective
Write a 600-word blog post explaining the flavor profile of Ethiopian 
Yirgacheffe beans. The post should educate new specialty-coffee drinkers and
position our brand as the authoritative source.

# Style & Tone
- Style: Sophisticated yet accessible. No insider jargon without explanation.
- Tone: Passionate, authoritative, and lightly playful.

# Audience
Primary: Gen-Z urban professionals, 22-32, already drink specialty coffee,
skeptical of marketing, care about sustainability and origin stories. 
Secondary: Coffee-curious generalists who want to learn.

# Constraints
- Open with a hook in the first 2 sentences (no throat-clearing, no "Coffee is
  one of the most popular beverages in the world").
- Mention the citrus notes and floral aroma of Yirgacheffe specifically.
- Do NOT use cliché phrases like "wake up and smell the coffee", "a good
  day starts with", or "life is too short for bad coffee".
- Do NOT exceed 600 words.

# Output Format
- H1 title (8 words or fewer)
- 3 H2 subheaders, in this order: Origin Story → Flavor Profile → How to Brew
- Bulleted list of 5 tasting notes
- One short call-to-action paragraph at the end (2 sentences max) linking to
  our product page

# Success Criteria
A reader should finish the post able to (a) name 3 distinct flavor notes of
Yirgacheffe, (b) articulate why origin matters, (c) feel motivated to try the
product.

# Edge Cases
- If a reader skims only the H2 headers, the post should still tell a coherent
  story. Avoid burying the punchline in body text.


### Example 2 — Code task (developer mode, aggressive level)
INPUT: "build a debounce hook"

OUTPUT:
# Role
Act as a Principal React/TypeScript Engineer with deep expertise in custom
hooks, performance optimization, and accessibility. You write production-grade
code that handles edge cases.

# Context
- The hook will be used across our internal component library by 30+ engineers.
- Stack: React 18, TypeScript 5, ESM, strict mode.
- Target: modern browsers only (last 2 versions of Chrome, Firefox, Safari).
- Consumers will pass varying value types (strings, numbers, objects, functions).

# Objective
Implement a \`useDebouncedValue<T>(value: T, delayMs: number): T\` hook in
TypeScript. The hook should debounce updates to \`value\` and return the
debounced value.

# Functional Requirements
- Initial value returned immediately on mount (no delay).
- Subsequent value changes debounced by \`delayMs\` ms.
- The latest pending value should always win (no stale updates).      
- Timer must be cleared on unmount and on each new value.
- Supports any type \`T\`, including functions and objects (use \`Object.is\` or
  similar for comparison).

# Non-Functional Requirements
- TypeScript strict mode: zero \`any\`, zero \`@ts-ignore\`.
- No external dependencies (no lodash).
- Passes ESLint with our project config (no \`react-hooks/exhaustive-deps\`
  violations, no \`no-unused-vars\`).
- Cleanup runs in the right hook (no \`useEffect\` for cleanup logic).  

# Output Format
- Single TypeScript file: \`useDebouncedValue.ts\`.
- Export the hook as a named export.
- Include a JSDoc comment block describing purpose, params, return value, and
  one usage example.
- Do not include tests, README, or example apps in this output.       

# Acceptance Criteria
- A 3-line usage example in the JSDoc that compiles and runs.
- Handles \`delayMs = 0\` without infinite loops.
- Stable identity of the returned value when input is unchanged (referential
  equality).

# Edge Cases
- \`delayMs\` changes mid-cycle: the pending timer should be re-scheduled with
  the new delay, not the old one.
- Component unmounts mid-debounce: no \`setState\` on unmounted component
  warning.
- Rapid value changes (10+ in 100ms): only the final value should be observed
  by downstream consumers.


### Example 3 — Research task (research mode, aggressive level)
INPUT: "what are the effects of microplastics on human health"

OUTPUT:
# Role
Act as a Meticulous Researcher who reasons from first principles, surfaces evidence,
distinguishes established findings from preliminary claims, and never invents citations.

# Context
I am compiling a briefing document for a public health policy committee. 
The committee needs to understand the current scientific consensus (as of 2024) 
to propose funding for further studies.

# Research Question
What are the medically documented physiological effects of microplastics and 
nanoplastics on human health, specifically focusing on the endocrine and cardiovascular systems?

# Scope (in / out)
- IN SCOPE: Human studies, in-vitro human cell line studies, recent systematic reviews.
- OUT OF SCOPE: Animal studies (unless no human data exists), environmental impact 
  (e.g., ocean pollution), generic alarmism without scientific backing.

# Required Sources & Reasoning Depth
- Prioritize peer-reviewed literature, WHO reports, and major epidemiological studies.
- When citing, provide the study's primary author, year, and a brief summary of the methodology.

# Confidence & Uncertainty Handling
- Clearly distinguish between "established clinical facts", "strong correlations", 
  and "preliminary/speculative findings".
- Explicitly flag areas where the data is insufficient to draw conclusions.

# Output Structure
- Executive Summary (3 bullet points)
- Endocrine System Impacts
- Cardiovascular Impacts
- Methodological Limitations in Current Research
- List of 3-5 Key References

# Constraints
- Do NOT invent DOIs or study names. If a claim cannot be verified, state "Current 
  research is inconclusive."
- Avoid definitive statements if the consensus is still forming (use words like 
  "suggests", "correlates", "may indicate").


### Example 4 — Design task (designer mode, aggressive level)
INPUT: "design a login page"

OUTPUT:
# Role
Act as a Senior Product Designer focused on cognitive load, accessibility 
(WCAG 2.1 AA minimum), user mental models, and visual hierarchy.

# User & Context
- Target users: Non-technical users (ages 40-65) logging into a healthcare portal.
- Context: Users are often stressed or anxious when accessing medical records.
- Device: 60% of traffic is mobile, 40% desktop.

# Problem to Solve
Create a low-friction, high-trust authentication flow that handles email/password 
and SSO, while minimizing user errors (like forgotten passwords).

# Design Principles
- Clarity over cleverness.
- High contrast and legible typography (16px base font minimum).
- Clear error states with actionable recovery paths.

# Deliverables
Provide a detailed structural wireframe specification and UI text copy for the login page.

# Format & Specs
Use Markdown to describe the layout from top to bottom.
- Header: Logo and secure portal badge.
- Main Form: Email input, Password input (with "Show" toggle).
- Actions: Primary "Sign In" button, secondary "Forgot Password" link.
- SSO: "Continue with Google" and "Continue with Apple" buttons.
- Footer: Help center link and privacy policy.

# Constraints & Anti-patterns
- Do NOT use placeholder text as the only label (inputs must have persistent top labels).
- Do NOT hide the "Forgot Password" link behind a menu.
- Avoid low-contrast grays for secondary text (#666 is the minimum contrast).

# Success Metrics
- Reduction in password reset requests by 15%.
- Time-to-authenticate under 8 seconds.


### Example 5 — Business task (business mode, aggressive level)
INPUT: "should we switch to subscription pricing"

OUTPUT:
# Role
Act as a Strategy Consultant who uses MECE frameworks, ROI-driven logic, and 
decision-ready executive summaries.

# Business Context
We are a B2B SaaS company currently charging a one-time perpetual license of $5,000 
plus an optional $1,000/year maintenance fee. Our MRR is low, but cash flow is strong.
We are considering switching to a pure $400/month subscription model.

# Decision to Make
Should we transition our pricing model from perpetual + maintenance to a pure 
subscription model within the next 12 months?

# Framework
Use a MECE (Mutually Exclusive, Collectively Exhaustive) framework to analyze the impact 
across Financials, Customer Acquisition, Customer Retention, and Product Development.

# Analysis Required
1. Cash flow trough analysis (the immediate revenue dip when switching).
2. Customer Lifetime Value (LTV) comparison over a 3-year and 5-year horizon.
3. Sales cycle velocity impact.

# Trade-offs Considered
- Higher long-term LTV vs. short-term cash flow risk.
- Predictable MRR vs. alienating existing enterprise customers who prefer CapEx over OpEx.

# Recommendation
Conclude with a definitive "Yes, if [X]" or "No, unless [Y]" recommendation. 

# Output Format
- Executive Summary (BLUF: Bottom Line Up Front)
- Financial Impact Analysis
- Customer Impact Analysis
- Proposed Transition Strategy (if recommended)
- Key Risks

# Constraints
- Do NOT provide a generic "pros and cons" list. Ensure the analysis is quantified 
  wherever possible (use standard industry benchmarks if exact data is missing).
- Limit the entire brief to 800 words.`;
