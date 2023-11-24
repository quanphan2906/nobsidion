/*
    Originally created by EasyChris (2022) as Message.ts
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

export const NoticeMsg: { [key: string]: { [key: string]: string } } = {
	en: {
		"notion-logo": "Share to notion",
		"sync-success": "Sync to notion success: \n",
		"sync-fail": "Sync to notion fail: \n",
		"open-notion": "Please open the file that needs to be synchronized",
		"config-secrets-notion-api":
			"Please set up the notion API in the settings tab.",
		"config-secrets-database-id":
			"Please set up the database id in the settings tab.",
		"set-tags-fail":
			"Set tags fail,please check the frontmatter of the file or close the tag switch in the settings tab.",
	},
	zh: {
		"notion-logo": "分享到Notion",
		"sync-success": "同步到Notion成功:\n",
		"sync-fail": "同步到Notion失败: \n",
		"open-file": "请打开需要同步的文件",
		"set-tags-fail":
			"设置标签失败,请检查文件的frontmatter,或者在插件设置中关闭设置tags开关",
	},
};

export const NoticeMConfig = (lang: string): { [key: string]: string } => {
	return NoticeMsg[lang];
};
