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
import {
	PluginSettings,
	MarkdownWithFrontMatter,
	ServiceResult,
} from "lib/types";
import { NobsidionSettingTab } from "lib/nobsidionSettingsTab";
import { NoticeMessageConfig, getBasenameFromPath } from "lib/helper";
import { uploadFile } from "lib";

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
		this.addSettingTab(new NobsidionSettingTab(this.app, this));
	}

	async saveSettings() {
		await this.saveData(this.settings);
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
		const uploadResult = await uploadFile(this, file);
		this.displayResult(uploadResult, file.basename);
	}

	async getContent(file: TFile): Promise<MarkdownWithFrontMatter> {
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

	displayResult(uploadResult: ServiceResult, pageName: string) {
		if (uploadResult.error) {
			const errorMessage = uploadResult.error.message;
			new Notice(`${errorMessage}${pageName}`, 5000);
			return;
		}

		new Notice(`${this.message["sync-success"]}${pageName}`);
	}
}
