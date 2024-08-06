import { EditorState, Extension } from "@codemirror/state";
import { json } from "@codemirror/lang-json";
import {
	keymap,
	highlightSpecialChars,
	drawSelection,
	dropCursor,
	lineNumbers,
	rectangularSelection
} from "@codemirror/view";
import { indentOnInput, indentUnit, bracketMatching, syntaxHighlighting, defaultHighlightStyle, HighlightStyle } from "@codemirror/language";
import { defaultKeymap, indentWithTab, history, historyKeymap } from "@codemirror/commands";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { lintKeymap } from "@codemirror/lint";
import { EditorView, ViewUpdate } from "@codemirror/view";
import { debounce, App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, PluginManifest } from 'obsidian';
import { tags as t } from "@lezer/highlight";
import { error } from "console";

const config = {
	name: "obsidian",
	dark: false,
	background: "var(--background-primary)",
	foreground: "var(--text-normal)",
	selection: "var(--text-selection)",
	cursor: "var(--text-normal)",
	dropdownBackground: "var(--background-primary)",
	dropdownBorder: "var(--background-modifier-border)",
	activeLine: "var(--background-primary)",
	matchingBracket: "var(--background-modifier-accent)",
	keyword: "#d73a49",
	storage: "#d73a49",
	variable: "var(--text-normal)",
	parameter: "var(--text-accent-hover)",
	function: "var(--text-accent-hover)",
	string: "var(--text-accent)",
	constant: "var(--text-accent-hover)",
	type: "var(--text-accent-hover)",
	class: "#6f42c1",
	number: "var(--text-accent-hover)",
	comment: "var(--text-faint)",
	heading: "var(--text-accent-hover)",
	invalid: "var(--text-error)",
	regexp: "var(--text-accent)",
}

const obsidianTheme = EditorView.theme({
	"&": {
		color: config.foreground,
		backgroundColor: config.background,
	},

	".cm-content": {caretColor: config.cursor},

	"&.cm-focused .cm-cursor": {borderLeftColor: config.cursor},
	"&.cm-focused .cm-selectionBackground, .cm-selectionBackground, & ::selection": {backgroundColor: config.selection},

	".cm-panels": {backgroundColor: config.dropdownBackground, color: config.foreground},
	".cm-panels.cm-panels-top": {borderBottom: "2px solid black"},
	".cm-panels.cm-panels-bottom": {borderTop: "2px solid black"},

	".cm-searchMatch": {
		backgroundColor: config.dropdownBackground,
		outline: `1px solid ${config.dropdownBorder}`
	},
	".cm-searchMatch.cm-searchMatch-selected": {
		backgroundColor: config.selection
	},

	".cm-activeLine": {backgroundColor: config.activeLine},
	".cm-activeLineGutter": {backgroundColor: config.background},
	".cm-selectionMatch": {backgroundColor: config.selection},

	".cm-matchingBracket, .cm-nonmatchingBracket": {
		backgroundColor: config.matchingBracket,
		outline: "none"
	},
	".cm-gutters": {
		backgroundColor: config.background,
		color: config.comment,
		borderRight: "1px solid var(--background-modifier-border)"
	},
	".cm-lineNumbers, .cm-gutterElement": {color: "inherit"},

	".cm-foldPlaceholder": {
		backgroundColor: "transparent",
		border: "none",
		color: config.foreground
	},

	".cm-tooltip": {
		border: `1px solid ${config.dropdownBorder}`,
		backgroundColor: config.dropdownBackground,
		color: config.foreground
	},
	".cm-tooltip.cm-tooltip-autocomplete": {
		"& > ul > li[aria-selected]": {
			background: config.selection,
			color: config.foreground
		}
	},
}, {dark: config.dark})

