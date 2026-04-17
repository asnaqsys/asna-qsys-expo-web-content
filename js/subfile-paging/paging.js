/*
 * Copyright (c) ASNA, Inc. and its affiliates.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export { SubfilePaging };

import { Fetch } from '../ajax/ajax-fetch.js';
import { SubfilePagingStore, SubfileState } from '../subfile-paging/paging-store.js';
import { Subfile } from '../subfile-paging/dom-init.js';
import { DdsGrid } from '../dds-grid.js';
import { Kbd } from '../kbd.js';

const AJAX_RESPONSE_TIMEOUT = 3 * 60 * 1000; // 3 minutes

class SubfilePaging {
    static requestPage(aidKey, store, ajaxRespEventHandler, ajaxErrorEventHandler) {
        const subfilePageSize = store.sflRecords.pageSize;
        let reqFrom = store.current.topRrn;
        let wantDropped = !store.fldDrop.isFolded;
        let wantPageSize = subfilePageSize;
        let currentPageSize = SubfilePaging.calcPageSizeIfDropped(store, subfilePageSize);

        switch (aidKey) {
            case 'PgDn':
                wantPageSize = currentPageSize;
                reqFrom += currentPageSize;
                break;

            case 'PgUp':
                reqFrom = Math.max(store.current.topRrn - currentPageSize, 0);

                if (reqFrom == 0 && store.current.topRrn == 0) {
                    Kbd.showInvalidRollAlert();
                    return false;
                }
                wantPageSize = currentPageSize;
                break;

            default:
                if (aidKey === store.fldDrop.aidKey) { // Fold/Drop (toggle) request ... same range
                    if (!store.fldDrop.foldLinesPerRecord) { return false; }
                    const foldRowsPerRecord = parseInt(store.fldDrop.foldLinesPerRecord, 10);
                    if (foldRowsPerRecord === NaN || foldRowsPerRecord <= 0) { return false; }
                    wantDropped = store.fldDrop.isFolded ? true : false; // Request opposite
                    if (wantDropped) {
                        wantPageSize = subfilePageSize * foldRowsPerRecord;
                    }
                    else { // Transition from dropped to folded.
                        store.sflRecords.allowsAjax = true; // Folded response will have less records, allow Page Up/Down requests again.
                    }
                }
                break;
        }

        const reqTo = reqFrom + (wantPageSize - 1);

        const data = { 
            action: 'getRecords',
            recordName: store.name,
            requestorAidKey: aidKey, // If case no more reocords use to submit.
            from: reqFrom,
            to: reqTo + 1,           // The server expects one more (upper-limit is exclusive)
            wantDropped: wantDropped // The toggle happens when we receive the response.
        };

        Fetch.fetchWithTimeout( decodeURI(document.URL), data, AJAX_RESPONSE_TIMEOUT)
            .then(function (response) {
                    response.json().then(function (jsonStr) {
                        ajaxRespEventHandler(jsonStr);
                    }
                    ).catch(function (err) {
                        ajaxErrorEventHandler(err);
                    });
                }
            ).
            catch(function (err) {
                ajaxErrorEventHandler(err);
            }
        );

        return true;
    }

    static calcPageSizeIfDropped(store, pageSize) {
        if (store.fldDrop.foldLinesPerRecord && !(store.fldDrop.isFolded)) {
            const foldRowsPerRecord = parseInt(store.fldDrop.foldLinesPerRecord, 10);
            if (!(foldRowsPerRecord === NaN || foldRowsPerRecord <= 0)) {
                pageSize = store.sflRecords.pageSize * foldRowsPerRecord;
            }
        }
        return pageSize;
    }

    static createDOM_ElementsEdited(sflCtrlFormatName) {
        let sflCtrlStore = SubfilePagingStore.getSflCtlStore(sflCtrlFormatName);
        if (!sflCtrlStore || !sflCtrlStore.sflEdits) { return; }

        let sflEl = DdsGrid.findRowSpanDiv(sflCtrlFormatName);
        if (!sflEl) { return; }

        const edits = sflCtrlStore.sflEdits;
        const hiddenFields = sflCtrlStore.sflHidden || new Map();
        const injectedRRNs = new Set();

        for (const [fieldName, inputState] of edits) {
            const input = Subfile.findFieldInDOM(sflEl, fieldName);
            if (!input) {
                // Field is off-screen — clone it into the DOM for form submit
                const newOffPageInput = Subfile.cloneDOM_Element(fieldName, inputState);
                sflEl.appendChild(newOffPageInput);

                // Also inject hidden fields for this row (once per RRN)
                const rrn = SubfileState.extractRRN(fieldName);
                if (rrn && !injectedRRNs.has(rrn)) {
                    injectedRRNs.add(rrn);
                    for (const [hiddenName, hiddenState] of hiddenFields) {
                        if (SubfileState.extractRRN(hiddenName) === rrn) {
                            if (!Subfile.findFieldInDOM(sflEl, hiddenName)) {
                                const newHidden = Subfile.cloneDOM_HiddenElement(hiddenName, hiddenState);
                                sflEl.appendChild(newHidden);
                            }
                        }
                    }
                }
            }
        }
    }
}
