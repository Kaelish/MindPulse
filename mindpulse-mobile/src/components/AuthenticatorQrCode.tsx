import React from 'react';
import { WebView } from 'react-native-webview';

interface AuthenticatorQrCodeProps {
  source: string;
}

const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

export const AuthenticatorQrCode: React.FC<AuthenticatorQrCodeProps> = ({ source }) => (
  <WebView
    source={{
      html: `<html><meta name="viewport" content="width=device-width, initial-scale=1"><body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#fff"><img alt="Authenticator enrollment QR code" src="${escapeHtml(source)}" style="width:220px;height:220px"></body></html>`,
    }}
    originWhitelist={['*']}
    scrollEnabled={false}
  />
);
