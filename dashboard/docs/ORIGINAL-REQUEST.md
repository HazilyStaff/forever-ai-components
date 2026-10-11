# Original request (verbatim, 11/10/2026)

Cold reference. Not loaded by default. Used for request-coverage checks.

> https://github.com/HazilyStaff/forever-ai-components is where the forked repo exists in my github.

PROJECT: MY PRIVATE FOREVER COMPONENTS LIBRARY

## 1. YOUR ROLE
You are my senior full-stack engineer, UI/UX designer, and technical project lead.
I am a non-programmer who uses AI coding agents, particularly Claude Code and OpenAI Codex, to build and maintain software projects.
I want you to build a complete, polished, private visual component library using my existing GitHub fork of:
https://github.com/isas1/forever-ai-components
I have already forked the repository into my GitHub account. Assume this fork is the starting point.
Your responsibility is to design, implement, test, and prepare the entire application for deployment.
Do not stop at providing instructions, mockups, or scaffolding. Build the functioning application.
Make sensible technical decisions independently. Do not ask me to choose frameworks, libraries, database technologies, or implementation details unless there is a genuine trade-off I need to understand.
I prioritise reliability, maintainability, speed, and a polished user experience over technical novelty.

## 2. PROJECT OBJECTIVE
Create a beautiful, responsive, interactive website that allows me to:

1. Browse the entire Forever AI Components collection visually.
2. See animated components operating in real time.
3. Interact with buttons, switches, toggles, menus, loaders, and other elements.
4. Search and filter components intuitively.
5. Save favourite components.
6. Organise components into named collections for different projects.
7. Compare multiple components side by side.
8. Copy precise implementation instructions for Claude Code or Codex.
9. Retrieve the complete original HTML source of any component.
10. Keep the library synchronised with upstream additions and improvements.

The website must be suitable for someone who knows nothing about HTML, CSS, or JavaScript.
The core workflow is: Browse → Preview → Select → Copy AI Instructions → Implement in another project.
This is a component discovery and handoff tool, not a website builder.

## 3. EXISTING SOURCE REPOSITORY
My fork originates from:
https://github.com/isas1/forever-ai-components
The repository contains hundreds of self-contained animated HTML components.
It also contains structured metadata intended for AI-assisted discovery.
Important existing files include:

* `infinite/components.index.json`
* `infinite/facets.json`
* `agents.json`
* `catalog.json`
* Individual HTML component files under `infinite/`

Before implementation:

1. Inspect the actual repository structure.
2. Read its README, licence, and agent documentation.
3. Understand the component metadata schema.
4. Determine how individual HTML files are referenced.
5. Identify which components are interactive.
6. Assess any performance implications of simultaneously rendering hundreds of animations.
7. Check that metadata references resolve to existing component files.

Do not make assumptions about the schema or file organisation without inspecting it.
Preserve the original components and source metadata.
Keep custom application code logically separate from the upstream component collection.
The dashboard must use the existing metadata wherever practical instead of manually recreating hundreds of component descriptions.

## 4. DESIGN DIRECTION
Build a premium-quality interface inspired by modern design tools such as Linear, Vercel, Raycast, and contemporary component libraries.
Visual characteristics:

* Minimalist, refined, professional.
* Dark mode as the default.
* Excellent typography.
* Restrained use of colour.
* Subtle transitions and micro-interactions.
* Consistent spacing.
* Rounded cards and tasteful borders.
* No excessive gradients or unnecessary visual effects.
* Responsive layouts with appropriate information density.
* Excellent mouse, keyboard, and touchscreen usability.

The interface should look like a professionally designed product rather than a basic GitHub project demonstration.
Prioritise component visibility: the animated examples themselves should be the main attraction.
Provide a light-mode option.
Ensure the interface works especially well on Windows 11 desktop browsers, iPads, and iPhones.

## 5. MAIN DASHBOARD
Create a landing page displaying an interactive component gallery.
Each component should appear in a card featuring:

