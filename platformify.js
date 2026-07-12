// Copyright (c) 2026 BlazeInferno64 --> https://github.com/blazeinferno64.
//
// Author(s) -> 
// 1. BlazeInferno64 -> https://github.com/blazeinferno64
//
// Last updated: 09/06/2026


// Construct the Platformify class to encapsulate all system information gathering logic, with a focus on modularity and extensibility for future signal additions or privacy controls.
class Platformify {
    constructor() {
        this.isBrowser = typeof window !== 'undefined' && typeof navigator !== 'undefined';
        this.ua = this.isBrowser ? navigator.userAgent : 'Server-Side Environment';
    }

    /**
     * Gathers available system hardware, environment, and fingerprint metrics.
     * @param {Object} options Configuration parameters to toggle privacy or heavy checks.
     * @param {boolean} [options.includeMedia=true] Whether to run enumerateDevices()
     * @param {boolean} [options.includeBattery=true] Whether to fetch battery telemetry
     * @param {boolean} [options.generateFingerprints=false] Whether to append canvas/audio fingerprint hashes
     * @returns {Promise<Object>}
     */
    async getSystemInfo(options = {}) {
        if (!this.isBrowser) return { error: 'System information is not available in a non-browser environment.' };

        // Define default option fallbacks
        const opts = {
            includeMedia: true,
            includeBattery: true,
            generateFingerprints: false,
            ...options
        };

        const gpu = this._getGPUInfo();
        const cpu = await this._getCPUInfo();
        const ram = this._getRAMInfo();
        const platform = this._getPlatformInfo();
        const advancedOS = await this._getAdvancedOSInfo(platform);
        const network = this._getNetworkInfo();
        const display = { ...this._getDisplayInfo(), ...this._getAdvancedDisplayInfo() };
        const input = this._getInputInfo();
        const locale = this._getLocaleInfo();
        const browser = this._getBrowserInfo();
        const features = this._getFeatureSupport();
        const security = this._getSecuritySignals();
        const performanceMetrics = this._getPerformanceMetrics();
        const storage = await this._getStorageInfo();
        
        // Conditional asynchronous evaluations based on configuration
        const battery = opts.includeBattery ? await this._getBatteryInfo() : null;
        const media = opts.includeMedia ? await this._getMediaInfo() : null;
        const fingerprints = opts.generateFingerprints ? this._getFingerprints() : null;

        const payload = {
            platform,
            osDetails: advancedOS,
            userAgent: this.ua,
            cpu,
            gpu,
            ram,
            network,
            display,
            battery,
            input,
            locale,
            browser,
            features,
            security,
            performance: performanceMetrics,
            storage,
            media
        };

        if (opts.generateFingerprints) {
            payload.fingerprints = fingerprints;
        }

        return payload;
    }

