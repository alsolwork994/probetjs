window.ProBet = window.ProBet || {};

// ==========================================
// 1. CONFIGURATION & STATE
// ==========================================
window.ProBet.config = {
    isEnabled: false,
    stake: null
};

window.ProBet.state = {
    isBetting: false,
    lastBetTime: 0,
    betLock: false // HARD LOCK to prevent duplicate executions
};

window.ProBet.configure = function (isEnabled, stake) {
    window.ProBet.config.isEnabled = isEnabled;
    window.ProBet.config.stake = stake;

    if (isEnabled) {
        document.body.classList.add('probet-autobet-active');
    } else {
        document.body.classList.remove('probet-autobet-active');
    }
};

// ==========================================
// 2. INVISIBLE MODE CSS
// ==========================================
(function injectStyles() {
    var styleId = 'probet-styles';
    if (document.getElementById(styleId)) return;

    var css = `
        body.probet-autobet-active .place-bet-modal {
            opacity: 0 !important;
            top: -5000px !important;
            left: -5000px !important;
            position: fixed !important;
            display: block !important;
            visibility: visible !important;
            transition: none !important;
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

// ==========================================
// 3. AUTO LOGIN
// ==========================================
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

// ==========================================
// 4. MUTATION OBSERVER (TRIGGER)
// ==========================================
window.ProBet.setupMutationObserver = function () {
    if (window.betObserverSetup) return 'already_setup';

    var observer = new MutationObserver(function (mutations) {
        if (!window.ProBet.config.isEnabled) return;

        // Anti-spam check: If locked, ignore DOM changes completely
        if (window.ProBet.state.betLock) return;

        var modalFound = false;

        mutations.forEach(function (mutation) {
            if (modalFound) return;

            mutation.addedNodes.forEach(function (node) {
                if (node.nodeType === 1) {
                    if ((node.classList && node.classList.contains('place-bet-modal')) ||
                        (node.querySelector && node.querySelector('.place-bet-modal'))) {
                        modalFound = true;
                    }
                }
            });

            if (!modalFound && mutation.type === 'attributes' && (mutation.attributeName === 'style' || mutation.attributeName === 'class')) {
                var target = mutation.target;
                if (target.classList && target.classList.contains('place-bet-modal')) {
                    if (target.style.display !== 'none') {
                        modalFound = true;
                    }
                }
            }
        });

        if (modalFound) {
            window.ProBet.initiateBetSequence(window.ProBet.config.stake);
        }
    });

    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
    window.betObserverSetup = true;
    return 'observer_setup_v5_debounced';
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

// ==========================================
// 5. ROBUST BETTING SEQUENCE
// ==========================================
window.ProBet.initiateBetSequence = function (stake) {
    // 1. GLOBAL LOCK CHECK
    // If a bet sequence is already running or ran very recently (within 3 seconds), ABORT.
    if (window.ProBet.state.betLock) {
        console.log('🔒 Bet Sequence Locked - Skipping duplicate trigger');
        return;
    }
    if ((Date.now() - window.ProBet.state.lastBetTime) < 3000) {
        console.log('⏳ Cooldown active - Skipping duplicate trigger');
        return;
    }

    // 2. SET LOCK
    window.ProBet.state.betLock = true;
    window.ProBet.state.isBetting = true;
    window.ProBet.state.lastBetTime = Date.now();

    var attempts = 0;
    var maxAttempts = 20; // 2 seconds total loop

    function cleanupAndUnlock() {
        console.log('🔓 Unlocking bet sequence...');
        window.ProBet.state.isBetting = false;
        // Keep the lock for 1 more second to prevent 'bounce' re-triggering from the same modal closing/opening
        setTimeout(function () {
            window.ProBet.state.betLock = false;
        }, 1000);
    }

    function tryBet() {
        attempts++;
        var result = window.ProBet.attemptSingleBet(stake);

        if (result.status === 'success') {
            console.log('[[PROBET_RESULT]]:bet_placed_ultra_fast|' + result.stake);
            cleanupAndUnlock();
        } else if (result.status === 'retry') {
            if (attempts < maxAttempts) {
                setTimeout(tryBet, 100);
            } else {
                console.warn('❌ Bet sequence timed out (retry)');
                cleanupAndUnlock();
            }
        } else {
            if (attempts < maxAttempts) {
                setTimeout(tryBet, 100);
            } else {
                console.warn('❌ Bet sequence timed out (no modal)');
                cleanupAndUnlock();
            }
        }
    }

    tryBet();
};

window.ProBet.attemptSingleBet = function (stake) {
    try {
        var modal = document.querySelector('.place-bet-modal.back') ||
            document.querySelector('.place-bet-modal.lay') ||
            document.querySelector('.place-bet-modal');

        if (!modal) return { status: 'retry', reason: 'no_modal_in_dom' };

        // --- INPUT HANDLING ---
        var input = modal.querySelector('input.stakeinput[type="number"]') ||
            modal.querySelector('input[type="number"]:not([disabled])');

        if (!input) return { status: 'retry', reason: 'no_input_found' };

        var finalStake = stake;

        // --- MAX BET LOGIC ---
        if (finalStake === '-1') {
            var maxFound = window.ProBet.findMaxValue(modal);
            if (maxFound) finalStake = maxFound.toString();
            else return { status: 'retry', reason: 'waiting_for_max_bet_text' };
        }

        // Check if value already set (to avoid duplicate inputs/clicks if function called twice)
        // Note: some sites clear input on open, so we re-set it, but we rely on global lock for safety.

        // Set Value
        var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        setter.call(input, finalStake);

        // Dispatch Events
        var events = ['input', 'change', 'blur', 'focus'];
        events.forEach(function (evt) {
            input.dispatchEvent(new Event(evt, { bubbles: true }));
        });

        // --- BUTTON HANDLING ---
        var btn = modal.querySelector('.btn-success') ||
            modal.querySelector('button.btn-success') ||
            modal.querySelector('button[class*="bet"]') ||
            modal.querySelector('button:not([disabled]):not(.close)');

        if (!btn) return { status: 'retry', reason: 'no_button_found' };

        if (btn.disabled) {
            btn.disabled = false;
            return { status: 'retry', reason: 'button_disabled' };
        }

        // CLICK!
        btn.click();

        return { status: 'success', stake: finalStake };

    } catch (e) {
        return { status: 'error', reason: e.message };
    }
};

window.ProBet.findMaxValue = function (modal) {
    function parse(text) {
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

    var maxFound = null;
    // 1. Elements
    var minMaxElements = modal.querySelectorAll('.fancy-min-max, .fancy-min-max-box, .min-max, [class*="min-max"], span, div');
    for (var i = 0; i < minMaxElements.length; i++) {
        var t = minMaxElements[i].innerText || minMaxElements[i].textContent;
        if (t && t.length < 200) { var m = parse(t); if (m && m >= 10000) { maxFound = m; break; } }
    }
    // 2. Text
    if (!maxFound) maxFound = parse(modal.innerText || modal.textContent);
    // 3. Page (Market Header)
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
                    if (mm) { maxFound = parse(mm.innerText || mm.textContent); if (maxFound) break; }
                    maxFound = parse(markets[i].innerText || markets[i].textContent); if (maxFound) break;
                }
            }
        }
    }
    // 4. Any
    if (!maxFound) {
        var all = document.querySelectorAll('.fancy-min-max, .fancy-min-max-box, .min-max, [class*="min-max"], .market-nation-name, .max-bet');
        for (var i = all.length - 1; i >= 0; i--) { var m = parse(all[i].innerText); if (m && m >= 1000) { maxFound = m; break; } }
    }
    return maxFound;
};

// Fallback for direct calls from Android
window.ProBet.placeBet = function (stake) {
    window.ProBet.initiateBetSequence(stake);
    return 'bet_sequence_initiated';
};
