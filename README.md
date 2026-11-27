# LYT Linear Calendar

A linear calendar for Obsidian, by [Linking Your Thinking](https://www.linkingyourthinking.com). See your whole year at a glance, built on plain Markdown notes.

**Status:** in development (0.2.0). The calendar works the way the web app does: drag across days to add, drag to move, pop-ups to edit, categories, Life Trends, themes and fonts. Your notes are the data.

## What it writes

- Every note with a `start` date (or a `month`, for Sometime plans) shows, wherever it lives. Notes with no dates are never read or changed.
- A new item becomes a note in the `Linear` folder (set in the plugin's settings), named and laid out as set in the calendar's Export card.
- Moving or editing an item changes only its dates, category and `hide-name` properties and its `## Plan` and `## Reflection` sections. Other properties and sections stay as they are.
- A file follows its item's name and dates only while it still has the name the calendar gave it. Names you chose stay.
- Deleting an item moves its note to the trash, as set in Obsidian (Files and links → Deleted files).
- The year note (`2027 Linear.md`) and Life Trends threads (`Linear/Trends/…`) are written when you change them in the calendar.

## Network use

The calendar's three fonts (Recursive, Atkinson Hyperlegible Next, Familjen Grotesk) load from Google Fonts. Without a connection it uses your system font. Nothing else leaves your vault.

## The notes

The plugin reads the same notes the free web app at lytlinearcalendar.com exports:

```
Linear/
  2027 Linear.md                ← the year: Intentions, Reflection
  2027-03-14 London trip.md     ← start, end (a span)
  2027-06-02 Launch day.md      ← start (a single date)
  Sometime/2027-04 Title.md     ← month (no day yet)
```

Properties: `start`, `end` (spans only), `month` (Sometime only), `category`, `hide-name`. Notes can live anywhere in the vault.

## Building

No npm or bundler. The shared core (`src/core`: drawing, export format and the whole interface, also used by the web app) and the plugin platform (`src/plugin`: the view, settings and the vault) are joined into one file:

```
python3 tools/build.py     # writes main.js and styles.css
python3 test/smoke.py      # drives the built plugin in headless Chrome against a stand-in for Obsidian's API and an in-memory vault
```

`styles.css` scopes the core's styles to the view and leaves out rules Obsidian's plugin review flags.

## License

[GPL-3.0](LICENSE). "Linking Your Thinking" and "LYT" are trademarks of Linking Your Thinking and are not covered by this license.
