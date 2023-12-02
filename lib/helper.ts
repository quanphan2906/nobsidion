/*
    Created by Quan Phan (2023)

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

import * as yaml from "yaml";
import { TFile, addIcon } from "obsidian";
import { NoticeMsg } from "./message";
import { icons } from "./icon";
import { PluginSettings } from "./settings";
import notion from "./notion";

/**
 *
 * @param lang
 * @returns
 */
export const NoticeMessageConfig = (
	lang: string
): { [key: string]: string } => {
	return NoticeMsg[lang];
};

/**
 *
 */
export const addIcons = (): void => {
	Object.keys(icons).forEach((key) => {
		addIcon(key, icons[key]);
	});
};

/**
 * Parse front matter (result of yaml.loadFront) back into markdown
 * @param contentWithFrontMatter
 * @returns
 */
export const fromYamlFrontMatterToMarkdown = (
	contentWithFrontMatter: any
): string => {
	const { __content: mainContent, ...frontMatter } = contentWithFrontMatter;
	/**
	 * Converting the YAML front matter into a string.
	 * Removing any trailing newline from the YAML string.
	 * Remove all leading newline in the main content.
	 */
	const yamlhead = yaml.stringify(frontMatter).replace(/\n$/, "");
	const __content_remove_n = mainContent.replace(/^\n/, "");

	// Concatenate to create final markdown
	const processedMarkdown = `---\n${yamlhead}\n---\n${__content_remove_n}`;

	return processedMarkdown;
};

/**
 *
 * @param notionPageUrl
 * @param notionWorkspaceId
 * @returns
 */
export const updateNotionPageUrlWithWorkspaceId = (
	notionPageUrl: string,
	notionWorkspaceId: string
): string => {
	if (notionWorkspaceId == "") return notionPageUrl;

	return notionPageUrl.replace(
		"www.notion.so",
		`${notionWorkspaceId}.notion.site`
	);
};

export const prepareNotionPageAndUpdateMarkdown = async (
	settings: PluginSettings,
	contentWithFrontMatter: any,
	fileName: string
): Promise<string> => {
	const { url: rawNotionPageUrl, id: notionPageId } =
		await notion.createEmptyPage(settings, fileName);
	const notionPageUrl = updateNotionPageUrlWithWorkspaceId(
		rawNotionPageUrl,
		settings.notionWorkspaceID
	);

	contentWithFrontMatter.notionPageId = notionPageId;
	contentWithFrontMatter.notionPageUrl = notionPageUrl;

	return fromYamlFrontMatterToMarkdown(contentWithFrontMatter);
};

export const getWikiLinkFromMarkdown = (markdown: string): Set<string> => {
	const obsidianLinkRegex = /\[\[([^\]]+)\]\]/g;
	// Find all unique Obsidian links in the markdown
	const links = new Set<string>();
	let match;
	while ((match = obsidianLinkRegex.exec(markdown)) !== null) {
		links.add(match[1]);
	}
	return links;
};

export const replaceWikiWithHyperLink = (
	markdown: string,
	wikiName: string,
	hyperLinkName: string,
	hyperlink: string
) => {
	return markdown.replace(
		new RegExp(
			`\\[\\[${wikiName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\]\\]`,
			"g"
		),
		`[${hyperLinkName}](${hyperlink})`
	);
};

export const getWikiNotExist = (
	wikis: Set<string>,
	markdownFiles: Array<TFile>
): Set<string> => {
	const wikinotExist = new Set<string>();
	for (const pageName of wikis) {
		const file = markdownFiles.find((f) => f.basename === pageName);
		if (!file) wikinotExist.add(pageName);
	}
	return wikinotExist;
};
