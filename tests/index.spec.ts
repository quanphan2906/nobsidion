jest.mock("obsidian");
jest.mock("../service/notion");

import {
	// uploadFile,
	initializeNotionPage,
	// convertObsidianLinks,
} from "../service/index";

import Nobsidion from "main";
import { TFile, App, PluginManifest } from "obsidian";

// The line belows allow me to access and mock other functions in service/index while
// I am testing one function. Don't delete it.
// import * as service from "../service/index";

describe("uploadFile", () => {
	let nobsidionMock: Nobsidion; // can I just use Nobsidion type here?
	let fileMock: TFile;

	beforeEach(() => {
		jest.clearAllMocks();
		nobsidionMock = new Nobsidion(new App(), {} as PluginManifest);
		fileMock = new TFile();
	});

	it("test initializeNotionPage using file with notionPageId", async () => {
		await initializeNotionPage(
			nobsidionMock as unknown as Nobsidion,
			fileMock
		);

		expect(nobsidionMock.getContent).toHaveBeenCalled();
		expect(fileMock.basename).toBe("New document");
	});
});
