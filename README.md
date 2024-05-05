# Nobsidion

Nobsidion is an Obsidian plugin designed to sync your Obsidian vault with your Notion workspace. Building upon the [Obsidian to Notion](https://github.com/EasyChris/obsidian-to-notion/) plugin, Nobsidion offers additional functionality and refinements, making the syncing process more seamless and integrated.

⚠️ This Obsidian plugin has been tested manually.

## Vision

-   **Bi-directional Sync**: Keep your Obsidian notes and Notion pages in sync with changes reflected in both platforms.
-   **Customizable Sync**: Choose which parts of your vault you want to sync with Notion. Current note, entire vault, or all notes linked with the current note.
-   **Link Conversion**: Convert Obsidian-style links (`[[Link]]`) into Notion's internal page mentions.

## Tasks

Here are the immediate tasks I am working on. Some of the tasks will seem trivial compared to the vision, but I'm getting there.

### Upload from Obsidian to Notion

-   [x] Upload current note. All notes that are linked in this note will also be uploaded.
-   [x] Upload the entire vault.

**Current limitations**:

-   Wiki-links are now converted into hyperlinks
-   ⚠️ The speed of uploading the entire vault is very slow. For technical reasons, I am configure notes to be uploaded in sequence instead of in parallel. I will examine how to do the latter some time in the future. Let me know (in any way you can contact me) if bulk upload is a priority for you.
-   ⚠️ If a note nests items more than two levels, it won't be uploaded to Notion, due to limitations with Notion API. I can work around this, but it would take time.

**Future tasks**:

-   [ ] Convert wiki-links into Notion's internal page mentions.
-   [ ] Upload the entire vault in parallel.
-   [ ] Enable item nesting more than two levels.

### Update an Obsidian note based on a Notion page

-   [ ] Enable the users to view the Notion page from Obsidian. Keep the Obsidian note up-to-date with Notion page.

**Limitations**:

-   The Obsidian note will be overwritten whenever there is changed from Notion.

## Getting Started

Before you begin, ensure you have the latest version of Obsidian installed. Then, follow EasyChris' instructions [here](https://github.com/EasyChris/obsidian-to-notion/tree/master).

## Usage

-   To sync an individual note, use the command palette and search for "Upload current note to Notion."
-   For bulk sync operations, choose "Upload entire vault to Notion."

## Acknowledgements

This project is a fork of [Obsidian to Notion](https://github.com/EasyChris/obsidian-to-notion/) by [EasyChris](https://github.com/EasyChris). Significant refactoring and feature enhancements have been made to provide a more robust syncing experience for Obsidian users.

## Contributing

Contributions are welcome! If you have a suggestion, bug report, or feature request, please open an issue, submit a pull request, or ping me on LinkedIn or email (which you can find on my profile).

## License

Nobsidion is released under the [GNU GENERAL PUBLIC LICENSE 2007](LICENSE).
