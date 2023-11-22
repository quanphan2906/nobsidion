import { Notice, requestUrl } from "obsidian";
import { markdownToBlocks } from "@tryfabric/martian";
import { PluginSettings } from "./settings";

export class Notion {
	settings: PluginSettings;

	constructor(settings: PluginSettings) {
		this.settings = settings;
	}

	async createEmptyPage(title: string, tags: string[]): Promise<any> {
		let res = null;
		const { databaseID, notionAPI, allowTags, bannerUrl } = this.settings;

		const bodyString: any = {
			parent: { database_id: databaseID },
			properties: {
				Name: {
					title: [{ text: { content: title } }],
				},
				Tags: {
					multi_select:
						allowTags && tags
							? tags.map((tag) => ({ name: tag }))
							: [],
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
					Authorization: `Bearer ${notionAPI}`,
					"Notion-Version": "2021-08-16",
				},
				body: JSON.stringify(bodyString),
			});
		} catch (error) {
			new Notice(`network error ${error}`);
		}

		return res;
	}

	async addContentToPage(
		notionPageId: string,
		content: string
	): Promise<any> {
		let res = null;

		const blocks = markdownToBlocks(content);

		try {
			// Add the content blocks to the Notion page
			res = await requestUrl({
				url: `https://api.notion.com/v1/blocks/${notionPageId}/children`,
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${this.settings.notionAPI}`,
					"Notion-Version": "2021-08-16",
				},
				body: JSON.stringify({ children: blocks }),
			});
		} catch (error) {
			new Notice(`Error adding content to Notion page: ${error}`);
		}

		return res;
	}

	async clearPageContent(notionPageId: string): Promise<void> {
		const notionAPI = this.settings.notionAPI;

		try {
			// Retrieve the list of block children for the given page ID
			const listResponse = await requestUrl({
				url: `https://api.notion.com/v1/blocks/${notionPageId}/children`,
				method: "GET",
				headers: {
					Authorization: `Bearer ${notionAPI}`,
					"Notion-Version": "2021-08-16",
				},
			});

			// Check if the response contains blocks and delete them if it does
			if (
				listResponse &&
				listResponse.json &&
				listResponse.json.results
			) {
				for (const block of listResponse.json.results) {
					// Each block has an ID, which you can use to delete it
					await requestUrl({
						url: `https://api.notion.com/v1/blocks/${block.id}`,
						method: "DELETE",
						headers: {
							Authorization: `Bearer ${notionAPI}`,
							"Notion-Version": "2021-08-16",
						},
					});
				}
				new Notice("All content cleared from the Notion page.");
			}
		} catch (error) {
			console.error("Error clearing Notion page content:", error);
			new Notice(`Error clearing content from Notion page: ${error}`);
		}
	}
}
