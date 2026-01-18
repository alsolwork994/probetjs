// ==========================================
// SITE CONFIGURATION SYSTEM
// ==========================================
// This file contains site-specific configurations for different betting exchanges
// Each site has its own selectors and patterns for modal detection, input fields, etc.

window.ProBet = window.ProBet || {};

window.ProBet.SiteConfigs = {
    'diamondexch': {
        name: 'DiamondExch',
        domains: ['diamondexch99.now', 'diamondexch'],
        selectors: {
            modal: '.place-bet-modal',
            modalBack: '.place-bet-modal.back',
            modalLay: '.place-bet-modal.lay',
            stakeInput: 'input.stakeinput[type="number"], input[type="number"]:not([disabled])',
            submitButton: '.btn-success, button.btn-success, button[class*="bet"]:not([disabled]):not(.close)',
            loginUsername: 'input[name="username"]',
            loginPassword: 'input[name="password"]',
            loginSubmit: 'button[type="submit"]'
        },
        maxBetPatterns: {
            elements: ['.fancy-min-max', '.fancy-min-max-box', '.min-max', '[class*="min-max"]', '.market-info', '.bet-info', '.bet-limits', '.limits'],
            regex: [
                /Min:\s*[\d.]+\s+Max:\s*([\d.]+)\s*([KLkl])/i,
                /Max:\s*([\d.]+)\s*([KLkl])/i,
                /Range:\s*[\d.]+\s+to\s+([\d.]+)\s*([KLkl]?)/i,
                /Max:\s*([\d.]+)(?!\d)/i
            ]
        }
    },
    'tomexchange': {
        name: 'TOM Exchange',
        domains: ['tomexchange', 'tomexch', 'tom'],
        selectors: {
            // Multiple selectors for flexibility (hashed class names may change)
            modal: '._betSlip_main_wrapper_3vbcs_199, [class*="_betSlip_main_wrapper"], [class*="betSlip"]',
            modalBack: '[style*="rgb(69, 127, 202)"], [style*="69, 127, 202"]',
            modalLay: '[style*="rgb(255, 182, 193)"], [style*="pink"], [class*="_lay"]',
            stakeInput: '._stake_inp_3vbcs_56, input[class*="_stake_inp"], input[placeholder="stake"], input[class*="stake"]',
            oddsInput: '._odds_inp_3vbcs_32, input[class*="_odds_inp"], input[placeholder="odds"]',
            submitButton: '._betSubmit_3vbcs_255, ._placeBet_btn_3vbcs_485, [class*="_betSubmit"], [class*="_placeBet_btn"], button:not([disabled]):not([class*="cancel"]):not([class*="delete"])',
            loginUsername: 'input[name="username"]',
            loginPassword: 'input[name="password"]',
            loginSubmit: 'button[type="submit"]'
        },
        maxBetPatterns: {
            elements: [
                '._amt_cont_3vbcs_322',
                '[class*="_amt_cont"]',
                '.fancy-min-max',
                '.maxbet_box',
                '[class*="min-max"]',
                '.bet-info',
                '.limits'
            ],
            regex: [
                /Min:\s*[\d.]+\s+Max:\s*([\d.]+)\s*([KLkl])/i,
                /Max:\s*([\d.]+)\s*([KLkl])/i,
                /Max Bet\s*:\s*([\d.]+)\s*([KLkl])/i,
                /Max Market\s*:\s*([\d.]+)\s*([KLkl]?)/i,
                /Range:\s*[\d.]+\s+to\s+([\d.]+)\s*([KLkl]?)/i
            ]
        },
        modalDetection: {
            // TOM Exchange modal is always in DOM, detect by position/visibility
            checkVisibility: true,
            visibleConditions: [
                function (el) {
                    var style = window.getComputedStyle(el);
                    // Modal is visible if NOT positioned off-screen
                    return style.top !== '-5000px' && style.left !== '-5000px' &&
                        style.display !== 'none' && style.visibility !== 'hidden';
                }
            ]
        }
    }
};