const obsidianHighlightStyle = HighlightStyle.define([
	{tag: t.keyword, color: config.keyword},
	{tag: [t.name, t.deleted, t.character, t.macroName], color: config.variable},
	{tag: [t.propertyName], color: config.function},
	{tag: [t.processingInstruction, t.string, t.inserted, t.special(t.string)], color: config.string},
	{tag: [t.function(t.variableName), t.labelName], color: config.function},
	{tag: [t.color, t.constant(t.name), t.standard(t.name)], color: config.constant},
	{tag: [t.definition(t.name), t.separator], color: config.variable},
	{tag: [t.className], color: config.class},
	{tag: [t.number, t.changed, t.annotation, t.modifier, t.self, t.namespace], color: config.number},
	{tag: [t.typeName], color: config.type, fontStyle: config.type},
	{tag: [t.operator, t.operatorKeyword], color: config.keyword},
	{tag: [t.url, t.escape, t.regexp, t.link], color: config.regexp},
	{tag: [t.meta, t.comment], color: config.comment},
	{tag: t.strong, fontWeight: "bold"},
	{tag: t.emphasis, fontStyle: "italic"},
	{tag: t.link, textDecoration: "underline"},
	{tag: t.heading, fontWeight: "bold", color: config.heading},
	{tag: [t.atom, t.bool, t.special(t.variableName)], color: config.variable},
	{tag: t.invalid, color: config.invalid},
	{tag: t.strikethrough, textDecoration: "line-through"},
])

const obsidian: Extension = [
	obsidianTheme,
	syntaxHighlighting(obsidianHighlightStyle),
]

interface ObisidianKVSettings {
	kvdata: Object;
	serverurl: string;
	lastmessage: Object;
}

