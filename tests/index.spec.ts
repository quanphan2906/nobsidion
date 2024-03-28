import Nobsidion from "main";
import {
	// uploadFile,
	initializeNotionPage,
	// convertObsidianLinks,
} from "../service/index";

// import * as service from "../service/index";

// import notion from "../service/notion";

import {
	NobsidionMockType,
	TFileMockType,
	nobsidionDefaultMock,
	fileDefaultMock,
} from "./mocks";
import { TFile } from "obsidian";

// jest.mock("../service/notion");
// const mockNotion = jest.mocked(notion);

describe("uploadFile", () => {
	let nobsidionMock: NobsidionMockType;
	let fileMock: TFileMockType;

	beforeEach(() => {
		jest.clearAllMocks();
		nobsidionMock = nobsidionDefaultMock;
		fileMock = fileDefaultMock;
	});

	it("test initializeNotionPage using file with notionPageId", async () => {
		await initializeNotionPage(
			nobsidionMock as unknown as Nobsidion,
			fileMock as unknown as TFile
		);

		expect(nobsidionMock.getContent).toHaveBeenCalled();
	});
});