// Site detection function
window.ProBet.detectSite = function () {
    var hostname = window.location.hostname.toLowerCase();
    console.log('🔍 Detecting site from hostname:', hostname);

    for (var key in window.ProBet.SiteConfigs) {
        var config = window.ProBet.SiteConfigs[key];
        for (var i = 0; i < config.domains.length; i++) {
            var domain = config.domains[i].toLowerCase();
            if (hostname.includes(domain)) {
                console.log('✓ Detected site:', config.name, '(matched:', domain, ')');
                return key;
            }
        }
    }

    console.log('⚠️ Unknown site, using default (diamondexch)');
    return 'diamondexch';
};

// Initialize site detection
window.ProBet.currentSite = null;
window.ProBet.currentConfig = null;

console.log('✓ Site configuration system loaded');
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
    // Initialize site detection if not already done
    if (!window.ProBet.currentSite && window.ProBet.detectSite) {
        window.ProBet.currentSite = window.ProBet.detectSite();
        window.ProBet.currentConfig = window.ProBet.SiteConfigs[window.ProBet.currentSite];
        console.log('📍 Using config for:', window.ProBet.currentConfig.name);
    }

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
        var config = window.ProBet.currentConfig || (window.ProBet.SiteConfigs && window.ProBet.SiteConfigs.diamondexch);
        if (!config) {
            return 'Error: No site config';
        }

        var usernameField = document.querySelector(config.selectors.loginUsername);
        var passwordField = document.querySelector(config.selectors.loginPassword);
        var submitButton = document.querySelector(config.selectors.loginSubmit);

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
            return 'Login submitted for ' + config.name;
        }
        return 'Form not found';
    } catch (e) { return 'Error: ' + e.message; }
};

