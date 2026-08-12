// core/app/types.js
// TypeScript-style definitions for IDE support and documentation

/**
 * @typedef {Object} AppDatabase
 * @property {function(string): AppDatabase} use - Select database
 * @property {function(Object): Promise<QueryBuilder>} query - Start query builder
 * @property {function(Object): Promise<Array>} fetch - Direct fetch
 * @property {function(Object): Promise<Object>} create - Create record
 * @property {function(string, Object): Promise<Object>} update - Update record
 * @property {function(string): Promise<boolean>} delete - Delete record
 * @property {function(Object, function): Object} subscribe - Real-time updates
 * @property {function(string, Array, number, number): Promise<Array>} nearBy - Geospatial query
 * @property {function(string): Promise<Object|null>} getById - Get single record
 * @property {function(string, any): QueryBuilder} where - Where clause
 * @property {function(string, string): QueryBuilder} orderBy - Order by field
 * @property {function(number): QueryBuilder} limit - Limit results
 * @property {function(number): QueryBuilder} skip - Skip results
 */

/**
 * @typedef {Object} AppUI
 * @property {function(string, Object): Promise<boolean>} confirm - Confirmation dialog
 * @property {function(string, Object): Promise<void>} alert - Alert dialog
 * @property {function(string, Object): void} toast - Toast notification
 * @property {function(boolean): void} loading - Loading state
 * @property {Object} theme - Theme management
 * @property {function(): void} theme.toggle - Toggle theme
 * @property {function(string): void} theme.set - Set theme
 * @property {string} theme.current - Current theme
 */

/**
 * @typedef {Object} AppAuth
 * @property {Object|null} user - Current user
 * @property {boolean} isAuthenticated - Authentication status
 * @property {boolean} isLoading - Loading state
 * @property {function(string|Array): boolean} hasRole - Role check
 * @property {function(string, Object): Promise} signIn - Sign in
 * @property {function(): Promise} signOut - Sign out
 * @property {function(string): void} redirectToLogin - Redirect to login
 * @property {function(): Promise} refreshSession - Refresh session
 */

/**
 * @typedef {Object} AppFunctions
 * @property {function(string, Object, Object): Promise<any>} call - Call server function
 * @property {function(string, Object): Promise<string>} ai - AI completion
 * @property {function(string, Object): Promise<any>} execute - Execute code
 */

/**
 * @typedef {Object} AppBrowser
 * @property {Object} location - Location utilities
 * @property {function(Object): Promise<Object>} location.get - Get location
 * @property {function(function, Object): number} location.watch - Watch location
 * @property {Array|null} location.coords - Current coordinates
 * @property {Object} device - Device information
 * @property {function(): Promise<Object>} network - Network information
 * @property {Object} locale - Locale information
 */

/**
 * @typedef {Object} AppStorage
 * @property {function(File, Object): Promise<Object>} upload - Upload file
 * @property {function(string): Promise<any>} get - Get from storage
 * @property {function(string, any, number): Promise<void>} set - Set in storage
 * @property {function(string): Promise<void>} remove - Remove from storage
 * @property {function(): Promise<void>} clear - Clear storage
 * @property {Storage} local - localStorage
 * @property {Storage} session - sessionStorage
 */

/**
 * @typedef {Object} AppAnalytics
 * @property {function(string, Object): Promise<void>} track - Track event
 * @property {function(string, Object): Promise<void>} identify - Identify user
 * @property {function(string, Object): Promise<void>} page - Track page view
 * @property {function(string, Object): Promise<void>} group - Group user
 */

/**
 * @typedef {Object} AppCache
 * @property {function(string): any} get - Get cached value
 * @property {function(string, any, number): void} set - Set cached value
 * @property {function(string): boolean} has - Check if key exists
 * @property {function(string): boolean} delete - Delete cached value
 * @property {function(): void} clear - Clear all cache
 * @property {function(): Object} stats - Cache statistics
 */

/**
 * @typedef {Object} AppContext
 * @property {Object} params - Route parameters
 * @property {Object} searchParams - Query parameters
 * @property {string} pathname - Current pathname
 * @property {string} domain - Current domain
 * @property {string|null} siteId - Site ID
 * @property {string|null} userId - User ID
 * @property {Object} env - Environment variables
 */

/**
 * @typedef {Object} AppUtils
 * @property {function(Date|string, string): string} formatDate - Format date
 * @property {function(number, string): string} formatCurrency - Format currency
 * @property {function(number, Object): string} formatNumber - Format number
 * @property {function(Array, Array): number} calculateDistance - Calculate distance
 * @property {function(Array, string): string} formatCoordinates - Format coordinates
 * @property {function(Array, number): Object} getBoundingBox - Get bounding box
 * @property {function(function, number): function} debounce - Debounce function
 * @property {function(function, number): function} throttle - Throttle function
 * @property {function(): string} generateId - Generate ID
 * @property {function(string): boolean} validateEmail - Validate email
 * @property {function(string): boolean} validatePhone - Validate phone
 */

