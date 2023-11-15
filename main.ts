import { App, Notice, Plugin, PluginManifest, TFile } from "obsidian";
import * as yamlFrontMatter from "yaml-front-matter";
import * as yaml from "yaml";
import { Notion } from "src/notion";
import { NoticeMConfig } from "src/messenger";
import { addIcons } from "src/icon";
import { PluginSettings } from "src/settings";
import { SampleSettingTab } from "src/settings";

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

	// Plugin loading lifecycle method
	async onload() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
		this.notion = new Notion(this.settings);

		addIcons();
		this.addRibbonIcon(
			"notion-logo",
			"Share to notion",
			async (evt: MouseEvent) => {
				this.uploadCurrentNote();
			}
		);

		// Add a command that allows individual note upload
		this.addCommand({
			id: "share-to-notion",
			name: "Share to Notion",
			editorCallback: async () => {
				this.uploadCurrentNote();
			},
		});

		// Add a command for bulk upload
		this.addCommand({
			id: "bulk-share-to-notion",
			name: "Upload vault to Notion",
			callback: async () => {
				this.bulkUpload();
			},
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
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

		const currentFileContent = await this.getCurrentFileContent();
		if (!currentFileContent) {
			// Appropriate notice is already shown in getCurrentFileContent method
			return;
		}

		const { markDownData: markdown, nowFile, tags } = currentFileContent;
		const frontmatter =
			this.app.metadataCache.getFileCache(nowFile)?.frontmatter;
		const uploadResult = await this.notion.syncMarkdownToNotion(
			nowFile.basename,
			tags,
			markdown,
			frontmatter
		);

		if (uploadResult && uploadResult.status === 200) {
			await this.updateYamlInfo(markdown, nowFile, uploadResult);
		}

		this.displayUploadResult(uploadResult, nowFile.basename);
	}

	async bulkUpload() {
		if (!this.hasValidNotionCredentials()) {
			new Notice(
				"Please set up the Notion API and database ID in the settings tab."
			);
			return;
		}

		// Create empty pages in Notion for all markdown files
		// Add the notion links and ids to the properties of the obsidian page
		for (const file of this.app.vault.getMarkdownFiles()) {
			console.log(file.name);
			const title = file.basename;
			const tags = this.getTags(file);
			const res = await this.notion.createEmptyPage(title, tags);

			const content = await this.app.vault.read(file);
			console.log("before even call updateYamlInfo", content);
			if (res && res.status === 200) {
				await this.updateYamlInfo(file, res);
			} else {
				new Notice(res?.text || "Failed to create page in Notion.");
			}
		}

		// Second loop: Sync the content with converted hyperlinks
		for (const file of this.app.vault.getMarkdownFiles()) {
			const notionId = this.getNotionId(file);
			const content = await this.app.vault.read(file);
			// Convert Obsidian format into Markdown
			const yamlObj = yamlFrontMatter.loadFront(content);
			let processedContent = yamlObj.__content;
			processedContent = this.convertObsidianLinks(processedContent);

			if (content) {
				const uploadResult = await this.notion.addContentToPage(
					notionId,
					processedContent
				);

				this.displayUploadResult(uploadResult, file.basename);
			}
		}

		new Notice("All files have been processed for upload to Notion.");
	}

	hasValidNotionCredentials() {
		const { notionAPI, databaseID } = this.settings;
		return notionAPI !== "" && databaseID !== "";
	}

	async getCurrentFileContent() {
		const nowFile = this.app.workspace.getActiveFile();
		if (!nowFile) {
			new Notice(langConfig["open-file"]);
			return null;
		}

		const markDownData = await this.app.vault.read(nowFile);
		const tags = this.getTags(nowFile);
		return {
			markDownData,
			nowFile,
			tags,
		};
	}

	getTags(nowFile: TFile): string[] {
		const { allowTags } = this.settings;
		if (allowTags) {
			try {
				return (
					this.app.metadataCache.getFileCache(nowFile)?.frontmatter
						?.tags || []
				);
			} catch (error) {
				new Notice(langConfig["set-tags-fail"]);
			}
		}
		return [];
	}

	getNotionId(nowFile: TFile): string {
		return this.app.metadataCache.getFileCache(nowFile)?.frontmatter
			?.notionID;
	}

	convertObsidianLinks(markdown: string): string {
		const obsidianLinkRegex = /\[\[([^\]]+)\]\]/g;

		return markdown.replace(obsidianLinkRegex, (_, pageName) => {
			// Get all markdown files from the vault
			const markdownFiles = this.app.vault.getMarkdownFiles();

			// Find the file with an exact match on the base name
			const file = markdownFiles.find((f) => f.basename === pageName);
			if (file) {
				const notionPageUrl =
					this.app.metadataCache.getFileCache(file)?.frontmatter
						?.link;
				return `[${pageName}](${notionPageUrl})`;
			}

			return pageName;
		});
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