* A real, animated preview.
* Component name.
* Category.
* Relevant descriptive tags.
* Favourite button.
* Quick-preview button.

The component preview must display its actual HTML, CSS, and JavaScript rather than a screenshot.
Interactive elements should respond to pointer and touch events.
Allow the user to choose between different gallery densities:
Compact: Small thumbnails displaying many components simultaneously.
Comfortable: Medium cards balancing information and visibility.
Large: Bigger previews for inspecting animations.
Save the preferred display setting locally.
The gallery should remain smooth and responsive even with 1,000 or more components.
Use techniques such as lazy loading, intersection observers, iframe isolation, and pausing offscreen animations.
Do not initialise hundreds of expensive animated previews simultaneously.

## 6. SEARCH AND FILTERING
Implement fast, forgiving search.
Search should cover:

* Component titles.
* Descriptions.
* Categories.
* Tags.
* Intended use cases.
* Interaction types.
* Animation characteristics.
* Available metadata fields.

Support combinations of filters.
Provide intuitive filters for:
Component type

* Buttons
* Toggles and switches
* Input controls
* Cards
* Menus and navigation
* Loaders
* Backgrounds
* Visual effects
* Data visualisations
* Other available categories

These labels are illustrative. Derive the actual taxonomy from repository metadata rather than inventing unsupported categories.
Interaction

* Interactive
* Animated but non-interactive
* Hover-based
* Click-based
* Scroll-based
* Passive or decorative

Performance

* Lightweight
* Moderate
* Resource-intensive

Visual characteristics

* Minimalist
* Colourful
* Monochrome
* Geometric
* Organic
* Other available styles

Provide filters only where the underlying metadata can support them reliably.
Additional features:

* Search suggestions.
* Search across all component categories.
* Clear-all-filters button.
* Search result counts.
* Sorting by name, category, and available relevance signals.
* Recently viewed components.
* Keyboard shortcut to focus search.

Make searching fast enough to feel instantaneous.

## 7. INDIVIDUAL COMPONENT VIEWER
Clicking a component should open a dedicated detailed viewer.
The viewer must display:
A. Large interactive preview
Show the original component running in a properly isolated environment.
Let me interact directly with buttons, toggles, hover effects, and other functionality.
B. Preview controls
Where technically appropriate, provide:

* Restart animation.
* Pause or resume animation.
* Resize preview viewport.
* Desktop/mobile viewport simulation.
* Change preview background colour.
* Toggle between light and dark preview backgrounds.
* Open original standalone HTML.

Avoid breaking original component behaviour when applying these controls.
C. Component information
Display its title, description, tags, intended use cases, performance characteristics, and implementation notes.
Explain these in plain English.
D. Source information
Provide:

* Repository-relative file path.
* Direct GitHub source link.
* Raw source URL.
* Copy source code button.
* Download original HTML button.

E. AI integration
A prominent button labelled:
COPY FOR AI
This is one of the application's most important features.

## 8. COPY FOR AI — CRITICAL FEATURE
The application must generate a useful, context-aware prompt suitable for pasting directly into Claude Code or OpenAI Codex.
For each component, produce an instruction containing:

1. Component name.
2. Original source file path.
3. Direct raw GitHub source URL.
4. Plain-English description.
5. Relevant implementation or adaptation metadata.
6. Instructions to preserve important interactions.
7. Instructions to adapt the component to the target project's existing framework and design system.
8. Instructions to avoid unnecessary dependencies.

