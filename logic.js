window.ProBet = window.ProBet || {};

// ==========================================
// 1. AUTO LOGIN LOGIC
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
                element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
                element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
                element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true }));
                element.dispatchEvent(new KeyboardEvent('keypress', { bubbles: true, cancelable: true }));
                element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, cancelable: true }));
                element.dispatchEvent(new Event('focus', { bubbles: true, cancelable: true }));
                element.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));
            }

            triggerEvents(usernameField);
            triggerEvents(passwordField);
            passwordField.focus();
            passwordField.blur();

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
// 2. MUTATION OBSERVER
// ==========================================
window.ProBet.setupMutationObserver = function () {
    if (window.betObserverSetup) return 'already_setup';

    var observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
            mutation.addedNodes.forEach(function (node) {
                if (node.nodeType === 1) {
                    if (node.classList && node.classList.contains('place-bet-modal')) {
                        console.log('⚡ MUTATION: Modal detected instantly!');
                    }
                }
            });
        });
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class']
    });

    window.betObserverSetup = true;
    return 'observer_setup';
};

// ==========================================
// 3. CHECK MODAL VISIBILITY
// ==========================================
window.ProBet.checkModalVisibility = function () {
    var modal = document.querySelector('.place-bet-modal');
    if (modal) {
        var style = window.getComputedStyle(modal);
        var isVisible = style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
        return isVisible ? 'found' : 'notfound';
    }
    return 'notfound';
};

