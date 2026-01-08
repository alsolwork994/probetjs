window.ProBet = window.ProBet || {};

// internal state
window.ProBet.config = {
    isEnabled: false,
    stake: null
};

// ==========================================
// 1. CONFIGURATION & STYLES
// ==========================================
window.ProBet.configure = function (isEnabled, stake) {
    window.ProBet.config.isEnabled = isEnabled;
    window.ProBet.config.stake = stake;

    // Toggle body class for CSS hiding
    if (isEnabled) {
        document.body.classList.add('probet-autobet-active');
        console.log('⚡ Autobet ACTIVATED with stake:', stake);
    } else {
        document.body.classList.remove('probet-autobet-active');
        console.log('⏸️ Autobet DEACTIVATED');
    }
};

// Inject CSS to hide modal when autobet is active
(function injectStyles() {
    var styleId = 'probet-styles';
    if (document.getElementById(styleId)) return;

    var css = `
        /* Hide modal only when autobet is active */
        body.probet-autobet-active .place-bet-modal {
            opacity: 0 !important;
            pointer-events: none !important;
            z-index: -9999 !important;
            visibility: visible !important; /* Ensure it renders for JS to read text */
            display: block !important;      /* Ensure it renders for JS to read text */
        }
        body.probet-autobet-active .modal-backdrop {
            opacity: 0 !important;
            display: none !important;
        }
        body.probet-autobet-active .modal-open {
            overflow: auto !important; /* Prevent scroll lock */
        }
    `;

    var style = document.createElement('style');
    style.id = styleId;
    style.type = 'text/css';
    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);
})();

// ==========================================
// 2. AUTO LOGIN LOGIC
// ==========================================
window.ProBet.performAutoLogin = function (username, password) {
    try {
        var usernameField = document.querySelector('input[name="username"]');
        var passwordField = document.querySelector('input[name="password"]');
        var submitButton = document.querySelector('button[type="submit"]');

        if (usernameField && passwordField && submitButton) {
            usernameField.value = '';
            passwordField.value = '';
            usernameField.focus();

            var nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
            nativeInputValueSetter.call(usernameField, username);
            nativeInputValueSetter.call(passwordField, password);

            function triggerEvents(element) {
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
                element.dispatchEvent(new Event('blur', { bubbles: true }));
            }

            triggerEvents(usernameField);
            triggerEvents(passwordField);

            setTimeout(function () {
                submitButton.click();
            }, 800);

            return 'Login submitted';
        }
        return 'Form not found';
    } catch (e) {
        return 'Error: ' + e.message;
    }
};

// ==========================================
// 3. MUTATION OBSERVER (THE TRIGGER)
// ==========================================
window.ProBet.setupMutationObserver = function () {
    if (window.betObserverSetup) return 'already_setup';

    var observer = new MutationObserver(function (mutations) {
        if (!window.ProBet.config.isEnabled) return;

        mutations.forEach(function (mutation) {
            mutation.addedNodes.forEach(function (node) {
                if (node.nodeType === 1) {
                    // Check if the added node IS the modal or CONTAINS the modal
                    var modal = null;
                    if (node.classList && node.classList.contains('place-bet-modal')) {
                        modal = node;
                    } else if (node.querySelector) {
                        modal = node.querySelector('.place-bet-modal');
                    }

                    if (modal) {
                        console.log('⚡⚡ RAPID DETECT: Modal found via observer!');
                        // Trigger bet immediately - 0ms delay
                        window.ProBet.placeBet(window.ProBet.config.stake);
                    }
                }
            });

            // Also check attribute changes for visibility toggles (display: none -> block)
            if (mutation.type === 'attributes' && (mutation.attributeName === 'style' || mutation.attributeName === 'class')) {
                var target = mutation.target;
                if (target.classList && target.classList.contains('place-bet-modal')) {
                    var style = window.getComputedStyle(target);
                    // If it became visible (ignoring our opacity hack)
                    if (style.display !== 'none' && target.style.display !== 'none') {
                        console.log('⚡⚡ RAPID DETECT: Modal visibility changed!');
                        window.ProBet.placeBet(window.ProBet.config.stake);
                    }
                }
            }
        });
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class']
    });

    window.betObserverSetup = true;
    return 'observer_setup_v2';
};

// ==========================================
// 4. CHECK MODAL VISIBILITY (FALLBACK)
// ==========================================
window.ProBet.checkModalVisibility = function () {
    var modal = document.querySelector('.place-bet-modal');
    if (modal) {
        var style = window.getComputedStyle(modal);
        // We consider it visible if display is not none, even if opacity is 0 (our hack)
        var isVisible = style.display !== 'none';
        return isVisible ? 'found' : 'notfound';
    }
    return 'notfound';
};

