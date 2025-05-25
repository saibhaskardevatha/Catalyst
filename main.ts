import { App, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile } from 'obsidian';

interface CatalystSettings {
	dateFormat: string;
	templateFile: string;
}

const DEFAULT_SETTINGS: CatalystSettings = {
	dateFormat: 'YYYY-MM-DD',
	templateFile: ''
}

class DateInputModal extends Modal {
	plugin: Catalyst;
	onSubmit: (date: Date) => void;

	constructor(app: App, plugin: Catalyst, onSubmit: (date: Date) => void) {
		super(app);
		this.plugin = plugin;
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.empty();
		contentEl.addClass('daily-notes-modal');

		// Create header
		const header = contentEl.createEl('div', {cls: 'daily-notes-modal-header'});
		header.createEl('h2', {text: 'Create Daily Note'});

		// Create form container
		const formContainer = contentEl.createEl('div', {cls: 'daily-notes-modal-content'});
		
		// Create form
		const form = formContainer.createEl('form', {cls: 'daily-notes-form'});
		
		// Create date input container
		const dateInputContainer = form.createEl('div', {cls: 'daily-notes-input-container'});
		dateInputContainer.createEl('label', {
			text: 'Select Date:',
			cls: 'daily-notes-label'
		});
		
		const dateInput = dateInputContainer.createEl('input', {
			type: 'date',
			value: new Date().toISOString().split('T')[0],
			cls: 'daily-notes-date-input'
		});

		// Create button container
		const buttonContainer = formContainer.createEl('div', {cls: 'daily-notes-button-container'});
		
		const submitButton = buttonContainer.createEl('button', {
			text: 'Create Note',
			cls: 'mod-cta daily-notes-submit'
		});
		
		const cancelButton = buttonContainer.createEl('button', {
			text: 'Cancel',
			cls: 'daily-notes-cancel'
		});

		submitButton.addEventListener('click', (e) => {
			e.preventDefault();
			const date = new Date(dateInput.value);
			this.onSubmit(date);
			this.close();
		});

		cancelButton.addEventListener('click', (e) => {
			e.preventDefault();
			this.close();
		});
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

export default class Catalyst extends Plugin {
	settings: CatalystSettings;

	async onload() {
		await this.loadSettings();

		// Add command to create daily notes for next 5 days
		this.addCommand({
			id: 'create-next-5-daily-notes',
			name: 'Create daily notes for next 5 days',
			callback: async () => {
				const today = new Date();
				
				for (let i = 1; i <= 5; i++) {
					const date = new Date(today);
					date.setDate(today.getDate() + i);
					
					try {
						// Format the date according to user's preference
						const dateStr = this.formatDate(date, this.settings.dateFormat);
						const fileName = `${dateStr}.md`;
						
						// Check if file already exists
						const existingFile = this.app.vault.getAbstractFileByPath(fileName);
						if (existingFile) {
							new Notice(`Note for ${dateStr} already exists`);
							continue;
						}
						
						// Get template content
						let content = '';
						if (this.settings.templateFile) {
							const templateFile = this.app.vault.getAbstractFileByPath(this.settings.templateFile);
							if (templateFile instanceof TFile) {
								content = await this.app.vault.read(templateFile);
								// Replace any date variables in the template
								content = content.replace(/{{date}}/g, dateStr);
							}
						}
						
						// Create the note with template content
						await this.app.vault.create(fileName, content);
						new Notice(`Created daily note for ${dateStr}`);
						
						// Open the note
						const file = this.app.vault.getAbstractFileByPath(fileName);
						if (file instanceof TFile) {
							await this.app.workspace.getLeaf().openFile(file);
						}
					} catch (error) {
						new Notice(`Failed to create note for ${this.formatDate(date, this.settings.dateFormat)}`);
						console.error(error);
					}
				}
			}
		});

		// Add command to create daily note for specific date
		this.addCommand({
			id: 'create-daily-note-for-date',
			name: 'Create daily note for specific date',
			callback: () => {
				new DateInputModal(this.app, this, async (date) => {
					try {
						const dateStr = this.formatDate(date, this.settings.dateFormat);
						const fileName = `${dateStr}.md`;
						
						// Check if file already exists
						const existingFile = this.app.vault.getAbstractFileByPath(fileName);
						if (existingFile) {
							new Notice(`Note for ${dateStr} already exists`);
							return;
						}
						
						// Get template content
						let content = '';
						if (this.settings.templateFile) {
							const templateFile = this.app.vault.getAbstractFileByPath(this.settings.templateFile);
							if (templateFile instanceof TFile) {
								content = await this.app.vault.read(templateFile);
								// Replace any date variables in the template
								content = content.replace(/{{date}}/g, dateStr);
							}
						}
						
						// Create the note with template content
						await this.app.vault.create(fileName, content);
						new Notice(`Created daily note for ${dateStr}`);
						
						// Open the note
						const file = this.app.vault.getAbstractFileByPath(fileName);
						if (file instanceof TFile) {
							await this.app.workspace.getLeaf().openFile(file);
						}
					} catch (error) {
						new Notice(`Failed to create note for ${this.formatDate(date, this.settings.dateFormat)}`);
						console.error(error);
					}
				}).open();
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new CatalystSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	formatDate(date: Date, format: string): string {
		const year = date.getFullYear();
		const month = date.getMonth();
		const day = date.getDate();
		
		const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
		
		return format
			.replace('YYYY', year.toString())
			.replace('YY', year.toString().slice(-2))
			.replace('MMM', months[month])
			.replace('MM', String(month + 1).padStart(2, '0'))
			.replace('DD', String(day).padStart(2, '0'))
			.replace('D', day.toString());
	}
}

class CatalystSettingTab extends PluginSettingTab {
	plugin: Catalyst;

	constructor(app: App, plugin: Catalyst) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Date Format')
			.setDesc('Format for daily note titles. Use YYYY for year, MM for month, DD for day.')
			.addText(text => text
				.setPlaceholder('YYYY-MM-DD')
				.setValue(this.plugin.settings.dateFormat)
				.onChange(async (value) => {
					this.plugin.settings.dateFormat = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Template File')
			.setDesc('Select a template file for daily notes. Use {{date}} in your template for the date.')
			.addDropdown(dropdown => {
				// Get all markdown files
				const files = this.app.vault.getMarkdownFiles().filter(file => file.path.includes('Template'));
				
				// Add empty option
				dropdown.addOption('', 'No template');
				
				// Add all markdown files
				files.forEach(file => {
					dropdown.addOption(file.path, file.path);
				});
				
				// Set current value
				dropdown.setValue(this.plugin.settings.templateFile);
				
				// Handle change
				dropdown.onChange(async (value) => {
					this.plugin.settings.templateFile = value;
					await this.plugin.saveSettings();
				});
			});
	}
}