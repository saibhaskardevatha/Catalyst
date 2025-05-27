import { App, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile, TFolder } from 'obsidian';

interface CatalystSettings {
	dateFormat: string;
	templateFile: string;
	taskFolder: string;
}

const DEFAULT_SETTINGS: CatalystSettings = {
	dateFormat: 'YYYY-MM-DD',
	templateFile: '',
	taskFolder: ''
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

class MoveTaskModal extends Modal {
	plugin: Catalyst;
	taskText: string;
	onSubmit: (destinationFile: string, heading: string) => void;
	fileDropdown: HTMLSelectElement;
	headingDropdown: HTMLSelectElement;

	constructor(app: App, plugin: Catalyst, taskText: string, onSubmit: (destinationFile: string, heading: string) => void) {
		super(app);
		this.plugin = plugin;
		this.taskText = taskText;
		this.onSubmit = onSubmit;
	}

	async getHeadingsFromFile(filePath: string): Promise<string[]> {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) return [];
		
		const content = await this.app.vault.read(file);
		const headingRegex = /^#+\s+(.+)$/gm;
		const headings: string[] = [];
		let match;
		
		while ((match = headingRegex.exec(content)) !== null) {
			headings.push(match[1]);
		}
		
		return headings;
	}

	async updateHeadingDropdown(filePath: string) {
		const headings = await this.getHeadingsFromFile(filePath);
		
		// Clear existing options
		while (this.headingDropdown.firstChild) {
			this.headingDropdown.removeChild(this.headingDropdown.firstChild);
		}
		
		if (headings.length === 0) {
			const option = document.createElement('option');
			option.value = '';
			option.text = 'No headings found';
			this.headingDropdown.appendChild(option);
			this.headingDropdown.disabled = true;
		} else {
			this.headingDropdown.disabled = false;
			headings.forEach(heading => {
				const option = document.createElement('option');
				option.value = heading;
				option.text = heading;
				this.headingDropdown.appendChild(option);
			});
		}
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.empty();
		contentEl.addClass('move-task-modal');

		// Add CSS for dropdowns
		const style = document.createElement('style');
		style.textContent = `
			.move-task-file-input,
			.move-task-heading-input {
				height: 30px;
				min-height: 30px;
				padding: 4px 8px;
				width: 100%;
				margin-top: 4px;
			}
			.move-task-input-container {
				margin-bottom: 16px;
			}
		`;
		contentEl.appendChild(style);

		// Create header
		const header = contentEl.createEl('div', {cls: 'move-task-modal-header'});
		header.createEl('h2', {text: 'Move Task'});

		// Create form container
		const formContainer = contentEl.createEl('div', {cls: 'move-task-modal-content'});
		
		// Create form
		const form = formContainer.createEl('form', {cls: 'move-task-form'});
		
		// Create file input container
		const fileInputContainer = form.createEl('div', {cls: 'move-task-input-container'});
		fileInputContainer.createEl('label', {
			text: 'Destination File:',
			cls: 'move-task-label'
		});
		
		// Create file dropdown
		this.fileDropdown = fileInputContainer.createEl('select', {
			cls: 'move-task-file-input'
		});

		// Get all markdown files in the task folder

		const allFiles = this.app.vault.getMarkdownFiles();
		// const files = allFiles.filter(file => {
		// 	const matches = file.path.startsWith(this.plugin.settings.taskFolder);
		// 	return matches;
		// });

		const files = allFiles
			.filter(file => {
				const taskFolderPath = this.plugin.settings.taskFolder;
				// Only include files directly in the task folder, not in subfolders
				const isInTaskFolder = file.path.startsWith(taskFolderPath);
				const remainingPath = file.path.slice(taskFolderPath.length);
				const hasNoSubfolder = !remainingPath.includes('/') || remainingPath.startsWith('/') && !remainingPath.slice(1).includes('/');
				
				return isInTaskFolder && hasNoSubfolder;
			})
			.sort((a, b) => a.path.localeCompare(b.path));
		
		// Add files to dropdown
		files.forEach(file => {
			const option = document.createElement('option');
			option.value = file.path;
			option.text = file.path;
			this.fileDropdown.appendChild(option);
		});

		// Create heading input container
		const headingInputContainer = form.createEl('div', {cls: 'move-task-input-container'});
		headingInputContainer.createEl('label', {
			text: 'Heading:',
			cls: 'move-task-label'
		});
		
		// Create heading dropdown
		this.headingDropdown = headingInputContainer.createEl('select', {
			cls: 'move-task-heading-input'
		});

		// Update heading dropdown when file is selected
		this.fileDropdown.addEventListener('change', async () => {
			await this.updateHeadingDropdown(this.fileDropdown.value);
		});

		// Create button container
		const buttonContainer = formContainer.createEl('div', {cls: 'move-task-button-container'});
		
		const submitButton = buttonContainer.createEl('button', {
			text: 'Move Task',
			cls: 'mod-cta move-task-submit'
		});
		
		const cancelButton = buttonContainer.createEl('button', {
			text: 'Cancel',
			cls: 'move-task-cancel'
		});

		submitButton.addEventListener('click', (e) => {
			e.preventDefault();
			this.onSubmit(this.fileDropdown.value, this.headingDropdown.value);
			this.close();
		});

		cancelButton.addEventListener('click', (e) => {
			e.preventDefault();
			this.close();
		});

		// Initialize heading dropdown for first file
		if (files.length > 0) {
			console.log('Initializing with first file:', files[0].path);
			this.updateHeadingDropdown(files[0].path);
		} else {
			console.log('No files found to initialize with');
		}
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

		// Add click listener to detect clicks on task items
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			const target = evt.target as HTMLElement;
			const taskItem = target.closest('.HyperMD-task-line');
			if (taskItem) {
				// Calculate if the click was in the area of the ::before pseudo-element
				const rect = taskItem.getBoundingClientRect();
				const iconAreaLeft = rect.left - 20; // Approximate left position based on CSS
				const iconAreaRight = rect.left;   // Approximate right position
				const clickX = evt.clientX;

				// Check if the click was within the horizontal bounds of the icon area
				if (clickX >= iconAreaLeft && clickX <= iconAreaRight) {
					evt.stopPropagation(); // Stop event propagation

					// Get the markdown content of the task
					const taskText = taskItem.textContent || '';
					
					// Trigger the modal
					new MoveTaskModal(this.app, this, taskText, async (destinationFile, heading) => {
						try {
							// Get the destination file
							const destFile = this.app.vault.getAbstractFileByPath(destinationFile);
							if (!(destFile instanceof TFile)) {
								new Notice('Destination file not found');
								return;
							}

							// Read the destination file content
							const content = await this.app.vault.read(destFile);
							
							// Find the heading position
							const headingRegex = new RegExp(`^#+\\s+${heading}$`, 'm');
							const headingMatch = content.match(headingRegex);
							
							if (!headingMatch) {
								new Notice('Heading not found in destination file');
								return;
							}

							// Insert the task after the heading
							if (headingMatch.index === undefined) {
								new Notice('Invalid heading position');
								return;
							}
							const headingPos = headingMatch.index + headingMatch[0].length;
							const newContent = content.slice(0, headingPos + 1) + '- [ ]' + taskText + '\n' + content.slice(headingPos + 1);
							
							// Update the destination file
							await this.app.vault.modify(destFile, newContent);
							
							// Remove the task from the current file
							const currentFile = this.app.workspace.getActiveFile();
							if (currentFile) {
								const editor = this.app.workspace.activeEditor?.editor;
								if (editor) {
									// Get the current line number
									const lineNumber = editor.getCursor().line;
									// Get the line content
									const line = editor.getLine(lineNumber);
									// If this is the task line, remove it
									if (line.includes(taskText)) {
										editor.replaceRange('', {line: lineNumber, ch: 0}, {line: lineNumber + 1, ch: 0});
									}
								} else {
									// Fallback to file modification if editor is not available
									const currentContent = await this.app.vault.read(currentFile);
									const lines = currentContent.split('\n');
									const updatedLines = lines.filter(line => !line.includes(taskText));
									await this.app.vault.modify(currentFile, updatedLines.join('\n'));
								}
							}

							new Notice('Task moved successfully');
						} catch (error) {
							new Notice('Failed to move task');
							console.error(error);
						}
					}).open();
				}
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new CatalystSettingTab(this.app, this));

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

		new Setting(containerEl)
			.setName('Task Folder')
			.setDesc('Select a folder for task notes.')
			.addDropdown(dropdown => {
				// Get all folders
				const folders = this.app.vault.getAllLoadedFiles()
					.filter(file => file instanceof TFolder)
					.map(folder => folder as TFolder);
				
				// Add empty option
				dropdown.addOption('', 'No folder');
				
				// Add all folders
				folders.forEach(folder => {
					dropdown.addOption(folder.path, folder.path);
				});
				
				// Set current value
				dropdown.setValue(this.plugin.settings.taskFolder);
				
				// Handle change
				dropdown.onChange(async (value) => {
					console.log('Task folder setting changed to:', value);
					this.plugin.settings.taskFolder = value;
					await this.plugin.saveSettings();
				});
			});
	}
}