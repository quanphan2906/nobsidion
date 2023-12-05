import { TFile } from "obsidian";
import Nobsidion from "main";
import { MarkdownWithFrontMatter, ServiceResult } from "./types";
import notion from "./notion";
import {
	updateNotionPageUrlWithWorkspaceId,
	fromYamlFrontMatterToMarkdown,
	getWikiLinkFromMarkdown,
	replaceWikiWithHyperLink,
} from "./utils";

export const uploadFile = async (
	nobsidion: Nobsidion,
	file: TFile
): Promise<ServiceResult> => {
	const contentWithFrontMatter = await initializeNotionPage(nobsidion, file);

	const content = await convertObsidianLinks(
		nobsidion,
		contentWithFrontMatter.__content
	);

	if (contentWithFrontMatter.notionPageId) {
		const uploadResult = await notion.uploadFileContent(
			nobsidion.settings,
			contentWithFrontMatter.notionPageId,
			content
		);

		return uploadResult;
	}

	return { data: null, error: Error("Something happened") };
};

export const initializeNotionPage = async (
	nobsidion: Nobsidion,
	file: TFile
): Promise<MarkdownWithFrontMatter> => {
	const contentWithFrontMatter = await nobsidion.getContent(file);

	const settings = nobsidion.settings;

	if (!contentWithFrontMatter.notionPageId) {
		const { data, error } = await notion.createEmptyPage(
			nobsidion.settings,
			file.basename
		);
		const { url: rawNotionPageUrl, id: notionPageId } = data;

		const notionPageUrl = updateNotionPageUrlWithWorkspaceId(
			rawNotionPageUrl,
			settings.notionWorkspaceID
		);

		contentWithFrontMatter.notionPageId = notionPageId;
		contentWithFrontMatter.notionPageUrl = notionPageUrl;

		const processedMarkdown = fromYamlFrontMatterToMarkdown(
			contentWithFrontMatter
		);

		nobsidion.updateMarkdownFile(file, processedMarkdown);
	}

	return contentWithFrontMatter;
};

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
 */
const convertObsidianLinks = async (
	nobsidion: Nobsidion,
	markdown: string
): Promise<string> => {
	const links = getWikiLinkFromMarkdown(markdown);
	let updatedMarkdown = markdown;

	for (const pageName of links) {
		let file: TFile | undefined;

		if (pageName in nobsidion.fileNameToFile) {
			file = nobsidion.fileNameToFile.get(pageName);
		}

		// if file doesn't exist, create it
		if (!file) file = await nobsidion.createEmptyMarkdownFile(pageName);
		if (!file) continue;

		// If file exists but doesn't have a corresponding notion page
		// create an empty notion page
		const contentWithFrontMatter = await initializeNotionPage(
			nobsidion,
			file
		);
		const notionPageUrl = contentWithFrontMatter.notionPageUrl;

		if (notionPageUrl)
			updatedMarkdown = replaceWikiWithHyperLink(
				updatedMarkdown,
				pageName,
				pageName,
				notionPageUrl
			);
	}

	return updatedMarkdown;
};
