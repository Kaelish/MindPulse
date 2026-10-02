'use strict';

/**
 * Starts the CRA dev server over https:// so the embedded Jitsi player gets a
 * secure context. A browser only grants camera/microphone access to an https
 * iframe when every ancestor is secure too — on plain http:// the embed is
 * refused and the call has to open in a new tab instead.
 *
 * CRA generates a self-signed certificate; the browser will ask you to accept
 * it once for https://localhost:3000.
 *
 *   npm run start:https
 */
process.env.HTTPS = 'true';

require('react-scripts/scripts/start');