/**
 * @typedef {Object} MobilePosition
 * @property {number} latitude - Latitude in degrees
 * @property {number} longitude - Longitude in degrees
 * @property {number|null} altitude - Altitude in meters
 * @property {number} accuracy - Accuracy in meters
 * @property {number|null} altitudeAccuracy - Altitude accuracy in meters
 * @property {number|null} heading - Heading in degrees (0-360)
 * @property {number|null} speed - Speed in m/s
 * @property {number} timestamp - Timestamp in ms
 */

/**
 * @typedef {Object} MobileGPS
 * @property {function(): Promise<{granted: boolean, status: string}>} requestPermission - Request GPS permission
 * @property {function(Object): Promise<MobilePosition>} getCurrentPosition - Get current position
 * @property {function(function, Object): Promise<function>} watchPosition - Watch position changes, returns stop function
 */

/**
 * @typedef {Object} MobilePhotoResult
 * @property {boolean} canceled - Whether the action was canceled
 * @property {string} [uri] - Photo URI
 * @property {string} [base64] - Base64 encoded data
 * @property {number} [width] - Image width
 * @property {number} [height] - Image height
 * @property {string} [type] - MIME type
 */

/**
 * @typedef {Object} MobileCamera
 * @property {function(): Promise<{camera: boolean, mediaLibrary: boolean}>} requestPermission - Request camera permission
 * @property {function(Object): Promise<MobilePhotoResult>} takePhoto - Take a photo
 * @property {function(Object): Promise<{canceled: boolean, assets: Array}>} pickImage - Pick image from library
 * @property {function(Object): Promise<Object>} pickVideo - Pick video from library
 */

/**
 * @typedef {Object} MobileHaptics
 * @property {function('light'|'medium'|'heavy'): Promise<void>} impact - Trigger impact feedback
 * @property {function('success'|'warning'|'error'): Promise<void>} notification - Trigger notification feedback
 * @property {function(): Promise<void>} selection - Trigger selection feedback
 */

/**
 * @typedef {Object} MobileSensorData
 * @property {number} x - X axis value
 * @property {number} y - Y axis value
 * @property {number} z - Z axis value
 * @property {number} timestamp - Timestamp in ms
 */

/**
 * @typedef {Object} MobileAccelerometer
 * @property {function(function, number): Promise<function>} start - Start accelerometer, returns stop function
 * @property {function(): Promise<void>} stop - Stop accelerometer
 */

/**
 * @typedef {Object} MobileGyroscope
 * @property {function(function, number): Promise<function>} start - Start gyroscope, returns stop function
 * @property {function(): Promise<void>} stop - Stop gyroscope
 */

/**
 * @typedef {Object} MobileSensors
 * @property {function(): Promise<{accelerometer: boolean, gyroscope: boolean, magnetometer: boolean}>} isAvailable - Check sensor availability
 * @property {MobileAccelerometer} accelerometer - Accelerometer sensor
 * @property {MobileGyroscope} gyroscope - Gyroscope sensor
 */

/**
 * @typedef {Object} MobileBiometrics
 * @property {function(): Promise<{available: boolean, hasHardware: boolean, isEnrolled: boolean, types: Array<string>}>} isAvailable - Check biometric availability
 * @property {function(Object): Promise<{success: boolean, error: string|null}>} authenticate - Authenticate with biometrics
 */

/**
 * @typedef {Object} MobileClipboard
 * @property {function(string): Promise<{success: boolean}>} copy - Copy text to clipboard
 * @property {function(): Promise<{text: string}>} paste - Paste text from clipboard
 * @property {function(): Promise<{hasContent: boolean}>} hasContent - Check if clipboard has content
 */

/**
 * @typedef {Object} MobileSharing
 * @property {function(): Promise<{available: boolean}>} isAvailable - Check if sharing is available
 * @property {function(Object): Promise<{success: boolean}>} share - Share content
 */

/**
 * @typedef {Object} MobileContact
 * @property {string} id - Contact ID
 * @property {string} name - Full name
 * @property {string} firstName - First name
 * @property {string} lastName - Last name
 * @property {Array<string>} phones - Phone numbers
 * @property {Array<string>} emails - Email addresses
 * @property {boolean} hasImage - Whether contact has an image
 */

/**
 * @typedef {Object} MobileContacts
 * @property {function(): Promise<{granted: boolean}>} requestPermission - Request contacts permission
 * @property {function(Object): Promise<{contacts: Array<MobileContact>}>} getAll - Get all contacts
 */

/**
 * @typedef {Object} MobileNotifications
 * @property {function(): Promise<{granted: boolean}>} requestPermission - Request notification permission
 * @property {function(): Promise<{token: string|null}>} getExpoPushToken - Get Expo push token
 * @property {function(Object): Promise<{id: string}>} scheduleLocal - Schedule local notification
 * @property {function(number): Promise<{success: boolean}>} setBadgeCount - Set app badge count
 * @property {function(): Promise<{count: number}>} getBadgeCount - Get app badge count
 * @property {function(): Promise<{success: boolean}>} cancelAll - Cancel all scheduled notifications
 */

