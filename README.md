<p align="center">
<img src="https://raw.githubusercontent.com/Quorafind/Obsidian-Daily-Notes-View/master/image/daily-note.svg" height="160px">
</p>

# Daily Notes Editor

> **Maintenance fork.** The original [Daily Notes Editor](https://github.com/Quorafind/Obsidian-Daily-Notes-Editor) by [Boninall](https://github.com/Quorafind) has not been updated since April 2025. This fork keeps it compatible with current Obsidian versions and fixes several long-standing bugs. All credit for the original plugin belongs to Boninall.

A plugin for you to edit a bunch of daily notes in one page(inline), which works similar to Roam Research's default daily note view.

![Daily-Note-View](https://raw.githubusercontent.com/Quorafind/Obsidian-Daily-Notes-Editor/master/image/Daily-Note-View.gif)

# Features

-   Open a daily note editor page to edit a bunch of daily notes in one page/inline.
    -   You can open it from command.
    -   You can open it from left ribbon.
-   View and filter notes by different time ranges:
    -   Week, Month, Year, Quarter
    -   Past 7 days, Past 30 days
    -   Last Week, Last Month, Last Year, Last Quarter
    -   All notes
    -   Custom date range
-   Multiple view modes:
    -   Daily Notes mode - view your daily notes
    -   Folder mode - view all notes from a specific folder
    -   Tag mode - view all notes with a specific tag
-   Sort options:
    -   Sort by creation time (newest/oldest first) in folder and tag modes
    -   Sort by modification time (newest/oldest first) in folder and tag modes
    -   Sort by name (A-Z / Z-A)
    -   Daily notes are always ordered by the date in their filename
-   Customization options:
    -   Hide frontmatter in daily notes
    -   Hide backlinks in daily notes
    -   Create and open Daily Notes Editor on startup
    -   Hide daily notes dated after today
    -   Hide daily notes that are empty apart from their frontmatter
    -   Auto focus today's note and put the cursor at the end of it
    -   Reuse an already open editor instead of opening a new tab
-   Save custom presets for quick access to specific folders or tags
-   Navigate between notes using keyboard shortcuts (up/down)
-   Right-click on folders to open all notes in that folder in the Daily Notes Editor
-   Tag mode matches both inline `#tags` and `tags` in frontmatter

# Changes in this fork

Since the last upstream release (1.1.0):

-   New: hide empty daily notes (today's note is always kept visible)
-   New: hide daily notes dated after today
-   New: auto focus today's note and reuse an existing editor tab
-   Fix: creating today's note no longer duplicates the entry and freezes the list
-   Fix: closing the editor releases its listeners, component and timers
-   Fix: notes opened inline no longer disappear from the quick switcher and Recent Files
-   Fix: a missing daily notes folder no longer leaves the view blank
-   Fix: folder and tag lists match notes by path instead of filename
-   Fix: tag mode matches frontmatter tags as well as inline tags
-   Fix: Escape no longer switches tabs while editing an embedded note
-   Performance: the list fills in batches and stops its timer when done
-   Requires Obsidian 1.4.0 or newer

# Installation

This fork is not in the community directory. Install it with [BRAT](https://github.com/TfTHacker/obsidian42-brat):

1. Install and enable **BRAT** from Settings → Community plugins.
2. Open the command palette and run `BRAT: Add a beta plugin for testing`.
3. Enter `mistn/Obsidian-Daily-Notes-Editor` and confirm.

Manual install: download `main.js`, `manifest.json` and `styles.css` from the [latest release](https://github.com/mistn/Obsidian-Daily-Notes-Editor/releases/latest) and put them in `<vault>/.obsidian/plugins/daily-notes-editor/`.

# Settings

-   **Hide frontmatter**: Toggle to hide frontmatter in daily notes
-   **Hide backlinks**: Toggle to hide backlinks in daily notes
-   **Hide note title**: Hide the date title above each note when the note already contains it
-   **Create and open Daily Notes Editor on startup**: Automatically create today's daily note and open the Daily Notes Editor when Obsidian starts
-   **Use arrow up/down key to navigate between notes**: Jump to the previous/next note when the cursor leaves the current one with the arrow keys
-   **Auto focus today's note**: Focus today's note and move the cursor to the end of the document, so you can start typing right away
-   **Switch to existing editor**: If a Daily Notes Editor is already open, focus it instead of opening a new tab
-   **Hide future dates**: Hide daily notes dated after today (daily notes mode only)
-   **Hide empty daily notes**: Hide daily notes that have no content besides their frontmatter (daily notes mode only; today's note is always kept)
-   **Presets**: Save and manage custom presets for quick access to specific folders or tags

# Usage

1. Click the calendar icon in the left ribbon or use the command "Open Daily Notes Editor"
2. Use the action buttons in the view to:
    - Select time range (Week, Month, Year, All, etc.)
    - Change view mode (Daily, Folder, Tag)
    - Change sort order
3. Save your current selection as a preset for quick access later
4. Right-click on any folder in the file explorer to open all notes from that folder in the Daily Notes Editor

# Thanks

-   [Boninall](https://github.com/Quorafind): created the original Daily Notes Editor, which this fork is based on.
-   [Hover Editor](https://github.com/nothingislost/obsidian-hover-editor): I use code from this plugin to generate workspace leaf in my view.
-   [Obsidian Daily Notes Interface](https://github.com/liamcain/obsidian-daily-notes-interface): I use code from this api to get all dailynotes and generate daily note.
-   [Make.md](https://www.make.md/): inspired me to create this plugin.

# Say Thank You

Please say thank you to NothingisLost && pjeby from [Hover Editor](https://github.com/nothingislost/obsidian-hover-editor)

And [Make.md](https://www.make.md/) works with more features than this plugin, please consider to use it.

---

If you still feel generous and enjoy this plugin then please support the original author's work and enthusiasm by buying them a coffee
on [https://www.buymeacoffee.com/boninall](https://www.buymeacoffee.com/boninall).

<a href="https://www.buymeacoffee.com/boninall"><img src="https://img.buymeacoffee.com/button-api/?text=Buy me a coffee&emoji=&slug=boninall&button_colour=6495ED&font_colour=ffffff&font_family=Lato&outline_colour=000000&coffee_colour=FFDD00"></a>