// ==========================================
// 4. PLACE BET LOGIC (MAX BET ALGORITHM)
// ==========================================
window.ProBet.placeBet = function (stake) {
    try {
        var modal = document.querySelector('.place-bet-modal.back') ||
            document.querySelector('.place-bet-modal.lay') ||
            document.querySelector('.place-bet-modal');

        if (!modal) return 'no_modal';

        var modalType = modal.classList.contains('back') ? 'BACK' :
            modal.classList.contains('lay') ? 'LAY' : 'UNKNOWN';

        var input = modal.querySelector('input.stakeinput[type="number"]') ||
            modal.querySelector('input[type="number"]:not([disabled])');

        if (!input) return 'no_input';

        var finalStake = stake;

        // --- HELPER: Parse Max Value ---
        function parseMaxValue(text) {
            if (!text) return null;

            // Pattern 1: Min: X Max: Y[K/L] (handles &nbsp; and spaces)
            var match = text.match(/Min:\s*([\d.]+)\s+Max:\s*([\d.]+)\s*([KLkl])/i);
            if (match) {
                var maxValue = parseFloat(match[2]);
                var suffix = match[3].toUpperCase();
                if (suffix === 'K') maxValue = maxValue * 1000;
                else if (suffix === 'L') maxValue = maxValue * 100000;
                return Math.floor(maxValue);
            }

            // Pattern 2: Min: X [any chars] Max: Y[K/L]
            match = text.match(/Min:\s*([\d.]+)\s+Max:\s*([\d.]+)\s*([KLkl])/i);
            if (match) {
                var maxValue = parseFloat(match[2]);
                var suffix = match[3].toUpperCase();
                if (suffix === 'K') maxValue = maxValue * 1000;
                else if (suffix === 'L') maxValue = maxValue * 100000;
                return Math.floor(maxValue);
            }

            // Pattern 3: Range: X to Y [K/L]
            match = text.match(/Range:\s*(\d+(?:\.\d+)?)\s+to\s+(\d+(?:\.\d+)?)\s*([KLkl]?)/i);
            if (match) {
                var maxValue = parseFloat(match[2]);
                var suffix = match[3] ? match[3].toUpperCase() : '';
                if (suffix === 'K') maxValue = maxValue * 1000;
                else if (suffix === 'L') maxValue = maxValue * 100000;
                return Math.floor(maxValue);
            }

            // Pattern 4: Max: Y[K/L] (no min)
            match = text.match(/Max:\s*([\d.]+)\s*([KLkl])/i);
            if (match) {
                var maxValue = parseFloat(match[1]);
                var suffix = match[2].toUpperCase();
                if (suffix === 'K') maxValue = maxValue * 1000;
                else if (suffix === 'L') maxValue = maxValue * 100000;
                return Math.floor(maxValue);
            }

            return null;
        }

        // --- MAX BET LOGIC ---
        if (finalStake === '-1') {
            var maxFound = null;
            var searchLog = [];

            console.log('[MAX-BET] ========== MAX BET MODE (REMOTE) ==========');

            // STRATEGY 1: Check modal for min-max element
            var minMaxElements = modal.querySelectorAll('.fancy-min-max, .fancy-min-max-box, .min-max, [class*="min-max"], span, div');
            for (var i = 0; i < minMaxElements.length; i++) {
                var elemText = minMaxElements[i].innerText || minMaxElements[i].textContent;
                if (elemText && elemText.length < 200) {
                    var testMax = parseMaxValue(elemText);
                    if (testMax && testMax >= 10000) {
                        maxFound = testMax;
                        searchLog.push('modal_elem:' + maxFound);
                        break;
                    }
                }
            }

            // STRATEGY 2: Parse entire modal text
            if (!maxFound) {
                var modalText = modal.innerText || modal.textContent;
                maxFound = parseMaxValue(modalText);
                if (maxFound) searchLog.push('modal_text:' + maxFound);
            }

            // STRATEGY 3: Find market on page by name
            if (!maxFound) {
                var marketNameElem = modal.querySelector('.bet-team-name, b, .modal-title, .market-name, h5, h6, strong');
                if (marketNameElem) {
                    var marketName = (marketNameElem.innerText || marketNameElem.textContent).trim();
                    console.log('[MAX-BET] Looking for market:', marketName);
                    searchLog.push('market:' + marketName.substring(0, 20));

                    var allMarkets = document.querySelectorAll('.fancy-market, .market-row, .bet-table-row, tr, [class*="market"]');

                    for (var i = 0; i < allMarkets.length; i++) {
                        var marketText = allMarkets[i].innerText || allMarkets[i].textContent;

                        if (marketText.toLowerCase().includes(marketName.toLowerCase().substring(0, 15))) {
                            // Try to find min-max in this market or parent
                            var selectors = '.fancy-min-max, .fancy-min-max-box, .min-max, [class*="min-max"], .market-nation-name, .max-bet';
                            var marketMinMax = allMarkets[i].querySelector(selectors);

                            if (!marketMinMax) {
                                var parent = allMarkets[i].closest('.bet-table, .market-container, .game-market, .market-4, .market-wrapper');
                                if (parent) {
                                    marketMinMax = parent.querySelector(selectors);
                                    if (marketMinMax) console.log('[MAX-BET] Found max in parent container');
                                }
                            }

                            if (marketMinMax) {
                                var minMaxText = marketMinMax.innerText || marketMinMax.textContent;
                                maxFound = parseMaxValue(minMaxText);
                                if (maxFound) {
                                    searchLog.push('page_elem:' + maxFound);
                                    break;
                                }
                            }

                            maxFound = parseMaxValue(marketText);
                            if (maxFound) {
                                searchLog.push('page_text:' + maxFound);
                                break;
                            }
                        }
                    }
                }
            }

            // STRATEGY 4: Search entire page for ANY min-max elements
            if (!maxFound) {
                var allMinMax = document.querySelectorAll('.fancy-min-max, .fancy-min-max-box, .min-max, [class*="min-max"], .market-nation-name, .max-bet');
                for (var i = allMinMax.length - 1; i >= 0; i--) {
                    var elemText = allMinMax[i].innerText || allMinMax[i].textContent;
                    var testMax = parseMaxValue(elemText);
                    if (testMax && testMax >= 1000) {
                        maxFound = testMax;
                        searchLog.push('page_any:' + maxFound);
                        break;
                    }
                }
            }

            // STRATEGY 5: Check input attributes
            if (!maxFound) {
                var maxAttr = input.getAttribute('max');
                if (maxAttr && parseFloat(maxAttr) > 0) {
                    maxFound = Math.floor(parseFloat(maxAttr));
                    searchLog.push('input_attr:' + maxFound);
                }
            }

            // STRATEGY 6: Use current input value
            if (!maxFound) {
                var currentValue = input.value;
                if (currentValue && parseFloat(currentValue) > 0) {
                    maxFound = Math.floor(parseFloat(currentValue));
                    searchLog.push('input_value:' + maxFound);
                }
            }

            if (maxFound && maxFound > 0) {
                finalStake = maxFound.toString();
                console.log('[MAX-BET] Final stake:', finalStake);
            } else {
                return 'no_max_found|search:' + searchLog.join('|');
            }
        }

        // --- PLACE BET ---
        var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        setter.call(input, finalStake);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));

        var btn = modal.querySelector('.btn-success') ||
            modal.querySelector('button.btn-success') ||
            modal.querySelector('button:not([disabled])');

        if (btn) {
            btn.disabled = false;
            btn.click();
            return 'bet_placed_ultra_fast|' + finalStake;
        } else {
            return 'button_not_found';
        }
    } catch (e) {
        return 'js_exception:' + e.message;
    }
};
