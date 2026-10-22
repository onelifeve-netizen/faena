/** Set de íconos propios, trazo simple (stroke), consistentes con el resto del sistema. */
type IconProps = { className?: string };
const base = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export const IconHome = ({ className }: IconProps) => (
  <svg {...base} className={className}><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v9h13v-9" /><path d="M9.5 19v-5h5v5" /></svg>
);
export const IconBox = ({ className }: IconProps) => (
  <svg {...base} className={className}><path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5Z" /><path d="M3.5 7.5 12 12l8.5-4.5" /><path d="M12 12v9" /></svg>
);
export const IconClipboard = ({ className }: IconProps) => (
  <svg {...base} className={className}><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" /><path d="M8.5 11h7M8.5 15h7M8.5 19h4" /></svg>
);
export const IconWrench = ({ className }: IconProps) => (
  <svg {...base} className={className}><path d="M14.7 6.3a4 4 0 1 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.3 2.3-2-2Z" /></svg>
);
export const IconBuilding = ({ className }: IconProps) => (
  <svg {...base} className={className}><rect x="4" y="3" width="10" height="18" rx="1" /><path d="M14 9h6v12h-6" /><path d="M7.5 7h3M7.5 11h3M7.5 15h3" /></svg>
);
export const IconUsers = ({ className }: IconProps) => (
  <svg {...base} className={className}><circle cx="9" cy="8" r="3" /><path d="M3.5 20c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5" /><circle cx="17" cy="9" r="2.3" /><path d="M15.5 14.3c2.1.4 3.8 2.3 4 4.9" /></svg>
);
export const IconShield = ({ className }: IconProps) => (
  <svg {...base} className={className}><path d="M12 3 4.5 6v6c0 5 3.5 7.5 7.5 9 4-1.5 7.5-4 7.5-9V6Z" /><path d="M9 12l2 2 4-4" /></svg>
);
export const IconChart = ({ className }: IconProps) => (
  <svg {...base} className={className}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>
);
export const IconSettings = ({ className }: IconProps) => (
  <svg {...base} className={className}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></svg>
);
