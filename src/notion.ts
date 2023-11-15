import { FrontMatterCache, Notice, requestUrl } from "obsidian";
import { markdownToBlocks } from "@tryfabric/martian";
import * as yamlFrontMatter from "yaml-front-matter";
import { PluginSettings } from "./settings";

export class Notion {
	settings: PluginSettings;

	constructor(settings: PluginSettings) {
		this.settings = settings;
		// TODO: extract settings to bring settings here instead of bringing the entire plugin
	}

	async syncMarkdownToNotion(
		title: string,
		tags: string[],
		markdown: string,
		frontmatter: FrontMatterCache | undefined
	): Promise<any> {
		const yamlObj: any = yamlFrontMatter.loadFront(markdown);
		const content = yamlObj.__content;
		const file2Block = markdownToBlocks(content);
		const notionID = frontmatter ? frontmatter.notionID : null;

		if (notionID) {
			await this.deletePage(notionID);
		}

		const res = await this.createPage(title, tags, file2Block);

		return res;
	}

	async createPage(title: string, tags: string[], children: any) {
		const databaseID = this.settings.databaseID;
		const notionAPI = this.settings.notionAPI;
		const bannerUrl = this.settings.bannerUrl || null; // Use null if bannerUrl is not set
		const allowTags = this.settings.allowTags;

		const bodyString: any = {
			parent: {
				database_id: databaseID,
			},
			properties: {
				Name: {
					title: [
						{
							text: {
								content: title,
							},
						},
					],
				},
				Tags: {
					multi_select:
						allowTags && tags
							? tags.map((tag) => ({ name: tag }))
							: [],
				},
			},
			children,
		};

		if (bannerUrl) {
			bodyString.cover = {
				type: "external",
				external: {
					url: bannerUrl,
				},
			};
		}

		try {
			const response = await requestUrl({
				url: `https://api.notion.com/v1/pages`,
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${notionAPI}`,
					"Notion-Version": "2021-08-16",
				},
				body: JSON.stringify(bodyString),
			});
			return response;
		} catch (error) {
			new Notice(`network error ${error}`);
			// TODO: At least return something here to conform to the return type
		}
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

	async deletePage(notionID: string) {
		const notionAPI = this.settings.notionAPI;
		const response = await requestUrl({
			url: `https://api.notion.com/v1/blocks/${notionID}`,
			method: "DELETE",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${notionAPI}`,
				"Notion-Version": "2022-02-22",
			},
		});
		return response;
	}
}
