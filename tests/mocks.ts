import { TFile } from "obsidian";
import { NoticeMessageConfig } from "../service/utils";
import { PluginSettings } from "service/types";

export type NobsidionMockType = {
	settings: PluginSettings;
	message: { [key: string]: string };
	fileNameToFile: Map<string, TFile>;
	getContent: jest.Mock;
	createEmptyMarkdownFile: jest.Mock;
	updateMarkdownFile: jest.Mock;
	initializeMock: (fileName: string, file: TFile) => void;
};

export interface TFileMockType {
	basename: string;
}

export const nobsidionDefaultMock: NobsidionMockType = {
	settings: {
		notionAPIToken: "",
		databaseID: "",
		bannerUrl: "",
		notionWorkspaceID: "",
		allowTags: false,
	},
	message: NoticeMessageConfig("en"),
	fileNameToFile: new Map<string, TFile>(),

	getContent: jest.fn().mockResolvedValue({
		tags: ["example", "test"],
		notionPageId: "12345",
		notionPageUrl: "https://www.notion.so/12345",
		__content:
			"This is a **markdown** document.\n\n- Point 1\n- Point 2\n\nEnd of document.",
	}),
	createEmptyMarkdownFile: jest.fn().mockResolvedValue({
		basename: "NewDocument",
	}),
	updateMarkdownFile: jest.fn(),

	initializeMock(fileName: string, file: TFile) {
		this.fileNameToFile.set(fileName, file);
	},
};

export const fileDefaultMock: TFileMockType = {
	basename: "New Document",
};
