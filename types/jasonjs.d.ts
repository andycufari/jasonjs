// types/jasonjs.d.ts
// TypeScript definitions for JasonJS Framework App Object
// Provides Monaco Editor autocomplete for database components
// 
// AUTOMATIC USER JOINS: Database queries automatically include user profile data
// when user reference fields (createdBy, assignedTo, etc.) are detected

declare module '@jasonjs' {
  /** User profile data automatically joined to database records */
  export interface UserProfile {
    id: string;
    name: string;
    avatar: string | null;
    initials: string;
  }

  /** Database record with automatic user joins */
  export interface DatabaseRecord {
    id: string;
    [key: string]: any;
    
    // Automatic user joins (populated when user reference fields exist)
    user?: UserProfile;           // For createdBy, userId fields
    updatedUser?: UserProfile;    // For updatedBy field
    assignee?: UserProfile;       // For assignedTo field
    owner?: UserProfile;          // For ownerId field
    author?: UserProfile;         // For authorId field
  }

  export interface AppDatabase {
    /** Select database to operate on */
    use(databaseId: string): AppDatabase;
    
    /** 
     * Start query builder
     * @returns QueryBuilder with automatic user joins for records containing user reference fields
     */
    query(filters?: object): QueryBuilder;
    
    /** 
     * Direct fetch operation
     * @returns Records with automatic user profile joins (user, assignee, owner, etc.)
     */
    fetch(query?: object): Promise<DatabaseRecord[]>;
    
    /** Create new record */
    create(data: object): Promise<DatabaseRecord>;
    
    /** Update record by ID */
    update(id: string, data: object): Promise<DatabaseRecord>;
    
    /** Delete record by ID */
    delete(id: string): Promise<boolean>;
    
    /** 
     * Get single record by ID
     * @returns Record with automatic user profile joins
     */
    getById(id: string): Promise<DatabaseRecord | null>;
    
    /** Set up real-time subscription with automatic user joins */
    subscribe(filters: object, callback: (change: any) => void): { unsubscribe: () => void };
    
    /** Geospatial query - find nearby records with user joins */
    nearBy(field: string, coordinates: [number, number], maxDistance: number, minDistance?: number): Promise<DatabaseRecord[]>;
    
    /** Add where clause to query */
    where(field: string, value: any): QueryBuilder;
    
    /** Add ordering to query */
    orderBy(field: string, direction?: 'asc' | 'desc'): QueryBuilder;
    
    /** Limit number of results */
    limit(count: number): QueryBuilder;
    
    /** Skip number of results */
    skip(count: number): QueryBuilder;
  }

  export interface QueryBuilder {
    where(field: string, value: any): QueryBuilder;
    orderBy(field: string, direction?: 'asc' | 'desc'): QueryBuilder;
    limit(count: number): QueryBuilder;
    skip(count: number): QueryBuilder;
    /** Execute query and return records with automatic user joins */
    exec(): Promise<DatabaseRecord[]>;
  }

  export interface AppUI {
    /** Show confirmation dialog */
    confirm(message: string, options?: {
      title?: string;
      okText?: string;
      cancelText?: string;
      type?: 'default' | 'danger';
    }): Promise<boolean>;
    
    /** Show alert dialog */
    alert(message: string, options?: {
      title?: string;
      type?: 'info' | 'success' | 'warning' | 'error';
    }): Promise<void>;
    
    /** Show toast notification */
    toast(message: string, options?: {
      type?: 'info' | 'success' | 'warning' | 'error';
      duration?: number;
      position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    }): void;
    
    /** Show/hide loading overlay */
    loading(show?: boolean): void;
    
    /** Theme management */
    theme: {
      toggle(): void;
      set(theme: 'light' | 'dark'): void;
      current: 'light' | 'dark';
    };
  }

  export interface AppAuth {
    /** Current authenticated user */
    user: {
      id: string;
      name: string;
      email: string;
      roles?: string[];
      [key: string]: any;
    } | null;
    
    /** Whether user is authenticated */
    isAuthenticated: boolean;
    
    /** Whether authentication is loading */
    isLoading: boolean;
    
    /** Check if user has specific role(s) */
    hasRole(role: string | string[]): boolean;
    
    /** Sign in with provider */
    signIn(provider?: string, options?: object): Promise<any>;
    
    /** Sign out current user */
    signOut(): Promise<void>;
    
    /** Redirect to login page */
    redirectToLogin(returnUrl?: string): void;
    
    /** Refresh user session */
    refreshSession(): Promise<void>;
  }

  export interface AppFunctions {
    /** Call server-side function with authorization */
    call(functionName: string, params?: object, options?: object): Promise<any>;
    
    /** Call AI completion (server-side) */
    ai(prompt: string, options?: {
      maxTokens?: number;
      temperature?: number;
      model?: string;
    }): Promise<string>;
    
    /** Execute code dynamically (client-side only) */
    execute(code: string, context?: object): Promise<any>;
    
    /** WebSocket connections for real-time features */
    socket: {
      /** Create WebSocket connection */
      connect(url: string, options?: {
        onOpen?: (event: Event) => void;
        onMessage?: (event: MessageEvent) => void;
        onClose?: (event: CloseEvent) => void;
        onError?: (event: Event) => void;
      }): WebSocket | null;
      
      /** Create WebSocket with JSON message handling */
      connectJSON(url: string, handlers?: {
        onMessage?: (data: any) => void;
        onOpen?: (event: Event) => void;
        onClose?: (event: CloseEvent) => void;
        onError?: (event: Event) => void;
      }): (WebSocket & { sendJSON: (data: any) => void }) | null;
    };
  }

