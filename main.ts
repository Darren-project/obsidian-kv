import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, PluginManifest } from 'obsidian';

// Remember to rename these classes and interfaces!

interface ObisidianKVSettings {
	kvdata: Object;
	serverurl: string;
}

const DEFAULT_SETTINGS: ObisidianKVSettings = {
	kvdata: {},
	serverurl: "",
}

declare global {
	interface Window {
		kv: SharedStuff;
	}

	interface ObisidianKV {
		settings: ObisidianKVSettings;
		loadSettings(): Promise<void>;
		saveSettings(): Promise<void>;
	}
}

class SharedStuff {
    constructor(private stuff: {[key: string]: any;}, private this2: any) {
		this.stuff = stuff;
		this.this2 = this2;
    }

	async load() {
		let data = await this.this2.loadSettings()
		window.kv = new SharedStuff(data.kvdata, this.this2);
		return window.kv;
	}

    set(name: string, value: any) {
		try {
		if(this.this2.lastupdate == undefined) {
		this.this2.lastupdate = Date.now();
		this.this2.socket.send(JSON.stringify({type: "set", key: name, update: this.this2.lastupdate, value: value}));
		} else {
		this.this2.lastupdate = undefined
		}
	} catch (error) {}
        this.stuff[name] = value;
		this.this2.saveSettings();
    }

    get(name: string) {
        return this.stuff[name];
    }

    delete(name: string) {
		try {
		if(this.this2.lastupdate == undefined) {
		this.this2.lastupdate = Date.now();
		this.this2.socket.send(JSON.stringify({type: "delete", key: name, update: this.this2.lastupdate}));
	} else {
		this.this2.lastupdate = undefined
		}
	} catch (error) {}
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
	settings: ObisidianKVSettings
	privatekv: SharedStuff
	manifest: PluginManifest
	socket: WebSocket
	lastupdate: number

	async onload() {
		await this.loadSettings();
		let this2 = this;
		window.kv = new SharedStuff(this.settings.kvdata, this2);

		// This adds a settings tab so the user can configure various aspects of the plugin
			this.addSettingTab(new ObisidianKVSettingTab(this.app, this));
			let wssinit = () => {
			if (!(this.settings.serverurl == '')) {
				this.socket = new WebSocket(this.settings.serverurl);
			} else {}
			this.socket.onmessage = (event) => {
				let data = JSON.parse(event.data);
				if (data.update == this.lastupdate) {
					return
				}
				if (data.type == "set") {
					window.kv.set(data.key, data.value);
				} else if (data.type == "delete") {
					window.kv.delete(data.key);
				}
	
				
	
			}
		}

			
			function attemptWssInit(delay = 1000) {
				try {
					wssinit();
				} catch (error) {
					setTimeout(() => {
						attemptWssInit(delay);
					}, delay);
				}
			}
			
			// Start the first attempt
			attemptWssInit();
			this.socket.onclose = () => {
				console.log('WebSocket disconnected, attempting to reconnect...');
				attemptWssInit();
			};
		
		}

		onunload() {
			(window.kv as any) = null;
			this.socket.close();
		}

		async loadSettings() {
			this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
			return this.settings;
	}

		async saveSettings() {
			await this.saveData(this.settings);
		}

		onConfigFileChange(): void {
			console.log("Config file changed");
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
					window.kv = new SharedStuff(this.plugin.settings.kvdata, this.plugin);
				} catch (error) {
					new Notice('Invalid JSON: ' + error.message, 5000);
				}
			}));

		new Setting(containerEl)
		.setName('Server URL')
		.setDesc('This is the URL of the server to connect to. If you leave it blank, it will not connect to a server.')
		.addText(text => text
			.setPlaceholder('ws://localhost:8080')
			.setValue(this.plugin.settings.serverurl)
			.onChange(async (value) => {
				this.plugin.settings.serverurl = value;
				await this.plugin.saveSettings();
				this.plugin.socket = new WebSocket(this.plugin.settings.serverurl);
			}));
		
	}
}
