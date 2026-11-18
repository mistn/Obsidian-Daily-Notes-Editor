<script lang="ts">
    import type DailyNoteViewPlugin from "../dailyNoteViewIndex";
    import { MarkdownView, Platform, TAbstractFile, TFile, WorkspaceLeaf } from "obsidian";
    import { spawnLeafView } from "../leafView";
    import { onDestroy, onMount } from "svelte";

    export let file: TAbstractFile;
    export let plugin: DailyNoteViewPlugin;
    export let leaf: WorkspaceLeaf;
    export let shouldRender: boolean = true;
    export let autoFocus: boolean = false;

    let editorEl: HTMLElement;
    let containerEl: HTMLElement;
    let title: string;

    let rendered: boolean = false;

    let createdLeaf: WorkspaceLeaf;
    let unloadTimeout: number | null = null;
    let editorHeight: number = 100; // Default minimum height
    
    // Track if this component is being destroyed
    let isDestroying = false;
    
    // Track if the note is collapsed
    let isCollapsed: boolean = false;

    onMount(() => {
        if (file instanceof TFile) {
            title = file.basename;
        }
    });

    $: if (editorEl && shouldRender && !rendered) {
        showEditor();
    } else if (editorEl && !shouldRender && rendered) {
        scheduleUnload();
    }

    onDestroy(() => {
        isDestroying = true;
        if (unloadTimeout) {
            window.clearTimeout(unloadTimeout);
        }
        if (rendered && createdLeaf) {
            unloadEditor();
        }
    });

    function showEditor() {
        if (!(file instanceof TFile)) return;
        if (rendered) return;
        if (isDestroying) return;
        
        // Clear any pending unload
        if (unloadTimeout) {
            window.clearTimeout(unloadTimeout);
            unloadTimeout = null;
        }

        try {
            [createdLeaf] = spawnLeafView(plugin, editorEl, leaf);
            createdLeaf.setPinned(true);

            createdLeaf.setViewState({
                type: "markdown",
                state: {
                    file: file.path,
                    mode: "source",
                    source: false,
                    backlinks: !plugin.settings.hideBacklinks,
                    backlinkOpts: {
                        collapseAll: false,
                        extraContext: false,
                        sortOrder: "alphabetical",
                        showSearch: false,
                        searchQuery: "",
                        backlinkCollapsed: false,
                        unlinkedCollapsed: true
                    }
                }
            });
            createdLeaf.parentLeaf = leaf;

            rendered = true;
            
            // The editor can still be laying out when the leaf reports ready
            // (large notes, slow disks), so poll for a few frames instead of
            // giving up after a single look.
            let attempts = 0;
            const measure = () => {
                if (isDestroying || !createdLeaf || !containerEl) return;

                const view = createdLeaf.view;
                const actualHeight =
                    view instanceof MarkdownView
                        ? (view as any).editMode?.editor?.cm?.dom.innerHeight
                        : undefined;

                if (!actualHeight || actualHeight <= 0) {
                    if (++attempts < 10) window.setTimeout(measure, 100);
                    return;
                }

                editorHeight = actualHeight;
                // Apply the height to the container
                containerEl.style.minHeight = `${editorHeight}px`;

                // Don't steal focus from another window or app
                if (
                    autoFocus &&
                    view instanceof MarkdownView &&
                    containerEl.ownerDocument.hasFocus()
                ) {
                    const editor = view.editor;
                    if (editor) {
                        editor.focus();
                        // lineCount() is exclusive; the last line is -1
                        editor.setCursor(
                            Math.max(editor.lineCount() - 1, 0),
                            0
                        );
                    }
                }
            };
            window.setTimeout(measure, 100);
        } catch (error) {
            console.error("Error creating leaf view:", error);
        }
    }
    
    // Schedule unloading the editor with a delay to prevent flickering
    function scheduleUnload() {
        if (unloadTimeout) {
            window.clearTimeout(unloadTimeout);
        }
        
        // Use a longer timeout to prevent frequent load/unload cycles
        unloadTimeout = window.setTimeout(() => {
            if (!shouldRender && rendered) {
                unloadEditor();
            }
        }, 1000);
    }
    
    // Unload the editor to free up resources
    function unloadEditor() {
        if (!rendered || !createdLeaf) return;
        
        try {
            // Detach the leaf
            if (createdLeaf.detach) {
                createdLeaf.detach();
            }
            
            // Clear the editor element
            if (editorEl) {
                editorEl.empty();
            }
            
            rendered = false;
            
            // Keep the container height to prevent scroll jumps
            // The height will be maintained by the min-height we set earlier
        } catch (error) {
            console.error("Error unloading editor:", error);
        }
    }

    function handleFileIconClick() {
        if (!(file instanceof TFile)) return;
        if (leaf && !(leaf as any)?.pinned) {
            leaf.openFile(file);
        } else plugin.app.workspace.getLeaf(false).openFile(file);
    }

    function handleEditorClick(event: MouseEvent) {
        // The properties panel manages its own focus. Pulling focus back to
        // the editor here made frontmatter values impossible to edit (#89).
        const target = event.target as HTMLElement | null;
        if (target?.closest?.(".metadata-container")) return;

        // @ts-ignore
        const editor = createdLeaf?.view?.editMode?.editor;
        if (!editor) return;

        // On mobile the keyboard can be dismissed while the editor still
        // reports focus, so re-focus on every tap
        if (Platform.isMobile || !editor.hasFocus()) {
            editor.focus();
        }
    }

    // Keep Escape from bubbling up to Obsidian's "switch tab / leave editor"
    // handler. Bubble phase on purpose: CodeMirror's own Escape bindings
    // (hints, selections) have already run by the time we see the event.
    function handleEditorKeydown(event: KeyboardEvent) {
        if (event.key === "Escape" && !event.defaultPrevented) {
            event.stopPropagation();
        }
    }
    
    // Toggle collapse/expand state
    function toggleCollapse() {
        isCollapsed = !isCollapsed;
    }