const DEFAULT_SETTINGS: ObisidianKVSettings = {
	kvdata: {},
	serverurl: "",
	lastmessage: {}
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
		if(this.this2.lastupdate) {
			this.this2.lastupdate = undefined
		} else {
			this.this2.lastupdate = Date.now();
			this.this2.socket.send(JSON.stringify({type: "set", key: name, update: this.this2.lastupdate, value: value}));
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
		if(this.this2.lastupdate) {
			this.this2.lastupdate = undefined
		} else {
		this.this2.lastupdate = Date.now();
		this.this2.socket.send(JSON.stringify({type: "delete", key: name, update: this.this2.lastupdate}));
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
	online: any
	offline: any
	injectexterchnage: any
	app: App

	constructor(app: App, manifest: PluginManifest) {
		super(app, manifest);
		this.manifest = manifest;
		this.app = app;
		
	}

	async handleConfigFileChange() {
        //await super.handleConfigFileChange();
        this.onExternalSettingsChange();
    }

	public onExternalSettingsChange = debounce(
        async () => {
            await this.loadSettings();
            console.log("[ " + this.manifest.id + " ]  - External Settings Reloaded");
			window.kv = new SharedStuff(this.settings.kvdata, this);
		},
        500,
        true
    );


	async onload() {
		await this.loadSettings();

		
		

		window.kv = new SharedStuff(this.settings.kvdata, this);

		// This adds a settings tab so the user can configure various aspects of the plugin
			this.addSettingTab(new ObisidianKVSettingTab(this.app, this));
			let wssinit = () => {
			if (!(this.settings.serverurl == '')) {
				this.socket = new WebSocket(this.settings.serverurl);
			} else {}
			try {
			this.socket.onmessage = (event) => {
				let data = JSON.parse(event.data);
				if(!(this.settings.lastmessage = data)) {
				this.settings.lastmessage = data
				if (data.update == this.lastupdate) {
				  return;
				}
				if (data.type == "set") {
				  window.kv.set(data.key, data.value);
				} else if (data.type == "delete") {
				  window.kv.delete(data.key);
				}
		}
	
				
	
			}
		} catch {}

			
			
			
			// Start the first attempt
			wssinit();

			let connect = () => {
				if (window.navigator.onLine) {
				  wssinit()
				} else {
				  console.log("[ " + this.manifest.id + " ] " +  "User is offline");
				  connect();
				}
			  }
			  
			  this.online = () => {
				console.log("[ " + this.manifest.id + " ] " +  "User came online");
				connect();
			  }

			  this.offline = () => {
				console.log("[ " + this.manifest.id + " ] " +  "User is offline");
				if (this.socket) {
				  this.socket.close();
				  (this.socket as any) = null;
				}
				// Inform the user, handle reconnection or other scenarios
			  }

			  window.addEventListener("online", this.online);
			  
			  window.addEventListener("offline", this.offline);
			
		
		}
	}

		onunload() {
			(window.kv as any) = null;
			try {
			this.socket.close();
			} catch {}
			window.removeEventListener("online", this.online);
			window.removeEventListener("offline", this.offline);
		}

		async loadSettings() {
			this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
			return this.settings;
	}

		async saveSettings() {
			await this.saveData(this.settings);
		}
}


class ObisidianKVSettingTab extends PluginSettingTab {
	plugin: ObisidianKV;
	snippetsEditor: EditorView;

	constructor(app: App, plugin: ObisidianKV) {
		super(app, plugin);
		this.plugin = plugin;
	}


	createJSONCMEditor(content: string, extensions: Extension[]) {
		const view = new EditorView({
			state: EditorState.create({ doc: content, extensions }),
		});
	
		return view;
	}



	JSONeditor: Extension[] = [
		lineNumbers(),
		highlightSpecialChars(),
		history(),
		json(),
		drawSelection(),
		dropCursor(),
		EditorState.allowMultipleSelections.of(true),
		indentOnInput(),
		indentUnit.of("  "),
		syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
		EditorView.lineWrapping,
		bracketMatching(),
		closeBrackets(),
		rectangularSelection(),
		highlightSelectionMatches(),
		obsidian,
		keymap.of([
			...closeBracketsKeymap,
			...defaultKeymap,
			...searchKeymap,
			...historyKeymap,
			indentWithTab,
			...lintKeymap,
		]),
	].filter(ext => ext);

	createJSONEditor(snippetsSetting: Setting) {
		const container = snippetsSetting.controlEl.createDiv("kv-store-json-editor");

		const errorpane = container.createDiv("kv-store-json-editor-error");
		errorpane.style.color = "green";
		errorpane.style.fontWeight = "bold"
		errorpane.style.paddingBottom = "10px";

		let greenmessage = "No errors found!"

		errorpane.setText(greenmessage);

		const change = EditorView.updateListener.of(async (v: ViewUpdate) => {
			if (v.docChanged) {
				const value = v.state.doc.toString();
				try {
					this.plugin.settings.kvdata = JSON.parse(value);
					await this.plugin.saveSettings();
					window.kv = new SharedStuff(this.plugin.settings.kvdata, this.plugin);
					errorpane.style.color = "green";
					errorpane.setText(greenmessage);
				} catch (error) {
					errorpane.style.color = "red";
					errorpane.setText(error.message);
				}
			}
		});

		const extensions = this.JSONeditor;

		extensions.push(change);

		this.snippetsEditor = this.createJSONCMEditor(JSON.stringify(this.plugin.settings.kvdata, null, 2), extensions);
		let blankbr = document.createElement("br");

		container.appendChild(errorpane);
		container.appendChild(blankbr);
		container.appendChild(blankbr);
		container.appendChild(this.snippetsEditor.dom);
		container.appendChild(blankbr);

	}


	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
		.setName('Your kv data')
        .setDesc('This is all your kv data. You can add, delete, and modify it here.')

		const snippeteditor = new Setting(containerEl)
		.setClass("kv-store-json-editor-css")
        
        
		this.createJSONEditor(snippeteditor);

		new Setting(containerEl)
		.setName('Server URL')
		.setDesc('This is the URL of the server to connect to. If you leave it blank, it will not connect to a server.')
		.addText(text => text
			.setPlaceholder('ws://localhost:8080')
			.setValue(this.plugin.settings.serverurl)
			.onChange(async (value) => {
				this.plugin.settings.serverurl = value;
				await this.plugin.saveSettings();
				try {
					this.plugin.socket.close()
				} catch {}
				this.plugin.socket = new WebSocket(this.plugin.settings.serverurl);
			  }));
		
	}
}
