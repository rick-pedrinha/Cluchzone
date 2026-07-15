'use strict';

// Local development keeps using port 3001. Public builds use the HTTPS backend.
const isLocalClutchzone = ['localhost', '127.0.0.1'].includes(window.location.hostname);
window.CLUCHZONE_BACKEND_URL = window.CLUCHZONE_BACKEND_URL
  || (isLocalClutchzone ? '' : 'https://clutchzone-backend-1p2m.onrender.com');
window.CLUCHZONE_UI_VERSION = '2026.7.15-3';
document.documentElement.dataset.clutchzoneVersion = window.CLUCHZONE_UI_VERSION;
