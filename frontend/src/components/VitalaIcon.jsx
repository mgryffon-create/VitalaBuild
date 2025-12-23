import React from "react";

const VitalaIcon = ({ className = "w-6 h-6", ...props }) => {
  return (
    <img 
      src="/images/vitalamatch-icon.png" 
      alt="VitalaMatch" 
      className={className}
      {...props}
    />
  );
};

export default VitalaIcon;