Example:
"Implement the following animated toggle switch in my existing project.
Component: [NAME]
Source: [RAW GITHUB URL]
Original file: [REPOSITORY PATH]
Retrieve and inspect the complete original source code.
Adapt this component to my project's existing framework and architecture.
Preserve the animation, transitions, interaction states, and overall visual appearance.
Connect the component to the project's existing application state and event handlers.
Ensure keyboard accessibility, appropriate focus behaviour, and reduced-motion support.
Do not replace the design with a generic approximation.
Do not introduce unnecessary dependencies.
Inspect the existing project before making changes, then implement and test the component."
The actual generated prompt should automatically contain the selected component's correct information.
Provide two handoff modes:
Quick implementation: Concise instructions intended for straightforward integration.
Detailed implementation: More comprehensive instructions including technical metadata, original design characteristics, expected behaviour, and testing guidance.
Both must work without requiring the user to understand the source code.
For private source repositories, do not assume that external AI agents can access a raw GitHub URL.
Offer a self-contained alternative that copies the complete source alongside the implementation instructions.
Warn clearly when the output is too large for a practical clipboard handoff.

## 9. FAVOURITES
Allow me to favourite any component.
Provide a dedicated Favourites page.
Requirements:

* Favourite and unfavourite with one click.
* View all favourites together.
* Search and filter within favourites.
* Remember favourites between browsing sessions.
* Display favourite indicators consistently.
* Preserve favourites when component metadata is updated.

Use persistent browser storage such as IndexedDB or localStorage, choosing whichever best fits the data model.
Do not require a database or user account for basic persistence.

## 10. NAMED COLLECTIONS
Implement a system for grouping components into collections.
For example:
"My Dashboard"
"Login Page Ideas"
"Buttons and Toggles"
"Animations Worth Using"
Allow me to:

* Create a collection.
* Rename a collection.
* Delete a collection.
* Add or remove components.
* Place the same component in multiple collections.
* Add notes to individual selections.
* View the collection as a gallery.
* Reorder components manually.

Collections must persist across browsing sessions.
Provide JSON export and import for backing up favourites, collections, and notes.
Do not confuse browser-local persistence with synchronisation across devices. Explain this distinction clearly in the interface.
Design the storage layer so that optional cross-device synchronisation could be added later.

## 11. COPY COLLECTION FOR AI
Each collection should have a prominent:
COPY COLLECTION FOR AI
button.
This generates one consolidated implementation request for Claude Code or Codex.
The request should contain:

* Collection name.
* All selected components.
* Individual file paths.
* Source URLs.
* Relevant metadata.
* My notes for each component.
* Instructions to integrate these components cohesively into an existing software project.

For example:
"Improve the visual design of my current application using the following five components.
Use the specified component source files as visual and behavioural references.
Integrate them into the existing application rather than creating a new project.
Preserve existing functionality.
Use consistent spacing, colours, typography, and interactions across all adapted components."
Allow me to choose whether to generate a concise collection prompt or include complete source code.

## 12. SIDE-BY-SIDE COMPARISON
Implement a comparison tool.
Allow me to select between two and four components and view them simultaneously.
Useful examples include:

* Comparing different toggle switches.
* Comparing loading animations.
* Comparing hover effects.
* Comparing animated button designs.

Provide synchronised preview sizes where practical.
Display basic metadata alongside each preview.
Allow components to be added directly to favourites or collections from the comparison screen.

## 13. COMPONENT IDENTIFIERS AND SHAREABLE LINKS
Every component must have a stable, unique identifier derived from its repository path or existing metadata.
Provide a shareable URL that opens its detail view.
Do not rely on array positions or unstable indexes.
For example, if I bookmark a specific toggle component, the bookmark should continue to identify that component after the collection is updated.
Provide a direct-link button.
If the component is deleted upstream, show a graceful missing-component state rather than silently displaying the wrong component.

## 14. UPSTREAM SYNCHRONISATION
This application should remain maintainable as the original repository evolves.
My GitHub repository is a fork of:
https://github.com/isas1/forever-ai-components
Design a safe mechanism to incorporate upstream changes.
Requirements:

1. Preserve custom dashboard code.
2. Preserve original component identities.
3. Detect newly added components.
4. Detect modified components.
5. Detect deleted components.
6. Rebuild the catalogue when necessary.
7. Report synchronisation results.
8. Avoid silently overwriting my custom application files.

