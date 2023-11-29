/*
    Originally created by EasyChris (2022)
    Modified by Quan Phan (2023)

    This file is part of Nobsidion and is licensed under the GNU General Public License v3.0.
    Modifications include <brief description of modifications>.

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program. If not, see <https://www.gnu.org/licenses/>.
*/

import { App, Notice, Plugin, PluginManifest, TFile } from "obsidian";
import * as yamlFrontMatter from "yaml-front-matter";
import * as yaml from "yaml";
import { Notion } from "lib/notion";
import { NoticeMConfig } from "lib/messenger";
import { PluginSettings } from "lib/settings";
import { SampleSettingTab } from "lib/settings";

// Define your default settings
const DEFAULT_SETTINGS: PluginSettings = {
	notionAPIToken: "",
	databaseID: "",
	bannerUrl: "",
	notionWorkspaceID: "",
	allowTags: false,
};

// Get language configuration for notices
const langConfig = NoticeMConfig(
	window.localStorage.getItem("language") || "en"
);

export default class ObsidianSyncNotionPlugin extends Plugin {
	settings: PluginSettings;
	notion: Notion;

	constructor(app: App, manifest: PluginManifest) {
		super(app, manifest);
		this.settings = DEFAULT_SETTINGS;
		this.notion = new Notion(this.settings);
	}

	async onload() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
		this.notion = new Notion(this.settings);

		this.addCommand({
			id: "share-to-notion",
			name: "Upload current note to Notion",
			editorCallback: async () => {
				this.uploadCurrentNote();
			},
		});

		this.addCommand({
			id: "bulk-share-to-notion",
			name: "Upload entire vault to Notion",
			callback: async () => {
				this.bulkUpload();
			},
		});

