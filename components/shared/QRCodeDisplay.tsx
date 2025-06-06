
import React from 'react';
import QRCode from "react-qr-code";

interface QRCodeDisplayProps {
  value: string;
  size?: number;
  level?: 'L' | 'M' | 'Q' | 'H';
  className?: string;
}

export const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({ value, size = 128, level = 'M', className = '' }) => {
  if (!value) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Không có dữ liệu QR.</p>;
  }
  return (
    // Ensuring background is always white for QR code readability
    <div className={`p-2 bg-white inline-block rounded-md shadow ${className}`}>
      <QRCode
        value={value}
        size={size}
        level={level}
        viewBox={`0 0 ${size} ${size}`}
        bgColor="#FFFFFF" // Explicitly set background color for QR code itself
        fgColor="#000000" // Explicitly set foreground color
      />
    </div>
  );
};