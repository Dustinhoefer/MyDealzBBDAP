// ==UserScript==
// @name         MyDealz - Deal-Alarme Button Blocker
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Öffnet einen Popup mit Deal-Alarme Inhalt beim Klick auf den Button
// @author       You
// @match        https://www.mydealz.de/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    console.log('[MyDealz Button Blocker] Script gestartet');

    let buttonBlocked = false;
    let observer = null;
    let popupOverlay = null;
    let popupContainer = null;

    // Button-Position für Popup-Positionierung finden
    function getButtonPosition() {
        try {
            const button = document.getElementById('mainNavigation-alerts') || 
                          document.querySelector('a[href="/alerts/feed"]');
            
            if (!button) {
                console.log('[MyDealz Button Blocker] Button nicht gefunden für Positionierung');
                return null;
            }
            
            const rect = button.getBoundingClientRect();
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
            
            return {
                top: rect.top + scrollTop + rect.height,
                left: rect.left + scrollLeft,
                width: rect.width,
                height: rect.height
            };
        } catch (error) {
            console.error('[MyDealz Button Blocker] Fehler beim Berechnen der Button-Position:', error);
            return null;
        }
    }

    // Popup UI erstellen im MyDealz-Stil
    function createPopupUI() {
        try {
            // Prüfe ob Popup bereits im DOM existiert
            const existingPopup = document.getElementById('mydealz-popup-container');
            if (existingPopup) {
                popupContainer = existingPopup;
                console.log('[MyDealz Button Blocker] Popup UI bereits vorhanden');
                return true;
            }

            // Section-Element im MyDealz-Stil erstellen
            popupContainer = document.createElement('section');
            popupContainer.id = 'mydealz-popup-container';
            popupContainer.setAttribute('role', 'dialog');
            popupContainer.className = 'popover--menu popover--border-navDropDownPrimary zIndex--fixed popover--visible popover popover--layout-s';
            
            // Popover-Content
            const popoverContent = document.createElement('div');
            popoverContent.className = 'popover-content flex--inline popover-content--expand';
            popoverContent.style.width = '360px';
            popoverContent.style.display = 'flex';
            popoverContent.style.flexDirection = 'column';
            popoverContent.style.minHeight = '0';
            
            // Flex Container
            const flexContainer = document.createElement('div');
            flexContainer.className = 'flex flex--dir-col height--min-100 width--all-12';
            flexContainer.style.flex = '1 1 auto';
            flexContainer.style.minHeight = '0';
            flexContainer.style.height = '100%';
            
            // Header mit Close-Button (im MyDealz-Stil)
            const navDropDownHead = document.createElement('div');
            navDropDownHead.className = 'navDropDown-head';
            navDropDownHead.setAttribute('close-button', '');
            
            const headerFlex = document.createElement('div');
            headerFlex.className = 'flex flex--1 space--mr-3';
            
            const closeButton = document.createElement('button');
            closeButton.type = 'button';
            closeButton.className = 'button button--shape-circle button--type-tertiary button--mode-default button--size-s button--square';
            closeButton.setAttribute('aria-label', 'Schließen');
            closeButton.addEventListener('click', closePopup);
            
            const closeButtonSpan = document.createElement('span');
            closeButtonSpan.className = 'flex--inline boxAlign-ai--all-c';
            
            // Close Icon (SVG)
            const closeIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            closeIcon.setAttribute('width', '16');
            closeIcon.setAttribute('height', '16');
            closeIcon.setAttribute('class', 'icon icon--cross');
            const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
            use.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '/assets/img/ico_85b3e.svg#cross');
            closeIcon.appendChild(use);
            
            closeButtonSpan.appendChild(closeIcon);
            closeButton.appendChild(closeButtonSpan);
            
            headerFlex.appendChild(closeButton);
            navDropDownHead.appendChild(headerFlex);
            
            // Spacer
            const spacer = document.createElement('div');
            spacer.className = 'space--h-2 space--v-2 hide--empty';
            
            // Content-Bereich mit Iframe
            const popupContent = document.createElement('div');
            popupContent.id = 'mydealz-popup-content';
            popupContent.className = 'flex flex--dir-col notifications-content overscroll--containY';
            popupContent.style.position = 'relative';
            // Fülle den Container komplett
            popupContent.style.flex = '1 1 auto';
            popupContent.style.minHeight = '0';
            popupContent.style.width = '100%';
            
            // Iframe für die Seite
            const iframe = document.createElement('iframe');
            iframe.id = 'mydealz-popup-iframe';
            iframe.style.width = '100%';
            iframe.style.height = '100%';
            iframe.style.border = 'none';
            iframe.style.display = 'none'; // Versteckt bis geladen
            iframe.style.flex = '1 1 auto';
            iframe.style.minHeight = '0';
            iframe.style.background = 'var(--bgBaseSecondary)';
            
            // Loading-Indikator
            const loadingIndicator = document.createElement('div');
            loadingIndicator.id = 'mydealz-popup-loading';
            loadingIndicator.className = 'mydealz-popup-loading';
            loadingIndicator.innerHTML = '<div class="mydealz-spinner"></div><p>Lade Inhalte...</p>';
            loadingIndicator.style.padding = '40px 20px';
            loadingIndicator.style.textAlign = 'center';
            loadingIndicator.style.position = 'absolute';
            loadingIndicator.style.top = '0';
            loadingIndicator.style.left = '0';
            loadingIndicator.style.right = '0';
            loadingIndicator.style.bottom = '0';
            loadingIndicator.style.backgroundColor = 'var(--bgBaseSecondary)';
            loadingIndicator.style.zIndex = '10';
            
            // Error-Fallback (versteckt initial)
            const errorFallback = document.createElement('div');
            errorFallback.id = 'mydealz-popup-error';
            errorFallback.className = 'mydealz-popup-error';
            errorFallback.style.display = 'none';
            errorFallback.style.position = 'absolute';
            errorFallback.style.top = '0';
            errorFallback.style.left = '0';
            errorFallback.style.right = '0';
            errorFallback.style.bottom = '0';
            errorFallback.style.backgroundColor = 'var(--bgBaseSecondary)';
            errorFallback.style.zIndex = '20';
            errorFallback.style.padding = '40px 20px';
            errorFallback.style.textAlign = 'center';
            errorFallback.style.display = 'flex';
            errorFallback.style.flexDirection = 'column';
            errorFallback.style.alignItems = 'center';
            errorFallback.style.justifyContent = 'center';
            
            popupContent.appendChild(iframe);
            popupContent.appendChild(loadingIndicator);
            popupContent.appendChild(errorFallback);
            
            // Footer (optional, für zukünftige Erweiterungen)
            const footer = document.createElement('div');
            footer.className = 'navDropDown-footer flex--dir-row-reverse';
            footer.style.display = 'none'; // Versteckt für jetzt
            
            // Zusammenbauen
            flexContainer.appendChild(navDropDownHead);
            flexContainer.appendChild(spacer);
            flexContainer.appendChild(popupContent);
            flexContainer.appendChild(footer);
            
            popoverContent.appendChild(flexContainer);
            popupContainer.appendChild(popoverContent);
            
            console.log('[MyDealz Button Blocker] Popup UI erstellt (MyDealz-Stil)');
            return true;
        } catch (error) {
            console.error('[MyDealz Button Blocker] Fehler beim Erstellen der Popup UI:', error);
            popupContainer = null;
            return false;
        }
    }

    // Popup Styling hinzufügen (MyDealz-Stil)
    function addPopupStyles() {
        try {
            // Prüfe ob Styles bereits hinzugefügt wurden
            if (document.getElementById('mydealz-popup-styles')) {
                console.log('[MyDealz Button Blocker] Styles bereits vorhanden');
                return;
            }

            const style = document.createElement('style');
            style.id = 'mydealz-popup-styles';
            style.textContent = `
                #mydealz-popup-container {
                    position: fixed;
                    width: 360px;
                    height: 706px;
                    max-height: 85vh;
                    background: var(--bgBaseSecondary);
                    opacity: 0;
                    transform: translateY(-10px);
                    transition: opacity 0.2s ease, transform 0.2s ease;
                    pointer-events: none;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                }
                
                #mydealz-popup-container.popover--visible {
                    opacity: 1;
                    transform: translateY(0);
                    pointer-events: auto;
                }
                
                #mydealz-popup-container .popover-content {
                    height: 100%;
                    display: flex !important;
                    flex-direction: column !important;
                    width: 100%;
                    background: var(--bgBaseSecondary);
                    min-height: 0;
                    flex: 1 1 auto;
                }
                
                #mydealz-popup-container .navDropDown-head {
                    display: flex;
                    justify-content: flex-end;
                    padding: 12px;
                    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
                    background: var(--bgBaseSecondary);
                }

                /* Entferne den Spacer unter dem Header, damit der Inhalt wirklich füllt */
                #mydealz-popup-container .space--h-2.space--v-2.hide--empty {
                    display: none !important;
                }

                /* Der innere Flex-Container muss die volle Höhe nutzen, sonst bleibt unten „leer“ */
                #mydealz-popup-container .popover-content > .flex.flex--dir-col {
                    flex: 1 1 auto;
                    min-height: 0;
                    height: 100%;
                    width: 100%;
                }
                
                #mydealz-popup-container .notifications-content {
                    flex: 1 1 auto !important;
                    overflow: hidden;
                    position: relative;
                    min-height: 0 !important;
                    height: auto !important;
                    width: 100%;
                    background: var(--bgBaseSecondary);
                    max-height: none !important;
                }
                
                #mydealz-popup-content {
                    flex: 1 1 auto !important;
                    min-height: 0 !important;
                    height: auto !important;
                    width: 100% !important;
                    display: flex !important;
                    flex-direction: column !important;
                }
                
                #mydealz-popup-container .popover-content {
                    overflow: hidden;
                }
                
                #mydealz-popup-iframe {
                    flex: 1;
                    min-height: 0;
                    width: 100%;
                    height: 100%;
                    display: block;
                    background: var(--bgBaseSecondary);
                }
                
                .mydealz-popup-loading {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 60px 20px;
                    min-height: 200px;
                }
                
                .mydealz-popup-loading p {
                    margin-top: 20px;
                    color: #666;
                    font-size: 14px;
                }
                
                .mydealz-spinner {
                    width: 40px;
                    height: 40px;
                    border: 4px solid #f3f3f3;
                    border-top: 4px solid #3498db;
                    border-radius: 50%;
                    animation: mydealz-spin 1s linear infinite;
                }
                
                @keyframes mydealz-spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                
                .mydealz-popup-error {
                    padding: 40px 20px;
                    text-align: center;
                    color: #e74c3c;
                }
                
                .mydealz-popup-error h3 {
                    margin: 0 0 10px 0;
                    font-size: 18px;
                }
                
                .mydealz-popup-error p {
                    margin: 0;
                    color: #666;
                    font-size: 14px;
                }
                
                /* Custom Scrollbar Design */
                #mydealz-popup-container ::-webkit-scrollbar {
                    width: 12px;
                    height: 12px;
                }
                
                #mydealz-popup-container ::-webkit-scrollbar-track {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 6px;
                }
                
                #mydealz-popup-container ::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.4);
                    border-radius: 6px;
                    border: 2px solid transparent;
                    background-clip: padding-box;
                }
                
                #mydealz-popup-container ::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.5);
                    background-clip: padding-box;
                }
                
                #mydealz-popup-container ::-webkit-scrollbar-thumb:active {
                    background: rgba(255, 255, 255, 0.6);
                    background-clip: padding-box;
                }
                
                /* Firefox Scrollbar */
                #mydealz-popup-container {
                    scrollbar-width: thin;
                    scrollbar-color: rgba(255, 255, 255, 0.4) rgba(255, 255, 255, 0.1);
                }
                
                /* Click-Outside Handler - unsichtbarer Overlay */
                .mydealz-popup-backdrop {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    z-index: 999998;
                    background: transparent;
                }
            `;
            
            document.head.appendChild(style);
            console.log('[MyDealz Button Blocker] Popup Styles hinzugefügt');
        } catch (error) {
            console.error('[MyDealz Button Blocker] Fehler beim Hinzufügen der Styles:', error);
        }
    }

    // Content von /alerts/feed laden
    async function loadAlertsFeed() {
        try {
            console.log('[MyDealz Button Blocker] Lade Content von /alerts/feed...');
            
            const response = await fetch('https://www.mydealz.de/alerts/feed', {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const html = await response.text();
            console.log('[MyDealz Button Blocker] Content erfolgreich geladen');
            
            return html;
        } catch (error) {
            console.error('[MyDealz Button Blocker] Fehler beim Laden des Contents:', error);
            throw error;
        }
    }

    // Iframe DOM manipulieren: alles entfernen bis auf den Pfad zum Ziel-Element
    function pruneIframeToSelector(iframeElement, selector) {
        try {
            if (!iframeElement) {
                return { status: 'no_iframe' };
            }

            const doc = iframeElement.contentDocument || (iframeElement.contentWindow && iframeElement.contentWindow.document);
            if (!doc || !doc.body) {
                console.warn('[MyDealz Button Blocker] Kein Zugriff auf Iframe-Dokument (same-origin?)');
                return { status: 'no_access' };
            }

            // Schon gefiltert? (dann nicht erneut zerstören)
            if (doc.body.dataset.mydealzPruned === 'true') {
                const existingTarget = doc.querySelector(selector);
                return { status: existingTarget ? 'already' : 'already_missing' };
            }

            const target = doc.querySelector(selector);
            if (!target) {
                return { status: 'not_found' };
            }

            // Entferne alles, was NICHT den Target enthält (rekursiv entlang des Pfades)
            const prune = (root) => {
                const children = Array.from(root.children);
                for (const child of children) {
                    if (child === target || child.contains(target)) {
                        if (child !== target) {
                            prune(child);
                        }
                    } else {
                        child.remove();
                    }
                }
            };
            prune(doc.body);

            // Minimaler Reset für sauberes Layout
            doc.documentElement.style.margin = '0';
            doc.documentElement.style.padding = '0';
            doc.documentElement.style.overflow = 'auto';
            doc.documentElement.style.background = 'var(--bgBaseSecondary)';
            doc.documentElement.style.width = '100%';
            doc.documentElement.style.height = '100%';
            doc.body.style.margin = '0';
            doc.body.style.padding = '0';
            doc.body.style.overflow = 'auto';
            doc.body.style.background = 'var(--bgBaseSecondary)';
            doc.body.style.width = '100%';
            doc.body.style.height = '100%';
            doc.body.style.minHeight = '100%';

            // CSS erzwingen, damit der extrahierte Bereich wirklich die volle Breite nutzt
            const styleId = 'mydealz-popup-prune-style';
            let styleEl = doc.getElementById(styleId);
            if (!styleEl) {
                styleEl = doc.createElement('style');
                styleEl.id = styleId;
                (doc.head || doc.documentElement).appendChild(styleEl);
            }
            styleEl.textContent = `
                html, body {
                    background: var(--bgBaseSecondary) !important;
                    width: 100% !important;
                    height: 100% !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    overflow: auto !important;
                }
                body > * {
                    width: 100% !important;
                    max-width: none !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    background: var(--bgBaseSecondary) !important;
                }
                ${selector} {
                    width: 100% !important;
                    max-width: none !important;
                    margin-left: 0 !important;
                    margin-right: 0 !important;
                    padding-left: 0 !important;
                    padding-right: 0 !important;
                }
                ${selector}.space--mh-a,
                ${selector} .space--mh-a {
                    margin-left: 0 !important;
                    margin-right: 0 !important;
                }
                /* Falls innen noch ein Wrapper max-width setzt */
                ${selector} * {
                    max-width: none !important;
                }
                
                /* Custom Scrollbar Design für Iframe */
                ::-webkit-scrollbar {
                    width: 12px;
                    height: 12px;
                }
                
                ::-webkit-scrollbar-track {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 6px;
                }
                
                ::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.4);
                    border-radius: 6px;
                    border: 2px solid transparent;
                    background-clip: padding-box;
                }
                
                ::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.5);
                    background-clip: padding-box;
                }
                
                ::-webkit-scrollbar-thumb:active {
                    background: rgba(255, 255, 255, 0.6);
                    background-clip: padding-box;
                }
                
                /* Firefox Scrollbar */
                * {
                    scrollbar-width: thin;
                    scrollbar-color: rgba(255, 255, 255, 0.4) rgba(255, 255, 255, 0.1);
                }
            `;

            // Zusätzlich inline für Sicherheit (falls CSS von MyDealz „gewinnt“)
            target.style.width = '100%';
            target.style.maxWidth = 'none';
            target.style.marginLeft = '0';
            target.style.marginRight = '0';

            doc.body.dataset.mydealzPruned = 'true';
            console.log('[MyDealz Button Blocker] Iframe-Inhalt reduziert auf:', selector);
            return { status: 'applied' };
        } catch (error) {
            console.error('[MyDealz Button Blocker] Fehler bei Iframe-DOM-Manipulation:', error);
            return { status: 'error', error };
        }
    }

    // Popup öffnen
    async function openPopup() {
        try {
            console.log('[MyDealz Button Blocker] Öffne Popup...');
            
            // Stelle sicher, dass UI und Styles vorhanden sind
            if (!popupContainer || !document.getElementById('mydealz-popup-container')) {
                const created = createPopupUI();
                if (!created) {
                    console.error('[MyDealz Button Blocker] Popup konnte nicht erstellt werden');
                    return;
                }
                // Referenz neu setzen nach Erstellung (falls nötig)
                if (!popupContainer) {
                    popupContainer = document.getElementById('mydealz-popup-container');
                }
            }
            if (!document.getElementById('mydealz-popup-styles')) {
                addPopupStyles();
            }
            
            // Prüfe ob Popup erfolgreich erstellt wurde
            if (!popupContainer) {
                // Versuche es aus dem DOM zu holen
                popupContainer = document.getElementById('mydealz-popup-container');
                if (!popupContainer) {
                    console.error('[MyDealz Button Blocker] Popup-Container nicht verfügbar');
                    return;
                }
            }
            
            // Hole Button-Position
            const buttonPos = getButtonPosition();
            if (!buttonPos) {
                console.error('[MyDealz Button Blocker] Konnte Button-Position nicht ermitteln');
                return;
            }
            
            // Berechne Popup-Position (direkt am Button hängend, zentriert horizontal)
            const popupWidth = 360;
            const popupHeight = Math.min(706, window.innerHeight * 0.85);
            
            // Hole aktuelle Button-Position (getBoundingClientRect für fixed positioning)
            const button = document.getElementById('mainNavigation-alerts') || 
                          document.querySelector('a[href="/alerts/feed"]');
            const buttonRect = button ? button.getBoundingClientRect() : null;
            
            if (!buttonRect) {
                // Fallback auf berechnete Position
                const left = buttonPos.left + (buttonPos.width / 2) - (popupWidth / 2);
                const top = buttonPos.top;
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;
                let finalLeft = Math.max(10, Math.min(left, viewportWidth - popupWidth - 10));
                let finalTop = Math.max(10, Math.min(top, viewportHeight - popupHeight - 10));
                
                popupContainer.style.position = 'fixed';
                popupContainer.style.top = finalTop + 'px';
                popupContainer.style.left = finalLeft + 'px';
                popupContainer.style.width = popupWidth + 'px';
                popupContainer.style.height = popupHeight + 'px';
                popupContainer.style.zIndex = '999999';
                return;
            }
            
            // Position direkt unter dem Button (ohne Abstand)
            const left = buttonRect.left + (buttonRect.width / 2) - (popupWidth / 2);
            const top = buttonRect.bottom; // Direkt am unteren Rand des Buttons
            
            // Stelle sicher, dass Popup im Viewport bleibt
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            let finalLeft = Math.max(10, Math.min(left, viewportWidth - popupWidth - 10));
            let finalTop = Math.max(10, Math.min(top, viewportHeight - popupHeight - 10));
            
            // Setze Position
            popupContainer.style.position = 'fixed';
            popupContainer.style.top = finalTop + 'px';
            popupContainer.style.left = finalLeft + 'px';
            popupContainer.style.width = popupWidth + 'px';
            popupContainer.style.height = popupHeight + 'px';
            popupContainer.style.zIndex = '999999';
            
            // Füge Popup zum DOM hinzu, falls noch nicht vorhanden
            if (!popupContainer.parentNode) {
                document.body.appendChild(popupContainer);
            }
            
            // Erstelle unsichtbaren Backdrop für Click-Outside
            if (!popupOverlay || !document.querySelector('.mydealz-popup-backdrop')) {
                popupOverlay = document.createElement('div');
                popupOverlay.className = 'mydealz-popup-backdrop';
                popupOverlay.addEventListener('click', closePopup);
                document.body.appendChild(popupOverlay);
            }
            
            // Zeige Popup mit Animation
            setTimeout(() => {
                if (popupContainer) {
                    popupContainer.classList.add('popover--visible');
                }
            }, 10);
            
            // Lade Content via Iframe - prüfe ob popupContent existiert
            const popupContent = document.getElementById('mydealz-popup-content');
            const iframe = document.getElementById('mydealz-popup-iframe');
            const loadingIndicator = document.getElementById('mydealz-popup-loading');
            const errorFallback = document.getElementById('mydealz-popup-error');
            
            if (!popupContent || !iframe) {
                console.error('[MyDealz Button Blocker] Popup-Content oder Iframe nicht gefunden');
                return;
            }
            
            // Reset: Zeige Loading, verstecke Iframe und Error
            if (loadingIndicator) {
                loadingIndicator.style.display = 'flex';
            }
            if (iframe) {
                iframe.style.display = 'none';
            }
            if (errorFallback) {
                errorFallback.style.display = 'none';
            }
            
            // Setze Iframe-Source
            const alertsUrl = 'https://www.mydealz.de/alerts/feed';
            iframe.src = alertsUrl;
            console.log('[MyDealz Button Blocker] Lade Iframe:', alertsUrl);
            
            // Timeout für Iframe-Laden (10 Sekunden)
            let loadTimeout = setTimeout(() => {
                console.warn('[MyDealz Button Blocker] Iframe-Laden hat zu lange gedauert');
                if (loadingIndicator) {
                    loadingIndicator.style.display = 'none';
                }
                if (iframe && iframe.style.display === 'none') {
                    showIframeError(errorFallback, alertsUrl);
                }
            }, 10000);
            
            // Funktion zum Setzen von target="_blank" für alle Links im Iframe
            function setLinksToNewTab(iframeElement) {
                try {
                    const doc = iframeElement.contentDocument || (iframeElement.contentWindow && iframeElement.contentWindow.document);
                    if (!doc) {
                        console.warn('[MyDealz Button Blocker] Kein Zugriff auf Iframe-Dokument für Link-Manipulation');
                        return;
                    }
                    
                    const links = doc.querySelectorAll('a[href]');
                    links.forEach(link => {
                        link.setAttribute('target', '_blank');
                        // Verhindere auch Navigation im iframe selbst
                        link.addEventListener('click', function(event) {
                            const href = link.getAttribute('href');
                            if (href && !href.startsWith('#')) {
                                event.preventDefault();
                                window.open(href, '_blank');
                            }
                        });
                    });
                    
                    console.log(`[MyDealz Button Blocker] ${links.length} Links auf target="_blank" gesetzt`);
                } catch (error) {
                    console.error('[MyDealz Button Blocker] Fehler beim Setzen von target="_blank" für Links:', error);
                }
            }

            // Iframe Load-Event Handler
            iframe.onload = function() {
                console.log('[MyDealz Button Blocker] Iframe erfolgreich geladen');
                clearTimeout(loadTimeout);

                // Verstecke Error-Fallback falls sichtbar
                if (errorFallback) {
                    errorFallback.style.display = 'none';
                }

                const selector = '.listLayout-main.space--mh-a';
                let attempts = 0;
                const maxAttempts = 20; // ~5s
                const attemptIntervalMs = 250;

                const finalizeShow = (reason) => {
                    console.log('[MyDealz Button Blocker] Iframe anzeigen:', reason);
                    if (loadingIndicator) {
                        loadingIndicator.style.display = 'none';
                    }
                    iframe.style.display = 'block';
                    
                    // Setze alle Links auf target="_blank"
                    setLinksToNewTab(iframe);
                    
                    // Wiederhole nach kurzer Verzögerung für dynamisch geladene Links
                    setTimeout(() => {
                        setLinksToNewTab(iframe);
                    }, 1000);
                };

                const tryPrune = () => {
                    attempts += 1;
                    const result = pruneIframeToSelector(iframe, selector);

                    if (result.status === 'applied' || result.status === 'already') {
                        finalizeShow('filtered');
                        return;
                    }

                    // Wenn wir nicht manipulieren können, zeigen wir trotzdem die Seite
                    if (result.status === 'no_access' || result.status === 'no_iframe' || result.status === 'error') {
                        console.warn('[MyDealz Button Blocker] Iframe nicht filterbar:', result.status);
                        finalizeShow(result.status);
                        return;
                    }

                    if (attempts >= maxAttempts) {
                        console.warn('[MyDealz Button Blocker] Ziel-DIV nicht gefunden, zeige komplette Seite:', selector);
                        finalizeShow('not_found');
                        return;
                    }

                    setTimeout(tryPrune, attemptIntervalMs);
                };

                // Kurze Verzögerung, damit JS im Iframe initial rendern kann
                setTimeout(tryPrune, 200);
            };
            
            // Iframe Error-Event Handler
            iframe.onerror = function() {
                console.error('[MyDealz Button Blocker] Iframe-Fehler beim Laden');
                clearTimeout(loadTimeout);
                
                // Verstecke Loading
                if (loadingIndicator) {
                    loadingIndicator.style.display = 'none';
                }
                
                // Zeige Error-Fallback
                showIframeError(errorFallback, alertsUrl);
            };
            
            // Funktion zum Anzeigen des Error-Fallbacks
            function showIframeError(errorElement, url) {
                if (!errorElement) return;
                
                errorElement.innerHTML = `
                    <h3 style="margin: 0 0 15px 0; color: #e74c3c;">Seite konnte nicht geladen werden</h3>
                    <p style="margin: 0 0 20px 0; color: #666;">Die Seite konnte nicht im Popup angezeigt werden. Möglicherweise wird das Einbetten durch die Website blockiert.</p>
                    <a href="${url}" target="_blank" style="display: inline-block; padding: 10px 20px; background: #3498db; color: white; text-decoration: none; border-radius: 4px; font-weight: 500;">Seite in neuem Tab öffnen</a>
                `;
                errorElement.style.display = 'flex';
                console.log('[MyDealz Button Blocker] Error-Fallback angezeigt');
            }
        } catch (error) {
            console.error('[MyDealz Button Blocker] Fehler beim Öffnen des Popups:', error);
        }
    }

    // Popup schließen
    function closePopup() {
        try {
            console.log('[MyDealz Button Blocker] Schließe Popup...');
            
            if (popupContainer) {
                // Stoppe Iframe-Laden durch Entfernen der src
                const iframe = document.getElementById('mydealz-popup-iframe');
                if (iframe) {
                    iframe.src = 'about:blank';
                    console.log('[MyDealz Button Blocker] Iframe src zurückgesetzt');
                }
                
                popupContainer.classList.remove('popover--visible');
                
                // Entferne Popup nach Animation
                setTimeout(() => {
                    if (popupContainer && popupContainer.parentNode) {
                        popupContainer.parentNode.removeChild(popupContainer);
                        console.log('[MyDealz Button Blocker] Popup-Container aus DOM entfernt');
                    }
                    if (popupOverlay && popupOverlay.parentNode) {
                        popupOverlay.parentNode.removeChild(popupOverlay);
                        console.log('[MyDealz Button Blocker] Backdrop aus DOM entfernt');
                    }
                    // Setze Referenzen zurück
                    popupContainer = null;
                    popupOverlay = null;
                }, 200);
            }
            
            console.log('[MyDealz Button Blocker] Popup geschlossen');
        } catch (error) {
            console.error('[MyDealz Button Blocker] Fehler beim Schließen des Popups:', error);
        }
    }

    // Escape-Key Handler
    function setupEscapeKeyHandler() {
        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape' && popupContainer && popupContainer.classList.contains('popover--visible')) {
                closePopup();
            }
        });
    }

    // Funktion zum Blockieren des Buttons
    function blockButtonNavigation() {
        try {
            console.log('[MyDealz Button Blocker] Suche nach Button...');
            
            // Versuche den Button über die ID zu finden
            const button = document.getElementById('mainNavigation-alerts');
            
            if (button) {
                console.log('[MyDealz Button Blocker] Button über ID gefunden:', {
                    id: button.id,
                    href: button.href,
                    className: button.className,
                    tagName: button.tagName
                });
                
                // Prüfe ob bereits ein Listener angehängt wurde
                if (button.dataset.blockerAttached === 'true') {
                    console.log('[MyDealz Button Blocker] Listener bereits angehängt, überspringe');
                    return true;
                }
                
                // Verhindere Navigation beim Klick und öffne Popup
                const clickHandler = function(event) {
                    console.log('[MyDealz Button Blocker] Click-Event abgefangen!', {
                        target: event.target,
                        currentTarget: event.currentTarget,
                        defaultPrevented: event.defaultPrevented,
                        propagationStopped: false
                    });
                    
                    event.preventDefault();
                    event.stopPropagation();
                    event.stopImmediatePropagation();
                    
                    console.log('[MyDealz Button Blocker] Navigation verhindert, öffne Popup');
                    openPopup();
                    return false;
                };
                
                button.addEventListener('click', clickHandler, true); // capture: true für frühe Event-Interception
                button.dataset.blockerAttached = 'true';
                
                console.log('[MyDealz Button Blocker] Button erfolgreich blockiert (via ID)');
                return true;
            }
            
            // Fallback: Suche über href Attribut
            const linkByHref = document.querySelector('a[href="/alerts/feed"]');
            if (linkByHref) {
                console.log('[MyDealz Button Blocker] Link über href gefunden:', {
                    id: linkByHref.id,
                    href: linkByHref.href,
                    className: linkByHref.className
                });
                
                // Prüfe ob bereits ein Listener angehängt wurde
                if (linkByHref.dataset.blockerAttached === 'true') {
                    console.log('[MyDealz Button Blocker] Listener bereits angehängt (href), überspringe');
                    return true;
                }
                
                const clickHandler = function(event) {
                    console.log('[MyDealz Button Blocker] Click-Event abgefangen (href)!', {
                        target: event.target,
                        currentTarget: event.currentTarget,
                        defaultPrevented: event.defaultPrevented
                    });
                    
                    event.preventDefault();
                    event.stopPropagation();
                    event.stopImmediatePropagation();
                    
                    console.log('[MyDealz Button Blocker] Navigation verhindert (href), öffne Popup');
                    openPopup();
                    return false;
                };
                
                linkByHref.addEventListener('click', clickHandler, true);
                linkByHref.dataset.blockerAttached = 'true';
                
                console.log('[MyDealz Button Blocker] Link erfolgreich blockiert (via href)');
                return true;
            }
            
            console.log('[MyDealz Button Blocker] Button nicht gefunden');
            return false;
        } catch (error) {
            console.error('[MyDealz Button Blocker] Fehler in blockButtonNavigation:', error);
            return false;
        }
    }

    // Document-level click listener als Fallback
    function setupDocumentLevelListener() {
        try {
            console.log('[MyDealz Button Blocker] Richte document-level Listener ein...');
            
            document.addEventListener('click', function(event) {
                try {
                    // Prüfe ob das geklickte Element oder ein Parent der Button ist
                    let target = event.target;
                    let clickedButton = false;
                    
                    // Prüfe das Target selbst
                    if (target && (target.id === 'mainNavigation-alerts' || 
                        (target.tagName === 'A' && target.getAttribute('href') === '/alerts/feed'))) {
                        clickedButton = true;
                    }
                    
                    // Prüfe Parent-Elemente
                    if (!clickedButton) {
                        let parent = target;
                        for (let i = 0; i < 10 && parent; i++) {
                            if (parent.id === 'mainNavigation-alerts' || 
                                (parent.tagName === 'A' && parent.getAttribute('href') === '/alerts/feed')) {
                                clickedButton = true;
                                break;
                            }
                            parent = parent.parentElement;
                        }
                    }
                    
                    if (clickedButton) {
                        console.log('[MyDealz Button Blocker] Document-level: Click auf Button erkannt!', {
                            target: target,
                            phase: event.eventPhase
                        });
                        
                        event.preventDefault();
                        event.stopPropagation();
                        event.stopImmediatePropagation();
                        
                        console.log('[MyDealz Button Blocker] Document-level: Navigation verhindert, öffne Popup');
                        openPopup();
                        return false;
                    }
                } catch (error) {
                    console.error('[MyDealz Button Blocker] Fehler im document-level Listener:', error);
                }
            }, true); // capture: true für frühe Interception
            
            console.log('[MyDealz Button Blocker] Document-level Listener eingerichtet');
        } catch (error) {
            console.error('[MyDealz Button Blocker] Fehler beim Einrichten des document-level Listeners:', error);
        }
    }

    // Versuche sofort den Button zu blockieren
    function tryBlockButton() {
        try {
            if (buttonBlocked) {
                console.log('[MyDealz Button Blocker] Button bereits blockiert, überspringe');
                return;
            }
            
            if (blockButtonNavigation()) {
                buttonBlocked = true;
                console.log('[MyDealz Button Blocker] Button sofort blockiert');
                if (observer) {
                    observer.disconnect();
                    console.log('[MyDealz Button Blocker] Observer beendet');
                }
            }
        } catch (error) {
            console.error('[MyDealz Button Blocker] Fehler in tryBlockButton:', error);
        }
    }

    // Initialisiere Popup UI und Styles
    function initializePopup() {
        try {
            if (document.head) {
                addPopupStyles();
            } else {
                // Warte auf head
                const headObserver = new MutationObserver(function(mutations, obs) {
                    if (document.head) {
                        addPopupStyles();
                        obs.disconnect();
                    }
                });
                headObserver.observe(document.documentElement, {
                    childList: true,
                    subtree: true
                });
            }
            
            // Erstelle Popup UI wenn body vorhanden ist
            if (document.body) {
                createPopupUI();
            } else {
                // Warte auf body
                window.addEventListener('DOMContentLoaded', function() {
                    createPopupUI();
                });
            }
            
            // Setup Escape-Key Handler
            setupEscapeKeyHandler();
        } catch (error) {
            console.error('[MyDealz Button Blocker] Fehler bei Popup-Initialisierung:', error);
        }
    }

    // Setup document-level listener sofort
    setupDocumentLevelListener();

    // Initialisiere Popup
    initializePopup();

    // Versuche sofort den Button zu blockieren (wenn DOM bereits vorhanden)
    if (document.readyState === 'loading') {
        console.log('[MyDealz Button Blocker] DOM noch nicht geladen, warte...');
    } else {
        console.log('[MyDealz Button Blocker] DOM bereits geladen, versuche sofort zu blockieren');
        tryBlockButton();
    }

    // MutationObserver für dynamisch geladene Inhalte
    function setupObserver() {
        try {
            if (observer) {
                console.log('[MyDealz Button Blocker] Observer bereits eingerichtet');
                return;
            }
            
            console.log('[MyDealz Button Blocker] Richte MutationObserver ein...');
            
            observer = new MutationObserver(function(mutations, obs) {
                try {
                    console.log('[MyDealz Button Blocker] MutationObserver: DOM-Änderung erkannt', {
                        mutationCount: mutations.length
                    });
                    
                    if (!buttonBlocked && blockButtonNavigation()) {
                        buttonBlocked = true;
                        obs.disconnect();
                        console.log('[MyDealz Button Blocker] MutationObserver: Button gefunden und blockiert, Observer beendet');
                    }
                } catch (error) {
                    console.error('[MyDealz Button Blocker] Fehler im MutationObserver:', error);
                }
            });

            // Starte Observer, wenn DOM bereit ist
            if (document.body) {
                observer.observe(document.body, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeFilter: ['id', 'href', 'class']
                });
                console.log('[MyDealz Button Blocker] MutationObserver gestartet (body vorhanden)');
            } else {
                console.log('[MyDealz Button Blocker] Body noch nicht vorhanden, warte auf DOMContentLoaded...');
                // Warte auf body, falls noch nicht vorhanden
                window.addEventListener('DOMContentLoaded', function() {
                    try {
                        if (document.body && observer) {
                            observer.observe(document.body, {
                                childList: true,
                                subtree: true,
                                attributes: true,
                                attributeFilter: ['id', 'href', 'class']
                            });
                            console.log('[MyDealz Button Blocker] MutationObserver gestartet (nach DOMContentLoaded)');
                        }
                    } catch (error) {
                        console.error('[MyDealz Button Blocker] Fehler beim Starten des Observers nach DOMContentLoaded:', error);
                    }
                });
            }
        } catch (error) {
            console.error('[MyDealz Button Blocker] Fehler beim Einrichten des MutationObservers:', error);
        }
    }

    // Setup Observer
    setupObserver();

    // Periodische Checks für Button-Existenz
    let checkCount = 0;
    const maxChecks = 20; // 20 Checks über 10 Sekunden
    const checkInterval = setInterval(function() {
        try {
            checkCount++;
            console.log(`[MyDealz Button Blocker] Periodischer Check #${checkCount}/${maxChecks}`);
            
            if (!buttonBlocked) {
                if (blockButtonNavigation()) {
                    buttonBlocked = true;
                    console.log('[MyDealz Button Blocker] Button durch periodischen Check blockiert');
                    if (observer) {
                        observer.disconnect();
                    }
                    clearInterval(checkInterval);
                }
            } else {
                console.log('[MyDealz Button Blocker] Button bereits blockiert, beende periodische Checks');
                clearInterval(checkInterval);
            }
            
            if (checkCount >= maxChecks) {
                console.log('[MyDealz Button Blocker] Maximale Anzahl Checks erreicht, beende periodische Checks');
                clearInterval(checkInterval);
            }
        } catch (error) {
            console.error('[MyDealz Button Blocker] Fehler im periodischen Check:', error);
        }
    }, 500); // Alle 500ms

    // Zusätzlicher Fallback: Versuche nach kurzer Verzögerung erneut
    setTimeout(function() {
        try {
            console.log('[MyDealz Button Blocker] Timeout-Fallback: Versuche Button zu blockieren...');
            if (!buttonBlocked && blockButtonNavigation()) {
                buttonBlocked = true;
                if (observer) {
                    observer.disconnect();
                    console.log('[MyDealz Button Blocker] Timeout-Fallback: Button blockiert, Observer beendet');
                }
            }
        } catch (error) {
            console.error('[MyDealz Button Blocker] Fehler im Timeout-Fallback:', error);
        }
    }, 1000);

    console.log('[MyDealz Button Blocker] Initialisierung abgeschlossen');

})();