</script>

<div class="daily-note-container" bind:this={containerEl} style="min-height: {isCollapsed ? 'auto' : editorHeight + 'px'};">
    <div class="daily-note">
        {#if title}
            <div class="daily-note-title inline-title">
                <!-- Collapse/Expand button -->
                <!-- svelte-ignore a11y-interactive-supports-focus -->
                <!-- svelte-ignore a11y-click-events-have-key-events -->
                <span role="button" data-collapsed={isCollapsed} class="collapse-button" on:click={toggleCollapse} title={isCollapsed ? "Expand" : "Collapse"}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-down"><path d="m6 9 6 6 6-6"/></svg>
                </span>
                <!-- svelte-ignore a11y-interactive-supports-focus -->
                <!-- svelte-ignore a11y-click-events-have-key-events -->
                <span role="link" class="clickable-link" on:click={handleFileIconClick} data-title={title}>{title}</span>
                
                
                
            </div>
        {/if}
        <!-- The handlers forward focus into the embedded editor and keep
             Escape from bubbling to Obsidian's tab switcher; the editor itself
             is the interactive element, so a role here would be noise. -->
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div class="daily-note-editor" data-collapsed={isCollapsed} bind:this={editorEl} data-title={title} on:click={handleEditorClick} on:keydown={handleEditorKeydown}>
            {#if !rendered && shouldRender}
                <div class="editor-placeholder">Loading...</div>
            {/if}
            {#if !shouldRender && !rendered}
                <div class="editor-placeholder">Scroll to view content</div>
            {/if}
        </div>
    </div>
</div>

<style>
    .daily-note-container {
        width: 100%;
        max-width: 100%;
        overflow-x: hidden;
        box-sizing: border-box;
    }

    .daily-note {
        margin-bottom: var(--size-4-5);
        padding-bottom: var(--size-4-8);
        width: 100%;
        max-width: 100%;
        box-sizing: border-box;
    }

    .daily-note:has(.daily-note-editor[data-collapsed="true"]) {
        margin-bottom: 0;
        padding-bottom: 0;
    }

    .daily-note-editor {
        min-height: 100px;
        width: 100%;
        max-width: 100%;
        overflow-x: hidden;
        box-sizing: border-box;
    }

    .daily-note-editor[data-collapsed="true"] {
        display: none;
    }

    .daily-note .collapse-button {
        display: none;
    }

    .daily-note:hover .collapse-button {
        display: block;
    }

    .daily-note .collapse-button {
        color: var(--text-muted);
    }

    .daily-note .collapse-button:hover  {
        color: var(--text-normal);
    }

    .daily-note:has(.is-readable-line-width) .daily-note-title {
        /* Match the editor's content box: a 700px column plus the scroller's
           32px horizontal padding. A fixed 716px width overflowed panes
           narrower than that, which left the title at the pane edge while the
           text stayed 32px in. */
        width: calc(100% - var(--file-margins-x, var(--size-4-8)) * 2);
        max-width: var(--file-line-width);
        margin-left: auto;
        margin-right: auto;
        margin-bottom: var(--size-4-8);
        display: flex;
        align-items: center;
        justify-content: start;

        gap: var(--size-4-2);
    }

    .collapse-button {
        margin-left: calc(var(--size-4-8) * -1);
    }

    .collapse-button[data-collapsed="true"] {
        transform: rotate(-90deg);

        transition: transform 0.2s ease;
    }

    .daily-note:not(:has(.is-readable-line-width)) .daily-note-title {
        display: flex;
        justify-content: start;
        align-items: center;
        width: 100%;
        padding-left: var(--file-margins-x, var(--size-4-8));
        padding-right: var(--file-margins-x, var(--size-4-8));
        box-sizing: border-box;
        margin-top: var(--size-4-8);

        gap: var(--size-4-2);
    }

    .clickable-link {
        cursor: pointer;
        text-decoration: none;
    }

    .clickable-link:hover {
        color: var(--color-accent);
        text-decoration: underline;
    }
    
    .editor-placeholder {
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100px;
        color: var(--text-muted);
        font-style: italic;
    }
    
    .collapse-button {
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        border-radius: 4px;
        color: var(--text-muted);
        transition: background-color 0.2s ease;
    }
    
    .collapse-button:hover {
        /* background-color: var(--background-modifier-hover); */
        color: var(--text-normal);
    }
</style>
