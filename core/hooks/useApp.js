// core/hooks/useApp.js
// React hook for using the app object with reactive updates

'use client';

import { useState, useEffect, useContext, createContext } from 'react';
import { useSession } from 'next-auth/react';
import { useParams, useSearchParams, usePathname } from 'next/navigation';
import { createAppClient } from '../app/client';

// Create context for app state
const AppContext = createContext(null);

// Singleton for standalone app instances to reduce duplication
let standaloneAppInstance = null;

// App Provider component
export function AppProvider({ children, siteId, domain, initialData = {} }) {
  const { data: session, status } = useSession();
  const params = useParams();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  
  const [app] = useState(() => createAppClient());
  
  // Update app context when session or route changes
  useEffect(() => {
    if (app._internal) {
      // Update user state
      app._internal.setUser(session?.user || null);
      
      // Update context
      app._internal.setContext({
        params: Object.fromEntries(Object.entries(params || {})),
        searchParams: Object.fromEntries(searchParams?.entries() || []),
        pathname,
        domain: domain || window.location.hostname,
        siteId,
        session,
        ...initialData
      });
    }
  }, [session, status, params, searchParams, pathname, siteId, domain, app, initialData]);

  return (
    <AppContext.Provider value={app}>
      {children}
    </AppContext.Provider>
  );
}

// Hook to use the app object
export function useApp() {
  const app = useContext(AppContext);

  if (!app) {
    // If no provider, use singleton standalone instance to reduce duplication
    if (!standaloneAppInstance) {
      console.warn('useApp: No AppProvider found, creating standalone instance');
      standaloneAppInstance = createAppClient();
    }
    return standaloneAppInstance;
  }

  return app;
}

// Additional hooks for specific app features
export function useAppDb(databaseId = 'default') {
  const app = useApp();
  
  useEffect(() => {
    if (databaseId) {
      app.db.use(databaseId);
    }
  }, [app, databaseId]);
  
  return app.db;
}

export function useAppAuth() {
  const app = useApp();
  return app.auth;
}

export function useAppUI() {
  const app = useApp();
  return app.ui;
}

export function useAppContext() {
  const app = useApp();
  return app.context;
}

// Hook for location tracking
export function useLocation(options = {}) {
  const app = useApp();
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getCurrentLocation = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const loc = await app.browser.location.get(options);
      setLocation(loc);
      
      // Cache location in session storage
      if (loc) {
        sessionStorage.setItem('app-location', JSON.stringify([loc.longitude, loc.latitude]));
      }
      
      return loc;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const watchLocation = (callback) => {
    return app.browser.location.watch((loc) => {
      setLocation(loc);
      callback(loc);
    }, options);
  };

  return {
    location,
    loading,
    error,
    getCurrentLocation,
    watchLocation
  };
}

// Hook for database queries with loading states
export function useQuery(databaseId, query, dependencies = []) {
  const app = useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    
    const fetchData = async () => {
      if (!mounted) return;
      
      setLoading(true);
      setError(null);
      
      try {
        app.db.use(databaseId);
        const result = await (typeof query === 'function' ? query(app.db) : app.db.fetch(query));
        
        if (mounted) {
          setData(result);
        }
      } catch (err) {
        if (mounted) {
          setError(err.message);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchData();
    
    return () => {
      mounted = false;
    };
  }, [app, databaseId, ...dependencies]);

  const refetch = () => {
    // Trigger re-fetch by updating dependencies
    setLoading(true);
  };

  return { data, loading, error, refetch };
}

// Hook for real-time subscriptions
export function useSubscription(databaseId, filters, dependencies = []) {
  const app = useApp();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let subscription = null;
    let mounted = true;

    const startSubscription = async () => {
      if (!mounted) return;
      
      setLoading(true);
      setError(null);
      
      try {
        app.db.use(databaseId);
        
        // Get initial data
        const initial = await app.db.fetch(filters);
        if (mounted) {
          setData(Array.isArray(initial) ? initial : []);
        }
        
        // Start subscription
        subscription = app.db.subscribe(filters, (change) => {
          if (!mounted) return;
          
          setData(prevData => {
            const newData = [...prevData];
            
            switch (change.type) {
              case 'create':
                newData.push(change.data);
                break;
              case 'update':
                const updateIndex = newData.findIndex(item => item.id === change.id);
                if (updateIndex >= 0) {
                  newData[updateIndex] = { ...newData[updateIndex], ...change.data };
                }
                break;
              case 'delete':
                return newData.filter(item => item.id !== change.id);
              default:
                break;
            }
            
            return newData;
          });
        });
        
      } catch (err) {
        if (mounted) {
          setError(err.message);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    startSubscription();

    return () => {
      mounted = false;
      if (subscription && subscription.unsubscribe) {
        subscription.unsubscribe();
      }
    };
  }, [app, databaseId, JSON.stringify(filters), ...dependencies]);

  return { data, loading, error };
}

export default useApp;