import { PluginSettingTab, Setting, App } from "obsidian";
import ObsidianSyncNotionPlugin from "main";

export interface PluginSettings {
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

export class SampleSettingTab extends PluginSettingTab {
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