  export interface AppBrowser {
    location: {
      /** Get current location (requires permission) */
      get(options?: {
        enableHighAccuracy?: boolean;
        timeout?: number;
        maximumAge?: number;
      }): Promise<{
        latitude: number;
        longitude: number;
        accuracy: number;
        timestamp: number;
      }>;
      
      /** Watch location changes */
      watch(callback: (position: any) => void, options?: object): number;
      
      /** Cached coordinates [longitude, latitude] */
      coords: [number, number] | null;
    };
    
    /** Device information */
    device: {
      os: { name: string; version: string };
      browser: { name: string; version: string };
      screen: { width: number; height: number };
    };
    
    /** Network information */
    network(): Promise<{
      ip: string;
      isOnline: boolean;
      connection: string;
    }>;
    
    /** Locale information */
    locale: {
      language: string;
      languages: string[];
      country: string;
      timezone: string;
    };
  }

  export interface AppStorage {
    /** Upload file */
    upload(file: File, options?: {
      path?: string;
      maxSize?: number;
    }): Promise<{
      url: string;
      key: string;
      size: number;
    }>;
    
    /** Get stored value */
    get(key: string): Promise<any>;
    
    /** Set stored value with optional TTL */
    set(key: string, value: any, ttl?: number): Promise<void>;
    
    /** Remove stored value */
    remove(key: string): Promise<void>;
    
    /** Clear all stored values */
    clear(): Promise<void>;
    
    /** Browser localStorage */
    local: Storage;
    
    /** Browser sessionStorage */
    session: Storage;
  }

  export interface AppAnalytics {
    /** Track custom event */
    track(event: string, properties?: object): Promise<void>;
    
    /** Identify user with traits */
    identify(userId: string, traits?: object): Promise<void>;
    
    /** Track page view */
    page(name: string, properties?: object): Promise<void>;
    
    /** Group user */
    group(groupId: string, traits?: object): Promise<void>;
  }

  export interface AppCache {
    /** Get cached value */
    get(key: string): any;
    
    /** Set cached value with TTL */
    set(key: string, value: any, ttl?: number): void;
    
    /** Check if key exists in cache */
    has(key: string): boolean;
    
    /** Delete cached value */
    delete(key: string): boolean;
    
    /** Clear all cache */
    clear(): void;
    
    /** Get cache statistics */
    stats(): {
      totalItems: number;
      hitRate: number;
      totalSize: number;
    };
  }

  export interface AppContext {
    /** Route parameters */
    params: { [key: string]: any };
    
    /** Query parameters */
    searchParams: { [key: string]: string };
    
    /** Current pathname */
    pathname: string;
    
    /** Current domain */
    domain: string;
    
    /** Site ID */
    siteId: string | null;
    
    /** Current user ID */
    userId: string | null;
    
    /** Environment variables (safe subset) */
    env: { [key: string]: string };
  }

  export interface AppUtils {
    /** Format date */
    formatDate(date: Date | string, format?: string): string;
    
    /** Format currency */
    formatCurrency(amount: number, currency?: string): string;
    
    /** Format number */
    formatNumber(number: number, options?: object): string;
    
    /** Calculate distance between coordinates */
    calculateDistance(coord1: [number, number], coord2: [number, number]): number;
    
    /** Format coordinates */
    formatCoordinates(coordinates: [number, number]): string;
    
    /** Get bounding box around coordinates */
    getBoundingBox(coordinates: [number, number], radius: number): object;
    
    /** Debounce function */
    debounce(func: Function, wait: number): Function;
    
    /** Throttle function */
    throttle(func: Function, wait: number): Function;
    
    /** Generate unique ID */
    generateId(): string;
    
    /** Validate email address */
    validateEmail(email: string): boolean;
    
    /** Validate phone number */
    validatePhone(phone: string): boolean;
  }

  export interface AppUsers {
    /** Get total user count for current site */
    count(): Promise<number>;
    
    /** Get user statistics (total, active, online) */
    stats(): Promise<{
      total: number;
      active: number;
      online: number;
    }>;
  }

  export interface App {
    /** 
     * Database operations with automatic user joins
     * 
     * When you query records with user reference fields (createdBy, assignedTo, etc.),
     * user profile data is automatically included:
     * 
     * @example
     * const todos = await app.db.query().where('status', 'active');
     * // Returns: [{ id: '1', title: 'Task', createdBy: 'user123', user: { id: 'user123', name: 'John', avatar: '...', initials: 'JD' } }]
     */
    db: AppDatabase;
    
    /** UI utilities (client-side only) */
    ui: AppUI;
    
    /** Authentication */
    auth: AppAuth;
    
    /** Server functions and AI */
    functions: AppFunctions;
    
    /** Browser utilities (client-side only) */
    browser: AppBrowser;
    
    /** Storage operations */
    storage: AppStorage;
    
    /** Analytics tracking */
    analytics: AppAnalytics;
    
    /** Cache operations */
    cache: AppCache;
    
    /** Context information */
    context: AppContext;
    
    /** Utility functions */
    utils: AppUtils;
    
    /** 
     * User statistics and aggregate operations
     * 
     * Note: Individual user profiles are automatically joined to database records.
     * This service provides aggregate data like user counts and statistics.
     */
    users: AppUsers;
  }

  const app: App;
  export default app;
}

// Also provide types for the framework import
declare module '@jasonjs/framework' {
  export const app: import('@jasonjs').App;
  export function useApp(): import('@jasonjs').App;
  export * from '@jasonjs';
}