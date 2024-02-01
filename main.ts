import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

// Remember to rename these classes and interfaces!

interface ObisidianKVSettings {
	kvdata: Object;
}

const DEFAULT_SETTINGS: ObisidianKVSettings = {
	kvdata: {}
}

declare global {
	interface Window {
		obsidiankv: SharedStuff;
	}
}

class SharedStuff {
    constructor(private stuff: {[key: string]: any;}, private this2: any) {
        this.stuff = stuff;
		this.this2 = this2;
    }

    set(name: string, value: any) {
        this.stuff[name] = value;
		this.this2.saveSettings();
    }

    get(name: string) {
        return this.stuff[name];
    }

    delete(name: string) {
        delete this.stuff[name];
		this.this2.saveSettings();
    }

    has(name: string) {
        return this.stuff.hasOwnProperty(name);
    }

    keys() {
        return Object.keys(this.stuff);
    }

    values() {
        return Object.values(this.stuff);
    }

    entries() {
        return Object.entries(this.stuff);
    }
}


export default class ObisidianKV extends Plugin {
	settings: ObisidianKVSettings;

	async onload() {
		await this.loadSettings();
		let this2 = this;
		window.obsidiankv = new SharedStuff(this.settings.kvdata, this2);

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new ObisidianKVSettingTab(this.app, this));

	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}


class ObisidianKVSettingTab extends PluginSettingTab {
	plugin: ObisidianKV;

	constructor(app: App, plugin: ObisidianKV) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();
		new Setting(containerEl)
        .setName('Your kv data')
        .setDesc('This is all your kv data. You can add, delete, and modify it here.')
        .addTextArea(text => text
            .setPlaceholder('')
            .setValue(JSON.stringify(this.plugin.settings.kvdata))
            .onChange(async (value) => {
				try {
					this.plugin.settings.kvdata = JSON.parse(value);
					await this.plugin.saveSettings();
					window.obsidiankv = new SharedStuff(this.plugin.settings.kvdata, this.plugin);
				} catch (error) {
					new Notice('Invalid JSON: ' + error.message, 5000);
				}
			}));
		
	}
}
