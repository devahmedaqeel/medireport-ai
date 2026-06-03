import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

/**
 * Premium SVG App Logo for MediReport AI
 * Renders a stylized medical report card outline with an embedded heartbeat pulse line
 * and a glowing scanner dot.
 */
export default function AppLogo({ size = 28, color = '#0ea5e9', isDarkMode = false }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {/* Report Document Shield Background */}
      <Rect
        x="10"
        y="10"
        width="80"
        height="80"
        rx="24"
        fill={isDarkMode ? 'rgba(14, 165, 233, 0.12)' : 'rgba(14, 165, 233, 0.08)'}
        stroke={color}
        strokeWidth="7"
      />
      
      {/* Heartbeat Pulse Line representing health data */}
      <Path
        d="M 22 50 H 38 L 46 25 L 54 75 L 62 42 L 68 50 H 78"
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Vibrant Red Scanning AI Indicator dot */}
      <Rect
        x="72"
        y="22"
        width="10"
        height="10"
        rx="5"
        fill="#ef4444"
      />
    </Svg>
  );
}