Prefer a safe, reviewable GitHub Actions workflow.
Do not blindly merge upstream changes into custom code.
If an upstream change produces a conflict, generate a pull request for review rather than force-overwriting files.
Automate routine checks approximately weekly.
Document exactly how synchronisation works and what happens when changes require intervention.

## 15. PERFORMANCE AND SECURITY
Performance is important.
The website may contain hundreds or eventually thousands of animated components.
Implement:

* Lazy-loaded previews.
* Offscreen animation suspension where feasible.
* Efficient searching and filtering.
* Sensible caching.
* Efficient client-side storage.
* Responsive mobile layouts.
* Proper error handling.
* Loading placeholders.

Treat component HTML files as potentially untrusted executable content.
Use sandboxed iframes with the minimum permissions necessary for intended functionality.
Do not grant preview content access to the parent application's DOM, cookies, local storage, or authentication credentials.
Keep the component preview origin isolated from the private application's authentication context wherever possible.
Do not use unsafe HTML injection into the application's main document.
Do not unnecessarily load external scripts, fonts, analytics, or tracking services.
Provide useful error messages if a component fails to load.

## 16. PRIVATE HOSTING AND ACCESS CONTROL
I want a personal website I can access from my Windows computer, iPad, and iPhone.
I do not want the website's interface or component catalogue publicly accessible without authentication.
My preference is:

* GitHub for source control.
* Cloudflare for hosting.
* Cloudflare Access for authentication.
* Minimal or zero recurring infrastructure costs.
* No home server requirement.
* No maintenance-intensive backend.

Investigate the current Cloudflare Pages and Cloudflare Access deployment options before finalising the architecture.
Prefer using existing free-tier capabilities where sufficient.
Important security requirements:

1. The website must require authentication before displaying private content.
2. Unauthenticated users must not be able to retrieve the private component assets directly.
3. Protect the production hostname and any alternate deployment hostnames.
4. Account for Cloudflare's default pages.dev domain and preview deployment URLs.
5. Do not rely on a JavaScript password prompt, hidden URL, robots.txt, or client-side-only access control.
6. Never embed Cloudflare API tokens or other secrets in browser code.
7. Clearly document how to test that private assets cannot be retrieved without authentication.

If secure authentication requires additional account configuration, a custom domain, or a different Cloudflare architecture, explain the trade-offs.
Do not falsely claim privacy merely because the source repository is private.
If a Cloudflare Pages setup cannot meet the requirements cleanly, propose a simpler secure alternative rather than implementing an insecure approximation.
Prepare all necessary deployment configuration.
Keep local development straightforward.

## 17. TECHNOLOGY REQUIREMENTS
You may select the implementation technology.
Prefer:

* A simple, maintainable architecture.
* Static generation or client-side functionality.
* Minimal dependencies.
* No database for the initial implementation.
* No unnecessary server-side components.
* Established, well-supported libraries.
* A conventional project structure.

React with TypeScript and Vite would be acceptable, but select the architecture based on actual project requirements.
Use appropriate automated testing.
Avoid overengineering.
Keep the application independent from the original website's authentication or download restrictions. Work exclusively from files lawfully available in the repository and authorised upstream sources.

## 18. DATA INTEGRITY
Build a validation process for the component catalogue.
Check that:

* Each indexed component has a stable identity.
* Referenced HTML files exist.
* Paths resolve correctly.
* Duplicate entries are handled.
* Broken files do not crash the gallery.
* Missing metadata does not break filtering.
* Newly added components appear automatically after updates.

Provide a simple catalogue health report showing:

* Total indexed components.
* Total valid component files.
* Missing or broken references.
* Number of available categories.
* Date of the latest successful catalogue build.

Never display an unverified hardcoded component count.

## 19. QUALITY ASSURANCE
Test the complete user workflow.
At minimum:

1. Open the dashboard.
2. Browse the component gallery.
3. Search for a component.
4. Apply category filters.
5. Open a live component preview.
6. Interact with its animation.
7. Restart the animation.
8. Copy AI implementation instructions.
9. Copy the source file path.
10. Favourite the component.
11. Create a collection.
12. Add several components.
13. Generate a collection-level AI prompt.
14. Refresh the browser and confirm persistence.
15. Export and re-import saved collections.
16. Test narrow mobile layouts.
17. Verify that component iframes remain isolated.
18. Verify that broken component references fail gracefully.
19. Verify that the production deployment is access-controlled.

Where possible, use automated browser tests such as Playwright.
Check the build for errors, missing assets, and broken routes.
Do not claim that a feature has been tested unless the test was actually executed.

## 20. USER EXPERIENCE REQUIREMENTS
Remember that I am not a programmer.
Do not make me interact with JSON, terminals, source code, or Git commands during normal use.
The finished application should feel like a conventional website.
Technical details can be available under expandable advanced sections, but should not dominate the interface.
Every important action should have a clear button and understandable label.
Include helpful empty states and tooltips.
Prioritise straightforward navigation.
Use plain English in user-facing messages.

## 21. DOCUMENTATION
Create concise documentation explaining:

1. What the application does.
2. How to run it locally.
3. How to deploy it.
4. How to configure private authentication.
5. How to access it from my devices.
6. How favourites and collections are stored.
7. How to export and restore user data.
8. How upstream updates are incorporated.
9. How to use the Copy for AI feature.
10. How to troubleshoot common problems.

Documentation should assume minimal technical knowledge.

## 22. IMPLEMENTATION APPROACH
Work in a structured sequence:
PHASE 1 — REPOSITORY AUDIT
Inspect the fork, identify the actual catalogue structure, validate available metadata, and establish the implementation architecture.
PHASE 2 — WORKING APPLICATION
Implement the visual gallery, search, filters, isolated previews, and detailed component viewer.
PHASE 3 — PERSONAL WORKFLOW
Implement favourites, collections, comparisons, and AI handoff functionality.
PHASE 4 — POLISH AND PERFORMANCE
Refine visual design, optimise previews, ensure responsive behaviour, and implement accessibility improvements.
PHASE 5 — DEPLOYMENT AND SECURITY
Configure deployment, authentication requirements, and appropriate security protections.
PHASE 6 — VERIFICATION
Run tests, fix identified problems, validate deployment readiness, and document the application.
Complete as much as possible autonomously.
Commit work in logical increments.
Do not stop after Phase 1 or Phase 2 simply to report progress.
Proceed through implementation unless you genuinely need information or credentials that only I can provide.

## 23. DEFINITION OF DONE
The project is complete when:

* The dashboard works.
* All valid components in my fork are discoverable.
* Components render as live, interactive previews.
* Search and filtering work.
* Favourites persist.
* Collections work.
* Components can be compared.
* AI instructions can be copied directly into Claude Code or Codex.
* Source code can be copied or downloaded.
* The site functions on desktop and mobile devices.
* Upstream synchronisation is configured safely.
* Deployment configuration is ready.
* Private access requirements are implemented and verified, or any remaining external account setup is clearly identified.
* Tests pass.
* Documentation is complete.

Do not substitute a prototype, static mockup, or partial demonstration for the requested application.

## 24. FINAL INSTRUCTIONS
Begin by inspecting my existing repository.
Use the actual files and metadata already present.
Make reasonable implementation decisions independently.
Preserve the source component collection.
Build the application, not just a project plan.
Where functionality cannot be completed because it requires external credentials or account access, implement everything else and clearly identify the exact remaining manual steps.
At the end, provide:

1. A concise summary of what was built.
2. The repository changes made.
3. Test results.
4. Deployment status.
5. Any remaining actions required from me.
6. The final website URL, if deployment was completed.

My overriding objective is a beautiful, permanent, private component catalogue that I can use without programming knowledge, and that integrates naturally into my Claude Code and Codex development workflows.