/**
 * @typedef {Object} MobileDeviceInfo
 * @property {string} platform - 'ios' | 'android' | 'web' | 'windows' | 'macos' | 'linux'
 * @property {string} version - OS version
 * @property {string} brand - Device brand/manufacturer
 * @property {boolean} isDevice - Whether running on physical device
 * @property {string} modelName - Device model name
 * @property {string} manufacturer - Device manufacturer
 * @property {string} osName - Operating system name
 * @property {string} osVersion - Operating system version
 * @property {string} deviceType - 'phone' | 'tablet' | 'desktop'
 */

/**
 * @typedef {Object} MobileDevice
 * @property {function(): Promise<MobileDeviceInfo>} getInfo - Get device information
 */

/**
 * @typedef {Object} MobileNativeStorage
 * @property {function(string): Promise<string|null>} getItem - Get item from secure storage
 * @property {function(string, string): Promise<void>} setItem - Set item in secure storage
 * @property {function(string): Promise<void>} removeItem - Remove item from storage
 * @property {function(): Promise<void>} clear - Clear all storage
 */

/**
 * @typedef {Object} MobileNetworkState
 * @property {boolean} isConnected - Whether device is connected to network
 * @property {boolean} isInternetReachable - Whether internet is reachable
 * @property {string} type - Network type
 * @property {Object} details - Additional network details
 */

/**
 * @typedef {Object} MobileNetwork
 * @property {function(): Promise<MobileNetworkState>} getState - Get network state
 * @property {function(function): function} subscribe - Subscribe to network state changes
 */

/**
 * @typedef {Object} MobileBridge
 * @property {function(string, string, Object): Promise<any>} callNative - Call native method
 * @property {function(string, function): function} subscribeToEvent - Subscribe to native event
 * @property {number} pendingRequests - Number of pending requests
 * @property {Array<string>} eventListeners - Active event listener types
 */

/**
 * @typedef {Object} AppMobile
 * @property {boolean} isNative - Whether running in native context (native app shell)
 * @property {boolean} isReady - Whether bridge is ready
 * @property {function(number): Promise<boolean>} waitForReady - Wait for bridge to be ready
 * @property {MobileGPS} gps - GPS/Location services
 * @property {MobileCamera} camera - Camera and media library
 * @property {MobileHaptics} haptics - Haptic feedback
 * @property {MobileSensors} sensors - Device sensors (accelerometer, gyroscope)
 * @property {MobileBiometrics} biometrics - Biometric authentication (Face ID, Touch ID)
 * @property {MobileClipboard} clipboard - Clipboard operations
 * @property {MobileSharing} sharing - Share sheet/intent
 * @property {MobileContacts} contacts - Contacts access
 * @property {MobileNotifications} notifications - Push and local notifications
 * @property {MobileDevice} device - Device information
 * @property {MobileNativeStorage} storage - Secure native storage
 * @property {MobileNetwork} network - Network state and monitoring
 * @property {MobileBridge} _bridge - Low-level bridge access (advanced use)
 */

/**
 * @typedef {Object} App
 * @property {AppDatabase} db - Database operations
 * @property {AppUI} ui - UI utilities
 * @property {AppAuth} auth - Authentication
 * @property {AppFunctions} functions - Function execution
 * @property {AppBrowser} browser - Browser utilities
 * @property {AppStorage} storage - Storage operations
 * @property {AppAnalytics} analytics - Analytics tracking
 * @property {AppCache} cache - Cache operations
 * @property {AppContext} context - Context information
 * @property {AppUtils} utils - Utility functions
 * @property {AppMobile} mobile - Native mobile capabilities (GPS, Camera, Haptics, etc.)
 */

// Export types for TypeScript projects
export const AppTypes = {
  App: 'App',
  AppDatabase: 'AppDatabase',
  AppUI: 'AppUI',
  AppAuth: 'AppAuth',
  AppFunctions: 'AppFunctions',
  AppBrowser: 'AppBrowser',
  AppStorage: 'AppStorage',
  AppAnalytics: 'AppAnalytics',
  AppCache: 'AppCache',
  AppContext: 'AppContext',
  AppUtils: 'AppUtils',
  AppMobile: 'AppMobile',
  MobileGPS: 'MobileGPS',
  MobileCamera: 'MobileCamera',
  MobileHaptics: 'MobileHaptics',
  MobileSensors: 'MobileSensors',
  MobileBiometrics: 'MobileBiometrics',
  MobileClipboard: 'MobileClipboard',
  MobileSharing: 'MobileSharing',
  MobileContacts: 'MobileContacts',
  MobileNotifications: 'MobileNotifications',
  MobileDevice: 'MobileDevice',
  MobileNetwork: 'MobileNetwork',
  MobilePosition: 'MobilePosition',
  MobileDeviceInfo: 'MobileDeviceInfo',
  MobileNetworkState: 'MobileNetworkState'
};

// JSDoc declarations for better IDE support
/**
 * Global app object for JasonJS Framework
 * @type {App}
 */
export const app = undefined;

/**
 * React hook for using the app object
 * @returns {App} The app object with reactive updates
 */
export const useApp = undefined;