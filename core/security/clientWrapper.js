// studio/utils/wrapClientFunction.js

// NOTE: This is a basic implementation that works on both server and client side.
// However, it doesn't provide the full sandboxing and security features required.
// A more comprehensive solution that works in both environments and provides
// proper security measures needs to be developed.

export function wrapClientFunction(UserComponent) {
    return function WrappedComponent(props) {
      if (typeof UserComponent !== 'function') {
        console.error('Invalid component provided');
        return null;
      }
  
      try {
        // Basic props sanitization
        const sanitizedProps = JSON.parse(JSON.stringify(props));
  
        // Attempt to render the component
        return UserComponent(sanitizedProps);
      } catch (error) {
        console.error('Error in user component:', error);
        return (
          <div className="component-error">
            <h3>Error in component</h3>
            <p>{error.message}</p>
          </div>
        );
      }
    };
  }