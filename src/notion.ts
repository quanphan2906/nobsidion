import { Notice, requestUrl, TFile } from "obsidian";
import { markdownToBlocks } from "@tryfabric/martian";
import * as yamlFrontMatter from "yaml-front-matter";
import * as yaml from "yaml";
import MyPlugin from "main";

export class Notion {
	plugin: MyPlugin;

	constructor(plugin: MyPlugin) {
		this.plugin = plugin;
	}

	async syncMarkdownToNotion(
		title: string,
		tags: string[],
		markdown: string,
		nowFile: TFile
	): Promise<any> {
		let res: any;
		const yamlObj: any = yamlFrontMatter.loadFront(markdown);
		const content = yamlObj.__content;
		const file2Block = markdownToBlocks(content);
		const frontmatter = await this.plugin.app.metadataCache.getFileCache(
			nowFile
		)?.frontmatter;
		const notionID = frontmatter ? frontmatter.notionID : null;

		if (notionID) {
			res = await this.updatePage(notionID, title, tags, file2Block);
		} else {
			res = await this.createPage(title, tags, file2Block);
		}

		if (res.status === 200) {
			await this.updateYamlInfo(markdown, nowFile, res);
		} else {
			new Notice(`${res.text}`);
		}

		return res;
	}

	async createPage(title: string, tags: string[], children: any) {
		const databaseID = this.plugin.settings.databaseID;
		const notionAPI = this.plugin.settings.notionAPI;
		const bannerUrl = this.plugin.settings.bannerUrl || null; // Use null if bannerUrl is not set
		const allowTags = this.plugin.settings.allowTags;

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
		}
	}

	async updatePage(
		notionID: string,
		title: string,
		tags: string[],
		children: any
	) {
		await this.deletePage(notionID);
		const res = await this.createPage(title, tags, children);
		return res;
	}

	async deletePage(notionID: string) {
		const notionAPI = this.plugin.settings.notionAPI;
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

	async updateYamlInfo(yamlContent: string, nowFile: TFile, res: any) {
		const yamlObj: any = yamlFrontMatter.loadFront(yamlContent);
		let { url, id } = res.json;
		const notionID = this.plugin.settings.notionID;

		if (notionID !== "") {
			url = url.replace("www.notion.so", `${notionID}.notion.site`);
		}

		yamlObj.link = url;
		try {
			await navigator.clipboard.writeText(url);
		} catch (error) {
			new Notice(`复制链接失败，请手动复制${error}`);
		}

		yamlObj.notionID = id;
		const content = this.composeYamlContent(yamlObj);
		try {
			await nowFile.vault.modify(nowFile, content);
		} catch (error) {
			new Notice(`write file error ${error}`);
		}
	}

	private composeYamlContent(yamlObj: any): string {
		const __content = yamlObj.__content;
		delete yamlObj.__content;
		const yamlhead = yaml.stringify(yamlObj).replace(/\n$/, "");
		const __content_remove_n = __content.replace(/^\n/, "");
		return `---\n${yamlhead}\n---\n${__content_remove_n}`;
	}
}
