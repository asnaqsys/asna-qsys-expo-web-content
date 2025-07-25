﻿/*
 * Copyright (c) ASNA, Inc. and its affiliates.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export { theDdsGrid as DdsGrid };

import { AsnaDataAttrName } from './asna-data-attr.js';
import { SubfilePagingStore } from './subfile-paging/paging-store.js';
import { SubfileController } from './subfile-paging/dom-init.js';
import { PositionCursor } from './page-position-cursor.js';

const MINROWS_HIDDEN_FIELD_NAME = '__MinRows__';
const DDS_DEFAULT_FILE_LINES = 24;
const MAIN_SELECTOR = 'main[role=main]';
const CLASS_GRID_ROW = 'dds-grid-row';
const CLASS_GRID_EMPTY_ROW = 'dds-grid-empty-row';
const CLASS_PRESERVE_BLANKS = 'dds-preserve-blanks';
const CLASS_WINDOW_POPUP_RECORD_CONTAINER = 'dds-window-popup-record-container';
const CLASS_GRID_ROW_SPAN = 'dds-grid-row-span';

class DdsGrid {
    completeGridRows(form, activeWindowRecord) {
        const records = this.findAllRecords(form);

        if (!records.length) {
            return;
        }

        let pageMinRows = DDS_DEFAULT_FILE_LINES;
        const inputMinRows = form[MINROWS_HIDDEN_FIELD_NAME];
        if (inputMinRows && inputMinRows.value) {
            const minRows = parseInt(inputMinRows.value, 10);
            if (!isNaN(minRows)) {
                pageMinRows = minRows;
            }
        }

        let lastRowVal = 0;
        let lastRow = null;

        let rowSpanCollection = [];
        let exclEmptyRowList = [];

        for (let r = 0; r < records.length; r++) {
            const record = records[r];
            const recName = record.getAttribute(AsnaDataAttrName.RECORD);
            const recExclEmptyRows = record.getAttribute(AsnaDataAttrName.EXCLUDE_EMPTY_ROWS);
            let isSubfile = false;
            let isFolded = false;
            if (recName) {
                const subfileControlData = SubfilePagingStore.getSflCtlStore(recName);
                if (subfileControlData) {
                    isSubfile = true;
                    isFolded = subfileControlData.fldDrop.isFolded;
                }
            }
            if (activeWindowRecord && !record.getAttribute(AsnaDataAttrName.WINDOW) ) {
                continue;
            }

            const ddsRows = this.findRows(record);

            if (!ddsRows) {
                continue;
            }

            if (recExclEmptyRows) {
                this.unionList(exclEmptyRowList, recExclEmptyRows);
            }

            if (isSubfile && !isFolded) { // When Subfile is dropping fields, don't try to fill row gaps.
                if (ddsRows.length > 0) {
                    const row = ddsRows[0];
                    const range = this.getRowRange(row);
                    if (range && range.length === 2) {
                        const sflFromRow = parseInt(range[0], 10);
                        const sflToRow = parseInt(range[1], 10);
                        if (lastRowVal === 0) { // Subfile is first element.
                            let emptyRowsBefore = sflFromRow - 1;

                            if (emptyRowsBefore > 0) {
                                this.insertEmptyRows(emptyRowsBefore, row, 1, exclEmptyRowList);
                            }
                        }

                        lastRowVal = sflToRow;
                        lastRow = row;
                        rowSpanCollection.push(row);
                        continue;
                    }
                }
            }

            for (let i = 0, l = ddsRows.length; i < l; i++) {
                const row = ddsRows[i];
                const range = this.getRowRange(row);
                if (!range) {
                    continue;
                }
                const rowVal = parseInt(range[0], 10);
                if (lastRowVal && rowVal <= lastRowVal) {
                    continue; // Ignore: may be a row inside a subfile (outer range has precedence).
                }
                const emptyRowsBefore = rowVal - 1 - lastRowVal;

                if (emptyRowsBefore > 0 && this.isValidRowNumber(row, rowVal)) {
                    this.insertEmptyRows(emptyRowsBefore, row, lastRowVal + 1, exclEmptyRowList);
                }

                if (range.length === 2) {
                    rowSpanCollection.push(row);
                }
                lastRowVal = range.length === 2 ? range[1] : range[0];
                lastRowVal = parseInt(lastRowVal, 10);
                lastRow = row;
            }
        }

        if (!activeWindowRecord) { // Complete rows to set the height of the top-record
            if (lastRow) {
                const parent = lastRow.parentElement;

                for (let i = lastRowVal; i < pageMinRows; i++) {
                    parent.appendChild(this.createEmptyDivGridRowStyle(i + 1));
                }
            }
        }
        // else
        //    Note: For Page with active WINDOW, this is done later in completeWindowGridRows()

        rowSpanCollection.forEach((recordsContainer) => {
            this.completeRowSpanGridRows(recordsContainer);
            this.adjustVirtRowCol(recordsContainer);
        });
    }

    completeWindowGridRows(winPopup, winSpecs) {
        const pageMinRows = winSpecs.height + 1;
        const rows = this.findRows(winPopup);
        if (rows && rows.length ) {
            const lastRow = rows[rows.length - 1];
            const range = this.getRowRange(lastRow);
            if (!range) { return; }
                
            let lastRowVal = 99;
            if (range.length === 1) {
                lastRowVal = parseInt(range[0], 10);
            }
            else {
                lastRowVal = parseInt(range[1], 10);
            }
            if (lastRowVal < pageMinRows) {
                const nextSibling = lastRow.nextElementSibling;

                if (nextSibling) { // If we don't have any other non-Row sibling elements, don't bother.
                    this.insertEmptyRows(pageMinRows - lastRowVal, nextSibling, lastRowVal + 1);
                }
            }
        }
    }

    getRowRange(row) {
        const rangeVal = row.getAttribute(AsnaDataAttrName.ROW);
        if (!rangeVal) {
            return null;
        }
        const range = rangeVal.split('-');
        return range;
    }

    completeRowSpanGridRows(recordsContainer) {
        const rowRange = this.getRowRange(recordsContainer);
        if (!rowRange || rowRange.length !== 2) { return; }  // Unexpected

        const fromRow = parseInt(rowRange[0], 10);
        const toRow = parseInt(rowRange[1], 10);

        if (fromRow < 0 || toRow < fromRow) { return; }  // Unexpected

        let requestedRows = (toRow - fromRow) + 1;

        if (recordsContainer.classList.contains(CLASS_GRID_ROW_SPAN)) { // RowSpan Panel
            const a = 'var(--dds-grid-row-padding-top)';
            const b = 'calc(var(--body-font-size) * 1.1429)';
            const c = 'var(--dds-grid-row-padding-bottom)';

            const record = recordsContainer.closest(`[${AsnaDataAttrName.RECORD}]`);
            if (record) {
                const sflCtrlRecName = record.getAttribute(AsnaDataAttrName.RECORD);
                if (sflCtrlRecName) {
                    const sflCtrlData = SubfilePagingStore.getSflCtlStore(sflCtrlRecName);
                    if (sflCtrlData && sflCtrlData.sflEnd.showSubfileEnd) {
                        requestedRows++; // Add one more Grid row to show SFLEND icon
                    }
                }
            }

            recordsContainer.style.gridTemplateRows = `repeat(${requestedRows}, calc(${a} + ${b} + ${c}))`;

            const colSpanOverride = recordsContainer.getAttribute(AsnaDataAttrName.GRID_PANEL_SPAN_STYLE_COL_SPAN);
            if (colSpanOverride) {
                const colCount = parseInt(colSpanOverride);
                if (colCount > 0) {
                    recordsContainer.style.gridTemplateColumns = `repeat(${colCount}, var(--dds-grid-col-width))`;
                }
            }
            else {
                // CLASS_GRID_ROW_SPAN already has the template cols set.
            }
        }
        else {
            const rows = recordsContainer.querySelectorAll(`div[class~=${CLASS_GRID_ROW}]`);
            const emptyRows = recordsContainer.querySelectorAll(`div[class~=${CLASS_GRID_EMPTY_ROW}]`);

            const existingRows = rows.length + emptyRows.length;
            const toAddCount = requestedRows - existingRows;
            if (toAddCount > 0) {
                this.appendEmptyRows(toAddCount, recordsContainer /*, fromRow + existingRows*/);
            }
        }
    }

    adjustVirtRowCol(recordsContainer) {
        const rowRange = this.getRowRange(recordsContainer);
        if (!rowRange || rowRange.length !== 2) { return; }
        const fromRow = parseInt(rowRange[0], 10);
        const toRow = parseInt(rowRange[1], 10);

        if (fromRow < 0 || toRow < fromRow) { return; }  // Unexpected

        const rows = SubfileController.selectAllRows(recordsContainer);
        if (!rows || !rows.length) { return; }

        let vRow = fromRow;
        rows.forEach((row) => {
            if (vRow <= toRow) {
                const els = this.selectElementsWithVirtRowCol(row);
                if (els && els.length) {
                    els.forEach((el) => {
                        const rowCol = PositionCursor.parseRowCol(el.getAttribute(AsnaDataAttrName.ROWCOL));
                        if (rowCol.row && rowCol.col) {
                            el.setAttribute(AsnaDataAttrName.ROWCOL, `${vRow},${rowCol.col}`);
                        }
                    });
                }
            }
            vRow++;
        });
    }

    selectElementsWithVirtRowCol(row) {
        return row.querySelectorAll(`*[${AsnaDataAttrName.ROWCOL}]:not([${AsnaDataAttrName.ROWCOL}="])`);
    }

    findAllRecords(form) {
        const main = form.querySelector(MAIN_SELECTOR);
        if (!main) {
            return;
        }

        return this.findRecords(main);
    }

    findRecords(main) {
        return main.querySelectorAll(`div[${AsnaDataAttrName.RECORD}]`);
    }

    findDirectDescendantRecords(main) {
        let result = [];
        const children = main.children;
        for (let i = 0, l = children.length; i < l; i++) {
            const child = children[i];
            if (child.getAttribute(`${AsnaDataAttrName.RECORD}`)) {
                result.push(child);
            }
        }
        return result;
    }

    findRows(parentRecord) {
        const all = parentRecord.querySelectorAll(`div[${AsnaDataAttrName.ROW}]`);
        if (!all || !all.length) {
            return null;
        }

        return all;
    }

    moveRecordsToPopup(form, winPopup) {
        const mainEl = form.querySelector(MAIN_SELECTOR);
        if (!mainEl) { return; }

        const popupRecordContainer = winPopup.querySelector(`.${CLASS_WINDOW_POPUP_RECORD_CONTAINER}`);
        if (!popupRecordContainer) { return; }

        const records = this.findDirectDescendantRecords(mainEl);
        if (!records) { return; }

        for (let i = 0, l = records.length; i < l; i++) {
            const record = records[0];
            const parent = record.parentElement;
            parent.removeChild(record);
            popupRecordContainer.appendChild(record);
        }
    }

    isValidRowNumber(row, rowNumber) {
        let rangeConstraint = null;
        let parent = row.parentElement;
        while (parent) {
            if (parent.getAttribute(AsnaDataAttrName.RECORD)) {
                break;
            }

            const parentRange = this.getRowRange(parent);
            if (parentRange && parentRange.length === 2) {
                rangeConstraint = parentRange;
                break;
            }
            parent = parent.parentElement;
        }
        if (!rangeConstraint) {
            return true; // row not nested, assume valid.
        }
        const fromRow = parseInt(rangeConstraint[0], 10);
        const toRow = parseInt(rangeConstraint[1], 10);

        if (toRow <= fromRow) {
            return true; // Unexpected range, assume valid.
        }

        return rowNumber >= fromRow && rowNumber <= toRow;
    }

    insertEmptyRows(count, beforeEl, offset, excludeRowList) {
        const parent = beforeEl.parentElement;

        for (let i = 0; i < count; i++) {
            const row = i + offset;
            if ( ! excludeRowList || !excludeRowList.includes(row) ) {
                parent.insertBefore(this.createEmptyDivGridRowStyle(row), beforeEl);
            }
        }
    }

    appendEmptyRows(count, parent) {
        for (let i = 0; i < count; i++) {
            parent.appendChild(this.createEmptyDivGridRowStyle());
        }
    }

    createDivGridRowStyle(rowVal) {
        const div = document.createElement('div');
        if (rowVal) {
            div.setAttribute(AsnaDataAttrName.ROW, rowVal);
        }
        div.className = CLASS_GRID_ROW;
        return div;
    }

    createSpanGridStyle(colVal) {
        const span = document.createElement('span');
        span.className = CLASS_PRESERVE_BLANKS;
        span.setAttribute('style', `grid-column: ${colVal} / span 1; grid-row: 1`);
        span.innerText = ' ';
        return span;
    }

    createEmptyDivGridRowStyle(rowVal) {
        const emptyDiv = document.createElement('div');
        if (rowVal) {
            emptyDiv.setAttribute(AsnaDataAttrName.ROW, rowVal);
        }
        emptyDiv.className = CLASS_GRID_EMPTY_ROW;
        return emptyDiv;
    }

    truncateColumns(form) {
        let maxCol = this.calcMaxGridColumnEnd(form.querySelector(MAIN_SELECTOR));
        if (!maxCol || isNaN(maxCol)) {
            return;
        }

        if (maxCol > 0) {
            document.documentElement.style.setProperty('--dds-grid-columns', maxCol);
        }
    }

    calcMaxGridColumnEnd(container) {
        if (!container) {
            return 0;
        }

        const elementsInlineStyle = container.querySelectorAll('*[style]');

        if (!elementsInlineStyle) {
            return 0;
        }

        let maxCol = 0;

        for (let i = 0, l = elementsInlineStyle.length; i < l; i++) {
            const el = elementsInlineStyle[i];
            if (!el.style) {
                continue;
            }

            const gridStartEnd = this.getGridColStartEnd(el);
            if (gridStartEnd && gridStartEnd.end && !isNaN(gridStartEnd.end)) {
                maxCol = Math.max(maxCol, gridStartEnd.end);
            }
        }

        return maxCol;
    }

    getGridColStartEnd(el) {
        const SPAN_ = 'span ';
        const colStart = el.style.gridColumnStart;
        let start = NaN, end = NaN;

        if (colStart) {
            start = parseInt(colStart);
            const colEnd = el.style.gridColumnEnd;
            if (colEnd) {
                if (colEnd.startsWith && colEnd.startsWith(SPAN_)) {
                    if (!isNaN(start)) {
                        end = start + parseInt(colEnd.substring(SPAN_.length));
                    }
                }
                else
                    end = parseInt(colEnd);
            }
        }
        return { start: start, end: end };
    }


    findRowSpanDiv(sflCtrlName, sflCtl) {
        if (!sflCtl) {
            sflCtl = document.querySelector(`[${AsnaDataAttrName.RECORD}="${sflCtrlName}"]`);
        }

        if (!sflCtl) {
            return null;
        }

        let sfl = null;
        const slfCtlRows = this.findRows(sflCtl);

        for (let row of slfCtlRows) {
            const rowRange = this.getRowRange(row);
            if (rowRange && rowRange.length === 2 ) {
                sfl = row;
                break;
            }
        }

        return sfl;
    }

    findElAtRowCol(divRec, row, col) {
        const divRow = divRec.querySelector(`div[${AsnaDataAttrName.ROW}='${row}']`);
        if (!divRow) {
            return null;
        }

        let result = { divRow: divRow, el : null };

        const candidates = divRow.querySelectorAll('[style*="grid-column"]');

        for (let i = 0, l = candidates.length; i < l; i++) {
            if (candidates[i].style.gridColumnStart === '' + col) {
                result.el = candidates[i]; // Note: we don't care about End (or Span)
                return result;
            }
        }

        return result;
    }

    calcRowHeight(parentEl) {
        const sampleEl = document.createElement("div");
        sampleEl.className = CLASS_GRID_EMPTY_ROW;
        const newChild = parentEl.appendChild(sampleEl);
        const cssStyle = window.getComputedStyle(sampleEl, null);
        const paddigTop = parseFloat(cssStyle['padding-top']); // parseFloat to remove 'px'
        const paddigBottom = parseFloat(cssStyle['padding-bottom']);
        const minHeight = parseFloat(cssStyle['min-height']);
        parentEl.removeChild(newChild);

        return paddigTop + minHeight + paddigBottom;
    }

    calcColWidth(parentEl) {
        const divRow = this.createDivGridRowStyle('1');
        const cell = this.createSpanGridStyle(1);
        divRow.appendChild(cell);

        const newChild = parentEl.appendChild(divRow);
        const rect = cell.getBoundingClientRect();
        parentEl.removeChild(newChild);

        return rect.width;
    }

    unionList(c, exclRowAttr) {
        const list = exclRowAttr.split(',');
        const subset = [];

        list.forEach((l) => {
            const range = l.split('-');
            if (range.length == 2) {
                const from = parseInt(range[0], 10);
                const to = parseInt(range[1], 10);
                if (from > 0 && to >= from) {
                    for (let i = from; i <= to; i++) {
                        subset.push(i);
                    }
                }
            }
            else {
                subset.push(parseInt(l, 10));
            }
        });

        const uniq = [...new Set(subset)];
        uniq.forEach((row) => { if (!c.includes(row)) c.push(row); } );
    }
}

const theDdsGrid = new DdsGrid;


