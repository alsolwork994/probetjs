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
    betLock: false,
    lastResultTime: 0 // New: Track specifically when we last emitted a success result
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
        if (window.ProBet.state.betLock) return; // Locked!

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
    return 'observer_setup_v6_strict_result';
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
    if (window.ProBet.state.betLock) return;
    if ((Date.now() - window.ProBet.state.lastBetTime) < 3000) return;

    window.ProBet.state.betLock = true;
    window.ProBet.state.isBetting = true;
    window.ProBet.state.lastBetTime = Date.now();

    var attempts = 0;
    var maxAttempts = 20;

    function cleanupAndUnlock() {
        window.ProBet.state.isBetting = false;
        setTimeout(function () { window.ProBet.state.betLock = false; }, 1000);
    }

    // NEW: STRICT RESULT EMISSION
    // Ensures we NEVER emit a result more than once every 2 seconds
    function emitSuccess(stake) {
        var now = Date.now();
        if (now - window.ProBet.state.lastResultTime > 2000) {
            console.log('[[PROBET_RESULT]]:bet_placed_ultra_fast|' + stake);
            window.ProBet.state.lastResultTime = now;
        } else {
            console.log('⚠️ Result suppressed (duplicate check)');
        }
        cleanupAndUnlock();
    }

    function tryBet() {
        attempts++;
        var result = window.ProBet.attemptSingleBet(stake);

        if (result.status === 'success') {
            emitSuccess(result.stake);
        } else if (result.status === 'retry') {
            if (attempts < maxAttempts) {
                setTimeout(tryBet, 100);
            } else {
                cleanupAndUnlock();
            }
        } else {
            if (attempts < maxAttempts) {
                setTimeout(tryBet, 100);
            } else {
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

        var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        setter.call(input, finalStake);

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

        btn.click();

        return { status: 'success', stake: finalStake };

    } catch (e) {
        return { status: 'error', reason: e.message };
    }
};

window.ProBet.findMaxValue = function (modal) {
    function parse(text) {
        if (!text) return null;

        // Clean up text - remove extra spaces and normalize
        text = text.replace(/\s+/g, ' ').trim();

        // Try different patterns in order of specificity
        // Pattern 1: "Min: 100  Max: 10L" or "Min: 100 Max: 10L"
        var match = text.match(/Min:\s*[\d.]+\s+Max:\s*([\d.]+)\s*([KLkl])/i);
        if (match) {
            var val = parseFloat(match[1]);
            var suf = match[2].toUpperCase();
            if (suf === 'K') val *= 1000;
            else if (suf === 'L') val *= 100000;
            console.log('✓ Max found (Min/Max pattern):', val, 'from:', text.substring(0, 50));
            return Math.floor(val);
        }

        // Pattern 2: "Max: 1L" or "Max: 50K"
        match = text.match(/Max:\s*([\d.]+)\s*([KLkl])/i);
        if (match) {
            var val = parseFloat(match[1]);
            var suf = match[2].toUpperCase();
            if (suf === 'K') val *= 1000;
            else if (suf === 'L') val *= 100000;
            console.log('✓ Max found (Max only pattern):', val, 'from:', text.substring(0, 50));
            return Math.floor(val);
        }

        // Pattern 3: "Range: 100 to 50000" or "Range: 1 to 5L"
        match = text.match(/Range:\s*[\d.]+\s+to\s+([\d.]+)\s*([KLkl]?)/i);
        if (match) {
            var val = parseFloat(match[1]);
            var suf = (match[2] || '').toUpperCase();
            if (suf === 'K') val *= 1000;
            else if (suf === 'L') val *= 100000;
            console.log('✓ Max found (Range pattern):', val, 'from:', text.substring(0, 50));
            return Math.floor(val);
        }

        // Pattern 4: "Max: 1" (plain number, no suffix)
        match = text.match(/Max:\s*([\d.]+)(?!\d)/i);
        if (match) {
            var val = parseFloat(match[1]);
            console.log('✓ Max found (plain number):', val, 'from:', text.substring(0, 50));
            return Math.floor(val);
        }

        return null;
    }

    console.log('🔍 Starting max bet search...');
    var maxFound = null;

    // Step 1: Check modal content directly first (most reliable)
    var modalText = modal.innerText || modal.textContent;
    maxFound = parse(modalText);
    if (maxFound) {
        console.log('✅ Max found in modal text:', maxFound);
        return maxFound;
    }

    // Step 2: Look for specific min-max elements
    var minMaxElements = modal.querySelectorAll('.fancy-min-max, .fancy-min-max-box, .min-max, [class*="min-max"], .market-info, .bet-info');
    console.log('📋 Checking', minMaxElements.length, 'min-max elements...');
    for (var i = 0; i < minMaxElements.length; i++) {
        var t = minMaxElements[i].innerText || minMaxElements[i].textContent;
        if (t && t.length < 200) {
            var m = parse(t);
            if (m) {
                maxFound = m;
                console.log('✅ Max found in element', i, ':', maxFound);
                break;
            }
        }
    }
    if (maxFound) return maxFound;

    // Step 3: Try to find the market name and search for it in the page
    var nameEl = modal.querySelector('.bet-team-name, b, .modal-title, .market-name, h5, h6, strong');
    if (nameEl) {
        var mName = (nameEl.innerText || nameEl.textContent).trim();
        console.log('🎯 Searching for market:', mName.substring(0, 30));

        var markets = document.querySelectorAll('.fancy-market, .market-row, .bet-table-row, tr, [class*="market"]');
        for (var i = 0; i < markets.length; i++) {
            var marketText = markets[i].innerText || markets[i].textContent || '';
            if (marketText.toLowerCase().includes(mName.toLowerCase().substring(0, 15))) {
                console.log('📍 Found matching market row');
                maxFound = parse(marketText);
                if (maxFound) {
                    console.log('✅ Max found in market row:', maxFound);
                    break;
                }
            }
        }
    }
    if (maxFound) return maxFound;

    // Step 4: Last resort - check all min-max elements on the page
    console.log('🔄 Trying fallback search...');
    var all = document.querySelectorAll('.fancy-min-max, .fancy-min-max-box, .min-max, [class*="min-max"]');
    for (var i = all.length - 1; i >= 0; i--) {
        var m = parse(all[i].innerText || all[i].textContent);
        if (m && m >= 1000) {
            maxFound = m;
            console.log('✅ Max found in fallback:', maxFound);
            break;
        }
    }

    if (!maxFound) {
        console.log('❌ Max bet not found! Modal text:', modalText.substring(0, 200));
    }

    return maxFound;
};

window.ProBet.placeBet = function (stake) {
    window.ProBet.initiateBetSequence(stake);
    return 'bet_sequence_initiated';
};
