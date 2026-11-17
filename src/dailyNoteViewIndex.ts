import {
    Plugin,
    OpenViewState,
    TFile,
    Workspace,
    WorkspaceLeaf,
    moment,
    TFolder,
    App,
} from "obsidian";

import { around } from "monkey-around";
import { isDailyNoteLeaf } from "./leafView";
import "./style/index.css";
import { addIconList } from "./utils/icon";
import {
    DailyNoteSettings,
    DailyNoteSettingTab,
    DEFAULT_SETTINGS,
} from "./dailyNoteSettings";
import { TimeField } from "./types/time";
import {
    getAllDailyNotes,
    getDailyNote,
    createDailyNote,
} from "obsidian-daily-notes-interface";
import { createUpDownNavigationExtension } from "./component/UpAndDownNavigate";
// import { setActiveEditorExt } from "./component/SetActiveEditor";
import { DAILY_NOTE_VIEW_TYPE, DailyNoteView } from "./dailyNoteView";

export default class DailyNoteViewPlugin extends Plugin {
    private view: DailyNoteView;
    lastActiveFile: TFile;
    private lastCheckedDay: string;

    // `Plugin` declares an optional `settings?: unknown` property for the
    // declarative settings API; narrow it to our own shape instead of hiding it
    declare settings: DailyNoteSettings;

    async onload() {
        this.addSettingTab(new DailyNoteSettingTab(this.app, this));
        await this.loadSettings();
        this.patchWorkspace();
        this.patchWorkspaceLeaf();
        addIconList();

        this.lastCheckedDay = moment().format("YYYY-MM-DD");

        // Register the up and down navigation extension
        if (this.settings.useArrowUpOrDownToNavigate) {
            this.registerEditorExtension([
                createUpDownNavigationExtension({
                    app: this.app,
                    plugin: this,
                }),
                // setActiveEditorExt({ app: this.app, plugin: this }),
            ]);
        }

        this.registerView(
            DAILY_NOTE_VIEW_TYPE,
            (leaf: WorkspaceLeaf) => (this.view = new DailyNoteView(leaf, this))
        );

        this.addRibbonIcon(
            "calendar-range",
            "Open Daily Note Editor",
            (evt: MouseEvent) => this.openDailyNoteEditor()
        );
        this.addCommand({
            id: "open-daily-note-editor",
            name: "Open Daily Note Editor",
            callback: () => this.openDailyNoteEditor(),
        });

        this.initCssRules();

        // Create daily note and open the Daily Notes Editor on startup if enabled
        if (this.settings.createAndOpenOnStartup) {
            this.app.workspace.onLayoutReady(async () => {
                // First ensure today's daily note exists
                await this.ensureTodaysDailyNoteExists();
                if (
                    this.app.workspace.getLeavesOfType(DAILY_NOTE_VIEW_TYPE)
                        .length > 0
                )
                    return;
                // Then open the Daily Notes Editor
                await this.openDailyNoteEditor();
            });
        }

        // Also check periodically (every 15 minutes) for day changes
        this.registerInterval(
            window.setInterval(this.checkDayChange.bind(this), 1000 * 60 * 15)
        );

        this.registerEvent(
            this.app.workspace.on("file-menu", (menu, file, source, leaf) => {
                if (file instanceof TFolder) {
                    menu.addItem((item) => {
                        item.setIcon("calendar-range");
                        item.setTitle("Open daily notes for this folder");
                        item.onClick(() => {
                            this.openFolderView(file.path);
                        });
                    });
                }
            })
        );
    }

    onunload() {
        this.app.workspace.detachLeavesOfType(DAILY_NOTE_VIEW_TYPE);
        document.body.toggleClass("daily-notes-hide-frontmatter", false);
        document.body.toggleClass("daily-notes-hide-backlinks", false);
    }

    async openDailyNoteEditor() {
        const workspace = this.app.workspace;

        if (this.settings.switchToExisting) {
            const leaves = workspace.getLeavesOfType(DAILY_NOTE_VIEW_TYPE);
            if (leaves.length > 0) {
                workspace.revealLeaf(leaves[0]);
                return;
            }
        }

        const leaf = workspace.getLeaf(true);
        await leaf.setViewState({ type: DAILY_NOTE_VIEW_TYPE });
        workspace.revealLeaf(leaf);
    }

    /**
     * Let every open editor re-read plugin settings
     */
    public refreshAllViews() {
        this.app.workspace
            .getLeavesOfType(DAILY_NOTE_VIEW_TYPE)
            .forEach((leaf) => {
                (leaf.view as DailyNoteView)?.refreshFromSettings?.();
            });
    }

    async openFolderView(folderPath: string, timeField: TimeField = "mtime") {
        const workspace = this.app.workspace;
        const leaf = workspace.getLeaf(true);
        await leaf.setViewState({ type: DAILY_NOTE_VIEW_TYPE });

        // Get the view and set the selection mode to folder
        const view = leaf.view as DailyNoteView;
        view.setSelectionMode("folder", folderPath);
        view.setTimeField(timeField);

        workspace.revealLeaf(leaf);
    }

    async openTagView(tagName: string, timeField: TimeField = "mtime") {
        const workspace = this.app.workspace;
        const leaf = workspace.getLeaf(true);
        await leaf.setViewState({ type: DAILY_NOTE_VIEW_TYPE });

        // Get the view and set the selection mode to tag
        const view = leaf.view as DailyNoteView;
        view.setSelectionMode("tag", tagName);
        view.setTimeField(timeField);

        workspace.revealLeaf(leaf);
    }

