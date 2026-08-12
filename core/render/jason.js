/**
 * Vendored from @cm64/jasonjs v1.1.1 — now maintained in-repo.
 *
 * JSON → React renderer. De-minified from the published dist (Babel output)
 * into readable ESM; behavior is preserved 1:1 with the npm package.
 *
 * Exports:
 *   default            JasonCraftThisJSON — renders { components: [...] }
 *   JasonBringsComponent — renders a single component node (internal in the
 *                          published dist; exported here for completeness)
 */

import PropTypes from 'prop-types';
import DOMPurify from 'dompurify';
import { Fragment, jsx, jsxs } from 'react/jsx-runtime';

const JasonBringsComponent = ({
  component: componentName,
  attributes,
  components,
  jcomponents = {},
  jcontext = {},
  innerHTML,
  renderComponent, // Custom rendering escape hatch
}) => {
  // Registry lookup falls back to the raw name (HTML tag string).
  const Component = jcomponents[componentName] || componentName;
  const fComponentExists = jcomponents[componentName] ? true : false;

  if (!Component) {
    console.error(`Component ${componentName} not found in registry.`);
    return null;
  }

  let content = null;

  if (innerHTML) {
    // Sanitize only on the client — DOMPurify needs a DOM.
    let sanitizedInnerHTML = innerHTML;
    if (typeof window !== 'undefined' && innerHTML) {
      sanitizedInnerHTML = DOMPurify.sanitize(innerHTML);
    }

    if (fComponentExists) {
      content = jsxs(Fragment, {
        children: [
          sanitizedInnerHTML,
          components?.map((c, index) =>
            jsx(
              JasonBringsComponent,
              {
                ...c,
                jcomponents: jcomponents,
                jcontext: jcontext,
                renderComponent: renderComponent,
              },
              index
            )
          ),
        ],
      });
    } else {
      // Quirk preserved from the original package: when the component is a
      // plain HTML tag (not in the registry) AND has innerHTML, children are
      // recursed WITHOUT propagating jcomponents/jcontext/renderComponent.
      content = jsxs(Fragment, {
        children: [
          sanitizedInnerHTML,
          components?.map((c, index) => jsx(JasonBringsComponent, { ...c }, index)),
        ],
      });
    }
  } else {
    content = components?.map((c, index) =>
      jsx(
        JasonBringsComponent,
        {
          ...c,
          jcomponents: jcomponents,
          jcontext: jcontext,
          renderComponent: renderComponent,
        },
        index
      )
    );
  }

  // Use the custom renderComponent function if provided (registry components only)
  if (renderComponent && typeof Component === 'function') {
    return renderComponent({
      Component,
      props: { ...attributes, jcontext },
      content,
      componentName,
    });
  }

  return jsx(Component, { jcontext: jcontext, ...attributes, children: content });
};

JasonBringsComponent.propTypes = {
  component: PropTypes.string.isRequired,
  attributes: PropTypes.object,
  components: PropTypes.array,
  innerHTML: PropTypes.string,
  renderComponent: PropTypes.func,
};

const JasonCraftThisJSON = ({
  json,
  jcomponents = {},
  jcontext = {},
  renderComponent, // Custom rendering escape hatch
}) => {
  return jsx(Fragment, {
    children: json.components.map((component, index) =>
      jsx(
        JasonBringsComponent,
        {
          jcontext: jcontext,
          jcomponents: jcomponents,
          renderComponent: renderComponent,
          ...component,
        },
        index
      )
    ),
  });
};

JasonCraftThisJSON.propTypes = {
  json: PropTypes.shape({
    components: PropTypes.arrayOf(PropTypes.object).isRequired,
  }).isRequired,
  jcomponents: PropTypes.object,
  jcontext: PropTypes.object,
  renderComponent: PropTypes.func,
};

export { JasonBringsComponent };
export default JasonCraftThisJSON;
