# Dela CRM UI — how to build with these components

This is the component vocabulary of a live CRM app (WhatsApp/Instagram inbox,
broadcasts, templates, calendar, account health). Everything here is the app's
real shipped code.

## Setup: no provider, no theme object

Components mount directly — there is **no ThemeProvider, no ConfigProvider and
no i18n provider to wrap**. Two things carry the look, both already in
`styles.css`:

- **semantic CSS custom properties on `:root`** (oklch), and
- **a small component-class layer** (`button.primary`, `input.text`, …).

Strings render in English with no setup (English is the i18n base — the
translation layer returns the key itself for `en`).

## Color tokens — use these, never raw hex

`--background --foreground --card --card-foreground --popover
--popover-foreground --primary --primary-foreground --secondary
--secondary-foreground --muted --muted-foreground --accent --accent-foreground
--destructive --destructive-strong --success --success-strong --warning
--warning-strong --border --input --ring --sidebar --sidebar-foreground
--sidebar-primary --sidebar-accent --sidebar-border --chat-in --chat-out`

Reach them either as a Tailwind color utility (`bg-primary`,
`text-muted-foreground`, `border-border`, `bg-accent`) or as
`style={{ background: "var(--primary)" }}`. The palette is a green primary on
warm-neutral surfaces; `--primary` is the only brand accent.

## ⚠ Tailwind v4 is compiled — only classes the app already uses exist

`styles.css` is a **built** Tailwind stylesheet, not a runtime engine. A
utility the app never wrote is simply not in it and will silently do nothing.
The named-scale type utilities are a good example of the trap: this app sizes
type with arbitrary values (`text-[14px]`, `text-[16px]`, `text-[20px]`), so
`text-2xl`, `text-3xl` and `space-y-4` do not exist, and neither do
off-palette colors like `text-slate-500`.

So, for your own layout glue:

1. prefer utilities in the vocabulary the app actually uses — layout
   (`flex grid gap-2 gap-[8px] items-center justify-end flex-col truncate p-4
   rounded-xl rounded-full opacity-50 shadow-sm`), semantic colors
   (`bg-card bg-muted bg-accent bg-primary bg-primary/10 bg-background
   text-foreground text-primary text-muted-foreground text-success
   border-border`) and bracket sizes (`text-[14px]`, `px-[24px]`), or
2. use **inline styles with `var(--token)`** — always safe, and what several
   of these components do internally.

Never invent a utility class name and assume it resolves.

## Component classes (in `styles.css`, use them as written)

| Class | Use |
|---|---|
| `button.primary` | filled green pill button — `<Button className="primary">` |
| `button.destructive` | outlined red pill button |
| `input.text` / `textarea.text` | the app's underlined text input |
| `.label` | 12px muted field label above an input |
| `.header` | 60px page/panel header bar |
| `.section-body` | scrolling body column of a panel |
| `.instructions` | prose block (p / ul / ol styling) |
| `.spin` | spinner rotation |

## Composition patterns

- A panel is `.header` + `SectionBody` (scrolls) + `SectionFooter` (actions).
- A list is `SectionBody` wrapping `SectionItem` rows — each row takes
  `title`, `description`, `aside` (usually an `Avatar`), `actions`, plus
  `selected` / `disabled`.
- A settings screen is a stack of `SectionField` rows (label + description +
  chevron, opens its children in an overlay), with `SwitchField`,
  `SelectField`, `TextAreaField`, `CountryField` for inline values and
  `FieldError` beneath.
- Status is `StatusBadge` (`tone`: primary | warning | success | neutral |
  destructive); on the health pages it is `Chip` inside `Card` + `CardHead`.
- `Button` has no variants of its own — the variant is the class you pass. It
  also takes `loading`, `invalid` and `disabledReason`.

## Where the truth is

Read the real files before styling: `_ds/<folder>/styles.css` and its imports
for the tokens and component classes, and each component's `.prompt.md` +
`.d.ts` for its actual props. Both beat any summary here.

## Idiomatic snippet

```jsx
<div className="flex flex-col gap-2 p-4 bg-card rounded-xl border border-border">
  <span className="label">Broadcast</span>
  <SectionItem
    title="Spring promotion"
    description="248 recipients · scheduled for Tue 10:00"
    aside={<Avatar fallback="SP" size={49} className="bg-accent text-accent-foreground border border-border" />}
    actions={<StatusBadge label="scheduled" tone="primary" />}
    onClick={() => {}}
  />
  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
    <Button className="destructive px-[24px]">Cancel</Button>
    <Button className="primary px-[24px]">Send now</Button>
  </div>
</div>
```
