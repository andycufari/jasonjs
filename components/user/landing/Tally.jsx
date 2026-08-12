// components/landing/Tally.jsx
import React from 'react';

const Tally = ({ formId, title = "Form", height = "100vh" }) => {
    console.log("formId", formId);
  return (
    <div className="w-full" style={{ height }}>
      <iframe
        data-tally-src={`https://tally.so/r/${formId}`}
        width="100%"
        height="100%"
        frameBorder="0"
        marginHeight="0"
        marginWidth="0"
        title={title}
        style={{
          minHeight: height,
          border: 'none'
        }}
      />
    </div>
  );
};

export default Tally;