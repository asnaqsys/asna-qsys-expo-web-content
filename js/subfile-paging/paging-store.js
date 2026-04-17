/*
 * Copyright (c) ASNA, Inc. and its affiliates.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export { theSubfilePagingStore as SubfilePagingStore, SubfileState, InputState };

import { Subfile } from './dom-init.js';

const CLASS_GRID_ROW = 'dds-grid-row';
const CLASS_GRID_EMPTY_ROW = 'dds-grid-empty-row';
const ATTR_SFL_END_ADDED_ROW = 'data-asna-sfl-added-row';

class SubfilePagingStore {
    constructor() {
        this.sflCtrlStorage = [];
    }

    register(sflCtrlInitData) {
        if (sflCtrlInitData.name) {
            sflCtrlInitData.current = { topRrn: sflCtrlInitData.sflRecords.from }; // Augment init data with current top-rrn
            return this.sflCtrlStorage[sflCtrlInitData.name] = sflCtrlInitData; // Note: JSON defined in ASNA.QSys.Expo.Tags.DdsSubfileControlTagHelper.ClientInitData class
        }
    }


    getSflCtlStore(name) {
        return this.sflCtrlStorage[name];
    }

    getSflCtlStoreNames() {
        let names = [];

        for (let key in this.sflCtrlStorage) {
            names.push(key);
        }

        return names;
    }

    minRRN() {
        const names = this.getSflCtlStoreNames();
        const RRN_INVALID = 9999 + 1;
        let min = RRN_INVALID;

        names.forEach(name =>
            min = Math.min(min, this.getSflCtlStore(name).current.topRrn)
        );

        return min === RRN_INVALID ? 0 : min;
    }
}

class InputState {
    constructor(isCheckbox, val, checked) {
        this.isCheckbox = isCheckbox;
        if (this.isCheckbox) {
            this.checked = checked;
        } else {
            this.value = val;
        }
    }
}

class SubfileState {

    static getInputStateChange(newStateHash, key, initial, current) {
        let initialInputState = initial[key];
        let currentInputState = current[key];

        if (!(currentInputState instanceof InputState) || !(initialInputState instanceof InputState)) {
            return;
        }

        if (currentInputState.isCheckbox) {
            if (currentInputState.checked !== initialInputState.checked) {
                newStateHash[key] = currentInputState;
            }
        }
        else if (currentInputState.value !== initialInputState.value) {
            newStateHash[key] = currentInputState;
        }
    }

    static getPageInputStateChanges(initialPageState, currentPageState) {
        let result = [];

        if (initialPageState.length !== currentPageState.length) { return result; }

        // Note: row hiddenState is not compared.
        for (let row = 0, l = initialPageState.length; row < l; row++) {
            const initialRowState = initialPageState[row];
            const currentRowState = currentPageState[row];
            let rowChanges = [];
            for (let key in initialRowState.state) {
                SubfileState.getInputStateChange(rowChanges, key, initialRowState.state, currentRowState.state);
            }
            if (Object.keys(rowChanges).length > 0) {
                result.push({ hiddenState: initialRowState.hiddenState, state: rowChanges });
            }
        }

        return result;
    }

    static mergeInputState(sflEdits, newEdits) {
        let mergedEdits = [];
        let usedHiddenKeys = {};

        // First, copy all existing edits
        for (let i = 0, l = sflEdits.length; i < l; i++) {
            const currentRow = sflEdits[i];
            const mergedRow = { hiddenState: currentRow.hiddenState, state: [] };

            // Build a key from hiddenState to identify the row
            const rowKey = SubfileState.getRowKey(currentRow.hiddenState);
            usedHiddenKeys[rowKey] = i; // Track which rows we've seen

            // Check if this row exists in newEdits (by matching hiddenState)
            const matchingNewRow = SubfileState.findRowByHiddenState(newEdits, currentRow.hiddenState);

            for (let key in currentRow.state) {
                if (matchingNewRow && matchingNewRow.state[key] instanceof InputState) {
                    // New edit for same field - use the newer value
                    mergedRow.state[key] = matchingNewRow.state[key];
                }
                else {
                    // Keep existing edit
                    mergedRow.state[key] = currentRow.state[key];
                }
            }

            // Add any new fields from matchingNewRow that weren't in currentRow
            if (matchingNewRow) {
                for (let key in matchingNewRow.state) {
                    if (!(key in mergedRow.state)) {
                        mergedRow.state[key] = matchingNewRow.state[key];
                    }
                }
            }

            mergedEdits.push(mergedRow);
        }

        // Add any completely new rows from newEdits that weren't in sflEdits
        for (let i = 0, l = newEdits.length; i < l; i++) {
            const newEditRow = newEdits[i];
            const rowKey = SubfileState.getRowKey(newEditRow.hiddenState);

            if (!(rowKey in usedHiddenKeys)) {
                mergedEdits.push({ hiddenState: newEditRow.hiddenState, state: { ...newEditRow.state } });
            }
        }

        return mergedEdits;
    }

    static getRowKey(hiddenState) {
        // Create a unique key from the hiddenState to identify the row
        let key = '';
        for (let k in hiddenState) {
            if (hiddenState[k] instanceof InputState) {
                key += `${k}=${hiddenState[k].value};`;
            }
        }
        return key;
    }

    static findRowByHiddenState(edits, targetHiddenState) {
        const targetKey = SubfileState.getRowKey(targetHiddenState);
        for (let i = 0, l = edits.length; i < l; i++) {
            if (SubfileState.getRowKey(edits[i].hiddenState) === targetKey) {
                return edits[i];
            }
        }
        return null;
    }

    static rememberPageState(recordsContainer) {
        if (!recordsContainer) { return []; }
        const rows = recordsContainer.tagName === 'TBODY'
            ? recordsContainer.querySelectorAll('tr')
            : recordsContainer.querySelectorAll(`div[class~="${CLASS_GRID_ROW}"]:not([${ATTR_SFL_END_ADDED_ROW}])`);
        if (rows.length === 0) { return []; }

        const sflState = [];
        for (let i = 0, l = rows.length; i < l; i++) {
            const row = rows[i];
            const rowState = { hiddenState: [], state: [] };
            const rowContainer = recordsContainer.tagName === 'TBODY' ? row : row.parentElement;
            if (rowContainer) {
                const hiddenList = rowContainer.querySelectorAll('input[type="hidden"]');
                for (let h = 0, lh = hiddenList.length; h < lh; h++) {
                    Subfile.addInputState(rowState.hiddenState, hiddenList[h]);
                }
            }

            const notHiddenInput = row.querySelectorAll('input:not([type="hidden"]), select, textarea'); // Note: select and textarea cannot be hidden, so no need to exclude hidden type for them.

            for (let j = 0, li = notHiddenInput.length; j < li; j++) {
                Subfile.addInputState(rowState.state, notHiddenInput[j]);
            }

            sflState.push(rowState);
        }

        return sflState;
    }

    static RestoreInputChanges(recordsContainer, edits) {
        for (let i = 0, l = edits.length; i < l; i++) {
            for (let key in edits[i].state) {
                Subfile.restoreEdit(recordsContainer, key, edits[i].state[key]);
            }
        }
    }
}

const theSubfilePagingStore = new SubfilePagingStore();