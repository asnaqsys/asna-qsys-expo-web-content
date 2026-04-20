/*
 * Copyright (c) ASNA, Inc. and its affiliates.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export { theSubfilePagingStore as SubfilePagingStore, SubfileState, InputState };

import { Subfile } from './dom-init.js';

class SubfilePagingStore {
    constructor() {
        this.sflCtrlStorage = [];
    }

    register(sflCtrlInitData) {
        if (sflCtrlInitData.name) {
            sflCtrlInitData.current = { topRrn: sflCtrlInitData.sflRecords.from };
            return this.sflCtrlStorage[sflCtrlInitData.name] = sflCtrlInitData;
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

    // Take a flat snapshot: Map<fieldName, InputState> for all input-capable elements
    static snapshotPage(container) {
        if (!container) { return new Map(); }

        const snapshot = new Map();
        const inputs = container.querySelectorAll('input:not([type="hidden"]), select, textarea');
        inputs.forEach(el => {
            if (el.name) {
                const state = Subfile.createInputState(el);
                if (state) {
                    snapshot.set(el.name, state);
                }
            }
        });
        return snapshot;
    }

    // Take a snapshot of hidden fields: Map<fieldName, InputState>
    static snapshotHiddenFields(container) {
        if (!container) { return new Map(); }

        const snapshot = new Map();
        const hiddens = container.querySelectorAll('input[type="hidden"]');
        hiddens.forEach(el => {
            if (el.name) {
                const state = Subfile.createInputState(el);
                if (state) {
                    snapshot.set(el.name, state);
                }
            }
        });
        return snapshot;
    }

    // Compare initial vs current snapshot, return Map of only changed fields
    static getChanges(initialSnapshot, currentSnapshot) {
        const changes = new Map();
        for (const [name, initial] of initialSnapshot) {
            const current = currentSnapshot.get(name);
            if (!current) continue;

            const changed = initial.isCheckbox
                ? current.checked !== initial.checked
                : current.value !== initial.value;

            if (changed) {
                changes.set(name, current);
            }
        }
        return changes;
    }

    // Merge new changes into accumulated edits (flat Map merge - newer wins)
    static mergeEdits(existingEdits, newChanges) {
        if (!existingEdits) {
            return new Map(newChanges);
        }
        for (const [name, state] of newChanges) {
            existingEdits.set(name, state);
        }
        return existingEdits;
    }

    // Merge hidden field snapshots for rows that have edits
    static mergeHiddenFields(existingHidden, newHidden, editedFieldNames) {
        if (!existingHidden) {
            existingHidden = new Map();
        }
        const editedNames = Array.from(editedFieldNames); // Materialize iterator once
        for (const [hiddenName, hiddenState] of newHidden) {
            const rrn = SubfileState.extractRRN(hiddenName);
            if (rrn !== null && SubfileState.hasEditForRRN(editedNames, rrn)) {
                existingHidden.set(hiddenName, hiddenState);
            }
        }
        return existingHidden;
    }

    // Extract the RRN (bracket index) from a field name like "Rec[7].Field"
    static extractRRN(fieldName) {
        const match = fieldName.match(/\[(\d+)\]/);
        return match ? match[1] : null;
    }

    // Check if any edited field name contains the given RRN
    static hasEditForRRN(editedFieldNames, rrn) {
        for (const name of editedFieldNames) {
            if (SubfileState.extractRRN(name) === rrn) {
                return true;
            }
        }
        return false;
    }

    // Restore edits onto a newly rendered page
    static restoreEdits(container, edits) {
        if (!edits) return;
        for (const [name, state] of edits) {
            Subfile.restoreEdit(container, name, state);
        }
    }
}

const theSubfilePagingStore = new SubfilePagingStore();