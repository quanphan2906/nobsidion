/*
    Originally created by EasyChris (2022) as Upload2Notion.ts
    Renamed and modified by Quan Phan (2023)

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

import { Notice, requestUrl } from "obsidian";
import { markdownToBlocks } from "@tryfabric/martian";
import { PluginSettings, ServiceResult } from "./types";

const createEmptyPage = async (
	settings: PluginSettings,
	title: string,
	tags: string[] = []
): Promise<ServiceResult> => {
	let res = null;

	const { databaseID, notionAPIToken, allowTags, bannerUrl } = settings;

	const bodyString: any = {
		parent: { database_id: databaseID },
		properties: {
			Name: {
				title: [{ text: { content: title } }],
			},
			Tags: {
				multi_select:
					allowTags && tags ? tags.map((tag) => ({ name: tag })) : [],
			},
		},
	};

	if (bannerUrl) {
		bodyString.cover = {
			type: "external",
			external: { url: bannerUrl },
		};
	}

	try {
		res = await requestUrl({
			url: `https://api.notion.com/v1/pages`,
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${notionAPIToken}`,
				"Notion-Version": "2021-08-16",
			},
			body: JSON.stringify(bodyString),
		});

		return { data: res.json, error: null };
	} catch (error) {
		new Notice(`network error ${error}`);
		return { data: res, error };
	}
};

const addContentToPage = async (
	settings: PluginSettings,
	notionPageId: string,
	content: string
): Promise<ServiceResult> => {
	let res = null;
	const notionAPIToken = settings.notionAPIToken;

	const blocks = markdownToBlocks(content);

	try {
		res = await requestUrl({
			url: `https://api.notion.com/v1/blocks/${notionPageId}/children`,
			method: "PATCH",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${notionAPIToken}`,
				"Notion-Version": "2021-08-16",
			},
			body: JSON.stringify({ children: blocks }),
		});
		return { data: res.json, error: null };
	} catch (error) {
		new Notice(`Error adding content to Notion page: ${error}`);
		return { data: res, error };
	}
};

const clearPageContent = async (
	settings: PluginSettings,
	notionPageId: string
): Promise<ServiceResult> => {
	const notionAPIToken = settings.notionAPIToken;

	try {
		// Retrieve the list of block children for the given page ID
		const listResponse = await requestUrl({
			url: `https://api.notion.com/v1/blocks/${notionPageId}/children`,
			method: "GET",
			headers: {
				Authorization: `Bearer ${notionAPIToken}`,
				"Notion-Version": "2021-08-16",
			},
		});

		// Check if the response contains blocks and delete them if it does
		if (listResponse && listResponse.json && listResponse.json.results) {
			for (const block of listResponse.json.results) {
				// Each block has an ID, which you can use to delete it
				await requestUrl({
					url: `https://api.notion.com/v1/blocks/${block.id}`,
					method: "DELETE",
					headers: {
						Authorization: `Bearer ${notionAPIToken}`,
						"Notion-Version": "2021-08-16",
					},
				});
			}
			new Notice("All content cleared from the Notion page.");
		}

		return { data: "Delete succeed", error: null };
	} catch (error) {
		console.error("Error clearing Notion page content:", error);
		new Notice(`Error clearing content from Notion page: ${error}`);
		return { data: null, error };
	}
};

const uploadFileContent = async (
	settings: PluginSettings,
	notionPageId: string,
	content: string
): Promise<ServiceResult> => {
	const { error } = await clearPageContent(settings, notionPageId);
	if (error) {
		return { data: null, error };
	}

	const uploadResult = await addContentToPage(
		settings,
		notionPageId,
		content
	);

	return uploadResult;
};

const notion = {
	createEmptyPage,
	uploadFileContent,
};

export default notion;
