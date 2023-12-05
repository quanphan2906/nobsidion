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
import notion from "lib/notion";
import { PluginSettings } from "lib/settings";
import { SampleSettingTab } from "lib/settings";
import {
	NoticeMessageConfig,
	getWikiLinkFromMarkdown,
	prepareNotionPageAndUpdateMarkdown,
	replaceWikiWithHyperLink,
	getBasenameFromPath,
} from "lib/helper";

// Define your default settings
const DEFAULT_SETTINGS: PluginSettings = {
	notionAPIToken: "",
	databaseID: "",
	bannerUrl: "",
	notionWorkspaceID: "",
	allowTags: false,
};

export default class Nobsidion extends Plugin {
	settings: PluginSettings;
	message: { [key: string]: string };
	fileNameToFile: Map<string, TFile>;

	constructor(app: App, manifest: PluginManifest) {
		super(app, manifest);
		this.settings = DEFAULT_SETTINGS;
		this.message = NoticeMessageConfig(
			window.localStorage.getItem("language") || "en"
		);
	}

	async onload() {
		// Retrieve settings from settings tab
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);

		// Add commands to vault
		this.addCustomCommands();

		// Furnish the map
		const markdownFiles = this.app.vault.getMarkdownFiles();
		markdownFiles.forEach((file) => {
			this.fileNameToFile.set(file.basename, file);
		});

		// Register events
		this.registerCustomEvents();

		// Add settings tab to plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));
	}

	addCustomCommands() {
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
	}

	registerCustomEvents() {
		this.registerEvent(
			this.app.vault.on("create", (file) => {
				if (file instanceof TFile) {
					this.fileNameToFile.set(file.basename, file);
				}
			})
		);

		this.registerEvent(
			this.app.vault.on("delete", (file) => {
				if (file instanceof TFile) {
					this.fileNameToFile.delete(file.basename);
				}
			})
		);

		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => {
				if (file instanceof TFile) {
					const oldName = getBasenameFromPath(oldPath);
					this.fileNameToFile.delete(oldName);
					this.fileNameToFile.set(file.basename, file);
				}
			})
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async uploadCurrentNote() {
		if (!this.hasValidNotionCredentials()) {
			new Notice(this.message["config-settings"]);
			return;
		}

		const nowFile = this.app.workspace.getActiveFile();
		if (!nowFile) {
			new Notice(this.message["open-file"]);
			return null;
		}

		this.uploadFile(nowFile);
	}

	async bulkUpload() {
		if (!this.hasValidNotionCredentials()) {
			new Notice(this.message["config-settings"]);
			return;
		}

		const markdownFiles = this.app.vault.getMarkdownFiles();
		for (const file of markdownFiles) {
			this.uploadFile(file);
		}

		new Notice(this.message["all-sync-success"]);
	}

	hasValidNotionCredentials() {
		const { notionAPIToken, databaseID } = this.settings;
		return notionAPIToken !== "" && databaseID !== "";
	}

	async uploadFile(file: TFile): Promise<void> {
		const contentWithFrontMatter = this.initializeNotionPage(file);
		const uploadResult = await this.uploadContentToNotion(
			contentWithFrontMatter
		);

		// display result
		if (uploadResult && uploadResult.status === 200) {
			new Notice(`${this.message["sync-success"]}${file.basename}`);
		} else {
			const errorMessage =
				uploadResult?.text || this.message["sync-fail"];
			new Notice(`${errorMessage}${file.basename}`, 5000);
		}
	}

	async initializeNotionPage(file: TFile): Promise<any> {
		const contentWithFrontMatter = await this.getContent(file);

		if (!contentWithFrontMatter.notionPageId) {
			// contentWithFrontMatter will be updated with notionPageId and notionPageUrl
			// not the best practice to modify an argument object in a function
			// but will get back to that later
			const processedMarkdown = await prepareNotionPageAndUpdateMarkdown(
				this.settings,
				contentWithFrontMatter,
				file.basename
			);

			this.updateMarkdownFile(file, processedMarkdown);
		}

		return contentWithFrontMatter;
	}

	async uploadContentToNotion(contentWithFrontMatter: any): Promise<any> {
		const content = await this.convertObsidianLinks(
			contentWithFrontMatter.__content
		);
		const uploadResult = await notion.uploadFileContent(
			this.settings,
			contentWithFrontMatter.notionPageId,
			content
		);

		return uploadResult;
	}

	async getContent(file: TFile): Promise<any> {
		const content = await this.app.vault.read(file);
		const contentWithFrontMatter = yamlFrontMatter.loadFront(content);
		return contentWithFrontMatter;
	}

	async createEmptyMarkdownFile(pageName: string): Promise<TFile> {
		const newFilePath = `/${pageName}.md`;
		const newFile = await this.app.vault.create(newFilePath, "");
		// file create handler will update fileNameToFile Map
		// see registerCustomEvents
		return newFile;
	}

	async updateMarkdownFile(file: TFile, newContent: string): Promise<void> {
		await file.vault.modify(file, newContent);
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
	 *
	 * 1. Retrieve all the wiki links from markdown
	 * 2. See which wiki-link doesn't exist --> wikiLinkNotExist
	 * 3. Create markdown files from all the links in wikiLinkNotExist
	 * 4. Init notion page for all pages
	 * 5.
	 */
	async convertObsidianLinks(markdown: string): Promise<string> {
		const links = getWikiLinkFromMarkdown(markdown);
		let updatedMarkdown = markdown;

		for (const pageName of links) {
			let file: TFile | undefined;

			if (pageName in this.fileNameToFile) {
				file = this.fileNameToFile.get(pageName);
			}

			// if file doesn't exist, create it
			if (!file) file = await this.createEmptyMarkdownFile(pageName);
			if (!file) continue;

			// If file exists but doesn't have a corresponding notion page
			// create an empty notion page
			const contentWithFrontMatter = await this.initializeNotionPage(
				file
			);
			const notionPageUrl = contentWithFrontMatter.notionPageUrl;

			updatedMarkdown = replaceWikiWithHyperLink(
				updatedMarkdown,
				pageName,
				pageName,
				notionPageUrl
			);
		}

		return updatedMarkdown;
	}
}