		// Add settings tab to plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));
	}

	onunload() {}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async uploadCurrentNote() {
		if (!this.hasValidNotionCredentials()) {
			new Notice(
				"Please set up the Notion API and database ID in the settings tab."
			);
			return;
		}

		const nowFile = this.app.workspace.getActiveFile();
		if (!nowFile) {
			new Notice(langConfig["open-file"]);
			return null;
		}

		this.uploadFile(nowFile);
	}

	async bulkUpload() {
		if (!this.hasValidNotionCredentials()) {
			new Notice(
				"Please set up the Notion API token and database ID in the settings tab."
			);
			return;
		}

		const markdownFiles = this.app.vault.getMarkdownFiles();
		for (const file of markdownFiles) {
			this.uploadFile(file);
		}

		new Notice("All files have been processed for upload to Notion.");
	}

	hasValidNotionCredentials() {
		const { notionAPIToken, databaseID } = this.settings;
		return notionAPIToken !== "" && databaseID !== "";
	}

	async uploadFile(file: TFile): Promise<void> {
		let contentWithFrontMatter: any = await this.getContent(file);

		let tags = [];
		if (this.settings.allowTags) tags = contentWithFrontMatter.tags;

		if (!contentWithFrontMatter.notionPageId) {
			await this.createEmptyNotionPage(
				file,
				contentWithFrontMatter,
				tags
			);
		}

		contentWithFrontMatter = await this.getContent(file);
		const notionPageId = contentWithFrontMatter.notionPageId;
		const content = await this.convertObsidianLinks(
			contentWithFrontMatter.__content
		);

		await this.notion.clearPageContent(notionPageId);
		const uploadResult = await this.notion.addContentToPage(
			notionPageId,
			content
		);

		this.displayUploadResult(uploadResult, file.basename);
	}

	async getContent(file: TFile): Promise<any> {
		const content = await this.app.vault.read(file);
		const contentWithFrontMatter = yamlFrontMatter.loadFront(content);
		return contentWithFrontMatter;
	}

	async createEmptyNotionPage(
		file: TFile,
		contentWithFrontMatter: any,
		tags: string[] = []
	) {
		// Use notion API to create empty page on notion
		const res = await this.notion.createEmptyPage(file.basename, tags);

		// Retrieve and add notion page URL and page id to the page's properties
		const { url: notionPageUrl, id: notionPageId } = res.json;

		// Reformat the notion page url to expose the workspace id
		// and add the Notion page URL and ID to the front matter of the Obsidian file.
		const notionWorkspaceID = this.settings.notionWorkspaceID;
		contentWithFrontMatter.notionPageUrl = notionPageUrl;
		if (notionWorkspaceID !== "") {
			contentWithFrontMatter.notionPageUrl = notionPageUrl.replace(
				"www.notion.so",
				`${notionWorkspaceID}.notion.site`
			);
		}

		contentWithFrontMatter.notionPageId = notionPageId;

		// Prepare the content for updating the Obsidian file. This involves:
		// - Extracting the main content (removing the YAML front matter).
		// - Converting the YAML front matter into a string.
		// - Removing any trailing newline from the YAML string.
		// - Ensuring there's no leading newline in the main content.
		const { __content: mainContent, ...frontMatter } =
			contentWithFrontMatter;
		const yamlhead = yaml.stringify(frontMatter).replace(/\n$/, "");
		const __content_remove_n = mainContent.replace(/^\n/, "");
		const processedMarkdown = `---\n${yamlhead}\n---\n${__content_remove_n}`;

		// Update the Obsidian file with the new content, which now includes the Notion page link.
		try {
			await file.vault.modify(file, processedMarkdown);
		} catch (error) {
			new Notice(`write file error ${error}`);
		}
	}

	async createEmptyMarkdownFile(pageName: string): Promise<TFile> {
		const newFilePath = `/${pageName}.md`;
		const newFile = await this.app.vault.create(newFilePath, "");
		return newFile;
	}

	/**
	 * Convert Obsidian wiki-link into hyperlink.
	 *
	 * The hyperlink will have the same name as the wiki-link, but it will link
	 * to the corresponding Notion page.
	 *
	 * We parse wiki-link into hyperlink because Notion doesn't understand wiki-link
	 * and we haven't built a parser from wiki-link to Notion internal page mention.
	 *
	 * @param markdown Original markdown content of an Obsidian markdown file
	 * @returns Same markdown content, with wiki-link turned into hyperlink.
	 */
	async convertObsidianLinks(markdown: string): Promise<string> {
		const obsidianLinkRegex = /\[\[([^\]]+)\]\]/g;
		let updatedMarkdown = markdown;
		const markdownFiles = this.app.vault.getMarkdownFiles();

		// Find all unique Obsidian links in the markdown
		const links = new Set<string>();
		let match;
		while ((match = obsidianLinkRegex.exec(markdown)) !== null) {
			links.add(match[1]);
		}

		for (const pageName of links) {
			let file = markdownFiles.find((f) => f.basename === pageName);

			// if file doesn't exist, create it
			if (!file) {
				file = await this.createEmptyMarkdownFile(pageName);
			}

			if (!file) {
				continue;
			}

			// If file exists but doesn't have a corresponding notion page
			// create an empty notion page
			let contentWithFrontMatter: any = await this.getContent(file);
			if (!contentWithFrontMatter.notionPageUrl) {
				await this.createEmptyNotionPage(file, contentWithFrontMatter);
			}

			contentWithFrontMatter = await this.getContent(file);
			const notionPageUrl = contentWithFrontMatter.notionPageUrl;

			updatedMarkdown = updatedMarkdown.replace(
				new RegExp(
					`\\[\\[${pageName.replace(
						/[.*+?^${}()|[\]\\]/g,
						"\\$&"
					)}\\]\\]`,
					"g"
				),
				`[${pageName}](${notionPageUrl})`
			);
		}

		return updatedMarkdown;
	}

	displayUploadResult(uploadResult: any, fileName: string) {
		if (uploadResult && uploadResult.status === 200) {
			new Notice(`${langConfig["sync-success"]}${fileName}`);
		} else {
			const errorMessage = uploadResult?.text || langConfig["sync-fail"];
			new Notice(`${errorMessage}${fileName}`, 5000);
		}
	}
}
