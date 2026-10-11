# Using your component library

No technical knowledge needed. Everything here is done with buttons on the website.

## Opening it

Go to **https://forever-components.pages.dev** on your Windows PC, iPad or iPhone. The first
time on each device Cloudflare asks you to sign in (it emails you a one-time code). After that
the device stays signed in for 24 hours at a time.

**iPhone / iPad tip:** in Safari tap **Share → Add to Home Screen**. It then opens like an app,
and Safari will not clear your saved favourites for lack of use.

## Finding components

- **Search** — type anything: a name ("liquid toggle"), a kind ("loader"), a feeling ("calm
  background"). Spelling mistakes are forgiven. Press **/** on a keyboard to jump to search.
- **Filters** — tick boxes for type, interactivity, performance, style and more. Ticks in the
  same group mean "any of these"; different groups must all match. **Clear all** resets.
- **Gallery size** — Compact, Comfortable or Large. Your choice is remembered.
- **Sort** — by best match, name, category, type or lightest first.
- **Recently viewed** — appears above the gallery.

Every preview is the real component running. On a computer you can use interactive ones right
in the gallery. On a touch screen, tap a preview to open the **quick preview** and use it there.

## Looking at one component

Click a component's name. The page shows a large live preview with controls:

| Control | What it does |
|---|---|
| Restart | Plays it again from the beginning |
| Pause / Resume | Freezes and continues the animation |
| Fit · Desktop · Tablet · Phone · Custom | Shows it at different screen sizes |
| Dark · Light | Switches the component's own colour mode (when it has a light version) |
| Coloured dots | Tries a different background colour behind it |
| Open original | Opens the untouched original file in a new tab |

Below that: a plain-English description, what it is good for, performance, accessibility,
the author's implementation notes, and the source (file path, links, copy, download).

**Copy link** gives an address that always opens that exact component, even after the library
is updated.

## Copy for AI

This is the main point of the site: **Browse → Preview → Copy for AI → paste into your AI agent.**

1. Open a component and press **COPY FOR AI**.
2. Open Claude Code or Codex **inside the project where you want the component**.
3. Paste and send.

The copied text tells the AI exactly which component and where its source is, and by default
it insists on two things:

- **Essence, not skin.** The AI is told to take what the component *does* and how it *moves*,
  and to take every colour, font, size and spacing value from **your project's existing
  design**. It must not bring the original's colours or fonts with it.
- **The preview is only a demo.** Components play by themselves in this library so you can see
  them. The AI is told that this self-playing loop is not part of the component, to delete it,
  and to animate only on the real trigger — a tap, a hover, a change of state, or (for a
  loader) while your app is actually busy. For ambient pieces with no obvious trigger it is
  told to ask you rather than loop forever.

If you name a trigger in your own message ("play it when the card scrolls into view"), yours
wins. The AI is also asked to say, before coding, what will trigger the animation and which of
your design tokens it will use — a quick way to catch a misunderstanding.

The small arrow next to the button opens the options:

- **Look** — *Match my project's design* (default) or *Keep original look* for the rare time
  you want the component's own colours and fonts.
- **Animation** — *Only when triggered* (default) or *Plays by itself* for backgrounds and
  other pieces you do want running continuously.

- **Quick** — short and direct. Best for simple additions.
- **Detailed** — a full brief with technical background, expected behaviour and testing steps.
- **Include the complete source code** — pastes the whole original file into the message.
  Usually not needed (the AI can fetch it from the link). Switch it on if your AI agent has no
  internet access.

Your choices are remembered. If a message would be too long to paste comfortably, the site
warns you before you copy.

## Favourites

Press the **heart** on any card or component page. Press again to remove. The **Favourites**
page shows them all, with the same search and filters.

## Collections

A collection is a named group for a project, e.g. "Login Page Ideas".

- **Create:** Collections → **New collection**.
- **Add components:** on a component page press **Add to collection**, or use the **⋯** menu on
  a card. One component can be in several collections.
- **Notes:** in a collection, type a note under any component ("use this for the settings
  switch"). Notes save by themselves.
- **Reorder:** **Earlier** / **Later** buttons.
- **Rename / Delete:** buttons at the top of the collection (delete can be undone straight away).

**COPY COLLECTION FOR AI** produces one request covering every component in the collection, in
your order, with your notes, asking the AI to integrate them consistently into your existing
project. Choose **Concise** (links) or **With complete source code**.

## Comparing

Use **⋯ → Add to comparison** on two to four cards, then press **Compare** in the bar at the
bottom. They run side by side at the same size with their details underneath. You can favourite
or collect straight from the comparison.

## Where your saved items live — important

Favourites, collections and notes are saved **inside the browser on the device you are using**.

- They are **not** synced. Your PC, iPad and iPhone each have their own separate set.
- Nothing is uploaded anywhere.
- Clearing the browser's website data removes them.

### Back up or move to another device

1. **Settings → Export backup file.** A small file is downloaded.
2. Send that file to the other device (email, AirDrop, cloud drive).
3. On the other device: **Settings → Import backup file**, choose the file, then
   **Add to what I have** (keeps both) or **Replace everything**.

An import can be undone with **Undo last import**. Export a backup now and then.

## Updates

New components from the original collection arrive as a proposal on GitHub about once a week.
See [UPDATES.md](UPDATES.md). **Settings → Library health** shows how many components there are
and when the library was last built.

## Troubleshooting

| Problem | What to do |
|---|---|
| "Sign-in required" page, or a Cloudflare sign-in screen | Sign in with the email address that is allowed for the site. Codes arrive by email within a minute; check spam. |
| "This site is locked" | The sign-in settings are missing on Cloudflare. See [DEPLOYMENT.md](DEPLOYMENT.md), "If the site says it is locked". |
| A preview says "Preview didn't load" | Press **Try again**. If you were signed out, reload the page to sign in again. |
| A preview says "Preview unavailable" | That component's file is missing from the library. Settings → Library health lists problem files. |
| Previews are blank squares for a moment | Normal: only previews on screen run, and they start one after another to keep things smooth. |
| Sound-reactive components do nothing | Microphone access is switched off in previews on purpose. They run in demo mode. |
| A component's fonts look plain | A few components load Google Fonts; a blocker or offline connection stops that. |
| "Copying was blocked" | Use the options arrow, then select the text in the box and copy it yourself. |
| My favourites are missing on another device | Expected: they are per device. Use export and import (above). |
| My favourites vanished on this device | The browser's website data was cleared. Import your latest backup. |
| A favourite says "no longer in the library" | The component was removed from the original collection. Press the remove link, or keep it for reference. |
| The site looks out of date after merging an update | Wait about five minutes for the deploy, then reload. Check the **Actions** tab on GitHub for a red cross. |