// ==========================================
// 4. MUTATION OBSERVER (TRIGGER)
// ==========================================
window.ProBet.setupMutationObserver = function () {
    if (window.betObserverSetup) return 'already_setup';

    // Get site config (fallback to diamondexch if not set)
    var config = window.ProBet.currentConfig || (window.ProBet.SiteConfigs && window.ProBet.SiteConfigs.diamondexch);
    if (!config) {
        console.error('❌ No site config available!');
        return 'no_config';
    }

    var observer = new MutationObserver(function (mutations) {
        if (!window.ProBet.config.isEnabled) return;
        if (window.ProBet.state.betLock) return; // Locked!

        var modalFound = false;

        mutations.forEach(function (mutation) {
            if (modalFound) return;

            mutation.addedNodes.forEach(function (node) {
                if (node.nodeType === 1) {
                    // Check using site-specific modal selector
                    var modalSelectors = config.selectors.modal.split(',');
                    for (var i = 0; i < modalSelectors.length; i++) {
                        var selector = modalSelectors[i].trim();
                        if ((node.matches && node.matches(selector)) ||
                            (node.querySelector && node.querySelector(selector))) {
                            modalFound = true;
                            break;
                        }
                    }
                }
            });

            // For sites with visibility-based detection (like TOM Exchange)
            if (!modalFound && config.modalDetection && config.modalDetection.checkVisibility) {
                if (mutation.type === 'attributes' && (mutation.attributeName === 'style' || mutation.attributeName === 'class')) {
                    var modalSelectors = config.selectors.modal.split(',');
                    for (var i = 0; i < modalSelectors.length; i++) {
                        var selector = modalSelectors[i].trim();
                        if (mutation.target.matches && mutation.target.matches(selector)) {
                            // Check if modal became visible
                            for (var j = 0; j < config.modalDetection.visibleConditions.length; j++) {
                                if (config.modalDetection.visibleConditions[j](mutation.target)) {
                                    modalFound = true;
                                    break;
                                }
                            }
                            if (modalFound) break;
                        }
                    }
                }
            } else if (!modalFound && mutation.type === 'attributes' && (mutation.attributeName === 'style' || mutation.attributeName === 'class')) {
                // Standard visibility check for sites without special detection
                var target = mutation.target;
                var modalSelectors = config.selectors.modal.split(',');
                for (var i = 0; i < modalSelectors.length; i++) {
                    var selector = modalSelectors[i].trim();
                    if (target.matches && target.matches(selector)) {
                        if (target.style.display !== 'none') {
                            modalFound = true;
                            break;
                        }
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
    return 'observer_setup_multisite';
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
        var config = window.ProBet.currentConfig || (window.ProBet.SiteConfigs && window.ProBet.SiteConfigs.diamondexch);
        if (!config) {
            return { status: 'error', reason: 'no_site_config' };
        }

        // Find modal using site-specific selectors
        var modalSelectors = [
            config.selectors.modalBack,
            config.selectors.modalLay,
            config.selectors.modal
        ];

        var modal = null;
        for (var i = 0; i < modalSelectors.length; i++) {
            var selectorList = modalSelectors[i].split(',');
            for (var j = 0; j < selectorList.length; j++) {
                var selector = selectorList[j].trim();
                modal = document.querySelector(selector);
                if (modal) break;
            }
            if (modal) break;
        }

        if (!modal) return { status: 'retry', reason: 'no_modal_in_dom' };

        // For sites with visibility detection (like TOM Exchange), verify modal is actually visible
        if (config.modalDetection && config.modalDetection.checkVisibility) {
            var isVisible = false;
            for (var i = 0; i < config.modalDetection.visibleConditions.length; i++) {
                if (config.modalDetection.visibleConditions[i](modal)) {
                    isVisible = true;
                    break;
                }
            }
            if (!isVisible) {
                return { status: 'retry', reason: 'modal_not_visible' };
            }
        }

        // --- INPUT HANDLING ---
        var inputSelectors = config.selectors.stakeInput.split(',');
        var input = null;
        for (var i = 0; i < inputSelectors.length; i++) {
            var selector = inputSelectors[i].trim();
            input = modal.querySelector(selector);
            if (input) break;
        }

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
        var buttonSelectors = config.selectors.submitButton.split(',');
        var btn = null;
        for (var i = 0; i < buttonSelectors.length; i++) {
            var selector = buttonSelectors[i].trim();
            btn = modal.querySelector(selector);
            if (btn) break;
        }

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
    var allMaxValues = [];

    // Step 1: Parse the ENTIRE modal text FIRST (most reliable for getting the actual max)
    var modalText = modal.innerText || modal.textContent;
    console.log('📄 Modal text preview:', modalText.substring(0, 150));

    var modalMax = parse(modalText);
    if (modalMax && modalMax > 0) {
        allMaxValues.push({ value: modalMax, source: 'full-modal-text', text: modalText.substring(0, 50) });
        console.log('✓ Found max in full modal text:', modalMax);
    }

    // Step 2: Look for min-max info in specific elements WITHIN the modal
    var minMaxElements = modal.querySelectorAll('.fancy-min-max, .fancy-min-max-box, .min-max, [class*="min-max"], .market-info, .bet-info, .bet-limits, .limits');
    console.log('📋 Checking', minMaxElements.length, 'min-max elements in modal...');
    for (var i = 0; i < minMaxElements.length; i++) {
        var t = minMaxElements[i].innerText || minMaxElements[i].textContent;
        if (t && t.length < 200) {
            var m = parse(t);
            if (m && m > 0) {
                allMaxValues.push({ value: m, source: 'modal-element-' + i, text: t.substring(0, 50) });
                console.log('✓ Found max in modal element', i, ':', m, 'from:', t.substring(0, 50));
            }
        }
    }

    // Step 3: Check for max value in text near the stake input
    var input = modal.querySelector('input.stakeinput[type="number"]') ||
        modal.querySelector('input[type="number"]:not([disabled])');
    if (input && input.parentElement) {
        var nearbyElements = [
            input.parentElement,
            input.parentElement.parentElement,
            input.previousElementSibling,
            input.nextElementSibling
        ];
        console.log('🎯 Checking elements near stake input...');
        for (var i = 0; i < nearbyElements.length; i++) {
            if (nearbyElements[i]) {
                var t = nearbyElements[i].innerText || nearbyElements[i].textContent;
                if (t && t.length < 300) {
                    var m = parse(t);
                    if (m && m > 0) {
                        allMaxValues.push({ value: m, source: 'near-input-' + i, text: t.substring(0, 50) });
                        console.log('✓ Found max near input:', m, 'from:', t.substring(0, 50));
                    }
                }
            }
        }
    }

    // Step 4: Only search the page if we haven't found anything yet
    if (allMaxValues.length === 0) {
        console.log('⚠️ No max found in modal, searching page...');

        // Try to detect market type from modal
        var marketType = null;
        if (modalText.toLowerCase().includes('bookmaker')) marketType = 'bookmaker';
        else if (modalText.toLowerCase().includes('match_odds') || modalText.toLowerCase().includes('match odds')) marketType = 'match_odds';
        else if (modalText.toLowerCase().includes('tied')) marketType = 'tied';

        console.log('🔍 Detected market type:', marketType || 'unknown');

        var nameEl = modal.querySelector('.bet-team-name, b, .modal-title, .market-name, h5, h6, strong');
        if (nameEl) {
            var mName = (nameEl.innerText || nameEl.textContent).trim();
            console.log('🎯 Searching page for market:', mName.substring(0, 30), 'type:', marketType);

            var markets = document.querySelectorAll('.fancy-market, .market-row, .bet-table-row, tr, [class*="market"]');
            for (var i = 0; i < markets.length; i++) {
                var marketText = markets[i].innerText || markets[i].textContent || '';
                var marketTextLower = marketText.toLowerCase();

                // Check if this row matches both the team name AND market type
                var nameMatches = marketTextLower.includes(mName.toLowerCase().substring(0, 15));
                var typeMatches = !marketType ||
                    marketTextLower.includes(marketType) ||
                    (marketType === 'match_odds' && marketTextLower.includes('match'));

                if (nameMatches && typeMatches) {
                    console.log('📍 Found matching market row (type:', marketType, ')');
                    var m = parse(marketText);
                    if (m && m > 0) {
                        allMaxValues.push({ value: m, source: 'page-market-' + i, text: marketText.substring(0, 50) });
                        console.log('✓ Found max in market row:', m);
                        break;
                    }
                }
            }
        }
    }

    // Step 5: Choose the best max value from all found values
    if (allMaxValues.length > 0) {
        console.log('📊 Found', allMaxValues.length, 'max values:', allMaxValues.map(function (v) { return v.value; }));

        // Priority:
        // 1. Full modal text (most reliable - this is what the user sees)
        // 2. Values from modal elements
        // 3. Values near input field
        // 4. Page market rows (least reliable)

        var modalTextValues = allMaxValues.filter(function (v) { return v.source === 'full-modal-text'; });
        var modalElementValues = allMaxValues.filter(function (v) { return v.source.startsWith('modal-element'); });
        var nearInputValues = allMaxValues.filter(function (v) { return v.source.startsWith('near-input'); });

        if (modalTextValues.length > 0) {
            // Use the value from modal text (most reliable)
            maxFound = modalTextValues[0].value;
            console.log('✅ Selected max from MODAL TEXT:', maxFound);
        } else if (modalElementValues.length > 0 || nearInputValues.length > 0) {
            // Take the largest value from modal elements or near input
            var combined = modalElementValues.concat(nearInputValues);
            maxFound = Math.max.apply(null, combined.map(function (v) { return v.value; }));
            console.log('✅ Selected max from modal/near-input (largest):', maxFound);
        } else {
            // Use page market value as last resort
            maxFound = allMaxValues[0].value;
            console.log('✅ Selected max from', allMaxValues[0].source, ':', maxFound);
        }
    }

    if (!maxFound || maxFound === 0) {
        console.log('❌ Max bet not found! Modal text:', modalText.substring(0, 200));
    }

    return maxFound;
};

window.ProBet.placeBet = function (stake) {
    window.ProBet.initiateBetSequence(stake);
    return 'bet_sequence_initiated';
};