    // Retrieve GPU information using WebGL context, with fallbacks for privacy-restricted environments and basic vendor/renderer retrieval when debug extensions are unavailable.
    _getGPUInfo() {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (!gl) return { vendor: 'Unknown', renderer: 'WebGL Unsupported' };

            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            if (!debugInfo) {
                return {
                    // In environments where the debug extension is unavailable, return generic values to indicate the presence of WebGL without exposing detailed hardware information, which may be restricted for privacy reasons.
                    vendor: gl.getParameter(gl.VENDOR) || 'Unknown',
                    renderer: gl.getParameter(gl.RENDERER) || 'Unknown'
                };
            }

            return {
                // If the debug extension is available, use it to get unmasked vendor and renderer information. If not, fall back to the standard parameters, which may be more generic due to privacy restrictions.
                vendor: gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || 'Unknown',
                renderer: gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'Unknown'
            };
        } catch (error) {
            // In cases where WebGL is blocked or unavailable, return a consistent placeholder to indicate the restriction without exposing partial information.
            return { vendor: 'Blocked', renderer: 'Blocked' };
        }
    }

    // Retrieve CPU information, including core count and architecture, with enhanced parsing logic to handle various user agent formats and potential privacy restrictions on high-entropy values.
    async _getCPUInfo() {
        const info = { cores: navigator.hardwareConcurrency || null, architecture: null };

        if (navigator.userAgentData?.getHighEntropyValues) {
            try {
                // Attempt to retrieve architecture and bitness information from high-entropy values, which may provide more accurate details in modern browsers while respecting user privacy settings. The parsing logic includes a fallback to handle cases where the architecture is reported as 'x86' but the bitness indicates a 64-bit system, which is a common scenario for compatibility modes or certain user agent configurations.
                const hints = await navigator.userAgentData.getHighEntropyValues(['architecture', 'bitness']);
                let arch = hints.architecture || null;
                if (arch === 'x86' && hints.bitness === '64') arch = 'x64';
                info.architecture = arch; // Finalize architecture assignment after applying the bitness correction logic, ensuring that we provide the most accurate information possible while accounting for common edge cases in user agent reporting.
            } catch (e) { }
        }

        if (!info.architecture) {
            // As a fallback, attempt to infer architecture from the user agent string, which may be less reliable but can provide insights in older browsers or when high-entropy values are unavailable. The regex patterns are designed to capture common indicators of architecture types while minimizing false positives, and the logic prioritizes 64-bit identifiers before checking for 32-bit ones to reflect the prevalence of 64-bit systems in modern environments.
            if (/Win64|x64|x86_64|amd64/i.test(this.ua)) info.architecture = 'x64';
            else if (/arm64|aarch64/i.test(this.ua)) info.architecture = 'arm64';
            else if (/i[3-6]86|x86;/i.test(this.ua)) info.architecture = 'x86';
        }

        return info;
    }

    _getRAMInfo() {
        // Safe contextual cross-reference targeting console configuration adjustments
        const memoryAPI = window.performance?.memory || window.console?.memory;
        return { // Provide both the standard device memory API value and a derived JavaScript heap limit in megabytes, which can offer insights into the memory constraints of the environment while accounting for potential privacy restrictions that may limit the granularity of the reported device memory. The heap limit is calculated by converting the jsHeapSizeLimit from bytes to megabytes, providing a more human-readable metric that can be useful for performance tuning or feature gating based on available memory resources.
            deviceMemoryGB: navigator.deviceMemory || null,
            jsHeapLimitMB: memoryAPI?.jsHeapSizeLimit ? Math.round(memoryAPI.jsHeapSizeLimit / (1024 * 1024)) : null
        };
    }

    // Retrieve network information, including effective connection type and downlink speed, with fallbacks for environments where the Network Information API is unavailable or restricted for privacy reasons. The returned object includes a saveData flag to indicate if the user has enabled data-saving mode, which can be useful for optimizing content delivery based on network conditions.
    _getNetworkInfo() {
        const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (!conn) return null;
        return {
            // The effectiveType property provides a high-level classification of the user's network connection, which can be useful for making decisions about content quality or feature availability based on expected performance. The downlink property offers an estimate of the effective bandwidth in megabits per second, which can help further refine optimizations for users on slower connections. Both properties are included with fallbacks to null to account for scenarios where the Network Information API is not supported or where privacy settings may limit the availability of detailed network information.
            effectiveType: conn.effectiveType || null,
            downlinkMbps: conn.downlink || null,
            saveData: conn.saveData || false
        };
    }

    // Retrieve display information, including screen dimensions, color depth, and device pixel ratio, with additional checks for advanced display capabilities such as HDR support and wide color gamut preferences. The returned object combines basic display metrics with media query evaluations to provide a more comprehensive view of the user's display environment, which can be useful for optimizing visual content or enabling features that depend on specific display capabilities.
    _getDisplayInfo() {
        return {
            width: screen.width,
            height: screen.height,
            colorDepth: screen.colorDepth,
            devicePixelRatio: window.devicePixelRatio || 1
        };
    }

    // Evaluate advanced display capabilities using media queries, including support for high dynamic range (HDR) content, wide color gamut preferences, and user preferences for dark mode and reduced motion. These signals can provide insights into the user's display environment and accessibility preferences, allowing for more tailored content delivery and feature adjustments based on the capabilities and preferences of the user's device.
    _getAdvancedDisplayInfo() {
        return {
            isHDR: window.matchMedia('(dynamic-range: high)').matches,
            isWideGamut: window.matchMedia('(color-gamut: p3)').matches,
            prefersDarkMode: window.matchMedia('(prefers-color-scheme: dark)').matches,
            prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        };
    }

    // Retrieve battery information, including charging status, battery level, and estimated charging/discharging times, with fallbacks for environments where the Battery Status API is unavailable or restricted for privacy reasons. The returned object includes normalized values for battery level as a percentage and handles cases where charging or discharging times are reported as Infinity by converting them to null, providing a more consistent and human-readable format for battery information that can be useful for optimizing user experience based on power conditions.
    async _getBatteryInfo() {
        if (!navigator.getBattery) return null;
        try {
            const battery = await navigator.getBattery();
            return {
                charging: battery.charging,
                levelPercent: Math.round(battery.level * 100),
                chargingTimeSec: battery.chargingTime === Infinity ? null : battery.chargingTime,
                dischargingTimeSec: battery.dischargingTime === Infinity ? null : battery.dischargingTime
            };
        } catch (e) {
            return null;
        }
    }

    // Retrieve input capabilities, including touch support and pointer precision, with evaluations based on both hardware properties and media queries. The returned object provides a comprehensive view of the user's input environment, which can be useful for optimizing interactions and UI elements based on the presence of touch capabilities and the precision of available pointers.
    _getInputInfo() {
        return {
            maxTouchPoints: navigator.maxTouchPoints ?? 0,
            hasTouch: (navigator.maxTouchPoints ?? 0) > 0,
            hasCoarsePointer: window.matchMedia('(pointer: coarse)').matches,
            hasFinePointer: window.matchMedia('(pointer: fine)').matches
        };
    }

    // Retrieve locale information, including the user's preferred language, list of accepted languages, timezone, and timezone offset, with fallbacks for environments where certain properties may be unavailable or restricted for privacy reasons. The returned object provides insights into the user's linguistic and regional preferences, which can be useful for localizing content and optimizing user experience based on cultural context.
    _getLocaleInfo() {
        return {
            language: navigator.language || null,
            languages: Array.from(navigator.languages || []),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
            timezoneOffsetMin: new Date().getTimezoneOffset()
        };
    }

    // Retrieve browser information, including the list of brands and versions, as well as various browser capabilities and settings such as cookie support, Do Not Track status, PDF viewer availability, and WebDriver presence. The method includes logic to parse brand information from the user agent string as a fallback for environments where the User Agent Client Hints API is unavailable or restricted for privacy reasons, ensuring that we can still provide insights into the user's browser environment while respecting potential limitations on available information.
    _getBrowserInfo() {
        const brands = navigator.userAgentData?.brands
            ? navigator.userAgentData.brands.map(b => ({ brand: b.brand, version: b.version }))
            : this._parseBrandsFromUA();
        return {
            brands,
            cookiesEnabled: navigator.cookieEnabled,
            doNotTrack: navigator.doNotTrack ?? null,
            pdfViewerEnabled: navigator.pdfViewerEnabled ?? null,
            webdriver: navigator.webdriver ?? false
        };
    }

    // Fallback method to parse browser brand and version information from the user agent string, designed to handle common patterns for major browsers while minimizing false positives. The method checks for specific browser identifiers in the user agent string and extracts the corresponding version numbers, providing a best-effort approach to identify the browser environment when high-entropy values are unavailable or restricted for privacy reasons.
    _parseBrandsFromUA() {
        const ua = this.ua;
        if (/Firefox\/([\d.]+)/.test(ua))
            return [{ brand: 'Firefox', version: RegExp.$1.split('.')[0] }];
        if (/Edg\/([\d.]+)/.test(ua))
            return [{ brand: 'Edge', version: RegExp.$1.split('.')[0] }];
        if (/Safari\/([\d.]+)/.test(ua) && !/Chrome/.test(ua))
            return [{ brand: 'Safari', version: RegExp.$1.split('.')[0] }];
        return null;
    }

    // Retrieve support for various web platform features, including WebAssembly, Web Workers, Service Workers, IndexedDB, WebGL2, OffscreenCanvas, and SharedArrayBuffer. The returned object provides a snapshot of the capabilities available in the user's browser environment, which can be useful for feature detection and optimizing content delivery based on supported technologies.
    _getFeatureSupport() {
        return {
            webAssembly: typeof WebAssembly !== 'undefined',
            webWorkers: typeof Worker !== 'undefined',
            serviceWorker: 'serviceWorker' in navigator,
            indexedDB: 'indexedDB' in window,
            webGL2: !!document.createElement('canvas').getContext('webgl2'),
            offscreenCanvas: typeof OffscreenCanvas !== 'undefined',
            sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined'
        };
    }

    // Retrieve security-related signals, including whether the page is framed and the document referrer, which can provide insights into potential clickjacking risks and the context from which the user arrived at the page. The isFramed signal is determined by comparing the window.self and window.top properties, while the referrer is obtained from document.referrer, with a fallback to null for cases where it may be unavailable or restricted for privacy reasons.
    _getSecuritySignals() {
        return {
            isFramed: window.self !== window.top,
            referrer: document.referrer || null
        };
    }

    // Retrieve performance-related metrics, including the navigation type, time origin, and page visibility state, which can provide insights into how the user arrived at the page and the current visibility status of the document. The navigation type is obtained from performance.navigation.type with a fallback to null for modern browsers that may not support this property, while the time origin is retrieved from performance.timeOrigin with a fallback to null for older browsers. The isPageVisible signal is determined by checking the document.visibilityState property, which indicates whether the page is currently visible to the user.
    _getPerformanceMetrics() {
        return {
            navigationType: performance.navigation?.type ?? null,
            timeOrigin: performance.timeOrigin || null,
            isPageVisible: document.visibilityState === 'visible'
        };
    }

    // Retrieve advanced operating system information, including the OS version and specific Windows version if applicable, using high-entropy values when available. The method includes logic to handle cases where the platform is identified as Windows but the version information may be reported in a way that requires parsing to determine the specific marketing name (e.g., Windows 10 vs. Windows 11), while also providing fallbacks for environments where high-entropy values are unavailable or restricted for privacy reasons.
    async _getAdvancedOSInfo(currentPlatform) {
        const info = { osVersion: null, windowsVersion: null };
        if (navigator.userAgentData?.getHighEntropyValues) {
            try {
                const hints = await navigator.userAgentData.getHighEntropyValues(['platformVersion', 'platform']);
                const platformName = hints.platform || currentPlatform || '';
                info.osVersion = hints.platformVersion || null;
                
                // Verify platform context matches Windows before assuming marketing names
                if (platformName.toLowerCase().includes('win') && hints.platformVersion) {
                    const major = parseInt(hints.platformVersion.split('.')[0], 10);
                    info.windowsVersion = major >= 13 ? 'Windows 11' : major >= 1 ? 'Windows 10' : 'Windows 8';
                }
            } catch (e) { }
        }
        return info;
    }

    // Retrieve storage information, including estimated quota and usage in megabytes, with fallbacks for environments where the Storage API is unavailable or restricted for privacy reasons. The method uses navigator.storage.estimate() to obtain the quota and usage values, which are then converted from bytes to megabytes for easier interpretation. If the Storage API is not supported or if an error occurs during estimation, the method returns null to indicate that storage information is not available.
    async _getStorageInfo() {
        if (!navigator.storage?.estimate) return null;
        try {
            const { quota, usage } = await navigator.storage.estimate();
            return {
                quotaMB: Math.round(quota / (1024 * 1024)),
                usageMB: Math.round(usage / (1024 * 1024))
            };
        } catch (e) {
            return null;
        }
    }

    // Retrieve media device information, including the presence of cameras, microphones, and audio output devices, as well as the total device count and whether any active permissions have been granted to access these devices. The method uses navigator.mediaDevices.enumerateDevices() to obtain a list of media input and output devices, filtering out those that do not have a deviceId or label to account for cases where permissions have not been granted. The returned object provides insights into the user's media capabilities and permission status, which can be useful for optimizing media-related features or providing appropriate user prompts based on available devices and permissions.
    async _getMediaInfo() {
        if (!navigator.mediaDevices?.enumerateDevices) return null;
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            // Filter system descriptors away if permission hasn't been explicitly granted
            const activeDevices = devices.filter(d => d.deviceId || d.label);
            return {
                hasCamera: devices.some(d => d.kind === 'videoinput'),
                hasMicrophone: devices.some(d => d.kind === 'audioinput'),
                hasAudioOutput: devices.some(d => d.kind === 'audiooutput'),
                deviceCount: devices.length,
                hasActivePermissions: activeDevices.length > 0
            };
        } catch (e) {
            return null;
        }
    }

    // Retrieve platform information with enhanced parsing logic to handle various user agent formats and potential privacy restrictions on high-entropy values. The method first checks for the presence of navigator.userAgentData.platform, which provides a more reliable and standardized way to obtain platform information in modern browsers while respecting user privacy settings. If this property is unavailable, the method falls back to parsing the user agent string for common platform identifiers, with checks for Windows, macOS, Linux, Android, and iOS. If none of these identifiers are found, the method returns navigator.platform as a final fallback, which may provide a more generic value depending on the browser and privacy settings.
    _getPlatformInfo() {
        if (navigator.userAgentData?.platform) return navigator.userAgentData.platform;
        const ua = this.ua.toLowerCase();
        if (ua.includes('win')) return 'Windows';
        if (ua.includes('mac')) return 'macOS';
        if (ua.includes('linux')) return 'Linux';
        if (ua.includes('android')) return 'Android';
        if (ua.includes('iphone') || ua.includes('ipad')) return 'iOS';
        return navigator.platform || 'Unknown';
    }

    /**
     * Advanced Canvas Fingerprinting Generation (Optional Engine Signal)
     */
    _getFingerprints() {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return null;

            canvas.width = 200;
            canvas.height = 50;

            // Render a distinctive tracking layout to expose structural variations in GPU text-rasterization
            ctx.textBaseline = "top";
            ctx.font = "14px 'Arial', sans-serif";
            ctx.fillStyle = "#f60";
            ctx.fillRect(10, 10, 50, 20);
            ctx.fillStyle = "#069";
            ctx.fillText("Platformify, alpha 1.0.0 😃", 5, 5);
            ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
            ctx.fillText("Platformify, alpha 1.0.0 😃", 7, 7);

            const dataURL = canvas.toDataURL();
            
            // Simple non-cryptographic FNV-1a 32-bit hashing implementation for payload efficiency
            let hash = 2166136261;
            for (let i = 0; i < dataURL.length; i++) {
                hash ^= dataURL.charCodeAt(i);
                hash = Math.imul(hash, 16777619);
            }
            
            return {
                canvasHash: (hash >>> 0).toString(16)
            };
        } catch (e) {
            return null;
        }
    }
}

// Expose the Platformify class to the global scope for browser environments and as a module export for Node.js environments, allowing for flexible integration in various contexts while maintaining compatibility with both client-side and server-side JavaScript execution environments.
if (typeof window !== 'undefined') {
    window.Platformify = Platformify;
}

// For Node.js environments, export the Platformify class as a module to allow for server-side usage and integration with build tools or server frameworks, while ensuring that the class is not exposed in non-browser contexts where it may not be applicable or where certain APIs may be unavailable.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Platformify;
}