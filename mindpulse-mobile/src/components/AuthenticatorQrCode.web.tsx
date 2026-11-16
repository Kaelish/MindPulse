import React from 'react';

interface AuthenticatorQrCodeProps {
  source: string;
}

export const AuthenticatorQrCode: React.FC<AuthenticatorQrCodeProps> = ({ source }) => (
  <img
    src={source}
    alt="Authenticator enrollment QR code"
    style={{ display: 'block', width: 220, height: 220, objectFit: 'contain' }}
  />
);
