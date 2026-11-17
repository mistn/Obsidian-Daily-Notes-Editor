import { TFile, moment, App, getAllTags } from "obsidian";
import {
    getAllDailyNotes,
    getDailyNote,
    createDailyNote,
    getDateFromFile,
} from "obsidian-daily-notes-interface";
import { TimeRange, TimeField } from "../types/time";

export interface FileManagerOptions {
    mode: "daily" | "folder" | "tag";
    target?: string;
    timeRange?: TimeRange;
    customRange?: { start: Date; end: Date } | null;
    app?: App;
    timeField?: TimeField;
    hideFutureDates?: boolean;
    hideEmptyNotes?: boolean;
}

export class FileManager {
    private allFiles: TFile[] = [];
    private filteredFiles: TFile[] = [];
    private hasFetched: boolean = false;
    private hasCurrentDay: boolean = true;
    private cacheDailyNotes: Record<string, any> = {};

    /** Paths of daily notes whose body is blank (checked asynchronously) */
    private emptyPaths: Set<string> = new Set();
    private emptyCheckToken = 0;

    // Make options public so it can be accessed from outside
    public options: FileManagerOptions;

    constructor(options: FileManagerOptions) {
        this.options = options;
        this.fetchFiles();
    }

    /**
     * Helper method to parse time field and check if it's reverse
     * @param timeField The time field to parse
     * @returns An object containing isReverse flag and baseTimeField
     */
    private parseTimeField(timeField: TimeField | undefined): {
        isReverse: boolean;
        baseTimeField: string;
    } {
        const field = timeField || "mtime";
        const isReverse = field.endsWith("Reverse");
        const baseTimeField = isReverse ? field.replace("Reverse", "") : field;
        return { isReverse, baseTimeField };
    }

    /**
     * Helper method to sort files by time field
     * @param files The files to sort
     * @param timeField The time field to sort by
     * @returns Sorted files
     */
    private sortFilesByTimeField(
        files: TFile[],
        timeField?: TimeField
    ): TFile[] {
        const { isReverse, baseTimeField } = this.parseTimeField(timeField);

        return [...files].sort((a, b) => {
            // Handle name-based sorting
            if (baseTimeField === "name") {
                // For name sorting, we sort alphabetically by filename
                if (isReverse) {
                    return b.name.localeCompare(a.name);
                }
                return a.name.localeCompare(b.name);
            }

            // Handle time-based sorting (existing functionality)
            if (isReverse) {
                return a.stat[baseTimeField] - b.stat[baseTimeField];
            }
            return b.stat[baseTimeField] - a.stat[baseTimeField];
        });
    }

    public fetchFiles(): void {
        if (this.hasFetched) return;

        switch (this.options.mode) {
            case "daily":
                this.fetchDailyNotes();
                break;
            case "folder":
                this.fetchFolderFiles();
                break;
            case "tag":
                this.fetchTaggedFiles();
                break;
        }

        this.hasFetched = true;
        this.checkDailyNote();
        this.filterFilesByRange();
    }

    private fetchDailyNotes(): void {
        this.cacheDailyNotes = getAllDailyNotes();
        this.allFiles = this.sortDailyNotes(
            Object.values(this.cacheDailyNotes) as TFile[]
        );
    }

    private fetchFolderFiles(): void {
        if (!this.options.target || !this.options.app) return;

        // Get all files in the vault
        const allFiles = this.options.app.vault.getMarkdownFiles();

        // Filter files by folder path
        this.allFiles = allFiles.filter((file) => {
            const folderPath = file.parent?.path || "";
            return (
                folderPath === this.options.target ||
                folderPath.startsWith(this.options.target + "/")
            );
        });

        // Sort files by the specified time field
        this.allFiles = this.sortFilesByTimeField(
            this.allFiles,
            this.options.timeField
        );
    }

    private fetchTaggedFiles(): void {
        if (!this.options.target || !this.options.app) return;

        this.allFiles = this.options.app.vault
            .getMarkdownFiles()
            .filter((file) => this.hasTargetTag(file));

        // Sort files by the specified time field
        this.allFiles = this.sortFilesByTimeField(
            this.allFiles,
            this.options.timeField
        );
    }

