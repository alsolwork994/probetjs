window.ProBet = window.ProBet || {};

window.ProBet.config = {
    isEnabled: false,
    stake: null
};

window.ProBet.configure = function (isEnabled, stake) {
    window.ProBet.config.isEnabled = isEnabled;
    window.ProBet.config.stake = stake;

    if (isEnabled) {
        document.body.classList.add('probet-autobet-active');
        console.log('⚡ Autobet ACTIVATED. Stake:', stake);
    } else {
        document.body.classList.remove('probet-autobet-active');
        console.log('⏸️ Autobet DEACTIVATED.');
    }
};

(function injectStyles() {
    var styleId = 'probet-styles';
    if (document.getElementById(styleId)) return;

    var css = `
        /* Hide modal visually but keep it interactive in DOM */
        body.probet-autobet-active .place-bet-modal {
            opacity: 0.05 !important;      /* Almost invisible but technically visible to bypass some browser checks */
            z-index: -9999 !important;     /* Behind everything */
            transform: scale(0.1);         /* Shrink it to minimize layout disruption */
            position: fixed !important;
            top: -1000px !important;       /* Move off screen */
        }
        body.probet-autobet-active .modal-backdrop {
            display: none !important;
        }
    `;

    var style = document.createElement('style');
    style.id = styleId;
    style.type = 'text/css';
    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);
})();

// ... (Auto Login Logic kept same) ...
window.ProBet.performAutoLogin = function (username, password) {
    try {
        var usernameField = document.querySelector('input[name="username"]');
        var passwordField = document.querySelector('input[name="password"]');
        var submitButton = document.querySelector('button[type="submit"]');
        if (usernameField && passwordField && submitButton) {
            usernameField.value = ''; passwordField.value = ''; usernameField.focus();
            var set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
            set.call(usernameField, username); set.call(passwordField, password);
            function triggerWithDelay(el) {
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                el.dispatchEvent(new Event('blur', { bubbles: true }));
            }
            triggerWithDelay(usernameField); triggerWithDelay(passwordField);
            setTimeout(function () { submitButton.click(); }, 800);
            return 'Login submitted';
        }
        return 'Form not found';
    } catch (e) { return 'Error: ' + e.message; }
};