// ==========================================
// 5. PLACE BET LOGIC
// ==========================================
window.ProBet.placeBet = function (stake) {
    if (window.ProBet.isBetting) return 'bet_in_progress'; // Prevent double firing
    window.ProBet.isBetting = true;

    try {
        var modal = document.querySelector('.place-bet-modal.back') ||
            document.querySelector('.place-bet-modal.lay') ||
            document.querySelector('.place-bet-modal');

        if (!modal) {
            window.ProBet.isBetting = false;
            return 'no_modal';
        }

        var input = modal.querySelector('input.stakeinput[type="number"]') ||
            modal.querySelector('input[type="number"]:not([disabled])');

        if (!input) {
            window.ProBet.isBetting = false;
            return 'no_input';
        }

        var finalStake = stake;

        // --- HELPER: Parse Max Value ---
        function parseMaxValue(text) {
            if (!text) return null;
            // Common patterns
            var match = text.match(/Min:\s*([\d.]+)\s+Max:\s*([\d.]+)\s*([KLkl])/i) ||
                text.match(/Range:\s*(\d+(?:\.\d+)?)\s+to\s+(\d+(?:\.\d+)?)\s*([KLkl]?)/i) ||
                text.match(/Max:\s*([\d.]+)\s*([KLkl])/i);

            if (match) {
                var val = parseFloat(match[2] || match[1]);
                var suf = (match[3] || match[2] || '').toUpperCase();

                // Specific adjustments based on which regex matched
                if (text.includes('Range:')) { val = parseFloat(match[2]); suf = (match[3] || '').toUpperCase(); }
                else if (text.includes('Min:')) { val = parseFloat(match[2]); suf = match[3].toUpperCase(); }
                else if (match.length === 3 && text.includes('Max:')) { val = parseFloat(match[1]); suf = match[2].toUpperCase(); }

                if (suf === 'K') val *= 1000;
                else if (suf === 'L') val *= 100000;
                return Math.floor(val);
            }
            return null;
        }

        // --- MAX BET LOGIC ---
        if (finalStake === '-1') {
            var maxFound = null;
            var searchLog = [];

            console.log('[MAX-BET] Finding Max...');

            // 1. Modal Elements
            var minMaxElements = modal.querySelectorAll('.fancy-min-max, .fancy-min-max-box, .min-max, [class*="min-max"], span, div');
            for (var i = 0; i < minMaxElements.length; i++) {
                var t = minMaxElements[i].innerText || minMaxElements[i].textContent;
                if (t && t.length < 200) { var m = parseMaxValue(t); if (m && m >= 10000) { maxFound = m; break; } }
            }

            // 2. Modal Text
            if (!maxFound) maxFound = parseMaxValue(modal.innerText || modal.textContent);

            // 3. Market Match
            if (!maxFound) {
                var nameEl = modal.querySelector('.bet-team-name, b, .modal-title, .market-name, h5, h6, strong');
                if (nameEl) {
                    var mName = (nameEl.innerText || nameEl.textContent).trim();
                    searchLog.push('market:' + mName.substring(0, 20));

                    var allMarkets = document.querySelectorAll('.fancy-market, .market-row, .bet-table-row, tr, [class*="market"]');
                    for (var i = 0; i < allMarkets.length; i++) {
                        if ((allMarkets[i].innerText || '').toLowerCase().includes(mName.toLowerCase().substring(0, 15))) {
                            var selectors = '.fancy-min-max, .fancy-min-max-box, .min-max, [class*="min-max"], .market-nation-name, .max-bet';
                            var mm = allMarkets[i].querySelector(selectors);
                            if (!mm) { var p = allMarkets[i].closest('.bet-table, .market-container, .game-market, .market-4, .market-wrapper'); if (p) mm = p.querySelector(selectors); }
                            if (mm) { maxFound = parseMaxValue(mm.innerText || mm.textContent); if (maxFound) break; }
                            maxFound = parseMaxValue(allMarkets[i].innerText || allMarkets[i].textContent); if (maxFound) break;
                        }
                    }
                }
            }

            // 4. Any on Page
            if (!maxFound) {
                var all = document.querySelectorAll('.fancy-min-max, .fancy-min-max-box, .min-max, [class*="min-max"], .market-nation-name, .max-bet');
                for (var i = all.length - 1; i >= 0; i--) { var m = parseMaxValue(all[i].innerText); if (m && m >= 1000) { maxFound = m; break; } }
            }

            if (maxFound) finalStake = maxFound.toString();
            else {
                window.ProBet.isBetting = false;
                return 'no_max_found';
            }
        }

        // --- PLACE BET ---
        var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        setter.call(input, finalStake);
        try {
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            input.dispatchEvent(new Event('blur', { bubbles: true }));
        } catch (e) { }

        var btn = modal.querySelector('.btn-success') ||
            modal.querySelector('button.btn-success') ||
            modal.querySelector('button:not([disabled])');

        if (btn) {
            btn.disabled = false;
            btn.click();

            console.log('✅ BET BUTTON CLICKED with stake:', finalStake);

            // Cleanup: remove modal or hide further
            // The site might remove it, but we reset our flag essentially
            setTimeout(function () { window.ProBet.isBetting = false; }, 500);

            return 'bet_placed_ultra_fast|' + finalStake;
        } else {
            window.ProBet.isBetting = false;
            return 'button_not_found';
        }
    } catch (e) {
        window.ProBet.isBetting = false;
        return 'js_exception:' + e.message;
    }
};
