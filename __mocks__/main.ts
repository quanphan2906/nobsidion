import { TFile, App, PluginManifest } from "obsidian";
import { PluginSettings } from "../service/types";
import { NoticeMessageConfig } from "../service/utils";

class Nobsidion {
	settings: PluginSettings;
	message: { [key: string]: string };
	fileNameToFile: Map<string, TFile>;

	constructor(app: App, manifest: PluginManifest) {
		this.settings = {
			notionAPIToken: "",
			databaseID: "",
			bannerUrl: "",
			notionWorkspaceID: "",
			allowTags: false,
		};
		this.message = NoticeMessageConfig("en");
		this.fileNameToFile = new Map<string, TFile>();
	}

	getContent = jest.fn().mockResolvedValue({
		tags: ["example", "test"],
		notionPageId: "12345",
		notionPageUrl: "https://www.notion.so/12345",
		__content:
			"This is a **markdown** document.\n\n- Point 1\n- Point 2\n\nEnd of document.",
	});

	createEmptyMarkdownFile = jest.fn().mockResolvedValue({
		basename: "New Document",
	});

	updateMarkdownFile = jest.fn();
}

export default Nobsidion;
