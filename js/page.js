﻿/*
 * Copyright (c) ASNA, Inc. and its affiliates.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export { thePage as Page };

import { Kbd, AidKeyHelper, AidKeyMapIndex } from '../js/kbd.js';
import { DomEvents, Units } from '../js/dom-events.js';
import { FeedbackArea } from '../js/feedback-area.js';
import { LetterSpacing } from '../js/letter-spacing.js';
import { InvertFontColors } from '../js/invert-font-colors.js';
import { Calendar } from '../js/calendar/calendar.js';
import { DdsGrid } from '../js/dds-grid.js';
import { DropDown, ContextMenu, DecRange, BarcodeProxy } from '../js/dropdown.js';
import { Checkbox, RadioButtonGroup } from '../js/multiple-choice.js';
import { WaitForResponseAnimation } from '../js/wait-response/wait-response-animation.js';
import { NavigationMenu } from '../js/nav-menu.js';
import { DdsWindow } from '../js/dds-window.js';
import { SubfileController, Compat, Storage } from '../js/subfile-paging/dom-init.js';
import { SubfilePaging } from '../js/subfile-paging/paging.js';
import { SubfilePagingStore, SubfileState } from '../js/subfile-paging/paging-store.js';
import { PositionCursor } from '../js/page-position-cursor.js';
import { Subfile } from '../js/subfile-paging/dom-init.js';
import { Base64 } from '../js/base-64.js';
import { AsnaDataAttrName } from '../js/asna-data-attr.js';
import { Icons, IconCache } from '../js/icon.js';
import { Validate } from '../js/validate.js';
import { StringExt } from '../js/string.js';
import { PageAlert } from './page-alert.js';
import { Signature } from './signature/signature.js';
import { BrowserInfo } from './detection.js';
import { DynamicList } from './dynamic-list.js';

const MAIN_SELECTOR = 'main[role=main]';

const EXPO_CSS_CLASS = { // Defined in expo.css
    UNINITIALIZED: 'display-element-uninitialized',
    INITIALIZED: 'display-element-initialized',
    INITIALIZED_WITH_WINDOW: 'display-with-window-initialized'
}

const STORAGE_NS = {
    PAGEGLOBALS: 'ASNA.Page'
}

class Page {
    constructor() {
        this.handleDocumentKeyDown = this.handleDocumentKeyDown.bind(this);
        this.handlePushKeyOnClickEvent = this.handlePushKeyOnClickEvent.bind(this);
        this.handleOnFocusEvent = this.handleOnFocusEvent.bind(this);
        this.handleWindowResizeEvent = this.handleWindowResizeEvent.bind(this);
        this.handleMainPanelScrollEvent = this.handleMainPanelScrollEvent.bind(this);
        this.handleMainPanelClickEvent = this.handleMainPanelClickEvent.bind(this);
        this.handleDocScrollEvent = this.handleDocScrollEvent.bind(this);
        this.handleAjaxGetRecordsResponseEvent = this.handleAjaxGetRecordsResponseEvent.bind(this);
        this.handleAjaxGetRecordsErrorEvent = this.handleAjaxGetRecordsErrorEvent.bind(this);
        this.handleAjaxGetIconsResponseEvent = this.handleAjaxGetIconsResponseEvent.bind(this);
        this.handleHtmlToImageFilterEvent = this.handleHtmlToImageFilterEvent.bind(this);
        this.handleHtmlToImageCompleteEvent = this.handleHtmlToImageCompleteEvent.bind(this);

        this.pushKey = this.pushKey.bind(this); // Accessible through window.asnaExpo
    }

    init(options) {
        if (options && options.formId) {
            this.formId = options.formId;
        }

        const thisForm = this.getForm();

        if (!thisForm) {
            return;
        }
        const hiddenInput = thisForm.__atKMap__;
        this.aidKeyBitmap = hiddenInput ? hiddenInput.value: '';
        document.addEventListener('keydown', this.handleDocumentKeyDown, false);
        this.suspendAsyncPost = false;

        // If DdsFunctionKeys Location="Hidden", remove it before Window calculations.
        const nav = document.querySelector(`nav[${AsnaDataAttrName.ACTIVEKEY_LOCATION}]`);
        if (nav) {
            const location = nav.getAttribute(AsnaDataAttrName.ACTIVEKEY_LOCATION);
            if (location === 'hidden') {
                window.asnaExpo.page.activeFunctionKeys = NavigationMenu.serializeCommandKeyData(nav);
                nav.parentNode.removeChild(nav);
            }
        }

        DdsWindow.init(thisForm);
        const main = thisForm.querySelector(MAIN_SELECTOR);
        const sflEndIcons = SubfileController.init(main, this.handlePushKeyOnClickEvent);
        DdsGrid.completeGridRows(thisForm, DdsWindow.activeWindowRecord);
        if (sflEndIcons && sflEndIcons.length) {
            SubfileController.moveEmptyRowsBeforeSflEndRow(thisForm);
        }
        this.stretchConstantsText();
        this.addOnClickPushKeyEventListener();
        this.applyInvertFontColors();
        this.applyUnderline();
        this.initStandardCalendar();
        DropDown.initBoxes();
        DecRange.init(thisForm);
        BarcodeProxy.init(thisForm);
        Checkbox.init(thisForm);
        RadioButtonGroup.init(thisForm);
        Signature.init(thisForm);
        this.addOnFocusEventListener();

        WaitForResponseAnimation.init(thisForm);
        const twoPanelContainer = NavigationMenu.init(EXPO_CSS_CLASS.UNINITIALIZED);

        if (twoPanelContainer) {
            twoPanelContainer.removeAttribute('style'); // Style should only contain display-hidden, remove it. Let the class take effect
        }

        this.winPopup = null;
        if (DdsWindow.activeWindowRecord !== null) {
            const imgData = DdsWindow.restoreWindowPrevPage();
            this.winPopup = DdsWindow.initPopup(thisForm);
            if (imgData && main) {
                const rect = Page.restoreLastMainHeight('/');
                main.style.height = rect ? `${rect.height}px` : 'calc(27 * 1.4em)';
            }
        }
        this.setAsInitialized(main, this.winPopup!== null);

        if (this.winPopup) {
            DdsGrid.moveRecordsToPopup(thisForm, this.winPopup);
            DdsGrid.completeWindowGridRows(this.winPopup, DdsWindow.winSpecs);
        }

        DdsGrid.truncateColumns(thisForm);

        window.addEventListener('resize', this.handleWindowResizeEvent, false);

        if (main) {
            const mainPanel = main.parentElement;
            if (mainPanel) {
                mainPanel.addEventListener('scroll', this.handleMainPanelScrollEvent, false);
            }
        }
        document.addEventListener('scroll', this.handleDocScrollEvent, false);

        Page.setupAutoPostback(thisForm, this.aidKeyBitmap);
        Page.setupLeftPad(thisForm);
        Validate.setupMandatory(thisForm);
        FeedbackArea.updateSflLowestRRN(thisForm, SubfilePagingStore.minRRN());

        if (thisForm.__CursorLocation__ && thisForm.__CursorLocation__.value) {
            PositionCursor.removeFieldAttribute();
            PositionCursor.toRowCol(thisForm, thisForm.__CursorLocation__.value);
        }
        else {
            PositionCursor.toDefaultField(thisForm);
        }
        this.initIcons(sflEndIcons);
        SubfileController.restoreLastSubfileClicked(window.location.pathname);
        ContextMenu.initNonSubfileMenus(main);
        if (ContextMenu.prepare(main)) {
            main.addEventListener('click', this.handleMainPanelClickEvent, false);
        }
        this.resetLastClickOnFocus = true;

        DynamicList.init(thisForm);
    }

    static setupAutoPostback(form, aidKeyBitmap) {
        const autoPBEls = form.querySelectorAll(`[${AsnaDataAttrName.AUTO_POSTBACK}]`);

        const aidKeyHelper = new AidKeyHelper(aidKeyBitmap);

        autoPBEls.forEach((el) => {
            const key = el.getAttribute(AsnaDataAttrName.AUTO_POSTBACK);
            el.removeAttribute(AsnaDataAttrName.AUTO_POSTBACK);
            if (key && aidKeyHelper.isEnabled(AidKeyHelper.keyToMapIndex(key))) {
                let maxLen = 1;
                const maxLenAtr = el.getAttribute('maxlength');
                if (maxLenAtr) {
                    maxLen = parseInt(maxLenAtr, 10);
                }

                if (el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA") {
                    el.addEventListener('input', (event) => {
                        const target = event.target;
                        if ((maxLen <= 1 || !(typeof target.value === 'string')) ||
                            (typeof target.value === 'string' && target.value.length == maxLen)) {
                            window.asnaExpo.page.pushKey(key);
                        }
                    });
                }
                else {
                    el.addEventListener('click', () => { window.asnaExpo.page.pushKey(key); });
                }
            }
        });
    }

    static setupLeftPad(form) {
        const leftPadEls = form.querySelectorAll(`[${AsnaDataAttrName.LEFT_PAD}]`);

        leftPadEls.forEach((el) => {
            const lpParms = el.getAttribute(AsnaDataAttrName.LEFT_PAD);
            el.removeAttribute(AsnaDataAttrName.LEFT_PAD);
            if (lpParms && lpParms.indexOf(',') > 0) {
                const parts = lpParms.split(',');
                if (parts.length === 2) {
                    const len = parseInt(parts[0], 10);
                    const char = parts[1];
                    if (len > 0 && (char === 'b' || char === 'z')) {
                        el.addEventListener('blur', (e) => {
                            const input = e.target;
                            if (!input || typeof input.value !== 'string') { return; }
                            input.value = StringExt.padLeft(input.value, len, char==='z'?'0':' ');
                        });
                    }
                }
            }
        });
    }

    static parseCol(fnStr, data) {
        if (fnStr !== 'coltopix') { return 0; }

        const parts = data.split('(');
        if (parts.length < 2) { return 0; }
        return parseInt(parts[1],10)-1; // Note: closing paren. ignored
    }

    handleDocumentKeyDown(event) {
        if (this.suspendAsyncPost || this.isCalendarActive() || event.target && event.target.tagName === 'BUTTON') { // Not an event generated by page directly.
            return false; // Ignore
        }

        const action = Kbd.processKeyDown(event, this.aidKeyBitmap);
        const aidKey = action.aidKeyToPush;

        if (aidKey) {
            PageAlert.removeVolatileMsgs(true);

            const store = action.sflCtlStore;
            let postAjax = action.useAjax && store;
            if (postAjax) {
                postAjax = !((aidKey === 'PgDn' || aidKey === 'PgUp') && !store.sflRecords.allowsAjax);
                if (postAjax) {
                    this.suspendAsyncPost = true;
                    if (!SubfilePaging.requestPage(aidKey, store, this.handleAjaxGetRecordsResponseEvent, this.handleAjaxGetRecordsErrorEvent)) {
                        this.suspendAsyncPost = false;
                    }
                }
            }
            else {
                this.pushKey(aidKey, null, null, action.vRowCol );
            }
        }
        else if (action.removeVolatileMsgs) {
            PageAlert.removeVolatileMsgs(true);
        }

        if (action.shouldCancel) {
            DomEvents.cancelEvent(event);
        }

        if (action.returnBooleanValue) {
            return action.ReturnBooleanValue;
        }
    }

    handlePushKeyOnClickEvent(event, keyToPush, focusElName, fieldValue, virtualRowCol) {
        if (this.suspendAsyncPost) {
            return;
        }
        const keyDetail = Kbd.convertKeyNameToKeyDetail(keyToPush, this.aidKeyBitmap);
        if (keyDetail) {
            if (!keyDetail.target && event && event.target) {
                keyDetail.target = event.target;
            }
            const action = Kbd.processKeyDetail(keyDetail, this.aidKeyBitmap);
            const aidKey = action.aidKeyToPush;
            const store = action.sflCtlStore;

            if (aidKey && action.useAjax && store) {
                const postAjax = !((aidKey === 'PgDn' || aidKey === 'PgUp') && !store.sflRecords.allowsAjax);
                if (postAjax) {
                    this.suspendAsyncPost = true;
                    if (!SubfilePaging.requestPage(aidKey, store, this.handleAjaxGetRecordsResponseEvent, this.handleAjaxGetRecordsErrorEvent)) {
                        this.suspendAsyncPost = false;
                    }
                    return;
                }
            }

            if (!virtualRowCol && action.vRowCol) {
                virtualRowCol = action.vRowCol;
            }
        }

        if (focusElName === '*PREVIOUS') {
            const focusEl = PositionCursor.resolvePrevInputSibling(event.target);
            if (focusEl) {
                focusElName = focusEl.getAttribute('name');
            }
        }

        this.pushKey(keyToPush, focusElName, fieldValue, virtualRowCol);
    }

    handleOnFocusEvent(element) {
        const activeWinSpecs = DdsWindow.parseWinSpec();
        FeedbackArea.updateSubfileCursorRrnForElement(element);
        FeedbackArea.updateElementFeedback(this.getForm(), element, activeWinSpecs);

        window.asnaExpo.page.lastFocus = element;

        if (BrowserInfo.isDesktop()) {
            if (element.value && element.value.length && typeof element.value.length === 'number') {
                const toPos = element.value.length;
                PositionCursor.selectText(element, 0, toPos);
            }
        }

        if (this.resetLastClickOnFocus) {
            SubfileController.resetLastClickedSubfile(element);
        }
    }

    handleWindowResizeEvent() {
        const main = document.querySelector(MAIN_SELECTOR);
        if (main) {
            ContextMenu.hideMenus(main);
        }
    }

    handleMainPanelScrollEvent(event) {
        const main = document.querySelector(MAIN_SELECTOR);
        if (main) {
            ContextMenu.hideMenus(main);
        }
    }

    handleDocScrollEvent(event) {
        const main = document.querySelector(MAIN_SELECTOR);
        if (main) {
            ContextMenu.hideMenus(main);
        }
    }

    handleAjaxGetRecordsResponseEvent(res) {
        this.suspendAsyncPost = false;

        // console.log(`AJAX response. ${res.request.recordName} Requested from:${res.request.from} to:${res.request.to} Got ${res.recordCount}`);

        if (res.recordCount <= 0) {
            const aidKeyHelper = new AidKeyHelper(this.aidKeyBitmap);

            if (res.request.requestorAidKey === "PgDn" && aidKeyHelper.isEnabled(AidKeyMapIndex.PageDown) ||
                res.request.requestorAidKey === "PgUp" && aidKeyHelper.isEnabled(AidKeyMapIndex.PageUp)) {
                this.pushKey(res.request.requestorAidKey);
                return;
            }
            
            Kbd.showInvalidRollAlert();
            return;
        }

        const form = this.getForm();
        let sflCtrlStore = SubfilePagingStore.getSflCtlStore(res.request.recordName);
        let recordsContainer = DdsGrid.findRowSpanDiv(res.request.recordName);
        const divRowSpan = recordsContainer;
        if (!recordsContainer || !res.html || !sflCtrlStore) { return; } // Ignore - for now ...

        const tBody = recordsContainer.querySelector('tbody');
        if (tBody) {
            recordsContainer = tBody;
        }

        if (typeof (MonarchSubfilePageChanging) === 'function') {   // Notify user-code
            MonarchSubfilePageChanging(res.request.recordName, recordsContainer, res.request.from, res.request.request.to - 1, res.request.mode);
        }

        const oldTopRrn = sflCtrlStore.current.topRrn;

        sflCtrlStore.sflRecords.from = Math.min(Math.min(sflCtrlStore.sflRecords.from, res.request.from), sflCtrlStore.sflRecords.from);
        sflCtrlStore.sflRecords.to = Math.max(sflCtrlStore.sflRecords.to, res.request.to-1);
        sflCtrlStore.sflRecords.isLastPage = Compat.boolIsTrue(res.isLastPage);
        sflCtrlStore.current.topRrn = res.request.from;

        if (res.request.requestorAidKey === sflCtrlStore.fldDrop.aidKey) {
            sflCtrlStore.fldDrop.isFolded = ! res.request.wantDropped; 
        }

        let currentPageState = SubfileState.rememberPageState(recordsContainer);

        // Before replacing Page, save edits by comparing initialState with state of subfile page about to be replaced.
        let currentPageEdits = SubfileState.getPageInputStateChanges(sflCtrlStore.initialPageState, currentPageState);
        if (!sflCtrlStore.sflEdits) { 
            sflCtrlStore.sflEdits = currentPageEdits; // First paging transition
        }
        else {
            sflCtrlStore.sflEdits = SubfileState.mergeInputState(sflCtrlStore.sflEdits, currentPageEdits);
        }

        let cursorPosRrnOffset = -1;
        let lastSflFldWithCursorName = '';
        const needToRestoreCursor = PositionCursor.isCursorAtSubfile(recordsContainer);
        if (needToRestoreCursor) {
            lastSflFldWithCursorName = PositionCursor.activeFieldName();
            const rrnFld = Subfile.findHiddenRrn(recordsContainer, lastSflFldWithCursorName);
            if (rrnFld && rrnFld.value ) {
                cursorPosRrnOffset = parseInt(rrnFld.value, 10) - oldTopRrn;
            }
        }

        recordsContainer.innerHTML = res.html;

        // Re-apply style changes marked by 'data-asna-xxx' attributes
        if (!tBody) {
            DdsGrid.completeRowSpanGridRows(recordsContainer);
            DdsGrid.adjustVirtRowCol(recordsContainer);
        }
        this.stretchConstantsText();
        this.addOnClickPushKeyEventListener();
        this.applyInvertFontColors();
        this.initStandardCalendar();
        DropDown.initBoxes();
        this.initIcons();
        Checkbox.init(form);
        RadioButtonGroup.init(form);
        this.addOnFocusEventListener();

        // Now restore the edits if this page had been seen before
        SubfileState.RestoreInputChanges(recordsContainer, sflCtrlStore.sflEdits);
        const withGridCol = SubfileController.selectAllWithGridColumns(recordsContainer);
        const sflColRange = SubfileController.calcSflMinMaxColRange(withGridCol);

        SubfileController.addMouseCueEvents(divRowSpan, sflCtrlStore.inputBehaviour);

        if (!tBody) {
            SubfileController.removeRowGap(recordsContainer);
        }

        if (sflCtrlStore.sflEnd.showSubfileEnd) {
            const showAtBottom = Compat.boolIsTrue(sflCtrlStore.sflRecords.isLastPage) ?sflCtrlStore.sflEnd.isSufileEnd: false;
            const icon = SubfileController.addSubfileEndCue(
                recordsContainer,
                showAtBottom,
                showAtBottom ? sflCtrlStore.sflEnd.textOn : sflCtrlStore.sflEnd.textOff,
                sflColRange,
                this.handlePushKeyOnClickEvent
            );

            let sflEndIcons = [];
            if (icon && icon.el && icon.iconParms && icon.iconParms.title) {
                sflEndIcons.push(icon);
            }
            if (sflEndIcons.length>0)
                this.initIcons(sflEndIcons);
        }

        sflCtrlStore.initialPageState = SubfileState.rememberPageState(recordsContainer); // Initial State of new page.

        const topRrn = sflCtrlStore.current.topRrn;
        if (needToRestoreCursor) {
            let newFldWithCursorName = '';
            if (cursorPosRrnOffset >= 0 && lastSflFldWithCursorName) {
                newFldWithCursorName = Subfile.makeFieldName(lastSflFldWithCursorName, topRrn + cursorPosRrnOffset);
            }
            PositionCursor.restoreFocus(recordsContainer, newFldWithCursorName, res.request.requestorAidKey);
        }

        FeedbackArea.updateSflLowestRRN(form, topRrn);
        FeedbackArea.updateSubfileCursorRrn(form, topRrn + (cursorPosRrnOffset >= 0?cursorPosRrnOffset:0));

        if (typeof (MonarchSubfilePageChanged) === 'function') {   // Notify user-code
            MonarchSubfilePageChanged(res.request.recordName, recordsContainer, res.request.from, res.request.request.to - 1, res.request.mode);
        }
    }

    handleAjaxGetRecordsErrorEvent(error) {
        this.suspendAsyncPost = false;
        console.log(`Get records Ajax error: ${error}`);
    }

    handleMainPanelClickEvent(event) {
        const main = (this.getForm()).querySelector(MAIN_SELECTOR);
        if (main) {
            ContextMenu.hideMenus(main);
        }
    }

    getForm() {
        return this.formId ? document.forms[this.formId] : document.forms[0];
    }

    pushKey(aidKeyToPush, focusElementName, fieldValue, virtualRowCol) {
        this.suspendAsyncPost = true;

        const form = this.getForm();

        if (focusElementName) {
            const focusElements = form[focusElementName];
            if (focusElements) {
                const focusElement = focusElements.length > 0 ? focusElements[0] : focusElements;
                FeedbackArea.updateSubfileCursorRrnForElement(focusElement);
                FeedbackArea.updateElementFeedback(form, focusElement, DdsWindow.parseWinSpec());
                if (fieldValue) {
                    focusElement.value = fieldValue;
                }
            }
        }

        if (virtualRowCol) {
            FeedbackArea.updateRowColFeedback(form, virtualRowCol);
        }

        if (aidKeyToPush === "None") { // Context Menu option requesting to not submit.
            this.suspendAsyncPost = false;
            return;
        }

        FeedbackArea.updatePushedKey(form, aidKeyToPush);

        if (!Validate.validateMandatory(form, aidKeyToPush, this.aidKeyBitmap)) {
            this.suspendAsyncPost = false;
            return;
        }

        Validate.validateDateConstraint(form);

        if (!Validate.reportFormValidity(form)) {
            this.suspendAsyncPost = false;
            return;
        }

        const delaySubmit = DdsWindow.prepareForSubmit(form, this.handleHtmlToImageCompleteEvent, this.handleHtmlToImageFilterEvent );

        WaitForResponseAnimation.prepareWaitAnimation(true);
        WaitForResponseAnimation.showAnimationIfLongWait({ checkTransaction: true, normalWaitTimeout: 2000 });

        let sflCtrlRecNames = SubfilePagingStore.getSflCtlStoreNames();
        for (let i = 0; i < sflCtrlRecNames.length; i++ )
            SubfilePaging.createDOM_ElementsEdited(sflCtrlRecNames[i]);

        Checkbox.prepareForSubmit(form);
        RadioButtonGroup.prepareForSubmit(form);
        Signature.prepareForSubmit(form);
        DecDate.prepareForSubmit(form);
        SubfileController.saveLastSubfileClicked(window.location.pathname);
        if (!delaySubmit) {
            form.submit();  // Note: No need to set this.suspendAsyncPost = false (page will be de-allocated).
        }
        else {
            const main = form.querySelector(MAIN_SELECTOR);
            Page.saveLastMainHeight(main, '/');
        }
    }

    handleHtmlToImageFilterEvent(node) {
        if ( typeof MonarchWindowBackgroundHtmlToImageFilter === 'function' ) {
            return MonarchWindowBackgroundHtmlToImageFilter(node);
        }

        return true;
    }

    handleHtmlToImageCompleteEvent(winBackgroundImageData,error) {
        if (winBackgroundImageData) {
            DdsWindow.completePrepareSubmit(winBackgroundImageData);
        }

        const form = this.getForm();
        form.submit();
    }

    stretchConstantsText() {
        const elements = document.querySelectorAll(`[${AsnaDataAttrName.STRETCH_ME}]`);
        const gridColWidth = getComputedStyle(document.documentElement).getPropertyValue('--dds-grid-col-width');

        for (let i = 0, l = elements.length; i < l; i++) {
            const span = elements[i];

            if (span.textContent) {
                span.style.letterSpacing = LetterSpacing.computeForElement(span, Units.toPixels(gridColWidth, span));
            }
            span.removeAttribute(AsnaDataAttrName.STRETCH_ME);
        }
    }

    addOnClickPushKeyEventListener() {
        const elements = document.querySelectorAll(`[${AsnaDataAttrName.ONCLICK_PUSHKEY}]`);

        for (let i = 0, l = elements.length; i < l; i++) {
            const el = elements[i];
            const encPushKeyParms = el.getAttribute(AsnaDataAttrName.ONCLICK_PUSHKEY);
            if (encPushKeyParms) {
                const pushKeyParms = JSON.parse(Base64.decode(encPushKeyParms));
                el.addEventListener('click', (event) => {
                    this.handlePushKeyOnClickEvent(event, pushKeyParms.key, pushKeyParms.focusElement, pushKeyParms.fieldValue, pushKeyParms.virtualRowCol);
                });
                el.classList.add('dds-clickable');
                el.removeAttribute(AsnaDataAttrName.ONCLICK_PUSHKEY);
            }
        }
    }

    addOnFocusEventListener() {
        [...this.getForm().elements].forEach((el) => {
            if (el.name) {
                el.addEventListener('focus', () => { this.handleOnFocusEvent(el); } );
            }
        });
    }

    applyInvertFontColors() {
        const elements = document.querySelectorAll(`[${AsnaDataAttrName.REVERSE_IMAGE}]`);

        for (let i = 0, l = elements.length; i < l; i++) {
            const el = elements[i];

            InvertFontColors.changeFontColorStyles(el);
            el.removeAttribute(AsnaDataAttrName.REVERSE_IMAGE);
        }
    }

    applyUnderline() {
        const elements = document.querySelectorAll(`[${AsnaDataAttrName.UNDERLINE}]`);

        for (let i = 0, l = elements.length; i < l; i++) {
            const el = elements[i];

            el.classList.add('dds-field-underlined');
            el.removeAttribute(AsnaDataAttrName.UNDERLINE);
        }
    }

    initStandardCalendar() {
        const elements = document.querySelectorAll(`[${AsnaDataAttrName.CALENDAR_NAMES}]`);

        for (let i = 0, l = elements.length; i < l; i++) {
            const input = elements[i];

            if (!Calendar.isLocalNamesComplete()) { // Small optimization - do it only once.
                Calendar.setLocalNames(input.getAttribute(AsnaDataAttrName.CALENDAR_NAMES));
            }

            Calendar.wrapInputWithCalButtonSibling(this.getForm(), input, input.getAttribute(AsnaDataAttrName.CALENDAR_OPTIONS));
            input.removeAttribute(AsnaDataAttrName.CALENDAR_NAMES);
            input.removeAttribute(AsnaDataAttrName.CALENDAR_OPTIONS);
        }
    }

    isCalendarActive() {
        const list = document.getElementsByClassName('calendar-table');
        return list && list.length;
    }

    initIcons(sflEndIcons) {
        const elements = document.querySelectorAll(`[${AsnaDataAttrName.ICON_ID}]`);

        let data = {};
        for (let i = 0, l = elements.length; i < l; i++) {
            const div = elements[i];
            const encIconParms = div.getAttribute(AsnaDataAttrName.ICON_ID);
            const jsonStrIconParms = Base64.decode(encIconParms);
            const iconParms = JSON.parse(jsonStrIconParms);

            Icons.processDataAsnaIconInfo(div, iconParms, data);
        }

        if (sflEndIcons) {
            for (let i = 0, l = sflEndIcons.length; i < l; i++) {
                Icons.processDataAsnaIconInfo(sflEndIcons[i].el, sflEndIcons[i].iconParms, data);
            }
        }

        if (data.iconForElement) {
            Icons.requestCollection(data, this.handleAjaxGetIconsResponseEvent);
        }
    }

    handleAjaxGetIconsResponseEvent(res) {
        if (!this.iconCache) {
            this.iconCache = new IconCache(res.shape);
        }
        else {
            this.iconCache.update(res.shape);
        }

        for (let i = 0, l = res.request.iconForElement.length; i < l; i++ ) {
            const icon = res.request.iconForElement[i];
            for (let j = 0, lj = icon.elementID.length; j < lj; j++) {
                const el = document.getElementById(icon.elementID[j]);
                if (el) {
                    const shape = this.iconCache.getShape(icon.iconID);
                    const title = el.getAttribute(AsnaDataAttrName.ICON_INTERNAL_TITLE);
                    Icons.appendSvgContent(el, shape, el.getAttribute(AsnaDataAttrName.ICON_INTERNAL_COLOR));
                    el.removeAttribute(AsnaDataAttrName.ICON_INTERNAL_COLOR);
                    el.removeAttribute(AsnaDataAttrName.ICON_INTERNAL_TITLE);
                    if (title) {
                        el.setAttribute('title', title);
                    }
                }
            }
        }
    }

    setAsInitialized(main, hasWindow) {
        if (main.classList) {
            main.classList.remove(EXPO_CSS_CLASS.UNINITIALIZED);
            main.classList.add(hasWindow ?
                EXPO_CSS_CLASS.INITIALIZED_WITH_WINDOW :
                EXPO_CSS_CLASS.INITIALIZED);
        }
    }

    static saveLastMainHeight(main, pagePathname) {
        if (main) {
            const rect = main.getBoundingClientRect();
            const storageKey = `${STORAGE_NS.PAGEGLOBALS}${pagePathname}.lastMain`;
            Storage.serailize(storageKey, { height: rect.height });
        }
    }

    static restoreLastMainHeight(pagePathname) {
        const storageKey = `${STORAGE_NS.PAGEGLOBALS}${pagePathname}.lastMain`;
        return Storage.deserialize(storageKey);
    }
}

class DecDate {
    static prepareForSubmit(form) {
        const elements = form.querySelectorAll(`input[${AsnaDataAttrName.DEC_DATE_OPTIONS}]`);

        for (let i = 0, l = elements.length; i < l; i++) {
            const input = elements[i];
            const separator = input.getAttribute(AsnaDataAttrName.DEC_DATE_OPTIONS);
            if (separator && separator.length === 1 && input.value && typeof input.value === 'string') {
                input.value = input.value.replace(new RegExp(`${separator}`, `g`), '');
            }
        }
    }
}

const thePage = new Page();

if (!window.asnaExpo) {
    window.asnaExpo = {};
}

window.asnaExpo.page = {
    pushKey: thePage.pushKey,
    lastFocus: null,
    activeFunctionKeys: []
}
