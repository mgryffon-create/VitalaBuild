import { Heart } from "lucide-react";

const BrandWordmark = ({ className = "" }) => (
  <span className={`brand-wordmark ${className}`}>
    <Heart size={26} strokeWidth={1.6} aria-hidden="true" />
    VitalaMatch<span className="brand-wordmark-dot">.</span>
  </span>
);
export default BrandWordmark;
