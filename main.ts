import {
	App,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
} from "obsidian";
import { Notion } from "src/notion";
import { NoticeMConfig } from "src/messenger";
import { addIcons } from "src/icon";

// Define your PluginSettings interface
interface PluginSettings {
	notionAPI: string;
	databaseID: string;
	bannerUrl: string;
	notionID: string;
	allowTags: boolean;
}

type StringKeys<T> = Exclude<
	{ [K in keyof T]: T[K] extends string ? K : never }[keyof T],
	undefined
>;

type BooleanKeys<T> = Exclude<
	{ [K in keyof T]: T[K] extends boolean ? K : never }[keyof T],
	undefined
>;

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

	// Plugin loading lifecycle method
	async onload() {
		await this.loadSettings();

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

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async uploadCurrentNote() {
		// Check for Notion API and Database ID setup
		if (!this.hasValidNotionCredentials()) {
			new Notice(
				"Please set up the Notion API and database ID in the settings tab."
			);
			return;
		}

		// Get content of the current file
		const currentFileContent = await this.getCurrentFileContent();
		if (!currentFileContent) {
			// Appropriate notice is already shown in getCurrentFileContent method
			return;
		}

		const { markDownData, nowFile, tags } = currentFileContent;
		const uploadResult = await this.uploadToNotion(
			markDownData,
			nowFile,
			tags
		);

		// Display the result as a notice
		this.displayUploadResult(uploadResult, nowFile.basename);
	}

	// New method for bulk uploading
	async bulkUpload() {
		// Check for Notion API and Database ID setup
		if (!this.hasValidNotionCredentials()) {
			new Notice(
				"Please set up the Notion API and database ID in the settings tab."
			);
			return;
		}

		// Get all markdown files from the vault
		const markdownFiles = this.app.vault.getMarkdownFiles();

		// Iterate over all markdown files
		for (const file of markdownFiles) {
			const markDownData = await this.app.vault.read(file);
			const tags = this.getTagsFromCurrentFile(file);

			if (markDownData) {
				const uploadResult = await this.uploadToNotion(
					markDownData,
					file,
					tags
				);

				// Display the result as a notice
				this.displayUploadResult(uploadResult, file.basename);
			}
		}

		// Display a notice when all files have been processed
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
		const tags = this.getTagsFromCurrentFile(nowFile);
		return {
			markDownData,
			nowFile,
			tags,
		};
	}

	getTagsFromCurrentFile(nowFile: TFile) {
		const { allowTags } = this.settings;
		if (allowTags) {
			try {
				return (
					this.app.metadataCache.getFileCache(nowFile)?.frontmatter
						?.tags || []
				);
			} catch (error) {
				new Notice(langConfig["set-tags-fail"]);
				return [];
			}
		}
		return [];
	}

	async uploadToNotion(markDownData: string, nowFile: TFile, tags: string[]) {
		const upload = new Notion(this);
		return await upload.syncMarkdownToNotion(
			nowFile.basename,
			tags,
			markDownData,
			nowFile
		);
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

class SampleSettingTab extends PluginSettingTab {
	plugin: ObsidianSyncNotionPlugin;

	constructor(app: App, plugin: ObsidianSyncNotionPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();
		containerEl.createEl("h2", {
			text: "Settings for Obsidian to Notion plugin.",
		});

		this.createTextSetting(containerEl, {
			name: "Notion API Token",
			desc: "Your Notion integration API token.",
			placeholder: "Enter your Notion API Token",
			settingKey: "notionAPI",
			isPassword: true,
		});

		this.createTextSetting(containerEl, {
			name: "Database ID",
			desc: "The ID of your Notion database.",
			placeholder: "Enter your Database ID",
			settingKey: "databaseID",
			isPassword: false,
		});

		this.createTextSetting(containerEl, {
			name: "Banner URL (optional)",
			desc: "Page banner URL. If you want to show a banner, please enter the URL.",
			placeholder: "Enter banner pic URL",
			settingKey: "bannerUrl",
			isPassword: false,
		});

		this.createTextSetting(containerEl, {
			name: "Notion ID (optional)",
			desc: "Your Notion ID for shared links. Format: https://username.notion.site/",
			placeholder: "Enter Notion ID",
			settingKey: "notionID",
			isPassword: false,
		});

		this.createToggleSetting(containerEl, {
			name: "Convert tags (optional)",
			desc: "Transfer Obsidian tags to the Notion table. Requires a 'Tags' column in Notion.",
			settingKey: "allowTags",
		});
	}

	createTextSetting(
		containerEl: HTMLElement,
		options: {
			name: string;
			desc: string;
			placeholder: string;
			settingKey: StringKeys<PluginSettings>;
			isPassword: boolean;
		}
	) {
		new Setting(containerEl)
			.setName(options.name)
			.setDesc(options.desc)
			.addText((text) => {
				text.setPlaceholder(options.placeholder)
					.setValue(this.plugin.settings[options.settingKey])
					.onChange(async (value) => {
						this.plugin.settings[options.settingKey] = value;
						await this.plugin.saveSettings();
					});
				if (options.isPassword) {
					text.inputEl.type = "password";
				}
			});
	}

	createToggleSetting(
		containerEl: HTMLElement,
		options: {
			name: string;
			desc: string;
			settingKey: BooleanKeys<PluginSettings>;
		}
	) {
		new Setting(containerEl)
			.setName(options.name)
			.setDesc(options.desc)
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings[options.settingKey])
					.onChange(async (value) => {
						this.plugin.settings[options.settingKey] = value;
						await this.plugin.saveSettings();
					});
			});
	}
}
