import { App, Notice, Plugin, PluginManifest, TFile } from "obsidian";
import * as yamlFrontMatter from "yaml-front-matter";
import * as yaml from "yaml";
import { Notion } from "lib/notion";
import { NoticeMConfig } from "lib/messenger";
import { PluginSettings } from "lib/settings";
import { SampleSettingTab } from "lib/settings";

// Define your default settings
const DEFAULT_SETTINGS: PluginSettings = {
	notionAPI: "",
	databaseID: "",
	bannerUrl: "",
	notionID: "",
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
				"Please set up the Notion API and database ID in the settings tab."
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
		const { notionAPI, databaseID } = this.settings;
		return notionAPI !== "" && databaseID !== "";
	}

	async uploadFile(file: TFile): Promise<void> {
		let contentWithFrontMatter: any = await this.getContent(file);

		let tags = [];
		if (this.settings.allowTags) tags = contentWithFrontMatter.tags;

		if (!contentWithFrontMatter.notionID) {
			await this.createEmptyNotionPage(file, file.basename, tags);
		}

		contentWithFrontMatter = await this.getContent(file);
		const notionPageID = contentWithFrontMatter.notionID;
		const content = await this.convertObsidianLinks(
			contentWithFrontMatter.__content
		);

		await this.notion.clearPageContent(notionPageID);
		const uploadResult = await this.notion.addContentToPage(
			notionPageID,
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
		pageName: string,
		tags: string[] = []
	) {
		const res = await this.notion.createEmptyPage(pageName, tags);
		await this.updateYamlInfo(file, res);
	}

	async createEmptyMarkdownFile(pageName: string): Promise<TFile> {
		const newFilePath = `/${pageName}.md`;
		const newFile = await this.app.vault.create(newFilePath, "");
		return newFile;
	}

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
			if (!contentWithFrontMatter.link) {
				await this.createEmptyNotionPage(file, file.basename);
			}

			contentWithFrontMatter = await this.getContent(file);
			const notionPageUrl = contentWithFrontMatter.link;

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

	async updateYamlInfo(nowFile: TFile, res: any) {
		const markdown = await this.app.vault.read(nowFile);
		const yamlObj: any = yamlFrontMatter.loadFront(markdown);
		let { url, id } = res.json;
		const notionID = this.settings.notionID;

		if (notionID !== "") {
			url = url.replace("www.notion.so", `${notionID}.notion.site`);
		}

		yamlObj.link = url;
		try {
			await navigator.clipboard.writeText(url);
		} catch (error) {
			new Notice(`复制链接失败，请手动复制${error}`);
		}

		yamlObj.notionID = id;
		const content = this.composeYamlContent(yamlObj);
		try {
			await nowFile.vault.modify(nowFile, content);
		} catch (error) {
			new Notice(`write file error ${error}`);
		}
	}

	private composeYamlContent(yamlObj: any): string {
		const __content = yamlObj.__content;
		delete yamlObj.__content;
		const yamlhead = yaml.stringify(yamlObj).replace(/\n$/, "");
		const __content_remove_n = __content.replace(/^\n/, "");
		return `---\n${yamlhead}\n---\n${__content_remove_n}`;
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