    /**
     * getAllTags covers inline tags plus frontmatter tags in string or list form
     */
    private hasTargetTag(file: TFile): boolean {
        if (!this.options.target) return false;

        const cache = this.options.app?.metadataCache.getFileCache(file);
        if (!cache) return false;

        // Obsidian tags are case-insensitive
        const targetTag = (
            "#" + this.options.target.replace(/^#/, "")
        ).toLowerCase();

        return (
            getAllTags(cache)?.some((tag) => tag.toLowerCase() === targetTag) ??
            false
        );
    }

    public filterFilesByRange(): TFile[] {
        // No time range or "all" means no filtering
        if (!this.options.timeRange || this.options.timeRange === "all") {
            this.filteredFiles = [...this.allFiles];
        } else if (this.options.mode === "daily") {
            // Daily mode: filter daily notes by date
            this.filterDailyNotesByRange();
        } else {
            // Folder and tag modes: filter files by creation or modification time
            this.filterFilesByTimeRange();
        }

        this.filteredFiles = this.filteredFiles.filter(
            (file) => !this.isFutureDailyNote(file)
        );

        if (this.options.hideEmptyNotes && this.options.mode === "daily") {
            this.filteredFiles = this.filteredFiles.filter(
                (file) => !this.emptyPaths.has(file.path)
            );
        }

        return this.filteredFiles;
    }

    /**
     * Whether the note is dated after today and should be hidden
     * Only applies to daily notes, and only when the option is enabled
     */
    private isFutureDailyNote(file: TFile): boolean {
        if (!this.options.hideFutureDates) return false;
        if (this.options.mode !== "daily") return false;

        const fileDate = getDateFromFile(file as any, "day");
        return !!fileDate && fileDate.isAfter(moment(), "day");
    }

    /**
     * Cheap structural check: if the cache knows about any block, heading, link,
     * tag or block reference, the note definitely has content. Only the notes
     * that pass this check are read from disk to look for plain text.
     */
    private looksLikeItHasContent(file: TFile): boolean {
        const cache = this.options.app?.metadataCache.getFileCache(file);
        // Not indexed yet: assume content rather than hiding the note
        if (!cache) return true;

        // Sections are root level markdown blocks; a note whose body is blank
        // has none (the frontmatter block itself is not content)
        const bodySections = (cache.sections ?? []).filter(
            (section) => section.type !== "yaml"
        );

        return Boolean(
            bodySections.length ||
                cache.headings?.length ||
                cache.links?.length ||
                cache.embeds?.length ||
                cache.listItems?.length ||
                cache.tags?.length ||
                cache.footnotes?.length ||
                cache.footnoteRefs?.length ||
                Object.keys(cache.blocks ?? {}).length
        );
    }

    private isBlankBody(file: TFile, text: string): boolean {
        const cache = this.options.app?.metadataCache.getFileCache(file);
        const frontmatterEnd = cache?.frontmatterPosition?.end?.offset;
        const body =
            frontmatterEnd === undefined ? text : text.slice(frontmatterEnd + 1);
        return body.trim().length === 0;
    }

    private async computeIsEmpty(file: TFile): Promise<boolean> {
        if (!this.options.app) return false;
        if (this.looksLikeItHasContent(file)) return false;

        try {
            const text = await this.options.app.vault.cachedRead(file);
            return this.isBlankBody(file, text);
        } catch (error) {
            console.error("Failed to check daily note content:", error);
            return false;
        }
    }

    /**
     * Resolve which daily notes have an empty body.
     * Returns true when the result differs from the previous pass, so the view
     * knows it has to rebuild its list.
     */
    public async refreshEmptyStates(): Promise<boolean> {
        const enabled =
            !!this.options.hideEmptyNotes && this.options.mode === "daily";

        if (!enabled) {
            const changed = this.emptyPaths.size > 0;
            this.emptyPaths.clear();
            return changed;
        }

        const token = ++this.emptyCheckToken;
        const next = new Set<string>();

        // Only notes that look structurally empty are actually read from disk,
        // and they are read in small batches to keep large vaults responsive
        const candidates = this.allFiles.filter(
            (file) => !this.looksLikeItHasContent(file)
        );

        for (let i = 0; i < candidates.length; i += 50) {
            const chunk = candidates.slice(i, i + 50);
            const results = await Promise.all(
                chunk.map((file) => this.computeIsEmpty(file))
            );
            if (token !== this.emptyCheckToken) return false; // superseded
            results.forEach((isEmpty, index) => {
                if (isEmpty) next.add(chunk[index].path);
            });
        }

        const changed =
            next.size !== this.emptyPaths.size ||
            [...next].some((path) => !this.emptyPaths.has(path));

        this.emptyPaths = next;

        if (changed) this.filterFilesByRange();

        return changed;
    }

    /**
     * Re-check a single note after it was modified. Only handles the
     * empty -> non-empty transition: a note being emptied while you type in it
     * should not vanish under the cursor.
     */
    public async recheckFile(file: TFile): Promise<boolean> {
        if (!this.options.hideEmptyNotes || this.options.mode !== "daily") {
            return false;
        }
        if (!this.emptyPaths.has(file.path)) return false;
        if (!this.allFiles.some((f) => f.path === file.path)) return false;

        const isEmpty = await this.computeIsEmpty(file);
        if (isEmpty) return false;

        this.emptyPaths.delete(file.path);
        this.filterFilesByRange();
        return true;
    }

    /**
     * Filter files by time range
     * Applicable to folder and tag modes
     */
    private filterFilesByTimeRange(): void {
        const now = moment();
        const { isReverse, baseTimeField } = this.parseTimeField(
            this.options.timeField
        );

        // Filter files by creation or modification time
        this.filteredFiles = this.allFiles.filter((file) => {
            // Get the time of the file based on the base timeField option
            const fileDate = moment(file.stat[baseTimeField]);

            return this.isDateInRange(fileDate, now);
        });

        // If using reverse time field, reverse the order of filtered files
        if (isReverse) {
            this.filteredFiles.reverse();
        }
    }

    /**
     * Filter daily notes by date
     * Applicable to daily mode
     */
    private filterDailyNotesByRange(): void {
        const now = moment();

        // getDateFromFile handles formats with folder segments (e.g. YYYY/MM/YYYY-MM-DD)
        this.filteredFiles = this.allFiles.filter((file) => {
            const fileDate = getDateFromFile(file as any, "day");
            return !!fileDate && this.isDateInRange(fileDate, now);
        });
    }

    /**
     * Check if the file date is in the range
     * @param fileDate file date
     * @param now current date
     * @returns whether in the range
     */
    private isDateInRange(
        fileDate: moment.Moment,
        now: moment.Moment
    ): boolean {
        switch (this.options.timeRange) {
            case "week":
                return fileDate.isSame(now, "week");
            case "month":
                return fileDate.isSame(now, "month");
            case "year":
                return fileDate.isSame(now, "year");
            case "last-week":
                return fileDate.isBetween(
                    moment().subtract(1, "week").startOf("week"),
                    moment().subtract(1, "week").endOf("week"),
                    null,
                    "[]"
                );
            case "last-month":
                return fileDate.isBetween(
                    moment().subtract(1, "month").startOf("month"),
                    moment().subtract(1, "month").endOf("month"),
                    null,
                    "[]"
                );
            case "last-year":
                return fileDate.isBetween(
                    moment().subtract(1, "year").startOf("year"),
                    moment().subtract(1, "year").endOf("year"),
                    null,
                    "[]"
                );
            case "quarter":
                return fileDate.isSame(now, "quarter");
            case "last-quarter":
                return fileDate.isBetween(
                    moment().subtract(1, "quarter").startOf("quarter"),
                    moment().subtract(1, "quarter").endOf("quarter"),
                    null,
                    "[]"
                );
            case "custom":
                if (this.options.customRange) {
                    const startDate = moment(this.options.customRange.start);
                    const endDate = moment(this.options.customRange.end);
                    return fileDate.isBetween(startDate, endDate, null, "[]");
                }
                return false;
            default:
                return true;
        }
    }

    public checkDailyNote(): boolean {
        if (this.options.mode !== "daily") {
            this.hasCurrentDay = true;
            return true;
        }

        // Refresh the daily notes cache to ensure we have the latest data
        this.cacheDailyNotes = getAllDailyNotes();

        // @ts-ignore
        const currentDate = moment();
        const currentDailyNote = getDailyNote(
            currentDate,
            this.cacheDailyNotes
        );

        if (!currentDailyNote) {
            this.hasCurrentDay = false;
            return false;
        }

        // Check if we need to update the allFiles and filteredFiles arrays
        if (this.hasCurrentDay === false) {
            // We didn't have the current day's note before, but now we do
            // So we need to update our file lists
            this.allFiles = [];
            this.fetchDailyNotes();
            this.filterFilesByRange();
        }

        this.hasCurrentDay = true;
        return true;
    }

    public async createNewDailyNote(): Promise<TFile | null> {
        if (this.options.mode !== "daily" || this.hasCurrentDay) {
            return null;
        }

        const currentDate = moment();
        const currentDailyNote: any = await createDailyNote(currentDate);

        if (currentDailyNote) {
            // The vault 'create' event may already have added this file while
            // createDailyNote() was in flight
            if (!this.allFiles.some((f) => f.path === currentDailyNote.path)) {
                this.allFiles.push(currentDailyNote);
                this.allFiles = this.sortDailyNotes(this.allFiles);
            }
            this.hasCurrentDay = true;
            this.filterFilesByRange();
            return currentDailyNote;
        }

        return null;
    }

    public fileCreate(file: TFile): void {
        if (this.options.mode === "daily") {
            this.handleDailyNoteCreate(file);
        } else if (this.options.mode === "folder") {
            this.handleFolderFileCreate(file);
        } else if (this.options.mode === "tag") {
            this.handleTaggedFileCreate(file);
        }
    }

    private handleDailyNoteCreate(file: TFile): void {
        const fileDate = getDateFromFile(file as any, "day");
        if (!fileDate) return;

        // The vault 'create' event also fires for notes this plugin creates
        // itself through createNewDailyNote(), so the same file can arrive
        // twice. A duplicated entry becomes a duplicated key in the view's
        // keyed each block, which stops the whole list from rendering.
        if (!this.allFiles.some((f) => f.path === file.path)) {
            this.allFiles.push(file);
            this.allFiles = this.sortDailyNotes(this.allFiles);
            this.filterFilesByRange();
        }

        if (fileDate.isSame(moment(), "day")) this.hasCurrentDay = true;
    }

    private handleFolderFileCreate(file: TFile): void {
        if (!this.options.target) return;

        // Check if the file belongs to the target folder
        const folderPath = file.parent?.path || "";
        if (
            folderPath === this.options.target ||
            folderPath.startsWith(this.options.target + "/")
        ) {
            if (this.allFiles.some((f) => f.path === file.path)) return;

            // Add the file to the collections
            this.allFiles.push(file);

            // Sort files by the specified time field
            this.allFiles = this.sortFilesByTimeField(
                this.allFiles,
                this.options.timeField
            );

            // Update filtered files
            this.filterFilesByRange();
        }
    }

    private handleTaggedFileCreate(file: TFile): void {
        if (!this.hasTargetTag(file)) return;
        if (this.allFiles.some((f) => f.path === file.path)) return;

        // Add the file to the collections
        this.allFiles.push(file);

        // Sort files by the specified time field
        this.allFiles = this.sortFilesByTimeField(
            this.allFiles,
            this.options.timeField
        );

        // Update filtered files
        this.filterFilesByRange();
    }

    public fileDelete(file: TFile): void {
        this.emptyPaths.delete(file.path);

        // Match on path: basenames are not unique across folders
        this.filteredFiles = this.filteredFiles.filter(
            (f) => f.path !== file.path
        );
        this.allFiles = this.allFiles.filter((f) => f.path !== file.path);

        if (
            this.options.mode === "daily" &&
            getDateFromFile(file as any, "day")
        ) {
            this.filterFilesByRange();
            this.checkDailyNote();
        }
    }

    private sortDailyNotes(notes: TFile[]): TFile[] {
        // If sorting by name, use alphabetical sorting which will automatically
        // sort chronologically for date-formatted filenames
        const { baseTimeField } = this.parseTimeField(this.options.timeField);

        if (baseTimeField === "name") {
            return this.sortFilesByTimeField(
                notes,
                this.options.timeField
            );
        }

        // Canonical order: newest date first, taken from the file's own date
        // rather than from a rebuilt copy of the filename, so formats with
        // folder segments (YYYY/MM/YYYY-MM-DD) sort correctly too.
        return [...notes].sort(
            (a, b) =>
                (getDateFromFile(b as any, "day")?.valueOf() ?? 0) -
                (getDateFromFile(a as any, "day")?.valueOf() ?? 0)
        );
    }

    public getFilteredFiles(): TFile[] {
        // Return a copy: callers drain their list with splice() while lazily
        // rendering, which must not mutate the manager's internal state
        return [...this.filteredFiles];
    }

    public hasCurrentDayNote(): boolean {
        return this.hasCurrentDay;
    }

    public updateOptions(options: Partial<FileManagerOptions>): void {
        this.options = { ...this.options, ...options };

        if (
            options.timeRange ||
            options.customRange ||
            options.hideFutureDates !== undefined ||
            options.hideEmptyNotes !== undefined
        ) {
            this.filterFilesByRange();
        }

        if (options.mode || options.target) {
            this.allFiles = [];
            this.filteredFiles = [];
            this.emptyPaths.clear();
            this.hasFetched = false;
            this.fetchFiles();
        }
    }
}