    async ensureTodaysDailyNoteExists() {
        try {
            const currentDate = moment();
            const allDailyNotes = getAllDailyNotes();
            const currentDailyNote = getDailyNote(currentDate, allDailyNotes);

            if (!currentDailyNote) {
                await createDailyNote(currentDate);
            }
        } catch (error) {
            console.error("Failed to create daily note:", error);
        }
    }

    initCssRules() {
        document.body.toggleClass(
            "daily-notes-hide-frontmatter",
            this.settings.hideFrontmatter
        );
        document.body.toggleClass(
            "daily-notes-hide-backlinks",
            this.settings.hideBacklinks
        );
    }

    patchWorkspace() {
        // The iterateLeaves/changeLayout pair that used to live here only
        // existed to keep hover editors alive on 0.14.x, where popovers were
        // not part of rootSplit. minAppVersion is well past that, so the
        // compatibility branch was dead code and went with it.
        const uninstaller = around(Workspace.prototype, {
            getActiveViewOfType: (next: any) =>
                function (t: any) {
                    const result = next.call(this, t);
                    if (!result) {
                        if (t?.VIEW_TYPE === "markdown") {
                            const activeLeaf = this.activeLeaf;
                            if (activeLeaf?.view instanceof DailyNoteView) {
                                return activeLeaf.view.editMode;
                            } else {
                                return result;
                            }
                        }
                    }
                    return result;
                },
            setActiveLeaf: (next: any) =>
                function (e: WorkspaceLeaf, t?: any) {
                    if ((e as any).parentLeaf) {
                        (e as any).parentLeaf.activeTime = 1700000000000;

                        next.call(this, (e as any).parentLeaf, t);
                        if ((e.view as any).editMode) {
                            this.activeEditor = e.view;
                            (e as any).parentLeaf.view.editMode = e.view;
                        }
                        return;
                    }
                    return next.call(this, e, t);
                },
        });
        this.register(uninstaller);
    }

    // Used for patch workspaceleaf pinned behaviors
    patchWorkspaceLeaf() {
        // Only the set is captured: the wrappers below run with their own
        // `this` (the leaf), so they cannot read plugin fields directly.
        const suppressed = this.suppressedRecentFiles;
        const patchRecentFiles = (app: App) =>
            this.patchRecentFilesPlugin(app);

        this.register(
            around(WorkspaceLeaf.prototype, {
                getRoot(old) {
                    return function () {
                        const top = old.call(this);
                        return top?.getRoot === this.getRoot
                            ? top
                            : top?.getRoot();
                    };
                },
                setPinned(old) {
                    return function (pinned: boolean) {
                        old.call(this, pinned);
                        if (isDailyNoteLeaf(this) && !pinned)
                            this.setPinned(true);
                    };
                },
                openFile(old) {
                    return function (file: TFile, openState?: OpenViewState) {
                        if (!isDailyNoteLeaf(this)) {
                            return old.call(this, file, openState);
                        }

                        // Keep this file out of the recent lists for the
                        // duration of the open. The old code installed a fresh
                        // patch per opened note and never removed it, so every
                        // note ever opened inline stayed excluded forever.
                        suppressed.add(file.path);
                        patchRecentFiles(this.app);

                        const result = old.call(this, file, openState);
                        const release = () =>
                            window.setTimeout(
                                () => suppressed.delete(file.path),
                                500
                            );
                        Promise.resolve(result).then(release, release);
                        return result;
                    };
                },
            })
        );

        // recordMostRecentOpenedFile is internal and no longer exists in
        // recent builds; around() would only add an unused property, so only
        // patch it when it is actually there.
        if (
            typeof (Workspace.prototype as any).recordMostRecentOpenedFile ===
            "function"
        ) {
            this.register(
                around(Workspace.prototype, {
                    recordMostRecentOpenedFile(old: any) {
                        return function (file: TFile) {
                            if (suppressed.has(file.path)) return;
                            return old.call(this, file);
                        };
                    },
                })
            );
        }
    }

    /** Paths that are being opened inline and must not reach the recent list */
    private suppressedRecentFiles = new Set<string>();
    private patchedRecentFilesPlugins = new WeakSet<object>();

    private patchRecentFilesPlugin(app: App) {
        const recentFiles = app.plugins.plugins["recent-files-obsidian"];
        if (!recentFiles || this.patchedRecentFilesPlugins.has(recentFiles))
            return;

        this.patchedRecentFilesPlugins.add(recentFiles);
        this.register(
            around(recentFiles, {
                // Arrow on purpose: the factory is called without a receiver,
                // and the returned function needs the plugin, not the leaf.
                shouldAddFile: (old: any) => (file: TFile) => {
                    if (this.suppressedRecentFiles.has(file.path))
                        return false;
                    return old.call(recentFiles, file);
                },
            })
        );
    }

    public async loadSettings() {
        this.settings = Object.assign(
            {},
            DEFAULT_SETTINGS,
            await this.loadData()
        );
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    private async checkDayChange(): Promise<void> {
        const currentDay = moment().format("YYYY-MM-DD");

        if (currentDay !== this.lastCheckedDay) {
            this.lastCheckedDay = currentDay;
            console.log("Day changed, updating daily notes view");

            // Don't create notes behind the user's back: only do it when they
            // opted into the startup behaviour
            if (this.settings.createAndOpenOnStartup) {
                await this.ensureTodaysDailyNoteExists();
            }

            const dailyNoteLeaves =
                this.app.workspace.getLeavesOfType(DAILY_NOTE_VIEW_TYPE);
            if (dailyNoteLeaves.length > 0) {
                for (const leaf of dailyNoteLeaves) {
                    const view = leaf.view as DailyNoteView;
                    if (view) {
                        view.refreshForNewDay();
                    }
                }
            }
        }
    }
}