window.ProBet.setupMutationObserver = function () {
    if (window.betObserverSetup) return 'already_setup';
    var observer = new MutationObserver(function (mutations) {
        if (!window.ProBet.config.isEnabled) return;

        mutations.forEach(function (mutation) {
            mutation.addedNodes.forEach(function (node) {
                if (node.nodeType === 1) {
                    var modal = null;
                    if (node.classList && node.classList.contains('place-bet-modal')) modal = node;
                    else if (node.querySelector) modal = node.querySelector('.place-bet-modal');

                    if (modal) {
                        // Found modal! Wait slightly for React/Vue to hydrate inputs, then bet
                        console.log('⚡ Modal detected! Queuing bet...');
                        setTimeout(function () {
                            window.ProBet.placeBet(window.ProBet.config.stake);
                        }, 50);
                    }
                }
            });

            // Check visibility changes
            if (mutation.type === 'attributes' && (mutation.attributeName === 'style' || mutation.attributeName === 'class')) {
                var target = mutation.target;
                if (target.classList && target.classList.contains('place-bet-modal')) {
                    if (target.style.display !== 'none') {
                        setTimeout(function () {
                            window.ProBet.placeBet(window.ProBet.config.stake);
                        }, 50);
                    }
                }
            }
        });
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
    window.betObserverSetup = true;
    return 'observer_setup_v3';
};

window.ProBet.checkModalVisibility = function () {
    var modal = document.querySelector('.place-bet-modal');
    if (modal) {
        var style = window.getComputedStyle(modal);
        var isVisible = style.display !== 'none';
        return isVisible ? 'found' : 'notfound';
    }
    return 'notfound';
};

window.ProBet.placeBet = function (stake) {
    // Basic debounce to prevent spamming
    if (window.ProBet.isBetting && (Date.now() - window.ProBet.lastBetTime) < 500) return 'bet_cooldown';
    window.ProBet.isBetting = true;
    window.ProBet.lastBetTime = Date.now();

    try {
        var modal = document.querySelector('.place-bet-modal.back') ||
            document.querySelector('.place-bet-modal.lay') ||
            document.querySelector('.place-bet-modal');

        if (!modal) { window.ProBet.isBetting = false; return 'no_modal'; }

        var input = modal.querySelector('input.stakeinput[type="number"]') ||
            modal.querySelector('input[type="number"]:not([disabled])');

        if (!input) { window.ProBet.isBetting = false; return 'no_input'; }

        var finalStake = stake;

        // --- MAX BET LOGIC ---
        function parseMaxValue(text) {
            if (!text) return null;
            var match = text.match(/Min:\s*([\d.]+)\s+Max:\s*([\d.]+)\s*([KLkl])/i) ||
                text.match(/Range:\s*(\d+(?:\.\d+)?)\s+to\s+(\d+(?:\.\d+)?)\s*([KLkl]?)/i) ||
                text.match(/Max:\s*([\d.]+)\s*([KLkl])/i);
            if (match) {
                var val = parseFloat(match[2] || match[1]);
                var suf = (match[3] || match[2] || '').toUpperCase();
                if (text.includes('Range:')) { val = parseFloat(match[2]); suf = (match[3] || '').toUpperCase(); }
                else if (text.includes('Min:')) { val = parseFloat(match[2]); suf = match[3].toUpperCase(); }
                else if (match.length === 3 && text.includes('Max:')) { val = parseFloat(match[1]); suf = match[2].toUpperCase(); }
                if (suf === 'K') val *= 1000;
                else if (suf === 'L') val *= 100000;
                return Math.floor(val);
            }
            return null;
        }

        if (finalStake === '-1') {
            var maxFound = null;
            // 1. Elements
            var minMaxElements = modal.querySelectorAll('.fancy-min-max, .fancy-min-max-box, .min-max, [class*="min-max"], span, div');
            for (var i = 0; i < minMaxElements.length; i++) {
                var t = minMaxElements[i].innerText || minMaxElements[i].textContent;
                if (t && t.length < 200) { var m = parseMaxValue(t); if (m && m >= 10000) { maxFound = m; break; } }
            }
            // 2. Text
            if (!maxFound) maxFound = parseMaxValue(modal.innerText || modal.textContent);
            // 3. Page
            if (!maxFound) {
                var nameEl = modal.querySelector('.bet-team-name, b, .modal-title, .market-name, h5, h6, strong');
                if (nameEl) {
                    var mName = (nameEl.innerText || nameEl.textContent).trim();
                    var markets = document.querySelectorAll('.fancy-market, .market-row, .bet-table-row, tr, [class*="market"]');
                    for (var i = 0; i < markets.length; i++) {
                        if ((markets[i].innerText || '').toLowerCase().includes(mName.toLowerCase().substring(0, 15))) {
                            var selectors = '.fancy-min-max, .fancy-min-max-box, .min-max, [class*="min-max"], .market-nation-name, .max-bet';
                            var mm = markets[i].querySelector(selectors);
                            if (!mm) { var p = markets[i].closest('.bet-table, .market-container, .game-market, .market-4, .market-wrapper'); if (p) mm = p.querySelector(selectors); }
                            if (mm) { maxFound = parseMaxValue(mm.innerText || mm.textContent); if (maxFound) break; }
                            maxFound = parseMaxValue(markets[i].innerText || markets[i].textContent); if (maxFound) break;
                        }
                    }
                }
            }
            if (!maxFound) {
                var all = document.querySelectorAll('.fancy-min-max, .fancy-min-max-box, .min-max, [class*="min-max"], .market-nation-name, .max-bet');
                for (var i = all.length - 1; i >= 0; i--) { var m = parseMaxValue(all[i].innerText); if (m && m >= 1000) { maxFound = m; break; } }
            }

            if (maxFound) finalStake = maxFound.toString();
            else { window.ProBet.isBetting = false; console.warn('Max not found'); return 'no_max_found'; }
        }

        // --- SET VALUE & EVENTS ---
        var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        setter.call(input, finalStake);

        // Dispatch heavy events to force Framework sync (React/Vue/Angular)
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Num0', bubbles: true }));
        input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Num0', bubbles: true }));
        input.dispatchEvent(new Event('blur', { bubbles: true }));

        // Wait a tiny bit for the "Place Bet" button to become enabled if it was disabled
        setTimeout(function () {
            var btn = modal.querySelector('.btn-success') ||
                modal.querySelector('button.btn-success') ||
                modal.querySelector('button[type="submit"]') ||
                modal.querySelector('button:not([disabled])'); // Broadest fallback

            if (btn) {
                if (btn.disabled) {
                    console.log('Button disabled, forcing enable...');
                    btn.disabled = false;
                }
                btn.click();
                console.log('✅ CLICKED. Stake:', finalStake);

                // Force close logic if site doesn't do it
                // setTimeout(function() { if (modal) modal.style.display = 'none'; }, 200);

                window.ProBet.isBetting = false;
            } else {
                console.error('Button not found!');
                window.ProBet.isBetting = false;
            }
        }, 100); // 100ms delay for validation

        return 'bet_process_started|' + finalStake;

    } catch (e) {
        window.ProBet.isBetting = false;
        return 'js_exception:' + e.message;
    }
};
               
